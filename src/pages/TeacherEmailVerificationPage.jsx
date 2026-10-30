import { useEffect, useState } from 'react'
import {
  ArrowRight,
  CheckCircle2,
  Mail,
  MailCheck,
  MessageCircle,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react'
import { resendTeacherVerificationV3, verifyTeacherEmailV3 } from '../api/apiV3Client'
import PublicAuthShell from '../components/PublicAuthShell'
import {
  clearTeacherVerificationSession,
  readTeacherVerificationSession,
  storeTeacherVerificationSession,
  TEACHER_VERIFICATION_RESEND_COOLDOWN_MS,
} from '../utils/teacherEmailVerification'

const RESEND_COOLDOWN_SECONDS = TEACHER_VERIFICATION_RESEND_COOLDOWN_MS / 1000

const VERIFICATION_ERROR_MESSAGES = {
  INVALID_VERIFICATION_CODE: 'The code is incorrect. Check it and try again.',
  VERIFICATION_CODE_EXPIRED: 'The code has expired. Request a new code.',
  VERIFICATION_CODE_REPLACED:
    'A newer verification code was sent. Enter the latest code.',
  VERIFICATION_ATTEMPTS_EXCEEDED:
    'Too many incorrect verification attempts. Request a new code before trying again.',
  VERIFICATION_CHALLENGE_LOCKED:
    'Too many incorrect verification attempts. Request a new code before trying again.',
  INVALID_VERIFICATION_CHALLENGE:
    'This verification request is no longer valid. Return to registration or log in again.',
  VERIFICATION_RESEND_COOLDOWN: 'Please wait one minute before requesting another code.',
  VERIFICATION_DAILY_LIMIT_REACHED:
    'The daily limit for verification codes has been reached. Please try again later.',
  REGISTRATION_EXPIRED: 'This registration has expired. Please register again.',
  EMAIL_DELIVERY_FAILED: 'The verification email could not be sent. Tap Resend code to try again.',
  SMS_DELIVERY_FAILED:
    'The SMS code could not be sent. Resend it, or send the code by email instead.',
  SMS_RATE_LIMITED:
    'Too many SMS codes were requested. Wait a minute and resend, or send the code by email.',
  SMS_NOT_AVAILABLE: 'SMS verification is not available. Use email instead.',
}

function getErrorMessage(error, fallback) {
  return VERIFICATION_ERROR_MESSAGES[error?.code] || error?.message || fallback
}

function getCooldownSeconds(session) {
  if (!session?.resendAvailableAt) return null

  const millisecondsRemaining = new Date(session.resendAvailableAt).getTime() - Date.now()
  return Number.isFinite(millisecondsRemaining)
    ? Math.max(0, Math.ceil(millisecondsRemaining / 1000))
    : null
}

function getInitialCooldownSeconds(session) {
  // The backend skips the resend cooldown when the last send failed.
  if (session?.deliveryStatus === 'failed') return 0

  const serverCooldown = getCooldownSeconds(session)
  if (serverCooldown !== null) return serverCooldown
  return session?.challengeUuid
    ? session.resendCooldownSeconds || RESEND_COOLDOWN_SECONDS
    : 0
}

function getExpirySeconds(session) {
  if (!session?.otpExpiresAt) return null

  const millisecondsRemaining = new Date(session.otpExpiresAt).getTime() - Date.now()
  return Number.isFinite(millisecondsRemaining)
    ? Math.max(0, Math.ceil(millisecondsRemaining / 1000))
    : null
}

function formatCountdown(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

// Keep the teacher's own email and the new challenge, and drop the other channel's
// masked destination so the screen never shows a stale address or number.
function mergeChallenge(session, challenge) {
  const bySms = challenge?.verificationMethod === 'sms'

  return storeTeacherVerificationSession({
    ...session,
    ...challenge,
    email: session?.email ?? '',
    emailMasked: bySms ? '' : challenge?.emailMasked || session?.emailMasked || '',
    contactMasked: bySms ? challenge?.contactMasked || session?.contactMasked || '' : '',
  })
}

function TeacherEmailVerificationPage({ onNavigate }) {
  const [verificationSession, setVerificationSession] = useState(() =>
    readTeacherVerificationSession(),
  )
  const challengeUuid = verificationSession?.challengeUuid ?? ''
  const isSms = verificationSession?.verificationMethod === 'sms'
  const destination = isSms
    ? verificationSession?.contactMasked || 'your mobile number'
    : verificationSession?.email || verificationSession?.emailMasked || 'your email'
  const deliveryFailed = verificationSession?.deliveryStatus === 'failed'
  const [otp, setOtp] = useState('')
  const [cooldownSeconds, setCooldownSeconds] = useState(
    () => getInitialCooldownSeconds(verificationSession),
  )
  const [expirySeconds, setExpirySeconds] = useState(
    () => getExpirySeconds(verificationSession),
  )
  const [verified, setVerified] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [resendingMethod, setResendingMethod] = useState('')

  useEffect(() => {
    if (verified || !challengeUuid || cooldownSeconds <= 0) return undefined

    const timer = window.setInterval(
      () => setCooldownSeconds((current) => Math.max(0, current - 1)),
      1000,
    )
    return () => window.clearInterval(timer)
  }, [challengeUuid, cooldownSeconds, verified])

  useEffect(() => {
    if (verified || !challengeUuid || !verificationSession?.otpExpiresAt) return undefined

    const updateExpiry = () => setExpirySeconds(getExpirySeconds(verificationSession))
    updateExpiry()
    const timer = window.setInterval(updateExpiry, 1000)
    return () => window.clearInterval(timer)
  }, [challengeUuid, verificationSession, verified])

  const markVerified = () => {
    setVerified(true)
    setErrorMessage('')
    setStatusMessage('')
    clearTeacherVerificationSession()
  }

  const handleVerify = async (event) => {
    event.preventDefault()

    if (!/^\d{6}$/.test(otp)) {
      setErrorMessage('Enter the complete 6-digit code.')
      return
    }

    setIsVerifying(true)
    setErrorMessage('')
    setStatusMessage('')

    try {
      await verifyTeacherEmailV3({ challengeUuid, otp })
      markVerified()
    } catch (error) {
      if (error.code === 'EMAIL_ALREADY_VERIFIED') {
        markVerified()
      } else {
        if (
          error.code === 'VERIFICATION_ATTEMPTS_EXCEEDED' ||
          error.code === 'VERIFICATION_CHALLENGE_LOCKED'
        ) {
          setOtp('')
        }
        setErrorMessage(getErrorMessage(error, 'Unable to verify the code.'))
      }
    } finally {
      setIsVerifying(false)
    }
  }

  // Leaving method empty resends on the same channel; 'email' switches an SMS
  // registration to email. Every resend returns a new challengeUuid.
  const handleResend = async (method = '') => {
    if (cooldownSeconds > 0 || resendingMethod) return

    setResendingMethod(method || 'same')
    setErrorMessage('')
    setStatusMessage('')

    try {
      const nextChallenge = await resendTeacherVerificationV3(
        method ? { challengeUuid, verificationMethod: method } : { challengeUuid },
      )
      const nextSession = mergeChallenge(verificationSession, nextChallenge)
      setVerificationSession(nextSession)
      setCooldownSeconds(getInitialCooldownSeconds(nextSession))
      setExpirySeconds(getExpirySeconds(nextSession))
      setOtp('')
      setStatusMessage(
        nextSession?.verificationMethod === 'sms'
          ? `A new 6-digit code was sent to ${nextSession.contactMasked || 'your mobile number'}.`
          : `A new 6-digit code was sent to ${
              nextSession?.email || nextSession?.emailMasked || 'your email'
            }.`,
      )
    } catch (error) {
      if (error.code === 'EMAIL_ALREADY_VERIFIED') {
        markVerified()
        return
      }

      if (error.errors?.challengeUuid) {
        // The send failed after a new challenge was created; keep it so the teacher
        // can resend or switch to email without the old, cancelled challenge.
        const nextSession = mergeChallenge(verificationSession, error.errors)
        setVerificationSession(nextSession)
        setCooldownSeconds(getInitialCooldownSeconds(nextSession))
        setExpirySeconds(getExpirySeconds(nextSession))
        setOtp('')
      } else if (error.code === 'VERIFICATION_RESEND_COOLDOWN') {
        setCooldownSeconds(
          getCooldownSeconds(error.errors) ??
            getCooldownSeconds(verificationSession) ??
            RESEND_COOLDOWN_SECONDS,
        )
      }

      setErrorMessage(getErrorMessage(error, 'Unable to resend the code.'))
    } finally {
      setResendingMethod('')
    }
  }

  const resendLabel = (label) =>
    cooldownSeconds > 0 ? `${label} in ${formatCountdown(cooldownSeconds)}` : label

  return (
    <PublicAuthShell
      variant="verification"
      eyebrow="Teacher verification"
      title={isSms ? 'Verify your number.' : 'Verify your email.'}
      description="Enter the code Marka sent before the school reviews the teacher account."
      trustMessage="Verification does not sign you in. Principal approval is still required."
      onNavigate={onNavigate}
    >
      <div className="public-auth-form-content teacher-email-verification-content">
        <div className="public-auth-form-heading teacher-email-verification-heading">
          <p>{isSms ? 'SMS verification' : 'Email verification'}</p>
          <h1>
            {verified
              ? isSms
                ? 'Number confirmed'
                : 'Email confirmed'
              : isSms
                ? 'Check your messages'
                : 'Check your inbox'}
          </h1>
          <span>
            {verified
              ? 'The school must approve the account before you can log in.'
              : 'Enter the 6-digit code to finish your registration.'}
          </span>
        </div>

        {!challengeUuid ? (
          <div className="teacher-email-verification-card">
            <p className="public-auth-message is-error" role="alert">
              No active verification request is available. Please complete registration again or
              log in to resume verification.
            </p>
            <button
              type="button"
              className="public-auth-submit"
              onClick={() => onNavigate('register')}
            >
              Return to registration
              <ArrowRight size={17} aria-hidden="true" />
            </button>
            <div className="public-auth-switch teacher-email-verification-login">
              <button type="button" onClick={() => onNavigate('login')}>
                Back to login
              </button>
            </div>
          </div>
        ) : verified ? (
          <div className="teacher-email-verification-card is-verified">
            <span className="teacher-email-verification-success-icon" aria-hidden="true">
              <CheckCircle2 size={28} strokeWidth={2.2} />
            </span>
            <div>
              <strong>{isSms ? 'Number verified' : 'Email verified'}</strong>
              <span>{destination}</span>
            </div>
            <p className="public-auth-message is-success" role="status">
              {isSms ? 'Number verified successfully.' : 'Email verified successfully.'}
              <br />
              Your account is pending Principal approval.
            </p>
            <button
              type="button"
              className="teacher-email-verification-home"
              onClick={() => onNavigate('login')}
            >
              Back to login
            </button>
          </div>
        ) : (
          <form className="teacher-email-verification-card" onSubmit={handleVerify}>
            <div className="teacher-email-verification-address">
              <span aria-hidden="true">
                {isSms ? (
                  <MessageCircle size={20} strokeWidth={2.2} />
                ) : (
                  <MailCheck size={20} strokeWidth={2.2} />
                )}
              </span>
              <div>
                <small>
                  {deliveryFailed ? "We couldn't send the code to" : 'We sent a 6-digit code to'}
                </small>
                <strong>{destination}</strong>
              </div>
            </div>

            <label className="public-auth-field teacher-email-otp-field" htmlFor="teacher-email-otp">
              <span>6-digit code</span>
              <input
                id="teacher-email-otp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength="6"
                value={otp}
                onChange={(event) => {
                  setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))
                  setErrorMessage('')
                }}
                placeholder="000000"
                aria-invalid={Boolean(errorMessage)}
                autoFocus
              />
            </label>

            {expirySeconds !== null ? (
              <p
                className={`teacher-verification-expiry${expirySeconds === 0 ? ' is-expired' : ''}`}
                role={expirySeconds === 0 ? 'alert' : 'status'}
              >
                {expirySeconds === 0
                  ? 'This code has expired. Request a new code.'
                  : `Code expires in ${formatCountdown(expirySeconds)}`}
              </p>
            ) : null}

            {deliveryFailed && !errorMessage ? (
              <p className="public-auth-account-note">
                {isSms
                  ? "The SMS code couldn't be sent. Resend it, or send the code by email instead."
                  : "The verification email couldn't be sent. Tap Resend code to try again."}
              </p>
            ) : null}

            {errorMessage ? (
              <p className="public-auth-message is-error" role="alert">
                {errorMessage}
              </p>
            ) : null}
            {statusMessage ? (
              <p className="public-auth-message is-success" role="status">
                {statusMessage}
              </p>
            ) : null}

            <button
              type="submit"
              className="public-auth-submit"
              disabled={isVerifying || otp.length !== 6 || expirySeconds === 0}
            >
              <ShieldCheck size={18} strokeWidth={2.2} aria-hidden="true" />
              {isVerifying ? 'Verifying...' : 'Verify'}
            </button>

            <div className="teacher-email-verification-resend">
              <span>Did not receive the code?</span>
              <button
                type="button"
                onClick={() => handleResend()}
                disabled={cooldownSeconds > 0 || Boolean(resendingMethod)}
              >
                <RefreshCw size={15} strokeWidth={2.2} aria-hidden="true" />
                {resendingMethod === 'same' ? 'Sending...' : resendLabel('Resend code')}
              </button>
            </div>

            {isSms ? (
              <div className="teacher-email-verification-resend">
                <span>No SMS?</span>
                <button
                  type="button"
                  onClick={() => handleResend('email')}
                  disabled={cooldownSeconds > 0 || Boolean(resendingMethod)}
                >
                  <Mail size={15} strokeWidth={2.2} aria-hidden="true" />
                  {resendingMethod === 'email'
                    ? 'Sending...'
                    : resendLabel('Send code by email instead')}
                </button>
              </div>
            ) : null}

            <div className="public-auth-switch teacher-email-verification-login">
              <button type="button" onClick={() => onNavigate('login')}>
                Back to login
              </button>
            </div>
          </form>
        )}
      </div>
    </PublicAuthShell>
  )
}

export default TeacherEmailVerificationPage

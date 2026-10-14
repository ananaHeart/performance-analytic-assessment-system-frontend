import { useEffect, useState } from 'react'
import { ArrowRight, CheckCircle2, MailCheck, MessageCircle, RefreshCw, ShieldCheck } from 'lucide-react'
import {
  resendTeacherContactVerificationV3,
  resendTeacherVerificationV3,
  verifyTeacherEmailV3,
} from '../api/apiV3Client'
import PublicAuthShell from '../components/PublicAuthShell'
import {
  clearTeacherVerificationSession,
  readTeacherVerificationSession,
  storeTeacherVerificationSession,
  TEACHER_VERIFICATION_RESEND_COOLDOWN_MS,
} from '../utils/teacherEmailVerification'

const RESEND_COOLDOWN_SECONDS = TEACHER_VERIFICATION_RESEND_COOLDOWN_MS / 1000

const VERIFICATION_ERROR_MESSAGES = {
  INVALID_VERIFICATION_CODE: 'The verification code is incorrect. Check the email and try again.',
  VERIFICATION_CODE_EXPIRED: 'The verification code has expired. Request a new code.',
  VERIFICATION_ATTEMPTS_EXCEEDED:
    'Too many incorrect verification attempts. Request a new code before trying again.',
  VERIFICATION_CHALLENGE_LOCKED:
    'Too many incorrect verification attempts. Request a new code before trying again.',
  INVALID_VERIFICATION_CHALLENGE:
    'This verification request is no longer valid. Return to registration or log in again.',
  VERIFICATION_RESEND_COOLDOWN: 'Please wait one minute before requesting another code.',
  VERIFICATION_DAILY_LIMIT_REACHED:
    'The daily verification email limit has been reached. Please try again later.',
  REGISTRATION_EXPIRED: 'This registration has expired. Please register again.',
  EMAIL_DELIVERY_FAILED:
    'The verification email could not be delivered. Please contact the school administrator.',
  CONTACT_CODE_REQUIRED: 'Enter the code sent to your phone too.',
  INVALID_CONTACT_CODE: 'The SMS code is incorrect.',
  CONTACT_CHALLENGE_LOCKED: 'Too many incorrect SMS codes. Tap Resend SMS code.',
  CONTACT_CODE_EXPIRED: 'The SMS code expired. Tap Resend SMS code.',
  SMS_RATE_LIMITED: 'Too many SMS codes requested. Use the last code or try again in 10 minutes.',
  SMS_NOT_AVAILABLE: 'SMS verification is currently unavailable.',
  CONTACT_ALREADY_VERIFIED: 'Your phone number is already verified.',
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
  const serverCooldown = getCooldownSeconds(session)
  if (serverCooldown !== null) return serverCooldown
  return session?.challengeUuid
    ? session.resendCooldownSeconds || RESEND_COOLDOWN_SECONDS
    : 0
}

function getContactCooldownSeconds(contactVerification) {
  if (!contactVerification?.resendAvailableAt) return null

  const millisecondsRemaining =
    new Date(contactVerification.resendAvailableAt).getTime() - Date.now()
  return Number.isFinite(millisecondsRemaining)
    ? Math.max(0, Math.ceil(millisecondsRemaining / 1000))
    : null
}

function getInitialContactCooldownSeconds(contactVerification) {
  return getContactCooldownSeconds(contactVerification) ?? 0
}

function TeacherEmailVerificationPage({ onNavigate }) {
  const [verificationSession, setVerificationSession] = useState(() =>
    readTeacherVerificationSession(),
  )
  const email = verificationSession?.email ?? ''
  const challengeUuid = verificationSession?.challengeUuid ?? ''
  const contactVerification = verificationSession?.contactVerification ?? null
  const showSmsField = Boolean(contactVerification?.required)
  const [otp, setOtp] = useState('')
  const [smsCode, setSmsCode] = useState('')
  const [contactAlreadyVerified, setContactAlreadyVerified] = useState(false)
  const [cooldownSeconds, setCooldownSeconds] = useState(
    () => getInitialCooldownSeconds(verificationSession),
  )
  const [smsCooldownSeconds, setSmsCooldownSeconds] = useState(
    () => getInitialContactCooldownSeconds(contactVerification),
  )
  const [verified, setVerified] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [isResendingSms, setIsResendingSms] = useState(false)

  useEffect(() => {
    if (verified || !challengeUuid || cooldownSeconds <= 0) return undefined

    const timer = window.setInterval(
      () => setCooldownSeconds((current) => Math.max(0, current - 1)),
      1000,
    )
    return () => window.clearInterval(timer)
  }, [challengeUuid, cooldownSeconds, verified])

  useEffect(() => {
    if (verified || !showSmsField || smsCooldownSeconds <= 0) return undefined

    const timer = window.setInterval(
      () => setSmsCooldownSeconds((current) => Math.max(0, current - 1)),
      1000,
    )
    return () => window.clearInterval(timer)
  }, [showSmsField, smsCooldownSeconds, verified])

  const markVerified = () => {
    setVerified(true)
    setErrorMessage('')
    setStatusMessage(
      'Email verified successfully. Your account is pending Principal approval.',
    )
    clearTeacherVerificationSession()
  }

  const handleVerify = async (event) => {
    event.preventDefault()

    if (!/^\d{6}$/.test(otp)) {
      setErrorMessage('Enter the complete six-digit verification code.')
      return
    }
    if (showSmsField && !/^\d{6}$/.test(smsCode)) {
      setErrorMessage('Enter the complete six-digit SMS code.')
      return
    }

    setIsVerifying(true)
    setErrorMessage('')
    setStatusMessage('')

    try {
      await verifyTeacherEmailV3(
        showSmsField ? { challengeUuid, otp, smsCode } : { challengeUuid, otp },
      )
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
        if (
          error.code === 'INVALID_CONTACT_CODE' ||
          error.code === 'CONTACT_CHALLENGE_LOCKED' ||
          error.code === 'CONTACT_CODE_EXPIRED'
        ) {
          setSmsCode('')
        }
        setErrorMessage(getErrorMessage(error, 'Unable to verify the email address.'))
      }
    } finally {
      setIsVerifying(false)
    }
  }

  const handleResend = async () => {
    if (cooldownSeconds > 0 || isResending) return

    setIsResending(true)
    setErrorMessage('')
    setStatusMessage('')

    try {
      const nextChallenge = await resendTeacherVerificationV3({ challengeUuid })
      const nextSession = storeTeacherVerificationSession({
        ...verificationSession,
        ...nextChallenge,
        email,
      })
      setVerificationSession(nextSession)
      setCooldownSeconds(getInitialCooldownSeconds(nextSession))
      setOtp('')
      setStatusMessage(`A new six-digit verification code was sent to ${email}.`)
    } catch (error) {
      if (error.code === 'EMAIL_ALREADY_VERIFIED') {
        markVerified()
      } else {
        if (error.code === 'VERIFICATION_RESEND_COOLDOWN') {
          setCooldownSeconds(
            getCooldownSeconds(verificationSession) ?? RESEND_COOLDOWN_SECONDS,
          )
        }

        setErrorMessage(getErrorMessage(error, 'Unable to resend the verification code.'))
      }
    } finally {
      setIsResending(false)
    }
  }

  const handleResendSms = async () => {
    if (smsCooldownSeconds > 0 || isResendingSms) return

    setIsResendingSms(true)
    setErrorMessage('')
    setStatusMessage('')

    try {
      const nextContact = await resendTeacherContactVerificationV3(challengeUuid)
      const nextSession = storeTeacherVerificationSession({
        ...verificationSession,
        contactVerification: nextContact,
      })
      setVerificationSession(nextSession)
      setSmsCooldownSeconds(getInitialContactCooldownSeconds(nextSession?.contactVerification))
      setSmsCode('')
      setStatusMessage('A new SMS code was requested.')
    } catch (error) {
      if (error.code === 'SMS_NOT_AVAILABLE') {
        setVerificationSession(
          storeTeacherVerificationSession({
            ...verificationSession,
            contactVerification: { ...contactVerification, required: false },
          }),
        )
      } else if (error.code === 'CONTACT_ALREADY_VERIFIED') {
        setContactAlreadyVerified(true)
      } else if (
        error.code === 'SMS_RATE_LIMITED' ||
        error.code === 'VERIFICATION_RESEND_COOLDOWN'
      ) {
        setSmsCooldownSeconds(getContactCooldownSeconds(contactVerification) ?? RESEND_COOLDOWN_SECONDS)
      }

      setErrorMessage(getErrorMessage(error, 'Unable to resend the SMS code.'))
    } finally {
      setIsResendingSms(false)
    }
  }

  return (
    <PublicAuthShell
      variant="verification"
      eyebrow="Teacher email verification"
      title="Verify your email."
      description="Confirm the registered email before the school reviews the teacher account."
      trustMessage="Verification does not sign you in. Principal approval is still required."
      onNavigate={onNavigate}
    >
      <div className="public-auth-form-content teacher-email-verification-content">
        <div className="public-auth-form-heading teacher-email-verification-heading">
          <p>Email verification</p>
          <h1>{verified ? 'Email confirmed' : 'Check your inbox'}</h1>
          <span>
            {verified
              ? 'Your email is verified. The school must approve the account before you can log in.'
              : 'Enter the six-digit code sent after teacher registration.'}
          </span>
        </div>

        {!email || !challengeUuid ? (
          <div className="teacher-email-verification-card">
            <p className="public-auth-message is-error" role="alert">
              No active email verification request is available. Please complete registration
              again or log in to resume verification.
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
              <strong>Email verified</strong>
              <span>{email}</span>
            </div>
            <p className="public-auth-message is-success" role="status">
              Email verified successfully.
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
                <MailCheck size={20} strokeWidth={2.2} />
              </span>
              <div>
                <small>Verification code sent to</small>
                <strong>{email}</strong>
              </div>
            </div>

            <label className="public-auth-field teacher-email-otp-field" htmlFor="teacher-email-otp">
              <span>Six-digit verification code</span>
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

            {showSmsField ? (
              <label className="public-auth-field teacher-email-otp-field" htmlFor="teacher-email-sms">
                <span>We also sent a code to {contactVerification?.contactMasked || 'your phone'}</span>
                <input
                  id="teacher-email-sms"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength="6"
                  value={smsCode}
                  onChange={(event) => {
                    setSmsCode(event.target.value.replace(/\D/g, '').slice(0, 6))
                    setErrorMessage('')
                  }}
                  placeholder="000000"
                  aria-invalid={Boolean(errorMessage)}
                />
              </label>
            ) : null}
            {!showSmsField && contactVerification?.deliveryStatus === 'failed' ? (
              <p className="public-auth-account-note">
                SMS couldn't be sent; your email code is enough.
              </p>
            ) : null}
            {showSmsField && contactVerification?.deliveryStatus === 'rate_limited' ? (
              <p className="public-auth-account-note">Use the last SMS code you received.</p>
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
              disabled={isVerifying || otp.length !== 6 || (showSmsField && smsCode.length !== 6)}
            >
              <ShieldCheck size={18} strokeWidth={2.2} aria-hidden="true" />
              {isVerifying ? 'Verifying...' : 'Verify email'}
            </button>

            <div className="teacher-email-verification-resend">
              <span>Did not receive the code?</span>
              <button
                type="button"
                onClick={handleResend}
                disabled={cooldownSeconds > 0 || isResending}
              >
                <RefreshCw size={15} strokeWidth={2.2} aria-hidden="true" />
                {isResending
                  ? 'Sending...'
                  : cooldownSeconds > 0
                    ? `Resend in ${cooldownSeconds}s`
                    : 'Resend code'}
              </button>
            </div>

            {showSmsField && !contactAlreadyVerified ? (
              <div className="teacher-email-verification-resend">
                <span>Did not receive the SMS?</span>
                <button
                  type="button"
                  onClick={handleResendSms}
                  disabled={smsCooldownSeconds > 0 || isResendingSms}
                >
                  <MessageCircle size={15} strokeWidth={2.2} aria-hidden="true" />
                  {isResendingSms
                    ? 'Sending...'
                    : smsCooldownSeconds > 0
                      ? `Resend in ${smsCooldownSeconds}s`
                      : 'Resend SMS code'}
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

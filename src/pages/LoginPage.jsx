import { useEffect, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  Mail,
  ShieldCheck,
} from 'lucide-react'
import {
  getCurrentUserV3,
  getV3DeviceIdentifier,
  loginV3,
  verifyMfaLoginV3,
} from '../api/apiV3Client'
import PublicAuthShell from '../components/PublicAuthShell'
import { storeTeacherVerificationSession } from '../utils/teacherEmailVerification'

function LoginPage({ onLoginSuccess, onAuthenticationFailure, onNavigate }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [mfaChallenge, setMfaChallenge] = useState(null)
  const [mfaMethod, setMfaMethod] = useState('authenticator')
  const [mfaCode, setMfaCode] = useState('')
  const [challengeClock, setChallengeClock] = useState(0)

  useEffect(() => {
    if (!mfaChallenge?.expiresAt) return undefined

    const intervalId = window.setInterval(() => setChallengeClock(Date.now()), 1000)
    return () => window.clearInterval(intervalId)
  }, [mfaChallenge?.expiresAt])

  const challengeSecondsRemaining = mfaChallenge?.expiresAt
    ? Math.max(0, Math.ceil((new Date(mfaChallenge.expiresAt).getTime() - challengeClock) / 1000))
    : null
  const challengeMethods = Array.isArray(mfaChallenge?.verificationMethods)
    ? mfaChallenge.verificationMethods
    : ['authenticator']

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    if (!email.trim() || !password) {
      setError('Enter your email address and password.')
      return
    }

    setIsSubmitting(true)

    try {
      const auth = await loginV3(email.trim(), password, getV3DeviceIdentifier())

      if (auth.mfaRequired) {
        if (!auth.mfaChallenge?.challengeUuid) {
          throw new Error('The authenticator challenge is incomplete. Please sign in again.')
        }

        setMfaChallenge(auth.mfaChallenge)
        setMfaMethod(
          auth.mfaChallenge.verificationMethods?.includes('authenticator')
            ? 'authenticator'
            : auth.mfaChallenge.verificationMethods?.[0] || 'authenticator',
        )
        setMfaCode('')
        setPassword('')
        setChallengeClock(Date.now())
        return
      }

      if (!auth.token || !auth.user?.role) {
        throw new Error('The login response is incomplete. Please contact the administrator.')
      }

      const currentUser = await getCurrentUserV3(auth.token)

      if (!currentUser?.role) {
        throw new Error('The account session could not be verified. Please sign in again.')
      }

      onLoginSuccess({ ...auth, user: currentUser })
    } catch (submitError) {
      if (submitError.code === 'EMAIL_VERIFICATION_REQUIRED') {
        storeTeacherVerificationSession({
          email: email.trim(),
          ...(submitError.errors ?? {}),
        })
        setPassword('')
        onNavigate('verify-email')
        return
      }

      if (submitError.status === 401 || submitError.isAuthenticationFailure) {
        onAuthenticationFailure?.()
      }
      setError(submitError.message || 'Unable to sign in. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleMfaSubmit = async (event) => {
    event.preventDefault()
    setError('')

    if (challengeSecondsRemaining === 0) {
      setError('This authenticator challenge has expired. Return to login and try again.')
      return
    }

    if (mfaMethod === 'authenticator' && !/^\d{6}$/.test(mfaCode)) {
      setError('Enter the six-digit code from your authenticator app.')
      return
    }

    if (mfaMethod === 'recovery_code' && !mfaCode.trim()) {
      setError('Enter one unused recovery code.')
      return
    }

    setIsSubmitting(true)

    try {
      const auth = await verifyMfaLoginV3(
        mfaChallenge.challengeUuid,
        mfaCode.trim(),
        mfaMethod,
        getV3DeviceIdentifier(),
      )

      if (!auth.token || !auth.user?.role) {
        throw new Error('The verified login response is incomplete. Please sign in again.')
      }

      const currentUser = await getCurrentUserV3(auth.token)

      if (!currentUser?.role) {
        throw new Error('The account session could not be verified. Please sign in again.')
      }

      onLoginSuccess({ ...auth, user: currentUser })
    } catch (submitError) {
      const attemptsRemaining = submitError.errors?.attemptsRemaining
      const attemptsMessage = Number.isInteger(attemptsRemaining)
        ? ` ${attemptsRemaining} attempt${attemptsRemaining === 1 ? '' : 's'} remaining.`
        : ''
      const terminalChallengeCodes = new Set([
        'MFA_CHALLENGE_INVALID',
        'MFA_CHALLENGE_EXPIRED',
        'MFA_CHALLENGE_LOCKED',
      ])

      setMfaCode('')

      if (terminalChallengeCodes.has(submitError.code)) {
        setMfaChallenge(null)
        setError(`${submitError.message || 'The authenticator challenge ended.'} Sign in again.`)
      } else {
        setError(`${submitError.message || 'Unable to verify the security code.'}${attemptsMessage}`)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const returnToPasswordLogin = () => {
    setMfaChallenge(null)
    setMfaMethod('authenticator')
    setMfaCode('')
    setPassword('')
    setError('')
  }

  return (
    <PublicAuthShell
      variant="login"
      eyebrow="Welcome back"
      title="Continue your assessment work."
      description="Access the school records, assessment tools, and teaching insights assigned to your account."
      trustMessage="Secure access for active school principals and teachers."
      onNavigate={onNavigate}
    >
      <div className="public-auth-form-content">
        {mfaChallenge ? (
          <>
            <div className="public-auth-form-heading mfa-login-heading">
              <p>Security check</p>
              <span className="mfa-login-icon" aria-hidden="true">
                <ShieldCheck size={24} strokeWidth={2.2} />
              </span>
              <h1>Enter your security code</h1>
              <span>
                Use the authenticator connected to {mfaChallenge.emailMasked || email.trim()}.
              </span>
            </div>

            <form className="public-auth-form mfa-login-form" onSubmit={handleMfaSubmit}>
              {challengeMethods.includes('recovery_code') ? (
                <fieldset className="mfa-login-methods" disabled={isSubmitting}>
                  <legend>Verification method</legend>
                  <div>
                    {challengeMethods.includes('authenticator') ? (
                      <label className={mfaMethod === 'authenticator' ? 'is-selected' : ''}>
                        <input
                          type="radio"
                          name="loginMfaMethod"
                          value="authenticator"
                          checked={mfaMethod === 'authenticator'}
                          onChange={() => { setMfaMethod('authenticator'); setMfaCode(''); setError('') }}
                        />
                        Authenticator
                      </label>
                    ) : null}
                    <label className={mfaMethod === 'recovery_code' ? 'is-selected' : ''}>
                      <input
                        type="radio"
                        name="loginMfaMethod"
                        value="recovery_code"
                        checked={mfaMethod === 'recovery_code'}
                        onChange={() => { setMfaMethod('recovery_code'); setMfaCode(''); setError('') }}
                      />
                      Recovery code
                    </label>
                  </div>
                </fieldset>
              ) : null}

              <label className="public-auth-field" htmlFor="mfaCode">
                <span>{mfaMethod === 'authenticator' ? 'Six-digit code' : 'Recovery code'}</span>
                <div className="public-auth-input-wrap">
                  <KeyRound size={18} strokeWidth={2} aria-hidden="true" />
                  <input
                    id="mfaCode"
                    type="text"
                    value={mfaCode}
                    onChange={(event) => {
                      const nextCode = mfaMethod === 'authenticator'
                        ? event.target.value.replace(/\D/g, '').slice(0, 6)
                        : event.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 40)
                      setMfaCode(nextCode)
                      setError('')
                    }}
                    inputMode={mfaMethod === 'authenticator' ? 'numeric' : 'text'}
                    autoComplete="one-time-code"
                    pattern={mfaMethod === 'authenticator' ? '[0-9]{6}' : undefined}
                    maxLength={mfaMethod === 'authenticator' ? 6 : 40}
                    placeholder={mfaMethod === 'authenticator' ? '000000' : 'ABCD-2345-EFGH'}
                    disabled={isSubmitting || challengeSecondsRemaining === 0}
                    autoFocus
                  />
                </div>
              </label>

              <p className="mfa-login-expiry" role="status">
                {challengeSecondsRemaining === null
                  ? 'This challenge expires shortly.'
                  : challengeSecondsRemaining === 0
                    ? 'This challenge has expired.'
                    : `Challenge expires in ${Math.floor(challengeSecondsRemaining / 60)}:${String(challengeSecondsRemaining % 60).padStart(2, '0')}.`}
              </p>

              {error ? (
                <p className="public-auth-message is-error" role="alert" aria-live="polite">
                  {error}
                </p>
              ) : null}

              <button
                type="submit"
                className="public-auth-submit"
                disabled={isSubmitting || challengeSecondsRemaining === 0}
              >
                <span>{isSubmitting ? 'Verifying...' : 'Verify and log in'}</span>
                {!isSubmitting ? <ArrowRight size={18} strokeWidth={2.3} aria-hidden="true" /> : null}
              </button>

              <button
                type="button"
                className="mfa-login-back"
                onClick={returnToPasswordLogin}
                disabled={isSubmitting}
              >
                <ArrowLeft size={16} aria-hidden="true" />
                Back to password login
              </button>
            </form>

            <p className="public-auth-footer">© 2026 Marka</p>
          </>
        ) : (
          <>
        <div className="public-auth-form-heading">
          <p>Account access</p>
          <h1>Log in to Marka Dashboard</h1>
          <span>Use your active school account to continue.</span>
        </div>

        <form className="public-auth-form" onSubmit={handleSubmit}>
          <label className="public-auth-field" htmlFor="email">
            <span>Email address</span>
            <div className="public-auth-input-wrap">
              <Mail size={18} strokeWidth={2} aria-hidden="true" />
              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@school.edu"
                autoComplete="email"
                disabled={isSubmitting}
              />
            </div>
          </label>

          <label className="public-auth-field" htmlFor="password">
            <span>Password</span>
            <div className="public-auth-input-wrap">
              <LockKeyhole size={18} strokeWidth={2} aria-hidden="true" />
              <input
                id="password"
                type={isPasswordVisible ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
                disabled={isSubmitting}
              />
              <button
                type="button"
                className="public-auth-password-toggle"
                onClick={() => setIsPasswordVisible((currentValue) => !currentValue)}
                aria-label={isPasswordVisible ? 'Hide password' : 'Show password'}
                disabled={isSubmitting}
              >
                {isPasswordVisible ? (
                  <EyeOff size={17} strokeWidth={2} />
                ) : (
                  <Eye size={17} strokeWidth={2} />
                )}
              </button>
            </div>
          </label>

          {error ? (
            <p className="public-auth-message is-error" role="alert" aria-live="polite">
              {error}
            </p>
          ) : null}

          <button type="submit" className="public-auth-submit" disabled={isSubmitting}>
            <span>{isSubmitting ? 'Signing in...' : 'Log in'}</span>
            {!isSubmitting ? <ArrowRight size={18} strokeWidth={2.3} aria-hidden="true" /> : null}
          </button>
        </form>

        <p className="public-auth-account-note">
          Access is limited to active principal and teacher accounts.
        </p>
        <p className="public-auth-footer">© 2026 Marka</p>
          </>
        )}
      </div>
    </PublicAuthShell>
  )
}

export default LoginPage

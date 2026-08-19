import { useState } from 'react'
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react'
import { getCurrentUserV2, loginV2 } from '../api/apiV2Client'
import PublicAuthShell from '../components/PublicAuthShell'
import { getV2DeviceIdentifier } from '../v2/v2Session'

function LoginPage({ onLoginSuccess, onNavigate }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    if (!email.trim() || !password) {
      setError('Enter your email address and password.')
      return
    }

    setIsSubmitting(true)

    try {
      const auth = await loginV2(email.trim(), password, getV2DeviceIdentifier())

      if (!auth.token || !auth.user?.role) {
        throw new Error('The login response is incomplete. Please contact the administrator.')
      }

      const currentUser = await getCurrentUserV2(auth.token)

      if (!currentUser?.role) {
        throw new Error('The account session could not be verified. Please sign in again.')
      }

      onLoginSuccess({ ...auth, user: currentUser })
    } catch (submitError) {
      setError(submitError.message || 'Unable to sign in. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
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
        <div className="public-auth-form-heading">
          <p>Account access</p>
          <h1>Log in to SMART</h1>
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
        <p className="public-auth-footer">© 2026 SMART Assessment System</p>
      </div>
    </PublicAuthShell>
  )
}

export default LoginPage

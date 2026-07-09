import { useState } from 'react'
import { ArrowRight, Eye, EyeOff, GraduationCap, LockKeyhole, Mail } from 'lucide-react'
import { login } from '../api/apiClient'

function LoginPage({ onLoginSuccess, onNavigate }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    if (!email.trim() || !password.trim()) {
      setError('Email and password are required.')
      return
    }

    setIsSubmitting(true)

    try {
      const auth = await login(email.trim(), password)
      onLoginSuccess(auth)
    } catch (submitError) {
      setError(submitError.message || 'Login failed.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="public-page login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="login-card-header">
          <span className="login-brand-icon" aria-hidden="true">
            <GraduationCap size={24} strokeWidth={2.2} />
          </span>
          <h1>SMART Assessment System</h1>
        </div>

        <label className="login-field" htmlFor="email">
          <span>Email:</span>
          <div className="login-input-wrap">
            <Mail size={17} strokeWidth={2.1} aria-hidden="true" />
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Enter email"
              autoComplete="email"
            />
          </div>
        </label>

        <label className="login-field" htmlFor="password">
          <span>Password:</span>
          <div className="login-input-wrap">
            <LockKeyhole size={17} strokeWidth={2.1} aria-hidden="true" />
            <input
              id="password"
              type={isPasswordVisible ? 'text' : 'password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter password"
              autoComplete="current-password"
            />
            <button
              type="button"
              className="password-toggle-button"
              onClick={() => setIsPasswordVisible((currentValue) => !currentValue)}
              aria-label={isPasswordVisible ? 'Hide password' : 'Show password'}
            >
              {isPasswordVisible ? (
                <EyeOff size={16} strokeWidth={2.1} />
              ) : (
                <Eye size={16} strokeWidth={2.1} />
              )}
            </button>
          </div>
        </label>

        <label className="remember-login-option">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(event) => setRememberMe(event.target.checked)}
          />
          <span>Remember me</span>
        </label>

        {error ? <p className="form-message form-message-error">{error}</p> : null}

        <button type="submit" className="login-submit-button" disabled={isSubmitting}>
          <span>{isSubmitting ? 'Signing in...' : 'Login'}</span>
          {!isSubmitting ? <ArrowRight size={17} strokeWidth={2.3} aria-hidden="true" /> : null}
        </button>

        <button
          type="button"
          className="login-register-link"
          onClick={() => onNavigate('teacher-sign-up')}
        >
          Create teacher account
        </button>

        <div className="login-card-footer">
          <p>© 2026 SMART Assessment System.</p>
          <p>All Rights Reserved.</p>
        </div>
      </form>
    </section>
  )
}

export default LoginPage
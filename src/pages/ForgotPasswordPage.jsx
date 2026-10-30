import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, Eye, EyeOff, KeyRound, Mail, RefreshCw, ShieldCheck } from 'lucide-react'
import {
  confirmPasswordResetV3,
  requestPasswordResetV3,
  resendPasswordResetV3,
} from '../api/apiV3Client'
import PublicAuthShell from '../components/PublicAuthShell'

function secondsUntil(value) {
  if (!value) return 0
  const milliseconds = new Date(value).getTime() - Date.now()
  return Number.isFinite(milliseconds) ? Math.max(0, Math.ceil(milliseconds / 1000)) : 0
}

function formatCountdown(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function getPasswordRuleError(value) {
  const missing = []
  if (value.length < 10) missing.push('at least 10 characters')
  if (!/[A-Z]/.test(value)) missing.push('an uppercase letter')
  if (!/[a-z]/.test(value)) missing.push('a lowercase letter')
  if (!/\d/.test(value)) missing.push('a number')
  if (!/[^A-Za-z0-9]/.test(value)) missing.push('a special character')
  return missing.length ? `New password must include ${missing.join(', ')}.` : ''
}

function getResetError(error, fallback) {
  const messages = {
    INVALID_VERIFICATION_CODE: 'The code is incorrect. Check it and try again.',
    VERIFICATION_CODE_EXPIRED: 'The code expired. Request a new code.',
    VERIFICATION_CODE_REPLACED: 'A newer code was sent. Enter the latest code.',
    VERIFICATION_CHALLENGE_LOCKED: 'Too many incorrect attempts. Request a new code.',
    VERIFICATION_RESEND_COOLDOWN: 'Wait before requesting another code.',
    SMS_NOT_AVAILABLE: 'SMS delivery is unavailable. Use the account email instead.',
    PASSWORD_RESET_RATE_LIMITED: error?.errors?.retryAfterSeconds
      ? `Too many reset requests. Try again in ${error.errors.retryAfterSeconds} seconds.`
      : 'Too many reset requests. Try again later.',
  }
  return messages[error?.code] || error?.message || fallback
}

function ResetPasswordField({ field, label, value, onChange, visible, onToggle }) {
  const VisibilityIcon = visible ? EyeOff : Eye
  return (
    <label className="public-auth-field" htmlFor={`reset-${field}`}>
      <span>{label}</span>
      <div className="public-auth-input-wrap">
        <KeyRound size={18} aria-hidden="true" />
        <input
          id={`reset-${field}`}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          autoComplete="new-password"
          required
        />
        <button
          type="button"
          className="public-auth-password-toggle"
          onClick={onToggle}
          aria-label={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
        >
          <VisibilityIcon size={17} aria-hidden="true" />
        </button>
      </div>
    </label>
  )
}

function ForgotPasswordPage({ onNavigate }) {
  const [step, setStep] = useState('request')
  const [identifier, setIdentifier] = useState('')
  const [challenge, setChallenge] = useState(null)
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [visibleField, setVisibleField] = useState('')
  const [cooldown, setCooldown] = useState(0)
  const [expiry, setExpiry] = useState(null)
  const [busyAction, setBusyAction] = useState('')
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')

  useEffect(() => {
    if (cooldown <= 0) return undefined
    const timer = window.setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000)
    return () => window.clearInterval(timer)
  }, [cooldown])

  useEffect(() => {
    if (!challenge?.otpExpiresAt) return undefined
    const updateExpiry = () => setExpiry(secondsUntil(challenge.otpExpiresAt))
    updateExpiry()
    const timer = window.setInterval(updateExpiry, 1000)
    return () => window.clearInterval(timer)
  }, [challenge])

  const applyChallenge = (nextChallenge) => {
    setChallenge(nextChallenge)
    setCode('')
    setCooldown(secondsUntil(nextChallenge?.resendAvailableAt))
    setExpiry(nextChallenge?.otpExpiresAt ? secondsUntil(nextChallenge.otpExpiresAt) : null)
  }

  const requestReset = async (event) => {
    event.preventDefault()
    const normalizedIdentifier = identifier.trim()
    if (!normalizedIdentifier) {
      setError('Enter the email address or contact number connected to the account.')
      return
    }

    setBusyAction('request')
    setError('')
    setStatus('')
    try {
      const nextChallenge = await requestPasswordResetV3(normalizedIdentifier)
      applyChallenge(nextChallenge)
      setStep('confirm')
      setStatus(`If an account matches, a code was sent to ${nextChallenge?.destinationMasked || 'the registered contact method'}.`)
    } catch (requestError) {
      setError(getResetError(requestError, 'Unable to start password recovery.'))
    } finally {
      setBusyAction('')
    }
  }

  const resendCode = async () => {
    if (!challenge?.challengeUuid || cooldown > 0) return
    setBusyAction('resend')
    setError('')
    setStatus('')
    try {
      const nextChallenge = await resendPasswordResetV3(challenge.challengeUuid)
      applyChallenge(nextChallenge)
      setStatus('A new verification code was sent.')
    } catch (requestError) {
      if (requestError.code === 'VERIFICATION_RESEND_COOLDOWN') {
        setCooldown(secondsUntil(requestError.errors?.resendAvailableAt))
      }
      setError(getResetError(requestError, 'Unable to resend the verification code.'))
    } finally {
      setBusyAction('')
    }
  }

  const confirmReset = async (event) => {
    event.preventDefault()
    if (expiry === 0) {
      setError('This code has expired. Request a new code.')
      return
    }
    if (!/^\d{6}$/.test(code)) {
      setError('Enter the complete 6-digit code.')
      return
    }
    const passwordError = getPasswordRuleError(newPassword)
    if (passwordError) {
      setError(passwordError)
      return
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.')
      return
    }

    setBusyAction('confirm')
    setError('')
    setStatus('')
    try {
      await confirmPasswordResetV3(challenge.challengeUuid, code, newPassword)
      setStep('complete')
      setChallenge(null)
      setCode('')
      setExpiry(null)
      setNewPassword('')
      setConfirmPassword('')
      setStatus('Your password was changed. All existing sessions were signed out.')
    } catch (requestError) {
      const remaining = requestError.errors?.remainingAttempts
      const suffix = Number.isInteger(remaining)
        ? ` ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
        : ''
      setError(`${getResetError(requestError, 'Unable to reset the password.')}${suffix}`)
    } finally {
      setBusyAction('')
    }
  }

  return (
    <PublicAuthShell variant="login" eyebrow="Account recovery" title="Reset your password." description="Use the verified email address or contact number connected to your account." trustMessage="A reset code expires and can only be used once." onNavigate={onNavigate}>
      <div className="public-auth-form-content forgot-password-content">
        <div className="public-auth-form-heading"><p>Password recovery</p><h1>{step === 'complete' ? 'Password updated' : step === 'confirm' ? 'Enter the reset code' : 'Find your account'}</h1><span>{step === 'confirm' ? 'Enter the code and choose a new password.' : step === 'complete' ? 'Sign in again using the new password.' : 'Use your account email or Philippine contact number.'}</span></div>

        {status ? <p className="public-auth-message is-success" role="status">{status}</p> : null}
        {error ? <p className="public-auth-message is-error" role="alert">{error}</p> : null}

        {step === 'request' ? (
          <form className="public-auth-form" onSubmit={requestReset}>
            <label className="public-auth-field" htmlFor="resetIdentifier"><span>Email or contact number</span><div className="public-auth-input-wrap"><Mail size={18} aria-hidden="true" /><input id="resetIdentifier" value={identifier} onChange={(event) => { setIdentifier(event.target.value); setError('') }} autoComplete="username" placeholder="name@school.edu or 09XXXXXXXXX" required /></div></label>
            <button type="submit" className="public-auth-submit" disabled={Boolean(busyAction)}>{busyAction === 'request' ? 'Sending...' : 'Send reset code'}{!busyAction ? <ArrowRight size={18} aria-hidden="true" /> : null}</button>
          </form>
        ) : null}

        {step === 'confirm' ? (
          <form className="public-auth-form" onSubmit={confirmReset}>
            <label className="public-auth-field" htmlFor="resetCode"><span>6-digit code</span><div className="public-auth-input-wrap"><ShieldCheck size={18} aria-hidden="true" /><input id="resetCode" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => { setCode(event.target.value.replace(/\D/g, '').slice(0, 6)); setError('') }} required /></div></label>
            {expiry !== null ? <p className={`teacher-verification-expiry${expiry === 0 ? ' is-expired' : ''}`} role={expiry === 0 ? 'alert' : 'status'}>{expiry === 0 ? 'This code has expired. Request a new code.' : `Code expires in ${formatCountdown(expiry)}`}</p> : null}
            <ResetPasswordField field="new" label="New password" value={newPassword} onChange={(event) => { setNewPassword(event.target.value); setError('') }} visible={visibleField === 'new'} onToggle={() => setVisibleField((current) => current === 'new' ? '' : 'new')} />
            <ResetPasswordField field="confirm" label="Confirm new password" value={confirmPassword} onChange={(event) => { setConfirmPassword(event.target.value); setError('') }} visible={visibleField === 'confirm'} onToggle={() => setVisibleField((current) => current === 'confirm' ? '' : 'confirm')} />
            <button type="submit" className="public-auth-submit" disabled={Boolean(busyAction) || expiry === 0}>{busyAction === 'confirm' ? 'Updating...' : 'Reset password'}{!busyAction ? <ArrowRight size={18} aria-hidden="true" /> : null}</button>
            <button type="button" className="forgot-password-resend" onClick={resendCode} disabled={Boolean(busyAction) || cooldown > 0}><RefreshCw size={15} aria-hidden="true" />{cooldown > 0 ? `Resend in ${formatCountdown(cooldown)}` : 'Resend code'}</button>
          </form>
        ) : null}

        {step === 'complete' ? <button type="button" className="public-auth-submit" onClick={() => onNavigate('login')}>Continue to login<ArrowRight size={18} aria-hidden="true" /></button> : null}
        {step !== 'complete' ? <button type="button" className="forgot-password-back" onClick={() => onNavigate('login')} disabled={Boolean(busyAction)}><ArrowLeft size={16} aria-hidden="true" />Back to login</button> : null}
        <p className="public-auth-footer">© 2026 Marka</p>
      </div>
    </PublicAuthShell>
  )
}

export default ForgotPasswordPage

import { useEffect, useState } from 'react'
import { Eye, EyeOff, KeyRound, MailCheck, RefreshCw, Save } from 'lucide-react'
import PasswordGuide from './PasswordGuide'
import {
  resendPasswordChangeCodeV3,
  startPasswordChangeCodeV3,
  updateAccountPasswordV3,
} from '../api/apiV3Client'
import { getPasswordErrors } from '../utils/passwordRules'

const EMPTY_FIELD_ERRORS = { currentPassword: '', newPassword: '', confirmPassword: '', code: '' }

// Errors that belong to one field are shown under that field; the rest go to the panel message.
const CODE_ERROR_MESSAGES = {
  INVALID_VERIFICATION_CODE: 'The code is incorrect. Check it and try again.',
  VERIFICATION_CODE_EXPIRED: 'The code expired. Request a new code.',
  VERIFICATION_CODE_REPLACED: 'A newer code was sent. Enter the latest code.',
  VERIFICATION_CHALLENGE_LOCKED: 'Too many incorrect attempts. Request a new code.',
}

function secondsUntil(value) {
  if (!value) return 0
  return Math.max(0, Math.ceil((new Date(value).getTime() - Date.now()) / 1000))
}

function formatCountdown(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function PasswordInput({ id, label, value, onChange, visible, onToggle, autoComplete, error }) {
  const VisibilityIcon = visible ? EyeOff : Eye

  return (
    <label className="account-password-field" htmlFor={id}>
      <span>{label}</span>
      <span className="account-password-input">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          aria-invalid={Boolean(error)}
          required
        />
        <button
          type="button"
          onClick={onToggle}
          aria-label={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
          title={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
        >
          <VisibilityIcon size={17} aria-hidden="true" />
        </button>
      </span>
      {error ? <small className="account-password-error">{error}</small> : null}
    </label>
  )
}

// SET-6 + R2-10: change password with a 6-digit code emailed to the account.
// Step 1 checks the three passwords and sends the code; step 2 takes the code and saves.
function AccountPasswordPanel({ token }) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [visibleField, setVisibleField] = useState('')
  const [fieldErrors, setFieldErrors] = useState(EMPTY_FIELD_ERRORS)
  const [challenge, setChallenge] = useState(null)
  const [code, setCode] = useState('')
  const [cooldown, setCooldown] = useState(0)
  const [expiry, setExpiry] = useState(null)
  const [busyAction, setBusyAction] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

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

  const clearMessages = () => {
    setError('')
    setSuccess('')
  }

  const updateField = (setter, field) => (event) => {
    setter(event.target.value)
    setFieldErrors((current) => ({ ...current, [field]: '' }))
    clearMessages()
  }

  const setNextChallenge = (nextChallenge) => {
    setChallenge(nextChallenge)
    setCode('')
    setCooldown(secondsUntil(nextChallenge?.resendAvailableAt))
    setExpiry(nextChallenge?.otpExpiresAt ? secondsUntil(nextChallenge.otpExpiresAt) : null)
  }

  const validatePasswords = () => {
    const missing = getPasswordErrors(newPassword)
    const nextErrors = {
      ...EMPTY_FIELD_ERRORS,
      currentPassword: currentPassword ? '' : 'Enter your current password.',
      newPassword: missing.length
        ? `New password still needs: ${missing.join(', ')}.`
        : currentPassword && currentPassword === newPassword
          ? 'Choose a new password that is different from the current password.'
          : '',
      confirmPassword: confirmPassword === newPassword ? '' : 'New password and confirmation do not match.',
    }
    setFieldErrors(nextErrors)
    return !Object.values(nextErrors).some(Boolean)
  }

  const sendCode = async () => {
    clearMessages()
    if (!validatePasswords()) return

    setBusyAction('send')
    try {
      const nextChallenge = await startPasswordChangeCodeV3(token)
      setNextChallenge(nextChallenge)
      setSuccess(`We sent a 6-digit code to ${nextChallenge.destinationMasked || 'your email'}. Enter it below.`)
    } catch (sendError) {
      if (sendError.code === 'VERIFICATION_RESEND_COOLDOWN') {
        setCooldown(secondsUntil(sendError.errors?.resendAvailableAt))
      }
      setError(sendError.message || 'Unable to send the code.')
    } finally {
      setBusyAction('')
    }
  }

  const resendCode = async () => {
    if (!challenge?.challengeUuid || cooldown > 0) return
    clearMessages()
    setBusyAction('resend')
    try {
      const nextChallenge = await resendPasswordChangeCodeV3(challenge.challengeUuid, token)
      setNextChallenge(nextChallenge)
      setFieldErrors((current) => ({ ...current, code: '' }))
      setSuccess(`A new code was sent to ${nextChallenge.destinationMasked || 'your email'}.`)
    } catch (resendError) {
      if (resendError.code === 'VERIFICATION_RESEND_COOLDOWN') {
        setCooldown(secondsUntil(resendError.errors?.resendAvailableAt))
        setError('Wait before requesting another code.')
      } else {
        setError(resendError.message || 'Unable to resend the code.')
      }
    } finally {
      setBusyAction('')
    }
  }

  const savePassword = async () => {
    clearMessages()
    if (!validatePasswords()) return
    if (expiry === 0) {
      setFieldErrors((current) => ({ ...current, code: 'The code expired. Request a new code.' }))
      return
    }
    if (!/^\d{6}$/.test(code)) {
      setFieldErrors((current) => ({ ...current, code: 'Enter the 6-digit code from your email.' }))
      return
    }

    setBusyAction('save')
    try {
      await updateAccountPasswordV3(
        { currentPassword, newPassword, challengeUuid: challenge.challengeUuid, code },
        token,
      )
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setVisibleField('')
      setFieldErrors(EMPTY_FIELD_ERRORS)
      setChallenge(null)
      setCode('')
      setExpiry(null)
      setCooldown(0)
      setSuccess('Password updated successfully. Other signed-in sessions were ended.')
    } catch (saveError) {
      const errorCode = saveError.code
      if (errorCode === 'CURRENT_PASSWORD_INCORRECT') {
        setFieldErrors((current) => ({ ...current, currentPassword: 'The current password is incorrect.' }))
      } else if (errorCode === 'PASSWORD_UNCHANGED') {
        setFieldErrors((current) => ({
          ...current,
          newPassword: 'Choose a password that is different from the current password.',
        }))
      } else if (CODE_ERROR_MESSAGES[errorCode]) {
        setFieldErrors((current) => ({ ...current, code: CODE_ERROR_MESSAGES[errorCode] }))
      } else if (errorCode === 'VERIFICATION_CODE_REQUIRED') {
        setChallenge(null)
        setError('Send a code to your email first.')
      } else if (saveError.errors?.newPassword || saveError.errors?.currentPassword || saveError.errors?.code) {
        setFieldErrors((current) => ({
          ...current,
          newPassword: saveError.errors?.newPassword || current.newPassword,
          currentPassword: saveError.errors?.currentPassword || current.currentPassword,
          code: saveError.errors?.code || current.code,
        }))
      } else {
        setError(saveError.message || 'Unable to update the password.')
      }
    } finally {
      setBusyAction('')
    }
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    if (challenge) void savePassword()
    else void sendCode()
  }

  const fields = [
    ['current', 'currentPassword', 'Current password', currentPassword, setCurrentPassword, 'current-password'],
    ['new', 'newPassword', 'New password', newPassword, setNewPassword, 'new-password'],
    ['confirm', 'confirmPassword', 'Confirm new password', confirmPassword, setConfirmPassword, 'new-password'],
  ]

  return (
    <section className="content-card account-password-panel" aria-labelledby="accountPasswordTitle">
      <header>
        <span className="account-profile-icon" aria-hidden="true">
          <KeyRound size={20} strokeWidth={2.2} />
        </span>
        <div>
          <p className="content-card-tag">Security</p>
          <h2 id="accountPasswordTitle">Change password</h2>
        </div>
      </header>

      {error ? <p className="form-message form-message-error" role="alert">{error}</p> : null}
      {success ? <p className="form-message form-message-success" role="status">{success}</p> : null}

      <PasswordGuide password={newPassword} />

      <form className="account-password-form" onSubmit={handleSubmit} noValidate>
        <div className="account-password-fields">
          {fields.map(([key, field, label, value, setter, autoComplete]) => (
            <PasswordInput
              key={key}
              id={`account-${key}-password`}
              label={label}
              value={value}
              onChange={updateField(setter, field)}
              visible={visibleField === key}
              onToggle={() => setVisibleField((current) => (current === key ? '' : key))}
              autoComplete={autoComplete}
              error={fieldErrors[field]}
            />
          ))}
        </div>

        {challenge ? (
          <div className="account-password-code">
            <label className="account-password-field" htmlFor="account-password-code">
              <span>6-digit code from your email</span>
              <input
                id="account-password-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(event) => {
                  setCode(event.target.value.replace(/\D/g, '').slice(0, 6))
                  setFieldErrors((current) => ({ ...current, code: '' }))
                  clearMessages()
                }}
                aria-invalid={Boolean(fieldErrors.code)}
              />
              {fieldErrors.code ? <small className="account-password-error">{fieldErrors.code}</small> : null}
            </label>
            {expiry !== null ? (
              <p
                className={`teacher-verification-expiry${expiry === 0 ? ' is-expired' : ''}`}
                role={expiry === 0 ? 'alert' : 'status'}
              >
                {expiry === 0 ? 'This code has expired. Request a new code.' : `Code expires in ${formatCountdown(expiry)}`}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="account-password-step-note">
            For your security, a 6-digit code is emailed to you before the password changes.
          </p>
        )}

        <div className="account-password-actions">
          {challenge ? (
            <button
              type="button"
              className="secondary-button"
              onClick={resendCode}
              disabled={Boolean(busyAction) || cooldown > 0}
            >
              <RefreshCw size={15} aria-hidden="true" />
              {cooldown > 0 ? `Resend in ${formatCountdown(cooldown)}` : 'Resend code'}
            </button>
          ) : null}
          <button type="submit" className="primary-button" disabled={Boolean(busyAction)}>
            {challenge ? <Save size={15} aria-hidden="true" /> : <MailCheck size={15} aria-hidden="true" />}
            {busyAction === 'send'
              ? 'Sending code...'
              : busyAction === 'save'
                ? 'Updating...'
                : challenge
                  ? 'Update password'
                  : 'Send code to my email'}
          </button>
        </div>
      </form>
    </section>
  )
}

export default AccountPasswordPanel

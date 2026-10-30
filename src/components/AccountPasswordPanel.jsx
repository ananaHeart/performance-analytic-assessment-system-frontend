import { useState } from 'react'
import { Eye, EyeOff, KeyRound, Save } from 'lucide-react'
import { updateAccountPasswordV3 } from '../api/apiV3Client'

function getPasswordRuleError(value) {
  const missing = []
  if (value.length < 10) missing.push('at least 10 characters')
  if (!/[A-Z]/.test(value)) missing.push('an uppercase letter')
  if (!/[a-z]/.test(value)) missing.push('a lowercase letter')
  if (!/\d/.test(value)) missing.push('a number')
  if (!/[^A-Za-z0-9]/.test(value)) missing.push('a special character')
  return missing.length ? `New password must include ${missing.join(', ')}.` : ''
}

function PasswordInput({ id, label, value, onChange, visible, onToggle, autoComplete }) {
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
    </label>
  )
}

function AccountPasswordPanel({ token }) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [visibleField, setVisibleField] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const clearMessages = () => {
    setError('')
    setSuccess('')
  }

  const savePassword = async (event) => {
    event.preventDefault()
    clearMessages()

    const ruleError = getPasswordRuleError(newPassword)
    if (ruleError) {
      setError(ruleError)
      return
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.')
      return
    }
    if (currentPassword === newPassword) {
      setError('Choose a new password that is different from the current password.')
      return
    }

    setIsSaving(true)
    try {
      await updateAccountPasswordV3({ currentPassword, newPassword }, token)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setVisibleField('')
      setSuccess('Password updated successfully. Other signed-in sessions were ended.')
    } catch (saveError) {
      const messages = {
        CURRENT_PASSWORD_INCORRECT: 'The current password is incorrect.',
        PASSWORD_UNCHANGED: 'Choose a password that is different from the current password.',
      }
      setError(messages[saveError.code] || saveError.message || 'Unable to update the password.')
    } finally {
      setIsSaving(false)
    }
  }

  const fields = [
    ['current', 'Current password', currentPassword, setCurrentPassword, 'current-password'],
    ['new', 'New password', newPassword, setNewPassword, 'new-password'],
    ['confirm', 'Confirm new password', confirmPassword, setConfirmPassword, 'new-password'],
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

      <form className="account-password-form" onSubmit={savePassword}>
        {fields.map(([key, label, value, setter, autoComplete]) => (
          <PasswordInput
            key={key}
            id={`account-${key}-password`}
            label={label}
            value={value}
            onChange={(event) => {
              setter(event.target.value)
              clearMessages()
            }}
            visible={visibleField === key}
            onToggle={() => setVisibleField((current) => (current === key ? '' : key))}
            autoComplete={autoComplete}
          />
        ))}
        <button type="submit" className="primary-button" disabled={isSaving}>
          <Save size={15} aria-hidden="true" />
          {isSaving ? 'Updating...' : 'Update password'}
        </button>
      </form>
    </section>
  )
}

export default AccountPasswordPanel

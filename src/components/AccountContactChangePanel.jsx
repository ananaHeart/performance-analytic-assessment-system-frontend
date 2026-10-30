import { useEffect, useState } from 'react'
import { AtSign, Check, Mail, Phone, RefreshCw, X } from 'lucide-react'
import {
  confirmAccountContactChangeV3,
  getAccountV3,
  resendAccountContactChangeV3,
  startAccountContactChangeV3,
} from '../api/apiV3Client'

function secondsUntil(value) {
  if (!value) return 0
  const milliseconds = new Date(value).getTime() - Date.now()
  return Number.isFinite(milliseconds) ? Math.max(0, Math.ceil(milliseconds / 1000)) : 0
}

function formatNextAllowed(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function getChangeError(error, fallback) {
  const messages = {
    CHANGE_NOT_ALLOWED_YET: error?.errors?.nextAllowedAt
      ? `This detail can be changed again on ${formatNextAllowed(error.errors.nextAllowedAt)}.`
      : 'This detail cannot be changed yet.',
    INVALID_VERIFICATION_CODE: 'The code is incorrect. Check it and try again.',
    VERIFICATION_CODE_EXPIRED: 'The code expired. Request a new code.',
    VERIFICATION_CODE_REPLACED: 'A newer code was sent. Enter the latest code.',
    VERIFICATION_CHALLENGE_LOCKED: 'Too many incorrect attempts. Request a new code.',
    VERIFICATION_RESEND_COOLDOWN: 'Wait before requesting another code.',
    SMS_NOT_AVAILABLE: 'SMS delivery is unavailable. The contact number cannot be changed right now.',
  }
  return messages[error?.code] || error?.message || fallback
}

function AccountContactChangePanel({ token, onAccountUpdated }) {
  const [account, setAccount] = useState(null)
  const [activeChange, setActiveChange] = useState(null)
  const [newValue, setNewValue] = useState('')
  const [challenge, setChallenge] = useState(null)
  const [code, setCode] = useState('')
  const [cooldown, setCooldown] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [busyAction, setBusyAction] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    let active = true
    getAccountV3(token)
      .then((nextAccount) => {
        if (active) setAccount(nextAccount)
      })
      .catch((loadError) => {
        if (active && !loadError.isAuthenticationFailure) {
          setError(loadError.message || 'Unable to load contact settings.')
        }
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })
    return () => {
      active = false
    }
  }, [token])

  useEffect(() => {
    if (cooldown <= 0) return undefined
    const timer = window.setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000)
    return () => window.clearInterval(timer)
  }, [cooldown])

  const cancelChange = () => {
    if (busyAction) return
    setActiveChange(null)
    setNewValue('')
    setChallenge(null)
    setCode('')
    setCooldown(0)
    setError('')
  }

  const openChange = (kind) => {
    setActiveChange(kind)
    setNewValue('')
    setChallenge(null)
    setCode('')
    setError('')
    setSuccess('')
  }

  const validateValue = () => {
    const value = newValue.trim()
    if (activeChange === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      return 'Enter a complete email address.'
    }
    if (activeChange === 'contact' && !/^(09\d{9}|\+639\d{9})$/.test(value)) {
      return 'Use 09XXXXXXXXX or +639XXXXXXXXX for the contact number.'
    }
    return ''
  }

  const startChange = async (event) => {
    event.preventDefault()
    const validationError = validateValue()
    if (validationError) {
      setError(validationError)
      return
    }

    setBusyAction('start')
    setError('')
    setSuccess('')
    try {
      const nextChallenge = await startAccountContactChangeV3(activeChange, newValue.trim(), token)
      setChallenge(nextChallenge)
      setCode('')
      setCooldown(secondsUntil(nextChallenge?.resendAvailableAt))
      setSuccess(`A verification code was sent to ${nextChallenge?.destinationMasked || 'the new contact detail'}.`)
    } catch (requestError) {
      setError(getChangeError(requestError, 'Unable to start this change.'))
    } finally {
      setBusyAction('')
    }
  }

  const resendCode = async () => {
    if (!challenge?.challengeUuid || cooldown > 0) return
    setBusyAction('resend')
    setError('')
    setSuccess('')
    try {
      const nextChallenge = await resendAccountContactChangeV3(
        activeChange,
        newValue.trim(),
        challenge.challengeUuid,
        token,
      )
      setChallenge(nextChallenge)
      setCode('')
      setCooldown(secondsUntil(nextChallenge?.resendAvailableAt))
      setSuccess('A new verification code was sent.')
    } catch (requestError) {
      if (requestError.code === 'VERIFICATION_RESEND_COOLDOWN') {
        setCooldown(secondsUntil(requestError.errors?.resendAvailableAt))
      }
      setError(getChangeError(requestError, 'Unable to resend the verification code.'))
    } finally {
      setBusyAction('')
    }
  }

  const confirmChange = async (event) => {
    event.preventDefault()
    if (!/^\d{6}$/.test(code)) {
      setError('Enter the complete 6-digit code.')
      return
    }

    setBusyAction('confirm')
    setError('')
    setSuccess('')
    try {
      const updatedAccount = await confirmAccountContactChangeV3(
        activeChange,
        newValue.trim(),
        challenge.challengeUuid,
        code,
        token,
      )
      const changedLabel = activeChange === 'contact' ? 'Contact number' : 'Email address'
      setAccount(updatedAccount)
      setActiveChange(null)
      setNewValue('')
      setChallenge(null)
      setCode('')
      setCooldown(0)
      setSuccess(`${changedLabel} changed successfully.`)
      onAccountUpdated?.(updatedAccount)
    } catch (requestError) {
      const remaining = requestError.errors?.remainingAttempts
      const suffix = Number.isInteger(remaining)
        ? ` ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
        : ''
      setError(`${getChangeError(requestError, 'Unable to confirm this change.')}${suffix}`)
    } finally {
      setBusyAction('')
    }
  }

  const changeRows = [
    { kind: 'email', label: 'Email address', value: account?.email, nextAt: account?.nextEmailChangeAt, icon: Mail },
    { kind: 'contact', label: 'Contact number', value: account?.contactNumber, nextAt: account?.nextContactChangeAt, icon: Phone },
  ]

  return (
    <section className="content-card account-contact-change-panel" aria-labelledby="accountContactChangeTitle">
      <header><span className="account-profile-icon" aria-hidden="true"><AtSign size={20} /></span><div><p className="content-card-tag">Contact details</p><h2 id="accountContactChangeTitle">Change email or number</h2></div></header>
      {error ? <p className="form-message form-message-error" role="alert">{error}</p> : null}
      {success ? <p className="form-message form-message-success" role="status">{success}</p> : null}
      {isLoading ? <p className="supporting-text">Loading contact settings...</p> : null}

      {!isLoading && account ? <div className="account-contact-change-rows">{changeRows.map(({ kind, label, value, nextAt, icon: Icon }) => <div key={kind}><Icon size={18} aria-hidden="true" /><span><strong>{label}</strong><small>{value || 'Not provided'}</small>{nextAt ? <small>Next change: {formatNextAllowed(nextAt)}</small> : null}</span><button type="button" className="secondary-button" onClick={() => openChange(kind)} disabled={Boolean(activeChange) || Boolean(nextAt)}>Change</button></div>)}</div> : null}

      {activeChange ? (
        <div className="account-contact-change-workflow">
          {!challenge ? (
            <form onSubmit={startChange}>
              <label><span>{activeChange === 'contact' ? 'New contact number' : 'New email address'}</span><input type={activeChange === 'email' ? 'email' : 'tel'} value={newValue} onChange={(event) => { setNewValue(event.target.value); setError('') }} autoComplete={activeChange === 'email' ? 'email' : 'tel'} required /></label>
              <button type="button" className="secondary-button" onClick={cancelChange} disabled={Boolean(busyAction)}><X size={15} aria-hidden="true" />Cancel</button>
              <button type="submit" className="primary-button" disabled={Boolean(busyAction)}>{busyAction === 'start' ? 'Sending...' : 'Send code'}</button>
            </form>
          ) : (
            <form onSubmit={confirmChange}>
              <label><span>6-digit code</span><input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => { setCode(event.target.value.replace(/\D/g, '').slice(0, 6)); setError('') }} required /></label>
              <button type="button" className="secondary-button" onClick={cancelChange} disabled={Boolean(busyAction)}><X size={15} aria-hidden="true" />Cancel</button>
              <button type="button" className="secondary-button" onClick={resendCode} disabled={Boolean(busyAction) || cooldown > 0}><RefreshCw size={15} aria-hidden="true" />{cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend'}</button>
              <button type="submit" className="primary-button" disabled={Boolean(busyAction)}><Check size={15} aria-hidden="true" />{busyAction === 'confirm' ? 'Confirming...' : 'Confirm change'}</button>
            </form>
          )}
        </div>
      ) : null}
    </section>
  )
}

export default AccountContactChangePanel

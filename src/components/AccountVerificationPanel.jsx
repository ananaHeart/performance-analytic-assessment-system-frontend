import { useEffect, useState } from 'react'
import { CheckCircle2, MailCheck, MessageSquareText, RefreshCw, ShieldCheck } from 'lucide-react'
import {
  confirmAccountVerificationV3,
  getAccountV3,
  resendAccountVerificationV3,
  startAccountVerificationV3,
} from '../api/apiV3Client'

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

function AccountVerificationPanel({ token, onAccountUpdated }) {
  const [account, setAccount] = useState(null)
  const [challenge, setChallenge] = useState(null)
  const [code, setCode] = useState('')
  const [cooldown, setCooldown] = useState(0)
  const [expiry, setExpiry] = useState(null)
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
          setError(loadError.message || 'Unable to load verification status.')
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

  useEffect(() => {
    if (!challenge?.otpExpiresAt) return undefined
    const updateExpiry = () => setExpiry(secondsUntil(challenge.otpExpiresAt))
    updateExpiry()
    const timer = window.setInterval(updateExpiry, 1000)
    return () => window.clearInterval(timer)
  }, [challenge])

  const setNextChallenge = (nextChallenge) => {
    setChallenge(nextChallenge)
    setCode('')
    setCooldown(secondsUntil(nextChallenge?.resendAvailableAt))
    setExpiry(nextChallenge?.otpExpiresAt ? secondsUntil(nextChallenge.otpExpiresAt) : null)
  }

  const getErrorMessage = (requestError, fallback) => {
    const messages = {
      ALREADY_VERIFIED: 'This contact method is already verified.',
      INVALID_VERIFICATION_CODE: 'The code is incorrect. Check it and try again.',
      VERIFICATION_CODE_EXPIRED: 'The code expired. Request a new code.',
      VERIFICATION_CODE_REPLACED: 'A newer code was sent. Enter the latest code.',
      VERIFICATION_CHALLENGE_LOCKED: 'Too many incorrect attempts. Request a new code.',
      VERIFICATION_RESEND_COOLDOWN: 'Wait before requesting another code.',
      SMS_NOT_AVAILABLE: 'SMS verification is unavailable. Use email verification instead.',
    }
    return messages[requestError.code] || requestError.message || fallback
  }

  const startVerification = async (channel) => {
    setBusyAction(channel)
    setError('')
    setSuccess('')
    try {
      const nextChallenge = await startAccountVerificationV3(channel, token)
      setNextChallenge({ ...nextChallenge, channel })
      setSuccess(`A verification code was sent to ${nextChallenge.destinationMasked || `your ${channel}`}.`)
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Unable to send a verification code.'))
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
      const nextChallenge = await resendAccountVerificationV3(challenge.challengeUuid, token)
      setNextChallenge({ ...nextChallenge, channel: challenge.channel })
      setSuccess('A new verification code was sent.')
    } catch (requestError) {
      if (requestError.code === 'VERIFICATION_RESEND_COOLDOWN') {
        setCooldown(secondsUntil(requestError.errors?.resendAvailableAt))
      }
      setError(getErrorMessage(requestError, 'Unable to resend the verification code.'))
    } finally {
      setBusyAction('')
    }
  }

  const confirmCode = async (event) => {
    event.preventDefault()
    if (expiry === 0) {
      setError('This code has expired. Request a new code.')
      return
    }
    if (!/^\d{6}$/.test(code)) {
      setError('Enter the complete 6-digit code.')
      return
    }

    setBusyAction('confirm')
    setError('')
    setSuccess('')
    try {
      const updatedAccount = await confirmAccountVerificationV3(
        challenge.challengeUuid,
        code,
        token,
      )
      setAccount(updatedAccount)
      setChallenge(null)
      setCode('')
      setExpiry(null)
      setSuccess(`${challenge.channel === 'sms' ? 'Contact number' : 'Email'} verified successfully.`)
      onAccountUpdated?.(updatedAccount)
    } catch (requestError) {
      const remaining = requestError.errors?.remainingAttempts
      const remainingMessage = Number.isInteger(remaining) ? ` ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.` : ''
      setError(`${getErrorMessage(requestError, 'Unable to verify the code.')}${remainingMessage}`)
    } finally {
      setBusyAction('')
    }
  }

  return (
    <section className="content-card account-verification-panel" aria-labelledby="accountVerificationTitle">
      <header>
        <span className="account-profile-icon" aria-hidden="true"><ShieldCheck size={20} /></span>
        <div><p className="content-card-tag">Contact security</p><h2 id="accountVerificationTitle">Verification</h2></div>
      </header>

      {error ? <p className="form-message form-message-error" role="alert">{error}</p> : null}
      {success ? <p className="form-message form-message-success" role="status">{success}</p> : null}
      {isLoading ? <p className="supporting-text">Loading verification status...</p> : null}

      {!isLoading && account ? (
        <div className="account-verification-methods">
          <div><MailCheck size={18} aria-hidden="true" /><span><strong>Email</strong><small>{account.email || 'Not provided'}</small></span>{account.emailVerified ? <em><CheckCircle2 size={15} />Verified</em> : <button type="button" className="secondary-button" onClick={() => startVerification('email')} disabled={Boolean(busyAction)}>Verify</button>}</div>
          <div><MessageSquareText size={18} aria-hidden="true" /><span><strong>Contact number</strong><small>{account.contactNumber || 'Not provided'}</small></span>{account.contactVerified ? <em><CheckCircle2 size={15} />Verified</em> : <button type="button" className="secondary-button" onClick={() => startVerification('sms')} disabled={Boolean(busyAction) || !account.contactNumber}>Verify</button>}</div>
        </div>
      ) : null}

      {challenge ? (
        <form className="account-verification-code" onSubmit={confirmCode}>
          <label htmlFor="accountVerificationCode"><span>6-digit code</span><input id="accountVerificationCode" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => { setCode(event.target.value.replace(/\D/g, '').slice(0, 6)); setError('') }} /></label>
          {expiry !== null ? <p className={`teacher-verification-expiry${expiry === 0 ? ' is-expired' : ''}`} role={expiry === 0 ? 'alert' : 'status'}>{expiry === 0 ? 'This code has expired. Request a new code.' : `Code expires in ${formatCountdown(expiry)}`}</p> : null}
          <button type="submit" className="primary-button" disabled={Boolean(busyAction) || expiry === 0}>Confirm</button>
          <button type="button" className="secondary-button" onClick={resendCode} disabled={Boolean(busyAction) || cooldown > 0}><RefreshCw size={15} aria-hidden="true" />{cooldown > 0 ? `Resend in ${formatCountdown(cooldown)}` : 'Resend'}</button>
        </form>
      ) : null}
    </section>
  )
}

export default AccountVerificationPanel

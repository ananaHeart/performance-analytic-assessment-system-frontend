import { useCallback, useEffect, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Eye,
  EyeOff,
  KeyRound,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  ShieldOff,
  Smartphone,
} from 'lucide-react'
import {
  confirmMfaEnrollmentV3,
  disableMfaV3,
  getMfaStatusV3,
  regenerateMfaRecoveryCodesV3,
  startMfaEnrollmentV3,
} from '../api/apiV3Client'

const AUTHENTICATOR_METHOD = 'authenticator'
const RECOVERY_CODE_METHOD = 'recovery_code'

function formatDateTime(value) {
  if (!value) return 'Not yet used'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)

  return new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function formatMfaError(error, fallback) {
  const attemptsRemaining = error?.errors?.attemptsRemaining
  const suffix = Number.isInteger(attemptsRemaining)
    ? ` ${attemptsRemaining} attempt${attemptsRemaining === 1 ? '' : 's'} remaining.`
    : ''

  return `${error?.message || fallback}${suffix}`
}

function createRecoveryCodeDownload(codes) {
  const contents = [
    'SMART Assessment System - Authenticator Recovery Codes',
    '',
    'Store these codes securely. Each code can be used only once.',
    '',
    ...codes,
  ].join('\n')
  const blob = new Blob([contents], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = 'smart-authenticator-recovery-codes.txt'
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function PasswordField({ value, onChange, disabled }) {
  const [isVisible, setIsVisible] = useState(false)

  return (
    <label className="mfa-field">
      <span>Current password</span>
      <div className="mfa-password-field">
        <input
          type={isVisible ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete="current-password"
          disabled={disabled}
          required
        />
        <button
          type="button"
          onClick={() => setIsVisible((current) => !current)}
          disabled={disabled}
          aria-label={isVisible ? 'Hide current password' : 'Show current password'}
          title={isVisible ? 'Hide current password' : 'Show current password'}
        >
          {isVisible ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </div>
    </label>
  )
}

function MfaVerificationFields({
  password,
  onPasswordChange,
  method,
  onMethodChange,
  code,
  onCodeChange,
  disabled,
}) {
  const isAuthenticator = method === AUTHENTICATOR_METHOD

  return (
    <div className="mfa-sensitive-fields">
      <PasswordField value={password} onChange={onPasswordChange} disabled={disabled} />

      <fieldset className="mfa-method-fieldset" disabled={disabled}>
        <legend>Verification method</legend>
        <div className="mfa-method-options">
          <label className={isAuthenticator ? 'is-selected' : ''}>
            <input
              type="radio"
              name="mfaVerificationMethod"
              value={AUTHENTICATOR_METHOD}
              checked={isAuthenticator}
              onChange={() => onMethodChange(AUTHENTICATOR_METHOD)}
            />
            Authenticator code
          </label>
          <label className={!isAuthenticator ? 'is-selected' : ''}>
            <input
              type="radio"
              name="mfaVerificationMethod"
              value={RECOVERY_CODE_METHOD}
              checked={!isAuthenticator}
              onChange={() => onMethodChange(RECOVERY_CODE_METHOD)}
            />
            Recovery code
          </label>
        </div>
      </fieldset>

      <label className="mfa-field">
        <span>{isAuthenticator ? 'Six-digit authenticator code' : 'Recovery code'}</span>
        <input
          type="text"
          value={code}
          onChange={(event) => {
            const nextValue = isAuthenticator
              ? event.target.value.replace(/\D/g, '').slice(0, 6)
              : event.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 40)
            onCodeChange(nextValue)
          }}
          inputMode={isAuthenticator ? 'numeric' : 'text'}
          autoComplete="one-time-code"
          pattern={isAuthenticator ? '[0-9]{6}' : undefined}
          maxLength={isAuthenticator ? 6 : 40}
          placeholder={isAuthenticator ? '000000' : 'ABCD-2345-EFGH'}
          disabled={disabled}
          required
        />
      </label>
    </div>
  )
}

function RecoveryCodesView({ codes, onDone, onDownload }) {
  const [hasStoredCodes, setHasStoredCodes] = useState(false)

  const handleDownload = () => {
    createRecoveryCodeDownload(codes)
    setHasStoredCodes(true)
    onDownload?.()
  }

  return (
    <div className="mfa-recovery-view">
      <div className="mfa-flow-heading">
        <span className="mfa-flow-icon is-success" aria-hidden="true">
          <CheckCircle2 size={20} />
        </span>
        <div>
          <h4>Save your recovery codes</h4>
          <p>These codes are shown only once. Each code can replace an authenticator code once.</p>
        </div>
      </div>

      <ol className="mfa-recovery-code-list" aria-label="Authenticator recovery codes">
        {codes.map((recoveryCode) => (
          <li key={recoveryCode}>
            <code>{recoveryCode}</code>
          </li>
        ))}
      </ol>

      <div className="mfa-recovery-actions">
        <button type="button" className="secondary-button" onClick={handleDownload}>
          <Download size={16} aria-hidden="true" />
          Download codes
        </button>
        <label className="mfa-storage-confirmation">
          <input
            type="checkbox"
            checked={hasStoredCodes}
            onChange={(event) => setHasStoredCodes(event.target.checked)}
          />
          <span>I saved these recovery codes in a secure place.</span>
        </label>
        <button
          type="button"
          className="primary-button"
          onClick={onDone}
          disabled={!hasStoredCodes}
        >
          Done
        </button>
      </div>
    </div>
  )
}

function MfaSecurityPanel({ token }) {
  const [status, setStatus] = useState(null)
  const [view, setView] = useState('status')
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [password, setPassword] = useState('')
  const [factorName, setFactorName] = useState('My authenticator app')
  const [verificationMethod, setVerificationMethod] = useState(AUTHENTICATOR_METHOD)
  const [code, setCode] = useState('')
  const [enrollment, setEnrollment] = useState(null)
  const [recoveryCodes, setRecoveryCodes] = useState([])

  const loadStatus = useCallback(async () => {
    setIsLoading(true)
    setError('')

    try {
      const nextStatus = await getMfaStatusV3(token)
      setStatus(nextStatus)
    } catch (loadError) {
      setStatus(null)
      if (!loadError.isAuthenticationFailure) {
        setError(formatMfaError(loadError, 'Unable to load authenticator security status.'))
      }
    } finally {
      setIsLoading(false)
    }
  }, [token])

  useEffect(() => {
    // The status is external server state and must be refreshed when the session token changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadStatus()
  }, [loadStatus])

  const resetSensitiveState = () => {
    setPassword('')
    setCode('')
    setVerificationMethod(AUTHENTICATOR_METHOD)
    setError('')
  }

  const returnToStatus = async (message = '') => {
    resetSensitiveState()
    setEnrollment(null)
    setRecoveryCodes([])
    setView('status')
    setSuccess(message)
    await loadStatus()
  }

  const openView = (nextView) => {
    resetSensitiveState()
    setSuccess('')
    setView(nextView)
  }

  const handleStartEnrollment = async (event) => {
    event.preventDefault()

    if (!password || !factorName.trim()) {
      setError('Enter your current password and an authenticator name.')
      return
    }

    setIsSubmitting(true)
    setError('')

    try {
      const nextEnrollment = await startMfaEnrollmentV3(
        { password, factorName: factorName.trim() },
        token,
      )
      setEnrollment(nextEnrollment)
      setPassword('')
      setCode('')
      setView('confirm-enrollment')
    } catch (submitError) {
      setError(formatMfaError(submitError, 'Unable to start authenticator setup.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleConfirmEnrollment = async (event) => {
    event.preventDefault()

    if (!/^\d{6}$/.test(code)) {
      setError('Enter the six-digit code from your authenticator app.')
      return
    }

    setIsSubmitting(true)
    setError('')

    try {
      const confirmation = await confirmMfaEnrollmentV3(
        { factorUuid: enrollment.factorUuid, code },
        token,
      )
      setCode('')
      setRecoveryCodes(Array.isArray(confirmation?.recoveryCodes) ? confirmation.recoveryCodes : [])
      setView('recovery-codes')
    } catch (submitError) {
      setError(formatMfaError(submitError, 'Unable to confirm authenticator setup.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const validateSensitiveAction = () => {
    if (!password) {
      setError('Enter your current password.')
      return false
    }

    if (verificationMethod === AUTHENTICATOR_METHOD && !/^\d{6}$/.test(code)) {
      setError('Enter a six-digit authenticator code.')
      return false
    }

    if (verificationMethod === RECOVERY_CODE_METHOD && !code.trim()) {
      setError('Enter one unused recovery code.')
      return false
    }

    return true
  }

  const handleRegenerateCodes = async (event) => {
    event.preventDefault()
    if (!validateSensitiveAction()) return

    setIsSubmitting(true)
    setError('')

    try {
      const confirmation = await regenerateMfaRecoveryCodesV3(
        { password, code: code.trim(), verificationMethod },
        token,
      )
      setPassword('')
      setCode('')
      setRecoveryCodes(Array.isArray(confirmation?.recoveryCodes) ? confirmation.recoveryCodes : [])
      setView('recovery-codes')
    } catch (submitError) {
      setError(formatMfaError(submitError, 'Unable to regenerate recovery codes.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDisable = async (event) => {
    event.preventDefault()
    if (!validateSensitiveAction()) return

    setIsSubmitting(true)
    setError('')

    try {
      await disableMfaV3(
        { password, code: code.trim(), verificationMethod },
        token,
      )
      await returnToStatus('Authenticator security disabled successfully.')
    } catch (submitError) {
      setError(formatMfaError(submitError, 'Unable to disable authenticator security.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="content-card mfa-security-panel" aria-labelledby="mfaSecurityTitle">
      <header className="mfa-security-header">
        <span className="mfa-security-icon" aria-hidden="true">
          <ShieldCheck size={21} strokeWidth={2.2} />
        </span>
        <div>
          <p className="content-card-tag">Security</p>
          <h3 id="mfaSecurityTitle">Authenticator app</h3>
          <p>Use a time-based code as an optional second step when you log in.</p>
        </div>
        <button
          type="button"
          className="mfa-refresh-button"
          onClick={loadStatus}
          disabled={isLoading || isSubmitting}
          aria-label="Refresh authenticator status"
          title="Refresh authenticator status"
        >
          <RefreshCw size={17} aria-hidden="true" />
        </button>
      </header>

      {error ? (
        <p className="form-message form-message-error" role="alert">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="form-message form-message-success" role="status">
          {success}
        </p>
      ) : null}

      {isLoading && view === 'status' ? (
        <div className="mfa-loading-state" role="status">Loading authenticator status...</div>
      ) : null}

      {!isLoading && view === 'status' && status ? (
        <div className="mfa-status-view">
          <div className="mfa-status-summary">
            <div>
              <span>Status</span>
              <strong className={status.enabled ? 'is-enabled' : 'is-disabled'}>
                {status.enabled ? 'Enabled' : 'Not enabled'}
              </strong>
            </div>
            {status.enabled ? (
              <>
                <div>
                  <span>Authenticator</span>
                  <strong>{status.factorName || 'Authenticator app'}</strong>
                </div>
                <div>
                  <span>Last used</span>
                  <strong>{formatDateTime(status.lastUsedAt)}</strong>
                </div>
                <div>
                  <span>Recovery codes</span>
                  <strong>{status.unusedRecoveryCodeCount ?? 0} unused</strong>
                </div>
              </>
            ) : null}
          </div>

          {!status.available ? (
            <div className="mfa-unavailable-state">
              <AlertTriangle size={19} aria-hidden="true" />
              <div>
                <strong>Authenticator setup is unavailable.</strong>
                <p>The server security key is not configured. Contact the system administrator.</p>
              </div>
            </div>
          ) : status.enabled ? (
            <div className="mfa-status-actions">
              <button type="button" className="secondary-button" onClick={() => openView('regenerate')}>
                <RotateCcw size={16} aria-hidden="true" />
                Regenerate recovery codes
              </button>
              <button type="button" className="mfa-danger-button" onClick={() => openView('disable')}>
                <ShieldOff size={16} aria-hidden="true" />
                Disable authenticator
              </button>
            </div>
          ) : (
            <div className="mfa-setup-callout">
              <div>
                <strong>Add an authenticator app</strong>
                <p>Scan a QR code with Google Authenticator, Microsoft Authenticator, or a compatible app.</p>
              </div>
              <button type="button" className="primary-button" onClick={() => openView('enroll')}>
                <Smartphone size={16} aria-hidden="true" />
                Set up authenticator
              </button>
            </div>
          )}
        </div>
      ) : null}

      {view === 'enroll' ? (
        <form className="mfa-flow-form" onSubmit={handleStartEnrollment}>
          <div className="mfa-flow-heading">
            <span className="mfa-flow-icon" aria-hidden="true"><KeyRound size={20} /></span>
            <div>
              <h4>Confirm your account</h4>
              <p>Enter your current password before SMART creates the authenticator secret.</p>
            </div>
          </div>
          <div className="mfa-enrollment-fields">
            <PasswordField value={password} onChange={setPassword} disabled={isSubmitting} />
            <label className="mfa-field">
              <span>Authenticator name</span>
              <input
                value={factorName}
                onChange={(event) => setFactorName(event.target.value)}
                maxLength="80"
                disabled={isSubmitting}
                required
              />
            </label>
          </div>
          <div className="mfa-flow-actions">
            <button type="button" className="secondary-button" onClick={() => openView('status')} disabled={isSubmitting}>Cancel</button>
            <button type="submit" className="primary-button" disabled={isSubmitting}>
              {isSubmitting ? 'Starting setup...' : 'Continue'}
            </button>
          </div>
        </form>
      ) : null}

      {view === 'confirm-enrollment' && enrollment ? (
        <form className="mfa-flow-form" onSubmit={handleConfirmEnrollment}>
          <div className="mfa-flow-heading">
            <span className="mfa-flow-icon" aria-hidden="true"><Smartphone size={20} /></span>
            <div>
              <h4>Connect your authenticator app</h4>
              <p>Scan the QR code, then enter the current six-digit code to finish setup.</p>
            </div>
          </div>
          <div className="mfa-enrollment-setup">
            <img src={enrollment.qrCodeDataUrl} alt="Authenticator enrollment QR code" />
            <div>
              <span>Cannot scan the QR code?</span>
              <p>Enter this setup key manually in your authenticator app.</p>
              <code className="mfa-manual-key">{enrollment.manualEntryKey}</code>
              <label className="mfa-field">
                <span>Six-digit authenticator code</span>
                <input
                  type="text"
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength="6"
                  placeholder="000000"
                  disabled={isSubmitting}
                  required
                  autoFocus
                />
              </label>
            </div>
          </div>
          <div className="mfa-flow-actions">
            <button type="button" className="secondary-button" onClick={() => openView('status')} disabled={isSubmitting}>Close setup</button>
            <button type="submit" className="primary-button" disabled={isSubmitting || code.length !== 6}>
              {isSubmitting ? 'Verifying...' : 'Verify and enable'}
            </button>
          </div>
        </form>
      ) : null}

      {view === 'recovery-codes' && recoveryCodes.length ? (
        <RecoveryCodesView
          codes={recoveryCodes}
          onDone={() => returnToStatus('Authenticator security is enabled and recovery codes were saved.')}
        />
      ) : null}

      {view === 'regenerate' ? (
        <form className="mfa-flow-form" onSubmit={handleRegenerateCodes}>
          <div className="mfa-flow-heading">
            <span className="mfa-flow-icon" aria-hidden="true"><RotateCcw size={20} /></span>
            <div>
              <h4>Regenerate recovery codes</h4>
              <p>All current recovery codes will stop working after this action.</p>
            </div>
          </div>
          <MfaVerificationFields
            password={password}
            onPasswordChange={setPassword}
            method={verificationMethod}
            onMethodChange={(nextMethod) => { setVerificationMethod(nextMethod); setCode('') }}
            code={code}
            onCodeChange={setCode}
            disabled={isSubmitting}
          />
          <div className="mfa-flow-actions">
            <button type="button" className="secondary-button" onClick={() => openView('status')} disabled={isSubmitting}>Cancel</button>
            <button type="submit" className="primary-button" disabled={isSubmitting}>
              {isSubmitting ? 'Regenerating...' : 'Regenerate codes'}
            </button>
          </div>
        </form>
      ) : null}

      {view === 'disable' ? (
        <form className="mfa-flow-form" onSubmit={handleDisable}>
          <div className="mfa-flow-heading">
            <span className="mfa-flow-icon is-danger" aria-hidden="true"><ShieldOff size={20} /></span>
            <div>
              <h4>Disable authenticator security</h4>
              <p>This removes the authenticator factor and invalidates all recovery codes.</p>
            </div>
          </div>
          <MfaVerificationFields
            password={password}
            onPasswordChange={setPassword}
            method={verificationMethod}
            onMethodChange={(nextMethod) => { setVerificationMethod(nextMethod); setCode('') }}
            code={code}
            onCodeChange={setCode}
            disabled={isSubmitting}
          />
          <div className="mfa-flow-actions">
            <button type="button" className="secondary-button" onClick={() => openView('status')} disabled={isSubmitting}>Cancel</button>
            <button type="submit" className="mfa-danger-button" disabled={isSubmitting}>
              {isSubmitting ? 'Disabling...' : 'Disable authenticator'}
            </button>
          </div>
        </form>
      ) : null}
    </section>
  )
}

export default MfaSecurityPanel

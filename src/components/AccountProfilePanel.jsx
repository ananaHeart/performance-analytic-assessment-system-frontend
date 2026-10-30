import { useEffect, useState } from 'react'
import { Pencil, Save, UserRound, X } from 'lucide-react'
import {
  getAccountV3,
  getTeacherRegistrationReferenceDataV3,
  updateAccountProfileV3,
} from '../api/apiV3Client'

function createDraft(account = {}) {
  return {
    firstName: account.firstName ?? '',
    middleName: account.middleName ?? '',
    lastName: account.lastName ?? '',
    suffixId: account.suffixId ? String(account.suffixId) : '',
  }
}

function AccountProfilePanel({ token, onAccountUpdated }) {
  const [account, setAccount] = useState(null)
  const [suffixes, setSuffixes] = useState([])
  const [draft, setDraft] = useState(createDraft())
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    let active = true

    Promise.all([getAccountV3(token), getTeacherRegistrationReferenceDataV3()])
      .then(([nextAccount, references]) => {
        if (!active) return
        setAccount(nextAccount)
        setDraft(createDraft(nextAccount))
        setSuffixes(references.suffixes)
      })
      .catch((loadError) => {
        if (active && !loadError.isAuthenticationFailure) {
          setError(loadError.message || 'Unable to load account details.')
        }
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })

    return () => {
      active = false
    }
  }, [token])

  const changeField = (field, value) => {
    setDraft((current) => ({ ...current, [field]: value }))
    setError('')
    setSuccess('')
  }

  const cancelEdit = () => {
    setDraft(createDraft(account))
    setError('')
    setIsEditing(false)
  }

  const saveProfile = async (event) => {
    event.preventDefault()
    const firstName = draft.firstName.trim()
    const middleName = draft.middleName.trim()
    const lastName = draft.lastName.trim()

    if (!firstName || !lastName) {
      setError('First name and last name are required.')
      return
    }

    setIsSaving(true)
    setError('')
    setSuccess('')

    try {
      const updatedAccount = await updateAccountProfileV3(
        {
          firstName,
          middleName: middleName || null,
          lastName,
          suffixId: draft.suffixId ? Number(draft.suffixId) : null,
        },
        token,
      )
      setAccount(updatedAccount)
      setDraft(createDraft(updatedAccount))
      setIsEditing(false)
      setSuccess('Account profile updated successfully.')
      onAccountUpdated?.(updatedAccount)
    } catch (saveError) {
      setError(saveError.message || 'Unable to update the account profile.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="content-card account-profile-panel" aria-labelledby="accountProfileTitle">
      <header>
        <span className="account-profile-icon" aria-hidden="true">
          <UserRound size={20} strokeWidth={2.2} />
        </span>
        <div>
          <p className="content-card-tag">My account</p>
          <h2 id="accountProfileTitle">Personal details</h2>
        </div>
        {!isEditing ? (
          <button
            type="button"
            className="secondary-button account-profile-edit"
            onClick={() => setIsEditing(true)}
            disabled={isLoading || !account}
          >
            <Pencil size={15} aria-hidden="true" />
            Edit
          </button>
        ) : null}
      </header>

      {error ? <p className="form-message form-message-error" role="alert">{error}</p> : null}
      {success ? <p className="form-message form-message-success" role="status">{success}</p> : null}

      {isLoading ? <p className="supporting-text">Loading account details...</p> : null}

      {!isLoading && account && !isEditing ? (
        <dl className="account-profile-details">
          <div><dt>Name</dt><dd>{account.name || 'Not provided'}</dd></div>
          <div><dt>Email</dt><dd>{account.email || 'Not provided'}</dd></div>
          <div><dt>Contact number</dt><dd>{account.contactNumber || 'Not provided'}</dd></div>
        </dl>
      ) : null}

      {isEditing ? (
        <form className="account-profile-form" onSubmit={saveProfile}>
          <label><span>First name</span><input value={draft.firstName} onChange={(event) => changeField('firstName', event.target.value)} required /></label>
          <label><span>Middle name</span><input value={draft.middleName} onChange={(event) => changeField('middleName', event.target.value)} /></label>
          <label><span>Last name</span><input value={draft.lastName} onChange={(event) => changeField('lastName', event.target.value)} required /></label>
          <label><span>Suffix</span><select value={draft.suffixId} onChange={(event) => changeField('suffixId', event.target.value)}><option value="">None</option>{suffixes.map((suffix) => <option key={suffix.suffixId ?? suffix.id} value={suffix.suffixId ?? suffix.id}>{suffix.suffixName ?? suffix.name ?? suffix.label}</option>)}</select></label>
          <div className="account-profile-actions">
            <button type="button" className="secondary-button" onClick={cancelEdit} disabled={isSaving}><X size={15} aria-hidden="true" />Cancel</button>
            <button type="submit" className="primary-button" disabled={isSaving}><Save size={15} aria-hidden="true" />{isSaving ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      ) : null}
    </section>
  )
}

export default AccountProfilePanel

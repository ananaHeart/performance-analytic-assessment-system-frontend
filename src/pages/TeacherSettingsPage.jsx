import { useEffect, useMemo, useState } from 'react'
import { Archive, BookOpen, LogOut, ShieldCheck, UserRound } from 'lucide-react'
import ArchivedAssessmentsPanel from '../components/ArchivedAssessmentsPanel'
import AccountProfilePanel from '../components/AccountProfilePanel'
import AccountPasswordPanel from '../components/AccountPasswordPanel'
import AccountVerificationPanel from '../components/AccountVerificationPanel'
import AccountContactChangePanel from '../components/AccountContactChangePanel'
import MfaSecurityPanel from '../components/MfaSecurityPanel'
import {
  getTeacherRegistrationReferenceDataV3,
  getTeacherSubjectsV3,
  updateTeacherSubjectsV3,
} from '../api/apiV3Client'

function TeacherSettingsPage({ user, token, onLogout, onAccountUpdated }) {
  const [activeSettingsTab, setActiveSettingsTab] = useState('account')
  const [confirmingLogout, setConfirmingLogout] = useState(false)
  const [subjectOptions, setSubjectOptions] = useState([])
  const [additionalMajorSubjectIds, setAdditionalMajorSubjectIds] = useState([])
  const [taughtSubjectIds, setTaughtSubjectIds] = useState([])
  const [mainMajorId, setMainMajorId] = useState(user.majorId ?? null)
  const [subjectsLoading, setSubjectsLoading] = useState(true)
  const [subjectsSaving, setSubjectsSaving] = useState(false)
  const [subjectsError, setSubjectsError] = useState('')
  const [subjectsSuccess, setSubjectsSuccess] = useState('')
  const displayName =
    user.name || [user.firstName, user.middleName, user.lastName].filter(Boolean).join(' ')
  const initial = (displayName || user.email || 'T').slice(0, 1).toUpperCase()
  const additionalMajorOptions = useMemo(
    () => subjectOptions.filter((subject) => String(subject.majorId) !== String(mainMajorId)),
    [mainMajorId, subjectOptions],
  )

  useEffect(() => {
    let active = true
    Promise.all([getTeacherRegistrationReferenceDataV3(), getTeacherSubjectsV3(token)])
      .then(([references, subjects]) => {
        if (!active) return
        setSubjectOptions(references.subjects)
        const matchedMajor = references.majors.find(
          (major) => String(major.majorName ?? major.name) === String(user.majorName ?? ''),
        )
        setMainMajorId(user.majorId ?? matchedMajor?.majorId ?? matchedMajor?.id ?? null)
        setAdditionalMajorSubjectIds(subjects.additionalMajors.map((subject) => String(subject.subjectId)))
        setTaughtSubjectIds(subjects.subjectsTaughtBefore.map((subject) => String(subject.subjectId)))
      })
      .catch((error) => {
        if (active) setSubjectsError(error.message || 'Unable to load subject experience.')
      })
      .finally(() => {
        if (active) setSubjectsLoading(false)
      })
    return () => { active = false }
  }, [token, user.majorId, user.majorName])

  const toggleSubject = (setter, values, subjectId) => {
    const normalizedId = String(subjectId)
    setter(
      values.includes(normalizedId)
        ? values.filter((value) => value !== normalizedId)
        : values.length < 10
          ? [...values, normalizedId]
          : values,
    )
    setSubjectsError('')
    setSubjectsSuccess('')
  }

  const saveSubjects = async () => {
    setSubjectsSaving(true)
    setSubjectsError('')
    setSubjectsSuccess('')
    try {
      const result = await updateTeacherSubjectsV3({
        additionalMajorSubjectIds: additionalMajorSubjectIds.map(Number),
        taughtSubjectIds: taughtSubjectIds.map(Number),
      }, token)
      setAdditionalMajorSubjectIds(result.additionalMajors.map((subject) => String(subject.subjectId)))
      setTaughtSubjectIds(result.subjectsTaughtBefore.map((subject) => String(subject.subjectId)))
      setSubjectsSuccess('Subject experience updated successfully.')
    } catch (error) {
      setSubjectsError(error.message || 'Unable to update subject experience.')
    } finally {
      setSubjectsSaving(false)
    }
  }

  return (
    <div className="teacher-settings-page smart-ui">
      <nav className="settings-section-tabs" aria-label="Teacher settings sections" role="tablist">
        <button type="button" role="tab" aria-selected={activeSettingsTab === 'account'} className={activeSettingsTab === 'account' ? 'is-active' : ''} onClick={() => setActiveSettingsTab('account')}>
          <UserRound size={17} aria-hidden="true" />
          Account
        </button>
        <button type="button" role="tab" aria-selected={activeSettingsTab === 'security'} className={activeSettingsTab === 'security' ? 'is-active' : ''} onClick={() => setActiveSettingsTab('security')}>
          <ShieldCheck size={17} aria-hidden="true" />
          Security
        </button>
        <button type="button" role="tab" aria-selected={activeSettingsTab === 'teaching'} className={activeSettingsTab === 'teaching' ? 'is-active' : ''} onClick={() => setActiveSettingsTab('teaching')}>
          <BookOpen size={17} aria-hidden="true" />
          Teaching
        </button>
        <button type="button" role="tab" aria-selected={activeSettingsTab === 'archives'} className={activeSettingsTab === 'archives' ? 'is-active' : ''} onClick={() => setActiveSettingsTab('archives')}>
          <Archive size={17} aria-hidden="true" />
          Archives
        </button>
      </nav>

      <div className="teacher-account-layout" hidden={activeSettingsTab !== 'account'} role="tabpanel">
        <aside className="teacher-account-summary content-card" aria-label="Account summary">
          <span className="teacher-profile-avatar" aria-hidden="true">
            {initial}
          </span>
          <div>
            <p className="content-card-tag">Signed in</p>
            <h2>{displayName || 'Teacher'}</h2>
            <p>{user.email || 'Email is not available in session.'}</p>
            <span className="status-pill status-active">Teacher</span>
          </div>
          <button
            type="button"
            className="teacher-profile-logout-button"
            onClick={() => setConfirmingLogout(true)}
          >
            <LogOut size={16} strokeWidth={2.2} aria-hidden="true" />
            Logout
          </button>
        </aside>

        <div className="teacher-account-security">
          <AccountProfilePanel token={token} onAccountUpdated={onAccountUpdated} />
          <AccountContactChangePanel token={token} onAccountUpdated={onAccountUpdated} />
        </div>
      </div>

      <div className="settings-section-content" hidden={activeSettingsTab !== 'security'} role="tabpanel">
        <AccountPasswordPanel token={token} />
        <AccountVerificationPanel token={token} onAccountUpdated={onAccountUpdated} />
        <MfaSecurityPanel token={token} />
      </div>

      <div className="settings-section-content" hidden={activeSettingsTab !== 'teaching'} role="tabpanel">
        <section className="content-card teacher-subject-settings">
            <header>
              <div>
                <p className="content-card-tag">Teaching profile</p>
                <h2>Subject experience</h2>
              </div>
              <button type="button" onClick={saveSubjects} disabled={subjectsLoading || subjectsSaving}>
                {subjectsSaving ? 'Saving...' : 'Save'}
              </button>
            </header>

            {subjectsError ? <p className="form-message form-message-error" role="alert">{subjectsError}</p> : null}
            {subjectsSuccess ? <p className="form-message form-message-success" role="status">{subjectsSuccess}</p> : null}
            {subjectsLoading ? <p className="supporting-text">Loading subject experience...</p> : (
              <div className="teacher-subject-settings-groups">
                <fieldset className="teacher-subject-picker">
                  <legend>Additional majors <small>Up to 10</small></legend>
                  <div className="teacher-subject-options">
                    {additionalMajorOptions.map((subject) => {
                      const id = String(subject.subjectId)
                      return <label key={`settings-major-${id}`}><input type="checkbox" checked={additionalMajorSubjectIds.includes(id)} onChange={() => toggleSubject(setAdditionalMajorSubjectIds, additionalMajorSubjectIds, id)} disabled={!additionalMajorSubjectIds.includes(id) && additionalMajorSubjectIds.length >= 10} /><span>{subject.subjectName}</span></label>
                    })}
                  </div>
                </fieldset>
                <fieldset className="teacher-subject-picker">
                  <legend>Subjects taught before <small>Up to 10</small></legend>
                  <div className="teacher-subject-options">
                    {subjectOptions.map((subject) => {
                      const id = String(subject.subjectId)
                      return <label key={`settings-taught-${id}`}><input type="checkbox" checked={taughtSubjectIds.includes(id)} onChange={() => toggleSubject(setTaughtSubjectIds, taughtSubjectIds, id)} disabled={!taughtSubjectIds.includes(id) && taughtSubjectIds.length >= 10} /><span>{subject.subjectName}</span></label>
                    })}
                  </div>
                </fieldset>
              </div>
            )}
        </section>
      </div>

      <div className="settings-section-content" hidden={activeSettingsTab !== 'archives'} role="tabpanel">
        <ArchivedAssessmentsPanel token={token} />
      </div>

      {confirmingLogout ? (
        <div className="principal-teacher-modal-backdrop" role="presentation">
          <section
            className="principal-teacher-confirmation"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="teacherLogoutTitle"
          >
            <span className="principal-teacher-confirmation-icon is-reject" aria-hidden="true">
              <LogOut size={23} strokeWidth={2.4} />
            </span>
            <div>
              <h3 id="teacherLogoutTitle">Are you sure you want to log out?</h3>
            </div>
            <div className="principal-teacher-confirmation-actions">
              <button
                type="button"
                className="principal-teacher-cancel-button"
                onClick={() => setConfirmingLogout(false)}
              >
                No
              </button>
              <button type="button" className="principal-reject-button" onClick={onLogout}>
                Yes
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  )
}

export default TeacherSettingsPage

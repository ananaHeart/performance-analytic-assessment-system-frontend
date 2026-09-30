import { useState } from 'react'
import { LogOut } from 'lucide-react'
import ArchivedAssessmentsPanel from '../components/ArchivedAssessmentsPanel'
import MfaSecurityPanel from '../components/MfaSecurityPanel'

function TeacherSettingsPage({ user, token, onLogout }) {
  const [confirmingLogout, setConfirmingLogout] = useState(false)
  const displayName =
    user.name || [user.firstName, user.middleName, user.lastName].filter(Boolean).join(' ')
  const initial = (displayName || user.email || 'T').slice(0, 1).toUpperCase()

  return (
    <div className="teacher-settings-page smart-ui">
      <div className="teacher-account-layout">
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
          <MfaSecurityPanel token={token} />
          <ArchivedAssessmentsPanel token={token} />
        </div>
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

import { LogOut } from 'lucide-react'
import MfaSecurityPanel from '../components/MfaSecurityPanel'

function TeacherSettingsPage({ user, token, onLogout }) {
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
          <button type="button" className="teacher-profile-logout-button" onClick={onLogout}>
            <LogOut size={16} strokeWidth={2.2} aria-hidden="true" />
            Logout
          </button>
        </aside>

        <div className="teacher-account-security">
          <MfaSecurityPanel token={token} />
        </div>
      </div>
    </div>
  )
}

export default TeacherSettingsPage

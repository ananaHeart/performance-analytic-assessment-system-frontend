function TeacherSettingsPage({ user }) {
  const displayName =
    user.name || [user.firstName, user.middleName, user.lastName].filter(Boolean).join(' ')

  return (
    <div className="content-stack teacher-settings-page">
      <section className="teacher-page-hero">
        <div>
          <p className="section-tag">Settings</p>
          <h2>Teacher profile</h2>
          <p className="supporting-text">
            Review the account details already available from the current login session.
          </p>
        </div>
      </section>

      <section className="content-card teacher-profile-card">
        <div className="teacher-profile-avatar" aria-hidden="true">
          <span>{(displayName || user.email || 'T').slice(0, 1).toUpperCase()}</span>
        </div>
        <div>
          <p className="content-card-tag">Signed In</p>
          <h3>{displayName || 'Teacher'}</h3>
          <p className="supporting-text">{user.email || 'Email is not available in session.'}</p>
          <span className="status-pill status-active">Teacher</span>
        </div>
      </section>
    </div>
  )
}

export default TeacherSettingsPage

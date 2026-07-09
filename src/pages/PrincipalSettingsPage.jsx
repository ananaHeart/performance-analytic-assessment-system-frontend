function PrincipalSettingsPage({ user }) {
  const displayName =
    user.name || [user.firstName, user.middleName, user.lastName].filter(Boolean).join(' ')

  return (
    <div className="content-stack principal-settings-page">
      <section className="hero-panel">
        <p className="section-tag">Settings</p>
        <h2>Principal account</h2>
        <p className="supporting-text">
          Review the account details available from the current login session.
        </p>
      </section>

      <section className="content-card principal-settings-card">
        <div className="principal-settings-avatar" aria-hidden="true">
          {(displayName || user.email || 'P').slice(0, 1).toUpperCase()}
        </div>
        <div>
          <p className="content-card-tag">Signed In</p>
          <h3>{displayName || 'Principal'}</h3>
          <p>{user.email || 'No email available'}</p>
          <span className="status-pill status-active">Principal</span>
        </div>
      </section>
    </div>
  )
}

export default PrincipalSettingsPage

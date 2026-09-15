import {
  BarChart3,
  CalendarDays,
  ClipboardList,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Settings,
  UserRoundCheck,
  UsersRound,
} from 'lucide-react'
import NotificationCenter from './NotificationCenter'

const principalNavIcons = {
  'principal-dashboard': LayoutDashboard,
  'class-records': ClipboardList,
  students: UsersRound,
  'teacher-approval': UserRoundCheck,
  reports: BarChart3,
  'principal-settings': Settings,
}
function AppLayout({
  user,
  navItems,
  activePage,
  token,
  onNavigate,
  onLogout,
  schoolYearLabel = '',
  isTeacherWorkspaceLayout = false,
  children,
}) {
  const displayName =
    user.name || [user.firstName, user.middleName, user.lastName].filter(Boolean).join(' ')
  const teacherInitials =
    displayName
      ?.split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((namePart) => namePart[0])
      .join('')
      .toUpperCase() || 'T'
  const principalInitials =
    displayName
      ?.split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((namePart) => namePart[0])
      .join('')
      .toUpperCase() || 'P'

  return (
    <div
      className={`dashboard-shell ${isTeacherWorkspaceLayout ? 'is-teacher-workspace' : ''} ${
        activePage === 'teacher-dashboard' ? 'is-teacher-dashboard' : ''
      }`}
    >
      {!isTeacherWorkspaceLayout ? (
        <aside className="dashboard-sidebar principal-sidebar">
          <div className="principal-brand-block">
            <span className="principal-brand-icon" aria-hidden="true">
              <GraduationCap size={20} strokeWidth={2.3} />
            </span>
            <div>
              <strong>SMART</strong>
              <span>Assessment System</span>
            </div>
          </div>

          <nav className="sidebar-nav principal-sidebar-nav" aria-label="Main navigation">
            {navItems.map((item) => {
              const NavIcon = principalNavIcons[item.key] ?? LayoutDashboard

              return (
                <button
                  key={item.key}
                  type="button"
                  className={`sidebar-link principal-sidebar-link ${
                    activePage === item.key ? 'is-active' : ''
                  } ${item.disabled ? 'is-disabled' : ''}`}
                  onClick={() => onNavigate(item.key)}
                  disabled={item.disabled}
                  title={item.title}
                >
                  <NavIcon size={16} strokeWidth={2.2} aria-hidden="true" />
                  <span>{item.label}</span>
                </button>
              )
            })}
          </nav>

          <div className="principal-sidebar-footer">
            <div className="principal-sidebar-profile">
              <span className="principal-avatar" aria-hidden="true">
                {principalInitials}
              </span>
              <div>
                <strong>{displayName || user.email || 'Principal'}</strong>
                <span>Principal</span>
              </div>
            </div>
            <button type="button" className="principal-logout-button" onClick={onLogout}>
              <LogOut size={16} strokeWidth={2.2} aria-hidden="true" />
              <span>Log out</span>
            </button>
          </div>
        </aside>
      ) : null}

      {isTeacherWorkspaceLayout ? (
        <header className="teacher-workspace-topbar">
          <div className="teacher-workspace-brand">
            <span className="teacher-system-mark" aria-hidden="true">
              <GraduationCap size={17} strokeWidth={2.3} />
            </span>
            <button
              type="button"
              className="teacher-app-title teacher-app-home-link"
              onClick={() => onNavigate('teacher-dashboard')}
              aria-label="Go to home dashboard"
            >
              <strong>SMART</strong>
              <span>Assessment System</span>
            </button>
          </div>

          <nav className="teacher-workspace-nav" aria-label="Teacher navigation">
            {navItems.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`teacher-nav-link ${activePage === item.key ? 'is-active' : ''}`}
                onClick={() => onNavigate(item.key)}
                disabled={item.disabled}
                title={item.title}
                aria-current={activePage === item.key ? 'page' : undefined}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="teacher-workspace-profile">
            <NotificationCenter token={token} variant="teacher" />
            <button
              type="button"
              className={`teacher-topbar-avatar ${
                activePage === 'teacher-settings' ? 'is-active' : ''
              }`}
              onClick={() => onNavigate('teacher-settings')}
              aria-label="Open account"
              title="Open account"
            >
              {teacherInitials}
            </button>
          </div>
        </header>
      ) : null}

      <main className={`dashboard-main ${isTeacherWorkspaceLayout ? '' : 'principal-main'}`}>
        {!isTeacherWorkspaceLayout ? (
          <header className="principal-topbar">
            <NotificationCenter token={token} variant="principal" />
            {schoolYearLabel ? (
              <span className="principal-school-year">
                <CalendarDays size={17} strokeWidth={2.2} aria-hidden="true" />
                SY {schoolYearLabel}
              </span>
            ) : null}
          </header>
        ) : null}
        {children}
      </main>
    </div>
  )
}

export default AppLayout

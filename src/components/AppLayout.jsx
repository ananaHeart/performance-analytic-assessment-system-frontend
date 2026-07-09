import {
  BarChart3,
  Bell,
  CalendarDays,
  ClipboardList,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Settings,
  UsersRound,
} from 'lucide-react'

const principalNavIcons = {
  'principal-dashboard': LayoutDashboard,
  'class-records': ClipboardList,
  'teacher-approval': UsersRound,
  analytics: BarChart3,
  'principal-settings': Settings,
}
function AppLayout({
  user,
  navItems,
  activePage,
  onNavigate,
  onLogout,
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
                  }`}
                  onClick={() => onNavigate(item.key)}
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

      {isTeacherWorkspaceLayout && activePage === 'teacher-dashboard' ? (
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
              <strong>Performance Analytics</strong>
              <span>Assessment System</span>
            </button>
            <span className="teacher-app-divider" aria-hidden="true" />
            <p className="teacher-app-context">Dashboard</p>
          </div>

          <div className="teacher-workspace-profile">
            <span className="teacher-topbar-avatar" aria-hidden="true">
              {teacherInitials}
            </span>
            <button type="button" className="teacher-logout-button" onClick={onLogout}>
              Logout
            </button>
          </div>
        </header>
      ) : null}

      <main className={`dashboard-main ${isTeacherWorkspaceLayout ? '' : 'principal-main'}`}>
        {!isTeacherWorkspaceLayout ? (
          <header className="principal-topbar">
            <button type="button" className="principal-topbar-icon" aria-label="Notifications">
              <Bell size={16} strokeWidth={2.2} />
            </button>
            <span className="principal-school-year">
              <CalendarDays size={17} strokeWidth={2.2} aria-hidden="true" />
              SY 2025-2026
            </span>
          </header>
        ) : null}
        {children}
      </main>
    </div>
  )
}

export default AppLayout

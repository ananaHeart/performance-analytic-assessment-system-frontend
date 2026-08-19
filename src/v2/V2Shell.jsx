import { ClipboardCheck, ClipboardList, LogOut, UsersRound } from 'lucide-react'
import { getV2HomeRoute, navigateV2, V2_ROUTES } from './v2Routes'

function V2Shell({ user, route, onLogout, children }) {
  const role = String(user?.role ?? '').toLowerCase()
  const homeRoute = getV2HomeRoute(role)
  const navigationItems = role === 'principal'
    ? [{ label: 'Teachers', route: V2_ROUTES.teachers, icon: UsersRound }]
    : [{ label: 'Assessments', route: V2_ROUTES.assessments, icon: ClipboardList }]

  return (
    <div className="v2-app-shell">
      <header className="v2-app-header">
        <div className="v2-header-primary">
          <button
            type="button"
            className="v2-brand-button"
            onClick={() => navigateV2(homeRoute)}
          >
            <span className="v2-brand-mark" aria-hidden="true">
              <ClipboardCheck size={20} />
            </span>
            <span>
              <strong>SMART Assessment</strong>
              <small>{role === 'principal' ? 'School administration' : 'Assessment workspace'}</small>
            </span>
          </button>

          <nav className="v2-header-nav" aria-label="V2 workspace navigation">
            {navigationItems.map((item) => {
              const Icon = item.icon
              const isActive = route === item.route || route.startsWith(`${item.route}/`)

              return (
                <button
                  key={item.route}
                  type="button"
                  className={isActive ? 'is-active' : ''}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => navigateV2(item.route)}
                >
                  <Icon size={16} />
                  {item.label}
                </button>
              )
            })}
          </nav>
        </div>

        <div className="v2-header-account">
          <span className="v2-user-copy">
            <strong>{user?.name || user?.email || 'Teacher'}</strong>
            <small>{user?.role === 'principal' ? 'Principal' : 'Teacher'}</small>
          </span>
          <button type="button" className="v2-secondary-button" onClick={onLogout}>
            <LogOut size={16} />
            Log out
          </button>
        </div>
      </header>
      <main className="v2-main">{children}</main>
    </div>
  )
}

export default V2Shell

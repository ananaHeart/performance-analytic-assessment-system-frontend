import { useEffect, useState } from 'react'
import AppLayout from './components/AppLayout'
import ProtectedRoute from './components/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import TeacherSignUpPage from './pages/TeacherSignUpPage'
import PrincipalDashboard from './pages/PrincipalDashboard'
import TeacherApprovalPage from './pages/TeacherApprovalPage'
import ClassRecordsPage from './pages/ClassRecordsPage'
import TeacherClassAssignmentPage from './pages/TeacherClassAssignmentPage'
import TeacherDashboard from './pages/TeacherDashboard'
import AssessmentSetupPage from './pages/AssessmentSetupPage'
import AnalyticsPage from './pages/AnalyticsPage'
import ExportReportsPage from './pages/ExportReportsPage'
import PrincipalSettingsPage from './pages/PrincipalSettingsPage'
import TeacherSettingsPage from './pages/TeacherSettingsPage'

const USER_STORAGE_KEY = 'assessment-user'
const TOKEN_STORAGE_KEY = 'assessment-token'
const DEFAULT_PUBLIC_PAGE = 'login'
const DEFAULT_ROLE_PAGE = {
  principal: 'principal-dashboard',
  teacher: 'teacher-dashboard',
}

const NAV_ITEMS_BY_ROLE = {
  principal: [
    { key: 'principal-dashboard', label: 'Dashboard' },
    { key: 'class-records', label: 'Classes' },
    { key: 'teacher-approval', label: 'Teachers' },
    { key: 'analytics', label: 'Analytics' },
    { key: 'principal-settings', label: 'Settings' },
  ],
  teacher: [
    { key: 'teacher-dashboard', label: 'Dashboard' },
    { key: 'class-records', label: 'Class' },
    { key: 'analytics', label: 'Analytics' },
    { key: 'teacher-settings', label: 'Settings' },
  ],
}

const ALLOWED_PAGES_BY_ROLE = {
  principal: [...NAV_ITEMS_BY_ROLE.principal.map((item) => item.key), 'teacher-class-assignment'],
  teacher: [
    ...NAV_ITEMS_BY_ROLE.teacher.map((item) => item.key),
    'assessment-setup',
    'export-reports',
  ],
}

function readStoredAuth() {
  const storedUser = localStorage.getItem(USER_STORAGE_KEY)
  const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY)

  if (!storedUser || !storedToken) {
    return null
  }

  try {
    return {
      user: JSON.parse(storedUser),
      token: storedToken,
    }
  } catch {
    localStorage.removeItem(USER_STORAGE_KEY)
    localStorage.removeItem(TOKEN_STORAGE_KEY)
    return null
  }
}

function storeAuth(auth) {
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(auth.user))
  localStorage.setItem(TOKEN_STORAGE_KEY, auth.token)
}

function clearAuth() {
  localStorage.removeItem(USER_STORAGE_KEY)
  localStorage.removeItem(TOKEN_STORAGE_KEY)
}

function getHashPage() {
  const hashValue = window.location.hash.replace(/^#\/?/, '')
  return hashValue || DEFAULT_PUBLIC_PAGE
}

function setHashPage(page) {
  window.location.hash = page
}

function getDefaultPage(role) {
  return DEFAULT_ROLE_PAGE[role] ?? DEFAULT_PUBLIC_PAGE
}

function normalizePage(auth, page) {
  if (!auth?.user?.role) {
    return page === 'teacher-sign-up' ? page : DEFAULT_PUBLIC_PAGE
  }

  const allowedPages = ALLOWED_PAGES_BY_ROLE[auth.user.role] ?? []
  return allowedPages.includes(page) ? page : getDefaultPage(auth.user.role)
}

function renderProtectedPage(
  page,
  auth,
  onNavigate,
  teacherActiveClassId,
  teacherActiveAssessmentId,
) {
  const sharedProps = { user: auth.user, role: auth.user.role, token: auth.token, onNavigate }

  switch (page) {
    case 'principal-dashboard':
      return <PrincipalDashboard {...sharedProps} />
    case 'teacher-dashboard':
      return <TeacherDashboard {...sharedProps} />
    case 'teacher-approval':
      return <TeacherApprovalPage {...sharedProps} />
    case 'class-records':
      return <ClassRecordsPage {...sharedProps} initialClassId={teacherActiveClassId} />
    case 'teacher-class-assignment':
      return <TeacherClassAssignmentPage {...sharedProps} />
    case 'assessment-setup':
      return (
        <AssessmentSetupPage
          {...sharedProps}
          initialClassId={teacherActiveClassId}
          initialAssessmentId={teacherActiveAssessmentId}
        />
      )
    case 'analytics':
      return <AnalyticsPage {...sharedProps} />
    case 'export-reports':
      return <ExportReportsPage {...sharedProps} />
    case 'teacher-settings':
      return <TeacherSettingsPage {...sharedProps} />
    case 'principal-settings':
      return <PrincipalSettingsPage {...sharedProps} />
    default:
      return null
  }
}

function App() {
  const [auth, setAuth] = useState(() => readStoredAuth())
  const [teacherActiveClassId, setTeacherActiveClassId] = useState(null)
  const [teacherActiveAssessmentId, setTeacherActiveAssessmentId] = useState(null)
  const [currentPage, setCurrentPage] = useState(() =>
    normalizePage(readStoredAuth(), getHashPage()),
  )

  useEffect(() => {
    const handleStorageChange = () => {
      const nextAuth = readStoredAuth()
      setAuth(nextAuth)
      setCurrentPage((page) => normalizePage(nextAuth, page))
    }

    const handleHashChange = () => {
      setCurrentPage(normalizePage(readStoredAuth(), getHashPage()))
    }

    window.addEventListener('storage', handleStorageChange)
    window.addEventListener('hashchange', handleHashChange)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('hashchange', handleHashChange)
    }
  }, [])

  const handleLoginSuccess = (nextAuth) => {
    storeAuth(nextAuth)
    setAuth(nextAuth)
    const nextPage = getDefaultPage(nextAuth.user.role)
    setCurrentPage(nextPage)
    setHashPage(nextPage)
  }

  const handleLogout = () => {
    clearAuth()
    setAuth(null)
    setCurrentPage(DEFAULT_PUBLIC_PAGE)
    setHashPage(DEFAULT_PUBLIC_PAGE)
  }

  const handleNavigate = (page, options = {}) => {
    if (auth?.user?.role === 'teacher') {
      setTeacherActiveClassId(
        page === 'assessment-setup' || page === 'class-records' ? options.classId ?? null : null,
      )
      setTeacherActiveAssessmentId(
        page === 'assessment-setup' ? options.assessmentId ?? null : null,
      )
    }

    const nextPage = normalizePage(auth, page)
    setCurrentPage(nextPage)
    setHashPage(nextPage)
  }

  if (!auth?.user) {
    return currentPage === 'teacher-sign-up' ? (
      <TeacherSignUpPage onNavigate={handleNavigate} />
    ) : (
      <LoginPage onLoginSuccess={handleLoginSuccess} onNavigate={handleNavigate} />
    )
  }

  const navItems = NAV_ITEMS_BY_ROLE[auth.user.role] ?? []
  const protectedPage = renderProtectedPage(
    currentPage,
    auth,
    handleNavigate,
    teacherActiveClassId,
    teacherActiveAssessmentId,
  )
  const isTeacherWorkspaceLayout = auth.user.role === 'teacher'

  return (
    <ProtectedRoute
      user={auth.user}
      allowedRoles={['principal', 'teacher']}
      fallback={
        <section className="public-page">
          <div className="public-card">
            <div className="public-brand-panel">
              <div className="brand-mark large-mark" aria-hidden="true">
                <span>Logo</span>
              </div>
              <p className="section-tag">Account Access</p>
              <h1>Unsupported Role</h1>
              <p className="supporting-text">
                This account role is not yet configured for the web dashboard.
              </p>
              <button type="button" className="secondary-button" onClick={handleLogout}>
                Logout
              </button>
            </div>
          </div>
        </section>
      }
    >
      <AppLayout
        user={auth.user}
        navItems={navItems}
        activePage={currentPage}
        onNavigate={handleNavigate}
        onLogout={handleLogout}
        isTeacherWorkspaceLayout={isTeacherWorkspaceLayout}
      >
        {protectedPage}
      </AppLayout>
    </ProtectedRoute>
  )
}

export default App

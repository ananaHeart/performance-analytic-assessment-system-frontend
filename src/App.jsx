import { useEffect, useState } from 'react'
import AppLayout from './components/AppLayout'
import ProtectedRoute from './components/ProtectedRoute'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import TeacherSignUpPage from './pages/TeacherSignUpPage'
import PrincipalDashboard from './pages/PrincipalDashboard'
import ClassRecordsPage from './pages/ClassRecordsPage'
import TeacherClassAssignmentPage from './pages/TeacherClassAssignmentPage'
import TeacherDashboard from './pages/TeacherDashboard'
import AssessmentSetupPage from './pages/AssessmentSetupPage'
import AnalyticsPage from './pages/AnalyticsPage'
import ExportReportsPage from './pages/ExportReportsPage'
import PrincipalSettingsPage from './pages/PrincipalSettingsPage'
import TeacherSettingsPage from './pages/TeacherSettingsPage'
import TeacherApprovalPage from './pages/TeacherApprovalPage'
import {
  AUTH_EXPIRED_EVENT,
  getCurrentUserV2,
  logoutV2,
  normalizeAccessToken,
} from './api/apiV2Client'

const USER_STORAGE_KEY = 'assessment-user'
const TOKEN_STORAGE_KEY = 'assessment-token'
const AUTH_STORAGE_KEY = 'assessment-auth-session'
const TEACHER_WORKSPACE_CONTEXT_KEY = 'teacher-workspace-context'
const DEFAULT_PUBLIC_PAGE = 'home'
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
  const storedSession = localStorage.getItem(AUTH_STORAGE_KEY)

  if (storedSession) {
    try {
      const parsedSession = JSON.parse(storedSession)
      const normalizedToken = normalizeAccessToken(parsedSession?.token)

      if (parsedSession?.user && normalizedToken) {
        return { user: parsedSession.user, token: normalizedToken }
      }
    } catch {
      // Fall through to the legacy keys so existing sessions can still migrate.
    }

    localStorage.removeItem(AUTH_STORAGE_KEY)
  }

  const storedUser = localStorage.getItem(USER_STORAGE_KEY)
  const storedToken = normalizeAccessToken(localStorage.getItem(TOKEN_STORAGE_KEY))

  if (!storedUser || !storedToken) {
    return null
  }

  try {
    return storeAuth({
      user: JSON.parse(storedUser),
      token: storedToken,
    })
  } catch {
    localStorage.removeItem(USER_STORAGE_KEY)
    localStorage.removeItem(TOKEN_STORAGE_KEY)
    return null
  }
}

function storeAuth(auth) {
  const normalizedToken = normalizeAccessToken(auth?.token)

  if (!auth?.user || !normalizedToken) {
    clearAuth()
    return null
  }

  const normalizedAuth = { user: auth.user, token: normalizedToken }

  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(normalizedAuth))
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(auth.user))
  localStorage.setItem(TOKEN_STORAGE_KEY, normalizedToken)
  localStorage.removeItem('assessment-v2-token')
  localStorage.removeItem('assessment-v2-user')
  localStorage.removeItem('assessment-v2-expires-at')

  return normalizedAuth
}

function clearAuth() {
  localStorage.removeItem(AUTH_STORAGE_KEY)
  localStorage.removeItem(USER_STORAGE_KEY)
  localStorage.removeItem(TOKEN_STORAGE_KEY)
  localStorage.removeItem('assessment-v2-token')
  localStorage.removeItem('assessment-v2-user')
  localStorage.removeItem('assessment-v2-expires-at')
  sessionStorage.removeItem(TEACHER_WORKSPACE_CONTEXT_KEY)
}

function readTeacherWorkspaceContext() {
  const storedContext = sessionStorage.getItem(TEACHER_WORKSPACE_CONTEXT_KEY)

  if (!storedContext) {
    return {
      classId: null,
      assessmentId: null,
      classTab: 'assessment',
    }
  }

  try {
    const parsedContext = JSON.parse(storedContext)

    return {
      classId: parsedContext.classId ?? null,
      assessmentId: parsedContext.assessmentId ?? null,
      classTab:
        parsedContext.classTab === 'students' || parsedContext.classTab === 'analytics'
          ? parsedContext.classTab
          : 'assessment',
    }
  } catch {
    sessionStorage.removeItem(TEACHER_WORKSPACE_CONTEXT_KEY)
    return {
      classId: null,
      assessmentId: null,
      classTab: 'assessment',
    }
  }
}

function storeTeacherWorkspaceContext(context) {
  sessionStorage.setItem(
    TEACHER_WORKSPACE_CONTEXT_KEY,
    JSON.stringify({
      classId: context.classId ?? null,
      assessmentId: context.assessmentId ?? null,
      classTab: context.classTab ?? 'assessment',
    }),
  )
}

function getRequestedPage() {
  const hashValue = window.location.hash.replace(/^#\/?/, '')
  return hashValue || DEFAULT_PUBLIC_PAGE
}

function resolveLegacyRoute(page) {
  if (page === 'teacher-sign-up') {
    return 'register'
  }

  if (page === 'v2/login') {
    return 'login'
  }

  if (page.startsWith('v2/teachers')) {
    return 'teacher-approval'
  }

  if (page.startsWith('v2/assessments')) {
    return 'teacher-dashboard'
  }

  return page
}

function getHashPage() {
  return resolveLegacyRoute(getRequestedPage())
}

function setHashPage(page) {
  window.location.hash = page
}

function replaceHashPage(page) {
  window.history.replaceState(
    null,
    '',
    `${window.location.pathname}${window.location.search}#${page}`,
  )
}

function getDefaultPage(role) {
  return DEFAULT_ROLE_PAGE[role] ?? DEFAULT_PUBLIC_PAGE
}

function normalizePage(auth, page) {
  if (!auth?.user?.role) {
    return ['home', 'login', 'register'].includes(page) ? page : DEFAULT_PUBLIC_PAGE
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
  teacherActiveClassTab,
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
      return (
        <ClassRecordsPage
          {...sharedProps}
          initialClassId={teacherActiveClassId}
          initialTeacherTab={teacherActiveClassTab}
        />
      )
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
  const [initialAppState] = useState(() => {
    const storedAuth = readStoredAuth()

    return {
      auth: storedAuth,
      isAuthReady: !storedAuth,
      currentPage: normalizePage(storedAuth, getHashPage()),
    }
  })
  const [auth, setAuth] = useState(initialAppState.auth)
  const [isAuthReady, setIsAuthReady] = useState(initialAppState.isAuthReady)
  const [teacherActiveClassId, setTeacherActiveClassId] = useState(
    () => readTeacherWorkspaceContext().classId,
  )
  const [teacherActiveAssessmentId, setTeacherActiveAssessmentId] = useState(
    () => readTeacherWorkspaceContext().assessmentId,
  )
  const [teacherActiveClassTab, setTeacherActiveClassTab] = useState(
    () => readTeacherWorkspaceContext().classTab,
  )
  const [currentPage, setCurrentPage] = useState(initialAppState.currentPage)

  useEffect(() => {
    let isMounted = true

    const normalizeCurrentLocation = (nextAuth) => {
      const requestedPage = getRequestedPage()
      const nextPage = normalizePage(nextAuth, resolveLegacyRoute(requestedPage))

      if (requestedPage !== nextPage) {
        replaceHashPage(nextPage)
      }

      return nextPage
    }

    const endExpiredSession = (event) => {
      // React Strict Mode mounts, cleans up, and mounts effects again in
      // development. An async request from the cleaned-up effect must never
      // erase the session created by the active effect or a newer login.
      if (!isMounted) {
        return
      }

      const expiredToken = normalizeAccessToken(event?.detail?.token)
      const currentToken = normalizeAccessToken(readStoredAuth()?.token)

      if (expiredToken && expiredToken !== currentToken) {
        return
      }

      // A request that had no token may dispatch an auth event while another
      // request has already established a valid session. Keep that session.
      if (!expiredToken && currentToken) {
        return
      }

      clearAuth()

      setAuth(null)
      setCurrentPage('login')
      setIsAuthReady(true)
      replaceHashPage('login')
    }

    const validateStoredSession = async (storedAuth) => {
      const tokenBeingValidated = normalizeAccessToken(storedAuth?.token)

      if (!tokenBeingValidated) {
        if (isMounted) {
          setAuth(null)
          setCurrentPage(normalizeCurrentLocation(null))
          setIsAuthReady(true)
        }
        return
      }

      if (isMounted) {
        setIsAuthReady(false)
      }

      try {
        const currentUser = await getCurrentUserV2(tokenBeingValidated)
        const currentStoredToken = normalizeAccessToken(readStoredAuth()?.token)

        // A newer login may finish while this startup check is still in flight.
        // Never restore an older session over the newly issued token.
        if (!isMounted || currentStoredToken !== tokenBeingValidated) {
          return
        }

        const storedValidatedAuth = storeAuth({ token: tokenBeingValidated, user: currentUser })
        setAuth(storedValidatedAuth)
        setCurrentPage(normalizeCurrentLocation(storedValidatedAuth))
        setIsAuthReady(true)
      } catch {
        const currentStoredToken = normalizeAccessToken(readStoredAuth()?.token)

        if (!isMounted || currentStoredToken !== tokenBeingValidated) {
          return
        }

        // Scope cleanup to the session that failed validation. This prevents a
        // stale startup request from deleting a newer successful login.
        endExpiredSession({ detail: { token: tokenBeingValidated } })
      }
    }

    window.addEventListener(AUTH_EXPIRED_EVENT, endExpiredSession)
    validateStoredSession(readStoredAuth())

    const handleStorageChange = () => {
      const nextAuth = readStoredAuth()
      validateStoredSession(nextAuth)
    }

    const handleHashChange = () => {
      setCurrentPage(normalizeCurrentLocation(readStoredAuth()))
    }

    window.addEventListener('storage', handleStorageChange)
    window.addEventListener('hashchange', handleHashChange)

    return () => {
      isMounted = false
      window.removeEventListener(AUTH_EXPIRED_EVENT, endExpiredSession)
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('hashchange', handleHashChange)
    }
  }, [])

  const handleLoginSuccess = (nextAuth) => {
    const storedAuth = storeAuth(nextAuth)

    if (!storedAuth) {
      setAuth(null)
      setIsAuthReady(true)
      setCurrentPage('login')
      replaceHashPage('login')
      return
    }

    setAuth(storedAuth)
    setIsAuthReady(true)
    const nextPage = getDefaultPage(storedAuth.user.role)
    setCurrentPage(nextPage)
    setHashPage(nextPage)
  }

  const handleLogout = async () => {
    try {
      if (auth?.token) {
        await logoutV2(auth.token)
      }
    } catch {
      // Local session cleanup must still complete if the server is unavailable.
    } finally {
      clearAuth()
      setAuth(null)
      setIsAuthReady(true)
      setCurrentPage(DEFAULT_PUBLIC_PAGE)
      setHashPage(DEFAULT_PUBLIC_PAGE)
    }
  }

  const handleNavigate = (page, options = {}) => {
    if (auth?.user?.role === 'teacher') {
      const nextClassId =
        page === 'assessment-setup' || page === 'class-records'
          ? options.classId ?? teacherActiveClassId
          : null
      const nextAssessmentId = page === 'assessment-setup' ? options.assessmentId ?? null : null
      const nextClassTab =
        page === 'class-records' ? options.initialTab ?? teacherActiveClassTab : 'assessment'

      setTeacherActiveClassId(nextClassId)
      setTeacherActiveAssessmentId(nextAssessmentId)
      setTeacherActiveClassTab(nextClassTab)
      storeTeacherWorkspaceContext({
        classId: nextClassId,
        assessmentId: nextAssessmentId,
        classTab: nextClassTab,
      })
    }

    const nextPage = normalizePage(auth, page)
    setCurrentPage(nextPage)
    setHashPage(nextPage)
  }

  if (!isAuthReady) {
    return (
      <main className="session-check-page" aria-busy="true">
        <div className="session-check-panel" role="status" aria-live="polite">
          <span className="session-check-spinner" aria-hidden="true" />
          <p>Checking your session...</p>
        </div>
      </main>
    )
  }

  if (!auth?.user) {
    if (currentPage === 'login') {
      return <LoginPage onLoginSuccess={handleLoginSuccess} onNavigate={handleNavigate} />
    }

    if (currentPage === 'register') {
      return <TeacherSignUpPage onNavigate={handleNavigate} />
    }

    return <LandingPage onNavigate={handleNavigate} />
  }

  const navItems = NAV_ITEMS_BY_ROLE[auth.user.role] ?? []
  const protectedPage = renderProtectedPage(
    currentPage,
    auth,
    handleNavigate,
    teacherActiveClassId,
    teacherActiveAssessmentId,
    teacherActiveClassTab,
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

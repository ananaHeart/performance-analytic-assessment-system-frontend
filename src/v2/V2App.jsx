import { useEffect, useState } from 'react'
import { getCurrentUserV2, logoutV2 } from '../api/apiV2Client'
import V2AssessmentEditorPage from './V2AssessmentEditorPage'
import V2AssessmentListPage from './V2AssessmentListPage'
import V2LoginPage from './V2LoginPage'
import V2OmrPrintPage from './V2OmrPrintPage'
import V2Shell from './V2Shell'
import V2TeacherAccountsPage from './V2TeacherAccountsPage'
import V2TeacherCreatePage from './V2TeacherCreatePage'
import {
  getV2HomeRoute,
  getV2RouteParams,
  navigateV2,
  V2_ROUTES,
} from './v2Routes'
import { clearV2Session, readV2Session, storeV2Session } from './v2Session'

function RouteMessage({ title, description, actionLabel, actionRoute }) {
  return (
    <section className="smart-ui mx-auto max-w-xl rounded-lg border border-border bg-background p-8 text-center shadow-sm">
      <h1 className="m-0 text-xl font-semibold text-foreground">{title}</h1>
      <p className="mb-6 mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
      <button
        type="button"
        className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary-hover"
        onClick={() => navigateV2(actionRoute)}
      >
        {actionLabel}
      </button>
    </section>
  )
}

function V2App({ route }) {
  const [session, setSession] = useState(() => readV2Session())
  const [checkingSession, setCheckingSession] = useState(Boolean(readV2Session()))

  useEffect(() => {
    let active = true
    const storedSession = readV2Session()

    if (!storedSession?.token) {
      return undefined
    }

    getCurrentUserV2(storedSession.token)
      .then((user) => {
        if (!active) return
        const verifiedSession = { ...storedSession, user }
        storeV2Session(verifiedSession)
        setSession(verifiedSession)
      })
      .catch(() => {
        if (!active) return
        clearV2Session()
        setSession(null)
      })
      .finally(() => {
        if (active) setCheckingSession(false)
      })

    return () => { active = false }
  }, [])

  const handleLogin = (nextSession) => {
    storeV2Session(nextSession)
    setSession(nextSession)
    navigateV2(getV2HomeRoute(nextSession.user?.role))
  }

  const handleLogout = async () => {
    try {
      if (session?.token) await logoutV2(session.token)
    } finally {
      clearV2Session()
      setSession(null)
      navigateV2(V2_ROUTES.login)
    }
  }

  if (checkingSession) {
    return <main className="v2-login-page"><section className="v2-loading-panel">Checking your session...</section></main>
  }

  if (!session?.token) {
    return <V2LoginPage onLogin={handleLogin} />
  }

  const page = getV2RouteParams(route)
  const role = String(session.user?.role ?? '').toLowerCase()
  const homeRoute = getV2HomeRoute(role)
  let content

  if (page.name === 'teachers' && role === 'principal') {
    content = <V2TeacherAccountsPage token={session.token} />
  } else if (page.name === 'new-teacher' && role === 'principal') {
    content = <V2TeacherCreatePage token={session.token} />
  } else if (page.name === 'new' && role === 'teacher') {
    content = <V2AssessmentEditorPage token={session.token} />
  } else if (page.name === 'edit' && role === 'teacher') {
    content = <V2AssessmentEditorPage token={session.token} testId={page.testId} />
  } else if (page.name === 'print' && role === 'teacher') {
    content = <V2OmrPrintPage token={session.token} testId={page.testId} />
  } else if (page.name === 'list' && role === 'teacher') {
    content = <V2AssessmentListPage token={session.token} />
  } else if (page.name === 'login') {
    content = role === 'principal'
      ? <V2TeacherAccountsPage token={session.token} />
      : <V2AssessmentListPage token={session.token} />
  } else if (
    (role === 'principal' && ['list', 'new', 'edit', 'print'].includes(page.name)) ||
    (role === 'teacher' && ['teachers', 'new-teacher'].includes(page.name))
  ) {
    content = (
      <RouteMessage
        title="Access restricted"
        description="This page is not available for your account role. Return to your authorized workspace."
        actionLabel="Return to workspace"
        actionRoute={homeRoute}
      />
    )
  } else {
    content = (
      <RouteMessage
        title="Page not found"
        description="This page is not available in the Marka workspace."
        actionLabel="Return to workspace"
        actionRoute={homeRoute}
      />
    )
  }

  return <V2Shell user={session.user} route={route} onLogout={handleLogout}>{content}</V2Shell>
}

export default V2App

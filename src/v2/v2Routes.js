export const V2_ROUTES = {
  login: 'v2/login',
  teachers: 'v2/teachers',
  newTeacher: 'v2/teachers/new',
  assessments: 'v2/assessments',
  newAssessment: 'v2/assessments/new',
}

export function getV2HomeRoute(role) {
  return String(role).toLowerCase() === 'principal'
    ? V2_ROUTES.teachers
    : V2_ROUTES.assessments
}

export function navigateV2(route) {
  window.location.hash = `/${route.replace(/^\/?/, '')}`
}

export function getV2RouteParams(route) {
  if (route === V2_ROUTES.newTeacher) {
    return { name: 'new-teacher', testId: null }
  }

  if (route === V2_ROUTES.teachers) {
    return { name: 'teachers', testId: null }
  }

  const editMatch = route.match(/^v2\/assessments\/(\d+)\/edit$/)
  if (editMatch) {
    return { name: 'edit', testId: Number(editMatch[1]) }
  }

  const printMatch = route.match(/^v2\/assessments\/(\d+)\/print-omr$/)
  if (printMatch) {
    return { name: 'print', testId: Number(printMatch[1]) }
  }

  if (route === V2_ROUTES.newAssessment) {
    return { name: 'new', testId: null }
  }

  if (route === V2_ROUTES.assessments) {
    return { name: 'list', testId: null }
  }

  if (route === V2_ROUTES.login) {
    return { name: 'login', testId: null }
  }

  return { name: 'unknown', testId: null }
}

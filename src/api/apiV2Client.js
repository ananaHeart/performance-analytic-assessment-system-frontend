const API_BASE_URL = (
  import.meta.env.VITE_V2_API_URL ||
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  ''
).replace(/\/$/, '')

export const AUTH_EXPIRED_EVENT = 'smart:auth-expired'
const PUBLIC_AUTH_PATHS = new Set([
  '/api/v2/auth/login',
  '/api/v2/auth/teacher-registration/reference-data',
  '/api/v2/auth/register-teacher',
  '/api/v2/auth/verify-teacher-email',
  '/api/v2/auth/resend-teacher-verification',
])
const AUTH_STORAGE_KEY = 'assessment-auth-session'
const LEGACY_TOKEN_STORAGE_KEY = 'assessment-token'

export function normalizeAccessToken(value) {
  if (typeof value !== 'string') {
    return ''
  }

  let normalizedToken = value.trim()

  if (
    (normalizedToken.startsWith('"') && normalizedToken.endsWith('"')) ||
    (normalizedToken.startsWith("'") && normalizedToken.endsWith("'"))
  ) {
    normalizedToken = normalizedToken.slice(1, -1).trim()
  }

  normalizedToken = normalizedToken.replace(/^Bearer\s+/i, '').trim()

  if (!normalizedToken || ['null', 'undefined'].includes(normalizedToken.toLowerCase())) {
    return ''
  }

  return normalizedToken
}

function readStoredAccessToken() {
  if (typeof window === 'undefined') {
    return ''
  }

  try {
    const storedSession = window.localStorage.getItem(AUTH_STORAGE_KEY)

    if (storedSession) {
      const parsedSession = JSON.parse(storedSession)
      const sessionToken = normalizeAccessToken(parsedSession?.token)

      if (sessionToken) {
        return sessionToken
      }
    }
  } catch {
    window.localStorage.removeItem(AUTH_STORAGE_KEY)
  }

  return normalizeAccessToken(window.localStorage.getItem(LEGACY_TOKEN_STORAGE_KEY))
}

function pickValue(record, keys) {
  for (const key of keys) {
    const value = record?.[key]

    if (value !== undefined && value !== null && value !== '') {
      return value
    }
  }

  return null
}

function resolveAcademicYearName(assignment = {}, academicYearId = null) {
  const rawName =
    pickValue(assignment, [
      'academicYearName',
      'year_name',
      'yearName',
      'schoolYear',
      'schoolYearName',
      'academicYearLabel',
      'academicYear',
      'label',
      'displayName',
      'name',
    ]) || ''
  const label = String(rawName).replace(
    new RegExp(`\\b${String(academicYearId).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g'),
    '',
  )
    .replace(/\s+/g, ' ')
    .trim()

  if (label) {
    return label
  }

  if (academicYearId === null || academicYearId === undefined || academicYearId === '') {
    return 'Academic Year'
  }

  return `Academic Year`
}

function dispatchAuthenticationFailure(rejectedToken) {
  if (typeof window === 'undefined') {
    return
  }

  window.dispatchEvent(
    new CustomEvent(AUTH_EXPIRED_EVENT, {
      detail: { token: normalizeAccessToken(rejectedToken) },
    }),
  )
}

function extractMessage(payload) {
  if (typeof payload?.message === 'string' && payload.message.trim()) {
    return payload.message
  }

  const fieldErrors = payload?.errors

  if (fieldErrors && typeof fieldErrors === 'object' && !Array.isArray(fieldErrors)) {
    const messages = Object.entries(fieldErrors)
      .filter(([key]) => key !== 'code')
      .map(([, value]) => value)
      .filter((value) => typeof value === 'string' && value.trim())

    if (messages.length) {
      return messages.join(' ')
    }
  }

  return (
    payload?.error ||
    payload?.errors?.message ||
    payload?.errors?.code ||
    'Request failed.'
  )
}

function extractErrorCode(payload) {
  const errorCode = payload?.errors?.code ?? payload?.code ?? ''
  return typeof errorCode === 'string' ? errorCode.trim() : ''
}

function isAuthenticationFailure(status, message, code) {
  const normalizedMessage = String(message ?? '').trim().toLowerCase()
  const normalizedCode = String(code ?? '').trim().toUpperCase()

  return (
    status === 401 ||
    [
      'AUTHENTICATION_REQUIRED',
      'INVALID_ACCESS_TOKEN',
      'INVALID_TOKEN',
      'TOKEN_EXPIRED',
      'SESSION_EXPIRED',
      'UNAUTHORIZED',
    ].includes(normalizedCode) ||
    normalizedMessage.includes('authentication is required') ||
    normalizedMessage.includes('invalid access token') ||
    normalizedMessage.includes('access token has expired') ||
    normalizedMessage.includes('session has expired')
  )
}

function extractData(payload) {
  return payload?.data ?? payload ?? null
}

function buildQuery(params = {}) {
  const searchParams = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.set(key, String(value))
    }
  })

  const query = searchParams.toString()
  return query ? `?${query}` : ''
}

async function requestV2(
  path,
  {
    token = '',
    headers = {},
    expectedStatus = null,
    responseType = 'auto',
    ...options
  } = {},
) {
  const requestHeaders = new Headers(headers)
  const explicitToken = normalizeAccessToken(token)
  const storedToken = readStoredAccessToken()
  const requestToken = PUBLIC_AUTH_PATHS.has(path)
    ? explicitToken
    : explicitToken || storedToken

  if (!PUBLIC_AUTH_PATHS.has(path) && !requestToken) {
    const requestError = new Error('Your session is unavailable. Please sign in again.')
    requestError.status = 401
    requestError.code = 'AUTHENTICATION_REQUIRED'
    requestError.isAuthenticationFailure = true
    dispatchAuthenticationFailure(requestToken)
    throw requestError
  }

  if (requestToken) {
    requestHeaders.set('Authorization', `Bearer ${requestToken}`)
  }

  if (options.body && !(options.body instanceof FormData) && !requestHeaders.has('Content-Type')) {
    requestHeaders.set('Content-Type', 'application/json')
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: requestHeaders,
  })
  const contentType = response.headers.get('content-type') ?? ''
  const payload =
    !response.ok && contentType.includes('application/json')
      ? await response.json().catch(() => null)
      : responseType === 'blob'
        ? await response.blob()
        : contentType.includes('application/json')
          ? await response.json().catch(() => null)
          : await response.text().catch(() => '')

  if (!response.ok) {
    const errorMessage = extractMessage(payload)
    const errorCode = extractErrorCode(payload)
    const authenticationFailure = isAuthenticationFailure(
      response.status,
      errorMessage,
      errorCode,
    )
    const requestError = new Error(errorMessage)
    requestError.status = response.status
    requestError.code = errorCode
    requestError.errors = payload?.errors ?? null
    requestError.data = payload?.data ?? null
    requestError.isAuthenticationFailure = authenticationFailure

    if (authenticationFailure && !PUBLIC_AUTH_PATHS.has(path)) {
      dispatchAuthenticationFailure(requestToken)
    }

    throw requestError
  }

  if (expectedStatus !== null && response.status !== expectedStatus) {
    const requestError = new Error(`Expected HTTP ${expectedStatus} but received ${response.status}.`)
    requestError.status = response.status
    requestError.code = 'UNEXPECTED_RESPONSE_STATUS'
    requestError.errors = null
    requestError.data = payload?.data ?? null
    requestError.isAuthenticationFailure = false
    throw requestError
  }

  return payload
}

function normalizeV2User(user = {}) {
  const firstName = user.firstName ?? ''
  const middleName = user.middleName ?? ''
  const lastName = user.lastName ?? ''

  return {
    id: user.userId ?? user.id ?? null,
    userId: user.userId ?? user.id ?? null,
    schoolId: user.schoolId ?? '',
    firstName,
    middleName,
    lastName,
    suffix: user.suffix ?? '',
    name: [firstName, middleName, lastName, user.suffix].filter(Boolean).join(' '),
    email: user.email ?? '',
    contactNumber: user.contactNumber ?? '',
    birthDate: user.birthDate ?? user.dateBirth ?? '',
    teachingStartDate: user.teachingStartDate ?? '',
    genderId: user.genderId ?? null,
    genderName: user.genderName ?? '',
    majorId: user.majorId ?? null,
    majorName: user.majorName ?? '',
    educationalAttainmentId: user.educationalAttainmentId ?? null,
    educationalAttainmentName: user.educationalAttainmentName ?? '',
    address: user.address ?? null,
    role: String(user.role ?? '').toLowerCase(),
    status: String(user.status ?? '').toLowerCase(),
    createdAt: user.createdAt ?? '',
    updatedAt: user.updatedAt ?? '',
  }
}

function normalizeV2ClassAssignment(assignment = {}) {
  const academicYearId =
    assignment.academicYearId ??
    assignment.yearId ??
    assignment.year_id ??
    assignment.academic_year_id ??
    null

  return {
    id: assignment.classAssignmentId ?? null,
    classAssignmentId: assignment.classAssignmentId ?? null,
    classId: assignment.classId ?? null,
    academicYearId,
    academicYear: resolveAcademicYearName(assignment, academicYearId),
    gradeLevelId: assignment.gradeLevelId ?? null,
    gradeLevelName: assignment.gradeLevelName ?? '',
    sectionId: assignment.sectionId ?? null,
    sectionName: assignment.sectionName ?? '',
    teacherId: assignment.teacherUserId ?? null,
    teacherName: assignment.teacherName ?? '',
    subjectId: assignment.subjectId ?? null,
    subjectName: assignment.subjectName ?? '',
    assignmentRole: assignment.assignmentRole ?? '',
    status: assignment.status ?? '',
    assignedAt: assignment.assignedAt ?? '',
  }
}

function normalizeV2Assessment(assessment = {}) {
  return {
    ...assessment,
    id: assessment.testId ?? null,
    classAssignmentId: assessment.classAssignmentId ?? null,
    classId: assessment.classId ?? null,
    testStatus: assessment.status ?? '',
    parts: Array.isArray(assessment.parts)
      ? assessment.parts.map((part) => ({
          ...part,
          id: part.testPartId ?? null,
          label: part.partName ?? '',
          type: part.partType ?? '',
        }))
      : [],
  }
}

function normalizeV2LmsRecord(record = {}) {
  return {
    ...record,
    id: record.skillId ?? record.competencyId ?? null,
    averageScore: record.masteryRate ?? null,
    masteryLevel: record.status ?? '',
  }
}

function normalizeV2TestPartResult(record = {}) {
  return {
    ...record,
    id: record.studentId ?? null,
    name: record.studentName ?? '',
    score: record.partScore ?? 0,
    performanceStatus: record.performance ?? '',
  }
}

function normalizeV2SyncActivity(record = {}) {
  const successfulResults = Number(record.successfulResults ?? 0)
  const failedResults = Number(record.failedResults ?? 0)
  const skippedResults = Number(record.skippedResults ?? 0)
  const status = String(record.syncStatus ?? '').replaceAll('_', ' ')
  const className = [record.gradeLevelName, record.sectionName].filter(Boolean).join(' - ')
  const details = [record.testName, className, record.subjectName, status]
    .filter(Boolean)
    .join(' | ')

  return {
    ...record,
    id: record.syncId ?? null,
    timestamp: record.lastSyncedAt ?? record.completedAt ?? record.startedAt ?? '',
    activity: `${successfulResults} result${successfulResults === 1 ? '' : 's'} synced`,
    details:
      details ||
      `${failedResults} failed${skippedResults ? ` | ${skippedResults} skipped` : ''}`,
  }
}

function normalizeV2Student(student = {}) {
  const firstName = student.firstName ?? ''
  const middleName = student.middleName ?? ''
  const lastName = student.lastName ?? ''

  return {
    id: student.studentId ?? null,
    studentId: student.studentId ?? null,
    classListId: student.classListId ?? null,
    classId: student.classId ?? null,
    studentLrn: student.studentLrn ?? '',
    firstName,
    middleName,
    lastName,
    name: [firstName, middleName, lastName].filter(Boolean).join(' ') || 'Student',
    gender: student.gender ?? '',
    sectionId: student.sectionId ?? null,
    section: student.sectionName ?? '',
    sectionName: student.sectionName ?? '',
    gradeLevel: student.gradeLevelName ?? '',
    gradeLevelName: student.gradeLevelName ?? '',
    academicYearId: student.academicYearId ?? null,
    academicYear: student.academicYear ?? '',
  }
}

export async function loginV2(email, password, deviceIdentifier = '') {
  const payload = await requestV2('/api/v2/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password, deviceIdentifier: deviceIdentifier || null }),
  })
  const data = extractData(payload) ?? {}

  return {
    token: normalizeAccessToken(data.accessToken ?? ''),
    tokenType: data.tokenType ?? 'Bearer',
    expiresAt: data.expiresAt ?? '',
    user: normalizeV2User(data.user),
  }
}

export async function getCurrentUserV2(token) {
  const normalizedToken = normalizeAccessToken(token)
  const payload = await requestV2('/api/v2/auth/me', {
    token: normalizedToken,
  })
  return normalizeV2User(extractData(payload) ?? {})
}

export async function logoutV2(token) {
  return requestV2('/api/v2/auth/logout', { method: 'POST', token })
}

export async function getTeacherRegistrationReferenceDataV2() {
  const payload = await requestV2('/api/v2/auth/teacher-registration/reference-data')
  const data = extractData(payload) ?? {}

  return {
    genders: Array.isArray(data.genders) ? data.genders : [],
    suffixes: Array.isArray(data.suffixes) ? data.suffixes : [],
    majors: Array.isArray(data.majors) ? data.majors : [],
    educationalAttainments: Array.isArray(data.educationalAttainments)
      ? data.educationalAttainments
      : [],
    schools: Array.isArray(data.schools) ? data.schools : [],
    verificationMethods: Array.isArray(data.verificationMethods)
      ? data.verificationMethods
      : [],
  }
}

export async function registerTeacherV2(teacherPayload) {
  const payload = await requestV2('/api/v2/auth/register-teacher', {
    method: 'POST',
    body: JSON.stringify(teacherPayload),
    expectedStatus: 201,
  })
  return extractData(payload)
}

export async function verifyTeacherEmailV2(verificationPayload) {
  const payload = await requestV2('/api/v2/auth/verify-teacher-email', {
    method: 'POST',
    body: JSON.stringify(verificationPayload),
  })
  return extractData(payload)
}

export async function resendTeacherVerificationV2(resendPayload) {
  const payload = await requestV2('/api/v2/auth/resend-teacher-verification', {
    method: 'POST',
    body: JSON.stringify(resendPayload),
  })
  return extractData(payload)
}

export async function getTeacherAccountsV2(token, status = '') {
  const payload = await requestV2(`/api/v2/users/teachers${buildQuery({ status })}`, { token })
  const records = extractData(payload)
  return Array.isArray(records) ? records.map(normalizeV2User) : []
}

export async function getTeacherReferenceDataV2(token) {
  const payload = await requestV2('/api/v2/users/teachers/reference-data', { token })
  const data = extractData(payload) ?? {}

  return {
    genders: Array.isArray(data.genders) ? data.genders : [],
    majors: Array.isArray(data.majors) ? data.majors : [],
    educationalAttainments: Array.isArray(data.educationalAttainments)
      ? data.educationalAttainments
      : [],
  }
}

export async function createTeacherAccountV2(teacherPayload, token) {
  const payload = await requestV2('/api/v2/users/teachers', {
    method: 'POST',
    token,
    body: JSON.stringify(teacherPayload),
  })
  return extractData(payload)
}

export async function approveTeacherV2(userId, token) {
  const payload = await requestV2(`/api/v2/users/teachers/${userId}/approve`, {
    method: 'POST',
    token,
  })
  return extractData(payload)
}

export async function rejectTeacherV2(userId, token) {
  const payload = await requestV2(`/api/v2/users/teachers/${userId}/reject`, {
    method: 'POST',
    token,
  })
  return extractData(payload)
}

export async function getSchoolSetupReferenceDataV2(token) {
  const payload = await requestV2('/api/v2/school-setup/reference-data', { token })
  return extractData(payload) ?? { academicYears: [], gradeLevels: [], subjects: [] }
}

export async function getAvailableClassesV2(filters, token) {
  const payload = await requestV2(
    `/api/v2/school-setup/available-classes${buildQuery(filters)}`,
    { token },
  )
  const records = extractData(payload)
  return Array.isArray(records) ? records : []
}

export async function getClassAssignmentsV2(token, academicYearId = '') {
  const payload = await requestV2(
    `/api/v2/school-setup/class-assignments${buildQuery({ academicYearId })}`,
    { token },
  )
  const records = extractData(payload)
  return Array.isArray(records) ? records.map(normalizeV2ClassAssignment) : []
}

export async function createClassAssignmentV2(assignmentPayload, token) {
  const payload = await requestV2('/api/v2/school-setup/class-assignments', {
    method: 'POST',
    token,
    body: JSON.stringify(assignmentPayload),
  })
  return normalizeV2ClassAssignment(extractData(payload) ?? {})
}

export async function updateClassAssignmentV2(classAssignmentId, assignmentPayload, token) {
  const payload = await requestV2(
    `/api/v2/school-setup/class-assignments/${classAssignmentId}`,
    {
      method: 'PATCH',
      token,
      body: JSON.stringify(assignmentPayload),
    },
  )
  return normalizeV2ClassAssignment(extractData(payload) ?? {})
}

export async function deactivateClassAssignmentV2(classAssignmentId, token) {
  const payload = await requestV2(
    `/api/v2/school-setup/class-assignments/${classAssignmentId}/deactivate`,
    {
      method: 'PATCH',
      token,
    },
  )
  return extractData(payload)
}

export async function reactivateClassAssignmentV2(classAssignmentId, reason, token) {
  const payload = await requestV2(
    `/api/v2/school-setup/class-assignments/${classAssignmentId}/reactivate`,
    {
      method: 'PATCH',
      token,
      body: JSON.stringify({ reason }),
    },
  )
  return normalizeV2ClassAssignment(extractData(payload) ?? {})
}

export async function getAssessmentReferenceDataV2(filters, token) {
  const payload = await requestV2(
    `/api/v2/assessments/reference-data${buildQuery(filters)}`,
    { token },
  )
  return extractData(payload) ?? { classAssignments: [], termPeriods: [], skills: [] }
}

export async function getAssessmentsV2(token, classAssignmentId = '') {
  const payload = await requestV2(
    `/api/v2/assessments${buildQuery({ classAssignmentId })}`,
    { token },
  )
  const records = extractData(payload)
  return Array.isArray(records) ? records.map(normalizeV2Assessment) : []
}

export async function getAssessmentV2(testId, token) {
  const payload = await requestV2(`/api/v2/assessments/${testId}`, { token })
  return normalizeV2Assessment(extractData(payload) ?? {})
}

export async function getLmsV2(testId, token) {
  const payload = await requestV2(
    `/api/v2/analytics/lms${buildQuery({ testId })}`,
    { token },
  )
  const records = extractData(payload)
  return Array.isArray(records) ? records.map(normalizeV2LmsRecord) : []
}

export async function getItemAnalysisV2(testId, token) {
  const payload = await requestV2(
    `/api/v2/analytics/item-analysis${buildQuery({ testId })}`,
    { token },
  )
  const records = extractData(payload)
  return Array.isArray(records) ? records : []
}

export async function getTestPartResultsV2(testId, testPartId, token) {
  const payload = await requestV2(
    `/api/v2/analytics/test-part-results${buildQuery({ testId, testPartId })}`,
    { token },
  )
  const records = extractData(payload)
  return Array.isArray(records) ? records.map(normalizeV2TestPartResult) : []
}

export async function getSyncActivityV2(filters = {}, token) {
  const payload = await requestV2(
    `/api/v2/analytics/sync-activity${buildQuery(filters)}`,
    { token },
  )
  const records = extractData(payload)
  return Array.isArray(records) ? records.map(normalizeV2SyncActivity) : []
}

export async function getSchoolAnalyticsV2(filters = {}, token) {
  const payload = await requestV2(
    `/api/v2/analytics/school-overview${buildQuery(filters)}`,
    { token },
  )
  const data = extractData(payload) ?? {}

  return {
    totalAssessments: Number(data.totalAssessments ?? 0),
    lms: Array.isArray(data.lms) ? data.lms.map(normalizeV2LmsRecord) : [],
    gradeLevels: Array.isArray(data.gradeLevels)
      ? data.gradeLevels.map((record) => ({
          ...record,
          id: record.gradeLevelId ?? null,
          label: record.gradeLevelName ?? 'Grade level',
          value: record.masteryRate ?? null,
        }))
      : [],
    trends: Array.isArray(data.trends)
      ? data.trends.map((record) => ({
          ...record,
          id: record.testId ?? null,
          label: record.testName ?? 'Assessment',
          value: record.masteryRate ?? null,
        }))
      : [],
  }
}

export async function createAssessmentV2(assessmentPayload, token) {
  const payload = await requestV2('/api/v2/assessments', {
    method: 'POST',
    token,
    body: JSON.stringify(assessmentPayload),
  })
  return normalizeV2Assessment(extractData(payload) ?? {})
}

export async function updateAssessmentV2(testId, assessmentPayload, token) {
  const payload = await requestV2(`/api/v2/assessments/${testId}`, {
    method: 'PUT',
    token,
    body: JSON.stringify(assessmentPayload),
  })
  return normalizeV2Assessment(extractData(payload) ?? {})
}

export async function activateAssessmentV2(testId, token) {
  const payload = await requestV2(`/api/v2/assessments/${testId}/activate`, {
    method: 'POST',
    token,
  })
  return normalizeV2Assessment(extractData(payload) ?? {})
}

export async function archiveAssessmentV2(testId, token) {
  const payload = await requestV2(`/api/v2/assessments/${testId}/archive`, {
    method: 'POST',
    token,
  })
  return normalizeV2Assessment(extractData(payload) ?? {})
}

export function getBubbleAnswerSheetPdfV2(testId, token) {
  return requestV2(`/api/v2/assessments/${testId}/omr-sheet`, {
    token,
    responseType: 'blob',
    headers: {
      Accept: 'application/pdf',
    },
  })
}

export function getTestQuestionnairePdfV2(testId, token) {
  return requestV2(`/api/v2/assessments/${testId}/questionnaire`, {
    token,
    responseType: 'blob',
    headers: {
      Accept: 'application/pdf',
    },
  })
}

export async function getStudentsV2(token, academicYearId = '') {
  const payload = await requestV2(
    `/api/v2/import/students${buildQuery({ academicYearId })}`,
    { token },
  )
  const records = extractData(payload)
  return Array.isArray(records) ? records.map(normalizeV2Student) : []
}

export async function getTeacherClassStudentsV2(classId, token) {
  const payload = await requestV2(`/api/v2/teacher/classes/${classId}/students`, { token })
  const records = extractData(payload)
  return Array.isArray(records) ? records.map(normalizeV2Student) : []
}

export async function previewSf1V2(file, token) {
  const formData = new FormData()
  formData.append('file', file)

  const payload = await requestV2('/api/v2/import/sf1/preview', {
    method: 'POST',
    token,
    body: formData,
  })
  return extractData(payload) ?? {}
}

export async function confirmSf1V2(file, { gradeLevelId }, token) {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('gradeLevelId', String(gradeLevelId))

  const payload = await requestV2('/api/v2/import/sf1/confirm', {
    method: 'POST',
    token,
    body: formData,
  })
  return extractData(payload) ?? {}
}

export { API_BASE_URL as API_V2_BASE_URL }

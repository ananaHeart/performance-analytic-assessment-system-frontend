const API_BASE_URL = (import.meta.env.VITE_V3_API_URL || '').replace(/\/$/, '')

export const V3_AUTH_EXPIRED_EVENT = 'smart:v3-auth-expired'

const PUBLIC_AUTH_PATHS = new Set([
  '/api/v3/auth/teacher-registration/reference-data',
  '/api/v3/auth/register-teacher',
  '/api/v3/auth/verify-teacher-email',
  '/api/v3/auth/resend-teacher-verification',
  '/api/v3/auth/login',
  '/api/v3/auth/mfa/login/verify',
])
const AUTH_STORAGE_KEY = 'assessment-auth-session'
const LEGACY_TOKEN_STORAGE_KEY = 'assessment-token'
const V3_DEVICE_IDENTIFIER_STORAGE_KEY = 'assessment-v3-device-identifier'

export function normalizeAccessToken(value) {
  if (typeof value !== 'string') return ''

  let token = value.trim()

  if (
    (token.startsWith('"') && token.endsWith('"')) ||
    (token.startsWith("'") && token.endsWith("'"))
  ) {
    token = token.slice(1, -1).trim()
  }

  token = token.replace(/^Bearer\s+/i, '').trim()
  return token && !['null', 'undefined'].includes(token.toLowerCase()) ? token : ''
}

export function getV3DeviceIdentifier() {
  if (typeof window === 'undefined') return 'web-browser'

  const storedIdentifier = window.localStorage.getItem(V3_DEVICE_IDENTIFIER_STORAGE_KEY)
  if (storedIdentifier) return storedIdentifier

  const host = window.location.hostname.replace(/[^a-z0-9.-]/gi, '-').slice(0, 40) || 'browser'
  const port = window.location.port || (window.location.protocol === 'https:' ? '443' : '80')
  const randomId =
    window.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`
  const identifier = `web-${host}-${port}-${randomId}`

  window.localStorage.setItem(V3_DEVICE_IDENTIFIER_STORAGE_KEY, identifier)
  return identifier
}

function readStoredAccessToken() {
  if (typeof window === 'undefined') return ''

  try {
    const storedSession = window.localStorage.getItem(AUTH_STORAGE_KEY)

    if (storedSession) {
      const token = normalizeAccessToken(JSON.parse(storedSession)?.token)
      if (token) return token
    }
  } catch {
    window.localStorage.removeItem(AUTH_STORAGE_KEY)
  }

  return normalizeAccessToken(window.localStorage.getItem(LEGACY_TOKEN_STORAGE_KEY))
}

function dispatchAuthenticationFailure(rejectedToken) {
  if (typeof window === 'undefined') return

  window.dispatchEvent(
    new CustomEvent(V3_AUTH_EXPIRED_EVENT, {
      detail: { token: normalizeAccessToken(rejectedToken) },
    }),
  )
}

function extractMessage(payload) {
  if (typeof payload?.message === 'string' && payload.message.trim()) {
    return payload.message
  }

  const fieldMessages = Object.entries(payload?.errors ?? {})
    .filter(([key, value]) => key !== 'code' && typeof value === 'string' && value.trim())
    .map(([, value]) => value)

  return fieldMessages.join(' ') || payload?.errors?.code || payload?.error || 'Request failed.'
}

function extractErrorCode(payload) {
  const code = payload?.errors?.code ?? payload?.code ?? ''
  return typeof code === 'string' ? code.trim() : ''
}

function isAuthenticationFailure(status, code) {
  return (
    status === 401 ||
    [
      'AUTHENTICATION_REQUIRED',
      'INVALID_ACCESS_TOKEN',
      'INVALID_TOKEN',
      'TOKEN_EXPIRED',
      'SESSION_EXPIRED',
      'UNAUTHORIZED',
    ].includes(String(code ?? '').trim().toUpperCase())
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

async function requestV3(path, { token = '', headers = {}, expectedStatus = null, ...options } = {}) {
  if (!API_BASE_URL) {
    const configurationError = new Error(
      'The SMART backend URL is not configured. Configure it and restart the frontend.',
    )
    configurationError.code = 'V3_API_URL_MISSING'
    throw configurationError
  }

  const requestHeaders = new Headers(headers)
  const explicitToken = normalizeAccessToken(token)
  const requestToken = PUBLIC_AUTH_PATHS.has(path)
    ? explicitToken
    : explicitToken || readStoredAccessToken()

  if (!PUBLIC_AUTH_PATHS.has(path) && !requestToken) {
    const authenticationError = new Error('Your session is unavailable. Please sign in again.')
    authenticationError.status = 401
    authenticationError.code = 'AUTHENTICATION_REQUIRED'
    authenticationError.isAuthenticationFailure = true
    dispatchAuthenticationFailure(requestToken)
    throw authenticationError
  }

  if (requestToken) {
    requestHeaders.set('Authorization', `Bearer ${requestToken}`)
  }

  if (options.body && !(options.body instanceof FormData) && !requestHeaders.has('Content-Type')) {
    requestHeaders.set('Content-Type', 'application/json')
  }

  let response

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: requestHeaders,
    })
  } catch (cause) {
    const networkError = new Error(
      `Unable to connect to the SMART backend at ${API_BASE_URL}. Confirm it is running and retry.`,
      { cause },
    )
    networkError.code = 'V3_NETWORK_ERROR'
    throw networkError
  }

  const contentType = response.headers.get('content-type') ?? ''
  const payload = contentType.includes('application/json')
    ? await response.json().catch(() => null)
    : await response.text().catch(() => '')

  if (!response.ok) {
    const code = extractErrorCode(payload)
    const requestError = new Error(extractMessage(payload))
    requestError.status = response.status
    requestError.code = code
    requestError.errors = payload?.errors ?? null
    requestError.data = payload?.data ?? null
    requestError.isAuthenticationFailure = isAuthenticationFailure(response.status, code)

    if (requestError.isAuthenticationFailure && !PUBLIC_AUTH_PATHS.has(path)) {
      dispatchAuthenticationFailure(requestToken)
    }

    throw requestError
  }

  if (expectedStatus !== null && response.status !== expectedStatus) {
    const statusError = new Error(
      `Expected HTTP ${expectedStatus} but received ${response.status}.`,
    )
    statusError.status = response.status
    statusError.code = 'UNEXPECTED_RESPONSE_STATUS'
    throw statusError
  }

  return payload
}

function normalizeV3User(user = {}) {
  const firstName = user.firstName ?? ''
  const middleName = user.middleName ?? ''
  const lastName = user.lastName ?? ''
  const suffix = user.suffixName ?? user.suffix ?? ''
  const teachingStartDate =
    user.teachingStartYear && user.teachingStartMonth
      ? `${user.teachingStartYear}-${String(user.teachingStartMonth).padStart(2, '0')}-01`
      : ''

  return {
    ...user,
    id: user.userId ?? user.id ?? null,
    userId: user.userId ?? user.id ?? null,
    firstName,
    middleName,
    lastName,
    suffix,
    name: user.fullName || [firstName, middleName, lastName, suffix].filter(Boolean).join(' '),
    email: user.email ?? '',
    contactNumber: user.contactNumber ?? '',
    teachingStartDate,
    role: String(user.role ?? '').toLowerCase(),
    status: String(user.status ?? '').toLowerCase(),
  }
}

function normalizeV3Class(record = {}) {
  return {
    ...record,
    id: record.classId ?? null,
    name: record.sectionName ?? '',
    academicYear: record.academicYearName ?? '',
  }
}

function normalizeV3ClassAssignment(record = {}) {
  return {
    ...record,
    id: record.classAssignmentId ?? null,
    teacherId: record.teacherUserId ?? null,
    academicYear: record.academicYearName ?? '',
    yearName: record.academicYearName ?? '',
  }
}

function normalizeV3Student(record = {}, classId = null) {
  const firstName = record.firstName ?? ''
  const middleName = record.middleName ?? ''
  const lastName = record.lastName ?? ''

  return {
    ...record,
    id: record.studentId ?? null,
    studentId: record.studentId ?? null,
    classListId: record.classListId ?? null,
    classId,
    firstName,
    middleName,
    lastName,
    name: record.fullName || [firstName, middleName, lastName].filter(Boolean).join(' ') || 'Student',
    section: record.sectionName ?? '',
    gradeLevel: record.gradeLevelName ?? '',
  }
}

function normalizeV3AssessmentAssignment(record = {}) {
  return {
    ...record,
    id: record.classAssignmentId ?? null,
    academicYear: record.academicYearName ?? '',
    yearName: record.academicYearName ?? '',
  }
}

function normalizeV3AssessmentSummary(record = {}) {
  return {
    ...record,
    id: record.testId ?? null,
    testStatus: record.status ?? 'draft',
    testDate: record.openAt ? String(record.openAt).slice(0, 10) : '',
  }
}

export async function getTeacherRegistrationReferenceDataV3() {
  const payload = await requestV3('/api/v3/auth/teacher-registration/reference-data')
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
    verificationPolicy: data.verificationPolicy ?? null,
  }
}

export async function registerTeacherV3(registration) {
  const payload = await requestV3('/api/v3/auth/register-teacher', {
    method: 'POST',
    expectedStatus: 201,
    body: JSON.stringify(registration),
  })
  return extractData(payload) ?? null
}

export async function verifyTeacherEmailV3(verification) {
  const payload = await requestV3('/api/v3/auth/verify-teacher-email', {
    method: 'POST',
    body: JSON.stringify(verification),
  })
  return extractData(payload) ?? null
}

export async function resendTeacherVerificationV3(verification) {
  const payload = await requestV3('/api/v3/auth/resend-teacher-verification', {
    method: 'POST',
    body: JSON.stringify(verification),
  })
  return extractData(payload) ?? null
}

export async function loginV3(email, password, deviceIdentifier = '') {
  const payload = await requestV3('/api/v3/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password, deviceIdentifier: deviceIdentifier || null }),
  })
  const data = extractData(payload) ?? {}

  return {
    token: normalizeAccessToken(data.accessToken),
    tokenType: data.tokenType ?? 'Bearer',
    expiresAt: data.expiresAt ?? '',
    user: data.user ? normalizeV3User(data.user) : null,
    mfaRequired: Boolean(data.mfaRequired),
    mfaChallenge: data.mfaChallenge ?? null,
  }
}

export async function verifyMfaLoginV3(challengeUuid, code, verificationMethod, deviceIdentifier) {
  const payload = await requestV3('/api/v3/auth/mfa/login/verify', {
    method: 'POST',
    body: JSON.stringify({
      challengeUuid,
      code,
      verificationMethod,
      deviceIdentifier: deviceIdentifier || null,
    }),
  })
  const data = extractData(payload) ?? {}

  return {
    token: normalizeAccessToken(data.accessToken),
    tokenType: data.tokenType ?? 'Bearer',
    expiresAt: data.expiresAt ?? '',
    user: data.user ? normalizeV3User(data.user) : null,
    mfaRequired: Boolean(data.mfaRequired),
    mfaChallenge: data.mfaChallenge ?? null,
  }
}

export async function getMfaStatusV3(token) {
  const payload = await requestV3('/api/v3/auth/mfa/status', { token })
  return extractData(payload) ?? null
}

export async function startMfaEnrollmentV3(enrollment, token) {
  const payload = await requestV3('/api/v3/auth/mfa/enrollment', {
    method: 'POST',
    token,
    body: JSON.stringify(enrollment),
  })
  return extractData(payload) ?? null
}

export async function confirmMfaEnrollmentV3(confirmation, token) {
  const payload = await requestV3('/api/v3/auth/mfa/enrollment/confirm', {
    method: 'POST',
    token,
    body: JSON.stringify(confirmation),
  })
  return extractData(payload) ?? null
}

export async function regenerateMfaRecoveryCodesV3(confirmation, token) {
  const payload = await requestV3('/api/v3/auth/mfa/recovery-codes/regenerate', {
    method: 'POST',
    token,
    body: JSON.stringify(confirmation),
  })
  return extractData(payload) ?? null
}

export async function disableMfaV3(confirmation, token) {
  const payload = await requestV3('/api/v3/auth/mfa/disable', {
    method: 'POST',
    token,
    body: JSON.stringify(confirmation),
  })
  return extractData(payload) ?? null
}

export async function getCurrentUserV3(token) {
  const payload = await requestV3('/api/v3/auth/me', { token })
  return normalizeV3User(extractData(payload) ?? {})
}

export function logoutV3(token) {
  return requestV3('/api/v3/auth/logout', { method: 'POST', token })
}

export async function getReportReferenceDataV3(token) {
  const payload = await requestV3('/api/v3/reports/reference-data', { token })
  const data = extractData(payload) ?? {}

  return {
    ...data,
    academicYears: Array.isArray(data.academicYears) ? data.academicYears : [],
    termPeriods: Array.isArray(data.termPeriods) ? data.termPeriods : [],
    gradeLevels: Array.isArray(data.gradeLevels) ? data.gradeLevels : [],
    classes: Array.isArray(data.classes) ? data.classes : [],
    teachers: Array.isArray(data.teachers) ? data.teachers : [],
    subjects: Array.isArray(data.subjects) ? data.subjects : [],
    classAssignments: Array.isArray(data.classAssignments) ? data.classAssignments : [],
    assessments: Array.isArray(data.assessments) ? data.assessments : [],
    students: Array.isArray(data.students) ? data.students : [],
  }
}

export async function getAssessmentResultsReportV3(testId, classAssignmentId, token) {
  const payload = await requestV3(
    `/api/v3/reports/assessment-results${buildQuery({ testId, classAssignmentId })}`,
    { token },
  )

  return extractData(payload) ?? null
}

function normalizeNotificationUnreadCount(data) {
  const unreadCount = Number(data?.unreadCount)
  return Number.isFinite(unreadCount) && unreadCount > 0 ? Math.floor(unreadCount) : 0
}

export async function getNotificationUnreadCountV3(token) {
  const payload = await requestV3('/api/v3/notifications/unread-count', { token })
  const data = extractData(payload)

  return {
    unreadCount: normalizeNotificationUnreadCount(data),
  }
}

export async function getNotificationsV3(token, { unreadOnly = false, limit = 20 } = {}) {
  const payload = await requestV3(
    `/api/v3/notifications${buildQuery({ unreadOnly, limit })}`,
    { token },
  )
  const data = extractData(payload) ?? {}

  return {
    unreadCount: normalizeNotificationUnreadCount(data),
    notifications: Array.isArray(data.notifications) ? data.notifications : [],
  }
}

export async function markNotificationReadV3(notificationId, token) {
  const payload = await requestV3(
    `/api/v3/notifications/${encodeURIComponent(notificationId)}/read`,
    { method: 'POST', token },
  )
  const data = extractData(payload)

  return {
    unreadCount: normalizeNotificationUnreadCount(data),
  }
}

export async function markAllNotificationsReadV3(token) {
  const payload = await requestV3('/api/v3/notifications/read-all', {
    method: 'POST',
    token,
  })
  const data = extractData(payload)

  return {
    unreadCount: normalizeNotificationUnreadCount(data),
  }
}

export async function getTeacherAccountsV3(token, status = 'pending_approval') {
  const payload = await requestV3(`/api/v3/users/teachers${buildQuery({ status })}`, { token })
  const records = extractData(payload)
  return Array.isArray(records) ? records.map(normalizeV3User) : []
}

export async function getTeacherAccountV3(teacherUserId, token) {
  const payload = await requestV3(`/api/v3/users/teachers/${teacherUserId}`, { token })
  return normalizeV3User(extractData(payload) ?? {})
}

export async function approveTeacherV3(teacherUserId, token) {
  const payload = await requestV3(`/api/v3/users/teachers/${teacherUserId}/approve`, {
    method: 'POST',
    token,
  })
  return normalizeV3User(extractData(payload) ?? {})
}

export async function rejectTeacherV3(teacherUserId, reason, token) {
  const payload = await requestV3(`/api/v3/users/teachers/${teacherUserId}/reject`, {
    method: 'POST',
    token,
    body: JSON.stringify({ reason }),
  })
  return normalizeV3User(extractData(payload) ?? {})
}

export async function getSchoolProfileV3(token) {
  const payload = await requestV3('/api/v3/school-setup/profile', { token })
  return extractData(payload) ?? null
}

export async function updateSchoolProfileV3(profile, token) {
  const payload = await requestV3('/api/v3/school-setup/profile', {
    method: 'PUT',
    token,
    body: JSON.stringify(profile),
  })
  return extractData(payload) ?? null
}

export async function getSchoolSetupReferenceDataV3(token) {
  const payload = await requestV3('/api/v3/school-setup/reference-data', { token })
  const data = extractData(payload) ?? {}

  return {
    school: data.school ?? null,
    academicYears: Array.isArray(data.academicYears) ? data.academicYears : [],
    termPeriods: Array.isArray(data.termPeriods) ? data.termPeriods : [],
    gradeLevels: Array.isArray(data.gradeLevels) ? data.gradeLevels : [],
    subjects: Array.isArray(data.subjects) ? data.subjects : [],
    genders: Array.isArray(data.genders) ? data.genders : [],
    suffixes: Array.isArray(data.suffixes) ? data.suffixes : [],
    teachers: Array.isArray(data.teachers)
      ? data.teachers.map((teacher) => ({
          ...teacher,
          id: teacher.teacherUserId,
          userId: teacher.teacherUserId,
          name: teacher.fullName ?? '',
        }))
      : [],
  }
}

export async function getAcademicYearsV3(token) {
  const payload = await requestV3('/api/v3/school-setup/academic-years', { token })
  const data = extractData(payload)
  return Array.isArray(data) ? data : data ? [data] : []
}

export async function getClassesV3(filters = {}, token) {
  const payload = await requestV3(`/api/v3/school-setup/classes${buildQuery(filters)}`, { token })
  const records = extractData(payload)
  return Array.isArray(records) ? records.map(normalizeV3Class) : []
}

export async function createClassV3(classPayload, token) {
  const payload = await requestV3('/api/v3/school-setup/classes', {
    method: 'POST',
    token,
    body: JSON.stringify(classPayload),
  })
  return normalizeV3Class(extractData(payload) ?? {})
}

export async function getClassAssignmentsV3(token, academicYearId = '') {
  const payload = await requestV3(
    `/api/v3/school-setup/class-assignments${buildQuery({ academicYearId })}`,
    { token },
  )
  const records = extractData(payload)
  return Array.isArray(records) ? records.map(normalizeV3ClassAssignment) : []
}

export async function createClassAssignmentV3(assignmentPayload, token) {
  const payload = await requestV3('/api/v3/school-setup/class-assignments', {
    method: 'POST',
    token,
    body: JSON.stringify(assignmentPayload),
  })
  return normalizeV3ClassAssignment(extractData(payload) ?? {})
}

export async function archiveClassAssignmentV3(classAssignmentId, reason, token) {
  const payload = await requestV3(
    `/api/v3/school-setup/class-assignments/${classAssignmentId}/archive`,
    {
      method: 'PATCH',
      token,
      body: JSON.stringify({ reason }),
    },
  )
  return normalizeV3ClassAssignment(extractData(payload) ?? {})
}

export async function reactivateClassAssignmentV3(classAssignmentId, reason, token) {
  const payload = await requestV3(
    `/api/v3/school-setup/class-assignments/${classAssignmentId}/reactivate`,
    {
      method: 'PATCH',
      token,
      body: JSON.stringify({ reason }),
    },
  )
  return normalizeV3ClassAssignment(extractData(payload) ?? {})
}

export async function getClassAssignmentSchedulesV3(classAssignmentId, token) {
  const payload = await requestV3(
    `/api/v3/teacher/class-assignments/${classAssignmentId}/schedules`,
    { token },
  )
  const records = extractData(payload)
  return Array.isArray(records) ? records : records ? [records] : []
}

export async function createClassAssignmentScheduleV3(classAssignmentId, schedule, token) {
  const payload = await requestV3(
    `/api/v3/teacher/class-assignments/${classAssignmentId}/schedules`,
    {
      method: 'POST',
      token,
      expectedStatus: 201,
      body: JSON.stringify(schedule),
    },
  )
  return extractData(payload) ?? null
}

export async function updateClassAssignmentScheduleV3(
  classAssignmentId,
  scheduleId,
  schedule,
  token,
) {
  const payload = await requestV3(
    `/api/v3/teacher/class-assignments/${classAssignmentId}/schedules/${scheduleId}`,
    {
      method: 'PUT',
      token,
      body: JSON.stringify(schedule),
    },
  )
  return extractData(payload) ?? null
}

export async function archiveClassAssignmentScheduleV3(
  classAssignmentId,
  scheduleId,
  reason,
  token,
) {
  const payload = await requestV3(
    `/api/v3/teacher/class-assignments/${classAssignmentId}/schedules/${scheduleId}/archive`,
    {
      method: 'PATCH',
      token,
      body: JSON.stringify({ reason }),
    },
  )
  return extractData(payload) ?? null
}

export async function getPrincipalClassStudentsV3(classId, token, enrollmentStatus = 'enrolled') {
  const payload = await requestV3(
    `/api/v3/school-setup/classes/${classId}/students${buildQuery({ enrollmentStatus })}`,
    { token },
  )
  const records = extractData(payload)
  return Array.isArray(records) ? records.map((record) => normalizeV3Student(record, classId)) : []
}

export async function enrollStudentV3(classId, student, token) {
  const payload = await requestV3(`/api/v3/school-setup/classes/${classId}/students`, {
    method: 'POST',
    token,
    body: JSON.stringify(student),
  })
  const data = extractData(payload) ?? {}

  return {
    ...data,
    student: data.student ? normalizeV3Student(data.student, classId) : null,
  }
}

export async function updateStudentProfileV3(classId, studentId, student, token) {
  const payload = await requestV3(
    `/api/v3/school-setup/classes/${classId}/students/${studentId}`,
    {
      method: 'PUT',
      token,
      body: JSON.stringify(student),
    },
  )

  return normalizeV3Student(extractData(payload) ?? {}, classId)
}

export async function updateStudentEnrollmentStatusV3(classListId, statusUpdate, token) {
  const payload = await requestV3(
    `/api/v3/school-setup/class-lists/${classListId}/status`,
    {
      method: 'PATCH',
      token,
      body: JSON.stringify(statusUpdate),
    },
  )

  return normalizeV3Student(extractData(payload) ?? {})
}

export async function getTeacherClassStudentsV3(classId, token, enrollmentStatus = 'enrolled') {
  const payload = await requestV3(
    `/api/v3/teacher/classes/${classId}/students${buildQuery({ enrollmentStatus })}`,
    { token },
  )
  const records = extractData(payload)
  return Array.isArray(records) ? records.map((record) => normalizeV3Student(record, classId)) : []
}

export async function getAssessmentReferenceDataV3(filters = {}, token) {
  const payload = await requestV3(
    `/api/v3/assessments/reference-data${buildQuery(filters)}`,
    { token },
  )
  const data = extractData(payload) ?? {}
  const assignments = Array.isArray(data.assignments)
    ? data.assignments.map(normalizeV3AssessmentAssignment)
    : []

  return {
    ...data,
    assignments,
    classAssignments: assignments,
    selectedAssignment: data.selectedAssignment
      ? normalizeV3AssessmentAssignment(data.selectedAssignment)
      : null,
    termPeriods: Array.isArray(data.termPeriods) ? data.termPeriods : [],
    questionTypes: Array.isArray(data.questionTypes) ? data.questionTypes : [],
    skills: Array.isArray(data.skills) ? data.skills : [],
    rubrics: Array.isArray(data.rubrics) ? data.rubrics : [],
    testTypes: Array.isArray(data.testTypes) ? data.testTypes : [],
    responseRegionSizes: Array.isArray(data.responseRegionSizes)
      ? data.responseRegionSizes
      : [],
  }
}

export async function getAssessmentsV3(token, classAssignmentId) {
  if (classAssignmentId === undefined || classAssignmentId === null || classAssignmentId === '') {
    const assignmentError = new Error('Select a class assignment before loading assessments.')
    assignmentError.code = 'CLASS_ASSIGNMENT_REQUIRED'
    throw assignmentError
  }

  const payload = await requestV3(
    `/api/v3/assessments${buildQuery({ classAssignmentId })}`,
    { token },
  )
  const records = extractData(payload)
  return Array.isArray(records) ? records.map(normalizeV3AssessmentSummary) : []
}

export async function getAssessmentV3(testId, token) {
  const payload = await requestV3(`/api/v3/assessments/${testId}`, { token })
  return extractData(payload) ?? null
}

export async function createAssessmentV3(assessment, token) {
  const payload = await requestV3('/api/v3/assessments', {
    method: 'POST',
    token,
    expectedStatus: 201,
    body: JSON.stringify(assessment),
  })
  return extractData(payload) ?? null
}

export async function updateAssessmentV3(testId, assessment, token) {
  const payload = await requestV3(`/api/v3/assessments/${testId}`, {
    method: 'PUT',
    token,
    body: JSON.stringify(assessment),
  })
  return extractData(payload) ?? null
}

export async function activateAssessmentV3(testId, token) {
  const payload = await requestV3(`/api/v3/assessments/${testId}/activate`, {
    method: 'POST',
    token,
  })
  return extractData(payload) ?? null
}

export async function archiveAssessmentV3(testId, token) {
  const payload = await requestV3(`/api/v3/assessments/${testId}/archive`, {
    method: 'POST',
    token,
  })
  return extractData(payload) ?? null
}

export async function previewSf1V3(
  file,
  { academicYearId, gradeLevelId, sectionName = '' },
  token,
) {
  const formData = new FormData()
  formData.append('file', file)
  const payload = await requestV3(
    `/api/v3/import/sf1/preview${buildQuery({ academicYearId, gradeLevelId, sectionName })}`,
    { method: 'POST', token, body: formData },
  )
  return extractData(payload) ?? null
}

export async function confirmSf1V3(
  file,
  {
    importUuid,
    academicYearId,
    gradeLevelId,
    sectionName = '',
    expectedFileHash,
    acceptContextMismatch = false,
  },
  token,
) {
  const formData = new FormData()
  formData.append('file', file)
  const payload = await requestV3(
    `/api/v3/import/sf1/confirm${buildQuery({
      importUuid,
      academicYearId,
      gradeLevelId,
      sectionName,
      expectedFileHash,
      acceptContextMismatch,
    })}`,
    { method: 'POST', token, body: formData },
  )
  return extractData(payload) ?? null
}

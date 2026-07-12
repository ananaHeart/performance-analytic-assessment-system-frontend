const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')

function extractMessage(payload) {
  if (!payload) {
    return 'Request failed.'
  }

  return (
    payload.message ||
    payload.error ||
    payload.details ||
    payload.data?.error ||
    payload.data?.message ||
    'Request failed.'
  )
}

function normalizeAuthPayload(payload) {
  const source = payload?.data ?? payload ?? {}
  const nestedUser = source.user ?? payload?.user ?? null
  const userSource = nestedUser ?? source
  const role = (userSource.role ?? source.role ?? '').toLowerCase()

  return {
    token: source.token ?? payload?.token ?? '',
    user: {
      id: userSource.id ?? userSource.userId ?? source.id ?? source.userId ?? null,
      firstName: userSource.firstName ?? source.firstName ?? '',
      middleName: userSource.middleName ?? source.middleName ?? '',
      lastName: userSource.lastName ?? source.lastName ?? '',
      name:
        userSource.name ??
        source.name ??
        [userSource.firstName, userSource.middleName, userSource.lastName]
          .filter(Boolean)
          .join(' '),
      email: userSource.email ?? source.email ?? '',
      role,
      status: userSource.status ?? source.status ?? '',
    },
  }
}

function extractCollection(payload, keys = []) {
  if (Array.isArray(payload)) {
    return payload
  }

  if (Array.isArray(payload?.data)) {
    return payload.data
  }

  for (const key of keys) {
    if (Array.isArray(payload?.[key])) {
      return payload[key]
    }

    if (Array.isArray(payload?.data?.[key])) {
      return payload.data[key]
    }
  }

  return []
}

function normalizeTeacherRecord(teacher) {
  const firstName = teacher.firstName ?? ''
  const middleName = teacher.middleName ?? ''
  const lastName = teacher.lastName ?? ''
  const rawStatus = teacher.status ?? 'pending'
  const normalizedStatus = String(rawStatus).toLowerCase()

  return {
    id: teacher.userId ?? teacher.id ?? teacher.teacherId ?? null,
    firstName,
    middleName,
    lastName,
    name:
      teacher.name || [firstName, middleName, lastName].filter(Boolean).join(' ') || 'Teacher',
    email: teacher.email ?? '',
    gender: teacher.gender ?? teacher.sex ?? 'Not provided',
    dateOfBirth: teacher.dateOfBirth ?? teacher.dateBirth ?? teacher.birthDate ?? teacher.dob ?? '',
    role: (teacher.role ?? 'teacher').toLowerCase(),
    status: normalizedStatus,
    subject: teacher.subject ?? teacher.specialization ?? 'Not assigned',
    gradeLevel: teacher.gradeLevel ?? teacher.grade ?? 'Not assigned',
  }
}

function normalizeStudentRecord(student) {
  const firstName = student.firstName ?? ''
  const middleName = student.middleName ?? ''
  const lastName = student.lastName ?? ''

  return {
    id: student.id ?? student.studentId ?? student.manualStudentId ?? null,
    studentLrn: student.studentLrn ?? student.lrn ?? student.LRN ?? '',
    firstName,
    middleName,
    lastName,
    name:
      student.name || [firstName, middleName, lastName].filter(Boolean).join(' ') || 'Student',
    gender: student.gender ?? student.sex ?? 'Not provided',
    section:
      student.section ??
      student.sectionName ??
      student.sectionLabel ??
      student.sectionDisplayName ??
      'Not assigned',
    sectionId: student.sectionId ?? student.section?.id ?? null,
    gradeLevel:
      student.gradeLevel ?? student.gradeLevelName ?? student.grade ?? student.gradeName ?? '',
    academicYear:
      student.academicYear ??
      student.academicYearName ??
      student.schoolYear ??
      student.academicYearLabel ??
      '',
  }
}

function normalizeSectionRecord(section) {
  return {
    id: section.id ?? section.sectionId ?? section.value ?? null,
    name:
      section.name ??
      section.sectionName ??
      section.section ??
      section.label ??
      section.displayName ??
      'Unnamed Section',
    gradeLevelName:
      section.gradeLevelName ??
      section.gradeLevel ??
      section.grade ??
      section.gradeName ??
      '',
  }
}

function normalizeGradeLevelRecord(gradeLevel) {
  return {
    id: gradeLevel.id ?? gradeLevel.gradeLevelId ?? gradeLevel.value ?? null,
    name:
      gradeLevel.name ??
      gradeLevel.gradeLevelName ??
      gradeLevel.grade ??
      gradeLevel.label ??
      'Unnamed Grade Level',
  }
}

function normalizePreviewRow(row) {
  return {
    rowNumber: row.rowNumber ?? row.row ?? row.lineNumber ?? '',
    studentLrn: row.studentLrn ?? row.lrn ?? row.LRN ?? '',
    firstName: row.firstName ?? '',
    lastName: row.lastName ?? '',
    gender: row.gender ?? row.sex ?? '',
    status: row.status ?? 'Unknown',
    message: row.message ?? row.error ?? row.remarks ?? '',
  }
}

function extractObject(payload) {
  return payload?.data ?? payload ?? {}
}

function normalizeSchoolTeacherRecord(teacher) {
  const firstName = teacher.firstName ?? ''
  const middleName = teacher.middleName ?? ''
  const lastName = teacher.lastName ?? ''

  return {
    id: teacher.id ?? teacher.teacherId ?? teacher.userId ?? null,
    name:
      teacher.name || [firstName, middleName, lastName].filter(Boolean).join(' ') || 'Teacher',
    email: teacher.email ?? '',
  }
}

function normalizeSubjectRecord(subject) {
  return {
    id: subject.id ?? subject.subjectId ?? subject.value ?? null,
    name:
      subject.name ??
      subject.subjectName ??
      subject.subject ??
      subject.label ??
      subject.displayName ??
      'Unnamed Subject',
  }
}

function normalizeClassAssignmentRecord(assignment) {
  return {
    id: assignment.id ?? assignment.classAssignmentId ?? null,
    classId:
      assignment.classId ??
      assignment.id ??
      assignment.classAssignmentId ??
      assignment.sectionId ??
      null,
    teacherId: assignment.teacherId ?? assignment.teacher?.id ?? assignment.teacher?.teacherId ?? null,
    subjectId: assignment.subjectId ?? assignment.subject?.id ?? assignment.subject?.subjectId ?? null,
    sectionId: assignment.sectionId ?? assignment.section?.id ?? assignment.section?.sectionId ?? null,
    gradeLevelId:
      assignment.gradeLevelId ??
      assignment.section?.gradeLevelId ??
      assignment.gradeLevel?.id ??
      null,
    teacherName:
      assignment.teacherName ??
      assignment.teacher?.name ??
      [
        assignment.teacher?.firstName,
        assignment.teacher?.middleName,
        assignment.teacher?.lastName,
      ]
        .filter(Boolean)
        .join(' ') ??
      'Not assigned',
    subjectName:
      assignment.subjectName ??
      assignment.subject?.name ??
      assignment.subject?.subjectName ??
      'Not assigned',
    sectionName:
      assignment.sectionName ??
      assignment.section?.name ??
      assignment.section?.sectionName ??
      'Not assigned',
    gradeLevelName:
      assignment.gradeLevelName ??
      assignment.section?.gradeLevelName ??
      assignment.section?.gradeLevel ??
      assignment.gradeLevel ??
      '',
    academicYear:
      assignment.academicYear ??
      assignment.academicYearName ??
      assignment.schoolYear ??
      assignment.academicYearLabel ??
      '',
  }
}

function normalizeCompetencyRecord(competency) {
  const name =
    competency.name ??
    competency.competencyName ??
    competency.description ??
    competency.title ??
    'Unnamed Competency'
  const code = competency.code ?? competency.competencyCode ?? ''

  return {
    id: competency.id ?? competency.competencyId ?? competency.value ?? null,
    rootCompetencyId:
      competency.rootCompetencyId ?? competency.parentCompetencyId ?? competency.root?.id ?? null,
    gradeLevelId: competency.gradeLevelId ?? competency.gradeLevel?.id ?? null,
    subjectId: competency.subjectId ?? competency.subject?.id ?? null,
    code,
    name,
    label: code ? `${code} - ${name}` : name,
  }
}

function normalizeCompetencyTreeRecord(competency) {
  const normalized = normalizeCompetencyRecord(competency)

  return {
    ...normalized,
    branches: extractCollection(competency, ['branches', 'children', 'skills']).map(
      normalizeCompetencyTreeRecord,
    ),
  }
}

function normalizeAssessmentRecord(assessment) {
  return {
    id: assessment.testId ?? assessment.id ?? assessment.assessmentId ?? null,
    classId: assessment.classId ?? assessment.classAssignmentId ?? assessment.sectionId ?? null,
    testName: assessment.testName ?? assessment.name ?? 'Untitled Test',
    testType: assessment.testType ?? assessment.type ?? '',
    testDate: assessment.testDate ?? assessment.date ?? '',
    testStatus: assessment.testStatus ?? assessment.status ?? '',
    subjectName:
      assessment.subjectName ??
      assessment.subject?.name ??
      assessment.subject?.subjectName ??
      '',
    sectionName:
      assessment.sectionName ??
      assessment.section?.name ??
      assessment.section?.sectionName ??
      '',
    gradeLevelName:
      assessment.gradeLevelName ??
      assessment.section?.gradeLevelName ??
      assessment.gradeLevel ??
      '',
  }
}

function normalizePartSkillMappingRecord(mapping) {
  return {
    id: mapping.id ?? mapping.mappingId ?? null,
    testPartId: mapping.testPartId ?? mapping.partId ?? null,
    competencyId: mapping.competencyId ?? mapping.competency?.competencyId ?? mapping.competency?.id ?? null,
    competencyName:
      mapping.competencyName ??
      mapping.competency?.competencyName ??
      mapping.competency?.name ??
      'Branch skill',
    mappingMode: String(mapping.mappingMode ?? mapping.mode ?? 'RANGE').toUpperCase(),
    itemCount: mapping.itemCount ?? mapping.items?.length ?? mapping.itemNumbers?.length ?? 0,
    startItem: mapping.startItem ?? null,
    endItem: mapping.endItem ?? null,
    itemNumbers: Array.isArray(mapping.itemNumbers) ? mapping.itemNumbers : [],
  }
}

function normalizeAssessmentPartRecord(part) {
  return {
    id: part.id ?? part.testPartId ?? part.partId ?? null,
    competencyId:
      part.competencyId ?? part.competency?.id ?? part.competency?.competencyId ?? null,
    competencyName:
      part.competencyName ??
      part.competency?.name ??
      part.competency?.competencyName ??
      part.competencyLabel ??
      '',
    partOrder: part.partOrder ?? part.order ?? '',
    partType: part.partType ?? part.type ?? '',
    numberOfItems: part.numberOfItems ?? part.items ?? '',
    pointsPerItem: part.pointsPerItem ?? part.points ?? '',
    answerKey: part.answerKey ?? '',
  }
}

function normalizeItemAnalysisRecord(item) {
  return {
    itemNumber: item.itemNumber ?? item.itemNo ?? item.number ?? item.item ?? '',
    competencyName:
      item.competencyName ??
      item.competency?.name ??
      item.competency ??
      item.skill ??
      '',
    correctResponses:
      item.correctResponses ?? item.correct ?? item.totalCorrect ?? item.studentsCorrect ?? '',
    totalResponses:
      item.totalResponses ?? item.total ?? item.totalStudents ?? item.responses ?? '',
    difficultyLevel: item.difficultyLevel ?? item.difficulty ?? item.interpretation ?? '',
  }
}

function normalizeLmsRecord(item) {
  const masteryRate =
    item.masteryRate ?? item.mastery_rate ?? item.averageScore ?? item.meanScore ?? item.score ?? ''

  return {
    competencyId:
      item.competencyId ?? item.id ?? item.competency?.id ?? item.competency?.competencyId ?? null,
    competencyName:
      item.competencyName ??
      item.competency?.name ??
      item.competency?.competencyName ??
      item.competency ??
      item.skill ??
      '',
    averageScore: masteryRate,
    masteryLevel: item.masteryLevel ?? item.level ?? item.status ?? '',
    affectedStudents: item.affectedStudents ?? item.studentsAffected ?? item.studentCount ?? '',
  }
}

function normalizeAffectedStudentRecord(item) {
  return {
    competencyId:
      item.competencyId ?? item.id ?? item.competency?.id ?? item.competency?.competencyId ?? null,
    competencyName:
      item.competencyName ??
      item.competency?.name ??
      item.competency?.competencyName ??
      item.competency ??
      item.skill ??
      'Unspecified Competency',
    studentName:
      item.studentName ??
      item.name ??
      [item.firstName, item.middleName, item.lastName].filter(Boolean).join(' ') ??
      'Student',
    studentLrn: item.studentLrn ?? item.lrn ?? item.LRN ?? '',
    sectionName: item.sectionName ?? item.section ?? '',
  }
}

function normalizeAffectedStudentSummary(item) {
  if (typeof item === 'string') {
    return {
      id: item,
      name: item,
      studentLrn: '',
      sectionName: '',
    }
  }

  return normalizeAffectedStudentRecord(item)
}

function normalizeInterventionRecord(item) {
  const studentName =
    item.studentName ??
    item.name ??
    [item.firstName, item.middleName, item.lastName].filter(Boolean).join(' ') ??
    ''

  return {
    id: item.studentId ?? item.id ?? null,
    studentName: studentName || 'Student',
    studentLrn: item.studentLrn ?? item.lrn ?? item.LRN ?? '',
    score:
      item.total_score ??
      item.rawScore ??
      item.raw_score ??
      item.actualScore ??
      item.actual_score ??
      item.earnedScore ??
      item.earned_score ??
      item.earnedPoints ??
      item.earned_points ??
      item.pointsEarned ??
      item.points_earned ??
      item.scoreObtained ??
      item.score_obtained ??
      item.obtainedScore ??
      item.obtained_score ??
      item.correctScore ??
      item.correct_score ??
      item.score ??
      item.totalScore ??
      '',
    correctItems:
      item.correctItems ??
      item.correctAnswers ??
      item.correctCount ??
      item.correctResponses ??
      item.correct ??
      '',
    totalItems: item.totalItems ?? item.items ?? item.numberOfItems ?? '',
    percentage: item.percentage ?? item.masteryRate ?? item.rate ?? '',
    title:
      item.title ??
      item.interventionTitle ??
      item.strategy ??
      item.recommendation ??
      item.action ??
      'Intervention',
    description:
      item.description ??
      item.details ??
      item.message ??
      item.recommendation ??
      item.strategy ??
      '',
    targetGroup: item.targetGroup ?? item.group ?? item.audience ?? '',
    followUp:
      item.followUp ??
      item.followUpActivity ??
      item.reassessment ??
      item.nextStep ??
      item.nextSteps ??
      '',
  }
}

function normalizeTeacherInterventionRecord(item) {
  const affectedStudents = extractCollection(item, [
    'affectedStudents',
    'learners',
    'students',
    'affectedLearners',
  ]).map(normalizeAffectedStudentSummary)

  return {
    id: item.id ?? item.competencyId ?? item.competencyName ?? null,
    competencyId:
      item.competencyId ?? item.id ?? item.competency?.id ?? item.competency?.competencyId ?? null,
    competencyName:
      item.competencyName ??
      item.competency?.name ??
      item.competency?.competencyName ??
      item.competency ??
      item.skill ??
      'Selected competency',
    masteryRate:
      item.masteryRate ??
      item.mastery_rate ??
      item.averageScore ??
      item.lmsPercentage ??
      item.percentage ??
      '',
    status: item.status ?? item.lmsStatus ?? item.masteryStatus ?? item.masteryLevel ?? '',
    affectedLearnersCount:
      item.affectedLearnersCount ??
      item.affectedLearnerCount ??
      item.affectedStudentsCount ??
      item.studentsAffected ??
      affectedStudents.length ??
      '',
    recommendedAction:
      item.recommendedAction ?? item.action ?? item.strategy ?? item.interventionTitle ?? '',
    targetGroup: item.targetGroup ?? item.group ?? item.audience ?? '',
    followUpActivity:
      item.followUpActivity ??
      item.followUp ??
      item.reassessment ??
      item.nextStep ??
      item.nextSteps ??
      '',
    recommendation: item.recommendation ?? item.description ?? item.details ?? item.message ?? '',
    affectedStudents,
  }
}

function normalizeStudentSkillMasteryRecord(item) {
  return {
    id: item.id ?? item.competencyId ?? item.competencyName ?? null,
    studentId: item.studentId ?? item.student_id ?? null,
    competencyId: item.competencyId ?? item.competency_id ?? item.id ?? null,
    competencyName:
      item.competencyName ??
      item.competency_name ??
      item.skillName ??
      item.skill ??
      item.name ??
      'Competency',
    earnedPoints: item.earnedPoints ?? item.earned_points ?? '',
    totalPoints: item.totalPoints ?? item.total_points ?? '',
    masteryRate:
      item.masteryRate ??
      item.mastery_rate ??
      item.percentage ??
      item.lmsPercentage ??
      item.averageScore ??
      '',
    status: item.status ?? item.masteryStatus ?? item.masteryLevel ?? '',
    assessmentsCount: item.assessmentsCount ?? item.assessmentCount ?? item.testsCount ?? '',
  }
}

function normalizeTrendRecord(item) {
  return {
    id: item.testId ?? item.id ?? null,
    label: item.label ?? item.period ?? item.testName ?? item.date ?? item.month ?? 'Trend',
    value: item.value ?? item.score ?? item.averageScore ?? item.mastery ?? '',
    date: item.testDate ?? item.date ?? '',
    note: item.note ?? item.description ?? item.status ?? '',
  }
}

function normalizeSyncActivityRecord(item) {
  return {
    id: item.testId ?? item.id ?? null,
    timestamp: item.timestamp ?? item.syncTimestamp ?? item.syncedAt ?? item.createdAt ?? item.date ?? '',
    activity: item.activity ?? item.action ?? item.testName ?? item.type ?? 'Sync Activity',
    details: item.details ?? item.message ?? item.syncStatus ?? item.status ?? '',
  }
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, options)
  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(extractMessage(payload))
  }

  return payload
}

async function requestFileDownload(path, filename) {
  const response = await fetch(`${API_BASE_URL}${path}`)

  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(extractMessage(payload))
  }

  const blob = await response.blob()
  const downloadUrl = window.URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = downloadUrl
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(downloadUrl)

  return filename
}

export async function login(email, password) {
  const payload = await request('/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  })

  const auth = normalizeAuthPayload(payload)

  if (!auth.token || !auth.user.role) {
    throw new Error('Login response is incomplete.')
  }

  return auth
}

export async function registerTeacher(teacherData) {
  return request('/api/auth/register-teacher', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(teacherData),
  })
}

export async function getTeacherAccounts(token) {
  const payload = await request('/api/auth/teachers', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  return extractCollection(payload, ['teachers', 'users']).map(normalizeTeacherRecord)
}

export async function updateTeacherStatus(userId, status, token) {
  return request(`/api/auth/teachers/${userId}/status`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ status }),
  })
}

export const fetchTeachers = getTeacherAccounts

export async function getManualStudents() {
  const payload = await request('/api/import/manual-students')
  return extractCollection(payload, ['students', 'manualStudents', 'records']).map(
    normalizeStudentRecord,
  )
}

export async function createManualStudent(studentPayload) {
  return request('/api/import/manual-students', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(studentPayload),
  })
}

export async function updateManualStudent(studentId, studentPayload) {
  return request(`/api/import/manual-students/${studentId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(studentPayload),
  })
}

export async function previewSf1(file) {
  const formData = new FormData()
  formData.append('file', file)

  const payload = await request('/api/import/sf1/preview', {
    method: 'POST',
    body: formData,
  })

  const source = extractObject(payload)
  const previewRows = extractCollection(source, ['previewRows', 'rows', 'records', 'students']).map(
    normalizePreviewRow,
  )

  return {
    detectedSchoolYear:
      source.detectedSchoolYear ??
      source.schoolYear ??
      source.academicYear ??
      source.detectedAcademicYear ??
      '',
    detectedSectionName:
      source.detectedSectionName ??
      source.sectionName ??
      source.section ??
      source.detectedSection ??
      '',
    totalRows: source.totalRows ?? source.total ?? previewRows.length ?? 0,
    validRows: source.validRows ?? source.valid ?? 0,
    invalidRows: source.invalidRows ?? source.invalid ?? 0,
    rows: previewRows,
  }
}

export async function confirmSf1(file) {
  const formData = new FormData()
  formData.append('file', file)

  const payload = await request('/api/import/sf1/confirm', {
    method: 'POST',
    body: formData,
  })

  const source = extractObject(payload)

  return {
    detectedSchoolYear:
      source.detectedSchoolYear ??
      source.schoolYear ??
      source.academicYear ??
      source.detectedAcademicYear ??
      '',
    detectedSectionName:
      source.detectedSectionName ??
      source.sectionName ??
      source.section ??
      source.detectedSection ??
      '',
    importedStudents: source.importedStudents ?? source.imported ?? 0,
    updatedStudents: source.updatedStudents ?? source.updated ?? 0,
    enrolledStudents: source.enrolledStudents ?? source.enrolled ?? 0,
    skippedRows: source.skippedRows ?? source.skipped ?? 0,
  }
}

export async function getSections() {
  const payload = await request('/api/school-setup/sections')
  return extractCollection(payload, ['sections', 'data', 'records']).map(normalizeSectionRecord)
}

export async function getGradeLevels() {
  const payload = await request('/api/school-setup/grade-levels')
  return extractCollection(payload, ['gradeLevels', 'data', 'records']).map(
    normalizeGradeLevelRecord,
  )
}

export async function getTeachers() {
  const payload = await request('/api/school-setup/teachers')
  return extractCollection(payload, ['teachers', 'data', 'records']).map(normalizeSchoolTeacherRecord)
}

export async function getSubjects() {
  const payload = await request('/api/school-setup/subjects')
  return extractCollection(payload, ['subjects', 'data', 'records']).map(normalizeSubjectRecord)
}

export async function getClassAssignments() {
  const payload = await request('/api/school-setup/class-assignments')
  return extractCollection(payload, ['classAssignments', 'assignments', 'data', 'records']).map(
    normalizeClassAssignmentRecord,
  )
}

export async function createClassAssignment(assignmentPayload) {
  return request('/api/school-setup/class-assignments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(assignmentPayload),
  })
}

export async function getTeacherAssessments(teacherId) {
  const payload = await request(`/api/assessments/teacher/${teacherId}`)
  return extractCollection(payload, ['assessments', 'tests', 'data', 'records']).map(
    normalizeAssessmentRecord,
  )
}

export async function getAssessmentDetails(testId) {
  const payload = await request(`/api/assessments/${testId}`)
  const source = extractObject(payload)

  return {
    assessment: normalizeAssessmentRecord(source),
    parts: extractCollection(source, ['parts', 'testParts', 'items']).map(
      normalizeAssessmentPartRecord,
    ),
  }
}

export async function getCompetenciesForClass(classId) {
  const payload = await request(`/api/assessments/classes/${classId}/competencies`)
  return extractCollection(payload, ['competencies', 'data', 'records']).map(
    normalizeCompetencyRecord,
  )
}

export async function getCompetencyTree(gradeLevelId, subjectId) {
  const params = new URLSearchParams()

  if (gradeLevelId) {
    params.set('gradeLevelId', gradeLevelId)
  }

  if (subjectId) {
    params.set('subjectId', subjectId)
  }

  const query = params.toString()
  const payload = await request(`/api/competencies/tree${query ? `?${query}` : ''}`)
  return extractCollection(payload, ['competencies', 'data', 'records']).map(
    normalizeCompetencyTreeRecord,
  )
}

export async function createAssessment(assessmentPayload) {
  return request('/api/assessments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(assessmentPayload),
  })
}

export async function createTestPart(testId, testPartPayload) {
  return request(`/api/assessments/${testId}/parts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(testPartPayload),
  })
}

export async function previewPartSkillMappings(mappingPayload) {
  const payload = await request('/api/part-skill-mappings/preview', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(mappingPayload),
  })

  return extractObject(payload)
}

export async function savePartSkillMappings(mappingPayload) {
  const payload = await request('/api/part-skill-mappings/save', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(mappingPayload),
  })

  return extractObject(payload)
}

export async function getPartSkillMappings(testPartId) {
  const payload = await request(`/api/part-skill-mappings/test-parts/${testPartId}`)
  return extractCollection(payload, ['mappings', 'data', 'records']).map(
    normalizePartSkillMappingRecord,
  )
}

export async function getItemAnalysis(testId) {
  const payload = await request(`/api/analytics/item-analysis?testId=${testId}`)
  return extractCollection(payload, ['items', 'itemAnalysis', 'data', 'records']).map(
    normalizeItemAnalysisRecord,
  )
}

export async function getLms(testId) {
  const payload = await request(`/api/analytics/lms?testId=${testId}`)
  return extractCollection(payload, ['lms', 'skills', 'data', 'records']).map(normalizeLmsRecord)
}

export async function getIntervention(testId, competencyId, testPartId = '') {
  const params = new URLSearchParams({
    testId: String(testId),
    competencyId: String(competencyId),
  })

  if (testPartId) {
    params.set('testPartId', String(testPartId))
  }

  const payload = await request(`/api/analytics/intervention?${params.toString()}`)
  return extractCollection(payload, ['interventions', 'recommendations', 'data', 'records']).map(
    normalizeInterventionRecord,
  )
}

export async function getTeacherInterventions(testId) {
  const payload = await request(`/api/analytics/teacher-interventions?testId=${testId}`)
  const source = extractObject(payload)
  const records = extractCollection(payload, [
    'teacherInterventions',
    'interventions',
    'recommendations',
    'data',
    'records',
  ])

  if (records.length) {
    return records.map(normalizeTeacherInterventionRecord)
  }

  if (source.competencyId || source.competencyName || source.recommendation) {
    return [normalizeTeacherInterventionRecord(source)]
  }

  return []
}

export async function getLmsAffectedStudents(testId) {
  const payload = await request(`/api/analytics/lms-affected-students?testId=${testId}`)
  return extractCollection(payload, ['students', 'affectedStudents', 'data', 'records']).map(
    normalizeAffectedStudentRecord,
  )
}

export async function getSchoolLms(filters = {}) {
  const params = new URLSearchParams()

  if (filters.gradeLevelId) {
    params.set('gradeLevelId', filters.gradeLevelId)
  }

  if (filters.sectionId) {
    params.set('sectionId', filters.sectionId)
  }

  if (filters.subjectId) {
    params.set('subjectId', filters.subjectId)
  }

  if (filters.teacherId) {
    params.set('teacherId', filters.teacherId)
  }

  const query = params.toString()
  const payload = await request(`/api/analytics/school-lms${query ? `?${query}` : ''}`)
  return extractCollection(payload, ['lms', 'skills', 'data', 'records']).map(normalizeLmsRecord)
}

export async function getStudentSkillMastery(studentId, classId) {
  const params = new URLSearchParams()
  params.set('studentId', studentId)
  params.set('classId', classId)

  const payload = await request(`/api/analytics/student-skill-mastery?${params.toString()}`)
  return extractCollection(payload, ['skills', 'skillMastery', 'mastery', 'data', 'records']).map(
    normalizeStudentSkillMasteryRecord,
  )
}

export async function getTrends(classId) {
  const payload = await request(`/api/analytics/trends?classId=${classId}`)
  return extractCollection(payload, ['trends', 'data', 'records']).map(normalizeTrendRecord)
}

export async function getSyncActivity(teacherId) {
  const payload = await request(`/api/analytics/sync-activity?teacherId=${teacherId}`)
  return extractCollection(payload, ['activities', 'syncActivity', 'data', 'records']).map(
    normalizeSyncActivityRecord,
  )
}

export async function downloadItemAnalysisReport(testId) {
  return requestFileDownload(
    `/api/export/item-analysis/${testId}`,
    `item-analysis-test-${testId}.xlsx`,
  )
}

export async function downloadLmsReport(testId) {
  return requestFileDownload(`/api/export/lms/${testId}`, `lms-report-test-${testId}.xlsx`)
}

export async function downloadStudentScoresReport(testId) {
  return requestFileDownload(
    `/api/export/student-scores/${testId}`,
    `student-scores-test-${testId}.xlsx`,
  )
}

export { API_BASE_URL }

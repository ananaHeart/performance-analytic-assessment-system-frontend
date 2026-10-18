const sameId = (left, right) => left != null && right != null && String(left) === String(right)
const active = (value) => String(value ?? '').toLowerCase() === 'active'

// academicYearId lets the Reports page follow its school-year filter; the dashboard uses the active year.
export function getStudentSupportContext(reference, teacherUserId, now = Date.now(), academicYearId = null) {
  const year = academicYearId
    ? reference.academicYears.find((item) => sameId(item.academicYearId, academicYearId))
    : reference.academicYears.find((item) => active(item.status))
  const assignments = reference.classAssignments.filter((item) =>
    sameId(item.teacherUserId, teacherUserId) &&
    sameId(item.academicYearId, year?.academicYearId) && active(item.status),
  )
  const terms = reference.termPeriods
    .filter((item) => sameId(item.academicYearId, year?.academicYearId))
    .slice().sort((a, b) => Number(a.termOrder) - Number(b.termOrder))
  const initialTerm = terms.find((term) => active(term.status) &&
    Date.parse(term.startAt) <= now && now < Date.parse(term.endAt)) ??
    terms.find((term) => active(term.status)) ?? terms[0]

  // One request per grade/subject, not per student or assessment. The API enforces ownership.
  const grouped = new Map()
  for (const assignment of assignments) {
    if (!assignment.gradeLevelId || !assignment.subjectId) continue
    const key = `${assignment.gradeLevelId}:${assignment.subjectId}`
    if (!grouped.has(key)) grouped.set(key, {
      key,
      academicYearId: year.academicYearId,
      gradeLevelId: assignment.gradeLevelId,
      subjectId: assignment.subjectId,
      gradeLevelName: assignment.gradeLevelName,
      subjectName: assignment.subjectName,
      classIds: new Set(),
      studentIds: new Set(),
    })
    grouped.get(key).classIds.add(String(assignment.classId))
  }
  for (const scope of grouped.values()) {
    for (const student of reference.students) {
      if (scope.classIds.has(String(student.classId)) && student.enrollmentStatus === 'enrolled') {
        scope.studentIds.add(String(student.studentId))
      }
    }
  }
  return { year, terms, initialTerm, scopes: [...grouped.values()] }
}

// Reads GET /api/v3/reports/students-needing-support. The backend picks the learners (its
// learning-competency weak-student lists), sorts them weakest first and computes every number;
// this only checks the shape and keeps the values exactly as sent (a null mastery stays null).
export function readStudentSupportReport(data, termPeriodId) {
  if (
    !data ||
    !['available', 'empty'].includes(data.dataStatus) ||
    !Array.isArray(data.students) ||
    !data.students.every((student) => student && Array.isArray(student.competencies)) ||
    (termPeriodId != null && !sameId(data.termPeriodId, termPeriodId))
  ) {
    throw new Error('Student-support report data is unavailable.')
  }

  const rows = data.students.map((student) => ({
    ...student,
    studentId: String(student.studentId),
    competencies: student.competencies.map((competency) => ({
      ...competency,
      filters: getCompetencyFilters(data, competency),
    })),
  }))

  return {
    rows,
    dataStatus: data.dataStatus,
    termName: data.termName ?? null,
    generatedAt: data.generatedAt ?? null,
    warnings: [...new Set((data.warnings ?? []).map((warning) => warning?.message).filter(Boolean))],
  }
}

// A competency can open the Learning Competency report only when the backend sends its IDs.
function getCompetencyFilters(data, competency) {
  const { gradeLevelId, subjectId, rootTagId, skillId } = competency
  if ([gradeLevelId, subjectId, rootTagId, skillId].some((value) => value == null || value === '')) return null
  return {
    reportType: 'learning_competency',
    termPeriodId: data.termPeriodId,
    gradeLevelId,
    subjectId,
    rootTagId,
    skillId,
  }
}

const sameId = (left, right) => left != null && right != null && String(left) === String(right)
const active = (value) => String(value ?? '').toLowerCase() === 'active'

export function getStudentSupportContext(reference, teacherUserId, now = Date.now()) {
  const year = reference.academicYears.find((item) => active(item.status))
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

export async function loadStudentSupportReports(scopes, termPeriodId, fetchReport, isCurrent = () => true) {
  const results = []
  // Bound dashboard traffic when a teacher handles many grade/subject combinations.
  for (let offset = 0; offset < scopes.length && isCurrent(); offset += 3) {
    const batch = scopes.slice(offset, offset + 3)
    const settled = await Promise.allSettled(batch.map(async (scope) => {
      const data = await fetchReport({
        termPeriodId, gradeLevelId: scope.gradeLevelId, subjectId: scope.subjectId,
      })
      if (!['available', 'empty', 'partial'].includes(data?.dataStatus) ||
          !Array.isArray(data.rootCompetencies) ||
          !data.rootCompetencies.every((root) => Array.isArray(root?.skills) &&
            root.skills.every((skill) => Array.isArray(skill?.weakStudents))) ||
          !sameId(data.scope?.termPeriodId, termPeriodId) ||
          !sameId(data.scope?.academicYearId, scope.academicYearId) ||
          !sameId(data.scope?.gradeLevelId, scope.gradeLevelId) ||
          !sameId(data.scope?.subjectId, scope.subjectId)) {
        throw new Error('Student-support report data is unavailable for this scope.')
      }
      return { scope, data }
    }))
    results.push(...settled)
    if (settled.some((result) => result.status === 'rejected' && result.reason?.isAuthenticationFailure)) break
  }
  return results
}

export function summarizeStudentSupport(results) {
  const students = new Map()
  const warnings = new Set()
  let failedScopes = 0
  let emptyScopes = 0
  let availableScopes = 0
  let incomplete = false

  for (const result of results) {
    if (result.status === 'rejected') {
      failedScopes += 1
      continue
    }
    const { scope, data } = result.value
    if (data.dataStatus === 'empty') emptyScopes += 1
    else availableScopes += 1
    if (data.dataStatus === 'partial') incomplete = true
    for (const warning of data.warnings ?? []) {
      if (warning.message) warnings.add(warning.message)
    }
    if (data.dataStatus === 'empty') continue
    for (const root of data.rootCompetencies) {
      for (const skill of root.skills ?? []) {
        for (const student of skill.weakStudents ?? []) {
          if (!scope.studentIds.has(String(student.studentId))) continue
          const value = student.masteryPercentage
          if (value == null || String(value).trim() === '' || typeof value === 'boolean' ||
              !Number.isFinite(Number(value)) || !skill.skillId || !root.rootTagId) {
            incomplete = true
            continue
          }
          const concern = {
            ...student,
            competencyName: skill.competencyName || 'Competency name unavailable',
            gradeLevelName: scope.gradeLevelName,
            subjectName: scope.subjectName,
            filters: {
              reportType: 'learning_competency',
              academicYearId: scope.academicYearId,
              termPeriodId: data.scope.termPeriodId,
              gradeLevelId: scope.gradeLevelId,
              subjectId: scope.subjectId,
              rootTagId: root.rootTagId,
              skillId: skill.skillId,
            },
          }
          const id = String(student.studentId)
          if (!students.has(id)) students.set(id, { studentId: id, concerns: new Map() })
          const concerns = students.get(id).concerns
          const key = `${scope.key}:${skill.skillId}`
          const existing = concerns.get(key)
          if (!existing || Number(value) < Number(existing.masteryPercentage)) concerns.set(key, concern)
        }
      }
    }
  }

  const rows = [...students.values()].map(({ studentId, concerns }) => {
    const ordered = [...concerns.values()].sort((a, b) =>
      Number(a.masteryPercentage) - Number(b.masteryPercentage) ||
      a.competencyName.localeCompare(b.competencyName),
    )
    return { ...ordered[0], studentId, concernCount: ordered.length }
  }).sort((a, b) => Number(a.masteryPercentage) - Number(b.masteryPercentage) ||
    String(a.fullName ?? '').localeCompare(String(b.fullName ?? '')) || a.studentId.localeCompare(b.studentId))

  return { rows, failedScopes, emptyScopes, availableScopes, incomplete, warnings: [...warnings] }
}

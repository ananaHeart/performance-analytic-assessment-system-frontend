import assert from 'node:assert/strict'
import test from 'node:test'
import { getStudentSupportContext, loadStudentSupportReports, summarizeStudentSupport } from './studentSupport.js'

const assignment = {
  classAssignmentId: 1, teacherUserId: 9, academicYearId: 2, status: 'active',
  gradeLevelId: 7, subjectId: 3, classId: 10, gradeLevelName: 'Grade 7', subjectName: 'English',
}
const reference = {
  academicYears: [{ academicYearId: 1, status: 'closed' }, { academicYearId: 2, status: 'active' }],
  termPeriods: [
    { academicYearId: 2, termPeriodId: 22, termOrder: 2, status: 'active', startAt: '2026-09-01T00:00:00Z', endAt: '2026-12-01T00:00:00Z' },
    { academicYearId: 2, termPeriodId: 21, termOrder: 1, status: 'active', startAt: '2026-06-01T00:00:00Z', endAt: '2026-09-01T00:00:00Z' },
    { academicYearId: 1, termPeriodId: 11, termOrder: 1, status: 'active' },
  ],
  classAssignments: [
    assignment,
    { ...assignment, classAssignmentId: 2, classId: 11 },
    { ...assignment, classAssignmentId: 3, subjectId: 4, subjectName: 'Science' },
    { ...assignment, classAssignmentId: 4, classId: 12, teacherUserId: 8 },
    { ...assignment, classAssignmentId: 5, classId: 13, status: 'archived' },
    { ...assignment, classAssignmentId: 6, classId: 14, academicYearId: 1 },
  ],
  students: [
    { studentId: 1, classId: 10, enrollmentStatus: 'enrolled' },
    { studentId: 2, classId: 11, enrollmentStatus: 'enrolled' },
    { studentId: 3, classId: 12, enrollmentStatus: 'enrolled' },
    { studentId: 4, classId: 13, enrollmentStatus: 'enrolled' },
    { studentId: 5, classId: 10, enrollmentStatus: 'withdrawn' },
    { studentId: 6, classId: 14, enrollmentStatus: 'enrolled' },
  ],
}
const context = () => getStudentSupportContext(reference, '9', Date.parse('2026-10-07T00:00:00Z'))
const student = (studentId, masteryPercentage = 40) => ({
  studentId, fullName: `Student ${studentId}`, sectionName: 'Sample', masteryPercentage,
  masteryStatusCode: 'needs_support', recommendationLabel: 'Targeted practice', assessmentCount: 2,
})
const report = (scope, learners = [student(1)]) => ({
  scope: { academicYearId: 2, termPeriodId: 22, gradeLevelId: scope.gradeLevelId, subjectId: scope.subjectId },
  dataStatus: 'available', warnings: [],
  rootCompetencies: [{ rootTagId: 100, skills: [{
    skillId: 101, competencyName: 'Reading comprehension', weakStudents: learners,
  }] }],
})
const fulfilled = (scope, data) => ({ status: 'fulfilled', value: { scope, data } })

test('uses the active year, dated current term and only this teacher\'s active assignments', () => {
  const data = context()
  assert.equal(data.year.academicYearId, 2)
  assert.equal(data.initialTerm.termPeriodId, 22)
  assert.deepEqual(data.terms.map((term) => term.termPeriodId), [21, 22])
  assert.equal(data.scopes.length, 2)
  assert.deepEqual([...data.scopes[0].classIds], ['10', '11'])
  assert.deepEqual([...data.scopes[0].studentIds], ['1', '2'])
  assert.deepEqual([...data.scopes[1].studentIds], ['1'])
})

test('fails closed without an active academic year or an authenticated teacher ID', () => {
  assert.equal(getStudentSupportContext({ ...reference, academicYears: [] }, 9).scopes.length, 0)
  assert.equal(getStudentSupportContext(reference, undefined).scopes.length, 0)
})

test('keeps legacy undated active-term selection deterministic', () => {
  const terms = reference.termPeriods.map((term) => ({ ...term, startAt: null, endAt: null }))
  assert.equal(getStudentSupportContext({ ...reference, termPeriods: terms }, 9).initialTerm.termPeriodId, 21)
})

test('counts each student once across subjects and competencies without calculating new scores', () => {
  const [english, science] = context().scopes
  const englishReport = report(english, [student(1, 50), student(2, 30), student(3, 1), student(5, 0)])
  englishReport.rootCompetencies[0].skills.push({
    skillId: 102, competencyName: 'Inference', weakStudents: [student(1, 35)],
  })
  const result = summarizeStudentSupport([
    fulfilled(english, englishReport), fulfilled(science, report(science, [student(1, 20)])),
  ])
  assert.equal(result.rows.length, 2)
  assert.equal(result.rows[0].studentId, '1')
  assert.equal(result.rows[0].masteryPercentage, 20)
  assert.equal(result.rows[0].concernCount, 3)
  assert.equal(result.rows[0].recommendationLabel, 'Targeted practice')
  assert.deepEqual(result.rows[0].filters, {
    reportType: 'learning_competency', academicYearId: 2, termPeriodId: 22,
    gradeLevelId: 7, subjectId: 4, rootTagId: 100, skillId: 101,
  })
})

test('retains genuine zero and never turns null, blank or invalid mastery into zero', () => {
  const [scope] = context().scopes
  for (const invalid of [null, undefined, '', ' ', false, 'invalid', Infinity]) {
    const learner = { ...student(1), masteryPercentage: invalid }
    const result = summarizeStudentSupport([fulfilled(scope, report(scope, [learner, student(2, 0)]))])
    assert.deepEqual(result.rows.map((row) => row.studentId), ['2'])
    assert.equal(result.rows[0].masteryPercentage, 0)
    assert.equal(result.incomplete, true)
  }
})

test('uses the backend weak-student list rather than imposing a frontend mastery threshold', () => {
  const [scope] = context().scopes
  const result = summarizeStudentSupport([fulfilled(scope, report(scope, [student(1, '82.5')]))])
  assert.equal(result.rows[0].masteryPercentage, '82.5')
})

test('preserves missing recommendation fields and backend warning messages', () => {
  const [scope] = context().scopes
  const data = report(scope, [{ ...student(1), recommendationLabel: null, recommendationCode: null }])
  data.warnings = [{ message: 'Intervention rules are unavailable.' }]
  const result = summarizeStudentSupport([fulfilled(scope, data), fulfilled(scope, data)])
  assert.equal(result.rows[0].recommendationLabel, null)
  assert.equal(result.rows[0].concernCount, 1)
  assert.deepEqual(result.warnings, ['Intervention rules are unavailable.'])
})

test('distinguishes no finalized data, no students flagged, partial data and failed requests', () => {
  const [scope] = context().scopes
  const empty = { ...report(scope), dataStatus: 'empty', rootCompetencies: [] }
  const noResults = summarizeStudentSupport([fulfilled(scope, empty)])
  const noSupport = summarizeStudentSupport([fulfilled(scope, report(scope, []))])
  assert.equal(noResults.emptyScopes, 1)
  assert.equal(noResults.availableScopes, 0)
  assert.equal(noSupport.availableScopes, 1)
  assert.deepEqual(noSupport.rows, [])
  const partial = summarizeStudentSupport([
    fulfilled(scope, { ...report(scope), dataStatus: 'partial' }), { status: 'rejected', reason: new Error('503') },
  ])
  assert.equal(partial.failedScopes, 1)
  assert.equal(partial.incomplete, true)
  assert.equal(partial.rows.length, 1)
})

test('requests each unique scope with the selected term and bounded concurrency', async () => {
  const scopes = Array.from({ length: 8 }, (_, index) => ({ ...context().scopes[0], subjectId: index + 1 }))
  let running = 0
  let maximum = 0
  const requests = []
  const results = await loadStudentSupportReports(scopes, 22, async (filters) => {
    running += 1
    maximum = Math.max(maximum, running)
    requests.push(filters)
    await new Promise((resolve) => setTimeout(resolve, 1))
    running -= 1
    return report(filters)
  })
  assert.equal(results.length, 8)
  assert.ok(results.every((result) => result.status === 'fulfilled'))
  assert.equal(maximum, 3)
  assert.ok(requests.every((request) => request.termPeriodId === 22))
  assert.equal(new Set(requests.map((request) => request.subjectId)).size, 8)
})

test('rejects missing contracts, malformed rows and mismatched response scopes', async () => {
  const [scope] = context().scopes
  const good = report(scope)
  for (const invalid of [null, {}, { ...good, rootCompetencies: [{}] },
    { ...good, dataStatus: 'pending' }, { ...good, scope: { ...good.scope, termPeriodId: 21 } },
    { ...good, scope: { ...good.scope, subjectId: 999 } }]) {
    const [result] = await loadStudentSupportReports([scope], 22, async () => invalid)
    assert.equal(result.status, 'rejected')
  }
})

test('does not start additional batches after navigation, filter changes or authentication expiry', async () => {
  const scopes = Array(8).fill(context().scopes[0])
  let current = true
  let requests = 0
  const results = await loadStudentSupportReports(scopes, 22, async (filters) => {
    requests += 1
    current = false
    return report(filters)
  }, () => current)
  assert.equal(requests, 3)
  assert.equal(results.length, 3)
  requests = 0
  await loadStudentSupportReports(scopes, 22, async () => {
    requests += 1
    throw Object.assign(new Error('Expired'), { isAuthenticationFailure: true })
  })
  assert.equal(requests, 3)
})

test('follows a chosen school year when the Reports page passes one', () => {
  const data = getStudentSupportContext(reference, 9, Date.parse('2026-10-07T00:00:00Z'), 1)
  assert.equal(data.year.academicYearId, 1)
  assert.deepEqual(data.terms.map((term) => term.termPeriodId), [11])
  assert.deepEqual(data.scopes.map((scope) => [...scope.classIds]), [['14']])
  assert.equal(getStudentSupportContext(reference, 9, Date.now(), 99).scopes.length, 0)
})

test('keeps every concern per student, weakest first, for the full report', () => {
  const [english, science] = context().scopes
  const englishReport = report(english, [student(1, 50)])
  englishReport.rootCompetencies[0].skills.push({
    skillId: 102, competencyName: 'Inference', weakStudents: [student(1, 35)],
  })
  const result = summarizeStudentSupport([
    fulfilled(english, englishReport), fulfilled(science, report(science, [student(1, 20)])),
  ])
  assert.deepEqual(result.rows[0].concerns.map((concern) => [concern.subjectName, concern.competencyName, concern.masteryPercentage]), [
    ['Science', 'Reading comprehension', 20],
    ['English', 'Inference', 35],
    ['English', 'Reading comprehension', 50],
  ])
  assert.equal(result.rows[0].concernCount, result.rows[0].concerns.length)
})

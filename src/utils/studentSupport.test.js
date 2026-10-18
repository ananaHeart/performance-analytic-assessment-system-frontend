import assert from 'node:assert/strict'
import test from 'node:test'
import { getStudentSupportContext, readStudentSupportReport } from './studentSupport.js'

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

test("uses the active year, dated current term and only this teacher's active assignments", () => {
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

test('follows a chosen school year when the Reports page passes one', () => {
  const data = getStudentSupportContext(reference, 9, Date.parse('2026-10-07T00:00:00Z'), 1)
  assert.equal(data.year.academicYearId, 1)
  assert.deepEqual(data.terms.map((term) => term.termPeriodId), [11])
  assert.deepEqual(data.scopes.map((scope) => [...scope.classIds]), [['14']])
  assert.equal(getStudentSupportContext(reference, 9, Date.now(), 99).scopes.length, 0)
})

const competency = (overrides = {}) => ({
  subjectName: 'English', competencyName: 'Reading comprehension', masteryPercentage: 40,
  masteryStatusCode: 'needs_support', recommendationCode: 'RETEACH', recommendationLabel: 'Reteach',
  suggestion: 'Reteach with guided practice.', ...overrides,
})
const supportReport = (students, overrides = {}) => ({
  reportType: 'students_needing_support', termPeriodId: 22, termName: 'Term 2', academicYearName: '2026-2027',
  generatedAt: '2026-10-18T00:00:00Z', dataStatus: 'available', warnings: [], students, ...overrides,
})

test('keeps the backend order and values exactly as sent', () => {
  const data = supportReport([
    { studentId: 7, fullName: 'B', lowestMasteryPercentage: 20, competencies: [competency({ masteryPercentage: 20 }), competency({ masteryPercentage: 55 })] },
    { studentId: 3, fullName: 'A', lowestMasteryPercentage: '35.5', competencies: [competency({ masteryPercentage: '35.5' })] },
  ])
  const result = readStudentSupportReport(data, '22')
  assert.deepEqual(result.rows.map((row) => row.studentId), ['7', '3'])
  assert.deepEqual(result.rows[0].competencies.map((item) => item.masteryPercentage), [20, 55])
  assert.equal(result.rows[1].lowestMasteryPercentage, '35.5')
  assert.equal(result.termName, 'Term 2')
})

test('never turns a missing mastery into zero', () => {
  const result = readStudentSupportReport(supportReport([
    { studentId: 1, lowestMasteryPercentage: null, competencies: [competency({ masteryPercentage: null })] },
  ]), 22)
  assert.equal(result.rows[0].lowestMasteryPercentage, null)
  assert.equal(result.rows[0].competencies[0].masteryPercentage, null)
})

test('keeps empty results and unique backend warning messages', () => {
  const result = readStudentSupportReport(supportReport([], {
    dataStatus: 'empty', warnings: [{ code: 'A', message: 'Rules unavailable.' }, { code: 'B', message: 'Rules unavailable.' }, { code: 'C' }],
  }), 22)
  assert.deepEqual(result.rows, [])
  assert.equal(result.dataStatus, 'empty')
  assert.deepEqual(result.warnings, ['Rules unavailable.'])
})

test('rejects malformed data and a response for another term', () => {
  const good = supportReport([{ studentId: 1, competencies: [competency()] }])
  for (const invalid of [null, {}, { ...good, dataStatus: 'pending' }, { ...good, students: null },
    { ...good, students: [{ studentId: 1 }] }, { ...good, termPeriodId: 21 }]) {
    assert.throws(() => readStudentSupportReport(invalid, 22))
  }
})

test('builds a Learning Competency link only when the backend sends the IDs', () => {
  const withIds = competency({ gradeLevelId: 7, subjectId: 3, rootTagId: 100, skillId: 101 })
  const result = readStudentSupportReport(supportReport([{ studentId: 1, competencies: [withIds, competency()] }]), 22)
  assert.deepEqual(result.rows[0].competencies[0].filters, {
    reportType: 'learning_competency', termPeriodId: 22, gradeLevelId: 7, subjectId: 3, rootTagId: 100, skillId: 101,
  })
  assert.equal(result.rows[0].competencies[1].filters, null)
})

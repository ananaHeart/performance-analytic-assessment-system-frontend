import assert from 'node:assert/strict'
import test from 'node:test'
import {
  formatAcademicYearDate,
  formatTermDate,
  isThreeTermCalendar,
} from './academicCalendar.js'

const terms = [1, 2, 3].map((termOrder) => ({ termOrder, termName: `Term ${termOrder}` }))

test('recognizes a complete three-term layout independently of response order', () => {
  assert.equal(isThreeTermCalendar([terms[2], terms[0], terms[1]]), true)
})

test('never reinterprets incomplete or legacy Quarter calendars as a new layout', () => {
  assert.equal(isThreeTermCalendar(terms.slice(0, 2)), false)
  assert.equal(isThreeTermCalendar([terms[0], terms[0], terms[2]]), false)
  assert.equal(isThreeTermCalendar([terms[0], terms[1], null]), false)
  assert.equal(isThreeTermCalendar([1, 2, 3].map((termOrder) => ({ termOrder, termName: `Quarter ${termOrder}` }))), false)
  assert.equal(isThreeTermCalendar([...terms, { termOrder: 4, termName: 'Fourth Quarter' }]), false)
})

test('keeps academic-year date-only values on their original dates', () => {
  assert.equal(formatAcademicYearDate('2026-06-08'), 'Jun 8, 2026')
  assert.equal(formatAcademicYearDate('2027-04-08'), 'Apr 8, 2027')
})

test('displays Term 2 in Manila with the inclusive last day of its half-open range', () => {
  assert.equal(formatTermDate('2026-09-15T16:00:00Z', { threeTermCalendar: true }), 'Sep 16, 2026')
  assert.equal(formatTermDate('2026-12-18T16:00:00Z', { threeTermCalendar: true, exclusiveEnd: true }), 'Dec 18, 2026')
})

test('displays adjacent boundaries and Term 3 without shifting either end date', () => {
  assert.equal(formatTermDate('2026-09-15T16:00:00Z', { threeTermCalendar: true, exclusiveEnd: true }), 'Sep 15, 2026')
  assert.equal(formatTermDate('2027-01-03T16:00:00Z', { threeTermCalendar: true }), 'Jan 4, 2027')
  assert.equal(formatTermDate('2027-04-08T16:00:00Z', { threeTermCalendar: true, exclusiveEnd: true }), 'Apr 8, 2027')
})

test('preserves existing Quarter timestamp display without subtracting an end day', () => {
  assert.equal(formatTermDate('2025-06-01T00:00:00Z'), 'Jun 1, 2025')
  assert.equal(formatTermDate('2026-03-01T00:00:00Z', { exclusiveEnd: true }), 'Mar 1, 2026')
  assert.equal(formatTermDate('2026-09-15T16:00:00Z'), 'Sep 15, 2026')
})

test('does not subtract from date-only fields even when formatting a term end', () => {
  assert.equal(formatTermDate('2026-12-18', { threeTermCalendar: true, exclusiveEnd: true }), 'Dec 18, 2026')
})

test('retains the missing and invalid date fallback', () => {
  assert.equal(formatAcademicYearDate(null), 'Not set')
  assert.equal(formatTermDate(''), 'Not set')
  assert.equal(formatTermDate('unavailable', { threeTermCalendar: true }), 'unavailable')
})

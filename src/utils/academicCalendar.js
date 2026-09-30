const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/
const DATE_FORMAT = { month: 'short', day: 'numeric', year: 'numeric' }

function formatDate(value, timeZone, exclusiveEnd = false) {
  if (!value) return 'Not set'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)

  // Date-only fields identify a calendar day, not an instant in a user's time zone.
  const dateOnly = DATE_ONLY.test(String(value))
  if (exclusiveEnd && !dateOnly) date.setTime(date.getTime() - 1)

  return new Intl.DateTimeFormat('en-US', {
    ...DATE_FORMAT,
    timeZone: dateOnly ? 'UTC' : timeZone,
  }).format(date)
}

export function formatAcademicYearDate(value) {
  return formatDate(value, 'UTC')
}

export function isThreeTermCalendar(termPeriods = []) {
  if (termPeriods.length !== 3) return false

  return [1, 2, 3].every((order) =>
    termPeriods.some((term) => Number(term?.termOrder) === order && term?.termName === `Term ${order}`),
  )
}

export function formatTermDate(value, { threeTermCalendar = false, exclusiveEnd = false } = {}) {
  // Retain the historical UTC display for existing Quarter calendars.
  return formatDate(value, threeTermCalendar ? 'Asia/Manila' : 'UTC', threeTermCalendar && exclusiveEnd)
}

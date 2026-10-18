// Assessment creation rules dialog: remembered per teacher once they tick "Don't show this again".
const STORAGE_PREFIX = 'marka-assessment-rules-dismissed:'

const storageKey = (userId) => `${STORAGE_PREFIX}${userId ?? 'unknown'}`

export function hasDismissedAssessmentRules(userId) {
  try {
    return localStorage.getItem(storageKey(userId)) === 'true'
  } catch {
    return false
  }
}

export function dismissAssessmentRules(userId) {
  try {
    localStorage.setItem(storageKey(userId), 'true')
  } catch {
    // Storage can be blocked; the dialog then shows again next time, which is safe.
  }
}

// A datetime-local value ("YYYY-MM-DDTHH:mm") earlier than the current minute.
export function isPastDateTime(value, now = Date.now()) {
  if (!value) return false
  const time = new Date(value).getTime()
  if (!Number.isFinite(time)) return false
  const currentMinute = Math.floor(now / 60000) * 60000
  return time < currentMinute
}

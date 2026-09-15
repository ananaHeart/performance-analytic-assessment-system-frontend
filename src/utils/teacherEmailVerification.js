const TEACHER_VERIFICATION_SESSION_KEY = 'teacher-email-verification'

export const TEACHER_VERIFICATION_RESEND_COOLDOWN_MS = 60_000

function normalizeVerificationSession(value) {
  if (!value || typeof value !== 'object') return null

  const email = typeof value.email === 'string' ? value.email.trim() : ''
  const challengeUuid =
    typeof value.challengeUuid === 'string' ? value.challengeUuid.trim() : ''

  if (!email && !challengeUuid) return null

  return {
    email,
    emailMasked: typeof value.emailMasked === 'string' ? value.emailMasked : '',
    challengeUuid,
    verificationMethod:
      typeof value.verificationMethod === 'string' ? value.verificationMethod : 'email',
    deliveryStatus: typeof value.deliveryStatus === 'string' ? value.deliveryStatus : '',
    otpExpiresAt: typeof value.otpExpiresAt === 'string' ? value.otpExpiresAt : '',
    resendAvailableAt:
      typeof value.resendAvailableAt === 'string' ? value.resendAvailableAt : '',
    registrationExpiresAt:
      typeof value.registrationExpiresAt === 'string' ? value.registrationExpiresAt : '',
    resendCooldownSeconds: Number(value.resendCooldownSeconds) || 60,
    maximumAttempts: Number(value.maximumAttempts) || 5,
  }
}

export function readTeacherVerificationSession() {
  if (typeof window === 'undefined') return null

  const storedValue = window.sessionStorage.getItem(TEACHER_VERIFICATION_SESSION_KEY) ?? ''

  if (!storedValue) return null

  if (!storedValue.startsWith('{')) {
    return normalizeVerificationSession({ email: storedValue })
  }

  try {
    return normalizeVerificationSession(JSON.parse(storedValue))
  } catch {
    window.sessionStorage.removeItem(TEACHER_VERIFICATION_SESSION_KEY)
    return null
  }
}

export function readTeacherVerificationEmail() {
  return readTeacherVerificationSession()?.email ?? ''
}

export function storeTeacherVerificationSession(session) {
  if (typeof window === 'undefined') return null

  const normalized = normalizeVerificationSession(
    typeof session === 'string' ? { email: session } : session,
  )

  if (!normalized) {
    window.sessionStorage.removeItem(TEACHER_VERIFICATION_SESSION_KEY)
    return null
  }

  window.sessionStorage.setItem(
    TEACHER_VERIFICATION_SESSION_KEY,
    JSON.stringify(normalized),
  )
  return normalized
}

export function clearTeacherVerificationSession() {
  if (typeof window === 'undefined') return
  window.sessionStorage.removeItem(TEACHER_VERIFICATION_SESSION_KEY)
}

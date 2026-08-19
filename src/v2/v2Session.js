const V2_TOKEN_STORAGE_KEY = 'assessment-v2-token'
const V2_USER_STORAGE_KEY = 'assessment-v2-user'
const V2_EXPIRES_AT_STORAGE_KEY = 'assessment-v2-expires-at'
const V2_DEVICE_IDENTIFIER_STORAGE_KEY = 'assessment-v2-device-identifier'

export function getV2DeviceIdentifier() {
  const storedIdentifier = localStorage.getItem(V2_DEVICE_IDENTIFIER_STORAGE_KEY)

  if (storedIdentifier) {
    return storedIdentifier
  }

  const host = window.location.hostname.replace(/[^a-z0-9.-]/gi, '-').slice(0, 40) || 'browser'
  const port = window.location.port || (window.location.protocol === 'https:' ? '443' : '80')
  const randomId = window.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`
  const identifier = `web-${host}-${port}-${randomId}`

  localStorage.setItem(V2_DEVICE_IDENTIFIER_STORAGE_KEY, identifier)
  return identifier
}

export function readV2Session() {
  const token = localStorage.getItem(V2_TOKEN_STORAGE_KEY)
  const storedUser = localStorage.getItem(V2_USER_STORAGE_KEY)

  if (!token || !storedUser) {
    return null
  }

  try {
    return {
      token,
      user: JSON.parse(storedUser),
      expiresAt: localStorage.getItem(V2_EXPIRES_AT_STORAGE_KEY) ?? '',
    }
  } catch {
    clearV2Session()
    return null
  }
}

export function storeV2Session(session) {
  localStorage.setItem(V2_TOKEN_STORAGE_KEY, session.token)
  localStorage.setItem(V2_USER_STORAGE_KEY, JSON.stringify(session.user))
  localStorage.setItem(V2_EXPIRES_AT_STORAGE_KEY, session.expiresAt ?? '')
}

export function clearV2Session() {
  localStorage.removeItem(V2_TOKEN_STORAGE_KEY)
  localStorage.removeItem(V2_USER_STORAGE_KEY)
  localStorage.removeItem(V2_EXPIRES_AT_STORAGE_KEY)
}

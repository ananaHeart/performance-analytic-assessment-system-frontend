import { useCallback, useEffect, useRef, useState } from 'react'
import { Clock3 } from 'lucide-react'
import { touchSessionV3 } from '../api/apiV3Client'

const DEFAULT_IDLE_TIMEOUT_SECONDS = 300
const WARNING_SECONDS = 60
const TOUCH_THROTTLE_MS = 60_000
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'touchstart', 'wheel']

function normalizeTimeoutSeconds(value) {
  const timeout = Number(value)
  return Number.isFinite(timeout) && timeout > 0 ? timeout : DEFAULT_IDLE_TIMEOUT_SECONDS
}

function SessionTimeoutGuard({ token, timeoutSeconds, onExpired }) {
  const normalizedTimeout = normalizeTimeoutSeconds(timeoutSeconds)
  const deadlineRef = useRef(0)
  const lastTouchAtRef = useRef(0)
  const touchInFlightRef = useRef(false)
  const [secondsRemaining, setSecondsRemaining] = useState(normalizedTimeout)
  const [touchError, setTouchError] = useState('')

  const resetDeadline = useCallback((nextTimeoutSeconds) => {
    const nextTimeout = normalizeTimeoutSeconds(nextTimeoutSeconds)
    deadlineRef.current = Date.now() + nextTimeout * 1000
    setSecondsRemaining(nextTimeout)
    setTouchError('')
  }, [])

  const touchSession = useCallback(
    async ({ force = false } = {}) => {
      const now = Date.now()
      if (
        !token ||
        touchInFlightRef.current ||
        (!force && now - lastTouchAtRef.current < TOUCH_THROTTLE_MS)
      ) {
        return
      }

      touchInFlightRef.current = true
      lastTouchAtRef.current = now

      try {
        const result = await touchSessionV3(token)
        resetDeadline(result.sessionIdleTimeoutSeconds ?? normalizedTimeout)
      } catch (error) {
        if (!error?.isAuthenticationFailure) {
          setTouchError('Unable to extend the session. Check your connection and try again.')
        }
      } finally {
        touchInFlightRef.current = false
      }
    },
    [normalizedTimeout, resetDeadline, token],
  )

  useEffect(() => {
    deadlineRef.current = Date.now() + normalizedTimeout * 1000
    lastTouchAtRef.current = Date.now()
  }, [normalizedTimeout, token])

  useEffect(() => {
    const handleActivity = () => {
      void touchSession()
    }

    ACTIVITY_EVENTS.forEach((eventName) => {
      window.addEventListener(eventName, handleActivity, { passive: true })
    })

    return () => {
      ACTIVITY_EVENTS.forEach((eventName) => {
        window.removeEventListener(eventName, handleActivity)
      })
    }
  }, [touchSession])

  useEffect(() => {
    const timer = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000))
      setSecondsRemaining(remaining)

      if (remaining === 0) {
        window.clearInterval(timer)
        onExpired?.()
      }
    }, 1000)

    return () => window.clearInterval(timer)
  }, [onExpired, token])

  if (secondsRemaining > WARNING_SECONDS) return null

  return (
    <div className="session-timeout-backdrop" role="presentation">
      <section
        className="session-timeout-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="sessionTimeoutTitle"
        aria-describedby="sessionTimeoutDescription"
      >
        <span className="session-timeout-icon" aria-hidden="true">
          <Clock3 size={23} strokeWidth={2.3} />
        </span>
        <div>
          <h2 id="sessionTimeoutTitle">Your session is about to expire</h2>
          <p id="sessionTimeoutDescription">
            You will be signed out in {secondsRemaining} second{secondsRemaining === 1 ? '' : 's'}
            due to inactivity.
          </p>
          {touchError ? <p className="session-timeout-error">{touchError}</p> : null}
        </div>
        <div className="session-timeout-actions">
          <button type="button" className="primary-button" onClick={() => touchSession({ force: true })}>
            Stay signed in
          </button>
        </div>
      </section>
    </div>
  )
}

export default SessionTimeoutGuard

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Archive,
  Bell,
  Check,
  CircleCheck,
  CircleX,
  ClipboardCheck,
  RefreshCw,
  RotateCcw,
  UserRoundCheck,
  X,
} from 'lucide-react'
import {
  getNotificationsV3,
  getNotificationUnreadCountV3,
  markAllNotificationsReadV3,
  markNotificationReadV3,
} from '../api/apiV3Client'

const REFRESH_INTERVAL_MS = 60_000

const NOTIFICATION_ICONS = {
  teacher_pending_approval: UserRoundCheck,
  teacher_account_approved: CircleCheck,
  teacher_account_rejected: CircleX,
  class_assignment_created: ClipboardCheck,
  class_assignment_archived: Archive,
  class_assignment_reactivated: RotateCcw,
}

function formatNotificationTime(createdAt) {
  if (!createdAt) return 'Time unavailable'

  const timestamp = new Date(createdAt)
  if (Number.isNaN(timestamp.getTime())) return String(createdAt)

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(timestamp)
}

function getNotificationErrorMessage(error, fallback) {
  if (error?.status === 403) {
    return 'Notifications are unavailable for this account.'
  }

  return error?.message || fallback
}

function NotificationCenter({ token, variant = 'principal' }) {
  const containerRef = useRef(null)
  const mountedRef = useRef(false)
  const isOpenRef = useRef(false)
  const [isOpen, setIsOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [updatingNotificationId, setUpdatingNotificationId] = useState(null)
  const [isMarkingAll, setIsMarkingAll] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const refreshUnreadCount = useCallback(async () => {
    if (!token) return

    try {
      const result = await getNotificationUnreadCountV3(token)
      if (mountedRef.current) {
        setUnreadCount(result.unreadCount)
      }
    } catch (loadError) {
      if (mountedRef.current) {
        setError(
          getNotificationErrorMessage(loadError, 'Unable to refresh the notification count.'),
        )
      }
    }
  }, [token])

  const refreshNotifications = useCallback(async () => {
    if (!token) return

    setIsLoading(true)
    setError('')

    try {
      const result = await getNotificationsV3(token, { unreadOnly: false, limit: 20 })
      if (mountedRef.current) {
        setNotifications(result.notifications)
        setUnreadCount(result.unreadCount)
      }
    } catch (loadError) {
      if (mountedRef.current) {
        setError(getNotificationErrorMessage(loadError, 'Unable to load notifications.'))
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false)
      }
    }
  }, [token])

  useEffect(() => {
    isOpenRef.current = isOpen
  }, [isOpen])

  useEffect(() => {
    const initialRefresh = window.setTimeout(() => {
      void refreshUnreadCount()
    }, 0)

    const handleWindowFocus = () => {
      if (isOpenRef.current) {
        void refreshNotifications()
      } else {
        void refreshUnreadCount()
      }
    }

    window.addEventListener('focus', handleWindowFocus)
    const refreshInterval = window.setInterval(handleWindowFocus, REFRESH_INTERVAL_MS)

    return () => {
      window.clearTimeout(initialRefresh)
      window.removeEventListener('focus', handleWindowFocus)
      window.clearInterval(refreshInterval)
    }
  }, [refreshNotifications, refreshUnreadCount, token])

  useEffect(() => {
    if (!isOpen) return undefined

    const handlePointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) {
        setIsOpen(false)
      }
    }
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  const handleMarkRead = async (notification) => {
    if (notification.isRead || updatingNotificationId !== null) return

    const notificationId = notification.notificationId
    setUpdatingNotificationId(notificationId)
    setError('')

    try {
      const result = await markNotificationReadV3(notificationId, token)
      if (mountedRef.current) {
        setNotifications((currentNotifications) =>
          currentNotifications.map((currentNotification) =>
            currentNotification.notificationId === notificationId
              ? { ...currentNotification, isRead: true, readAt: new Date().toISOString() }
              : currentNotification,
          ),
        )
        setUnreadCount(result.unreadCount)
      }
    } catch (updateError) {
      if (updateError?.status === 404) {
        await refreshNotifications()
        if (mountedRef.current) {
          setError('That notification is no longer available. The list was refreshed.')
        }
      } else if (mountedRef.current) {
        setError(getNotificationErrorMessage(updateError, 'Unable to mark the notification read.'))
      }
    } finally {
      if (mountedRef.current) {
        setUpdatingNotificationId(null)
      }
    }
  }

  const handleMarkAllRead = async () => {
    if (unreadCount === 0 || isMarkingAll || updatingNotificationId !== null) return

    setIsMarkingAll(true)
    setError('')

    try {
      const result = await markAllNotificationsReadV3(token)
      if (mountedRef.current) {
        setNotifications((currentNotifications) =>
          currentNotifications.map((notification) => ({
            ...notification,
            isRead: true,
            readAt: notification.readAt || new Date().toISOString(),
          })),
        )
        setUnreadCount(result.unreadCount)
      }
    } catch (updateError) {
      if (mountedRef.current) {
        setError(getNotificationErrorMessage(updateError, 'Unable to mark all notifications read.'))
      }
    } finally {
      if (mountedRef.current) {
        setIsMarkingAll(false)
      }
    }
  }

  const badgeLabel = unreadCount > 99 ? '99+' : String(unreadCount)

  const handleTogglePanel = () => {
    const nextIsOpen = !isOpen
    setIsOpen(nextIsOpen)

    if (nextIsOpen) {
      void refreshNotifications()
    }
  }

  return (
    <div className={`notification-center is-${variant}`} ref={containerRef}>
      <button
        type="button"
        className="notification-bell-button"
        aria-label={
          unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications, none unread'
        }
        aria-expanded={isOpen}
        aria-controls="notificationPanel"
        onClick={handleTogglePanel}
      >
        <Bell size={variant === 'teacher' ? 17 : 18} strokeWidth={2.2} aria-hidden="true" />
        {unreadCount > 0 ? (
          <span className="notification-count-badge" aria-hidden="true">
            {badgeLabel}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <section
          id="notificationPanel"
          className="notification-panel"
          aria-label="Notifications"
        >
          <header className="notification-panel-header">
            <div>
              <h2>Notifications</h2>
              <span>{unreadCount} unread</span>
            </div>
            <div className="notification-panel-actions">
              <button
                type="button"
                className="notification-mark-all-button"
                onClick={handleMarkAllRead}
                disabled={
                  unreadCount === 0 || isMarkingAll || updatingNotificationId !== null
                }
              >
                <Check size={15} strokeWidth={2.3} aria-hidden="true" />
                {isMarkingAll ? 'Updating...' : 'Mark all read'}
              </button>
              <button
                type="button"
                className="notification-icon-button"
                aria-label="Refresh notifications"
                title="Refresh notifications"
                onClick={refreshNotifications}
                disabled={isLoading}
              >
                <RefreshCw
                  size={16}
                  strokeWidth={2.2}
                  aria-hidden="true"
                  className={isLoading ? 'is-spinning' : ''}
                />
              </button>
              <button
                type="button"
                className="notification-icon-button"
                aria-label="Close notifications"
                title="Close notifications"
                onClick={() => setIsOpen(false)}
              >
                <X size={17} strokeWidth={2.2} aria-hidden="true" />
              </button>
            </div>
          </header>

          {error ? (
            <div className="notification-error" role="alert">
              <span>{error}</span>
              <button type="button" onClick={refreshNotifications} disabled={isLoading}>
                Retry
              </button>
            </div>
          ) : null}

          <div className="notification-panel-body" aria-live="polite">
            {isLoading && notifications.length === 0 ? (
              <div className="notification-empty-state">Loading notifications...</div>
            ) : null}

            {!isLoading && notifications.length === 0 ? (
              <div className="notification-empty-state">
                <Bell size={24} strokeWidth={1.8} aria-hidden="true" />
                <strong>No notifications yet</strong>
                <span>New account and class assignment updates will appear here.</span>
              </div>
            ) : null}

            {notifications.length > 0 ? (
              <ul className="notification-list">
                {notifications.map((notification) => {
                  const NotificationIcon =
                    NOTIFICATION_ICONS[notification.notificationType] ?? Bell
                  const isUpdating = updatingNotificationId === notification.notificationId

                  return (
                    <li
                      key={notification.notificationId}
                      className={`notification-item ${notification.isRead ? 'is-read' : 'is-unread'}`}
                    >
                      <span className="notification-type-icon" aria-hidden="true">
                        <NotificationIcon size={17} strokeWidth={2.1} />
                      </span>
                      <div className="notification-item-content">
                        <div className="notification-item-title-row">
                          <strong>{notification.title}</strong>
                          <span>{notification.isRead ? 'Read' : 'Unread'}</span>
                        </div>
                        <p>{notification.message}</p>
                        <div className="notification-item-footer">
                          <time dateTime={notification.createdAt}>
                            {formatNotificationTime(notification.createdAt)}
                          </time>
                          {!notification.isRead ? (
                            <button
                              type="button"
                              aria-label={`Mark ${notification.title} as read`}
                              title="Mark as read"
                              onClick={() => handleMarkRead(notification)}
                              disabled={isUpdating || isMarkingAll}
                            >
                              <Check size={14} strokeWidth={2.4} aria-hidden="true" />
                              {isUpdating ? 'Updating...' : 'Mark as read'}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  )
}

export default NotificationCenter

import { useEffect, useMemo, useState } from 'react'
import { getTeacherAccounts, updateTeacherStatus } from '../api/apiClient'

const TOKEN_STORAGE_KEY = 'assessment-token'

const teacherTabs = [
  { key: 'pending', label: 'Pending Request' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
]

function formatDate(dateValue) {
  if (!dateValue) {
    return 'Not provided'
  }

  const parsedDate = new Date(dateValue)

  if (Number.isNaN(parsedDate.getTime())) {
    return dateValue
  }

  return parsedDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatStatus(status) {
  if (!status) {
    return 'Pending'
  }

  return status
    .toString()
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

function getInitials(name) {
  return (
    name
      ?.split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase() || 'T'
  )
}

function getTeacherGroup(status) {
  const normalizedStatus = String(status || 'pending').toLowerCase()

  if (normalizedStatus === 'active' || normalizedStatus === 'approved') {
    return 'approved'
  }

  if (normalizedStatus === 'rejected') {
    return 'rejected'
  }

  return 'pending'
}

function TeacherApprovalPage({ token, user, onNavigate }) {
  const [teachers, setTeachers] = useState([])
  const [activeTab, setActiveTab] = useState('pending')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [activeUserId, setActiveUserId] = useState(null)
  const accessToken = localStorage.getItem(TOKEN_STORAGE_KEY) || token
  const hasPrincipalAccess = user?.role === 'principal'

  const groupedTeachers = useMemo(
    () => ({
      pending: teachers.filter((teacher) => getTeacherGroup(teacher.status) === 'pending'),
      approved: teachers.filter((teacher) => getTeacherGroup(teacher.status) === 'approved'),
      rejected: teachers.filter((teacher) => getTeacherGroup(teacher.status) === 'rejected'),
    }),
    [teachers],
  )

  const visibleTeachers = groupedTeachers[activeTab] ?? []

  const loadTeachers = async ({ preserveSuccess = false } = {}) => {
    if (!hasPrincipalAccess) {
      setTeachers([])
      setError('')
      setSuccess('')
      setIsLoading(false)
      return
    }

    if (!accessToken) {
      setTeachers([])
      setSuccess('')
      setError('Authorization token is required.')
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError('')

    if (!preserveSuccess) {
      setSuccess('')
    }

    try {
      const teacherList = await getTeacherAccounts(accessToken)
      setTeachers(teacherList)
    } catch (loadError) {
      setError(loadError.message || 'Unable to load teachers.')
    } finally {
      setIsLoading(false)
    }
  }

  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  useEffect(() => {
    loadTeachers()
  }, [hasPrincipalAccess, accessToken])
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  const handleStatusUpdate = async (userId, status) => {
    if (!accessToken) {
      setError('Authorization token is required.')
      return
    }

    setActiveUserId(userId)
    setError('')
    setSuccess('')

    try {
      await updateTeacherStatus(userId, status, accessToken)
      await loadTeachers({ preserveSuccess: true })
      setSuccess(`Teacher account ${status} successfully.`)
      setActiveTab(status === 'active' ? 'approved' : 'rejected')
    } catch (updateError) {
      setError(updateError.message || 'Unable to update teacher status.')
    } finally {
      setActiveUserId(null)
    }
  }

  if (!hasPrincipalAccess) {
    return (
      <div className="content-stack">
        <section className="hero-panel">
          <p className="section-tag">Teacher Accounts</p>
          <h2>Principal access is required.</h2>
          <p className="supporting-text">
            Only principal accounts can review and update teacher approval status.
          </p>
        </section>
      </div>
    )
  }

  return (
    <div className="principal-teachers-page">
      <section className="principal-teachers-header">
        <h2>Teacher Accounts</h2>
        <p>Manage and monitor all educator access within the system.</p>
      </section>

      <div className="principal-teacher-tabs" role="tablist" aria-label="Teacher account status">
        {teacherTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.key}
            className={activeTab === tab.key ? 'is-active' : ''}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error ? <p className="form-message form-message-error">{error}</p> : null}
      {success ? <p className="form-message form-message-success">{success}</p> : null}

      <section className="principal-teachers-table-panel">
        <div className="principal-teachers-table-wrap">
          <table className="principal-teachers-table">
            <thead>
              <tr>
                <th>Teacher Name</th>
                <th>{activeTab === 'pending' ? 'Email' : 'Email Address'}</th>
                {activeTab === 'pending' ? <th>Date of Birth</th> : null}
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td className="principal-teachers-empty" colSpan={activeTab === 'pending' ? 5 : 4}>
                    Loading teacher accounts...
                  </td>
                </tr>
              ) : null}

              {!isLoading && !visibleTeachers.length ? (
                <tr>
                  <td className="principal-teachers-empty" colSpan={activeTab === 'pending' ? 5 : 4}>
                    No {teacherTabs.find((tab) => tab.key === activeTab)?.label.toLowerCase()}{' '}
                    teacher accounts found.
                  </td>
                </tr>
              ) : null}

              {!isLoading
                ? visibleTeachers.map((teacher) => {
                    const isUpdating = activeUserId === teacher.id

                    return (
                      <tr key={teacher.id ?? teacher.email}>
                        <td>
                          <div className="principal-teacher-name-cell">
                            <span aria-hidden="true">{getInitials(teacher.name)}</span>
                            <strong>{teacher.name || 'Teacher'}</strong>
                          </div>
                        </td>
                        <td>{teacher.email || 'No email provided'}</td>
                        {activeTab === 'pending' ? <td>{formatDate(teacher.dateOfBirth)}</td> : null}
                        <td>
                          <span
                            className={`principal-teacher-status status-${getTeacherGroup(
                              teacher.status,
                            )}`}
                          >
                            {formatStatus(teacher.status)}
                          </span>
                        </td>
                        <td>
                          {activeTab === 'pending' ? (
                            <div className="principal-teacher-actions">
                              <button
                                type="button"
                                className="principal-approve-button"
                                disabled={!teacher.id || isUpdating}
                                onClick={() => handleStatusUpdate(teacher.id, 'active')}
                              >
                                {isUpdating ? 'Updating...' : 'Approve'}
                              </button>
                              <button
                                type="button"
                                className="principal-reject-button"
                                disabled={!teacher.id || isUpdating}
                                onClick={() => handleStatusUpdate(teacher.id, 'rejected')}
                              >
                                Reject
                              </button>
                            </div>
                          ) : null}

                          {activeTab === 'approved' ? (
                            <button
                              type="button"
                              className="principal-manage-button"
                              onClick={() => onNavigate('teacher-class-assignment')}
                            >
                              Manage
                            </button>
                          ) : null}

                          {activeTab === 'rejected' ? (
                            <span className="principal-no-delete-note">No delete API</span>
                          ) : null}
                        </td>
                      </tr>
                    )
                  })
                : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

export default TeacherApprovalPage

import { useEffect, useMemo, useState } from 'react'
import {
  Check,
  Eye,
  Mail,
  Phone,
  RefreshCw,
  Search,
  X,
} from 'lucide-react'
import {
  approveTeacherV2,
  getTeacherAccountsV2,
  getTeacherReferenceDataV2,
  rejectTeacherV2,
} from '../api/apiV2Client'

const teacherTabs = [
  { key: 'pending', label: 'Pending' },
  { key: 'active', label: 'Active' },
  { key: 'rejected', label: 'Rejected' },
]

const emptyReferenceData = {
  genders: [],
  majors: [],
  educationalAttainments: [],
}

function formatDate(dateValue, fallback = 'Not provided') {
  if (!dateValue) {
    return fallback
  }

  const parsedDate = new Date(dateValue)

  if (Number.isNaN(parsedDate.getTime())) {
    return dateValue
  }

  return parsedDate.toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatStatus(status) {
  const normalizedStatus = String(status || 'pending').toLowerCase()

  if (normalizedStatus === 'active') {
    return 'Active'
  }

  if (normalizedStatus === 'rejected') {
    return 'Rejected'
  }

  return 'Pending'
}

function getTeacherStatus(status) {
  const normalizedStatus = String(status || 'pending').toLowerCase()

  if (normalizedStatus === 'active' || normalizedStatus === 'approved') {
    return 'active'
  }

  if (normalizedStatus === 'rejected') {
    return 'rejected'
  }

  return 'pending'
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

function getReferenceLabel(records, id, idKey, labelKey) {
  if (id === null || id === undefined) {
    return 'Not provided'
  }

  return records.find((record) => String(record[idKey]) === String(id))?.[labelKey] ?? 'Not provided'
}

function TeacherApprovalPage({ token, user }) {
  const [teachers, setTeachers] = useState([])
  const [referenceData, setReferenceData] = useState(emptyReferenceData)
  const [activeTab, setActiveTab] = useState('pending')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedTeacher, setSelectedTeacher] = useState(null)
  const [pendingAction, setPendingAction] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [activeUserId, setActiveUserId] = useState(null)
  const accessToken = token
  const hasPrincipalAccess = user?.role === 'principal'

  const teachersWithLabels = useMemo(
    () =>
      teachers.map((teacher) => ({
        ...teacher,
        genderLabel: getReferenceLabel(
          referenceData.genders,
          teacher.genderId,
          'genderId',
          'genderName',
        ),
        majorLabel: getReferenceLabel(
          referenceData.majors,
          teacher.majorId,
          'majorId',
          'majorName',
        ),
        educationalAttainmentLabel: getReferenceLabel(
          referenceData.educationalAttainments,
          teacher.educationalAttainmentId,
          'educationalAttainmentId',
          'educationalAttainmentName',
        ),
      })),
    [referenceData, teachers],
  )

  const tabCounts = useMemo(
    () =>
      teacherTabs.reduce((counts, tab) => {
        counts[tab.key] = teachersWithLabels.filter(
          (teacher) => getTeacherStatus(teacher.status) === tab.key,
        ).length
        return counts
      }, {}),
    [teachersWithLabels],
  )

  const visibleTeachers = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()

    return teachersWithLabels.filter((teacher) => {
      if (getTeacherStatus(teacher.status) !== activeTab) {
        return false
      }

      if (!normalizedSearch) {
        return true
      }

      return [
        teacher.name,
        teacher.email,
        teacher.contactNumber,
        teacher.majorLabel,
        teacher.educationalAttainmentLabel,
      ].some((value) => String(value || '').toLowerCase().includes(normalizedSearch))
    })
  }, [activeTab, searchTerm, teachersWithLabels])

  const loadTeachers = async ({ preserveSuccess = false } = {}) => {
    if (!hasPrincipalAccess) {
      setTeachers([])
      setReferenceData(emptyReferenceData)
      setError('')
      setSuccess('')
      setIsLoading(false)
      return
    }

    if (!accessToken) {
      setTeachers([])
      setReferenceData(emptyReferenceData)
      setSuccess('')
      setError('')
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError('')

    if (!preserveSuccess) {
      setSuccess('')
    }

    const [teacherResult, referenceResult] = await Promise.allSettled([
      getTeacherAccountsV2(accessToken),
      getTeacherReferenceDataV2(accessToken),
    ])

    if (teacherResult.status === 'fulfilled') {
      setTeachers(teacherResult.value)
    } else {
      setTeachers([])

      if (
        !teacherResult.reason?.isAuthenticationFailure &&
        teacherResult.reason?.status !== 401
      ) {
        setError(teacherResult.reason?.message || 'Unable to load teacher accounts.')
      }
    }

    if (referenceResult.status === 'fulfilled') {
      setReferenceData(referenceResult.value)
    } else {
      // Reference labels improve the detail view but must not block the account list.
      setReferenceData(emptyReferenceData)
    }

    setIsLoading(false)
  }

  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  useEffect(() => {
    loadTeachers()
  }, [hasPrincipalAccess, accessToken])
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  const handleConfirmAction = async () => {
    if (!pendingAction?.teacher?.userId || !accessToken) {
      return
    }

    const { action, teacher } = pendingAction
    setActiveUserId(teacher.userId)
    setError('')
    setSuccess('')

    try {
      if (action === 'approve') {
        await approveTeacherV2(teacher.userId, accessToken)
      } else {
        await rejectTeacherV2(teacher.userId, accessToken)
      }

      setPendingAction(null)
      setSelectedTeacher(null)
      setSuccess(
        `${teacher.name || 'Teacher account'} ${action === 'approve' ? 'approved' : 'rejected'} successfully.`,
      )
      await loadTeachers({ preserveSuccess: true })
    } catch (updateError) {
      if (updateError.status !== 401) {
        setError(updateError.message || `Unable to ${action} the teacher account.`)
      }
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
        <p>Review registration requests and manage teacher account access for your school.</p>
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
            <span>{tab.label}</span>
            <span className="principal-teacher-tab-count">{tabCounts[tab.key] ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="principal-teachers-toolbar">
        <label className="principal-teachers-search" htmlFor="teacherSearch">
          <Search size={17} strokeWidth={2.1} aria-hidden="true" />
          <input
            id="teacherSearch"
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search name, email, or specialization"
          />
        </label>
        <button
          type="button"
          className="principal-teachers-refresh"
          onClick={() => loadTeachers()}
          disabled={isLoading}
        >
          <RefreshCw size={16} strokeWidth={2.2} aria-hidden="true" />
          <span>{isLoading ? 'Refreshing...' : 'Refresh'}</span>
        </button>
      </div>

      {error ? (
        <p className="form-message form-message-error" role="alert" aria-live="polite">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="form-message form-message-success" role="status" aria-live="polite">
          {success}
        </p>
      ) : null}

      <section className="principal-teachers-table-panel">
        <div className="principal-teachers-table-wrap">
          <table className="principal-teachers-table">
            <thead>
              <tr>
                <th>Teacher</th>
                <th>Contact</th>
                <th>Professional Profile</th>
                <th>Registered</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td className="principal-teachers-empty" colSpan={6}>
                    Loading teacher accounts...
                  </td>
                </tr>
              ) : null}

              {!isLoading && !visibleTeachers.length ? (
                <tr>
                  <td className="principal-teachers-empty" colSpan={6}>
                    No teacher accounts match this filter.
                  </td>
                </tr>
              ) : null}

              {!isLoading
                ? visibleTeachers.map((teacher) => {
                    const isUpdating = activeUserId === teacher.userId
                    const status = getTeacherStatus(teacher.status)

                    return (
                      <tr key={teacher.userId ?? teacher.email}>
                        <td>
                          <div className="principal-teacher-name-cell">
                            <span aria-hidden="true">{getInitials(teacher.name)}</span>
                            <div>
                              <strong>{teacher.name || 'Teacher'}</strong>
                              <small>{teacher.email || 'No email provided'}</small>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="principal-teacher-contact">
                            <span>
                              <Mail size={14} strokeWidth={2} aria-hidden="true" />
                              {teacher.email || 'Not provided'}
                            </span>
                            <span>
                              <Phone size={14} strokeWidth={2} aria-hidden="true" />
                              {teacher.contactNumber || 'Not provided'}
                            </span>
                          </div>
                        </td>
                        <td>
                          <div className="principal-teacher-profile-summary">
                            <strong>{teacher.majorLabel}</strong>
                            <span>{teacher.educationalAttainmentLabel}</span>
                          </div>
                        </td>
                        <td>{formatDate(teacher.createdAt)}</td>
                        <td>
                          <span className={`principal-teacher-status status-${status}`}>
                            {formatStatus(status)}
                          </span>
                        </td>
                        <td>
                          <div className="principal-teacher-actions">
                            <button
                              type="button"
                              className="principal-teacher-view-button"
                              onClick={() => setSelectedTeacher(teacher)}
                            >
                              <Eye size={15} strokeWidth={2.2} aria-hidden="true" />
                              <span>View details</span>
                            </button>
                            {status === 'pending' ? (
                              <>
                                <button
                                  type="button"
                                  className="principal-approve-button"
                                  disabled={!teacher.userId || isUpdating}
                                  onClick={() => setPendingAction({ action: 'approve', teacher })}
                                  aria-label={`Approve ${teacher.name || 'teacher'}`}
                                  title="Approve teacher"
                                >
                                  <Check size={15} strokeWidth={2.4} aria-hidden="true" />
                                </button>
                                <button
                                  type="button"
                                  className="principal-reject-button"
                                  disabled={!teacher.userId || isUpdating}
                                  onClick={() => setPendingAction({ action: 'reject', teacher })}
                                  aria-label={`Reject ${teacher.name || 'teacher'}`}
                                  title="Reject teacher"
                                >
                                  <X size={15} strokeWidth={2.4} aria-hidden="true" />
                                </button>
                              </>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                : null}
            </tbody>
          </table>
        </div>
      </section>

      {selectedTeacher ? (
        <div
          className="principal-teacher-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedTeacher(null)
            }
          }}
        >
          <section
            className="principal-teacher-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="teacherDetailsTitle"
          >
            <header className="principal-teacher-modal-header">
              <div>
                <p>Teacher account</p>
                <h3 id="teacherDetailsTitle">{selectedTeacher.name || 'Teacher details'}</h3>
              </div>
              <button
                type="button"
                className="principal-teacher-modal-close"
                onClick={() => setSelectedTeacher(null)}
                aria-label="Close teacher details"
              >
                <X size={18} strokeWidth={2.2} />
              </button>
            </header>

            <div className="principal-teacher-detail-grid">
              <div>
                <span>Email address</span>
                <strong>{selectedTeacher.email || 'Not provided'}</strong>
              </div>
              <div>
                <span>Contact number</span>
                <strong>{selectedTeacher.contactNumber || 'Not provided'}</strong>
              </div>
              <div>
                <span>Gender</span>
                <strong>{selectedTeacher.genderLabel}</strong>
              </div>
              <div>
                <span>Birth date</span>
                <strong>{formatDate(selectedTeacher.birthDate)}</strong>
              </div>
              <div>
                <span>Specialization</span>
                <strong>{selectedTeacher.majorLabel}</strong>
              </div>
              <div>
                <span>Educational attainment</span>
                <strong>{selectedTeacher.educationalAttainmentLabel}</strong>
              </div>
              <div>
                <span>Teaching start date</span>
                <strong>{formatDate(selectedTeacher.teachingStartDate)}</strong>
              </div>
              <div>
                <span>Registration date</span>
                <strong>{formatDate(selectedTeacher.createdAt)}</strong>
              </div>
            </div>

            <footer className="principal-teacher-modal-footer">
              <span className={`principal-teacher-status status-${getTeacherStatus(selectedTeacher.status)}`}>
                {formatStatus(selectedTeacher.status)}
              </span>
              {getTeacherStatus(selectedTeacher.status) === 'pending' ? (
                <div className="principal-teacher-modal-actions">
                  <button
                    type="button"
                    className="principal-reject-button"
                    onClick={() => setPendingAction({ action: 'reject', teacher: selectedTeacher })}
                  >
                    <X size={15} strokeWidth={2.3} aria-hidden="true" />
                    Reject
                  </button>
                  <button
                    type="button"
                    className="principal-approve-button"
                    onClick={() => setPendingAction({ action: 'approve', teacher: selectedTeacher })}
                  >
                    <Check size={15} strokeWidth={2.3} aria-hidden="true" />
                    Approve
                  </button>
                </div>
              ) : null}
            </footer>
          </section>
        </div>
      ) : null}

      {pendingAction ? (
        <div className="principal-teacher-modal-backdrop" role="presentation">
          <section
            className="principal-teacher-confirmation"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="teacherActionTitle"
          >
            <span
              className={`principal-teacher-confirmation-icon is-${pendingAction.action}`}
              aria-hidden="true"
            >
              {pendingAction.action === 'approve' ? (
                <Check size={23} strokeWidth={2.4} />
              ) : (
                <X size={23} strokeWidth={2.4} />
              )}
            </span>
            <div>
              <h3 id="teacherActionTitle">
                {pendingAction.action === 'approve' ? 'Approve' : 'Reject'} teacher account?
              </h3>
              <p>
                {pendingAction.action === 'approve'
                  ? `${pendingAction.teacher.name || 'This teacher'} will be allowed to access the teacher workspace.`
                  : `${pendingAction.teacher.name || 'This teacher'} will not be allowed to access the system.`}
              </p>
            </div>
            <div className="principal-teacher-confirmation-actions">
              <button
                type="button"
                className="principal-teacher-cancel-button"
                onClick={() => setPendingAction(null)}
                disabled={activeUserId !== null}
              >
                Cancel
              </button>
              <button
                type="button"
                className={
                  pendingAction.action === 'approve'
                    ? 'principal-approve-button'
                    : 'principal-reject-button'
                }
                onClick={handleConfirmAction}
                disabled={activeUserId !== null}
              >
                {activeUserId !== null
                  ? 'Updating...'
                  : pendingAction.action === 'approve'
                    ? 'Approve account'
                    : 'Reject account'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  )
}

export default TeacherApprovalPage

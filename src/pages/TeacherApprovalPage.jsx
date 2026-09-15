import { useEffect, useMemo, useState } from 'react'
import {
  GraduationCap,
  Check,
  Eye,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  Search,
  UserRound,
  X,
} from 'lucide-react'
import {
  approveTeacherV3,
  getTeacherAccountV3,
  getTeacherAccountsV3,
  rejectTeacherV3,
} from '../api/apiV3Client'

const teacherTabs = [
  { key: 'pending', label: 'Pending' },
  { key: 'active', label: 'Active' },
  { key: 'rejected', label: 'Rejected' },
]

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

function formatTeachingExperience(dateValue) {
  if (!dateValue) return 'Not provided'

  const startDate = new Date(dateValue)
  const currentDate = new Date()

  if (Number.isNaN(startDate.getTime()) || startDate > currentDate) {
    return 'Not provided'
  }

  let totalMonths =
    (currentDate.getFullYear() - startDate.getFullYear()) * 12 +
    (currentDate.getMonth() - startDate.getMonth())

  if (currentDate.getDate() < startDate.getDate()) {
    totalMonths -= 1
  }

  const years = Math.floor(totalMonths / 12)
  const months = totalMonths % 12

  if (years === 0) {
    return months === 0 ? 'Less than 1 month' : `${months} month${months === 1 ? '' : 's'}`
  }

  if (months === 0) {
    return `${years} year${years === 1 ? '' : 's'}`
  }

  return `${years} year${years === 1 ? '' : 's'}, ${months} month${months === 1 ? '' : 's'}`
}

function formatAddress(address) {
  if (!address) return 'Not provided'
  if (typeof address === 'string') return address || 'Not provided'

  const parts = [
    address.addressLine ?? address.address_line,
    address.barangayName ?? address.barangay_name,
    address.cityMunicipalityName ?? address.city_municipality_name,
    address.provinceName ?? address.province_name,
    address.regionName ?? address.region_name,
    address.postalCode ?? address.postal_code,
    address.countryName ?? address.country_name ??
      ((address.countryCode ?? address.country_code) === 'PH' ? 'Philippines' : ''),
  ].filter(Boolean)

  return [...new Set(parts)].join(', ') || 'Not provided'
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

function TeacherDetail({ label, value, wide = false }) {
  return (
    <div className={`principal-teacher-detail${wide ? ' is-wide' : ''}`}>
      <dt>{label}</dt>
      <dd>{value || 'Not provided'}</dd>
    </div>
  )
}

function TeacherApprovalPage({ token, user }) {
  const [teachers, setTeachers] = useState([])
  const [activeTab, setActiveTab] = useState('pending')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedTeacher, setSelectedTeacher] = useState(null)
  const [pendingAction, setPendingAction] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [activeUserId, setActiveUserId] = useState(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const accessToken = token
  const hasPrincipalAccess = user?.role === 'principal'

  const teachersWithLabels = useMemo(
    () =>
      teachers.map((teacher) => ({
        ...teacher,
        genderLabel: teacher.genderName || 'Not provided',
        majorLabel: teacher.majorName || 'View details',
        educationalAttainmentLabel: teacher.educationalAttainmentName || 'View details',
      })),
    [teachers],
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
      setError('')
      setSuccess('')
      setIsLoading(false)
      return
    }

    if (!accessToken) {
      setTeachers([])
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

    const teacherResult = await Promise.allSettled([
      getTeacherAccountsV3(accessToken, 'pending_approval'),
      getTeacherAccountsV3(accessToken, 'active'),
      getTeacherAccountsV3(accessToken, 'rejected'),
    ])

    const failedResult = teacherResult.find((result) => result.status === 'rejected')

    if (!failedResult) {
      setTeachers(teacherResult.flatMap((result) => result.value))
    } else {
      setTeachers([])

      if (
        !failedResult.reason?.isAuthenticationFailure &&
        failedResult.reason?.status !== 401
      ) {
        setError(failedResult.reason?.message || 'Unable to load teacher accounts.')
      }
    }

    setIsLoading(false)
  }

  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  useEffect(() => {
    loadTeachers()
  }, [hasPrincipalAccess, accessToken])
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  const openTeacherDetails = async (teacher) => {
    if (!teacher?.userId || !accessToken) return

    setSelectedTeacher(teacher)
    setIsLoadingDetail(true)
    setDetailError('')

    try {
      const detail = await getTeacherAccountV3(teacher.userId, accessToken)
      setSelectedTeacher({
        ...detail,
        genderLabel: detail.genderName || 'Not provided',
        majorLabel: detail.majorName || 'Not provided',
        educationalAttainmentLabel: detail.educationalAttainmentName || 'Not provided',
      })
    } catch (loadError) {
      if (!loadError.isAuthenticationFailure) {
        setDetailError(loadError.message || 'Unable to load the teacher profile.')
      }
    } finally {
      setIsLoadingDetail(false)
    }
  }

  const openTeacherAction = (action, teacher) => {
    setPendingAction({ action, teacher })
    setRejectionReason('')
    setError('')
  }

  const handleConfirmAction = async () => {
    if (!pendingAction?.teacher?.userId || !accessToken) {
      return
    }

    const { action, teacher } = pendingAction

    if (action === 'reject') {
      const normalizedReason = rejectionReason.trim()

      if (normalizedReason.length < 5 || normalizedReason.length > 500) {
        setError('Enter a rejection reason between 5 and 500 characters.')
        return
      }
    }

    setActiveUserId(teacher.userId)
    setError('')
    setSuccess('')

    try {
      if (action === 'approve') {
        await approveTeacherV3(teacher.userId, accessToken)
      } else {
        await rejectTeacherV3(teacher.userId, rejectionReason.trim(), accessToken)
      }

      setPendingAction(null)
      setRejectionReason('')
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
                              onClick={() => openTeacherDetails(teacher)}
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
                                  onClick={() => openTeacherAction('approve', teacher)}
                                  aria-label={`Approve ${teacher.name || 'teacher'}`}
                                  title="Approve teacher"
                                >
                                  <Check size={15} strokeWidth={2.4} aria-hidden="true" />
                                </button>
                                <button
                                  type="button"
                                  className="principal-reject-button"
                                  disabled={!teacher.userId || isUpdating}
                                  onClick={() => openTeacherAction('reject', teacher)}
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

            <div className="principal-teacher-detail-sections">
              {detailError ? (
                <p className="form-message form-message-error" role="alert">
                  {detailError}
                </p>
              ) : null}
              {isLoadingDetail ? <p className="supporting-text">Loading teacher profile...</p> : null}
              <section className="principal-teacher-detail-section">
                <header>
                  <UserRound size={18} aria-hidden="true" />
                  <h4>Personal information</h4>
                </header>
                <dl className="principal-teacher-detail-grid">
                  <TeacherDetail label="Gender" value={selectedTeacher.genderLabel} />
                  <TeacherDetail label="Birth date" value={formatDate(selectedTeacher.birthDate)} />
                </dl>
              </section>

              <section className="principal-teacher-detail-section">
                <header>
                  <GraduationCap size={19} aria-hidden="true" />
                  <h4>Professional background</h4>
                </header>
                <dl className="principal-teacher-detail-grid">
                  <TeacherDetail label="Major" value={selectedTeacher.majorLabel} />
                  <TeacherDetail
                    label="Educational attainment"
                    value={selectedTeacher.educationalAttainmentLabel}
                  />
                  <TeacherDetail
                    label="Years of teaching"
                    value={formatTeachingExperience(selectedTeacher.teachingStartDate)}
                  />
                  <TeacherDetail
                    label="Registration date"
                    value={formatDate(selectedTeacher.createdAt)}
                  />
                </dl>
              </section>

              <section className="principal-teacher-detail-section">
                <header>
                  <MapPin size={18} aria-hidden="true" />
                  <h4>Contact and address</h4>
                </header>
                <dl className="principal-teacher-detail-grid">
                  <TeacherDetail label="Email address" value={selectedTeacher.email} />
                  <TeacherDetail label="Contact number" value={selectedTeacher.contactNumber} />
                  <TeacherDetail
                    label="Registered address"
                    value={formatAddress(selectedTeacher.address)}
                    wide
                  />
                </dl>
              </section>
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
                    onClick={() => openTeacherAction('reject', selectedTeacher)}
                  >
                    <X size={15} strokeWidth={2.3} aria-hidden="true" />
                    Reject
                  </button>
                  <button
                    type="button"
                    className="principal-approve-button"
                    onClick={() => openTeacherAction('approve', selectedTeacher)}
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
            {pendingAction.action === 'reject' ? (
              <label className="public-auth-field" htmlFor="teacherRejectionReason">
                <span>Reason for rejection</span>
                <textarea
                  id="teacherRejectionReason"
                  className="assignment-restore-reason"
                  value={rejectionReason}
                  onChange={(event) => {
                    setRejectionReason(event.target.value)
                    if (error) setError('')
                  }}
                  minLength="5"
                  maxLength="500"
                  rows="3"
                  required
                  disabled={activeUserId !== null}
                />
              </label>
            ) : null}
            {pendingAction.action === 'reject' && error ? (
              <p className="form-message form-message-error" role="alert">
                {error}
              </p>
            ) : null}
            <div className="principal-teacher-confirmation-actions">
              <button
                type="button"
                className="principal-teacher-cancel-button"
                onClick={() => {
                  setPendingAction(null)
                  setRejectionReason('')
                  setError('')
                }}
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
                disabled={
                  activeUserId !== null ||
                  (pendingAction.action === 'reject' &&
                    (rejectionReason.trim().length < 5 || rejectionReason.trim().length > 500))
                }
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

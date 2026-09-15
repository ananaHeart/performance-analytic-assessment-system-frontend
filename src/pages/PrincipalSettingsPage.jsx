import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Archive,
  ArrowLeft,
  CalendarDays,
  ChevronRight,
  Pencil,
  RefreshCw,
  RotateCcw,
  Save,
  X,
} from 'lucide-react'
import MfaSecurityPanel from '../components/MfaSecurityPanel'
import {
  getClassAssignmentsV3,
  getAcademicYearsV3,
  getSchoolProfileV3,
  reactivateClassAssignmentV3,
  updateSchoolProfileV3,
} from '../api/apiV3Client'

function isArchivedAssignment(assignment) {
  return String(assignment?.status ?? '').trim().toLowerCase() === 'archived'
}

function getAssignmentAcademicYear(assignment = {}) {
  const id = assignment.academicYearId ?? assignment.yearId ?? assignment.academicYear
  const label =
    assignment.academicYear ??
    assignment.academicYearName ??
    assignment.yearName ??
    'Academic Year'

  return {
    id: String(id ?? label),
    label: String(label),
  }
}

function formatSchoolAddress(address) {
  if (!address) return 'Not provided'

  return [
    address.addressLine,
    address.barangayName,
    address.cityMunicipalityName,
    address.provinceName,
    address.regionName,
    address.postalCode,
    address.countryCode === 'PH' ? 'Philippines' : address.countryCode,
  ]
    .filter(Boolean)
    .join(', ')
}

function createSchoolProfileDraft(profile = {}) {
  return {
    schoolName: profile.schoolName ?? '',
    contactNumber: profile.contactNumber ?? '',
    email: profile.email ?? '',
    addressLine: profile.address?.addressLine ?? '',
    postalCode: profile.address?.postalCode ?? '',
  }
}

function formatCalendarDate(value) {
  if (!value) return 'Not set'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

function PrincipalSettingsPage({ user, token }) {
  const displayName =
    user.name || [user.firstName, user.middleName, user.lastName].filter(Boolean).join(' ')
  const [archivedAssignments, setArchivedAssignments] = useState([])
  const [schoolProfile, setSchoolProfile] = useState(null)
  const [schoolProfileDraft, setSchoolProfileDraft] = useState(
    createSchoolProfileDraft(),
  )
  const [schoolProfileError, setSchoolProfileError] = useState('')
  const [schoolProfileSuccess, setSchoolProfileSuccess] = useState('')
  const [isEditingSchoolProfile, setIsEditingSchoolProfile] = useState(false)
  const [isSavingSchoolProfile, setIsSavingSchoolProfile] = useState(false)
  const [academicYears, setAcademicYears] = useState([])
  const [academicCalendarError, setAcademicCalendarError] = useState('')
  const [isLoadingAcademicCalendar, setIsLoadingAcademicCalendar] = useState(true)
  const [selectedArchiveYearId, setSelectedArchiveYearId] = useState('')
  const [isLoadingArchive, setIsLoadingArchive] = useState(true)
  const [archiveError, setArchiveError] = useState('')
  const [restorePending, setRestorePending] = useState(null)
  const [restoreReason, setRestoreReason] = useState('')
  const [restoreError, setRestoreError] = useState('')
  const [restoreSuccess, setRestoreSuccess] = useState('')
  const [isRestoring, setIsRestoring] = useState(false)
  const archiveYearGroups = useMemo(() => {
    const groups = new Map()

    archivedAssignments.forEach((assignment) => {
      const academicYear = getAssignmentAcademicYear(assignment)

      if (!groups.has(academicYear.id)) {
        groups.set(academicYear.id, {
          ...academicYear,
          assignments: [],
        })
      }

      groups.get(academicYear.id).assignments.push(assignment)
    })

    return Array.from(groups.values()).sort((left, right) =>
      right.label.localeCompare(left.label, undefined, { numeric: true }),
    )
  }, [archivedAssignments])
  const selectedArchiveYear =
    archiveYearGroups.find((group) => group.id === selectedArchiveYearId) ?? null

  const loadArchivedAssignments = useCallback(async () => {
    setIsLoadingArchive(true)
    setArchiveError('')

    try {
      const assignments = await getClassAssignmentsV3(token)
      setArchivedAssignments(assignments.filter(isArchivedAssignment))
    } catch (loadError) {
      setArchivedAssignments([])

      if (!loadError.isAuthenticationFailure && loadError.status !== 401) {
        setArchiveError(loadError.message || 'Unable to load archived class assignments.')
      }
    } finally {
      setIsLoadingArchive(false)
    }
  }, [token])

  const loadSchoolProfile = useCallback(async () => {
    setSchoolProfileError('')

    try {
      const profile = await getSchoolProfileV3(token)
      setSchoolProfile(profile)
      setSchoolProfileDraft(createSchoolProfileDraft(profile))
    } catch (loadError) {
      setSchoolProfile(null)

      if (!loadError.isAuthenticationFailure) {
        setSchoolProfileError(loadError.message || 'Unable to load the school profile.')
      }
    }
  }, [token])

  const loadAcademicCalendar = useCallback(async () => {
    setIsLoadingAcademicCalendar(true)
    setAcademicCalendarError('')

    try {
      const records = await getAcademicYearsV3(token)
      setAcademicYears(records)
    } catch (loadError) {
      setAcademicYears([])

      if (!loadError.isAuthenticationFailure) {
        setAcademicCalendarError(
          loadError.message || 'Unable to load the academic calendar.',
        )
      }
    } finally {
      setIsLoadingAcademicCalendar(false)
    }
  }, [token])

  const handleSchoolProfileChange = (field, value) => {
    setSchoolProfileDraft((current) => ({ ...current, [field]: value }))
    setSchoolProfileError('')
    setSchoolProfileSuccess('')
  }

  const cancelSchoolProfileEdit = () => {
    if (isSavingSchoolProfile) return
    setSchoolProfileDraft(createSchoolProfileDraft(schoolProfile))
    setSchoolProfileError('')
    setIsEditingSchoolProfile(false)
  }

  const handleSchoolProfileSave = async (event) => {
    event.preventDefault()

    const schoolName = schoolProfileDraft.schoolName.trim()
    const contactNumber = schoolProfileDraft.contactNumber.trim()
    const email = schoolProfileDraft.email.trim()
    const addressLine = schoolProfileDraft.addressLine.trim()

    if (!schoolName || !addressLine) {
      setSchoolProfileError('School name and address line are required.')
      return
    }

    if (contactNumber && !/^(09\d{9}|\+639\d{9})$/.test(contactNumber)) {
      setSchoolProfileError('Use 09XXXXXXXXX or +639XXXXXXXXX for the contact number.')
      return
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setSchoolProfileError('Enter a complete school email address.')
      return
    }

    const currentAddress = schoolProfile?.address ?? {}
    const payload = {
      schoolName,
      contactNumber: contactNumber || null,
      email: email || null,
      address: {
        regionCode: currentAddress.regionCode || null,
        regionName: currentAddress.regionName || null,
        provinceCode: currentAddress.provinceCode || null,
        provinceName: currentAddress.provinceName || null,
        cityMunicipalityCode: currentAddress.cityMunicipalityCode || null,
        cityMunicipalityName: currentAddress.cityMunicipalityName || null,
        barangayCode: currentAddress.barangayCode || null,
        barangayName: currentAddress.barangayName || null,
        addressLine,
        postalCode: schoolProfileDraft.postalCode.trim() || null,
        addressSource: currentAddress.addressSource || 'manual',
      },
    }

    setIsSavingSchoolProfile(true)
    setSchoolProfileError('')
    setSchoolProfileSuccess('')

    try {
      const updatedProfile = await updateSchoolProfileV3(payload, token)
      setSchoolProfile(updatedProfile)
      setSchoolProfileDraft(createSchoolProfileDraft(updatedProfile))
      setIsEditingSchoolProfile(false)
      setSchoolProfileSuccess('School profile updated successfully.')
    } catch (saveError) {
      setSchoolProfileError(saveError.message || 'Unable to update the school profile.')
    } finally {
      setIsSavingSchoolProfile(false)
    }
  }

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    loadArchivedAssignments()
    loadSchoolProfile()
    loadAcademicCalendar()
  }, [loadAcademicCalendar, loadArchivedAssignments, loadSchoolProfile])
  /* eslint-enable react-hooks/set-state-in-effect */

  const openRestoreDialog = (assignment) => {
    setRestorePending(assignment)
    setRestoreReason('')
    setRestoreError('')
    setRestoreSuccess('')
  }

  const closeRestoreDialog = () => {
    if (isRestoring) return

    setRestorePending(null)
    setRestoreReason('')
    setRestoreError('')
  }

  const handleRestoreAssignment = async (event) => {
    event.preventDefault()

    const normalizedReason = restoreReason.trim()

    if (!restorePending || normalizedReason.length < 5 || normalizedReason.length > 255) {
      setRestoreError('Enter a reason between 5 and 255 characters.')
      return
    }

    setIsRestoring(true)
    setRestoreError('')

    try {
      await reactivateClassAssignmentV3(
        restorePending.classAssignmentId ?? restorePending.id,
        normalizedReason,
        token,
      )
      setRestorePending(null)
      setRestoreReason('')
      setRestoreSuccess('Class assignment restored successfully.')
      await loadArchivedAssignments()
    } catch (restoreRequestError) {
      setRestoreError(
        restoreRequestError.message || 'Unable to restore this class assignment.',
      )
    } finally {
      setIsRestoring(false)
    }
  }

  return (
    <div className="content-stack principal-settings-page">
      <section className="hero-panel">
        <p className="section-tag">Settings</p>
        <h2>Principal account</h2>
        <p className="supporting-text">
          Review the account details available from the current login session.
        </p>
      </section>

      <section className="content-card principal-settings-card">
        <div className="principal-settings-avatar" aria-hidden="true">
          {(displayName || user.email || 'P').slice(0, 1).toUpperCase()}
        </div>
        <div>
          <p className="content-card-tag">Signed In</p>
          <h3>{displayName || 'Principal'}</h3>
          <p>{user.email || 'No email available'}</p>
          <span className="status-pill status-active">Principal</span>
        </div>
      </section>

      <MfaSecurityPanel token={token} />

      <section
        className="content-card principal-school-profile-card"
        aria-labelledby="schoolProfileTitle"
      >
        <header className="principal-school-profile-header">
          <div className="principal-settings-avatar" aria-hidden="true">
            {(schoolProfile?.schoolName || 'S').slice(0, 1).toUpperCase()}
          </div>
          <div>
            <p className="content-card-tag">School Profile</p>
            <h3 id="schoolProfileTitle">{schoolProfile?.schoolName || 'School profile'}</h3>
          </div>
          {!isEditingSchoolProfile ? (
            <button
              type="button"
              className="secondary-button principal-school-profile-edit"
              onClick={() => {
                setSchoolProfileDraft(createSchoolProfileDraft(schoolProfile))
                setSchoolProfileError('')
                setSchoolProfileSuccess('')
                setIsEditingSchoolProfile(true)
              }}
              disabled={!schoolProfile}
            >
              <Pencil size={16} aria-hidden="true" />
              Edit profile
            </button>
          ) : null}
        </header>

        {schoolProfileError ? (
          <p className="form-message form-message-error" role="alert">
            {schoolProfileError}
          </p>
        ) : null}
        {schoolProfileSuccess ? (
          <p className="form-message form-message-success" role="status">
            {schoolProfileSuccess}
          </p>
        ) : null}

        {isEditingSchoolProfile ? (
          <form className="principal-school-profile-form" onSubmit={handleSchoolProfileSave}>
            <label>
              <span>School name</span>
              <input
                value={schoolProfileDraft.schoolName}
                maxLength="120"
                onChange={(event) => handleSchoolProfileChange('schoolName', event.target.value)}
                required
              />
            </label>
            <label>
              <span>Contact number</span>
              <input
                value={schoolProfileDraft.contactNumber}
                maxLength="20"
                placeholder="09XXXXXXXXX"
                onChange={(event) =>
                  handleSchoolProfileChange('contactNumber', event.target.value)
                }
              />
            </label>
            <label>
              <span>School email</span>
              <input
                type="email"
                value={schoolProfileDraft.email}
                maxLength="120"
                onChange={(event) => handleSchoolProfileChange('email', event.target.value)}
              />
            </label>
            <label>
              <span>Postal code</span>
              <input
                value={schoolProfileDraft.postalCode}
                maxLength="10"
                onChange={(event) => handleSchoolProfileChange('postalCode', event.target.value)}
              />
            </label>
            <label className="principal-school-profile-address-line">
              <span>Building and street address</span>
              <input
                value={schoolProfileDraft.addressLine}
                maxLength="255"
                onChange={(event) => handleSchoolProfileChange('addressLine', event.target.value)}
                required
              />
            </label>
            <p className="principal-school-profile-location">
              {[
                schoolProfile?.address?.barangayName,
                schoolProfile?.address?.cityMunicipalityName,
                schoolProfile?.address?.provinceName,
                schoolProfile?.address?.regionName,
              ]
                .filter(Boolean)
                .join(', ') || 'No saved locality'}
            </p>
            <div className="principal-school-profile-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={cancelSchoolProfileEdit}
                disabled={isSavingSchoolProfile}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="primary-button"
                disabled={isSavingSchoolProfile}
              >
                <Save size={16} aria-hidden="true" />
                {isSavingSchoolProfile ? 'Saving...' : 'Save profile'}
              </button>
            </div>
          </form>
        ) : schoolProfile ? (
          <dl className="principal-school-profile-details">
            <div>
              <dt>Email</dt>
              <dd>{schoolProfile.email || 'Not provided'}</dd>
            </div>
            <div>
              <dt>Contact number</dt>
              <dd>{schoolProfile.contactNumber || 'Not provided'}</dd>
            </div>
            <div className="principal-school-profile-address-line">
              <dt>Address</dt>
              <dd>{formatSchoolAddress(schoolProfile.address)}</dd>
            </div>
          </dl>
        ) : null}
      </section>

      <section
        className="content-card principal-academic-calendar-card"
        aria-labelledby="academicCalendarTitle"
      >
        <header className="principal-academic-calendar-header">
          <span className="principal-archive-icon" aria-hidden="true">
            <CalendarDays size={19} strokeWidth={2.2} />
          </span>
          <div>
            <p className="content-card-tag">Academic Calendar</p>
            <h3 id="academicCalendarTitle">School year and term periods</h3>
          </div>
          <button
            type="button"
            className="principal-archive-refresh"
            onClick={loadAcademicCalendar}
            disabled={isLoadingAcademicCalendar}
          >
            <RefreshCw size={16} strokeWidth={2.2} aria-hidden="true" />
            <span>Refresh</span>
          </button>
        </header>

        {academicCalendarError ? (
          <p className="form-message form-message-error" role="alert">
            {academicCalendarError}
          </p>
        ) : null}

        {isLoadingAcademicCalendar ? (
          <div className="principal-archive-empty">Loading academic calendar...</div>
        ) : academicYears.length ? (
          <div className="principal-academic-year-list">
            {academicYears.map((academicYear) => {
              const termPeriods = [...(academicYear.termPeriods ?? [])].sort(
                (left, right) => Number(left.termOrder ?? 0) - Number(right.termOrder ?? 0),
              )

              return (
                <article
                  className="principal-academic-year"
                  key={academicYear.academicYearId ?? academicYear.yearName}
                >
                  <div className="principal-academic-year-summary">
                    <div>
                      <span>Academic year</span>
                      <strong>{academicYear.yearName || 'Academic Year'}</strong>
                    </div>
                    <div>
                      <span>School year dates</span>
                      <strong>
                        {formatCalendarDate(academicYear.startDate)} -{' '}
                        {formatCalendarDate(academicYear.endDate)}
                      </strong>
                    </div>
                    <span className={`status-pill status-${academicYear.status || 'inactive'}`}>
                      {academicYear.status || 'Status unavailable'}
                    </span>
                  </div>

                  <div className="principal-term-grid">
                    {termPeriods.map((term) => (
                      <div className="principal-term-row" key={term.termPeriodId}>
                        <span>{term.termOrder}</span>
                        <div>
                          <strong>{term.termName}</strong>
                          <small>
                            {formatCalendarDate(term.startAt)} - {formatCalendarDate(term.endAt)}
                          </small>
                        </div>
                        <span className={`status-pill status-${term.status || 'inactive'}`}>
                          {term.status || 'Status unavailable'}
                        </span>
                      </div>
                    ))}
                  </div>
                </article>
              )
            })}
          </div>
        ) : (
          <div className="principal-archive-empty">No academic calendar is available.</div>
        )}
      </section>

      <section className="principal-archive-panel" aria-labelledby="archivedAssignmentsTitle">
        <div className="principal-archive-header">
          <div className="principal-archive-heading">
            <span className="principal-archive-icon" aria-hidden="true">
              <Archive size={19} strokeWidth={2.2} />
            </span>
            <div>
              <p className="content-card-tag">Assignment Archive</p>
              <h3 id="archivedAssignmentsTitle">Archived class assignments</h3>
            </div>
          </div>

          <div className="principal-archive-actions">
            <span className="principal-archive-count">
              {isLoadingArchive
                ? 'Loading...'
                : selectedArchiveYear
                  ? `${selectedArchiveYear.assignments.length} archived`
                  : `${archiveYearGroups.length} academic year${archiveYearGroups.length === 1 ? '' : 's'}`}
            </span>
            <button
              type="button"
              className="principal-archive-refresh"
              onClick={loadArchivedAssignments}
              disabled={isLoadingArchive}
            >
              <RefreshCw size={16} strokeWidth={2.2} aria-hidden="true" />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {archiveError ? (
          <p className="form-message form-message-error principal-archive-message" role="alert">
            {archiveError}
          </p>
        ) : null}

        {restoreSuccess ? (
          <p className="form-message form-message-success principal-archive-message" role="status">
            {restoreSuccess}
          </p>
        ) : null}

        {isLoadingArchive ? (
          <div className="principal-archive-empty">Loading archived assignments...</div>
        ) : selectedArchiveYear ? (
          <div className="principal-archive-year-detail">
            <div className="principal-archive-year-detail-header">
              <button
                type="button"
                className="principal-archive-back"
                onClick={() => setSelectedArchiveYearId('')}
              >
                <ArrowLeft size={16} strokeWidth={2.2} aria-hidden="true" />
                Academic years
              </button>
              <div>
                <span>Selected academic year</span>
                <strong>{selectedArchiveYear.label}</strong>
              </div>
            </div>

            <div className="principal-archive-table-wrap">
              <table className="principal-archive-table">
                <thead>
                  <tr>
                    <th>Teacher</th>
                    <th>Class</th>
                    <th>Subject</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedArchiveYear.assignments.map((assignment) => (
                    <tr key={assignment.classAssignmentId ?? assignment.id}>
                      <td>
                        <strong>{assignment.teacherName || 'Teacher unavailable'}</strong>
                      </td>
                      <td>
                        {assignment.gradeLevelName || 'Grade level'} -{' '}
                        {assignment.sectionName || 'Section'}
                      </td>
                      <td>{assignment.subjectName || 'Subject unavailable'}</td>
                      <td>
                        <span className="status-pill status-archived">Archived</span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="principal-archive-restore"
                          onClick={() => openRestoreDialog(assignment)}
                          title="Restore class assignment"
                          aria-label={`Restore ${assignment.teacherName || 'teacher'} assignment`}
                        >
                          <RotateCcw size={16} strokeWidth={2.3} aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : archiveYearGroups.length ? (
          <div className="principal-archive-year-browser">
            <div className="principal-archive-year-browser-heading">
              <span>Academic year</span>
              <span>Archived assignments</span>
            </div>
            <div className="principal-archive-year-list">
              {archiveYearGroups.map((group) => (
                <button
                  type="button"
                  className="principal-archive-year-row"
                  key={group.id}
                  onClick={() => setSelectedArchiveYearId(group.id)}
                >
                  <span className="principal-archive-year-icon" aria-hidden="true">
                    <CalendarDays size={18} strokeWidth={2.2} />
                  </span>
                  <strong>{group.label}</strong>
                  <span>
                    {group.assignments.length} assignment{group.assignments.length === 1 ? '' : 's'}
                  </span>
                  <ChevronRight size={18} strokeWidth={2.2} aria-hidden="true" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="principal-archive-empty">No archived class assignments.</div>
        )}
      </section>

      {restorePending ? (
        <div
          className="assignment-delete-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeRestoreDialog()
          }}
        >
          <section
            className="assignment-delete-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="restoreAssignmentTitle"
          >
            <header className="assignment-delete-header assignment-confirm-header">
              <span
                className="assignment-delete-warning assignment-confirm-icon"
                aria-hidden="true"
              >
                <RotateCcw size={21} strokeWidth={2.3} />
              </span>
              <div>
                <p>Restore assignment</p>
                <h3 id="restoreAssignmentTitle">Return this assignment to active?</h3>
              </div>
              <button
                type="button"
                className="assignment-delete-close"
                onClick={closeRestoreDialog}
                disabled={isRestoring}
                aria-label="Close restore assignment dialog"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </header>

            <div className="assignment-delete-body">
              <p className="assignment-confirm-instruction">
                Review the archived assignment before restoring it.
              </p>
              <dl className="assignment-delete-summary assignment-confirm-summary">
                <div>
                  <dt>Teacher</dt>
                  <dd>{restorePending.teacherName || 'Teacher unavailable'}</dd>
                </div>
                <div>
                  <dt>Subject</dt>
                  <dd>{restorePending.subjectName || 'Subject unavailable'}</dd>
                </div>
                <div>
                  <dt>Class</dt>
                  <dd>
                    {restorePending.gradeLevelName || 'Grade level'} -{' '}
                    {restorePending.sectionName || 'Section'}
                  </dd>
                </div>
                <div>
                  <dt>Academic year</dt>
                  <dd>{restorePending.academicYear || 'Academic Year'}</dd>
                </div>
              </dl>

              {restoreError ? (
                <p className="form-message form-message-error" role="alert">
                  {restoreError}
                </p>
              ) : null}

              <form onSubmit={handleRestoreAssignment}>
                <label htmlFor="restoreAssignmentReason">Reason for reactivation</label>
                <textarea
                  id="restoreAssignmentReason"
                  className="assignment-restore-reason"
                  value={restoreReason}
                  onChange={(event) => {
                    setRestoreReason(event.target.value)
                    if (restoreError) setRestoreError('')
                  }}
                  minLength="5"
                  maxLength="255"
                  rows="4"
                  required
                  disabled={isRestoring}
                  placeholder="Enter why this archived assignment should be active again"
                />
                <span className="assignment-restore-reason-count">
                  {restoreReason.length}/255
                </span>
                <div className="assignment-delete-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={closeRestoreDialog}
                    disabled={isRestoring}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="assignment-confirm-submit"
                    disabled={
                      isRestoring ||
                      restoreReason.trim().length < 5 ||
                      restoreReason.trim().length > 255
                    }
                  >
                    <RotateCcw size={16} strokeWidth={2.3} aria-hidden="true" />
                    {isRestoring ? 'Restoring...' : 'Restore assignment'}
                  </button>
                </div>
              </form>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  )
}

export default PrincipalSettingsPage

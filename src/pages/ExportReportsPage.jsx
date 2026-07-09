import { useEffect, useState } from 'react'
import {
  downloadItemAnalysisReport,
  downloadLmsReport,
  getAssessmentDetails,
  getTeacherAssessments,
} from '../api/apiClient'

const USER_STORAGE_KEY = 'assessment-user'

function readStoredUser() {
  const storedUser = localStorage.getItem(USER_STORAGE_KEY)

  if (!storedUser) {
    return null
  }

  try {
    return JSON.parse(storedUser)
  } catch {
    return null
  }
}

function formatDate(dateValue) {
  if (!dateValue) {
    return 'Not assigned'
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

function ExportReportsPage({ user, role }) {
  const activeUser = user ?? readStoredUser()
  const effectiveRole = role ?? activeUser?.role ?? ''
  const teacherId = activeUser?.id

  const [teacherAssessments, setTeacherAssessments] = useState([])
  const [selectedTestId, setSelectedTestId] = useState('')
  const [selectedAssessmentDetails, setSelectedAssessmentDetails] = useState(null)
  const [principalTestId, setPrincipalTestId] = useState('')
  const [pageError, setPageError] = useState('')
  const [pageSuccess, setPageSuccess] = useState('')
  const [detailsError, setDetailsError] = useState('')
  const [isPageLoading, setIsPageLoading] = useState(true)
  const [isDetailsLoading, setIsDetailsLoading] = useState(false)
  const [isItemDownloadLoading, setIsItemDownloadLoading] = useState(false)
  const [isLmsDownloadLoading, setIsLmsDownloadLoading] = useState(false)

  const selectedAssessment =
    teacherAssessments.find((assessment) => String(assessment.id) === String(selectedTestId)) ?? null

  const loadAssessmentDetails = async (testId) => {
    if (!testId) {
      setSelectedAssessmentDetails(null)
      setDetailsError('')
      return
    }

    setIsDetailsLoading(true)
    setDetailsError('')

    try {
      const detailResult = await getAssessmentDetails(testId)
      setSelectedAssessmentDetails(detailResult)
    } catch (loadError) {
      setDetailsError(loadError.message || 'Unable to load assessment details.')
      setSelectedAssessmentDetails(null)
    } finally {
      setIsDetailsLoading(false)
    }
  }

  const loadTeacherAssessments = async () => {
    if (!teacherId) {
      setPageError('Teacher access is required.')
      setTeacherAssessments([])
      setIsPageLoading(false)
      return
    }

    setIsPageLoading(true)
    setPageError('')
    setPageSuccess('')

    try {
      const assessments = await getTeacherAssessments(teacherId)
      setTeacherAssessments(assessments)

      if (assessments.length) {
        setSelectedTestId((currentId) => currentId || String(assessments[0].id))
      } else {
        setSelectedTestId('')
        setSelectedAssessmentDetails(null)
      }
    } catch (loadError) {
      setPageError(loadError.message || 'Unable to load teacher assessments.')
      setTeacherAssessments([])
    } finally {
      setIsPageLoading(false)
    }
  }

  useEffect(() => {
    if (effectiveRole === 'teacher') {
      loadTeacherAssessments()
      return
    }

    setIsPageLoading(false)
  }, [effectiveRole, teacherId])

  useEffect(() => {
    if (effectiveRole === 'teacher' && selectedTestId) {
      loadAssessmentDetails(selectedTestId)
      return
    }

    if (effectiveRole === 'teacher') {
      setSelectedAssessmentDetails(null)
      setDetailsError('')
    }
  }, [effectiveRole, selectedTestId])

  const handleDownload = async (type) => {
    const activeTestId =
      effectiveRole === 'teacher' ? selectedTestId : principalTestId.trim()

    setPageError('')
    setPageSuccess('')

    if (!activeTestId) {
      setPageError(
        effectiveRole === 'teacher'
          ? 'Select an assessment before downloading a report.'
          : 'Test ID is required before downloading a report.',
      )
      return
    }

    const downloadAction =
      type === 'item'
        ? downloadItemAnalysisReport
        : downloadLmsReport

    const setLoadingState =
      type === 'item' ? setIsItemDownloadLoading : setIsLmsDownloadLoading

    setLoadingState(true)

    try {
      const downloadedFilename = await downloadAction(activeTestId)
      setPageSuccess(`${downloadedFilename} downloaded successfully.`)
    } catch (downloadError) {
      setPageError(downloadError.message || 'Unable to download the selected report.')
    } finally {
      setLoadingState(false)
    }
  }

  if (!effectiveRole) {
    return (
      <div className="content-stack">
        <section className="hero-panel">
          <p className="section-tag">Export Reports</p>
          <h2>User access is required.</h2>
          <p className="supporting-text">Sign in before downloading assessment exports.</p>
        </section>
      </div>
    )
  }

  if (effectiveRole === 'teacher') {
    return (
      <div className="content-stack">
        <section className="hero-panel">
          <p className="section-tag">Export Reports</p>
          <h2>Assessment reports</h2>
          <p className="supporting-text">
            Select one of your assessments, review the current test details, and download Excel
            reports for item analysis or least mastered skills.
          </p>
        </section>

        <section className="stat-grid">
          <article className="stat-card">
            <p>My Assessments</p>
            <strong>{isPageLoading ? 'Loading...' : teacherAssessments.length}</strong>
            <span>Assessments available for export using the current teacher account.</span>
          </article>
          <article className="stat-card">
            <p>Selected Assessment</p>
            <strong>{selectedAssessment?.testName || 'None'}</strong>
            <span>Current assessment that will be used for export.</span>
          </article>
          <article className="stat-card">
            <p>Saved Parts</p>
            <strong>{isDetailsLoading ? 'Loading...' : selectedAssessmentDetails?.parts?.length ?? 0}</strong>
            <span>Test parts currently returned by the assessment details endpoint.</span>
          </article>
        </section>

        {pageError ? <p className="form-message form-message-error">{pageError}</p> : null}
        {pageSuccess ? <p className="form-message form-message-success">{pageSuccess}</p> : null}

        <section className="content-card">
          <div className="section-toolbar">
            <div>
              <p className="content-card-tag">Assessment Selection</p>
              <h3>Select an assessment to export</h3>
            </div>
            <button type="button" className="secondary-button" onClick={loadTeacherAssessments}>
              Refresh
            </button>
          </div>

          <div className="form-grid">
            <label className="field-group" htmlFor="exportTeacherTestId">
              <span>Assessment / Test</span>
              <select
                id="exportTeacherTestId"
                value={selectedTestId}
                onChange={(event) => setSelectedTestId(event.target.value)}
              >
                <option value="">Select assessment</option>
                {teacherAssessments.map((assessment) => (
                  <option key={assessment.id} value={assessment.id}>
                    {assessment.testName} | {assessment.subjectName || 'Subject'} |{' '}
                    {assessment.sectionName || 'Section'}
                  </option>
                ))}
              </select>
            </label>

            <div className="confirm-file-indicator">
              <span>Selected Class</span>
              <strong>
                {selectedAssessment
                  ? `${selectedAssessment.subjectName || 'Subject'} - ${
                      selectedAssessment.sectionName || 'Section'
                    }`
                  : 'Select assessment'}
              </strong>
            </div>
          </div>
        </section>

        <section className="content-card">
          <p className="content-card-tag">Assessment Details</p>
          <h3>{selectedAssessment?.testName || 'Select an assessment'}</h3>
          <p className="supporting-text">
            The selected assessment details come from the assessment setup backend endpoint.
          </p>

          {detailsError ? <p className="form-message form-message-error">{detailsError}</p> : null}

          <div className="mini-stat-grid">
            <div className="mini-stat-card">
              <span>Test Type</span>
              <strong>{selectedAssessment?.testType || 'Not assigned'}</strong>
            </div>
            <div className="mini-stat-card">
              <span>Test Date</span>
              <strong>{formatDate(selectedAssessment?.testDate)}</strong>
            </div>
            <div className="mini-stat-card">
              <span>Status</span>
              <strong>{selectedAssessment?.testStatus || 'Not assigned'}</strong>
            </div>
            <div className="mini-stat-card">
              <span>Subject / Section</span>
              <strong>
                {selectedAssessment?.subjectName || 'Subject'} / {selectedAssessment?.sectionName || 'Section'}
              </strong>
            </div>
          </div>

          <div className="approval-table-wrap">
            <table className="approval-table">
              <thead>
                <tr>
                  <th>Competency</th>
                  <th>Part Order</th>
                  <th>Part Type</th>
                  <th>Number of Items</th>
                  <th>Points Per Item</th>
                  <th>Answer Key</th>
                </tr>
              </thead>
              <tbody>
                {isDetailsLoading ? (
                  <tr>
                    <td className="approval-empty" colSpan="6">
                      Loading assessment details...
                    </td>
                  </tr>
                ) : null}

                {!isDetailsLoading && !selectedAssessmentDetails?.parts?.length ? (
                  <tr>
                    <td className="approval-empty" colSpan="6">
                      No test parts available for the selected assessment.
                    </td>
                  </tr>
                ) : null}

                {!isDetailsLoading
                  ? selectedAssessmentDetails?.parts?.map((part, index) => (
                      <tr key={part.id ?? `${part.partOrder}-${index}`}>
                        <td>{part.competencyName || 'Not assigned'}</td>
                        <td>{part.partOrder || '-'}</td>
                        <td>{part.partType || '-'}</td>
                        <td>{part.numberOfItems || '-'}</td>
                        <td>{part.pointsPerItem || '-'}</td>
                        <td>{part.answerKey || '-'}</td>
                      </tr>
                    ))
                  : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="content-card">
          <p className="content-card-tag">Downloads</p>
          <h3>Download assessment reports</h3>

          <div className="table-actions">
            <button
              type="button"
              className="primary-button"
              disabled={isItemDownloadLoading || !selectedTestId}
              onClick={() => handleDownload('item')}
            >
              {isItemDownloadLoading ? 'Downloading...' : 'Download Item Analysis Excel'}
            </button>
            <button
              type="button"
              className="secondary-button"
              disabled={isLmsDownloadLoading || !selectedTestId}
              onClick={() => handleDownload('lms')}
            >
              {isLmsDownloadLoading ? 'Downloading...' : 'Download LMS Excel'}
            </button>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="content-stack">
      <section className="hero-panel">
        <p className="section-tag">Export Reports</p>
        <h2>Principal assessment exports</h2>
        <p className="supporting-text">
          Current export endpoints are assessment-based. Enter a test ID manually until school-wide
          export endpoints are added to the backend.
        </p>
      </section>

      <section className="stat-grid">
        <article className="stat-card">
          <p>Export Scope</p>
          <strong>Assessment</strong>
          <span>Current backend exports require a single assessment test ID.</span>
        </article>
        <article className="stat-card">
          <p>Selected Test ID</p>
          <strong>{principalTestId || 'None'}</strong>
          <span>Manual principal input for temporary report exports.</span>
        </article>
        <article className="stat-card">
          <p>Available Files</p>
          <strong>2</strong>
          <span>Item analysis and least mastered skills Excel reports.</span>
        </article>
      </section>

      {pageError ? <p className="form-message form-message-error">{pageError}</p> : null}
      {pageSuccess ? <p className="form-message form-message-success">{pageSuccess}</p> : null}

      <section className="content-card">
        <p className="content-card-tag">Temporary Principal Export</p>
        <h3>Enter a test ID</h3>
        <p className="supporting-text">
          Use a known assessment test ID to download the current Excel export files.
        </p>

        <div className="form-grid">
          <label className="field-group" htmlFor="principalExportTestId">
            <span>Test ID</span>
            <input
              id="principalExportTestId"
              value={principalTestId}
              onChange={(event) => setPrincipalTestId(event.target.value)}
              placeholder="Enter assessment test ID"
            />
          </label>

          <div className="confirm-file-indicator">
            <span>Export Mode</span>
            <strong>Manual test ID entry</strong>
          </div>
        </div>

        <div className="table-actions">
          <button
            type="button"
            className="primary-button"
            disabled={isItemDownloadLoading}
            onClick={() => handleDownload('item')}
          >
            {isItemDownloadLoading ? 'Downloading...' : 'Download Item Analysis Excel'}
          </button>
          <button
            type="button"
            className="secondary-button"
            disabled={isLmsDownloadLoading}
            onClick={() => handleDownload('lms')}
          >
            {isLmsDownloadLoading ? 'Downloading...' : 'Download LMS Excel'}
          </button>
        </div>
      </section>
    </div>
  )
}

export default ExportReportsPage

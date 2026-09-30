import { useEffect, useState } from 'react'
import { Archive, ClipboardList, LoaderCircle } from 'lucide-react'
import { getAssessmentReferenceDataV3, getAssessmentsV3, restoreAssessmentV3 } from '../api/apiV3Client'

function getClassAssignmentLabel(assignment) {
  if (!assignment) {
    return 'Class not assigned'
  }

  const classLabel = `${assignment.gradeLevelName || 'Grade level'} - ${
    assignment.sectionName || 'Section'
  }`

  return assignment.subjectName ? `${classLabel} · ${assignment.subjectName}` : classLabel
}

function isArchivedAssessment(assessment) {
  return String(assessment?.testStatus ?? assessment?.status ?? '').toLowerCase() === 'archived'
}

function formatArchivedDate(assessment) {
  const value = assessment?.updatedAt || assessment?.archivedAt
  if (!value) return ''

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

async function fetchArchivedGroups(token) {
  const referenceData = await getAssessmentReferenceDataV3({}, token)
  const assignments = referenceData.classAssignments ?? referenceData.assignments ?? []

  const perClassResults = await Promise.all(
    assignments.map(async (assignment) => {
      const records = await getAssessmentsV3(token, assignment.classAssignmentId)
      return { assignment, archived: records.filter(isArchivedAssessment) }
    }),
  )

  return perClassResults.filter((group) => group.archived.length > 0)
}

function ArchivedAssessmentsPanel({ token }) {
  const [groups, setGroups] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [restoringId, setRestoringId] = useState(null)
  const [restoreError, setRestoreError] = useState('')

  useEffect(() => {
    let active = true

    async function load() {
      setIsLoading(true)
      setError('')

      try {
        const nextGroups = await fetchArchivedGroups(token)
        if (active) setGroups(nextGroups)
      } catch (loadError) {
        if (active) setError(loadError.message || 'Unable to load archived assessments.')
      } finally {
        if (active) setIsLoading(false)
      }
    }

    load()
    return () => {
      active = false
    }
  }, [token])

  const handleRestore = async (assessment) => {
    if (restoringId) return

    setRestoringId(assessment.id)
    setRestoreError('')

    try {
      await restoreAssessmentV3(assessment.id, token)
      const nextGroups = await fetchArchivedGroups(token)
      setGroups(nextGroups)
    } catch (restoreErrorCause) {
      setRestoreError(restoreErrorCause.message || 'Unable to restore this assessment.')
    } finally {
      setRestoringId(null)
    }
  }

  const totalArchived = groups.reduce((sum, group) => sum + group.archived.length, 0)

  return (
    <section className="content-card archived-assessments-panel" aria-labelledby="archivedAssessmentsTitle">
      <div className="archived-assessments-header">
        <div>
          <p className="content-card-tag">Archived</p>
          <h2 id="archivedAssessmentsTitle">Archived Assessments</h2>
        </div>
        {!isLoading && !error ? (
          <span className="status-pill status-archived">{totalArchived} archived</span>
        ) : null}
      </div>

      {isLoading ? <p className="archived-assessments-empty">Loading archived assessments...</p> : null}

      {!isLoading && error ? (
        <p className="form-message form-message-error">{error}</p>
      ) : null}

      {!isLoading && !error && restoreError ? (
        <p className="form-message form-message-error">{restoreError}</p>
      ) : null}

      {!isLoading && !error && !groups.length ? (
        <div className="archived-assessments-empty">
          <span aria-hidden="true">
            <Archive size={20} />
          </span>
          <p>No archived assessments yet. Assessments you archive from a class will show up here.</p>
        </div>
      ) : null}

      {!isLoading && !error && groups.length
        ? groups.map((group) => (
            <div className="archived-assessments-group" key={group.assignment.classAssignmentId}>
              <h3>{getClassAssignmentLabel(group.assignment)}</h3>
              <ul className="archived-assessments-list">
                {group.archived.map((assessment) => (
                  <li key={assessment.id} className="archived-assessments-row">
                    <span className="archived-assessments-icon" aria-hidden="true">
                      <ClipboardList size={16} strokeWidth={2.2} />
                    </span>
                    <div className="archived-assessments-copy">
                      <strong>{assessment.testName || 'Untitled assessment'}</strong>
                      <small>
                        {formatArchivedDate(assessment)
                          ? `Archived ${formatArchivedDate(assessment)}`
                          : 'Archived'}
                      </small>
                    </div>
                    <button
                      type="button"
                      className="secondary-button"
                      disabled={Boolean(restoringId)}
                      title="Move this assessment back to Draft in its class."
                      onClick={() => handleRestore(assessment)}
                    >
                      {restoringId === assessment.id ? (
                        <LoaderCircle size={14} className="animate-spin" aria-hidden="true" />
                      ) : null}
                      {restoringId === assessment.id ? 'Restoring...' : 'Restore'}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))
        : null}
    </section>
  )
}

export default ArchivedAssessmentsPanel

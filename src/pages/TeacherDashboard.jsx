import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  BookOpen,
  CalendarClock,
  ClipboardCheck,
  FilePenLine,
  RefreshCw,
  UsersRound,
} from 'lucide-react'
import {
  getAssessmentReferenceDataV3,
  getAssessmentsV3,
  getTeacherClassStudentsV3,
} from '../api/apiV3Client'

function formatClassName(assignment) {
  return [
    assignment?.gradeLevelName || 'Grade level',
    assignment?.sectionName || 'Section',
  ]
    .filter(Boolean)
    .join(' - ')
}

function normalizeMatchText(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function getClassSectionKey(assignment) {
  if (!assignment) {
    return 'unassigned'
  }

  if (assignment.sectionId) {
    return `section:${assignment.sectionId}|year:${assignment.yearName || ''}`
  }

  return [
    assignment.gradeLevelName || '',
    assignment.sectionName || '',
    assignment.yearName || '',
  ]
    .map(normalizeMatchText)
    .join('|')
}

function formatStatus(value) {
  const status = String(value ?? 'draft').trim().toLowerCase()
  return status ? status.replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase()) : 'Draft'
}

function formatLocalDateTime(value) {
  if (!value) return ''

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function getAssessmentSchedule(assessment) {
  const closesAt = assessment.closeAt ?? assessment.closesAt
  const opensAt = assessment.openAt ?? assessment.opensAt

  if (closesAt) {
    const formattedClose = formatLocalDateTime(closesAt)
    return formattedClose ? `Closes ${formattedClose}` : 'Closing schedule unavailable'
  }

  if (opensAt) {
    const formattedOpen = formatLocalDateTime(opensAt)
    return formattedOpen ? `Opens ${formattedOpen}` : 'Opening schedule unavailable'
  }

  return 'No schedule'
}

function getAssessmentTimestamp(assessment) {
  const value =
    assessment.updatedAt ??
    assessment.createdAt ??
    assessment.openAt ??
    assessment.opensAt ??
    assessment.testDate
  const timestamp = value ? new Date(value).getTime() : 0
  return Number.isNaN(timestamp) ? 0 : timestamp
}

function isArchivedAssessment(assessment) {
  return String(assessment?.status ?? assessment?.testStatus ?? '').toLowerCase() === 'archived'
}

function isActiveClassAssignment(assignment) {
  const status = String(assignment?.status ?? '').trim().toLowerCase()
  return !status || status === 'active'
}

function TeacherDashboard({ token, onNavigate }) {
  const [classAssignments, setClassAssignments] = useState([])
  const [classStudentCounts, setClassStudentCounts] = useState({})
  const [assessments, setAssessments] = useState([])
  const [assessmentsAvailable, setAssessmentsAvailable] = useState(true)
  const [pageError, setPageError] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  const teacherClassGroups = useMemo(() => {
    const groupedAssignments = new Map()

    classAssignments.forEach((assignment) => {
      const groupKey = getClassSectionKey(assignment)

      if (!groupedAssignments.has(groupKey)) {
        groupedAssignments.set(groupKey, {
          groupKey,
          primaryAssignment: assignment,
          assignments: [assignment],
        })
        return
      }

      groupedAssignments.get(groupKey).assignments.push(assignment)
    })

    return Array.from(groupedAssignments.values())
  }, [classAssignments])

  const assignmentById = useMemo(
    () =>
      new Map(
        classAssignments.map((assignment) => [
          String(assignment.classAssignmentId),
          assignment,
        ]),
      ),
    [classAssignments],
  )

  const totalStudents = useMemo(
    () =>
      teacherClassGroups.reduce(
        (total, group) =>
          total + (classStudentCounts[String(group.primaryAssignment.classId)] ?? 0),
        0,
      ),
    [classStudentCounts, teacherClassGroups],
  )

  const recentAssessments = useMemo(
    () =>
      [...assessments]
        .sort((left, right) => getAssessmentTimestamp(right) - getAssessmentTimestamp(left))
        .slice(0, 5),
    [assessments],
  )

  const draftAssessments = useMemo(
    () =>
      assessments
        .filter(
          (assessment) =>
            String(assessment.status ?? assessment.testStatus ?? '').toLowerCase() === 'draft',
        )
        .slice(0, 4),
    [assessments],
  )

  const loadDashboardData = useCallback(async () => {
    setIsLoading(true)
    setPageError('')

    try {
      const referenceResult = await getAssessmentReferenceDataV3({}, token)

      const assignments = (referenceResult.classAssignments ?? []).filter(isActiveClassAssignment)
      setClassAssignments(assignments)

      const classIds = [
        ...new Set(assignments.map((assignment) => assignment.classId).filter(Boolean)),
      ]
      const [rosterResults, assessmentResults] = await Promise.all([
        Promise.allSettled(
          classIds.map((classId) => getTeacherClassStudentsV3(classId, token)),
        ),
        Promise.allSettled(
          assignments.map((assignment) =>
            getAssessmentsV3(token, assignment.classAssignmentId),
          ),
        ),
      ])
      const nextCounts = {}
      classIds.forEach((classId, index) => {
        const result = rosterResults[index]
        nextCounts[String(classId)] =
          result.status === 'fulfilled' ? result.value.length : 0
      })
      setClassStudentCounts(nextCounts)
      setAssessments(
        assessmentResults
          .flatMap((result) => (result.status === 'fulfilled' ? result.value : []))
          .filter((assessment) => !isArchivedAssessment(assessment)),
      )
      setAssessmentsAvailable(
        assessmentResults.every((result) => result.status === 'fulfilled'),
      )
    } catch (error) {
      setClassAssignments([])
      setClassStudentCounts({})
      setAssessments([])
      setAssessmentsAvailable(false)

      if (!error?.isAuthenticationFailure) {
        setPageError(
          error?.message === 'Failed to fetch'
            ? 'Unable to connect to the assessment service. Please try again.'
            : error?.message || 'Unable to load the teacher dashboard.',
        )
      }
    }

    setIsLoading(false)
  }, [token])

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    loadDashboardData()
  }, [loadDashboardData])
  /* eslint-enable react-hooks/set-state-in-effect */

  const openAssessment = (assessment) => {
    const assignment = assignmentById.get(String(assessment.classAssignmentId))

    onNavigate('assessment-setup', {
      classId: assignment?.classId ?? assessment.classId,
      classAssignmentId: assessment.classAssignmentId,
      assessmentId: assessment.testId,
    })
  }

  return (
    <div className="content-stack teacher-dashboard-page smart-ui">
      <h1 className="dashboard-visually-hidden">Teacher dashboard</h1>
      <div className="teacher-dashboard-summary">
        <section className="teacher-dashboard-overview-grid" aria-label="Teacher summary">
          <article>
            <span className="teacher-dashboard-overview-icon" aria-hidden="true">
              <BookOpen size={18} strokeWidth={2.3} />
            </span>
            <div>
              <span>Assigned classes</span>
              <strong>{isLoading ? '...' : teacherClassGroups.length}</strong>
            </div>
          </article>
          <article>
            <span className="teacher-dashboard-overview-icon" aria-hidden="true">
              <UsersRound size={18} strokeWidth={2.3} />
            </span>
            <div>
              <span>Total students</span>
              <strong>{isLoading ? '...' : totalStudents}</strong>
            </div>
          </article>
          <article>
            <span className="teacher-dashboard-overview-icon" aria-hidden="true">
              <ClipboardCheck size={18} strokeWidth={2.3} />
            </span>
            <div>
              <span>Created assessments</span>
              <strong>
                {isLoading ? '...' : assessmentsAvailable ? assessments.length : 'Not available'}
              </strong>
            </div>
          </article>
        </section>
        <button
          type="button"
          className="teacher-dashboard-refresh"
          onClick={loadDashboardData}
          disabled={isLoading}
        >
          <RefreshCw size={16} aria-hidden="true" />
          <span>{isLoading ? 'Refreshing...' : 'Refresh'}</span>
        </button>
      </div>

      {pageError ? <p className="form-message form-message-error">{pageError}</p> : null}

      <div className="teacher-dashboard-workspace-grid">
        <section
          className="teacher-dashboard-panel teacher-dashboard-assessment-panel"
          aria-labelledby="assessmentActivityHeading"
        >
          <div className="teacher-dashboard-panel-heading">
            <h2 id="assessmentActivityHeading">Recent assessment activity</h2>
            <button
              type="button"
              className="teacher-dashboard-text-action"
              onClick={() => onNavigate('class-records', { initialTab: 'assessment' })}
            >
              View all
              <ArrowRight size={15} aria-hidden="true" />
            </button>
          </div>

          {isLoading ? (
            <div className="teacher-dashboard-empty-state">Loading assessments...</div>
          ) : null}

          {!isLoading && !assessmentsAvailable ? (
            <div className="teacher-dashboard-empty-state">
              Assessment activity is currently unavailable.
            </div>
          ) : null}

          {!isLoading && assessmentsAvailable && recentAssessments.length === 0 ? (
            <div className="teacher-dashboard-empty-state">
              <ClipboardCheck size={22} strokeWidth={1.8} aria-hidden="true" />
              <strong>No assessments yet</strong>
            </div>
          ) : null}

          {recentAssessments.length > 0 ? (
            <ul className="teacher-dashboard-assessment-list">
              {recentAssessments.map((assessment) => {
                const assignment = assignmentById.get(String(assessment.classAssignmentId))
                const status = String(
                  assessment.status ?? assessment.testStatus ?? 'draft',
                ).toLowerCase()

                return (
                  <li key={assessment.testId}>
                    <button type="button" onClick={() => openAssessment(assessment)}>
                      <span className="teacher-dashboard-assessment-icon" aria-hidden="true">
                        <FilePenLine size={17} strokeWidth={2.1} />
                      </span>
                      <span className="teacher-dashboard-assessment-copy">
                        <strong>{assessment.testName || 'Untitled assessment'}</strong>
                        <span>
                          {assignment
                            ? `${formatClassName(assignment)} | ${assignment.subjectName || 'Subject'}`
                            : 'Class assignment unavailable'}
                        </span>
                        <small>{getAssessmentSchedule(assessment)}</small>
                      </span>
                      <span className={`teacher-dashboard-assessment-status is-${status}`}>
                        {formatStatus(status)}
                      </span>
                      <ArrowRight size={16} aria-hidden="true" />
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : null}
        </section>

        <div className="teacher-dashboard-side-column">
          <section className="teacher-dashboard-panel" aria-labelledby="attentionHeading">
            <div className="teacher-dashboard-panel-heading">
              <h2 id="attentionHeading">Needs attention</h2>
              <span className="teacher-dashboard-panel-icon" aria-hidden="true">
                <CalendarClock size={18} strokeWidth={2.1} />
              </span>
            </div>

            {!isLoading && assessmentsAvailable && draftAssessments.length > 0 ? (
              <ul className="teacher-dashboard-attention-list">
                {draftAssessments.map((assessment) => (
                  <li key={assessment.testId}>
                    <button type="button" onClick={() => openAssessment(assessment)}>
                      <span>
                        <strong>{assessment.testName || 'Untitled assessment'}</strong>
                        <small>Draft assessment</small>
                      </span>
                      <ArrowRight size={15} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}

            {!isLoading && assessmentsAvailable && draftAssessments.length === 0 ? (
              <div className="teacher-dashboard-compact-empty">No draft assessments need attention.</div>
            ) : null}

            {!isLoading && !assessmentsAvailable ? (
              <div className="teacher-dashboard-compact-empty">Work queue unavailable.</div>
            ) : null}

            {isLoading ? (
              <div className="teacher-dashboard-compact-empty">Loading work queue...</div>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  )
}

export default TeacherDashboard

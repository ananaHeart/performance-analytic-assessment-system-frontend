import { useCallback, useEffect, useMemo, useState } from 'react'
import { BookOpen, ClipboardCheck, RefreshCw, UsersRound } from 'lucide-react'
import {
  getAssessmentReferenceDataV2,
  getAssessmentsV2,
} from '../api/apiV2Client'

function formatClassName(assignment) {
  return [
    assignment.gradeLevelName || 'Grade level',
    assignment.sectionName || 'Section',
  ]
    .filter(Boolean)
    .join(' - ')
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

function normalizeMatchText(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function TeacherDashboard({ token, onNavigate }) {
  const [classAssignments, setClassAssignments] = useState([])
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

  const loadDashboardData = useCallback(async () => {
    setIsLoading(true)
    setPageError('')

    const [referenceResult, assessmentResult] = await Promise.allSettled([
      getAssessmentReferenceDataV2({}, token),
      getAssessmentsV2(token),
    ])

    if (referenceResult.status === 'fulfilled') {
      setClassAssignments(referenceResult.value.classAssignments ?? [])
    } else {
      setClassAssignments([])

      if (!referenceResult.reason?.isAuthenticationFailure) {
        setPageError(
          referenceResult.reason?.message === 'Failed to fetch'
            ? 'Unable to connect to the assessment service. Please try again.'
            : referenceResult.reason?.message || 'Unable to load assigned classes.',
        )
      }
    }

    if (assessmentResult.status === 'fulfilled') {
      setAssessments(assessmentResult.value)
      setAssessmentsAvailable(true)
    } else {
      setAssessments([])
      setAssessmentsAvailable(false)
    }

    setIsLoading(false)
  }, [token])

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    loadDashboardData()
  }, [loadDashboardData])
  /* eslint-enable react-hooks/set-state-in-effect */

  return (
    <div className="content-stack teacher-dashboard-page">
      <section className="teacher-profile-header">
        <div className="teacher-dashboard-overview-grid">
          <article>
            <span className="teacher-dashboard-overview-icon" aria-hidden="true">
              <UsersRound size={18} strokeWidth={2.3} />
            </span>
            <div>
              <span>Total Students</span>
              <strong>{isLoading ? '...' : 'Pending setup'}</strong>
            </div>
          </article>
          <article>
            <span className="teacher-dashboard-overview-icon" aria-hidden="true">
              <ClipboardCheck size={18} strokeWidth={2.3} />
            </span>
            <div>
              <span>Created Assessments</span>
              <strong>
                {isLoading ? '...' : assessmentsAvailable ? assessments.length : 'Not available'}
              </strong>
            </div>
          </article>
          <article>
            <span className="teacher-dashboard-overview-icon" aria-hidden="true">
              <RefreshCw size={18} strokeWidth={2.3} />
            </span>
            <div>
              <span>Recent Sync Activity</span>
              <strong>{isLoading ? 'Loading...' : 'Pending sync data'}</strong>
            </div>
          </article>
        </div>
      </section>

      {pageError ? <p className="form-message form-message-error">{pageError}</p> : null}

      <section className="teacher-classes-section" aria-labelledby="teacherClassesHeading">
        <div className="teacher-classes-heading-row">
          <h2 id="teacherClassesHeading">Classes</h2>
          {teacherClassGroups.length ? (
            <button
              type="button"
              className="teacher-view-students-link"
              onClick={() =>
                onNavigate('class-records', {
                  classId: teacherClassGroups[0].primaryAssignment.classId,
                  initialTab: 'students',
                })
              }
            >
              View students
            </button>
          ) : null}
        </div>

        <div className="teacher-classes-grid">
          {teacherClassGroups.map((group) => {
            const assignment = group.primaryAssignment

            return (
              <button
                type="button"
                className="teacher-class-card"
                key={group.groupKey}
                onClick={() => onNavigate('class-records', { classId: assignment.classId })}
              >
                <span className="teacher-class-icon" aria-hidden="true">
                  <BookOpen size={18} strokeWidth={2.3} />
                </span>
                <strong>{formatClassName(assignment)}</strong>
                <small>Roster pending</small>
              </button>
            )
          })}

          {!isLoading && !teacherClassGroups.length ? (
            <p className="supporting-text teacher-classes-empty">
              No class sections are assigned to this teacher yet.
            </p>
          ) : null}
        </div>
      </section>

      <footer className="teacher-dashboard-footer">
        <span>Performance Analytics Assessment System</span>
        <div>
          <button type="button">Privacy Policy</button>
          <button type="button">Terms of Service</button>
          <button type="button">Support</button>
        </div>
      </footer>
    </div>
  )
}

export default TeacherDashboard

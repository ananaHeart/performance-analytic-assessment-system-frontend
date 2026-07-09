import { useEffect, useMemo, useState } from 'react'
import { ClipboardCheck, GraduationCap, UsersRound } from 'lucide-react'
import {
  getClassAssignments,
  getManualStudents,
  getSyncActivity,
  getTeacherAccounts,
  getTeacherAssessments,
} from '../api/apiClient'

function getPrincipalName(user) {
  return user.name || [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Principal'
}

function getAssessmentTimestamp(assessment) {
  const timestamp = Date.parse(assessment.testDate)
  return Number.isNaN(timestamp) ? 0 : timestamp
}

function getClassLabel(assessment, assignment) {
  const gradeLevelName = assessment.gradeLevelName || assignment?.gradeLevelName || ''
  const sectionName = assessment.sectionName || assignment?.sectionName || ''
  return [gradeLevelName, sectionName].filter(Boolean).join(' ') || 'Unassigned class'
}

function normalizeMatchText(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function isSuccessfulSyncActivity(activity) {
  const details = normalizeMatchText(activity.details)

  return !details || details.includes('success') || details.includes('completed') || details.includes('synced')
}

function isAssessmentSyncActivity(assessment, activity) {
  if (!isSuccessfulSyncActivity(activity)) {
    return false
  }

  if (activity.id && assessment.id && String(activity.id) === String(assessment.id)) {
    return true
  }

  return Boolean(
    assessment.testName &&
      activity.activity &&
      normalizeMatchText(assessment.testName) === normalizeMatchText(activity.activity),
  )
}

function getAutomaticAssessmentStatus(assessment, syncActivity = []) {
  return syncActivity.some((activity) => isAssessmentSyncActivity(assessment, activity))
    ? 'Completed'
    : 'Active'
}

function getStatusClass(status) {
  const normalizedStatus = String(status || '').trim().toLowerCase()

  if (['completed', 'complete', 'done'].includes(normalizedStatus)) {
    return 'completed'
  }

  if (['active', 'ongoing', 'in progress'].includes(normalizedStatus)) {
    return 'ongoing'
  }

  if (['pending', 'draft'].includes(normalizedStatus)) {
    return 'pending'
  }

  return 'recorded'
}

function PrincipalDashboard({ user, token, onNavigate }) {
  const displayName = getPrincipalName(user)
  const [teachers, setTeachers] = useState([])
  const [students, setStudents] = useState([])
  const [assessments, setAssessments] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [warning, setWarning] = useState('')

  useEffect(() => {
    let isMounted = true

    async function loadDashboardData() {
      setIsLoading(true)
      setError('')
      setWarning('')

      try {
        const [teacherList, studentList, assignmentList] = await Promise.all([
          getTeacherAccounts(token),
          getManualStudents(),
          getClassAssignments(),
        ])

        const assignmentByClassId = new Map(
          assignmentList
            .filter((assignment) => assignment.classId)
            .map((assignment) => [String(assignment.classId), assignment]),
        )

        const assessmentResults = await Promise.allSettled(
          teacherList
            .filter((teacher) => teacher.id)
            .map(async (teacher) => {
              const [teacherAssessments, syncActivity] = await Promise.all([
                getTeacherAssessments(teacher.id),
                getSyncActivity(teacher.id).catch(() => []),
              ])

              return teacherAssessments.map((assessment) => {
                const assignment = assignmentByClassId.get(String(assessment.classId))

                return {
                  ...assessment,
                  testStatus: getAutomaticAssessmentStatus(assessment, syncActivity),
                  teacherId: teacher.id,
                  teacherName: teacher.name || teacher.email || 'Teacher',
                  className: getClassLabel(assessment, assignment),
                }
              })
            }),
        )

        const loadedAssessments = assessmentResults.flatMap((result) =>
          result.status === 'fulfilled' ? result.value : [],
        )

        if (!isMounted) {
          return
        }

        setTeachers(teacherList)
        setStudents(studentList)
        setAssessments(
          loadedAssessments.sort(
            (firstAssessment, secondAssessment) =>
              getAssessmentTimestamp(secondAssessment) - getAssessmentTimestamp(firstAssessment) ||
              Number(secondAssessment.id ?? 0) - Number(firstAssessment.id ?? 0),
          ),
        )

        if (assessmentResults.some((result) => result.status === 'rejected')) {
          setWarning('Some teacher assessment records could not be loaded from the API.')
        }
      } catch (loadError) {
        if (!isMounted) {
          return
        }

        setTeachers([])
        setStudents([])
        setAssessments([])
        setError(loadError.message || 'Unable to load principal dashboard data.')
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadDashboardData()

    return () => {
      isMounted = false
    }
  }, [token])

  const activeTeacherCount = useMemo(
    () => teachers.filter((teacher) => teacher.status === 'active').length,
    [teachers],
  )

  const dashboardStats = [
    {
      label: 'Active Teachers',
      value: isLoading ? '...' : activeTeacherCount,
      icon: UsersRound,
      tone: 'green',
    },
    {
      label: 'Total Students',
      value: isLoading ? '...' : students.length,
      icon: GraduationCap,
      tone: 'blue',
    },
    {
      label: 'Assessment Conducted',
      value: isLoading ? '...' : assessments.length,
      icon: ClipboardCheck,
      tone: 'orange',
    },
  ]

  const recentAssessments = assessments.slice(0, 5)

  return (
    <div className="principal-dashboard-page">
      <section className="principal-dashboard-heading">
        <h2>Welcome back, {displayName}</h2>
        <p>Here is a summary of the assessment activities in your school today.</p>
      </section>

      {error ? <p className="form-message form-message-error">{error}</p> : null}
      {warning ? <p className="form-message form-message-warning">{warning}</p> : null}

      <section className="principal-stat-grid" aria-label="School summary">
        {dashboardStats.map((stat) => {
          const StatIcon = stat.icon

          return (
            <article className="principal-stat-card" key={stat.label}>
              <span className={`principal-stat-icon principal-stat-icon-${stat.tone}`}>
                <StatIcon size={21} strokeWidth={2.2} aria-hidden="true" />
              </span>
              <div>
                <p>{stat.label}</p>
                <strong>{stat.value}</strong>
              </div>
            </article>
          )
        })}
      </section>

      <section className="principal-recent-panel" aria-labelledby="recentAssessmentsHeading">
        <div className="principal-recent-header">
          <h3 id="recentAssessmentsHeading">Recent Assessments</h3>
          <button type="button" onClick={() => onNavigate('class-records')}>
            View All
          </button>
        </div>

        <div className="principal-recent-table-wrap">
          <table className="principal-recent-table">
            <thead>
              <tr>
                <th>Assessment</th>
                <th>Teacher</th>
                <th>Class</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan="5" className="principal-table-empty">
                    Loading assessment records...
                  </td>
                </tr>
              ) : null}

              {!isLoading && !recentAssessments.length ? (
                <tr>
                  <td colSpan="5" className="principal-table-empty">
                    No assessments found in the database yet.
                  </td>
                </tr>
              ) : null}

              {!isLoading
                ? recentAssessments.map((assessment) => {
                    const status = assessment.testStatus || 'Active'

                    return (
                      <tr key={assessment.id ?? `${assessment.teacherId}-${assessment.testName}`}>
                        <td>
                          <strong>{assessment.testName}</strong>
                        </td>
                        <td>{assessment.teacherName}</td>
                        <td>{assessment.className}</td>
                        <td>
                          <span
                            className={`principal-assessment-status status-${getStatusClass(
                              status,
                            )}`}
                          >
                            {status}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="principal-table-action"
                            onClick={() => onNavigate('analytics')}
                          >
                            View
                          </button>
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

export default PrincipalDashboard

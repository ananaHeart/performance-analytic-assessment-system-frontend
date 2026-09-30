import { useEffect, useMemo, useState } from 'react'
import { ClipboardCheck, GraduationCap, UsersRound } from 'lucide-react'
import {
  getAssessmentResultsReportV3,
  getClassesV3,
  getPrincipalClassStudentsV3,
  getReportReferenceDataV3,
  getTeacherAccountsV3,
} from '../api/apiV3Client'

function getPrincipalName(user) {
  return user.name || [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Principal'
}

function isArchivedAssessment(assessment) {
  return String(assessment?.status ?? '').trim().toLowerCase() === 'archived'
}

function formatAssessmentDate(value) {
  if (!value) return ''
  const parsedDate = new Date(value)
  return Number.isNaN(parsedDate.getTime())
    ? ''
    : parsedDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function PrincipalDashboard({ user, token, onNavigate }) {
  const displayName = getPrincipalName(user)
  const [teachers, setTeachers] = useState([])
  const [students, setStudents] = useState([])
  const [isLoadingTeachers, setIsLoadingTeachers] = useState(true)
  const [isLoadingStudents, setIsLoadingStudents] = useState(true)
  const [teacherLoadWarning, setTeacherLoadWarning] = useState('')
  const [studentLoadWarning, setStudentLoadWarning] = useState('')
  const [conductedAssessments, setConductedAssessments] = useState([])
  const [isLoadingAssessments, setIsLoadingAssessments] = useState(true)
  const [assessmentLoadWarning, setAssessmentLoadWarning] = useState('')

  useEffect(() => {
    let isMounted = true

    async function loadConductedAssessments() {
      setIsLoadingAssessments(true)
      setAssessmentLoadWarning('')

      try {
        const referenceData = await getReportReferenceDataV3(token)
        if (!isMounted) return

        const classById = new Map(
          referenceData.classes.map((classRecord) => [String(classRecord.classId), classRecord]),
        )
        const classAssignmentById = new Map(
          referenceData.classAssignments.map((assignment) => [
            String(assignment.classAssignmentId),
            assignment,
          ]),
        )
        const teacherNameById = new Map(
          referenceData.teachers.map((teacher) => [String(teacher.teacherUserId), teacher.fullName]),
        )

        const activeAssessments = referenceData.assessments.filter(
          (assessment) => !isArchivedAssessment(assessment),
        )

        const resultReports = await Promise.allSettled(
          activeAssessments.map((assessment) =>
            getAssessmentResultsReportV3(assessment.testId, assessment.classAssignmentId, token),
          ),
        )

        if (!isMounted) return

        if (resultReports.some((report) => report.status === 'rejected')) {
          setAssessmentLoadWarning('Some assessment records could not be loaded. The list may be incomplete.')
        }

        const conducted = activeAssessments
          .map((assessment, index) => {
            const report = resultReports[index]
            return {
              ...assessment,
              dataStatus: report.status === 'fulfilled' ? report.value?.dataStatus : null,
            }
          })
          .filter(
            (assessment) => assessment.dataStatus === 'available' || assessment.dataStatus === 'partial',
          )
          .sort((left, right) => new Date(right.openAt ?? 0) - new Date(left.openAt ?? 0))
          .map((assessment) => {
            const classAssignment = classAssignmentById.get(String(assessment.classAssignmentId))
            const classRecord = classAssignment
              ? classById.get(String(classAssignment.classId))
              : null
            return {
              ...assessment,
              teacherName:
                teacherNameById.get(String(classAssignment?.teacherUserId)) || 'Unassigned',
              className: classRecord
                ? [classRecord.gradeLevelName, classRecord.sectionName].filter(Boolean).join(' - ')
                : 'Class unavailable',
              reportFilters: {
                reportType: 'principal_consolidated',
                academicYearId: classAssignment?.academicYearId ?? '',
                termPeriodId: assessment.termPeriodId ?? '',
                gradeLevelId: classRecord?.gradeLevelId ?? '',
                classId: classAssignment?.classId ?? '',
                teacherUserId: classAssignment?.teacherUserId ?? '',
                subjectId: classAssignment?.subjectId ?? '',
                testId: assessment.testId,
              },
            }
          })

        setConductedAssessments(conducted)
      } catch (loadError) {
        if (!isMounted) return
        setConductedAssessments([])
        if (!loadError.isAuthenticationFailure && loadError.status !== 401) {
          setAssessmentLoadWarning('Assessment summary is temporarily unavailable.')
        }
      } finally {
        if (isMounted) setIsLoadingAssessments(false)
      }
    }

    loadConductedAssessments()

    return () => {
      isMounted = false
    }
  }, [token])

  useEffect(() => {
    let isMounted = true

    async function loadDashboardSummary() {
      setIsLoadingTeachers(true)
      setIsLoadingStudents(true)
      setTeacherLoadWarning('')
      setStudentLoadWarning('')

      const [teacherResult, classResult] = await Promise.allSettled([
        getTeacherAccountsV3(token, 'active'),
        getClassesV3({}, token),
      ])

      if (!isMounted) {
        return
      }

      if (teacherResult.status === 'fulfilled') {
        setTeachers(teacherResult.value)
      } else {
        const loadError = teacherResult.reason
        setTeachers([])
        if (!loadError.isAuthenticationFailure && loadError.status !== 401) {
          setTeacherLoadWarning('Teacher account summary is temporarily unavailable.')
        }
      }

      if (classResult.status === 'fulfilled') {
        const activeClasses = classResult.value.filter(
          (classRecord) => String(classRecord.status ?? '').toLowerCase() === 'active',
        )
        const rosterResults = await Promise.allSettled(
          activeClasses.map((classRecord) =>
            getPrincipalClassStudentsV3(classRecord.classId, token),
          ),
        )

        if (!isMounted) return

        setStudents(
          rosterResults.flatMap((result) =>
            result.status === 'fulfilled' ? result.value : [],
          ),
        )

        const rosterFailure = rosterResults.find((result) => result.status === 'rejected')
        if (rosterFailure && !rosterFailure.reason?.isAuthenticationFailure) {
          setStudentLoadWarning('Some class rosters are temporarily unavailable.')
        }
      } else {
        const loadError = classResult.reason
        setStudents([])
        if (!loadError.isAuthenticationFailure && loadError.status !== 401) {
          setStudentLoadWarning('Student summary is temporarily unavailable.')
        }
      }

      setIsLoadingTeachers(false)
      setIsLoadingStudents(false)
    }

    loadDashboardSummary()

    return () => {
      isMounted = false
    }
  }, [token])

  const activeTeacherCount = useMemo(
    () =>
      teachers.filter(
        (teacher) => String(teacher.status || '').trim().toLowerCase() === 'active',
      ).length,
    [teachers],
  )
  const totalStudentCount = useMemo(() => {
    const uniqueStudents = new Set()

    students.forEach((student, index) => {
      const studentKey =
        student.studentId ?? student.id ?? student.studentLrn ?? student.classListId ?? index
      uniqueStudents.add(String(studentKey))
    })

    return uniqueStudents.size
  }, [students])
  const dashboardWarning = [teacherLoadWarning, studentLoadWarning, assessmentLoadWarning]
    .filter(Boolean)
    .join(' ')

  const dashboardStats = [
    {
      label: 'Active Teachers',
      value: isLoadingTeachers ? '...' : teacherLoadWarning ? 'Unavailable' : activeTeacherCount,
      icon: UsersRound,
      tone: 'green',
      isPlaceholder: Boolean(teacherLoadWarning),
    },
    {
      label: 'Total Students',
      value: isLoadingStudents ? '...' : studentLoadWarning ? 'Unavailable' : totalStudentCount,
      icon: GraduationCap,
      tone: 'blue',
      isPlaceholder: Boolean(studentLoadWarning),
    },
    {
      label: 'Assessment Conducted',
      value: isLoadingAssessments
        ? '...'
        : assessmentLoadWarning
          ? 'Unavailable'
          : conductedAssessments.length,
      icon: ClipboardCheck,
      tone: 'orange',
      isPlaceholder: Boolean(assessmentLoadWarning),
    },
  ]

  return (
    <div className="principal-dashboard-page">
      <section className="principal-dashboard-heading">
        <h2>Welcome back, {displayName}</h2>
        <p>Here is a summary of the available school setup information.</p>
      </section>

      {dashboardWarning ? (
        <p className="form-message form-message-warning" role="status">
          {dashboardWarning} Other dashboard sections are unaffected.
        </p>
      ) : null}

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
                <strong className={stat.isPlaceholder ? 'is-placeholder' : ''}>{stat.value}</strong>
              </div>
            </article>
          )
        })}
      </section>

      <section className="principal-recent-panel" aria-labelledby="recentAssessmentsHeading">
        <div className="principal-recent-header">
          <h3 id="recentAssessmentsHeading">Recent Assessments</h3>
        </div>

        <div className="principal-recent-table-wrap">
          <table className="principal-recent-table">
            <thead>
              <tr>
                <th>Assessment</th>
                <th>Teacher</th>
                <th>Class</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoadingAssessments ? (
                <tr>
                  <td colSpan="4" className="principal-table-empty">
                    Loading assessment records...
                  </td>
                </tr>
              ) : conductedAssessments.length ? (
                conductedAssessments.slice(0, 8).map((assessment) => (
                  <tr
                    key={assessment.testId}
                    className="principal-recent-row"
                    role="button"
                    tabIndex={0}
                    onClick={() => onNavigate?.('reports', assessment.reportFilters)}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter' && event.key !== ' ') return
                      event.preventDefault()
                      onNavigate?.('reports', assessment.reportFilters)
                    }}
                  >
                    <td>
                      <strong>{assessment.testName || 'Untitled assessment'}</strong>
                      {formatAssessmentDate(assessment.openAt) ? (
                        <small> {formatAssessmentDate(assessment.openAt)}</small>
                      ) : null}
                    </td>
                    <td>{assessment.teacherName}</td>
                    <td>{assessment.className}</td>
                    <td>
                      <span
                        className={`principal-assessment-status ${
                          assessment.dataStatus === 'available' ? 'status-completed' : 'status-ongoing'
                        }`}
                      >
                        {assessment.dataStatus === 'available' ? 'Completed' : 'Ongoing'}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" className="principal-table-empty">
                    Assessment records are not available yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

export default PrincipalDashboard

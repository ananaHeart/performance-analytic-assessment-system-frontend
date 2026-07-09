import { useCallback, useEffect, useMemo, useState } from 'react'
import { BookOpen, ClipboardCheck, RefreshCw, UsersRound } from 'lucide-react'
import {
  getClassAssignments,
  getManualStudents,
  getSyncActivity,
  getTeacherAssessments,
} from '../api/apiClient'

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
    return `section:${assignment.sectionId}|year:${assignment.academicYear || ''}`
  }

  return [
    assignment.gradeLevelName || '',
    assignment.sectionName || '',
    assignment.academicYear || '',
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

function valuesMatch(leftValue, rightValue) {
  const left = normalizeMatchText(leftValue)
  const right = normalizeMatchText(rightValue)

  return Boolean(left && right && left === right)
}

function formatRecentSync(activity) {
  if (!activity) {
    return 'No sync yet'
  }

  const timestamp = activity.timestamp ? new Date(activity.timestamp) : null
  const hasValidTimestamp = timestamp && !Number.isNaN(timestamp.getTime())

  if (!hasValidTimestamp) {
    return activity.activity || 'Sync recorded'
  }

  return `${activity.activity || 'Sync'} - ${timestamp.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })}, ${timestamp.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })}`
}

function studentBelongsToClass(student, assignment) {
  if (!student || !assignment) {
    return false
  }

  const hasSectionIds = student.sectionId && assignment.sectionId
  const sectionMatches = hasSectionIds
    ? Number(student.sectionId) === Number(assignment.sectionId)
    : valuesMatch(student.section, assignment.sectionName)

  if (!sectionMatches) {
    return false
  }

  const gradeMatches =
    !student.gradeLevel ||
    !assignment.gradeLevelName ||
    valuesMatch(student.gradeLevel, assignment.gradeLevelName)
  const yearMatches =
    !student.academicYear ||
    !assignment.academicYear ||
    valuesMatch(student.academicYear, assignment.academicYear)

  return gradeMatches && yearMatches
}

function TeacherDashboard({ user, onNavigate }) {
  const [classAssignments, setClassAssignments] = useState([])
  const [students, setStudents] = useState([])
  const [assessments, setAssessments] = useState([])
  const [syncActivities, setSyncActivities] = useState([])
  const [pageError, setPageError] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  const teacherAssignments = useMemo(
    () => classAssignments.filter((assignment) => Number(assignment.teacherId) === Number(user.id)),
    [classAssignments, user.id],
  )
  const teacherClassGroups = useMemo(() => {
    const groupedAssignments = new Map()

    teacherAssignments.forEach((assignment) => {
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
  }, [teacherAssignments])

  const assignedStudentCount = useMemo(() => {
    const studentMap = new Map()

    teacherClassGroups.forEach((group) => {
      students
        .filter((student) => studentBelongsToClass(student, group.primaryAssignment))
        .forEach((student) => {
          const key = student.id ?? student.studentLrn ?? student.name
          studentMap.set(String(key), student)
        })
    })

    return studentMap.size
  }, [students, teacherClassGroups])
  const recentSyncActivity = useMemo(() => {
    return [...syncActivities].sort((left, right) => {
      const leftTime = new Date(left.timestamp ?? 0).getTime()
      const rightTime = new Date(right.timestamp ?? 0).getTime()

      return (Number.isNaN(rightTime) ? 0 : rightTime) - (Number.isNaN(leftTime) ? 0 : leftTime)
    })[0] ?? null
  }, [syncActivities])

  const loadDashboardData = useCallback(async () => {
    setIsLoading(true)
    setPageError('')

    const [assignmentResult, studentResult, assessmentResult, syncResult] = await Promise.allSettled([
      getClassAssignments(),
      getManualStudents(),
      getTeacherAssessments(user.id),
      getSyncActivity(user.id),
    ])

    if (assignmentResult.status === 'fulfilled') {
      setClassAssignments(assignmentResult.value)
    } else {
      setPageError(assignmentResult.reason?.message || 'Unable to load assigned classes.')
    }

    if (studentResult.status === 'fulfilled') {
      setStudents(studentResult.value)
    } else {
      setStudents([])
    }

    if (assessmentResult.status === 'fulfilled') {
      setAssessments(assessmentResult.value)
    } else {
      setAssessments([])
    }

    if (syncResult.status === 'fulfilled') {
      setSyncActivities(syncResult.value)
    } else {
      setSyncActivities([])
    }

    setIsLoading(false)
  }, [user.id])

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
              <strong>{isLoading ? '...' : assignedStudentCount}</strong>
            </div>
          </article>
          <article>
            <span className="teacher-dashboard-overview-icon" aria-hidden="true">
              <ClipboardCheck size={18} strokeWidth={2.3} />
            </span>
            <div>
              <span>Created Assessments</span>
              <strong>{isLoading ? '...' : assessments.length}</strong>
            </div>
          </article>
          <article>
            <span className="teacher-dashboard-overview-icon" aria-hidden="true">
              <RefreshCw size={18} strokeWidth={2.3} />
            </span>
            <div>
              <span>Recent Sync Activity</span>
              <strong>{isLoading ? 'Loading...' : formatRecentSync(recentSyncActivity)}</strong>
            </div>
          </article>
        </div>
      </section>

      {pageError ? <p className="form-message form-message-error">{pageError}</p> : null}

      <section className="teacher-classes-section" aria-labelledby="teacherClassesHeading">
        <h2 id="teacherClassesHeading">Classes</h2>

        <div className="teacher-classes-grid">
          {teacherClassGroups.map((group) => {
            const assignment = group.primaryAssignment
            const studentCount = students.filter((student) =>
              studentBelongsToClass(student, assignment),
            ).length

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
                <small>
                  {isLoading
                    ? 'Loading students'
                    : `${studentCount} ${studentCount === 1 ? 'student' : 'students'}`}
                </small>
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

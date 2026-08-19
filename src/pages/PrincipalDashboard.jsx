import { useEffect, useMemo, useState } from 'react'
import { ClipboardCheck, GraduationCap, UsersRound } from 'lucide-react'
import { getTeacherAccountsV2 } from '../api/apiV2Client'

function getPrincipalName(user) {
  return user.name || [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Principal'
}

function PrincipalDashboard({ user, token }) {
  const displayName = getPrincipalName(user)
  const [teachers, setTeachers] = useState([])
  const [isLoadingTeachers, setIsLoadingTeachers] = useState(true)
  const [teacherLoadWarning, setTeacherLoadWarning] = useState('')

  useEffect(() => {
    let isMounted = true

    async function loadTeacherSummary() {
      setIsLoadingTeachers(true)
      setTeacherLoadWarning('')

      try {
        const teacherList = await getTeacherAccountsV2(token)

        if (isMounted) {
          setTeachers(teacherList)
        }
      } catch (loadError) {
        if (isMounted) {
          setTeachers([])
          if (loadError.isAuthenticationFailure || loadError.status === 401) {
            return
          }
          setTeacherLoadWarning(
            'Teacher account summary is temporarily unavailable. Other dashboard sections are unaffected.',
          )
        }
      } finally {
        if (isMounted) {
          setIsLoadingTeachers(false)
        }
      }
    }

    loadTeacherSummary()

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
      value: 'Pending setup',
      icon: GraduationCap,
      tone: 'blue',
      isPlaceholder: true,
    },
    {
      label: 'Assessment Conducted',
      value: 'Pending assessment results',
      icon: ClipboardCheck,
      tone: 'orange',
      isPlaceholder: true,
    },
  ]

  return (
    <div className="principal-dashboard-page">
      <section className="principal-dashboard-heading">
        <h2>Welcome back, {displayName}</h2>
        <p>Here is a summary of the available school setup information.</p>
      </section>

      {teacherLoadWarning ? (
        <p className="form-message form-message-warning" role="status">
          {teacherLoadWarning}
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
              <tr>
                <td colSpan="4" className="principal-table-empty">
                  Assessment records are not available yet.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

export default PrincipalDashboard

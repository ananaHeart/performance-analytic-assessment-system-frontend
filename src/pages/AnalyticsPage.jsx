import { useEffect, useMemo, useState } from 'react'
import {
  getClassAssignments,
  getGradeLevels,
  getItemAnalysis,
  getLms,
  getSchoolLms,
  getSections,
  getSubjects,
  getSyncActivity,
  getTeacherAssessments,
  getTeachers,
  getTrends,
} from '../api/apiClient'
import { VerticalMasteryChart } from '../components/AnalyticsCharts'

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

function parseNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const parsedValue = Number(value)

  return Number.isFinite(parsedValue) ? parsedValue : null
}

function clampPercent(value) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return null
  }

  return Math.max(0, Math.min(100, value))
}

function formatPercent(value) {
  const parsedValue = parseNumber(value)

  if (parsedValue === null) {
    return 'No data'
  }

  return `${Math.round(parsedValue)}%`
}

function formatDateTime(value) {
  if (!value) {
    return 'No timestamp'
  }

  const parsedDate = new Date(value)

  if (Number.isNaN(parsedDate.getTime())) {
    return value
  }

  return parsedDate.toLocaleString('en-US', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function getToneFromPercent(percent) {
  const parsedPercent = parseNumber(percent)

  if (parsedPercent === null) {
    return 'neutral'
  }

  if (parsedPercent >= 75) {
    return 'strong'
  }

  if (parsedPercent >= 50) {
    return 'warning'
  }

  return 'weak'
}

function getAverageMastery(records) {
  const values = records
    .map((record) => parseNumber(record.averageScore))
    .filter((value) => value !== null)

  if (!values.length) {
    return null
  }

  return values.reduce((total, value) => total + value, 0) / values.length
}

function getFilteredAssignments(assignments, filters) {
  return assignments.filter((assignment) => {
    if (filters.gradeLevelId && String(assignment.gradeLevelId) !== String(filters.gradeLevelId)) {
      return false
    }

    if (filters.sectionId && String(assignment.sectionId) !== String(filters.sectionId)) {
      return false
    }

    if (filters.teacherId && String(assignment.teacherId) !== String(filters.teacherId)) {
      return false
    }

    if (filters.subjectId && String(assignment.subjectId) !== String(filters.subjectId)) {
      return false
    }

    return true
  })
}

function AnalyticsPage({ user, role }) {
  const activeUser = user ?? readStoredUser()
  const effectiveRole = role ?? activeUser?.role ?? ''
  const teacherId = activeUser?.id

  const [gradeLevels, setGradeLevels] = useState([])
  const [sections, setSections] = useState([])
  const [teachers, setTeachers] = useState([])
  const [subjects, setSubjects] = useState([])
  const [classAssignments, setClassAssignments] = useState([])
  const [filters, setFilters] = useState({
    gradeLevelId: '',
    sectionId: '',
    teacherId: '',
    subjectId: '',
  })
  const [schoolLms, setSchoolLms] = useState([])
  const [gradeBars, setGradeBars] = useState([])
  const [principalAssessments, setPrincipalAssessments] = useState([])
  const [trends, setTrends] = useState([])
  const [syncActivity, setSyncActivity] = useState([])
  const [teacherAssessments, setTeacherAssessments] = useState([])
  const [selectedTestId, setSelectedTestId] = useState('')
  const [teacherLms, setTeacherLms] = useState([])
  const [itemAnalysis, setItemAnalysis] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAnalyticsLoading, setIsAnalyticsLoading] = useState(false)
  const [message, setMessage] = useState({ error: '', success: '' })

  const filteredAssignments = useMemo(
    () => getFilteredAssignments(classAssignments, filters),
    [classAssignments, filters],
  )
  const filteredClassIds = useMemo(
    () => new Set(filteredAssignments.map((assignment) => String(assignment.classId))),
    [filteredAssignments],
  )
  const selectedClassId =
    filteredAssignments.length === 1 ? filteredAssignments[0]?.classId : ''
  const totalAssessments = useMemo(() => {
    if (!Object.values(filters).some(Boolean)) {
      return principalAssessments.length
    }

    return principalAssessments.filter((assessment) =>
      filteredClassIds.has(String(assessment.classId)),
    ).length
  }, [filteredClassIds, filters, principalAssessments])
  const filteredSections = useMemo(() => {
    if (!filters.gradeLevelId) {
      return sections
    }

    return sections.filter((section) => {
      const sectionAssignment = classAssignments.find(
        (assignment) => String(assignment.sectionId) === String(section.id),
      )
      return String(sectionAssignment?.gradeLevelId) === String(filters.gradeLevelId)
    })
  }, [classAssignments, filters.gradeLevelId, sections])
  const selectedTeacherName =
    teachers.find((teacher) => String(teacher.id) === String(filters.teacherId))?.name ?? ''

  const handleFilterChange = (name, value) => {
    setFilters((currentFilters) => ({
      ...currentFilters,
      [name]: value,
      ...(name === 'gradeLevelId' ? { sectionId: '' } : {}),
    }))
  }

  const loadPrincipalReferenceData = async () => {
    setIsLoading(true)
    setMessage({ error: '', success: '' })

    try {
      const [gradeLevelRecords, sectionRecords, teacherRecords, subjectRecords, assignmentRecords] =
        await Promise.all([
          getGradeLevels(),
          getSections(),
          getTeachers(),
          getSubjects(),
          getClassAssignments(),
        ])

      const assessmentResults = await Promise.allSettled(
        teacherRecords
          .filter((teacher) => teacher.id)
          .map(async (teacher) => {
            const records = await getTeacherAssessments(teacher.id)
            return records.map((assessment) => ({
              ...assessment,
              teacherId: teacher.id,
              teacherName: teacher.name,
            }))
          }),
      )

      setGradeLevels(gradeLevelRecords)
      setSections(sectionRecords)
      setTeachers(teacherRecords)
      setSubjects(subjectRecords)
      setClassAssignments(assignmentRecords)
      setPrincipalAssessments(
        assessmentResults.flatMap((result) => (result.status === 'fulfilled' ? result.value : [])),
      )
    } catch (loadError) {
      setMessage({
        error: loadError.message || 'Unable to load analytics filter references.',
        success: '',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const loadPrincipalAnalytics = async () => {
    setIsAnalyticsLoading(true)
    setMessage({ error: '', success: '' })

    try {
      const [lmsRecords, gradeLevelResults, trendRecords, syncRecords] = await Promise.all([
        getSchoolLms(filters),
        Promise.all(
          gradeLevels.map(async (gradeLevel) => {
            const records = await getSchoolLms({
              ...filters,
              gradeLevelId: gradeLevel.id,
            })

            return {
              id: gradeLevel.id,
              label: gradeLevel.name,
              value: getAverageMastery(records),
            }
          }),
        ),
        selectedClassId ? getTrends(selectedClassId) : Promise.resolve([]),
        filters.teacherId ? getSyncActivity(filters.teacherId) : Promise.resolve([]),
      ])

      setSchoolLms(lmsRecords)
      setGradeBars(gradeLevelResults)
      setTrends(trendRecords)
      setSyncActivity(syncRecords)
    } catch (loadError) {
      setSchoolLms([])
      setGradeBars([])
      setTrends([])
      setSyncActivity([])
      setMessage({
        error: loadError.message || 'Unable to load filtered analytics data.',
        success: '',
      })
    } finally {
      setIsAnalyticsLoading(false)
    }
  }

  const loadTeacherAnalytics = async () => {
    if (!selectedTestId) {
      setTeacherLms([])
      setItemAnalysis([])
      return
    }

    setIsAnalyticsLoading(true)
    setMessage({ error: '', success: '' })

    try {
      const [lmsRecords, itemRecords] = await Promise.all([
        getLms(selectedTestId),
        getItemAnalysis(selectedTestId),
      ])

      setTeacherLms(lmsRecords)
      setItemAnalysis(itemRecords)
    } catch (loadError) {
      setTeacherLms([])
      setItemAnalysis([])
      setMessage({
        error: loadError.message || 'Unable to load teacher analytics.',
        success: '',
      })
    } finally {
      setIsAnalyticsLoading(false)
    }
  }

  const loadTeacherAssessments = async () => {
    if (!teacherId) {
      return
    }

    setIsLoading(true)
    setMessage({ error: '', success: '' })

    try {
      const records = await getTeacherAssessments(teacherId)
      setTeacherAssessments(records)
      setSelectedTestId((currentValue) => currentValue || String(records[0]?.id ?? ''))
    } catch (loadError) {
      setMessage({
        error: loadError.message || 'Unable to load teacher assessments.',
        success: '',
      })
    } finally {
      setIsLoading(false)
    }
  }

  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  useEffect(() => {
    if (effectiveRole === 'principal') {
      loadPrincipalReferenceData()
      return
    }

    if (effectiveRole === 'teacher') {
      loadTeacherAssessments()
      return
    }

    setIsLoading(false)
  }, [effectiveRole, teacherId])

  useEffect(() => {
    if (effectiveRole === 'principal' && gradeLevels.length) {
      loadPrincipalAnalytics()
    }
  }, [effectiveRole, filters, gradeLevels.length, selectedClassId])

  useEffect(() => {
    if (effectiveRole === 'teacher' && selectedTestId) {
      loadTeacherAnalytics()
    }
  }, [effectiveRole, selectedTestId])
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  if (effectiveRole === 'teacher') {
    return (
      <div className="principal-analytics-page">
        <section className="principal-analytics-header">
          <h2>Assessment Analytics</h2>
          <p>Filter analytics by assessment to review synced class results.</p>
        </section>

        <section className="principal-analytics-filters">
          <select value={selectedTestId} onChange={(event) => setSelectedTestId(event.target.value)}>
            <option value="">Select assessment</option>
            {teacherAssessments.map((assessment) => (
              <option key={assessment.id} value={assessment.id}>
                {assessment.testName}
              </option>
            ))}
          </select>
        </section>

        {message.error ? <p className="form-message form-message-error">{message.error}</p> : null}

        <div className="principal-analytics-grid">
          <section className="principal-analytics-panel">
            <h3>Least Mastered Skills Breakdown</h3>
            {isAnalyticsLoading ? <p className="principal-analytics-empty">Loading...</p> : null}
            {!isAnalyticsLoading && !teacherLms.length ? (
              <p className="principal-analytics-empty">No LMS records found.</p>
            ) : null}
            {teacherLms.map((item) => {
              const percent = clampPercent(parseNumber(item.averageScore)) ?? 0
              return (
                <div className="principal-skill-row" key={item.competencyId ?? item.competencyName}>
                  <div>
                    <span>{item.competencyName || 'Competency'}</span>
                    <strong>{formatPercent(percent)}</strong>
                  </div>
                  <div className="principal-skill-track">
                    <span
                      className={`analytics-tone-${getToneFromPercent(percent)}`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </section>

          <section className="principal-analytics-panel">
            <h3>Item Analysis</h3>
            {itemAnalysis.slice(0, 8).map((item) => (
              <div className="principal-sync-row" key={item.itemNumber}>
                <strong>Item {item.itemNumber}</strong>
                <span>{item.correctResponses}/{item.totalResponses} correct</span>
              </div>
            ))}
            {!isAnalyticsLoading && !itemAnalysis.length ? (
              <p className="principal-analytics-empty">No item records found.</p>
            ) : null}
          </section>
        </div>
      </div>
    )
  }

  return (
    <div className="principal-analytics-page">
      <section className="principal-analytics-header">
        <h2>School Assessment Analytics</h2>
        <p>School-wide performance insights based on synchronized assessment results.</p>
      </section>

      <section className="principal-analytics-filters">
        <select
          value={filters.gradeLevelId}
          onChange={(event) => handleFilterChange('gradeLevelId', event.target.value)}
        >
          <option value="">Select grade-level</option>
          {gradeLevels.map((gradeLevel) => (
            <option key={gradeLevel.id} value={gradeLevel.id}>
              {gradeLevel.name}
            </option>
          ))}
        </select>

        <select
          value={filters.sectionId}
          onChange={(event) => handleFilterChange('sectionId', event.target.value)}
        >
          <option value="">Select section</option>
          {filteredSections.map((section) => (
            <option key={section.id} value={section.id}>
              {section.name}
            </option>
          ))}
        </select>

        <select
          value={filters.teacherId}
          onChange={(event) => handleFilterChange('teacherId', event.target.value)}
        >
          <option value="">Select teacher</option>
          {teachers.map((teacher) => (
            <option key={teacher.id} value={teacher.id}>
              {teacher.name}
            </option>
          ))}
        </select>

        <label>
          <span>Subjects:</span>
          <select
            value={filters.subjectId}
            onChange={(event) => handleFilterChange('subjectId', event.target.value)}
          >
            <option value="">All subjects</option>
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.name}
              </option>
            ))}
          </select>
        </label>

        <div className="principal-total-assessment">
          Total Assessment: {isLoading || isAnalyticsLoading ? '...' : totalAssessments}
        </div>
      </section>

      {message.error ? <p className="form-message form-message-error">{message.error}</p> : null}

      {!Object.values(filters).some(Boolean) ? (
        <section className="principal-analytics-panel principal-grade-chart-panel">
          <h3>Percentage by grade level</h3>
          {gradeBars.length ? (
            <VerticalMasteryChart
              data={gradeBars.map((bar) => ({
                id: bar.id,
                label: bar.label,
                value: clampPercent(parseNumber(bar.value)),
              }))}
            />
          ) : null}
          {!isAnalyticsLoading && !gradeBars.length ? (
            <p className="principal-analytics-empty">No grade-level analytics found.</p>
          ) : null}
        </section>
      ) : (
        <>
          <div className="principal-analytics-grid">
            <section className="principal-analytics-panel">
              <h3>Least Mastered Skills Breakdown</h3>
              {isAnalyticsLoading ? (
                <p className="principal-analytics-empty">Loading LMS records...</p>
              ) : null}
              {!isAnalyticsLoading && !schoolLms.length ? (
                <p className="principal-analytics-empty">No LMS records found for this filter.</p>
              ) : null}
              {schoolLms.slice(0, 5).map((item) => {
                const percent = clampPercent(parseNumber(item.averageScore)) ?? 0
                return (
                  <div
                    className="principal-skill-row"
                    key={item.competencyId ?? item.competencyName}
                  >
                    <div>
                      <span>{item.competencyName || 'Competency'}</span>
                      <strong>{formatPercent(percent)}</strong>
                    </div>
                    <div className="principal-skill-track">
                      <span
                        className={`analytics-tone-${getToneFromPercent(percent)}`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </section>

            <section className="principal-analytics-panel">
              <h3>Teacher Sync Activity</h3>
              {!filters.teacherId ? (
                <p className="principal-analytics-empty">Select a teacher to view sync activity.</p>
              ) : null}
              {filters.teacherId && !syncActivity.length && !isAnalyticsLoading ? (
                <p className="principal-analytics-empty">No sync activity found.</p>
              ) : null}
              {syncActivity.slice(0, 4).map((activity) => (
                <div className="principal-sync-row" key={`${activity.id}-${activity.timestamp}`}>
                  <strong>{activity.activity}</strong>
                  <span>{formatDateTime(activity.timestamp)}</span>
                  <small>{activity.details}</small>
                </div>
              ))}
              {selectedTeacherName ? (
                <p className="principal-sync-teacher">Teacher: {selectedTeacherName}</p>
              ) : null}
            </section>
          </div>

          <section className="principal-analytics-panel principal-trends-panel">
            <h3>Assessment Trends</h3>
            {!selectedClassId ? (
              <p className="principal-analytics-empty">
                Select filters that match one class to view assessment trends.
              </p>
            ) : null}
            {selectedClassId && !trends.length && !isAnalyticsLoading ? (
              <p className="principal-analytics-empty">No trend records found.</p>
            ) : null}
            {trends.length ? (
              <VerticalMasteryChart
                data={trends.map((trend) => ({
                  id: trend.id ?? trend.label,
                  label: trend.label,
                  value: clampPercent(parseNumber(trend.value)),
                }))}
                height={220}
              />
            ) : null}
          </section>
        </>
      )}
    </div>
  )
}

export default AnalyticsPage

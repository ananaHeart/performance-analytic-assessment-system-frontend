import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Download,
  FileSpreadsheet,
  FileText,
  Inbox,
  RefreshCw,
  School,
  ShieldAlert,
  SlidersHorizontal,
  UserRound,
  UsersRound,
} from 'lucide-react'
import {
  getAssessmentResultsReportV3,
  getReportReferenceDataV3,
} from '../api/apiV3Client'

const REPORT_API_PENDING_MESSAGE = 'Analytics report API pending'

const REPORT_TYPES = [
  {
    code: 'assessment_results',
    label: 'Assessment Results / Class Record',
    description: 'Per-student assessment results and class record output.',
    roles: ['principal', 'teacher'],
    icon: ClipboardList,
    enabled: true,
  },
  {
    code: 'item_analysis_competency_mastery',
    label: 'Item Analysis and Competency Mastery',
    description: 'Item outcomes and backend-computed competency mastery.',
    roles: ['principal', 'teacher'],
    icon: BarChart3,
    enabled: false,
  },
  {
    code: 'student_performance_profile',
    label: 'Individual Student Performance Profile',
    description: 'One learner profile across the selected reporting scope.',
    roles: ['principal', 'teacher'],
    icon: UserRound,
    enabled: false,
  },
  {
    code: 'lms_intervention_plan',
    label: 'LMS Intervention Plan',
    description: 'Teacher intervention plan based on backend report evidence.',
    roles: ['teacher'],
    icon: FileText,
    enabled: false,
  },
  {
    code: 'principal_consolidated',
    label: 'Principal Consolidated Report',
    description: 'School reporting view consolidated by the backend.',
    roles: ['principal'],
    icon: School,
    enabled: false,
  },
]

const EMPTY_FILTERS = {
  academicYearId: '',
  termPeriodId: '',
  gradeLevelId: '',
  classId: '',
  teacherUserId: '',
  subjectId: '',
  testId: '',
  studentId: '',
}

const EMPTY_SOURCE_DATA = {
  role: '',
  school: null,
  academicYears: [],
  termPeriods: [],
  gradeLevels: [],
  classes: [],
  teachers: [],
  subjects: [],
  classAssignments: [],
  assessments: [],
  students: [],
}

function hasId(value) {
  return value !== undefined && value !== null && String(value).trim() !== ''
}

function sameId(left, right) {
  return hasId(left) && hasId(right) && String(left) === String(right)
}

function normalizeText(value) {
  return String(value ?? '').trim().toLowerCase()
}

function classLabel(record) {
  return [record?.gradeLevelName, record?.sectionName].filter(Boolean).join(' - ') || 'Class'
}

function studentLabel(record) {
  const name = record?.fullName || 'Student'
  const lrn = record?.studentLrn

  return [name, lrn ? `LRN ${lrn}` : ''].filter(Boolean).join(' | ')
}

function uniqueOptions(records, getValue, getLabel) {
  const options = new Map()

  records.forEach((record) => {
    const value = getValue(record)
    if (!hasId(value)) return

    const key = String(value)
    if (!options.has(key)) {
      options.set(key, { value: key, label: getLabel(record) || key })
    }
  })

  return Array.from(options.values()).sort((left, right) =>
    left.label.localeCompare(right.label, undefined, { numeric: true }),
  )
}

function selectInitialAcademicYear(academicYears) {
  return (
    academicYears.find((year) => normalizeText(year.status) === 'active') ??
    academicYears[0] ??
    null
  )
}

function selectInitialTerm(termPeriods, academicYearId) {
  const matchingTerms = termPeriods
    .filter((term) => sameId(term.academicYearId, academicYearId))
    .sort((left, right) => Number(left.termOrder ?? 0) - Number(right.termOrder ?? 0))

  return (
    matchingTerms.find((term) => normalizeText(term.status) === 'active') ??
    matchingTerms[0] ??
    null
  )
}

function getErrorMessage(error, fallback) {
  const fieldMessages = Object.entries(error?.errors ?? {})
    .filter(([field, message]) => field !== 'code' && typeof message === 'string' && message.trim())
    .map(([, message]) => message.trim())

  return [...new Set([error?.message, ...fieldMessages].filter(Boolean))].join(' ') || fallback
}

function getLoadFailure(error, fallback) {
  const message = getErrorMessage(error, fallback)
  const baseState = { message, code: error?.code || '' }

  if (error?.status === 401 || error?.status === 403) {
    return { ...baseState, status: 'authorization' }
  }

  if (error?.status === 404) {
    return { ...baseState, status: 'not-found' }
  }

  if (error?.status === 422) {
    return { ...baseState, status: 'invalid' }
  }

  return { ...baseState, status: 'unavailable' }
}

function formatBackendNumber(value, suffix = '') {
  if (value === null || value === undefined || value === '') {
    return 'Not available'
  }

  const displayValue =
    typeof value === 'number'
      ? value.toLocaleString(undefined, { maximumFractionDigits: 2 })
      : String(value)

  return `${displayValue}${suffix}`
}

function formatBackendCount(value) {
  return value === null || value === undefined || value === '' ? 'Not available' : String(value)
}

function formatLocalDate(value, emptyLabel) {
  if (!value) return emptyLabel

  const parsedDate = new Date(value)
  if (Number.isNaN(parsedDate.getTime())) return String(value)

  return parsedDate.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatStatus(value, emptyLabel = 'Not available') {
  if (!value) return emptyLabel

  return String(value)
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

function getVerificationState(row) {
  if (row?.verifiedAt) {
    return {
      label: 'Verified',
      detail: formatLocalDate(row.verifiedAt, 'Verified'),
      tone: 'verified',
    }
  }

  if (!row?.testResultId || normalizeText(row?.resultStatus) === 'not_submitted') {
    return { label: 'Not submitted', detail: '', tone: 'not-submitted' }
  }

  if (normalizeText(row?.resultStatus) === 'finalized') {
    return { label: 'Verified', detail: '', tone: 'verified' }
  }

  return { label: 'Pending', detail: 'Teacher verification', tone: 'pending' }
}

function getDataStatusCopy(dataStatus) {
  if (dataStatus === 'available') return 'All available finalized results are included.'
  if (dataStatus === 'partial') return 'Some learner results are pending or unavailable.'
  if (dataStatus === 'empty') return 'No finalized learner results are available.'
  return 'Report status is not available.'
}

function FilterSelect({
  id,
  label,
  value,
  options,
  placeholder,
  disabled = false,
  onChange,
  stateText = '',
}) {
  return (
    <label className="reports-filter-field" htmlFor={id}>
      <span>{label}</span>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {stateText ? <small>{stateText}</small> : null}
    </label>
  )
}

function ReportsPage({ user, role, token }) {
  const effectiveRole = normalizeText(role || user?.role)
  const currentTeacherUserId = user?.userId ?? user?.id ?? null
  const availableReportTypes = useMemo(
    () => REPORT_TYPES.filter((reportType) => reportType.roles.includes(effectiveRole)),
    [effectiveRole],
  )
  const [selectedReportType, setSelectedReportType] = useState('assessment_results')
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [sourceData, setSourceData] = useState(EMPTY_SOURCE_DATA)
  const [pageState, setPageState] = useState({ status: 'loading', message: '', code: '' })
  const [reportData, setReportData] = useState(null)
  const [reportState, setReportState] = useState({ status: 'idle', message: '', code: '' })

  const loadFoundation = useCallback(async () => {
    setPageState({ status: 'loading', message: '', code: '' })
    setSourceData(EMPTY_SOURCE_DATA)
    setFilters(EMPTY_FILTERS)
    setReportData(null)
    setReportState({ status: 'idle', message: '', code: '' })

    try {
      const referenceData = await getReportReferenceDataV3(token)
      const referenceAssignments =
        effectiveRole === 'teacher'
          ? referenceData.classAssignments.filter((assignment) =>
              sameId(assignment.teacherUserId, currentTeacherUserId),
            )
          : referenceData.classAssignments
      const availableAcademicYears =
        effectiveRole === 'teacher'
          ? referenceData.academicYears.filter((academicYear) =>
              referenceAssignments.some((assignment) =>
                sameId(assignment.academicYearId, academicYear.academicYearId),
              ),
            )
          : referenceData.academicYears
      const initialYear = selectInitialAcademicYear(availableAcademicYears)
      const initialTerm = selectInitialTerm(
        referenceData.termPeriods,
        initialYear?.academicYearId,
      )

      setSourceData(referenceData)
      setFilters({
        ...EMPTY_FILTERS,
        academicYearId: initialYear ? String(initialYear.academicYearId) : '',
        termPeriodId: initialTerm ? String(initialTerm.termPeriodId) : '',
      })

      if (!availableAcademicYears.length) {
        setPageState({
          status: 'empty',
          message:
            effectiveRole === 'teacher'
              ? 'No class assignments are available for report filters.'
              : 'No academic years are available for report filters.',
          code: '',
        })
        return
      }

      setPageState({ status: 'ready', message: '', code: '' })
    } catch (error) {
      setPageState(getLoadFailure(error, 'Report reference data is unavailable.'))
    }
  }, [currentTeacherUserId, effectiveRole, token])

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    void loadFoundation()
  }, [loadFoundation])
  /* eslint-enable react-hooks/set-state-in-effect */

  const scopedAssignments = useMemo(() => {
    if (effectiveRole === 'principal') return sourceData.classAssignments
    if (effectiveRole !== 'teacher' || !hasId(currentTeacherUserId)) return []

    return sourceData.classAssignments.filter((assignment) =>
      sameId(assignment.teacherUserId, currentTeacherUserId),
    )
  }, [currentTeacherUserId, effectiveRole, sourceData.classAssignments])

  const academicYearOptions = useMemo(() => {
    if (effectiveRole === 'teacher') {
      return uniqueOptions(
        scopedAssignments,
        (assignment) => assignment.academicYearId,
        (assignment) => assignment.academicYearName,
      )
    }

    return uniqueOptions(
      sourceData.academicYears,
      (year) => year.academicYearId,
      (year) => year.yearName,
    )
  }, [effectiveRole, scopedAssignments, sourceData.academicYears])

  const termOptions = useMemo(
    () =>
      uniqueOptions(
        sourceData.termPeriods
          .filter((term) => sameId(term.academicYearId, filters.academicYearId))
          .sort((left, right) => Number(left.termOrder ?? 0) - Number(right.termOrder ?? 0)),
        (term) => term.termPeriodId,
        (term) => term.termName,
      ),
    [filters.academicYearId, sourceData.termPeriods],
  )

  const gradeLevelOptions = useMemo(() => {
    const classGradeIds = new Set(
      sourceData.classes
        .filter((classRecord) => sameId(classRecord.academicYearId, filters.academicYearId))
        .map((classRecord) => String(classRecord.gradeLevelId)),
    )

    return uniqueOptions(
      sourceData.gradeLevels.filter((gradeLevel) =>
        classGradeIds.has(String(gradeLevel.gradeLevelId)),
      ),
      (gradeLevel) => gradeLevel.gradeLevelId,
      (gradeLevel) => gradeLevel.gradeLevelName,
    )
  }, [filters.academicYearId, sourceData.classes, sourceData.gradeLevels])

  const teacherClassOptions = useMemo(
    () =>
      uniqueOptions(
        scopedAssignments.filter((assignment) =>
          sameId(assignment.academicYearId, filters.academicYearId),
        ),
        (assignment) => assignment.classId,
        classLabel,
      ),
    [filters.academicYearId, scopedAssignments],
  )

  const principalClassOptions = useMemo(
    () =>
      uniqueOptions(
        sourceData.classes.filter(
          (classRecord) =>
            sameId(classRecord.academicYearId, filters.academicYearId) &&
            sameId(classRecord.gradeLevelId, filters.gradeLevelId),
        ),
        (classRecord) => classRecord.classId,
        classLabel,
      ),
    [filters.academicYearId, filters.gradeLevelId, sourceData.classes],
  )

  const principalTeacherOptions = useMemo(() => {
    const teacherIds = new Set(
      sourceData.classAssignments
        .filter(
          (assignment) =>
            sameId(assignment.academicYearId, filters.academicYearId) &&
            sameId(assignment.classId, filters.classId),
        )
        .map((assignment) => String(assignment.teacherUserId)),
    )

    return uniqueOptions(
      sourceData.teachers.filter((teacher) =>
        teacherIds.has(String(teacher.teacherUserId)),
      ),
      (teacher) => teacher.teacherUserId,
      (teacher) => teacher.fullName,
    )
  }, [
    filters.academicYearId,
    filters.classId,
    sourceData.classAssignments,
    sourceData.teachers,
  ])

  const subjectOptions = useMemo(() => {
    const assignments = scopedAssignments.filter((assignment) => {
      if (
        !sameId(assignment.academicYearId, filters.academicYearId) ||
        !sameId(assignment.classId, filters.classId)
      ) {
        return false
      }

      return effectiveRole === 'teacher' || sameId(assignment.teacherUserId, filters.teacherUserId)
    })
    const subjectIds = new Set(assignments.map((assignment) => String(assignment.subjectId)))

    return uniqueOptions(
      sourceData.subjects.filter((subject) => subjectIds.has(String(subject.subjectId))),
      (subject) => subject.subjectId,
      (subject) => subject.subjectName,
    )
  }, [
    effectiveRole,
    filters.academicYearId,
    filters.classId,
    filters.teacherUserId,
    scopedAssignments,
    sourceData.subjects,
  ])

  const matchingAssignments = useMemo(
    () =>
      scopedAssignments.filter((assignment) => {
        if (
          !sameId(assignment.academicYearId, filters.academicYearId) ||
          !sameId(assignment.classId, filters.classId) ||
          !sameId(assignment.subjectId, filters.subjectId)
        ) {
          return false
        }

        return effectiveRole === 'teacher' || sameId(assignment.teacherUserId, filters.teacherUserId)
      }),
    [
      effectiveRole,
      filters.academicYearId,
      filters.classId,
      filters.subjectId,
      filters.teacherUserId,
      scopedAssignments,
    ],
  )

  const assessmentOptions = useMemo(
    () =>
      uniqueOptions(
        sourceData.assessments.filter(
          (assessment) =>
            sameId(assessment.termPeriodId, filters.termPeriodId) &&
            matchingAssignments.some((assignment) =>
              sameId(assignment.classAssignmentId, assessment.classAssignmentId),
            ),
        ),
        (assessment) => assessment.testId,
        (assessment) => assessment.testName,
      ),
    [filters.termPeriodId, matchingAssignments, sourceData.assessments],
  )

  const selectedAssessment = useMemo(
    () =>
      sourceData.assessments.find(
        (assessment) =>
          sameId(assessment.testId, filters.testId) &&
          sameId(assessment.termPeriodId, filters.termPeriodId) &&
          matchingAssignments.some((assignment) =>
            sameId(assignment.classAssignmentId, assessment.classAssignmentId),
          ),
      ) ?? null,
    [filters.termPeriodId, filters.testId, matchingAssignments, sourceData.assessments],
  )

  const selectedClassAssignment = useMemo(
    () =>
      selectedAssessment
        ? matchingAssignments.find((assignment) =>
            sameId(assignment.classAssignmentId, selectedAssessment.classAssignmentId),
          ) ?? null
        : null,
    [matchingAssignments, selectedAssessment],
  )

  const studentOptions = useMemo(
    () =>
      uniqueOptions(
        sourceData.students.filter((student) => sameId(student.classId, filters.classId)),
        (student) => student.studentId,
        studentLabel,
      ),
    [filters.classId, sourceData.students],
  )

  const reportContextReady = Boolean(
    selectedAssessment?.testId && selectedClassAssignment?.classAssignmentId,
  )

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    let isCurrent = true

    setReportData(null)

    if (selectedReportType !== 'assessment_results' || !reportContextReady) {
      setReportState({ status: 'idle', message: '', code: '' })
      return () => {
        isCurrent = false
      }
    }

    setReportState({ status: 'loading', message: '', code: '' })

    getAssessmentResultsReportV3(
      selectedAssessment.testId,
      selectedClassAssignment.classAssignmentId,
      token,
    )
      .then((data) => {
        if (!isCurrent) return

        setReportData(data)
        setReportState({
          status: ['empty', 'partial', 'available'].includes(data?.dataStatus)
            ? data.dataStatus
            : 'available',
          message: '',
          code: '',
        })
      })
      .catch((error) => {
        if (!isCurrent) return
        setReportData(null)
        setReportState(getLoadFailure(error, 'Assessment results are unavailable.'))
      })

    return () => {
      isCurrent = false
    }
  }, [
    reportContextReady,
    selectedAssessment?.testId,
    selectedClassAssignment?.classAssignmentId,
    selectedReportType,
    token,
  ])
  /* eslint-enable react-hooks/set-state-in-effect */

  const reportRows = Array.isArray(reportData?.rows) ? reportData.rows : []
  const visibleRows = filters.studentId
    ? reportRows.filter((row) => sameId(row.studentId, filters.studentId))
    : reportRows

  const selectedReport =
    availableReportTypes.find((reportType) => reportType.code === selectedReportType) ??
    availableReportTypes.find((reportType) => reportType.enabled) ??
    null

  const handleFilterChange = (field, value) => {
    setFilters((currentFilters) => {
      const nextFilters = { ...currentFilters, [field]: value }

      if (field === 'academicYearId') {
        nextFilters.termPeriodId = ''
        nextFilters.gradeLevelId = ''
        nextFilters.classId = ''
        nextFilters.teacherUserId = ''
        nextFilters.subjectId = ''
        nextFilters.testId = ''
        nextFilters.studentId = ''

        const nextTerm = selectInitialTerm(sourceData.termPeriods, value)
        nextFilters.termPeriodId = nextTerm ? String(nextTerm.termPeriodId) : ''
      }

      if (field === 'termPeriodId') nextFilters.testId = ''

      if (field === 'gradeLevelId') {
        nextFilters.classId = ''
        nextFilters.teacherUserId = ''
        nextFilters.subjectId = ''
        nextFilters.testId = ''
        nextFilters.studentId = ''
      }

      if (field === 'classId') {
        nextFilters.teacherUserId = ''
        nextFilters.subjectId = ''
        nextFilters.testId = ''
        nextFilters.studentId = ''
      }

      if (field === 'teacherUserId') {
        nextFilters.subjectId = ''
        nextFilters.testId = ''
      }

      if (field === 'subjectId') nextFilters.testId = ''

      return nextFilters
    })
  }

  const assessmentStateText =
    filters.termPeriodId && filters.subjectId && !assessmentOptions.length
      ? 'No matching assessments are available.'
      : ''
  const reportContextText = reportContextReady
    ? reportState.status === 'loading'
      ? 'Loading authoritative assessment results...'
      : getDataStatusCopy(reportData?.dataStatus)
    : 'Select a matching class assignment and assessment.'

  if (pageState.status === 'authorization') {
    return (
      <div className="reports-page">
        <section className="reports-state-panel is-authorization" role="alert">
          <ShieldAlert size={28} strokeWidth={1.9} aria-hidden="true" />
          <div>
            <h1>Reports access unavailable</h1>
            <p>{pageState.message}</p>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="reports-page">
      <header className="reports-page-header">
        <div>
          <p className="reports-eyebrow">{effectiveRole} workspace</p>
          <h1>Assessment results</h1>
          <p>View backend-generated assessment results for the selected reporting scope.</p>
        </div>
        <button
          type="button"
          className="reports-refresh-button"
          onClick={loadFoundation}
          disabled={pageState.status === 'loading'}
        >
          <RefreshCw
            size={16}
            strokeWidth={2.2}
            className={pageState.status === 'loading' ? 'is-spinning' : ''}
            aria-hidden="true"
          />
          {pageState.status === 'loading' ? 'Loading...' : 'Refresh filters'}
        </button>
      </header>

      {['unavailable', 'not-found', 'invalid'].includes(pageState.status) ? (
        <section className="reports-state-panel is-unavailable" role="alert">
          <ShieldAlert size={24} strokeWidth={1.9} aria-hidden="true" />
          <div>
            <h2>Report filters unavailable</h2>
            <p>{pageState.message}</p>
            {pageState.code ? <small>{pageState.code}</small> : null}
          </div>
          <button type="button" onClick={loadFoundation}>
            Retry
          </button>
        </section>
      ) : null}

      {pageState.status === 'empty' ? (
        <section className="reports-state-panel is-empty" role="status">
          <Inbox size={24} strokeWidth={1.9} aria-hidden="true" />
          <div>
            <h2>No report scope available</h2>
            <p>{pageState.message}</p>
          </div>
        </section>
      ) : null}

      <section className="reports-type-section" aria-labelledby="reportTypeHeading">
        <div className="reports-section-heading">
          <div>
            <p>Report type</p>
            <h2 id="reportTypeHeading">Select report output</h2>
          </div>
          <span>{effectiveRole === 'principal' ? 'Principal scope' : 'Teacher scope'}</span>
        </div>

        <div className="reports-type-grid">
          {availableReportTypes.map((reportType) => {
            const ReportIcon = reportType.icon
            const isSelected = selectedReportType === reportType.code

            return (
              <button
                type="button"
                key={reportType.code}
                className={`reports-type-option ${isSelected ? 'is-selected' : ''}`}
                aria-pressed={isSelected}
                disabled={!reportType.enabled}
                title={reportType.enabled ? '' : REPORT_API_PENDING_MESSAGE}
                onClick={() => {
                  if (reportType.enabled) setSelectedReportType(reportType.code)
                }}
              >
                <span className="reports-type-icon" aria-hidden="true">
                  <ReportIcon size={19} strokeWidth={2.1} />
                </span>
                <span>
                  <strong>{reportType.label}</strong>
                  <small>{reportType.description}</small>
                </span>
              </button>
            )
          })}
        </div>
      </section>

      <section className="reports-filter-panel" aria-labelledby="reportFiltersHeading">
        <div className="reports-section-heading">
          <div>
            <p>Reporting scope</p>
            <h2 id="reportFiltersHeading">Filters</h2>
          </div>
          <SlidersHorizontal size={19} strokeWidth={2} aria-hidden="true" />
        </div>

        {pageState.status === 'loading' ? (
          <div className="reports-loading-state" role="status" aria-live="polite">
            <span className="reports-loading-spinner" aria-hidden="true" />
            Loading V3 report filters...
          </div>
        ) : (
          <div className={`reports-filter-grid is-${effectiveRole}`}>
            <FilterSelect
              id="reportAcademicYear"
              label="Academic year"
              value={filters.academicYearId}
              options={academicYearOptions}
              placeholder="Select academic year"
              disabled={!academicYearOptions.length}
              onChange={(value) => handleFilterChange('academicYearId', value)}
            />

            <FilterSelect
              id="reportTermPeriod"
              label="Term"
              value={filters.termPeriodId}
              options={termOptions}
              placeholder="Select term"
              disabled={!filters.academicYearId || !termOptions.length}
              onChange={(value) => handleFilterChange('termPeriodId', value)}
            />

            {effectiveRole === 'principal' ? (
              <FilterSelect
                id="reportGradeLevel"
                label="Grade level"
                value={filters.gradeLevelId}
                options={gradeLevelOptions}
                placeholder="Select grade level"
                disabled={!filters.academicYearId || !gradeLevelOptions.length}
                onChange={(value) => handleFilterChange('gradeLevelId', value)}
              />
            ) : null}

            <FilterSelect
              id="reportClass"
              label={effectiveRole === 'teacher' ? 'Assigned class' : 'Class'}
              value={filters.classId}
              options={effectiveRole === 'teacher' ? teacherClassOptions : principalClassOptions}
              placeholder="Select class"
              disabled={
                !filters.academicYearId ||
                (effectiveRole === 'principal' && !filters.gradeLevelId)
              }
              onChange={(value) => handleFilterChange('classId', value)}
            />

            {effectiveRole === 'principal' ? (
              <FilterSelect
                id="reportTeacher"
                label="Teacher"
                value={filters.teacherUserId}
                options={principalTeacherOptions}
                placeholder="Select teacher"
                disabled={!filters.classId || !principalTeacherOptions.length}
                onChange={(value) => handleFilterChange('teacherUserId', value)}
              />
            ) : null}

            <FilterSelect
              id="reportSubject"
              label="Subject"
              value={filters.subjectId}
              options={subjectOptions}
              placeholder="Select subject"
              disabled={
                !filters.classId ||
                (effectiveRole === 'principal' && !filters.teacherUserId) ||
                !subjectOptions.length
              }
              onChange={(value) => handleFilterChange('subjectId', value)}
            />

            <FilterSelect
              id="reportAssessment"
              label="Assessment"
              value={filters.testId}
              options={assessmentOptions}
              placeholder="Select assessment"
              disabled={
                !filters.termPeriodId ||
                !filters.subjectId ||
                !matchingAssignments.length ||
                !assessmentOptions.length
              }
              onChange={(value) => handleFilterChange('testId', value)}
              stateText={assessmentStateText}
            />

            <FilterSelect
              id="reportStudent"
              label="Student (optional)"
              value={filters.studentId}
              options={studentOptions}
              placeholder="All students"
              disabled={!filters.classId || !studentOptions.length}
              onChange={(value) => handleFilterChange('studentId', value)}
            />
          </div>
        )}
      </section>

      <section className="reports-result-panel" aria-labelledby="reportResultHeading">
        <div className="reports-result-copy">
          <span className="reports-result-icon" aria-hidden="true">
            <BarChart3 size={23} strokeWidth={1.9} />
          </span>
          <div>
            <p>Selected report</p>
            <h2 id="reportResultHeading">{selectedReport?.label || 'Report output'}</h2>
            <span>{reportContextText}</span>
          </div>
        </div>

        <div className="reports-export-actions">
          <button type="button" disabled title={REPORT_API_PENDING_MESSAGE}>
            <Download size={16} strokeWidth={2.1} aria-hidden="true" />
            PDF
          </button>
          <button type="button" disabled title={REPORT_API_PENDING_MESSAGE}>
            <FileSpreadsheet size={16} strokeWidth={2.1} aria-hidden="true" />
            Excel
          </button>
        </div>

        {reportState.status === 'idle' ? (
          <div className="reports-unavailable-state" role="status">
            <FileText size={22} strokeWidth={1.8} aria-hidden="true" />
            <strong>Select an assessment</strong>
            <span>A matching assessment and class assignment are required.</span>
          </div>
        ) : null}

        {reportState.status === 'loading' ? (
          <div className="reports-report-loading" role="status" aria-live="polite">
            <span className="reports-loading-spinner" aria-hidden="true" />
            Loading assessment results...
          </div>
        ) : null}

        {['authorization', 'not-found', 'invalid', 'unavailable'].includes(reportState.status) ? (
          <div className="reports-report-error" role="alert">
            <ShieldAlert size={22} strokeWidth={1.9} aria-hidden="true" />
            <div>
              <strong>Assessment results unavailable</strong>
              <span>{reportState.message}</span>
              {reportState.code ? <small>{reportState.code}</small> : null}
            </div>
          </div>
        ) : null}

        {reportData ? (
          <div className="reports-assessment-results">
            <div className="reports-report-meta">
              <div>
                <strong>{reportData.scope?.testName || 'Assessment results'}</strong>
                <span>
                  {[reportData.scope?.gradeLevelName, reportData.scope?.sectionName]
                    .filter(Boolean)
                    .join(' - ') || 'Class not available'}
                  {' | '}
                  {reportData.scope?.subjectName || 'Subject not available'}
                </span>
              </div>
              <div>
                <span className={`reports-data-status is-${normalizeText(reportData.dataStatus)}`}>
                  {formatStatus(reportData.dataStatus)}
                </span>
                <small>
                  Generated {formatLocalDate(reportData.generatedAt, 'time not available')}
                </small>
              </div>
            </div>

            <div className="reports-summary-grid" aria-label="Assessment result summary">
              <article>
                <UsersRound size={18} aria-hidden="true" />
                <span>Students</span>
                <strong>{formatBackendCount(reportData.summary?.studentCount)}</strong>
              </article>
              <article>
                <ClipboardList size={18} aria-hidden="true" />
                <span>Submitted</span>
                <strong>{formatBackendCount(reportData.summary?.submittedCount)}</strong>
              </article>
              <article>
                <CheckCircle2 size={18} aria-hidden="true" />
                <span>Verified</span>
                <strong>{formatBackendCount(reportData.summary?.verifiedCount)}</strong>
              </article>
              <article>
                <Clock3 size={18} aria-hidden="true" />
                <span>Pending</span>
                <strong>{formatBackendCount(reportData.summary?.pendingCount)}</strong>
              </article>
              <article>
                <FileText size={18} aria-hidden="true" />
                <span>Maximum points</span>
                <strong>{formatBackendNumber(reportData.summary?.maximumPoints)}</strong>
              </article>
              <article>
                <BarChart3 size={18} aria-hidden="true" />
                <span>Class mean points</span>
                <strong>{formatBackendNumber(reportData.summary?.classMeanPoints)}</strong>
              </article>
              <article>
                <BarChart3 size={18} aria-hidden="true" />
                <span>Class mean percentage</span>
                <strong>{formatBackendNumber(reportData.summary?.classMeanPercentage, '%')}</strong>
              </article>
            </div>

            {reportData.dataStatus === 'empty' || reportData.dataStatus === 'partial' ? (
              <div className={`reports-data-notice is-${reportData.dataStatus}`} role="status">
                <strong>{formatStatus(reportData.dataStatus)} report data</strong>
                <span>{getDataStatusCopy(reportData.dataStatus)}</span>
              </div>
            ) : null}

            {Array.isArray(reportData.warnings) && reportData.warnings.length ? (
              <div className="reports-warning-list" aria-label="Backend report warnings">
                {reportData.warnings.map((warning, index) => (
                  <div key={`${warning.code || 'warning'}-${index}`}>
                    <ShieldAlert size={17} aria-hidden="true" />
                    <span>
                      <strong>{warning.code || 'REPORT_WARNING'}</strong>
                      {warning.message || 'Report data requires attention.'}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="reports-results-table-wrap">
              <table className="reports-results-table">
                <thead>
                  <tr>
                    <th>Learner</th>
                    <th>Score</th>
                    <th>Percentage</th>
                    <th>Performance</th>
                    <th>Submitted</th>
                    <th>Verification</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.length ? (
                    visibleRows.map((row) => {
                      const verification = getVerificationState(row)

                      return (
                        <tr key={row.classListId ?? row.studentId ?? row.studentLrn}>
                          <td>
                            <strong>{row.fullName || 'Student name not available'}</strong>
                            <small>{row.studentLrn ? `LRN ${row.studentLrn}` : 'LRN not available'}</small>
                          </td>
                          <td>
                            {row.earnedPoints === null || row.earnedPoints === undefined
                              ? 'Not available'
                              : `${formatBackendNumber(row.earnedPoints)} / ${formatBackendNumber(row.maximumPoints)}`}
                          </td>
                          <td>{formatBackendNumber(row.percentage, '%')}</td>
                          <td>{row.performanceStatusLabel || 'Not available'}</td>
                          <td>
                            {formatLocalDate(row.submittedAt, 'Not submitted')}
                            <small>{formatStatus(row.resultStatus, 'Not submitted')}</small>
                          </td>
                          <td>
                            <span className={`reports-verification-state is-${verification.tone}`}>
                              {verification.label}
                            </span>
                            {verification.detail ? <small>{verification.detail}</small> : null}
                          </td>
                        </tr>
                      )
                    })
                  ) : (
                    <tr>
                      <td colSpan="6" className="reports-results-empty">
                        {filters.studentId
                          ? 'The selected learner is not included in this report.'
                          : 'No learner rows are available.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  )
}

export default ReportsPage

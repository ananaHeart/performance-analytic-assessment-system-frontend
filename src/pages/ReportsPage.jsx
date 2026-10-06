import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity,
  ArrowLeft,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Clock3,
  GraduationCap,
  Download,
  FileSpreadsheet,
  FileText,
  Inbox,
  RefreshCw,
  School,
  ShieldAlert,
  SlidersHorizontal,
  Target,
  TrendingDown,
  Trophy,
  UserRound,
  UsersRound,
} from 'lucide-react'
import { HorizontalMasteryChart, VerticalMasteryChart } from '../components/AnalyticsCharts'
import {
  downloadAssessmentResultsExcelV3,
  downloadAssessmentResultsPdfV3,
  downloadConsolidatedReportExcelV3,
  downloadConsolidatedReportPdfV3,
  downloadItemAnalysisExcelV3,
  downloadItemAnalysisPdfV3,
  downloadLearningCompetencyExcelV3,
  downloadLearningCompetencyPdfV3,
  downloadStudentPerformanceProfileExcelV3,
  downloadStudentPerformanceProfilePdfV3,
  downloadSyncActivityExcelV3,
  downloadSyncActivityPdfV3,
  getAssessmentResultsReportV3,
  getConsolidatedReportV3,
  getItemAnalysisReportV3,
  getLearningCompetencyReportV3,
  getReportReferenceDataV3,
  getStudentPerformanceProfileV3,
  getSyncActivityReportV3,
} from '../api/apiV3Client'

const REPORT_API_PENDING_MESSAGE = 'Analytics report API pending'

const REPORT_TYPES = [
  {
    code: 'assessment_results',
    label: 'Assessment Results / Class Record',
    description: 'Per-student assessment results and class record output.',
    roles: ['teacher'],
    icon: ClipboardList,
    enabled: true,
  },
  {
    code: 'item_analysis_competency_mastery',
    label: 'Item Analysis and Competency Mastery',
    description: 'Item outcomes and backend-computed competency mastery.',
    roles: ['teacher'],
    icon: BarChart3,
    enabled: true,
  },
  {
    code: 'student_performance_profile',
    label: 'Individual Student Performance Profile',
    description: 'One learner profile across the selected reporting scope.',
    roles: ['principal', 'teacher'],
    icon: UserRound,
    enabled: true,
  },
  {
    code: 'principal_consolidated',
    label: 'Principal Consolidated Report',
    description: 'School reporting view consolidated by the backend.',
    roles: ['principal'],
    icon: School,
    enabled: true,
  },
  {
    code: 'teacher_sync_activity',
    label: 'Teacher Sync Activity',
    description: 'Who has uploaded results, when, and which syncs failed.',
    roles: ['principal', 'teacher'],
    icon: Activity,
    enabled: true,
  },
  {
    code: 'learning_competency',
    label: 'Learning Competency',
    description: 'Least mastered competencies for a term, and who needs help.',
    roles: ['principal', 'teacher'],
    icon: Target,
    enabled: true,
  },
]

const PRINCIPAL_REPORT_TABS = [
  { key: 'by_teacher', label: 'By teacher assessments', reportType: 'principal_consolidated', groupBy: 'TEACHER', icon: GraduationCap, tone: 'green' },
  { key: 'by_student', label: 'Student performance', reportType: 'student_performance_profile', groupBy: null, icon: UserRound, tone: 'blue' },
  { key: 'by_term', label: 'By term', reportType: 'principal_consolidated', groupBy: 'TERM_PERIOD', icon: CalendarDays, tone: 'orange' },
  { key: 'by_sync_activity', label: 'Sync activity', reportType: 'teacher_sync_activity', groupBy: null, icon: Activity, tone: 'purple' },
  { key: 'by_learning_competency', label: 'Learning competency', reportType: 'learning_competency', groupBy: null, icon: Target, tone: 'teal' },
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
  from: '',
  to: '',
  rootTagId: '',
  skillId: '',
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

function isArchivedAssessment(assessment) {
  return normalizeText(assessment?.testStatus ?? assessment?.status) === 'archived'
}

function isActiveClassAssignment(assignment) {
  const status = normalizeText(assignment?.status)
  return !status || status === 'active'
}

function slugifyFilename(value) {
  return (
    String(value ?? '')
      .trim()
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase() || 'report'
  )
}

function triggerBlobDownload(blob, filename) {
  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
}

function toTitleCase(value) {
  // \b is ASCII-only in JS regex, so it misreads accented letters (e.g. "ñ") as
  // word boundaries and capitalizes the letters next to them too. Matching an
  // explicit non-letter/non-number boundary (or start of string) instead keeps
  // this correct for names like "Añana".
  return String(value ?? '')
    .toLowerCase()
    .replace(/(^|[^\p{L}\p{N}'])(\p{L})/gu, (_match, boundary, letter) => boundary + letter.toUpperCase())
}

function classLabel(record) {
  return [record?.gradeLevelName, record?.sectionName].filter(Boolean).join(' - ') || 'Class'
}

function studentLabel(record) {
  const name = toTitleCase(record?.fullName) || 'Student'
  const lrn = record?.studentLrn

  return [name, lrn ? `LRN ${lrn}` : ''].filter(Boolean).join(' | ')
}

function getInitials(name) {
  return (
    String(name ?? '')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase() || '?'
  )
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

function getMasteryPillClass(masteryStatusCode) {
  const code = normalizeText(masteryStatusCode)

  if (code === 'mastered') return 'is-proficient'
  if (code === 'developing') return 'is-developing'
  if (code === 'needs_support') return 'is-needs-support'
  return 'is-no-data'
}

function getScoreToneClass(percentage) {
  const value = Number(percentage)
  if (!Number.isFinite(value)) return 'is-no-data'
  if (value >= 75) return 'is-proficient'
  if (value >= 50) return 'is-developing'
  return 'is-needs-support'
}

function getRecommendationToneIndex(recommendationCode) {
  const code = normalizeText(recommendationCode)

  if (code === 'maintain') return 0
  if (code === 'review') return 1
  if (code === 'reteach') return 2
  if (code === 'priority_intervention') return 3
  return 'neutral'
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

function ReportsPage({ user, role, token, initialFilters = null }) {
  const effectiveRole = normalizeText(role || user?.role)
  const currentTeacherUserId = user?.userId ?? user?.id ?? null
  const availableReportTypes = useMemo(
    () => REPORT_TYPES.filter((reportType) => reportType.roles.includes(effectiveRole)),
    [effectiveRole],
  )
  const initialFiltersRef = useRef(initialFilters)
  const [selectedReportType, setSelectedReportType] = useState(
    initialFilters?.reportType ||
      (effectiveRole === 'principal' ? 'principal_consolidated' : 'assessment_results'),
  )
  const [isFiltersOpen, setIsFiltersOpen] = useState(false)
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [sourceData, setSourceData] = useState(EMPTY_SOURCE_DATA)
  const [pageState, setPageState] = useState({ status: 'loading', message: '', code: '' })
  const [reportData, setReportData] = useState(null)
  const [reportState, setReportState] = useState({ status: 'idle', message: '', code: '' })
  const [itemAnalysisData, setItemAnalysisData] = useState(null)
  const [itemAnalysisState, setItemAnalysisState] = useState({ status: 'idle', message: '', code: '' })
  const [groupByDimension, setGroupByDimension] = useState('TEACHER')
  const [consolidatedData, setConsolidatedData] = useState(null)
  const [consolidatedState, setConsolidatedState] = useState({ status: 'idle', message: '', code: '' })
  const [studentProfileData, setStudentProfileData] = useState(null)
  const [studentProfileState, setStudentProfileState] = useState({ status: 'idle', message: '', code: '' })
  const [syncActivityData, setSyncActivityData] = useState(null)
  const [syncActivityState, setSyncActivityState] = useState({ status: 'idle', message: '', code: '' })
  const [learningCompetencyData, setLearningCompetencyData] = useState(null)
  const [learningCompetencyState, setLearningCompetencyState] = useState({ status: 'idle', message: '', code: '' })
  const [expandedSkillIds, setExpandedSkillIds] = useState(() => new Set())
  const [exportState, setExportState] = useState({ format: '', status: 'idle', message: '' })

  const toggleSkillExpanded = (skillId) => {
    setExpandedSkillIds((current) => {
      const next = new Set(current)
      if (next.has(skillId)) next.delete(skillId)
      else next.add(skillId)
      return next
    })
  }

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

      const presetFilters = initialFiltersRef.current
      const nextFilters = {
        ...EMPTY_FILTERS,
        academicYearId: initialYear ? String(initialYear.academicYearId) : '',
        termPeriodId: initialTerm ? String(initialTerm.termPeriodId) : '',
      }

      if (hasId(presetFilters?.testId)) {
        Object.keys(EMPTY_FILTERS).forEach((filterKey) => {
          if (hasId(presetFilters[filterKey])) {
            nextFilters[filterKey] = String(presetFilters[filterKey])
          }
        })
        if (presetFilters.reportType) {
          setSelectedReportType(presetFilters.reportType)
        }
      }

      setSourceData(referenceData)
      setFilters(nextFilters)

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

    return sourceData.classAssignments.filter(
      (assignment) =>
        sameId(assignment.teacherUserId, currentTeacherUserId) && isActiveClassAssignment(assignment),
    )
  }, [currentTeacherUserId, effectiveRole, sourceData.classAssignments])

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

  const learningCompetencyTermAcademicYearId = useMemo(() => {
    const term = sourceData.termPeriods.find((item) => sameId(item.termPeriodId, filters.termPeriodId))
    return term ? String(term.academicYearId) : ''
  }, [filters.termPeriodId, sourceData.termPeriods])

  const learningCompetencyGradeLevelOptions = useMemo(
    () =>
      uniqueOptions(
        scopedAssignments.filter((assignment) =>
          sameId(assignment.academicYearId, learningCompetencyTermAcademicYearId),
        ),
        (assignment) => assignment.gradeLevelId,
        (assignment) => assignment.gradeLevelName,
      ),
    [learningCompetencyTermAcademicYearId, scopedAssignments],
  )

  const learningCompetencySubjectOptions = useMemo(
    () =>
      uniqueOptions(
        scopedAssignments.filter(
          (assignment) =>
            sameId(assignment.academicYearId, learningCompetencyTermAcademicYearId) &&
            sameId(assignment.gradeLevelId, filters.gradeLevelId),
        ),
        (assignment) => assignment.subjectId,
        (assignment) => assignment.subjectName,
      ),
    [filters.gradeLevelId, learningCompetencyTermAcademicYearId, scopedAssignments],
  )

  const learningCompetencyRootOptions = useMemo(
    () =>
      Array.isArray(learningCompetencyData?.rootCompetencies)
        ? learningCompetencyData.rootCompetencies.map((root) => ({
            value: String(root.rootTagId),
            label: root.rootTagName,
          }))
        : [],
    [learningCompetencyData],
  )

  const learningCompetencySkillOptions = useMemo(() => {
    const selectedRoot = Array.isArray(learningCompetencyData?.rootCompetencies)
      ? learningCompetencyData.rootCompetencies.find((root) => sameId(root.rootTagId, filters.rootTagId))
      : null

    return Array.isArray(selectedRoot?.skills)
      ? selectedRoot.skills.map((skill) => ({
          value: String(skill.skillId),
          label: skill.competencyName || `Skill #${skill.skillId}`,
        }))
      : []
  }, [filters.rootTagId, learningCompetencyData])

  const selectedLearningCompetencySkill = useMemo(() => {
    if (!filters.skillId || !Array.isArray(learningCompetencyData?.rootCompetencies)) return null

    const flattenedSkills = learningCompetencyData.rootCompetencies.flatMap((root) =>
      root.skills.map((skill) => ({ ...skill, rootTagName: root.rootTagName })),
    )

    return flattenedSkills.find((skill) => sameId(skill.skillId, filters.skillId)) ?? null
  }, [filters.skillId, learningCompetencyData])

  const teacherClassOptions = useMemo(
    () =>
      uniqueOptions(
        scopedAssignments.filter((assignment) =>
          sameId(assignment.academicYearId, filters.academicYearId),
        ),
        (assignment) => `${assignment.classId}::${assignment.subjectId}`,
        (assignment) => `${classLabel(assignment)} - ${assignment.subjectName || 'Subject'}`,
      ),
    [filters.academicYearId, scopedAssignments],
  )

  const handleTeacherClassSubjectChange = (value) => {
    const [classId, subjectId] = String(value).split('::')

    setFilters((currentFilters) => ({
      ...currentFilters,
      classId: classId ?? '',
      subjectId: subjectId ?? '',
      teacherUserId: '',
      testId: '',
      studentId: '',
      rootTagId: '',
      skillId: '',
    }))
  }

  const principalClassOptions = useMemo(
    () =>
      uniqueOptions(
        sourceData.classes.filter((classRecord) =>
          sameId(classRecord.academicYearId, filters.academicYearId),
        ),
        (classRecord) => classRecord.classId,
        classLabel,
      ),
    [filters.academicYearId, sourceData.classes],
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
      (teacher) => toTitleCase(teacher.fullName),
    )
  }, [
    filters.academicYearId,
    filters.classId,
    sourceData.classAssignments,
    sourceData.teachers,
  ])

  const syncActivityTeacherOptions = useMemo(
    () =>
      uniqueOptions(
        sourceData.teachers,
        (teacher) => teacher.teacherUserId,
        (teacher) => toTitleCase(teacher.fullName),
      ),
    [sourceData.teachers],
  )

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
            !isArchivedAssessment(assessment) &&
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

  const principalAssessmentCards = useMemo(() => {
    const seen = new Set()
    return sourceData.assessments
      .filter(
        (assessment) =>
          !isArchivedAssessment(assessment) &&
          sameId(assessment.termPeriodId, filters.termPeriodId) &&
          matchingAssignments.some((assignment) =>
            sameId(assignment.classAssignmentId, assessment.classAssignmentId),
          ),
      )
      .filter((assessment) => {
        const key = String(assessment.testId)
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      .sort((left, right) => new Date(right.openAt ?? 0) - new Date(left.openAt ?? 0))
  }, [filters.termPeriodId, matchingAssignments, sourceData.assessments])

  const selectedAssessment = useMemo(
    () =>
      sourceData.assessments.find(
        (assessment) =>
          !isArchivedAssessment(assessment) &&
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

  const selectedStudentForExport = useMemo(
    () => sourceData.students.find((student) => sameId(student.studentId, filters.studentId)) ?? null,
    [filters.studentId, sourceData.students],
  )

  const canExportCurrentReport =
    (['assessment_results', 'item_analysis_competency_mastery'].includes(selectedReportType) &&
      reportContextReady) ||
    (selectedReportType === 'student_performance_profile' && hasId(filters.studentId)) ||
    (selectedReportType === 'principal_consolidated' && Boolean(groupByDimension)) ||
    selectedReportType === 'teacher_sync_activity' ||
    (selectedReportType === 'learning_competency' &&
      Boolean(filters.termPeriodId && filters.gradeLevelId && filters.subjectId))

  const handleExportCurrentReport = async (format) => {
    if (!canExportCurrentReport || exportState.status === 'loading') return

    setExportState({ format, status: 'loading', message: '' })

    try {
      const extension = format === 'pdf' ? 'pdf' : 'xlsx'
      let blob
      let filename

      if (selectedReportType === 'student_performance_profile') {
        const download =
          format === 'pdf'
            ? downloadStudentPerformanceProfilePdfV3
            : downloadStudentPerformanceProfileExcelV3
        blob = await download(filters.studentId, token)
        filename = `${slugifyFilename(selectedStudentForExport?.fullName || 'student')}-performance-profile.${extension}`
      } else if (selectedReportType === 'principal_consolidated') {
        const download =
          format === 'pdf' ? downloadConsolidatedReportPdfV3 : downloadConsolidatedReportExcelV3
        blob = await download(groupByDimension, filters, token)
        filename = `consolidated-report-by-${slugifyFilename(groupByDimension)}.${extension}`
      } else if (selectedReportType === 'item_analysis_competency_mastery') {
        const download = format === 'pdf' ? downloadItemAnalysisPdfV3 : downloadItemAnalysisExcelV3
        blob = await download(selectedAssessment.testId, selectedClassAssignment.classAssignmentId, token)
        filename = `${slugifyFilename(selectedAssessment.testName)}-item-analysis.${extension}`
      } else if (selectedReportType === 'teacher_sync_activity') {
        const download = format === 'pdf' ? downloadSyncActivityPdfV3 : downloadSyncActivityExcelV3
        blob = await download({ ...filters, academicYearId: '' }, token)
        filename = `teacher-sync-activity.${extension}`
      } else if (selectedReportType === 'learning_competency') {
        const download = format === 'pdf' ? downloadLearningCompetencyPdfV3 : downloadLearningCompetencyExcelV3
        blob = await download(filters, token)
        filename = `learning-competency.${extension}`
      } else {
        const download =
          format === 'pdf' ? downloadAssessmentResultsPdfV3 : downloadAssessmentResultsExcelV3
        blob = await download(selectedAssessment.testId, selectedClassAssignment.classAssignmentId, token)
        filename = `${slugifyFilename(selectedAssessment.testName)}-assessment-results.${extension}`
      }

      triggerBlobDownload(blob, filename)
      setExportState({ format, status: 'idle', message: '' })
    } catch (exportError) {
      setExportState({
        format,
        status: 'error',
        message: exportError.message || `Unable to export the ${format.toUpperCase()} report.`,
      })
    }
  }

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

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    let isCurrent = true

    setItemAnalysisData(null)

    if (selectedReportType !== 'item_analysis_competency_mastery' || !reportContextReady) {
      setItemAnalysisState({ status: 'idle', message: '', code: '' })
      return () => {
        isCurrent = false
      }
    }

    setItemAnalysisState({ status: 'loading', message: '', code: '' })

    getItemAnalysisReportV3(
      selectedAssessment.testId,
      selectedClassAssignment.classAssignmentId,
      token,
    )
      .then((data) => {
        if (!isCurrent) return

        setItemAnalysisData(data)
        setItemAnalysisState({
          status: ['empty', 'partial', 'available'].includes(data?.dataStatus)
            ? data.dataStatus
            : 'available',
          message: '',
          code: '',
        })
      })
      .catch((error) => {
        if (!isCurrent) return
        setItemAnalysisData(null)
        setItemAnalysisState(getLoadFailure(error, 'Item analysis is unavailable.'))
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

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    let isCurrent = true

    setConsolidatedData(null)

    if (selectedReportType !== 'principal_consolidated' || effectiveRole !== 'principal') {
      setConsolidatedState({ status: 'idle', message: '', code: '' })
      return () => {
        isCurrent = false
      }
    }

    setConsolidatedState({ status: 'loading', message: '', code: '' })

    getConsolidatedReportV3(groupByDimension, filters, token)
      .then((data) => {
        if (!isCurrent) return

        setConsolidatedData(data)
        setConsolidatedState({
          status: ['empty', 'partial', 'available'].includes(data?.dataStatus)
            ? data.dataStatus
            : 'available',
          message: '',
          code: '',
        })
      })
      .catch((error) => {
        if (!isCurrent) return
        setConsolidatedData(null)
        setConsolidatedState(getLoadFailure(error, 'The consolidated report is unavailable.'))
      })

    return () => {
      isCurrent = false
    }
  }, [
    effectiveRole,
    filters,
    groupByDimension,
    selectedReportType,
    token,
  ])
  /* eslint-enable react-hooks/set-state-in-effect */

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    let isCurrent = true

    setSyncActivityData(null)

    if (selectedReportType !== 'teacher_sync_activity') {
      setSyncActivityState({ status: 'idle', message: '', code: '' })
      return () => {
        isCurrent = false
      }
    }

    setSyncActivityState({ status: 'loading', message: '', code: '' })

    // Academic-year date ranges and real sync timestamps can disagree (e.g. a term
    // period extended past its school year's on-paper end date for a demo), so this
    // report is scoped by term/date filters only, not the auto-selected academic year.
    getSyncActivityReportV3({ ...filters, academicYearId: '' }, token)
      .then((data) => {
        if (!isCurrent) return

        setSyncActivityData(data)
        setSyncActivityState({
          status: ['empty', 'available'].includes(data?.dataStatus) ? data.dataStatus : 'available',
          message: '',
          code: '',
        })
      })
      .catch((error) => {
        if (!isCurrent) return
        setSyncActivityData(null)
        setSyncActivityState(getLoadFailure(error, 'The sync activity report is unavailable.'))
      })

    return () => {
      isCurrent = false
    }
  }, [filters, selectedReportType, token])
  /* eslint-enable react-hooks/set-state-in-effect */

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    let isCurrent = true

    setLearningCompetencyData(null)

    if (
      selectedReportType !== 'learning_competency' ||
      !filters.termPeriodId ||
      !filters.gradeLevelId ||
      !filters.subjectId
    ) {
      setLearningCompetencyState({ status: 'idle', message: '', code: '' })
      return () => {
        isCurrent = false
      }
    }

    setLearningCompetencyState({ status: 'loading', message: '', code: '' })

    // rootTagId/skillId narrow the on-screen view client-side once the full tree is
    // fetched (see selectedLearningCompetencySkill / the root dropdown filter below),
    // so they're intentionally left out of this fetch to avoid a refetch per click.
    getLearningCompetencyReportV3(
      { termPeriodId: filters.termPeriodId, gradeLevelId: filters.gradeLevelId, subjectId: filters.subjectId },
      token,
    )
      .then((data) => {
        if (!isCurrent) return

        setLearningCompetencyData(data)
        setLearningCompetencyState({
          status: ['empty', 'available'].includes(data?.dataStatus) ? data.dataStatus : 'available',
          message: '',
          code: '',
        })
      })
      .catch((error) => {
        if (!isCurrent) return
        setLearningCompetencyData(null)
        setLearningCompetencyState(getLoadFailure(error, 'The learning competency report is unavailable.'))
      })

    return () => {
      isCurrent = false
    }
  }, [filters.gradeLevelId, filters.subjectId, filters.termPeriodId, selectedReportType, token])
  /* eslint-enable react-hooks/set-state-in-effect */

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    let isCurrent = true

    setStudentProfileData(null)

    if (selectedReportType !== 'student_performance_profile' || !filters.studentId) {
      setStudentProfileState({ status: 'idle', message: '', code: '' })
      return () => {
        isCurrent = false
      }
    }

    setStudentProfileState({ status: 'loading', message: '', code: '' })

    getStudentPerformanceProfileV3(filters.studentId, token)
      .then((data) => {
        if (!isCurrent) return

        setStudentProfileData(data)
        setStudentProfileState({
          status: ['empty', 'partial', 'available'].includes(data?.dataStatus)
            ? data.dataStatus
            : 'available',
          message: '',
          code: '',
        })
      })
      .catch((error) => {
        if (!isCurrent) return
        setStudentProfileData(null)
        setStudentProfileState(getLoadFailure(error, 'The student performance profile is unavailable.'))
      })

    return () => {
      isCurrent = false
    }
  }, [filters.studentId, selectedReportType, token])
  /* eslint-enable react-hooks/set-state-in-effect */

  const reportRows = Array.isArray(reportData?.rows) ? reportData.rows : []
  const visibleRows = (
    filters.studentId
      ? reportRows.filter((row) => sameId(row.studentId, filters.studentId))
      : reportRows
  )
    .slice()
    .sort((left, right) =>
      toTitleCase(left.fullName).localeCompare(toTitleCase(right.fullName), undefined, {
        numeric: true,
      }),
    )

  const itemAnalysisRows = Array.isArray(itemAnalysisData?.rows) ? itemAnalysisData.rows : []
  const competencyMasteryRows = Array.isArray(itemAnalysisData?.competencyMastery)
    ? itemAnalysisData.competencyMastery
    : []
  const skillNameById = new Map(
    competencyMasteryRows.map((row) => [String(row.skillId), row.skillName || `Skill #${row.skillId}`]),
  )

  const consolidatedGroups = Array.isArray(consolidatedData?.groups) ? consolidatedData.groups : []
  const consolidatedChartData = consolidatedGroups.map((group) => ({
    id: group.groupKey,
    label: group.groupLabel || `Group ${group.groupKey}`,
    value: group.meanPercentage,
  }))

  const studentAssessmentResults = Array.isArray(studentProfileData?.assessmentResults)
    ? studentProfileData.assessmentResults
    : []
  const studentCompetencyPerformance = useMemo(
    () =>
      Array.isArray(studentProfileData?.competencyPerformance)
        ? studentProfileData.competencyPerformance
        : [],
    [studentProfileData],
  )

  const studentProfileStudents = useMemo(
    () => sourceData.students.filter((student) => sameId(student.classId, filters.classId)),
    [filters.classId, sourceData.students],
  )

  const masteryToneByStatus = (masteryStatusCode) => {
    const status = normalizeText(masteryStatusCode)
    if (status === 'mastered') return 'strong'
    if (status === 'developing') return 'warning'
    if (status === 'needs_support') return 'weak'
    return 'neutral'
  }

  const itemAnalysisChartData = competencyMasteryRows.map((row) => ({
    id: row.skillId,
    label: row.skillName || `Skill #${row.skillId}`,
    value: row.masteryPercentage,
    tone: masteryToneByStatus(row.masteryStatusCode),
  }))

  const masteryChartData = useMemo(
    () =>
      studentCompetencyPerformance.map((row) => ({
        id: row.skillId,
        label: row.skillName || `Skill #${row.skillId}`,
        value: row.masteryPercentage,
        tone: masteryToneByStatus(row.masteryStatusCode),
      })),
    [studentCompetencyPerformance],
  )

  const masterySummary = useMemo(() => {
    const mastered = studentCompetencyPerformance.filter(
      (row) => normalizeText(row.masteryStatusCode) === 'mastered',
    )
    const developing = studentCompetencyPerformance.filter(
      (row) => normalizeText(row.masteryStatusCode) === 'developing',
    )
    const needsSupport = studentCompetencyPerformance.filter(
      (row) => normalizeText(row.masteryStatusCode) === 'needs_support',
    )
    const ranked = [...studentCompetencyPerformance]
      .filter((row) => hasId(row.masteryPercentage))
      .sort((left, right) => Number(right.masteryPercentage) - Number(left.masteryPercentage))
    const topSkill = ranked[0] ?? null
    const weakestSkillCandidate = ranked.length ? ranked[ranked.length - 1] : null
    const weakestSkill =
      weakestSkillCandidate && weakestSkillCandidate !== topSkill ? weakestSkillCandidate : null

    return {
      masteredCount: mastered.length,
      developingCount: developing.length,
      needsSupportCount: needsSupport.length,
      topSkill,
      weakestSkill,
    }
  }, [studentCompetencyPerformance])

  const selectedReport =
    availableReportTypes.find((reportType) => reportType.code === selectedReportType) ??
    availableReportTypes.find((reportType) => reportType.enabled) ??
    null

  const activePrincipalTab =
    selectedReportType === 'student_performance_profile'
      ? 'by_student'
      : selectedReportType === 'teacher_sync_activity'
        ? 'by_sync_activity'
        : selectedReportType === 'learning_competency'
          ? 'by_learning_competency'
          : groupByDimension === 'TERM_PERIOD'
            ? 'by_term'
            : 'by_teacher'

  const isPrincipalStudentTab =
    effectiveRole === 'principal' && selectedReportType === 'student_performance_profile'

  const isLearningCompetencyReport = selectedReportType === 'learning_competency'

  const isSyncActivityReport = selectedReportType === 'teacher_sync_activity'

  const handlePrincipalTabClick = (tab) => {
    setSelectedReportType(tab.reportType)
    if (tab.groupBy) setGroupByDimension(tab.groupBy)
  }

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

      // Root/Specific competency options come from the fetched term/grade/subject tree,
      // so any change above that scope invalidates both selections.
      if (['academicYearId', 'termPeriodId', 'gradeLevelId', 'classId', 'teacherUserId', 'subjectId'].includes(field)) {
        nextFilters.rootTagId = ''
        nextFilters.skillId = ''
      }

      if (field === 'rootTagId') nextFilters.skillId = ''

      return nextFilters
    })
  }

  // Row-click shortcut: sets the Root and Specific competency dropdowns together so
  // they always match the drilled-into skill.
  const handleLearningCompetencySkillSelect = (rootTagId, skillId) => {
    setFilters((currentFilters) => ({
      ...currentFilters,
      rootTagId: String(rootTagId),
      skillId: String(skillId),
    }))
  }

  const assessmentStateText =
    filters.termPeriodId && filters.subjectId && !assessmentOptions.length
      ? 'No matching assessments are available.'
      : ''
  const optionLabel = (options, value) => options.find((option) => sameId(option.value, value))?.label
  const selectedScopeLabels = [
    !isPrincipalStudentTab && optionLabel(termOptions, filters.termPeriodId),
    ...(
      isLearningCompetencyReport
        ? [
            optionLabel(learningCompetencyGradeLevelOptions, filters.gradeLevelId),
            optionLabel(learningCompetencySubjectOptions, filters.subjectId),
            optionLabel(learningCompetencyRootOptions, filters.rootTagId),
            optionLabel(learningCompetencySkillOptions, filters.skillId),
          ]
        : isSyncActivityReport
          ? [
              effectiveRole === 'principal' && optionLabel(syncActivityTeacherOptions, filters.teacherUserId),
              filters.from && `From ${filters.from}`,
              filters.to && `To ${filters.to}`,
            ]
          : [
              effectiveRole === 'teacher'
                ? optionLabel(teacherClassOptions, `${filters.classId}::${filters.subjectId}`)
                : optionLabel(principalClassOptions, filters.classId),
              effectiveRole === 'principal' && !isPrincipalStudentTab && optionLabel(principalTeacherOptions, filters.teacherUserId),
              effectiveRole === 'principal' && !isPrincipalStudentTab && optionLabel(subjectOptions, filters.subjectId),
              selectedReportType !== 'student_performance_profile' && optionLabel(assessmentOptions, filters.testId),
              optionLabel(studentOptions, filters.studentId),
            ]
    ),
  ].filter(Boolean)

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
    <div
      className={`reports-page ${effectiveRole === 'principal' ? 'is-principal-reports' : ''}`}
    >
      <header className="reports-toolbar">
        <h1 id="reportResultHeading" className="reports-visually-hidden">
          {selectedReport?.label || 'Reports'}
        </h1>
        {effectiveRole === 'principal' ? (
          <div className="reports-principal-tab-group" role="tablist" aria-label="Report view">
            {PRINCIPAL_REPORT_TABS.map((tab) => {
              const TabIcon = tab.icon
              return (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={activePrincipalTab === tab.key}
                  className={`reports-principal-tab is-${tab.tone} ${activePrincipalTab === tab.key ? 'is-active' : ''}`}
                  onClick={() => handlePrincipalTabClick(tab)}
                >
                  <TabIcon size={16} strokeWidth={2.2} aria-hidden="true" />
                  {tab.label}
                </button>
              )
            })}
          </div>
        ) : (
          <label className="reports-view-select" htmlFor="reportView">
            <span id="reportViewLabel" className="reports-visually-hidden">Report type</span>
            <select
              id="reportView"
              aria-labelledby="reportViewLabel"
              value={selectedReportType}
              title={selectedReport?.label}
              onChange={(event) => setSelectedReportType(event.target.value)}
            >
              {availableReportTypes.map((reportType) => (
                <option key={reportType.code} value={reportType.code} disabled={!reportType.enabled}>
                  {reportType.label}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="reports-toolbar-actions">
          <button
            type="button"
            className="reports-filter-toggle"
            aria-expanded={isFiltersOpen && pageState.status === 'ready'}
            aria-controls="reportFilters"
            disabled={pageState.status !== 'ready'}
            onClick={() => setIsFiltersOpen((open) => !open)}
          >
            <SlidersHorizontal size={16} strokeWidth={2.1} aria-hidden="true" />
            Filters
            <ChevronDown size={14} aria-hidden="true" />
          </button>
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
          <div className="reports-export-actions">
            <button
              type="button"
              disabled={!canExportCurrentReport || exportState.status === 'loading'}
              title={canExportCurrentReport ? '' : REPORT_API_PENDING_MESSAGE}
              onClick={() => handleExportCurrentReport('pdf')}
            >
              <Download size={16} strokeWidth={2.1} aria-hidden="true" />
              {exportState.status === 'loading' && exportState.format === 'pdf' ? 'Preparing...' : 'PDF'}
            </button>
            <button
              type="button"
              disabled={!canExportCurrentReport || exportState.status === 'loading'}
              title={canExportCurrentReport ? '' : REPORT_API_PENDING_MESSAGE}
              onClick={() => handleExportCurrentReport('excel')}
            >
              <FileSpreadsheet size={16} strokeWidth={2.1} aria-hidden="true" />
              {exportState.status === 'loading' && exportState.format === 'excel' ? 'Preparing...' : 'Excel'}
            </button>
          </div>
        </div>
      </header>

      {pageState.status === 'ready' && selectedScopeLabels.length ? (
        <p className="reports-scope-summary" aria-label="Selected report scope">
          {selectedScopeLabels.join(' / ')}
        </p>
      ) : null}

      {pageState.status === 'loading' ? (
        <div className="reports-loading-state" role="status" aria-live="polite">
          <span className="reports-loading-spinner" aria-hidden="true" />
          Loading report filters...
        </div>
      ) : null}

      {exportState.status === 'error' ? (
        <p className="form-message form-message-error" role="alert">
          {exportState.message}
        </p>
      ) : null}

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

      <section
        id="reportFilters"
        className="reports-filter-panel"
        aria-label="Report filters"
        hidden={!isFiltersOpen || pageState.status !== 'ready'}
      >
          <div className={`reports-filter-grid is-${effectiveRole}`}>
            {!isPrincipalStudentTab ? (
              <FilterSelect
                id="reportTermPeriod"
                label="Term"
                value={filters.termPeriodId}
                options={termOptions}
                placeholder="Select term"
                disabled={!filters.academicYearId || !termOptions.length}
                onChange={(value) => handleFilterChange('termPeriodId', value)}
              />
            ) : null}

            {isSyncActivityReport || isLearningCompetencyReport ? null : effectiveRole === 'teacher' ? (
              <FilterSelect
                id="reportClass"
                label="Assigned class"
                value={filters.classId && filters.subjectId ? `${filters.classId}::${filters.subjectId}` : ''}
                options={teacherClassOptions}
                placeholder="Select class"
                disabled={!filters.academicYearId || !teacherClassOptions.length}
                onChange={handleTeacherClassSubjectChange}
              />
            ) : (
              <FilterSelect
                id="reportClass"
                label="Class"
                value={filters.classId}
                options={principalClassOptions}
                placeholder="Select class"
                disabled={!filters.academicYearId}
                onChange={(value) => handleFilterChange('classId', value)}
              />
            )}

            {effectiveRole === 'principal' && !isPrincipalStudentTab && !isLearningCompetencyReport ? (
              <FilterSelect
                id="reportTeacher"
                label="Teacher"
                value={filters.teacherUserId}
                options={isSyncActivityReport ? syncActivityTeacherOptions : principalTeacherOptions}
                placeholder="Select teacher"
                disabled={
                  isSyncActivityReport
                    ? !syncActivityTeacherOptions.length
                    : !filters.classId || !principalTeacherOptions.length
                }
                onChange={(value) => handleFilterChange('teacherUserId', value)}
              />
            ) : null}

            {effectiveRole === 'principal' && !isPrincipalStudentTab && !isSyncActivityReport && !isLearningCompetencyReport ? (
              <FilterSelect
                id="reportSubject"
                label="Subject"
                value={filters.subjectId}
                options={subjectOptions}
                placeholder="Select subject"
                disabled={!filters.classId || !filters.teacherUserId || !subjectOptions.length}
                onChange={(value) => handleFilterChange('subjectId', value)}
              />
            ) : null}

            {isLearningCompetencyReport ? (
              <>
                <FilterSelect
                  id="reportGradeLevel"
                  label="Grade level"
                  value={filters.gradeLevelId}
                  options={learningCompetencyGradeLevelOptions}
                  placeholder="Select grade level"
                  disabled={!filters.termPeriodId || !learningCompetencyGradeLevelOptions.length}
                  onChange={(value) => handleFilterChange('gradeLevelId', value)}
                />
                <FilterSelect
                  id="reportLearningCompetencySubject"
                  label="Subject"
                  value={filters.subjectId}
                  options={learningCompetencySubjectOptions}
                  placeholder="Select subject"
                  disabled={!filters.gradeLevelId || !learningCompetencySubjectOptions.length}
                  onChange={(value) => handleFilterChange('subjectId', value)}
                />
                <FilterSelect
                  id="reportRootCompetency"
                  label="Root competency (optional)"
                  value={filters.rootTagId}
                  options={learningCompetencyRootOptions}
                  placeholder="All root competencies"
                  disabled={!learningCompetencyRootOptions.length}
                  onChange={(value) => handleFilterChange('rootTagId', value)}
                />
                <FilterSelect
                  id="reportSpecificCompetency"
                  label="Specific competency (optional)"
                  value={filters.skillId}
                  options={learningCompetencySkillOptions}
                  placeholder={filters.rootTagId ? 'All competencies' : 'Select root competency first'}
                  disabled={!learningCompetencySkillOptions.length}
                  onChange={(value) => handleFilterChange('skillId', value)}
                />
              </>
            ) : null}

            {isSyncActivityReport ? (
              <>
                <label className="reports-filter-field" htmlFor="reportSyncFrom">
                  <span>From (optional)</span>
                  <input
                    id="reportSyncFrom"
                    type="date"
                    value={filters.from}
                    max={filters.to || undefined}
                    onChange={(event) => handleFilterChange('from', event.target.value)}
                  />
                </label>
                <label className="reports-filter-field" htmlFor="reportSyncTo">
                  <span>To (optional)</span>
                  <input
                    id="reportSyncTo"
                    type="date"
                    value={filters.to}
                    min={filters.from || undefined}
                    onChange={(event) => handleFilterChange('to', event.target.value)}
                  />
                </label>
              </>
            ) : null}

            {effectiveRole === 'teacher' && !isSyncActivityReport && !isLearningCompetencyReport ? (
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
            ) : null}

            {selectedReportType !== 'student_performance_profile' && !isSyncActivityReport && !isLearningCompetencyReport ? (
              <FilterSelect
                id="reportStudent"
                label="Student (optional)"
                value={filters.studentId}
                options={studentOptions}
                placeholder="All students"
                disabled={!filters.classId || !studentOptions.length}
                onChange={(value) => handleFilterChange('studentId', value)}
              />
            ) : null}
          </div>
      </section>

      <section
        className="reports-result-panel"
        aria-labelledby="reportResultHeading"
        hidden={pageState.status !== 'ready'}
      >
        {selectedReportType === 'assessment_results' ? (
        <>
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
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.length ? (
                    visibleRows.map((row) => (
                      <tr key={row.classListId ?? row.studentId ?? row.studentLrn}>
                        <td>
                          <strong>{toTitleCase(row.fullName) || 'Student name not available'}</strong>
                          <small>{row.studentLrn ? `LRN ${row.studentLrn}` : 'LRN not available'}</small>
                        </td>
                        <td>
                          {row.earnedPoints === null || row.earnedPoints === undefined
                            ? 'Not available'
                            : `${formatBackendNumber(row.earnedPoints)} / ${formatBackendNumber(row.maximumPoints)}`}
                        </td>
                        <td>{formatBackendNumber(row.percentage, '%')}</td>
                        <td>{row.performanceStatusLabel || 'Not available'}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="4" className="reports-results-empty">
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
        </>
        ) : null}

        {selectedReportType === 'item_analysis_competency_mastery' ? (
        <>
        {itemAnalysisState.status === 'idle' ? (
          <div className="reports-unavailable-state" role="status">
            <FileText size={22} strokeWidth={1.8} aria-hidden="true" />
            <strong>Select an assessment</strong>
            <span>A matching assessment and class assignment are required.</span>
          </div>
        ) : null}

        {itemAnalysisState.status === 'loading' ? (
          <div className="reports-report-loading" role="status" aria-live="polite">
            <span className="reports-loading-spinner" aria-hidden="true" />
            Loading item analysis and competency mastery...
          </div>
        ) : null}

        {['authorization', 'not-found', 'invalid', 'unavailable'].includes(itemAnalysisState.status) ? (
          <div className="reports-report-error" role="alert">
            <ShieldAlert size={22} strokeWidth={1.9} aria-hidden="true" />
            <div>
              <strong>Item analysis unavailable</strong>
              <span>{itemAnalysisState.message}</span>
              {itemAnalysisState.code ? <small>{itemAnalysisState.code}</small> : null}
            </div>
          </div>
        ) : null}

        {itemAnalysisData ? (
          <div className="reports-assessment-results">
            <div className="reports-report-meta">
              <div>
                <strong>{itemAnalysisData.scope?.testName || 'Item analysis'}</strong>
                <span>
                  {[itemAnalysisData.scope?.gradeLevelName, itemAnalysisData.scope?.sectionName]
                    .filter(Boolean)
                    .join(' - ') || 'Class not available'}
                  {' | '}
                  {itemAnalysisData.scope?.subjectName || 'Subject not available'}
                </span>
              </div>
              <div>
                <span className={`reports-data-status is-${normalizeText(itemAnalysisData.dataStatus)}`}>
                  {formatStatus(itemAnalysisData.dataStatus)}
                </span>
                <small>
                  Generated {formatLocalDate(itemAnalysisData.generatedAt, 'time not available')}
                </small>
              </div>
            </div>

            {itemAnalysisData.dataStatus === 'empty' || itemAnalysisData.dataStatus === 'partial' ? (
              <div className={`reports-data-notice is-${itemAnalysisData.dataStatus}`} role="status">
                <strong>{formatStatus(itemAnalysisData.dataStatus)} report data</strong>
                <span>{getDataStatusCopy(itemAnalysisData.dataStatus)}</span>
              </div>
            ) : null}

            {Array.isArray(itemAnalysisData.warnings) && itemAnalysisData.warnings.length ? (
              <div className="reports-warning-list" aria-label="Backend report warnings">
                {itemAnalysisData.warnings.map((warning, index) => (
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
                    <th>Item</th>
                    <th>Type</th>
                    <th>Competency</th>
                    <th>Correct</th>
                    <th>Incorrect</th>
                    <th>Unanswered</th>
                  </tr>
                </thead>
                <tbody>
                  {itemAnalysisRows.length ? (
                    itemAnalysisRows.map((row, index) => (
                      <tr key={row.questionId}>
                        <td>
                          <strong>Item {index + 1}</strong>
                        </td>
                        <td>{formatStatus(row.questionTypeCode)}</td>
                        <td>
                          {Array.isArray(row.skillIds) && row.skillIds.length
                            ? row.skillIds
                                .map((skillId) => skillNameById.get(String(skillId)) || `Skill #${skillId}`)
                                .join(', ')
                            : 'Not mapped'}
                        </td>
                        <td>{formatBackendCount(row.correctCount)}</td>
                        <td>{formatBackendCount(row.incorrectCount)}</td>
                        <td>{formatBackendCount(row.unansweredCount)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6" className="reports-results-empty">
                        No item rows are available.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="reports-report-meta">
              <div>
                <strong>Competency mastery</strong>
                <span>Backend-computed mastery per assessed skill for this class.</span>
              </div>
            </div>

            {itemAnalysisChartData.length ? (
              <HorizontalMasteryChart
                data={itemAnalysisChartData}
                height={Math.max(180, itemAnalysisChartData.length * 34)}
              />
            ) : null}

            <div className="reports-results-table-wrap">
              <table className="reports-results-table">
                <thead>
                  <tr>
                    <th>Skill</th>
                    <th>Items assessed</th>
                    <th>Students</th>
                    <th>Mastery</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {competencyMasteryRows.length ? (
                    competencyMasteryRows.map((row) => {
                      const hasStudents = Array.isArray(row.students) && row.students.length > 0
                      const isExpanded = expandedSkillIds.has(row.skillId)

                      return (
                        <Fragment key={row.skillId}>
                          <tr>
                            <td>
                              {hasStudents ? (
                                <button
                                  type="button"
                                  className="reports-skill-expand-toggle"
                                  onClick={() => toggleSkillExpanded(row.skillId)}
                                  aria-expanded={isExpanded}
                                >
                                  {isExpanded ? (
                                    <ChevronDown size={15} strokeWidth={2.2} aria-hidden="true" />
                                  ) : (
                                    <ChevronRight size={15} strokeWidth={2.2} aria-hidden="true" />
                                  )}
                                  {row.skillName || `Skill #${row.skillId}`}
                                </button>
                              ) : (
                                row.skillName || `Skill #${row.skillId}`
                              )}
                            </td>
                            <td>{formatBackendCount(row.assessedItemCount)}</td>
                            <td>{formatBackendCount(row.studentCount)}</td>
                            <td>{formatBackendNumber(row.masteryPercentage, '%')}</td>
                            <td>
                              <span className={`performance-pill ${getMasteryPillClass(row.masteryStatusCode)}`}>
                                {formatStatus(row.masteryStatusCode)}
                              </span>
                            </td>
                          </tr>
                          {isExpanded && hasStudents ? (
                            <tr className="reports-skill-students-row">
                              <td colSpan="5">
                                <div className="reports-skill-students-list">
                                  {row.students.map((student) => (
                                    <div key={student.studentId} className="reports-skill-students-item">
                                      <div className="reports-skill-students-item-heading">
                                        <span>{toTitleCase(student.fullName) || 'Student name not available'}</span>
                                        <span className="reports-skill-students-item-pills">
                                          <span
                                            className={`performance-pill ${getMasteryPillClass(student.masteryStatusCode)}`}
                                          >
                                            {formatBackendNumber(student.masteryPercentage, '%')}
                                          </span>
                                          {student.recommendationCode ? (
                                            <span
                                              className={`reports-mastery-pill is-tone-${getRecommendationToneIndex(student.recommendationCode)}`}
                                            >
                                              {student.recommendationLabel || formatStatus(student.recommendationCode)}
                                            </span>
                                          ) : null}
                                        </span>
                                      </div>
                                      {student.suggestion ? (
                                        <p className="reports-intervention-suggestion">{student.suggestion}</p>
                                      ) : null}
                                    </div>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          ) : null}
                        </Fragment>
                      )
                    })
                  ) : (
                    <tr>
                      <td colSpan="5" className="reports-results-empty">
                        No competency mastery rows are available.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
        </>
        ) : null}

        {selectedReportType === 'principal_consolidated' ? (
        <>
        {!filters.testId ? (
          <div className="reports-assessment-results">
            {principalAssessmentCards.length ? (
              <div className="reports-report-meta">
                <div>
                  <strong>Assessments</strong>
                  <span>Select an assessment to view its consolidated results.</span>
                </div>
              </div>
            ) : null}

            {principalAssessmentCards.length ? (
              <div className="reports-student-list" role="list" aria-label="Assessments in this scope">
                {principalAssessmentCards.map((assessment) => (
                  <button
                    type="button"
                    key={assessment.testId}
                    className="reports-student-row"
                    role="listitem"
                    onClick={() => handleFilterChange('testId', String(assessment.testId))}
                  >
                    <span className="reports-student-avatar" aria-hidden="true">
                      <ClipboardList size={16} strokeWidth={2.2} />
                    </span>
                    <span className="reports-student-copy">
                      <strong>{assessment.testName || 'Untitled assessment'}</strong>
                      <small>{formatLocalDate(assessment.openAt, 'Open date not available')}</small>
                    </span>
                    <ChevronRight size={18} strokeWidth={2.2} aria-hidden="true" />
                  </button>
                ))}
              </div>
            ) : (
              <p className="reports-results-empty">
                {filters.classId && filters.teacherUserId && filters.subjectId
                  ? 'No assessments were found for this scope.'
                  : 'Select a class, teacher, and subject to list assessments.'}
              </p>
            )}
          </div>
        ) : (
        <>
        <button
          type="button"
          className="reports-student-back"
          onClick={() => handleFilterChange('testId', '')}
        >
          <ArrowLeft size={16} strokeWidth={2.2} aria-hidden="true" />
          Back to assessments
        </button>

        {consolidatedState.status === 'loading' ? (
          <div className="reports-report-loading" role="status" aria-live="polite">
            <span className="reports-loading-spinner" aria-hidden="true" />
            Loading the consolidated report...
          </div>
        ) : null}

        {['authorization', 'not-found', 'invalid', 'unavailable'].includes(consolidatedState.status) ? (
          <div className="reports-report-error" role="alert">
            <ShieldAlert size={22} strokeWidth={1.9} aria-hidden="true" />
            <div>
              <strong>Consolidated report unavailable</strong>
              <span>{consolidatedState.message}</span>
              {consolidatedState.code ? <small>{consolidatedState.code}</small> : null}
            </div>
          </div>
        ) : null}

        {consolidatedData ? (
          <div className="reports-assessment-results">
            <div className="reports-report-meta">
              <div>
                <strong>Consolidated by {formatStatus(consolidatedData.groupedBy)}</strong>
                <span>School-wide unless filters above narrow the scope.</span>
              </div>
              <div>
                <span className={`reports-data-status is-${normalizeText(consolidatedData.dataStatus)}`}>
                  {formatStatus(consolidatedData.dataStatus)}
                </span>
                <small>
                  Generated {formatLocalDate(consolidatedData.generatedAt, 'time not available')}
                </small>
              </div>
            </div>

            {consolidatedData.dataStatus === 'empty' || consolidatedData.dataStatus === 'partial' ? (
              <div className={`reports-data-notice is-${consolidatedData.dataStatus}`} role="status">
                <strong>{formatStatus(consolidatedData.dataStatus)} report data</strong>
                <span>{getDataStatusCopy(consolidatedData.dataStatus)}</span>
              </div>
            ) : null}

            {Array.isArray(consolidatedData.warnings) && consolidatedData.warnings.length ? (
              <div className="reports-warning-list" aria-label="Backend report warnings">
                {consolidatedData.warnings.map((warning, index) => (
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

            {consolidatedChartData.length ? (
              <VerticalMasteryChart
                data={consolidatedChartData}
                height={220}
              />
            ) : null}

            {consolidatedGroups.length ? (
              <div className="reports-consolidated-grid">
                {consolidatedGroups.map((group) => (
                  <article className="reports-consolidated-card" key={group.groupKey}>
                    <header>
                      <strong>{group.groupLabel || `Group ${group.groupKey}`}</strong>
                      <span>{formatBackendCount(group.studentCount)} students</span>
                    </header>

                    <div className="reports-consolidated-metric">
                      <span>Mean percentage</span>
                      <strong className={`performance-pill ${getScoreToneClass(group.meanPercentage)}`}>
                        {formatBackendNumber(group.meanPercentage, '%')}
                      </strong>
                    </div>

                    <div className="reports-consolidated-section">
                      <span>Mastery status breakdown</span>
                      {Array.isArray(group.masteryStatusCounts) && group.masteryStatusCounts.length ? (
                        <div className="reports-mastery-pill-row">
                          {group.masteryStatusCounts.map((status, index) => (
                            <span
                              key={`${status.performanceStatus}-${index}`}
                              className={`reports-mastery-pill is-tone-${getRecommendationToneIndex(status.performanceStatus)}`}
                            >
                              {formatStatus(status.performanceStatus)}: {formatBackendCount(status.count)}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <small>Not available yet.</small>
                      )}
                    </div>

                    <div className="reports-consolidated-section">
                      <span>Least mastered skills</span>
                      {Array.isArray(group.leastMasteredSkills) && group.leastMasteredSkills.length ? (
                        <ul className="reports-skill-list">
                          {group.leastMasteredSkills.map((skill) => (
                            <li key={skill.skillId}>
                              <div className="reports-skill-heading">
                                <span
                                  className={`performance-pill ${getMasteryPillClass(skill.masteryStatusCode)}`}
                                >
                                  {skill.skillName || `Skill #${skill.skillId}`}
                                </span>
                                <small>{formatBackendNumber(skill.masteryPercentage, '%')}</small>
                              </div>
                              <div className="reports-skill-bar">
                                <div
                                  className={`reports-skill-bar-fill ${getScoreToneClass(skill.masteryPercentage)}`}
                                  style={{ width: `${Math.min(100, Math.max(0, Number(skill.masteryPercentage) || 0))}%` }}
                                />
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <small>Not available yet.</small>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="reports-results-empty">No groups matched this scope.</p>
            )}
          </div>
        ) : null}
        </>
        )}
        </>
        ) : null}

        {selectedReportType === 'teacher_sync_activity' ? (
        <>
        {syncActivityState.status === 'loading' ? (
          <div className="reports-report-loading" role="status" aria-live="polite">
            <span className="reports-loading-spinner" aria-hidden="true" />
            Loading the sync activity report...
          </div>
        ) : null}

        {['authorization', 'not-found', 'invalid', 'unavailable'].includes(syncActivityState.status) ? (
          <div className="reports-report-error" role="alert">
            <ShieldAlert size={22} strokeWidth={1.9} aria-hidden="true" />
            <div>
              <strong>Sync activity report unavailable</strong>
              <span>{syncActivityState.message}</span>
              {syncActivityState.code ? <small>{syncActivityState.code}</small> : null}
            </div>
          </div>
        ) : null}

        {syncActivityData ? (
          <div className="reports-assessment-results">
            <div className="reports-report-meta">
              <div>
                <strong>Teacher sync activity</strong>
                <span>Who has uploaded results, when, and which syncs failed.</span>
              </div>
              <div>
                <span className={`reports-data-status is-${normalizeText(syncActivityData.dataStatus)}`}>
                  {formatStatus(syncActivityData.dataStatus)}
                </span>
                <small>
                  Generated {formatLocalDate(syncActivityData.generatedAt, 'time not available')}
                </small>
              </div>
            </div>

            {syncActivityData.dataStatus === 'empty' ? (
              <div className="reports-data-notice is-empty" role="status">
                <strong>Empty report data</strong>
                <span>{getDataStatusCopy(syncActivityData.dataStatus)}</span>
              </div>
            ) : null}

            {Array.isArray(syncActivityData.warnings) && syncActivityData.warnings.length ? (
              <div className="reports-warning-list" aria-label="Backend report warnings">
                {syncActivityData.warnings.map((warning, index) => (
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
                    <th>Teacher</th>
                    <th>Last synced</th>
                    <th>Assessments synced</th>
                    <th>Not uploaded</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.isArray(syncActivityData.teachers) && syncActivityData.teachers.length ? (
                    syncActivityData.teachers.map((teacher) => (
                      <tr key={teacher.teacherUserId}>
                        <td>{toTitleCase(teacher.teacherName) || 'Teacher name not available'}</td>
                        <td>{formatLocalDate(teacher.lastSyncedAt, 'Never')}</td>
                        <td>{formatBackendCount(teacher.assessmentsSynced)}</td>
                        <td>
                          {teacher.resultsNotUploaded ? (
                            <span className="performance-pill is-needs-support">
                              {formatBackendCount(teacher.resultsNotUploaded)} not uploaded
                            </span>
                          ) : (
                            <span className="performance-pill is-proficient">All uploaded</span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="4" className="reports-results-empty">
                        No teachers matched this scope.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="reports-report-meta">
              <div>
                <strong>Synced assessments</strong>
                <span>Most recently active first.</span>
              </div>
            </div>

            <div className="reports-results-table-wrap">
              <table className="reports-results-table">
                <thead>
                  <tr>
                    <th>Assessment</th>
                    <th>Class</th>
                    <th>Teacher</th>
                    <th>Last synced</th>
                    <th>Upload status</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.isArray(syncActivityData.assessments) && syncActivityData.assessments.length ? (
                    syncActivityData.assessments.map((assessment) => (
                      <tr key={`${assessment.teacherUserId}-${assessment.testAssignmentId}`}>
                        <td>{assessment.assessmentName || 'Untitled assessment'}</td>
                        <td>{assessment.className || 'Not available'}</td>
                        <td>{toTitleCase(assessment.teacherName) || 'Teacher name not available'}</td>
                        <td>{formatLocalDate(assessment.lastSyncedAt, 'Never')}</td>
                        <td>
                          {assessment.resultsNotUploaded ? (
                            <span
                              className="performance-pill is-needs-support"
                              title={assessment.uploadErrorDetails || ''}
                            >
                              {formatBackendCount(assessment.resultsNotUploaded)} not uploaded
                            </span>
                          ) : (
                            <span className="performance-pill is-proficient">All uploaded</span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" className="reports-results-empty">
                        No synced assessments matched this scope.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
        </>
        ) : null}

        {selectedReportType === 'learning_competency' ? (
        <>
        {learningCompetencyState.status === 'loading' ? (
          <div className="reports-report-loading" role="status" aria-live="polite">
            <span className="reports-loading-spinner" aria-hidden="true" />
            Loading the learning competency report...
          </div>
        ) : null}

        {['authorization', 'not-found', 'invalid', 'unavailable'].includes(learningCompetencyState.status) ? (
          <div className="reports-report-error" role="alert">
            <ShieldAlert size={22} strokeWidth={1.9} aria-hidden="true" />
            <div>
              <strong>Learning competency report unavailable</strong>
              <span>{learningCompetencyState.message}</span>
              {learningCompetencyState.code ? <small>{learningCompetencyState.code}</small> : null}
            </div>
          </div>
        ) : null}

        {learningCompetencyData ? (
          <div className="reports-assessment-results">
            <div className="reports-report-meta">
              <div>
                <strong>Learning competency</strong>
                <span>
                  {Array.isArray(learningCompetencyData.assessments) && learningCompetencyData.assessments.length
                    ? `Based on ${formatBackendCount(learningCompetencyData.assessments.length)} assessment${
                        learningCompetencyData.assessments.length === 1 ? '' : 's'
                      } this term.`
                    : 'No finalized assessments yet this term.'}
                </span>
              </div>
              <div>
                <span className={`reports-data-status is-${normalizeText(learningCompetencyData.dataStatus)}`}>
                  {formatStatus(learningCompetencyData.dataStatus)}
                </span>
                <small>
                  Generated {formatLocalDate(learningCompetencyData.generatedAt, 'time not available')}
                </small>
              </div>
            </div>

            {learningCompetencyData.dataStatus === 'empty' ? (
              <div className="reports-data-notice is-empty" role="status">
                <strong>Empty report data</strong>
                <span>{getDataStatusCopy(learningCompetencyData.dataStatus)}</span>
              </div>
            ) : null}

            {Array.isArray(learningCompetencyData.warnings) && learningCompetencyData.warnings.length ? (
              <div className="reports-warning-list" aria-label="Backend report warnings">
                {learningCompetencyData.warnings.map((warning, index) => (
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

            {!selectedLearningCompetencySkill ? (
              Array.isArray(learningCompetencyData.rootCompetencies) &&
              learningCompetencyData.rootCompetencies.length ? (
                <>
                  {learningCompetencyData.rootCompetencies
                    .filter((root) => !filters.rootTagId || sameId(root.rootTagId, filters.rootTagId))
                    .map((root) => (
                      <div key={root.rootTagId}>
                        <div className="reports-report-meta">
                          <div>
                            <strong>{root.rootTagName}</strong>
                            <span>Least mastered competencies first. Click one to see who needs help.</span>
                          </div>
                          <span
                            className={`performance-pill ${getMasteryPillClass(root.masteryStatusCode)}`}
                          >
                            {formatBackendNumber(root.masteryPercentage, '%')}
                          </span>
                        </div>

                        <div className="reports-results-table-wrap">
                          <table className="reports-results-table">
                            <thead>
                              <tr>
                                <th>Competency</th>
                                <th>Mastery</th>
                                <th>Weak students</th>
                                <th>Intervention</th>
                              </tr>
                            </thead>
                            <tbody>
                              {root.skills.map((skill) => (
                                <tr
                                  key={skill.skillId}
                                  className="reports-clickable-row"
                                  onClick={() => handleLearningCompetencySkillSelect(root.rootTagId, skill.skillId)}
                                >
                                  <td>{skill.competencyName || `Skill #${skill.skillId}`}</td>
                                  <td>
                                    <span
                                      className={`performance-pill ${getMasteryPillClass(skill.masteryStatusCode)}`}
                                    >
                                      {formatBackendNumber(skill.masteryPercentage, '%')}
                                    </span>
                                  </td>
                                  <td>{formatBackendCount(skill.weakStudentCount)}</td>
                                  <td>
                                    {skill.recommendationCode ? (
                                      <span
                                        className={`reports-mastery-pill is-tone-${getRecommendationToneIndex(skill.recommendationCode)}`}
                                        title={skill.suggestion || ''}
                                      >
                                        {skill.recommendationLabel || formatStatus(skill.recommendationCode)}
                                      </span>
                                    ) : (
                                      'Not available'
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        <HorizontalMasteryChart
                          data={root.skills.map((skill) => ({
                            id: skill.skillId,
                            label: skill.competencyName || `Skill #${skill.skillId}`,
                            value: skill.masteryPercentage,
                            tone: masteryToneByStatus(skill.masteryStatusCode),
                          }))}
                          height={Math.max(180, root.skills.length * 34)}
                        />
                      </div>
                    ))}
                </>
              ) : (
                <p className="reports-results-empty">No competencies matched this scope.</p>
              )
            ) : (
              <>
                <button
                  type="button"
                  className="reports-student-back"
                  onClick={() => handleFilterChange('skillId', '')}
                >
                  <ArrowLeft size={16} strokeWidth={2.2} aria-hidden="true" />
                  Back to competencies
                </button>

                <div className="reports-report-meta">
                  <div>
                    <strong>{selectedLearningCompetencySkill.competencyName}</strong>
                    <span>
                      {selectedLearningCompetencySkill.rootTagName} · Mastery{' '}
                      {formatBackendNumber(selectedLearningCompetencySkill.masteryPercentage, '%')}
                    </span>
                  </div>
                </div>

                {selectedLearningCompetencySkill.recommendationCode ? (
                  <article className="reports-consolidated-card">
                    <header>
                      <strong>Suggested intervention for the class</strong>
                      <span
                        className={`reports-mastery-pill is-tone-${getRecommendationToneIndex(selectedLearningCompetencySkill.recommendationCode)}`}
                      >
                        {selectedLearningCompetencySkill.recommendationLabel ||
                          formatStatus(selectedLearningCompetencySkill.recommendationCode)}
                      </span>
                    </header>

                    <div className="reports-consolidated-metric">
                      <span>
                        Class mastery {formatBackendNumber(selectedLearningCompetencySkill.masteryPercentage, '%')} ·{' '}
                        {formatBackendCount(selectedLearningCompetencySkill.weakStudentCount)} of{' '}
                        {formatBackendCount(selectedLearningCompetencySkill.studentCount)} students below 80%
                      </span>
                    </div>

                    {selectedLearningCompetencySkill.suggestion ? (
                      <p className="reports-intervention-suggestion">{selectedLearningCompetencySkill.suggestion}</p>
                    ) : null}
                  </article>
                ) : null}

                <div className="reports-results-table-wrap">
                  <table className="reports-results-table">
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th>Section</th>
                        <th>Assessments</th>
                        <th>Mastery</th>
                        <th>Recommendation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.isArray(selectedLearningCompetencySkill.weakStudents) &&
                      selectedLearningCompetencySkill.weakStudents.length ? (
                        selectedLearningCompetencySkill.weakStudents.map((student) => (
                          <tr key={student.studentId}>
                            <td>{toTitleCase(student.fullName) || 'Student name not available'}</td>
                            <td>{student.sectionName || 'Not available'}</td>
                            <td>{formatBackendCount(student.assessmentCount)}</td>
                            <td>
                              <span
                                className={`performance-pill ${getMasteryPillClass(student.masteryStatusCode)}`}
                              >
                                {formatBackendNumber(student.masteryPercentage, '%')}
                              </span>
                            </td>
                            <td>
                              {student.recommendationCode ? (
                                <span
                                  className={`reports-mastery-pill is-tone-${getRecommendationToneIndex(student.recommendationCode)}`}
                                  title={student.suggestion || ''}
                                >
                                  {student.recommendationLabel || formatStatus(student.recommendationCode)}
                                </span>
                              ) : (
                                'Not available'
                              )}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="5" className="reports-results-empty">
                            No students are below the mastery line for this competency.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        ) : null}
        </>
        ) : null}

        {selectedReportType === 'student_performance_profile' ? (
        <>
        {studentProfileState.status === 'idle' ? (
          filters.classId ? (
            <div className="reports-assessment-results">
              <div className="reports-report-meta">
                <div>
                  <strong>Students</strong>
                  <span>Select a student to view their performance profile.</span>
                </div>
              </div>

              {studentProfileStudents.length ? (
                <div className="reports-student-list" role="list" aria-label="Students in this class">
                  {studentProfileStudents.map((student) => (
                    <button
                      type="button"
                      key={student.studentId}
                      className="reports-student-row"
                      role="listitem"
                      onClick={() => handleFilterChange('studentId', String(student.studentId))}
                    >
                      <span className="reports-student-avatar" aria-hidden="true">
                        {getInitials(toTitleCase(student.fullName))}
                      </span>
                      <span className="reports-student-copy">
                        <strong>{toTitleCase(student.fullName) || 'Student name not available'}</strong>
                        <small>{student.studentLrn ? `LRN ${student.studentLrn}` : 'LRN not available'}</small>
                      </span>
                      <ChevronRight size={18} strokeWidth={2.2} aria-hidden="true" />
                    </button>
                  ))}
                </div>
              ) : (
                <p className="reports-results-empty">No enrolled students were found for this class.</p>
              )}
            </div>
          ) : (
            <div className="reports-unavailable-state" role="status">
              <UserRound size={22} strokeWidth={1.8} aria-hidden="true" />
              <strong>Select a class first</strong>
              <span>Choose an assigned class from the filters above to list its students.</span>
            </div>
          )
        ) : null}

        {studentProfileState.status === 'loading' ? (
          <div className="reports-report-loading" role="status" aria-live="polite">
            <span className="reports-loading-spinner" aria-hidden="true" />
            Loading the student performance profile...
          </div>
        ) : null}

        {['authorization', 'not-found', 'invalid', 'unavailable'].includes(studentProfileState.status) ? (
          <div className="reports-report-error" role="alert">
            <ShieldAlert size={22} strokeWidth={1.9} aria-hidden="true" />
            <div>
              <strong>Student performance profile unavailable</strong>
              <span>{studentProfileState.message}</span>
              {studentProfileState.code ? <small>{studentProfileState.code}</small> : null}
            </div>
          </div>
        ) : null}

        {studentProfileData ? (
          <div className="reports-assessment-results">
            <button
              type="button"
              className="reports-student-back"
              onClick={() => handleFilterChange('studentId', '')}
            >
              <ArrowLeft size={16} strokeWidth={2.2} aria-hidden="true" />
              Back to students
            </button>

            <div className="reports-report-meta">
              <div className="reports-profile-identity">
                <span className="reports-profile-avatar" aria-hidden="true">
                  {getInitials(toTitleCase(studentProfileData.fullName))}
                </span>
                <div>
                  <strong>{toTitleCase(studentProfileData.fullName) || 'Student profile'}</strong>
                  <span>
                    {studentProfileData.studentLrn ? `LRN ${studentProfileData.studentLrn}` : 'LRN not available'}
                  </span>
                  {studentProfileData.gradeLevelName || studentProfileData.sectionName ? (
                    <span>{classLabel(studentProfileData)}</span>
                  ) : null}
                </div>
              </div>
              <div>
                <span className={`reports-data-status is-${normalizeText(studentProfileData.dataStatus)}`}>
                  {formatStatus(studentProfileData.dataStatus)}
                </span>
                <small>
                  Generated {formatLocalDate(studentProfileData.generatedAt, 'time not available')}
                </small>
              </div>
            </div>

            {studentCompetencyPerformance.length ? (
              <div className="reports-summary-grid is-mastery" aria-label="Mastery summary">
                <article className="is-mastered">
                  <CheckCircle2 size={18} aria-hidden="true" />
                  <span>Mastered skills</span>
                  <strong>{masterySummary.masteredCount}</strong>
                </article>
                <article className="is-developing">
                  <Clock3 size={18} aria-hidden="true" />
                  <span>Developing</span>
                  <strong>{masterySummary.developingCount}</strong>
                </article>
                <article className="is-needs-support">
                  <ShieldAlert size={18} aria-hidden="true" />
                  <span>Needs support</span>
                  <strong>{masterySummary.needsSupportCount}</strong>
                </article>
                {masterySummary.topSkill ? (
                  <article className="is-positive">
                    <Trophy size={18} aria-hidden="true" />
                    <span>Most mastered</span>
                    <strong>{masterySummary.topSkill.skillName || 'Skill'}</strong>
                    <small>{formatBackendNumber(masterySummary.topSkill.masteryPercentage, '%')}</small>
                  </article>
                ) : null}
                {masterySummary.weakestSkill ? (
                  <article className="is-negative">
                    <TrendingDown size={18} aria-hidden="true" />
                    <span>Needs the most support</span>
                    <strong>{masterySummary.weakestSkill.skillName || 'Skill'}</strong>
                    <small>{formatBackendNumber(masterySummary.weakestSkill.masteryPercentage, '%')}</small>
                  </article>
                ) : null}
              </div>
            ) : null}

            {studentCompetencyPerformance.length ? (
              <div className="reports-report-meta">
                <div>
                  <strong>Mastery by skill</strong>
                  <span>Backend-computed mastery percentage per assessed skill.</span>
                </div>
              </div>
            ) : null}

            {studentCompetencyPerformance.length ? (
              <HorizontalMasteryChart
                data={masteryChartData}
                height={Math.max(180, studentCompetencyPerformance.length * 34)}
              />
            ) : null}

            {studentProfileData.dataStatus === 'empty' || studentProfileData.dataStatus === 'partial' ? (
              <div className={`reports-data-notice is-${studentProfileData.dataStatus}`} role="status">
                <strong>{formatStatus(studentProfileData.dataStatus)} report data</strong>
                <span>{getDataStatusCopy(studentProfileData.dataStatus)}</span>
              </div>
            ) : null}

            {Array.isArray(studentProfileData.warnings) && studentProfileData.warnings.length ? (
              <div className="reports-warning-list" aria-label="Backend report warnings">
                {studentProfileData.warnings.map((warning, index) => (
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

            <div className="reports-report-meta">
              <div>
                <strong>Intervention suggestions</strong>
                <span>Backend-generated recommendations for skills needing action.</span>
              </div>
            </div>

            {Array.isArray(studentProfileData.interventions) && studentProfileData.interventions.length ? (
              <div className="reports-consolidated-grid">
                {studentProfileData.interventions.map((item) => (
                  <article className="reports-consolidated-card" key={item.skillId}>
                    <header>
                      <strong>{item.skillName || `Skill #${item.skillId}`}</strong>
                      <span
                        className={`reports-mastery-pill is-tone-${getRecommendationToneIndex(item.recommendationCode)}`}
                      >
                        {item.recommendationLabel || formatStatus(item.recommendationCode)}
                      </span>
                    </header>

                    <div className="reports-consolidated-metric">
                      <span>Mastery</span>
                      <strong className={`performance-pill ${getScoreToneClass(item.masteryPercentage)}`}>
                        {formatBackendNumber(item.masteryPercentage, '%')}
                      </strong>
                    </div>

                    {item.suggestion ? <p className="reports-intervention-suggestion">{item.suggestion}</p> : null}
                  </article>
                ))}
              </div>
            ) : (
              <p className="reports-results-empty">No skill currently needs intervention.</p>
            )}

            <div className="reports-report-meta">
              <div>
                <strong>Assessment results</strong>
                <span>Every finalized assessment for this student across terms.</span>
              </div>
            </div>

            <div className="reports-results-table-wrap">
              <table className="reports-results-table">
                <thead>
                  <tr>
                    <th>Assessment</th>
                    <th>Percentage</th>
                    <th>Status</th>
                    <th>Completed</th>
                  </tr>
                </thead>
                <tbody>
                  {studentAssessmentResults.length ? (
                    studentAssessmentResults.map((result) => (
                      <tr key={result.testId}>
                        <td>
                          <strong>{result.testName || 'Untitled assessment'}</strong>
                        </td>
                        <td>{formatBackendNumber(result.percentage, '%')}</td>
                        <td>{formatStatus(result.resultStatus)}</td>
                        <td>{formatLocalDate(result.completedAt, 'Not completed')}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="4" className="reports-results-empty">
                        No assessment results are available for this student.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="reports-report-meta">
              <div>
                <strong>Competency performance</strong>
                <span>Backend-computed mastery per assessed skill for this student.</span>
              </div>
            </div>

            <div className="reports-results-table-wrap">
              <table className="reports-results-table">
                <thead>
                  <tr>
                    <th>Skill</th>
                    <th>Mastery</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {studentCompetencyPerformance.length ? (
                    studentCompetencyPerformance.map((row) => (
                      <tr key={row.skillId}>
                        <td>{row.skillName || `Skill #${row.skillId}`}</td>
                        <td>{formatBackendNumber(row.masteryPercentage, '%')}</td>
                        <td>
                          <span className={`performance-pill ${getMasteryPillClass(row.masteryStatusCode)}`}>
                            {formatStatus(row.masteryStatusCode)}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="3" className="reports-results-empty">
                        No competency performance rows are available.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
        </>
        ) : null}
      </section>
    </div>
  )
}

export default ReportsPage

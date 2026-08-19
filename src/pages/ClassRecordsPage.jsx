import { useEffect, useMemo, useState } from 'react'
import {
  BookOpen,
  ClipboardCheck,
  ClipboardList,
  Download,
  FileCheck2,
  FileText,
  Plus,
  Target,
  Users,
} from 'lucide-react'
import {
  downloadStudentScoresReport,
  getAssessmentDetails,
  getLms,
  getPartSkillMappings,
  getStudentSkillMastery,
  getTeacherAssessments,
  getTeacherInterventions,
  getTestPartResults,
  getSyncActivity,
  createManualStudent,
  getManualStudents,
} from '../api/apiClient'
import {
  createClassAssignmentV2,
  getAvailableClassesV2,
  getClassAssignmentsV2,
  getSchoolSetupReferenceDataV2,
  getTeacherAccountsV2,
} from '../api/apiV2Client'
import { HorizontalMasteryChart } from '../components/AnalyticsCharts'

const initialAssignmentForm = {
  teacherId: '',
  subjectId: '',
  gradeLevelId: '',
  classId: '',
}

const SF1_PENDING_MESSAGE = 'Smart Import (SF1): Pending V2 SF1 endpoint'

const initialManualForm = {
  sectionId: '',
  academicYearId: '',
}

const initialManualClassFilters = {
  teacherId: '',
  gradeLevelId: '',
  subjectId: '',
}

const INTERVENTION_MASTERY_THRESHOLD = 75

function createManualStudentRows(count = 8) {
  return Array.from({ length: count }, (_, index) => ({
    rowId: `manual-row-${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`,
    studentLrn: '',
    firstName: '',
    lastName: '',
    gender: '',
  }))
}

function formatStatus(status) {
  if (!status) {
    return 'Unknown'
  }

  return status
    .toString()
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
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

function isAcademicYearPlaceholder(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    === 'academic year'
}

function formatAcademicYearLabel(value, fallback = 'Academic Year', academicYearRecords = []) {
  const record = value && typeof value === 'object' ? value : null
  const academicYearId = pickValue(record, [
    'academicYearId',
    'id',
    'value',
    'yearId',
    'year_id',
    'academic_year_id',
  ]) ?? value
  const rawLabel = record
    ? record.academicYearName ??
      record.year_name ??
      record.yearName ??
      record.academicYear ??
      record.schoolYear ??
      record.schoolYearName ??
      record.academicYearLabel ??
      record.label ??
      record.displayName ??
      record.name ??
      ''
    : value
  const raw = String(rawLabel ?? '').trim()
  const referenceYear = academicYearRecords.find(
    (academicYear) =>
      academicYear.id !== null &&
      academicYear.id !== undefined &&
      String(academicYear.id) === String(academicYearId),
  )
  const referenceLabel = referenceYear?.name ? formatAcademicYearLabel(referenceYear.name, '', []) : ''

  const candidate = raw || referenceLabel

  if (!raw) {
    return candidate && !isAcademicYearPlaceholder(candidate) ? candidate : fallback
  }

  if (/^\d+$/.test(raw)) {
    if (raw.length <= 4) {
      return raw
    }

    return candidate && !isAcademicYearPlaceholder(candidate) ? candidate : fallback
  }

  if (isAcademicYearPlaceholder(raw)) {
    return candidate && !isAcademicYearPlaceholder(candidate) ? candidate : fallback
  }

  return raw
}

function pickValue(record, keys) {
  for (const key of keys) {
    const value = record?.[key]

    if (value !== undefined && value !== null && value !== '') {
      return value
    }
  }

  return null
}

function normalizeAcademicYearRecord(academicYear = {}) {
  const id = pickValue(academicYear, [
    'academicYearId',
    'id',
    'value',
    'yearId',
    'year_id',
    'academic_year_id',
  ])
  const rawName =
    pickValue(academicYear, [
      'schoolYear',
      'schoolYearName',
      'year_name',
      'yearName',
      'academicYearLabel',
      'label',
      'displayName',
      'academicYearName',
      'name',
    ]) ?? ''
  const name = String(rawName)
    .replace(new RegExp(`\\b${String(id)}\\b`, 'g'), '')
    .replace(/\s+/g, ' ')
    .trim()
  const status = String(academicYear.status ?? '').trim().toLowerCase()

  return {
    ...academicYear,
    id,
    name,
    isActive: Boolean(academicYear.isActive ?? academicYear.active ?? academicYear.is_active ?? status === 'active'),
  }
}

function normalizeGradeLevelOption(gradeLevel = {}) {
  const id = pickValue(gradeLevel, ['gradeLevelId', 'id', 'value'])

  return {
    ...gradeLevel,
    id,
    name:
      pickValue(gradeLevel, ['gradeLevelName', 'name', 'grade', 'label', 'displayName']) ??
      (id ? `Grade Level ${id}` : 'Grade Level'),
  }
}

function normalizeSubjectOption(subject = {}) {
  const id = pickValue(subject, ['subjectId', 'id', 'value'])

  return {
    ...subject,
    id,
    name:
      pickValue(subject, ['subjectName', 'name', 'subject', 'label', 'displayName']) ??
      (id ? `Subject ${id}` : 'Subject'),
  }
}

function normalizeAvailableClassOption(classRecord = {}) {
  const classId = pickValue(classRecord, ['classId', 'id', 'value'])
  const sectionId =
    classRecord.sectionId ??
    classRecord.section?.sectionId ??
    classRecord.section?.id ??
    null
  const sectionName =
    classRecord.sectionName ??
    classRecord.section?.sectionName ??
    classRecord.section?.name ??
    classRecord.name ??
    classRecord.label ??
    'Section'

  return {
    ...classRecord,
    id: classId,
    classId,
    sectionId,
    name: sectionName,
    sectionName,
    gradeLevelId:
      classRecord.gradeLevelId ??
      classRecord.gradeLevel?.gradeLevelId ??
      classRecord.gradeLevel?.id ??
      null,
    gradeLevelName:
      classRecord.gradeLevelName ??
      classRecord.gradeLevel?.gradeLevelName ??
      classRecord.gradeLevel?.name ??
      '',
    subjectId:
      classRecord.subjectId ??
      classRecord.subject?.subjectId ??
      classRecord.subject?.id ??
      null,
  }
}

function sectionMatchesGrade(section, gradeLevel) {
  if (!section || !gradeLevel) {
    return false
  }

  if (
    section.gradeLevelId !== null &&
    section.gradeLevelId !== undefined &&
    gradeLevel.id !== null &&
    gradeLevel.id !== undefined
  ) {
    return String(section.gradeLevelId) === String(gradeLevel.id)
  }

  return valuesMatch(section.gradeLevelName, gradeLevel.name)
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

function getClassDisplayLabel(assignment) {
  if (!assignment) {
    return 'Class not assigned'
  }

  return `${assignment.gradeLevelName || 'Grade level'} - ${assignment.sectionName || 'Section'}`
}

function getUniqueClassOptions(assignments, valueKey, labelKey) {
  const optionMap = new Map()

  assignments.forEach((assignment) => {
    const value = assignment[valueKey]
    const label = assignment[labelKey]

    if (value === null || value === undefined || value === '' || !label) {
      return
    }

    const key = String(value)

    if (!optionMap.has(key)) {
      optionMap.set(key, { value: key, label })
    }
  })

  return Array.from(optionMap.values()).sort((left, right) =>
    left.label.localeCompare(right.label),
  )
}

function getStudentInitials(student) {
  const nameParts = String(student?.name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (!nameParts.length) {
    return 'ST'
  }

  return nameParts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
}

function getStudentGenderAvatarClass(student) {
  const gender = normalizeMatchText(student?.gender)

  if (gender.startsWith('female') || gender === 'f') {
    return 'is-female'
  }

  if (gender.startsWith('male') || gender === 'm') {
    return 'is-male'
  }

  return 'is-unknown'
}

function formatDate(dateValue) {
  if (!dateValue) {
    return 'Date not set'
  }

  const parsedDate = new Date(dateValue)

  if (Number.isNaN(parsedDate.getTime())) {
    return dateValue
  }

  return parsedDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function getAssessmentStatusClass(status) {
  const normalizedStatus = String(status ?? '').toLowerCase()

  if (normalizedStatus.includes('active') || normalizedStatus.includes('complete')) {
    return 'status-active'
  }

  if (normalizedStatus.includes('draft')) {
    return 'status-warning'
  }

  return 'status-pending'
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

function parseNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const parsedValue = Number(value)

  return Number.isFinite(parsedValue) ? parsedValue : null
}

function formatPercent(value) {
  const parsedValue = parseNumber(value)

  if (parsedValue === null) {
    return 'No data'
  }

  return `${Math.round(parsedValue)}%`
}

function formatScore(value) {
  const parsedValue = parseNumber(value)

  if (parsedValue === null) {
    return '0'
  }

  return String(Math.round(parsedValue))
}

function formatScoreWithMax(score, maxScore) {
  const parsedScore = parseNumber(score)

  if (parsedScore === null) {
    return 'No data'
  }

  const formattedScore = formatScore(parsedScore)
  const parsedMaxScore = parseNumber(maxScore)

  if (parsedMaxScore === null) {
    return formattedScore
  }

  return `${formattedScore} / ${formatScore(parsedMaxScore)}`
}

function formatStudentDisplayName(student) {
  const firstName = String(student?.firstName ?? '').trim()
  const middleName = String(student?.middleName ?? '').trim()
  const lastName = String(student?.lastName ?? '').trim()

  if (lastName && firstName) {
    return `${lastName.toUpperCase()}, ${[firstName, middleName].filter(Boolean).join(' ').toUpperCase()}`
  }

  return String(student?.studentName ?? student?.name ?? 'Student').toUpperCase()
}

function getPerformanceLabel(percentage) {
  const parsedValue = parseNumber(percentage)

  if (parsedValue === null) {
    return 'No data'
  }

  if (parsedValue >= 90) {
    return 'Highly Proficient'
  }

  if (parsedValue >= 80) {
    return 'Proficient'
  }

  if (parsedValue >= 70) {
    return 'Developing'
  }

  return 'Needs Improvement'
}

function getPerformanceClass(percentage) {
  const label = getPerformanceLabel(percentage)

  return `is-${label.toLowerCase().replace(/\s+/g, '-')}`
}

function getPartMaxScore(part) {
  const numberOfItems = parseNumber(part?.numberOfItems)
  const pointsPerItem = parseNumber(part?.pointsPerItem)

  if (numberOfItems === null || pointsPerItem === null) {
    return null
  }

  return numberOfItems * pointsPerItem
}

function getStudentScoreKey(student) {
  return String(student?.id ?? student?.studentId ?? student?.studentLrn ?? student?.studentName ?? '')
}

function mergeTestPartResults(partResultGroups = []) {
  const studentMap = new Map()

  partResultGroups.flat().forEach((student) => {
    const key = getStudentScoreKey(student)

    if (!key) {
      return
    }

    const currentRecord =
      studentMap.get(key) ?? {
        ...student,
        score: 0,
        maxScore: 0,
        percentage: '',
      }
    const nextScore = parseNumber(student.score) ?? 0
    const nextMaxScore = parseNumber(student.maxScore) ?? 0
    const totalScore = (parseNumber(currentRecord.score) ?? 0) + nextScore
    const totalMaxScore = (parseNumber(currentRecord.maxScore) ?? 0) + nextMaxScore

    studentMap.set(key, {
      ...currentRecord,
      ...student,
      score: totalScore,
      maxScore: totalMaxScore,
      percentage: totalMaxScore > 0 ? (totalScore / totalMaxScore) * 100 : '',
    })
  })

  return Array.from(studentMap.values())
}

function getPartBranchSkills(part) {
  return Array.isArray(part?.skillMappings) ? part.skillMappings : []
}

function getPrimaryPartSkill(part) {
  return getPartBranchSkills(part)[0] ?? null
}

function getUniqueTeacherInterventions(records = []) {
  const interventionMap = new Map()

  records.forEach((record) => {
    const title = String(record.title ?? '').trim()
    const description = String(record.description ?? '').trim()
    const followUp = String(record.followUp ?? '').trim()

    if (!description && (!title || title === 'Intervention')) {
      return
    }

    const key = `${title}|${description}|${followUp}`

    if (!interventionMap.has(key)) {
      interventionMap.set(key, {
        title: title || 'Teacher Intervention',
        description,
        targetGroup: record.targetGroup || '',
        followUp,
      })
    }
  })

  return Array.from(interventionMap.values())
}

function getTeacherRecommendationForSkill(records = [], competencyId, competencyName) {
  if (!records.length) {
    return null
  }

  const normalizedCompetencyId =
    competencyId !== null && competencyId !== undefined ? String(competencyId) : ''
  const normalizedCompetencyName = normalizeMatchText(competencyName)

  return (
    records.find(
      (record) =>
        normalizedCompetencyId &&
        record.competencyId !== null &&
        String(record.competencyId) === normalizedCompetencyId,
    ) ??
    records.find(
      (record) =>
        normalizedCompetencyName &&
        normalizeMatchText(record.competencyName) === normalizedCompetencyName,
    ) ??
    null
  )
}

function hasTeacherRecommendationContent(record) {
  return Boolean(
    record?.recommendation ||
      record?.recommendedAction ||
      record?.targetGroup ||
      record?.followUpActivity,
  )
}

function getTeacherRecommendationAffectedCount(record) {
  if (!record) {
    return null
  }

  const count = parseNumber(record.affectedLearnersCount)

  if (count !== null) {
    return count
  }

  return Array.isArray(record.affectedStudents) ? record.affectedStudents.length : null
}

function isAffectedLearner(record) {
  const percentage = parseNumber(record?.percentage)

  if (percentage !== null) {
    return percentage < INTERVENTION_MASTERY_THRESHOLD
  }

  const status = normalizeMatchText(
    record?.lmsStatus ?? record?.status ?? record?.masteryLevel ?? record?.performanceStatus ?? '',
  )

  return (
    status.includes('low') ||
    status.includes('not mastered') ||
    status.includes('intervention') ||
    status.includes('remediation')
  )
}

function getFallbackTeacherIntervention(masteryPercent, affectedLearnerCount) {
  if (
    masteryPercent === null ||
    masteryPercent >= INTERVENTION_MASTERY_THRESHOLD ||
    affectedLearnerCount <= 0
  ) {
    return []
  }

  return [
    {
      title: 'Focused Remediation Session',
      description:
        'Based on the synced results, the selected competency shows low mastery. Conduct a focused remediation session for the affected learners. Review the missed skill, provide guided examples, allow short practice activities, and give a quick reassessment to check improvement.',
      targetGroup: 'Affected learners below mastery',
      followUp: 'Give a short follow-up activity or quick reassessment after remediation.',
    },
  ]
}

function getLmsStatusLabel(masteryPercent) {
  if (masteryPercent === null) {
    return 'Waiting for synced LMS'
  }

  return masteryPercent < INTERVENTION_MASTERY_THRESHOLD
    ? 'Low mastery'
    : 'Mastery acceptable'
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

function ClassRecordsPage({
  role,
  user,
  token,
  onNavigate,
  initialClassId = null,
  initialTeacherTab = 'assessment',
}) {
  const teacherId = user?.id
  const [classAssignments, setClassAssignments] = useState([])
  const [students, setStudents] = useState([])
  const [schoolTeachers, setSchoolTeachers] = useState([])
  const [subjects, setSubjects] = useState([])
  const [schoolGradeLevels, setSchoolGradeLevels] = useState([])
  const [academicYears, setAcademicYears] = useState([])
  const [selectedAcademicYearId, setSelectedAcademicYearId] = useState('')
  const [sections, setSections] = useState([])
  const [assignmentSections, setAssignmentSections] = useState([])
  const [assessments, setAssessments] = useState([])
  const [selectedClassAssignment, setSelectedClassAssignment] = useState(null)
  const [assignmentForm, setAssignmentForm] = useState(initialAssignmentForm)
  const [manualForm, setManualForm] = useState(initialManualForm)
  const [manualClassFilters, setManualClassFilters] = useState(initialManualClassFilters)
  const [manualRows, setManualRows] = useState(() => createManualStudentRows())
  const [activeTeacherTab, setActiveTeacherTab] = useState(
    initialTeacherTab === 'students' || initialTeacherTab === 'analytics'
      ? initialTeacherTab
      : 'assessment',
  )
  const [selectedAnalyticsTestId, setSelectedAnalyticsTestId] = useState('')
  const [selectedAnalyticsPartId, setSelectedAnalyticsPartId] = useState('')
  const [selectedStudentClassFilter, setSelectedStudentClassFilter] = useState('')
  const [studentNameSearch, setStudentNameSearch] = useState('')
  const [selectedStudentInfo, setSelectedStudentInfo] = useState(null)
  const [analyticsDetails, setAnalyticsDetails] = useState(null)
  const [analyticsLms, setAnalyticsLms] = useState([])
  const [analyticsStudents, setAnalyticsStudents] = useState([])
  const [teacherInterventionRecommendations, setTeacherInterventionRecommendations] = useState([])
  const [studentSkillMasteryRows, setStudentSkillMasteryRows] = useState([])
  const [activePrincipalTool, setActivePrincipalTool] = useState(null)
  const [studentsError, setStudentsError] = useState('')
  const [assessmentsError, setAssessmentsError] = useState('')
  const [studentsSuccess, setStudentsSuccess] = useState('')
  const [assignmentMessage, setAssignmentMessage] = useState({ error: '', success: '' })
  const [manualMessage, setManualMessage] = useState({ error: '', success: '' })
  const [isStudentsLoading, setIsStudentsLoading] = useState(true)
  const [isAssessmentsLoading, setIsAssessmentsLoading] = useState(true)
  const [, setIsSectionsLoading] = useState(true)
  const [isAssignmentSubmitting, setIsAssignmentSubmitting] = useState(false)
  const [isManualSubmitting, setIsManualSubmitting] = useState(false)
  const [isAnalyticsLoading, setIsAnalyticsLoading] = useState(false)
  const [isAnalyticsExportLoading, setIsAnalyticsExportLoading] = useState(false)
  const [isStudentSkillMasteryLoading, setIsStudentSkillMasteryLoading] = useState(false)
  const [analyticsMessage, setAnalyticsMessage] = useState({ error: '', success: '' })
  const [studentSkillMasteryMessage, setStudentSkillMasteryMessage] = useState('')

  const sectionOptions = useMemo(
    () => sections.filter((section) => section.id !== null && section.id !== undefined),
    [sections],
  )
  const assignmentGradeOptions = useMemo(() => {
    if (schoolGradeLevels.length) {
      return schoolGradeLevels.filter((gradeLevel) => gradeLevel.id !== null && gradeLevel.id !== undefined)
    }

    const optionMap = new Map()

    sectionOptions.forEach((section) => {
      const key = section.gradeLevelId ?? section.gradeLevelName

      if (!key) {
        return
      }

      const stringKey = String(key)

      if (!optionMap.has(stringKey)) {
        optionMap.set(stringKey, {
          id: key,
          name: section.gradeLevelName || `Grade Level ${key}`,
        })
      }
    })

    return Array.from(optionMap.values())
  }, [schoolGradeLevels, sectionOptions])
  const selectedAssignmentGradeLevel = useMemo(
    () =>
      assignmentGradeOptions.find(
        (gradeLevel) => String(gradeLevel.id) === String(assignmentForm.gradeLevelId),
      ) ?? null,
    [assignmentForm.gradeLevelId, assignmentGradeOptions],
  )
  const selectedAcademicYear = useMemo(
    () =>
      academicYears.find(
        (academicYear) => String(academicYear.id) === String(selectedAcademicYearId),
      ) ?? null,
    [academicYears, selectedAcademicYearId],
  )
  const formatAcademicYear = (value, fallback = 'Academic Year') =>
    formatAcademicYearLabel(value, fallback, academicYears)
  const selectedAcademicYearLabel =
    formatAcademicYear(
      selectedAcademicYear,
      'No academic year selected',
    )
  const assignmentSectionOptions = useMemo(() => {
    const sourceSections = assignmentForm.gradeLevelId ? assignmentSections : []

    if (!selectedAssignmentGradeLevel) {
      return []
    }

    return sourceSections.filter((section) => {
      const hasGradeMetadata =
        (section.gradeLevelId !== null && section.gradeLevelId !== undefined) ||
        Boolean(section.gradeLevelName)

      return hasGradeMetadata ? sectionMatchesGrade(section, selectedAssignmentGradeLevel) : true
    })
  }, [assignmentForm.gradeLevelId, assignmentSections, selectedAssignmentGradeLevel])
  const manualTeacherOptions = useMemo(
    () => getUniqueClassOptions(classAssignments, 'teacherId', 'teacherName'),
    [classAssignments],
  )
  const manualGradeOptions = useMemo(() => {
    const filteredAssignments = manualClassFilters.teacherId
      ? classAssignments.filter(
          (assignment) => String(assignment.teacherId) === String(manualClassFilters.teacherId),
        )
      : classAssignments

    return getUniqueClassOptions(filteredAssignments, 'gradeLevelId', 'gradeLevelName')
  }, [classAssignments, manualClassFilters.teacherId])
  const manualSubjectOptions = useMemo(() => {
    const filteredAssignments = classAssignments.filter((assignment) => {
      if (
        manualClassFilters.teacherId &&
        String(assignment.teacherId) !== String(manualClassFilters.teacherId)
      ) {
        return false
      }

      if (
        manualClassFilters.gradeLevelId &&
        String(assignment.gradeLevelId) !== String(manualClassFilters.gradeLevelId)
      ) {
        return false
      }

      return true
    })

    return getUniqueClassOptions(filteredAssignments, 'subjectId', 'subjectName')
  }, [classAssignments, manualClassFilters.gradeLevelId, manualClassFilters.teacherId])
  const manualSectionOptions = useMemo(() => {
    const optionMap = new Map()

    classAssignments.forEach((assignment) => {
      if (
        manualClassFilters.teacherId &&
        String(assignment.teacherId) !== String(manualClassFilters.teacherId)
      ) {
        return
      }

      if (
        manualClassFilters.gradeLevelId &&
        String(assignment.gradeLevelId) !== String(manualClassFilters.gradeLevelId)
      ) {
        return
      }

      if (
        manualClassFilters.subjectId &&
        String(assignment.subjectId) !== String(manualClassFilters.subjectId)
      ) {
        return
      }

      if (!assignment.sectionId) {
        return
      }

      const key = String(assignment.sectionId)

      if (!optionMap.has(key)) {
        optionMap.set(key, {
          value: key,
          label: assignment.sectionName || 'Section',
          assignment,
        })
      }
    })

    return Array.from(optionMap.values()).sort((left, right) =>
      left.label.localeCompare(right.label),
    )
  }, [
    classAssignments,
    manualClassFilters.gradeLevelId,
    manualClassFilters.subjectId,
    manualClassFilters.teacherId,
  ])
  const selectedManualClassOption =
    manualSectionOptions.find((option) => String(option.value) === String(manualForm.sectionId)) ??
    null
  const effectiveManualSectionOptions = manualSectionOptions.length
    ? manualSectionOptions
    : sectionOptions.map((section) => ({
        value: String(section.id),
        label: section.name,
        assignment: null,
      }))
  const startedManualRows = useMemo(
    () =>
      manualRows.filter((row) =>
        [row.studentLrn, row.firstName, row.lastName, row.gender].some((value) =>
          String(value ?? '').trim(),
        ),
      ),
    [manualRows],
  )
  const selectedClassStudents = useMemo(
    () => students.filter((student) => studentBelongsToClass(student, selectedClassAssignment)),
    [students, selectedClassAssignment],
  )
  const teacherClassOptions = useMemo(() => {
    const optionMap = new Map()

    classAssignments.forEach((assignment) => {
      const key = getClassSectionKey(assignment)

      if (!optionMap.has(key)) {
        optionMap.set(key, {
          key,
          label: getClassDisplayLabel(assignment),
          assignment,
        })
      }
    })

    return Array.from(optionMap.values())
  }, [classAssignments])
  const selectedClassFilterKey = selectedClassAssignment
    ? getClassSectionKey(selectedClassAssignment)
    : (teacherClassOptions[0]?.key ?? '')
  const effectiveStudentClassFilter = selectedStudentClassFilter || selectedClassFilterKey
  const selectedStudentClassAssignment =
    teacherClassOptions.find((option) => option.key === effectiveStudentClassFilter)?.assignment ??
    null
  const teacherAssignedStudents = useMemo(() => {
    if (!classAssignments.length) {
      return students
    }

    return students.filter((student) =>
      classAssignments.some((assignment) => studentBelongsToClass(student, assignment)),
    )
  }, [classAssignments, students])
  const filteredTeacherStudents = useMemo(() => {
    const classFilteredStudents = teacherAssignedStudents.filter(
      (student) =>
        selectedStudentClassAssignment &&
        studentBelongsToClass(student, selectedStudentClassAssignment),
    )

    const searchText = normalizeMatchText(studentNameSearch)

    if (!searchText) {
      return classFilteredStudents
    }

    return classFilteredStudents.filter((student) =>
      normalizeMatchText(student.name).includes(searchText),
    )
  }, [selectedStudentClassAssignment, studentNameSearch, teacherAssignedStudents])
  const selectedClassGroupAssignments = useMemo(() => {
    if (!selectedClassAssignment) {
      return []
    }

    const selectedGroupKey = getClassSectionKey(selectedClassAssignment)

    return classAssignments.filter(
      (assignment) => getClassSectionKey(assignment) === selectedGroupKey,
    )
  }, [classAssignments, selectedClassAssignment])
  const selectedClassAssessments = useMemo(
    () =>
      assessments.filter(
        (assessment) => Number(assessment.classId) === Number(selectedClassAssignment?.classId),
      ),
    [assessments, selectedClassAssignment?.classId],
  )
  const selectedStudentProgressAssignment = useMemo(() => {
    if (!selectedStudentInfo) {
      return null
    }

    if (
      selectedStudentClassAssignment &&
      studentBelongsToClass(selectedStudentInfo, selectedStudentClassAssignment)
    ) {
      return selectedStudentClassAssignment
    }

    return classAssignments.find((assignment) =>
      studentBelongsToClass(selectedStudentInfo, assignment),
    ) ?? null
  }, [classAssignments, selectedStudentClassAssignment, selectedStudentInfo])
  const selectedAnalyticsAssessment =
    selectedClassAssessments.find(
      (assessment) => String(assessment.id) === String(selectedAnalyticsTestId),
    ) ?? null
  const analyticsParts = useMemo(() => analyticsDetails?.parts ?? [], [analyticsDetails?.parts])
  const analyticsPartIds = useMemo(
    () => analyticsParts.map((part) => String(part.id ?? '')).join('|'),
    [analyticsParts],
  )
  const assessmentTotalItems = analyticsParts.reduce(
    (total, part) => total + (parseNumber(part.numberOfItems) ?? 0),
    0,
  )
  const assessmentMaxScore = analyticsParts.reduce(
    (total, part) => total + (getPartMaxScore(part) ?? 0),
    0,
  )
  const selectedAnalyticsPart =
    analyticsParts.find((part) => String(part.id) === String(selectedAnalyticsPartId)) ??
    analyticsParts[0] ??
    null
  const selectedPartPrimarySkill = getPrimaryPartSkill(selectedAnalyticsPart)
  const selectedAnalyticsSkillId =
    selectedPartPrimarySkill?.competencyId ?? selectedAnalyticsPart?.competencyId ?? null
  const selectedAnalyticsSkillName =
    selectedPartPrimarySkill?.competencyName ?? selectedAnalyticsPart?.competencyName ?? ''
  const selectedPartLms =
    analyticsLms.find(
      (item) => String(item.competencyId) === String(selectedAnalyticsSkillId),
    ) ?? null
  const analyticsChartRows = useMemo(
    () =>
      analyticsLms
        .map((item) => ({
          id: item.competencyId ?? item.competencyName,
          label: item.competencyName || 'Competency',
          value: parseNumber(item.averageScore),
          level: item.masteryLevel || '',
        }))
        .filter((item) => item.value !== null)
        .slice(0, 5),
    [analyticsLms],
  )
  const hasAnalyticsChartRows = analyticsChartRows.length > 0
  const selectedPartMastery = parseNumber(selectedPartLms?.averageScore)
  const analyticsStudentRows = useMemo(
    () =>
      analyticsStudents.map((student, index) => ({
        ...student,
        rowNumber: String(index + 1).padStart(2, '0'),
        displayName: formatStudentDisplayName(student),
        displayScore: parseNumber(student.score),
        performance: getPerformanceLabel(student.percentage),
        performanceClass: getPerformanceClass(student.percentage),
      })),
    [analyticsStudents],
  )
  const analyticsPercentages = analyticsStudentRows
    .map((student) => parseNumber(student.percentage))
    .filter((value) => value !== null)
  const classAverage =
    analyticsPercentages.length > 0
      ? analyticsPercentages.reduce((total, value) => total + value, 0) / analyticsPercentages.length
      : null
  const rankedAnalyticsRows = [...analyticsStudentRows].sort(
    (left, right) => (parseNumber(right.displayScore) ?? -1) - (parseNumber(left.displayScore) ?? -1),
  )
  const highestAnalyticsStudent = rankedAnalyticsRows[0] ?? null
  const lowestAnalyticsStudent = rankedAnalyticsRows[rankedAnalyticsRows.length - 1] ?? null
  const selectedInterventionCompetencyId =
    selectedAnalyticsSkillId ?? selectedPartLms?.competencyId ?? null
  const selectedInterventionCompetencyName =
    selectedAnalyticsSkillName || selectedPartLms?.competencyName || ''
  const selectedTeacherRecommendation = getTeacherRecommendationForSkill(
    teacherInterventionRecommendations,
    selectedInterventionCompetencyId,
    selectedInterventionCompetencyName,
  )
  const legacyTeacherInterventions = useMemo(
    () => getUniqueTeacherInterventions(analyticsStudents),
    [analyticsStudents],
  )
  const affectedLearnerRecords = useMemo(
    () => analyticsStudents.filter((student) => isAffectedLearner(student)),
    [analyticsStudents],
  )
  const selectedRecommendationMastery = parseNumber(selectedTeacherRecommendation?.masteryRate)
  const selectedInterventionMastery =
    selectedRecommendationMastery !== null ? selectedRecommendationMastery : selectedPartMastery
  const hasPerLearnerMasteryData = analyticsStudents.some(
    (student) =>
      parseNumber(student?.percentage) !== null ||
      Boolean(student?.lmsStatus || student?.status || student?.masteryLevel),
  )
  const recommendationAffectedCount =
    getTeacherRecommendationAffectedCount(selectedTeacherRecommendation)
  const isLowMastery =
    selectedInterventionMastery !== null &&
    selectedInterventionMastery < INTERVENTION_MASTERY_THRESHOLD
  const affectedLearnerCount =
    recommendationAffectedCount !== null
      ? recommendationAffectedCount
      : hasPerLearnerMasteryData
        ? affectedLearnerRecords.length
        : legacyTeacherInterventions.length || isLowMastery
          ? analyticsStudents.length
          : 0
  const hasSelectedTeacherRecommendation =
    selectedTeacherRecommendation && hasTeacherRecommendationContent(selectedTeacherRecommendation)
  const isInterventionRecommended =
    Boolean(hasSelectedTeacherRecommendation) ||
    legacyTeacherInterventions.length > 0 ||
    (isLowMastery && affectedLearnerCount > 0)
  const selectedInterventionStatusLabel = selectedTeacherRecommendation?.status
    ? formatStatus(selectedTeacherRecommendation.status)
    : getLmsStatusLabel(selectedInterventionMastery)
  const teacherInterventions = hasSelectedTeacherRecommendation
    ? [
        {
          title:
            selectedTeacherRecommendation.recommendedAction ||
            'Recommended Teaching Action',
          description:
            selectedTeacherRecommendation.recommendation ||
            'Use this recommendation as the teacher action plan during the next remediation session.',
          targetGroup: selectedTeacherRecommendation.targetGroup || '',
          followUp: selectedTeacherRecommendation.followUpActivity || '',
          affectedStudents: selectedTeacherRecommendation.affectedStudents ?? [],
        },
      ]
    : legacyTeacherInterventions.length
      ? legacyTeacherInterventions
      : getFallbackTeacherIntervention(selectedInterventionMastery, affectedLearnerCount)
  const studentAssessedSkillRows = useMemo(
    () =>
      studentSkillMasteryRows
        .map((skill) => ({
          id: skill.competencyId ?? skill.id ?? skill.competencyName,
          label: skill.competencyName || 'Competency',
          value: parseNumber(skill.masteryRate),
          status: skill.status || '',
          earnedPoints: skill.earnedPoints,
          totalPoints: skill.totalPoints,
          assessmentsCount: skill.assessmentsCount,
        }))
        .filter((skill) => skill.value !== null)
        .sort((left, right) => left.label.localeCompare(right.label)),
    [studentSkillMasteryRows],
  )
  const selectedClassLabel = selectedClassAssignment
    ? getClassDisplayLabel(selectedClassAssignment)
    : 'Select a class'
  const selectedStudentClassLabel =
    getClassDisplayLabel(selectedStudentClassAssignment)
  const teacherHeaderLabel =
    activeTeacherTab === 'students' ? selectedStudentClassLabel : selectedClassLabel
  const teacherHeaderStudentCount =
    activeTeacherTab === 'students' ? filteredTeacherStudents.length : selectedClassStudents.length

  const loadStudents = async ({ preserveMessage = false } = {}) => {
    setIsStudentsLoading(true)
    setStudentsError('')

    if (!preserveMessage) {
      setStudentsSuccess('')
    }

    try {
      const studentRecords = await getManualStudents()
      setStudents(studentRecords)
    } catch (loadError) {
      setStudentsError(loadError.message || 'Unable to load student records.')
    } finally {
      setIsStudentsLoading(false)
    }
  }

  const loadSections = async () => {
    setIsSectionsLoading(true)

    try {
      const [teacherRecords, referenceData] = await Promise.all([
        getTeacherAccountsV2(token, 'active'),
        getSchoolSetupReferenceDataV2(token),
      ])

      const academicYearRecords = (referenceData.academicYears ?? referenceData.years ?? [])
        .map(normalizeAcademicYearRecord)
        .filter((academicYear) => academicYear.id !== null && academicYear.id !== undefined)
      const gradeLevelRecords = (referenceData.gradeLevels ?? [])
        .map(normalizeGradeLevelOption)
        .filter((gradeLevel) => gradeLevel.id !== null && gradeLevel.id !== undefined)
      const subjectRecords = (referenceData.subjects ?? [])
        .map(normalizeSubjectOption)
        .filter((subject) => subject.id !== null && subject.id !== undefined)
      const defaultAcademicYear =
        academicYearRecords.find((academicYear) => academicYear.isActive) ??
        academicYearRecords[0] ??
        null

      setSchoolTeachers(teacherRecords)
      setSubjects(subjectRecords)
      setSchoolGradeLevels(gradeLevelRecords)
      setAcademicYears(academicYearRecords)
      setSelectedAcademicYearId((currentAcademicYearId) =>
        academicYearRecords.some(
          (academicYear) => String(academicYear.id) === String(currentAcademicYearId),
        )
          ? currentAcademicYearId
          : defaultAcademicYear?.id
            ? String(defaultAcademicYear.id)
            : '',
      )
    } catch (loadError) {
      setSections([])
      setSchoolTeachers([])
      setSubjects([])
      setSchoolGradeLevels([])
      setAcademicYears([])
      setSelectedAcademicYearId('')
      setAssignmentMessage({
        error: loadError.message || 'Unable to load V2 school setup reference data.',
        success: '',
      })
    } finally {
      setIsSectionsLoading(false)
    }
  }

  const loadTeacherClasses = async () => {
    if (!selectedAcademicYearId) {
      setClassAssignments([])
      setSelectedClassAssignment(null)
      return
    }

    try {
      const assignments = await getClassAssignmentsV2(token, selectedAcademicYearId)
      const nextTeacherAssignments =
        role === 'teacher'
          ? assignments.filter((assignment) => Number(assignment.teacherId) === Number(teacherId))
          : assignments
      setClassAssignments(nextTeacherAssignments)
      setSections(
        nextTeacherAssignments
          .filter((assignment) => assignment.sectionId)
          .map((assignment) => ({
            id: assignment.sectionId,
            name: assignment.sectionName,
            gradeLevelId: assignment.gradeLevelId,
            gradeLevelName: assignment.gradeLevelName,
          })),
      )
      setSelectedClassAssignment((currentAssignment) =>
        nextTeacherAssignments.find(
          (assignment) =>
            Number(assignment.classId) === Number(currentAssignment?.classId),
        ) ??
        nextTeacherAssignments.find(
          (assignment) => Number(assignment.classId) === Number(initialClassId),
        ) ??
        nextTeacherAssignments[0] ??
        null,
      )
    } catch (loadError) {
      setClassAssignments([])
      setSelectedClassAssignment(null)
      setAssignmentMessage({
        error: loadError.message || 'Unable to load V2 class assignments.',
        success: '',
      })
    }
  }

  const loadTeacherAssessments = async () => {
    if (!teacherId) {
      setAssessments([])
      setIsAssessmentsLoading(false)
      return
    }

    setIsAssessmentsLoading(true)
    setAssessmentsError('')

    try {
      const [assessmentRecords, syncActivity] = await Promise.all([
        getTeacherAssessments(teacherId),
        getSyncActivity(teacherId).catch(() => []),
      ])
      setAssessments(
        assessmentRecords.map((assessment) => ({
          ...assessment,
          testStatus: getAutomaticAssessmentStatus(assessment, syncActivity),
        })),
      )
    } catch (loadError) {
      setAssessments([])
      setAssessmentsError(loadError.message || 'Unable to load assessments.')
    } finally {
      setIsAssessmentsLoading(false)
    }
  }

  const loadTeacherClassAnalytics = async (testId) => {
    if (!testId) {
      setAnalyticsDetails(null)
      setAnalyticsLms([])
      setAnalyticsStudents([])
      setTeacherInterventionRecommendations([])
      setSelectedAnalyticsPartId('')
      return
    }

    setIsAnalyticsLoading(true)
    setAnalyticsMessage({ error: '', success: '' })
    setAnalyticsDetails(null)
    setAnalyticsStudents([])

    try {
      const [details, lmsRecords, teacherRecommendations] = await Promise.all([
        getAssessmentDetails(testId),
        getLms(testId),
        getTeacherInterventions(testId).catch(() => []),
      ])
      const partsWithSkillMappings = await Promise.all(
        (details.parts ?? []).map(async (part) => ({
          ...part,
          skillMappings: part.id ? await getPartSkillMappings(part.id).catch(() => []) : [],
        })),
      )
      const firstPartId = partsWithSkillMappings[0]?.id ?? ''

      setAnalyticsDetails({ ...details, parts: partsWithSkillMappings })
      setAnalyticsLms(lmsRecords)
      setTeacherInterventionRecommendations(teacherRecommendations)
      setSelectedAnalyticsPartId((currentPartId) =>
        details.parts?.some((part) => String(part.id) === String(currentPartId))
          ? currentPartId
          : String(firstPartId),
      )
    } catch (loadError) {
      setAnalyticsDetails(null)
      setAnalyticsLms([])
      setAnalyticsStudents([])
      setTeacherInterventionRecommendations([])
      setSelectedAnalyticsPartId('')
      setAnalyticsMessage({
        error: loadError.message || 'Unable to load analytics for the selected assessment.',
        success: '',
      })
    } finally {
      setIsAnalyticsLoading(false)
    }
  }

  const loadAnalyticsStudents = async (testId, parts = []) => {
    const partsWithIds = parts.filter((part) => part?.id)

    if (!testId || !partsWithIds.length) {
      setAnalyticsStudents([])
      return
    }

    setIsAnalyticsLoading(true)
    setAnalyticsMessage({ error: '', success: '' })

    try {
      const partResultGroups = await Promise.all(
        partsWithIds.map((part) => getTestPartResults(testId, part.id)),
      )
      setAnalyticsStudents(mergeTestPartResults(partResultGroups))
    } catch (loadError) {
      setAnalyticsStudents([])
      setAnalyticsMessage({
        error: loadError.message || 'Unable to load student scores for this assessment.',
        success: '',
      })
    } finally {
      setIsAnalyticsLoading(false)
    }
  }

  const loadStudentSkillMastery = async (studentRecord, classAssignment) => {
    const studentId = studentRecord?.id
    const classId = classAssignment?.classId

    if (!studentId || !classId) {
      setStudentSkillMasteryRows([])
      setStudentSkillMasteryMessage('Student class context is incomplete.')
      return
    }

    setIsStudentSkillMasteryLoading(true)
    setStudentSkillMasteryMessage('')

    try {
      const skillRows = await getStudentSkillMastery(studentId, classId)
      setStudentSkillMasteryRows(skillRows)
    } catch (loadError) {
      setStudentSkillMasteryRows([])
      setStudentSkillMasteryMessage(
        loadError.message || 'Unable to load student skill mastery from analytics.',
      )
    } finally {
      setIsStudentSkillMasteryLoading(false)
    }
  }

  const handleAnalyticsExport = async () => {
    setAnalyticsMessage({ error: '', success: '' })

    if (!selectedAnalyticsTestId) {
      setAnalyticsMessage({
        error: 'Select an assessment before exporting student scores.',
        success: '',
      })
      return
    }

    setIsAnalyticsExportLoading(true)

    try {
      const filename = await downloadStudentScoresReport(selectedAnalyticsTestId)
      setAnalyticsMessage({
        error: '',
        success: `${filename} downloaded successfully.`,
      })
    } catch (downloadError) {
      setAnalyticsMessage({
        error: downloadError.message || 'Unable to export the selected assessment student scores.',
        success: '',
      })
    } finally {
      setIsAnalyticsExportLoading(false)
    }
  }

  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  useEffect(() => {
    loadStudents()
    loadSections()
    loadTeacherAssessments()
  }, [])

  useEffect(() => {
    if (selectedAcademicYearId) {
      loadTeacherClasses()
    }
  }, [selectedAcademicYearId])

  useEffect(() => {
    const { gradeLevelId, subjectId } = assignmentForm

    setAssignmentSections([])

    if (!selectedAcademicYearId || !gradeLevelId || !subjectId) {
      return
    }

    let shouldApplyResults = true

    getAvailableClassesV2(
      {
        academicYearId: selectedAcademicYearId,
        gradeLevelId,
        subjectId,
      },
      token,
    )
      .then((classRecords) => {
        if (shouldApplyResults) {
          setAssignmentSections(
            classRecords
              .map(normalizeAvailableClassOption)
              .filter((classRecord) => classRecord.classId !== null && classRecord.classId !== undefined),
          )
        }
      })
      .catch(() => {
        if (shouldApplyResults) {
          setAssignmentSections([])
        }
      })

    return () => {
      shouldApplyResults = false
    }
  }, [assignmentForm.gradeLevelId, assignmentForm.subjectId, selectedAcademicYearId, token])

  useEffect(() => {
    if (role !== 'teacher') {
      return
    }

    if (!selectedClassAssessments.length) {
      setSelectedAnalyticsTestId('')
      return
    }

    setSelectedAnalyticsTestId((currentTestId) =>
      selectedClassAssessments.some((assessment) => String(assessment.id) === String(currentTestId))
        ? currentTestId
        : String(selectedClassAssessments[0].id),
    )
  }, [role, selectedClassAssessments])

  useEffect(() => {
    if (role === 'teacher' && activeTeacherTab === 'analytics') {
      loadTeacherClassAnalytics(selectedAnalyticsTestId)
    }
  }, [role, activeTeacherTab, selectedAnalyticsTestId])

  useEffect(() => {
    if (role === 'teacher' && activeTeacherTab === 'analytics') {
      loadAnalyticsStudents(selectedAnalyticsTestId, analyticsParts)
    }
  }, [
    role,
    activeTeacherTab,
    selectedAnalyticsTestId,
    analyticsPartIds,
  ])

  useEffect(() => {
    if (role === 'teacher' && activeTeacherTab === 'students' && selectedStudentInfo) {
      loadStudentSkillMastery(selectedStudentInfo, selectedStudentProgressAssignment)
      return
    }

    setStudentSkillMasteryRows([])
    setStudentSkillMasteryMessage('')
  }, [
    role,
    activeTeacherTab,
    selectedStudentInfo?.id,
    selectedStudentProgressAssignment?.classId,
  ])
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  const handleManualFormChange = (event) => {
    const { name, value } = event.target
    setManualForm((currentForm) => ({ ...currentForm, [name]: value }))
  }

  const handleAssignmentFormChange = (event) => {
    const { name, value } = event.target
    setAssignmentForm((currentForm) => ({
      ...currentForm,
      [name]: value,
      ...(name === 'teacherId' ? { subjectId: '', gradeLevelId: '', classId: '' } : {}),
      ...(name === 'subjectId' ? { gradeLevelId: '', classId: '' } : {}),
      ...(name === 'gradeLevelId' ? { classId: '' } : {}),
    }))
  }

  const handleAssignmentSubmit = async (event) => {
    event.preventDefault()
    setAssignmentMessage({ error: '', success: '' })

    if (
      !assignmentForm.teacherId ||
      !assignmentForm.subjectId ||
      !assignmentForm.gradeLevelId ||
      !assignmentForm.classId ||
      !selectedAcademicYearId
    ) {
      setAssignmentMessage({
        error: 'Select teacher, subject, grade level, section, and academic year before assigning.',
        success: '',
      })
      return
    }

    setIsAssignmentSubmitting(true)

    try {
      await createClassAssignmentV2({
        classId: Number(assignmentForm.classId),
        teacherUserId: Number(assignmentForm.teacherId),
        subjectId: Number(assignmentForm.subjectId),
        assignmentRole: 'primary',
      }, token)
      setAssignmentForm(initialAssignmentForm)
      setAssignmentMessage({ error: '', success: 'Teacher assigned to class successfully.' })
      await loadTeacherClasses()
    } catch (submitError) {
      setAssignmentMessage({
        error: submitError.message || 'Unable to assign teacher to this class.',
        success: '',
      })
    } finally {
      setIsAssignmentSubmitting(false)
    }
  }

  const handleManualRowChange = (rowId, fieldName, value) => {
    setManualRows((currentRows) =>
      currentRows.map((row) =>
        row.rowId === rowId
          ? {
              ...row,
              [fieldName]: value,
            }
          : row,
      ),
    )
  }

  const handleAddManualRow = () => {
    setManualRows((currentRows) => [
      ...currentRows,
      ...createManualStudentRows(1),
    ])
  }

  const handleRemoveManualRow = (rowId) => {
    setManualRows((currentRows) => {
      if (currentRows.length <= 1) {
        return createManualStudentRows(1)
      }

      return currentRows.filter((row) => row.rowId !== rowId)
    })
  }

  const handleClearManualRows = () => {
    setManualRows(createManualStudentRows())
  }

  const handleManualClassFilterChange = (event) => {
    const { name, value } = event.target

    setManualClassFilters((currentFilters) => ({
      ...currentFilters,
      [name]: value,
      ...(name === 'teacherId' ? { gradeLevelId: '', subjectId: '' } : {}),
      ...(name === 'gradeLevelId' ? { subjectId: '' } : {}),
    }))
    setManualForm((currentForm) => ({
      ...currentForm,
      sectionId: '',
      academicYearId: '',
    }))
  }

  const handleManualSectionChange = (event) => {
    const sectionId = event.target.value
    const selectedOption = effectiveManualSectionOptions.find(
      (option) => String(option.value) === String(sectionId),
    )

    setManualForm((currentForm) => ({
      ...currentForm,
      sectionId,
      academicYearId: selectedOption?.assignment?.academicYear ?? currentForm.academicYearId,
    }))
  }

  const handleTeacherSubjectChange = (event) => {
    const nextClassId = Number(event.target.value)

    setSelectedClassAssignment(
      classAssignments.find((assignment) => Number(assignment.classId) === nextClassId) ?? null,
    )
  }

  const handleSmartImportPendingClick = (event) => {
    event.preventDefault()

    setAssignmentMessage({
      error: 'Smart Import (SF1) is temporarily disabled in V2. Use Manual Input for now.',
      success: '',
    })
  }

  const handleManualSubmit = async (event) => {
    event.preventDefault()
    setManualMessage({ error: '', success: '' })
    setStudentsSuccess('')

    if (
      classAssignments.length &&
      (!manualClassFilters.teacherId ||
        !manualClassFilters.gradeLevelId ||
        !manualClassFilters.subjectId ||
        !manualForm.sectionId)
    ) {
      setManualMessage({
        error: 'Select the teacher, grade level, subject, and class section before saving.',
        success: '',
      })
      return
    }

    if (!manualForm.sectionId || !manualForm.academicYearId.trim()) {
      setManualMessage({
        error: 'Select a class section with an academic year before saving.',
        success: '',
      })
      return
    }

    if (!startedManualRows.length) {
      setManualMessage({ error: 'Enter at least one student row before saving.', success: '' })
      return
    }

    const incompleteRowIndex = startedManualRows.findIndex(
      (row) =>
        !row.studentLrn.trim() ||
        !row.firstName.trim() ||
        !row.lastName.trim() ||
        !row.gender,
    )

    if (incompleteRowIndex >= 0) {
      setManualMessage({
        error: `Complete all fields in student row ${incompleteRowIndex + 1} before saving.`,
        success: '',
      })
      return
    }

    setIsManualSubmitting(true)

    try {
      for (const row of startedManualRows) {
        await createManualStudent({
          studentLrn: row.studentLrn.trim(),
          firstName: row.firstName.trim(),
          lastName: row.lastName.trim(),
          gender: row.gender,
          sectionId: manualForm.sectionId,
          academicYearId: manualForm.academicYearId.trim(),
        })
      }

      setManualRows(createManualStudentRows())
      setManualMessage({
        error: '',
        success: `${startedManualRows.length} student record(s) saved to the selected class.`,
      })
      setStudentsSuccess('Student records refreshed.')
      await loadStudents({ preserveMessage: true })
    } catch (submitError) {
      setManualMessage({
        error: submitError.message || 'Unable to save manual student record.',
        success: '',
      })
    } finally {
      setIsManualSubmitting(false)
    }
  }

  if (role === 'teacher') {
    return (
      <div className="content-stack teacher-records-page">
        {studentsError ? <p className="form-message form-message-error">{studentsError}</p> : null}

        <section className="teacher-assessment-workspace-panel">
          <button
            type="button"
            className="assessment-back-link"
            onClick={() => onNavigate('teacher-dashboard')}
          >
            Back to Home
          </button>

          {activeTeacherTab !== 'students' ? (
            <div className="teacher-assessment-topline">
              <button
                type="button"
                className={activeTeacherTab === 'assessment' ? 'is-active' : ''}
                onClick={() => setActiveTeacherTab('assessment')}
              >
                Assessment
              </button>
              <button
                type="button"
                className={activeTeacherTab === 'analytics' ? 'is-active' : ''}
                onClick={() => setActiveTeacherTab('analytics')}
              >
                Analytics
              </button>
            </div>
          ) : null}

          <div className="teacher-assessment-title-row">
            <div>
              <h2>{teacherHeaderLabel}</h2>
              <span>
                {isStudentsLoading ? 'Loading students' : `${teacherHeaderStudentCount} students`}
              </span>
            </div>
          </div>

          {activeTeacherTab === 'assessment' ? (
            <>
              <div className="teacher-assessment-toolbar">
                <label className="teacher-subject-select" htmlFor="teacherClassSubject">
                  <span>Subject:</span>
                  <select
                    id="teacherClassSubject"
                    value={selectedClassAssignment?.classId ?? ''}
                    onChange={handleTeacherSubjectChange}
                    disabled={!selectedClassGroupAssignments.length}
                  >
                    {selectedClassGroupAssignments.map((assignment) => (
                      <option key={assignment.classId ?? assignment.id} value={assignment.classId}>
                        {assignment.subjectName || 'Subject not assigned'}
                      </option>
                    ))}
                  </select>
                </label>

                <button
                  type="button"
                  className="teacher-create-assessment-button"
                  disabled={!selectedClassAssignment}
                  onClick={() =>
                    onNavigate('assessment-setup', { classId: selectedClassAssignment.classId })
                  }
                >
                  <Plus size={18} strokeWidth={2.5} />
                  <span>Create Assessment</span>
                </button>
              </div>

              {assessmentsError ? (
                <p className="form-message form-message-error">{assessmentsError}</p>
              ) : null}

              <article className="teacher-assessment-panel">
                <div className="teacher-assessment-panel-header">
                  <strong>Assessments</strong>
                  <div>
                    <span>Status</span>
                    <small>Total: {selectedClassAssessments.length}</small>
                  </div>
                </div>

                <div className="teacher-assessment-list">
                  {!selectedClassAssignment ? (
                    <p className="teacher-assessment-empty">Select a class to view assessments.</p>
                  ) : null}

                  {selectedClassAssignment && isAssessmentsLoading ? (
                    <p className="teacher-assessment-empty">Loading assessments...</p>
                  ) : null}

                  {selectedClassAssignment &&
                  !isAssessmentsLoading &&
                  !selectedClassAssessments.length ? (
                    <p className="teacher-assessment-empty">
                      No assessments added for this class yet.
                    </p>
                  ) : null}

                  {selectedClassAssignment && !isAssessmentsLoading
                    ? selectedClassAssessments.map((assessment, index) => (
                        <button
                          type="button"
                          className="teacher-assessment-row"
                          key={assessment.id ?? index}
                          onClick={() =>
                            onNavigate('assessment-setup', {
                              classId: selectedClassAssignment.classId,
                              assessmentId: assessment.id,
                            })
                          }
                        >
                          <span className="teacher-assessment-icon" aria-hidden="true">
                            {index % 2 === 0 ? (
                              <FileText size={18} strokeWidth={2.2} />
                            ) : (
                              <ClipboardList size={18} strokeWidth={2.2} />
                            )}
                          </span>
                          <div className="teacher-assessment-copy">
                            <strong>{assessment.testName || 'Untitled assessment'}</strong>
                            <small>{formatDate(assessment.testDate)}</small>
                          </div>
                          <span
                            className={`status-pill ${getAssessmentStatusClass(
                              assessment.testStatus,
                            )}`}
                          >
                            {assessment.testStatus || 'Status not set'}
                          </span>
                        </button>
                      ))
                    : null}
                </div>
              </article>
            </>
          ) : null}

          {activeTeacherTab === 'analytics' ? (
            <div className="teacher-class-analytics">
              <div className="teacher-analytics-hero">
                <div>
                  <span>Assessment Overview & Learner Performance</span>
                </div>
                <button
                  type="button"
                  onClick={handleAnalyticsExport}
                  disabled={isAnalyticsExportLoading || !selectedAnalyticsTestId}
                >
                  <Download size={15} strokeWidth={2.4} />
                  <span>{isAnalyticsExportLoading ? 'Exporting...' : 'Export Report'}</span>
                </button>
              </div>

              <div className="teacher-analytics-filter-row">
                <label>
                  <BookOpen size={20} strokeWidth={2.2} />
                  <span>Subject</span>
                  <select
                    value={selectedClassAssignment?.classId ?? ''}
                    onChange={handleTeacherSubjectChange}
                    disabled={!selectedClassGroupAssignments.length}
                  >
                    {selectedClassGroupAssignments.map((assignment) => (
                      <option key={assignment.classId ?? assignment.id} value={assignment.classId}>
                        {assignment.subjectName || 'Subject not assigned'}
                      </option>
                    ))}
                  </select>
                </label>

                <div>
                  <ClipboardList size={20} strokeWidth={2.2} />
                  <span>Total Assessments</span>
                  <strong>{selectedClassAssessments.length}</strong>
                </div>

                <label>
                  <FileCheck2 size={20} strokeWidth={2.2} />
                  <span>Assessment</span>
                  <select
                    value={selectedAnalyticsTestId}
                    onChange={(event) => setSelectedAnalyticsTestId(event.target.value)}
                  >
                    <option value="">Select assessment</option>
                    {selectedClassAssessments.map((assessment) => (
                      <option key={assessment.id} value={assessment.id}>
                        {assessment.testName}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {analyticsMessage.error ? (
                <p className="form-message form-message-error">{analyticsMessage.error}</p>
              ) : null}

              {analyticsMessage.success ? (
                <p className="form-message form-message-success">{analyticsMessage.success}</p>
              ) : null}

              <div className="teacher-analytics-top-grid">
                <section className="teacher-performance-summary-card">
                  <div className="teacher-section-title">
                    <Users size={18} strokeWidth={2.3} />
                    <div>
                      <strong>Performance Summary</strong>
                      <span>Class performance overview for this assessment</span>
                    </div>
                  </div>
                  <div className="teacher-performance-summary-metrics">
                    <article>
                      <span>Class Average</span>
                      <strong>{formatPercent(classAverage)}</strong>
                    </article>
                    <article>
                      <span>Highest Score</span>
                      <strong>
                        {formatScoreWithMax(
                          highestAnalyticsStudent?.displayScore,
                          highestAnalyticsStudent?.maxScore,
                        )}
                      </strong>
                      <small>{highestAnalyticsStudent?.displayName || 'No data'}</small>
                    </article>
                    <article>
                      <span>Lowest Score</span>
                      <strong>
                        {formatScoreWithMax(
                          lowestAnalyticsStudent?.displayScore,
                          lowestAnalyticsStudent?.maxScore,
                        )}
                      </strong>
                      <small>{lowestAnalyticsStudent?.displayName || 'No data'}</small>
                    </article>
                  </div>
                </section>

                <section className="teacher-lms-chart-card">
                  <div className="teacher-lms-chart-heading">
                    <div>
                      <Target size={18} strokeWidth={2.3} />
                      <div>
                        <span>Least Mastered Skills</span>
                        <strong>{selectedAnalyticsAssessment?.testName || 'Class analytics overview'}</strong>
                      </div>
                    </div>
                    <small>
                      {hasAnalyticsChartRows
                        ? 'Based on synchronized LMS records'
                        : 'Waiting for synchronized results'}
                    </small>
                  </div>

                  {hasAnalyticsChartRows ? (
                    <HorizontalMasteryChart data={analyticsChartRows.slice(0, 5)} />
                  ) : (
                    <div className="teacher-empty-chart">
                      <p>No analytics data available yet for this selection.</p>
                      <small>Once results are synced, LMS percentages will appear here.</small>
                    </div>
                  )}
                </section>
              </div>

              {selectedAnalyticsTestId ? (
                <>
                  <div className="teacher-analytics-results-grid">
                    <div className="teacher-analytics-main-column">
                      <section className="teacher-part-details-card">
                        <div className="teacher-section-title">
                          <ClipboardCheck size={18} strokeWidth={2.3} />
                          <div>
                            <strong>Assessment Score Details</strong>
                            <span>
                              {selectedAnalyticsAssessment?.testName || 'Selected assessment'}
                            </span>
                          </div>
                        </div>

                        <div className="teacher-part-details-layout">
                          <div className="teacher-part-summary-card">
                            <article>
                              <span>Number of Items</span>
                              <strong>{assessmentTotalItems}</strong>
                            </article>
                            <article>
                              <span>Total Points</span>
                              <strong>{formatScore(assessmentMaxScore)}</strong>
                            </article>
                          </div>
                        </div>
                      </section>

                      <section className="teacher-analytics-student-panel">
                        <div className="teacher-section-title">
                          <Users size={18} strokeWidth={2.3} />
                          <div>
                            <strong>Student Results</strong>
                            <span>Whole test scores for the selected assessment</span>
                          </div>
                        </div>

                        <table>
                          <thead>
                            <tr>
                              <th>Student Name</th>
                              <th>Score</th>
                              <th>Percentage</th>
                              <th>Performance</th>
                            </tr>
                          </thead>
                          <tbody>
                            {isAnalyticsLoading ? (
                              <tr>
                                <td colSpan="4">Loading analytics records...</td>
                              </tr>
                            ) : null}

                            {!isAnalyticsLoading && !analyticsStudentRows.length ? (
                              <tr>
                                <td colSpan="4">No student score records found for this assessment.</td>
                              </tr>
                            ) : null}

                            {!isAnalyticsLoading
                              ? analyticsStudentRows.map((student) => (
                                  <tr
                                    key={student.id ?? `${student.displayName}-${student.rowNumber}`}
                                  >
                                    <td>
                                      <div className="teacher-student-result-name">
                                        <span>
                                          {getStudentInitials({ name: student.displayName })}
                                        </span>
                                        <strong>{student.displayName || 'Student'}</strong>
                                      </div>
                                    </td>
                                    <td>{formatScoreWithMax(student.displayScore, student.maxScore)}</td>
                                    <td>{formatPercent(student.percentage)}</td>
                                    <td>
                                      <span
                                        className={`performance-pill ${student.performanceClass}`}
                                      >
                                        {student.performance}
                                      </span>
                                    </td>
                                  </tr>
                                ))
                              : null}
                          </tbody>
                        </table>
                      </section>
                    </div>

                    <section className="teacher-intervention-panel">
                      <div className="teacher-intervention-heading">
                        <div>
                          <span>Recommended Intervention</span>
                          <h3>
                            {selectedTeacherRecommendation?.competencyName ||
                              selectedAnalyticsSkillName ||
                              selectedPartLms?.competencyName ||
                              'Selected skill'}
                          </h3>
                        </div>
                        <strong
                          className={isInterventionRecommended ? 'is-triggered' : 'is-monitoring'}
                        >
                          {isInterventionRecommended
                            ? 'Intervention recommended'
                            : 'No intervention recommended'}
                        </strong>
                      </div>

                      <div className="teacher-intervention-metrics">
                        <article>
                          <BookOpen size={18} strokeWidth={2.2} />
                          <span>Selected Skill</span>
                          <strong>
                            {selectedTeacherRecommendation?.competencyName ||
                              selectedAnalyticsSkillName ||
                              selectedPartLms?.competencyName ||
                              'Selected competency'}
                          </strong>
                        </article>
                        <article>
                          <Target size={18} strokeWidth={2.2} />
                          <span>Mastery / LMS Status</span>
                          <strong>
                            {formatPercent(selectedInterventionMastery)} -{' '}
                            {selectedInterventionStatusLabel}
                          </strong>
                        </article>
                        <article>
                          <Users size={18} strokeWidth={2.2} />
                          <span>Affected Learners</span>
                          <strong>{affectedLearnerCount || 'None'}</strong>
                        </article>
                      </div>

                      <div className="teacher-intervention-list">
                        {isInterventionRecommended && teacherInterventions.length ? (
                          teacherInterventions.map((intervention, index) => (
                            <article
                              className="teacher-intervention-step"
                              key={`${intervention.title}-${index}`}
                            >
                              <span>{String(index + 1).padStart(2, '0')}</span>
                              <div>
                                <strong>{intervention.title}</strong>
                                <p>
                                  {intervention.description ||
                                    'Use this recommendation as the teacher action plan during the next remediation session.'}
                                </p>
                                <small>
                                  Target group:{' '}
                                  {intervention.targetGroup ||
                                    'Learners affected by this low-mastery competency'}
                                </small>
                                <small className="teacher-intervention-followup">
                                  Follow-up:{' '}
                                  {intervention.followUp ||
                                    'Give a short practice activity or quick reassessment to confirm improvement.'}
                                </small>
                              </div>
                            </article>
                          ))
                        ) : (
                          <article className="teacher-intervention-neutral">
                            <strong>
                              No intervention is currently recommended for this competency.
                            </strong>
                            <p>
                              Continue monitoring this skill after the next synced assessment.
                            </p>
                          </article>
                        )}
                      </div>
                    </section>
                  </div>
                </>
              ) : (
                <section className="teacher-analytics-empty-panel">
                  <strong>No assessment selected yet.</strong>
                  <span>
                    Create or select an assessment to view part details and student LMS records.
                  </span>
                </section>
              )}
            </div>
          ) : null}

          {activeTeacherTab === 'students' ? (
            <div className="teacher-students-tab">
              <div className="teacher-students-toolbar">
                <label htmlFor="teacherStudentClassFilter">
                  <span>Class:</span>
                  <select
                    id="teacherStudentClassFilter"
                    value={effectiveStudentClassFilter}
                    onChange={(event) => setSelectedStudentClassFilter(event.target.value)}
                  >
                    {teacherClassOptions.map((option) => (
                      <option key={option.key} value={option.key}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label htmlFor="teacherStudentNameSearch">
                  <span>Search:</span>
                  <input
                    id="teacherStudentNameSearch"
                    type="search"
                    value={studentNameSearch}
                    onChange={(event) => setStudentNameSearch(event.target.value)}
                    placeholder="Search student name"
                  />
                </label>
              </div>

              <section className="teacher-analytics-student-panel teacher-students-table-panel">
                <table>
                  <thead>
                    <tr>
                      <th>No.</th>
                      <th>Student Name</th>
                      <th>LRN</th>
                      <th>Section</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isStudentsLoading ? (
                      <tr>
                        <td colSpan="5">Loading students...</td>
                      </tr>
                    ) : null}

                    {!isStudentsLoading && !filteredTeacherStudents.length ? (
                      <tr>
                        <td colSpan="5">No students found for this class filter.</td>
                      </tr>
                    ) : null}

                    {!isStudentsLoading
                      ? filteredTeacherStudents.map((student, index) => (
                          <tr key={student.id ?? `${student.studentLrn}-${index}`}>
                            <td>{String(index + 1).padStart(2, '0')}</td>
                            <td>{student.name}</td>
                            <td>{student.studentLrn || '-'}</td>
                            <td>{student.section || '-'}</td>
                            <td>
                              <button
                                type="button"
                                className="teacher-student-view-button"
                                onClick={() => setSelectedStudentInfo(student)}
                              >
                                View
                              </button>
                            </td>
                          </tr>
                        ))
                      : null}
                  </tbody>
                </table>
              </section>
            </div>
          ) : null}

          {selectedStudentInfo ? (
            <div
              className="student-info-modal-backdrop"
              role="presentation"
              onMouseDown={() => setSelectedStudentInfo(null)}
            >
              <section
                className="student-info-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="studentInfoModalTitle"
                onMouseDown={(event) => event.stopPropagation()}
              >
                <div className="student-info-modal-header">
                  <h3 id="studentInfoModalTitle">Back to list</h3>
                  <button type="button" onClick={() => setSelectedStudentInfo(null)}>
                    Close
                  </button>
                </div>

                <div className="student-info-modal-body">
                  <aside className="student-profile-column">
                    <div
                      className={`student-info-avatar ${getStudentGenderAvatarClass(
                        selectedStudentInfo,
                      )}`}
                      aria-hidden="true"
                    >
                      {getStudentInitials(selectedStudentInfo)}
                    </div>
                    <div className="student-profile-card">
                      <p>LRN: {selectedStudentInfo.studentLrn || 'Not provided'}</p>
                      <p>NAME: {selectedStudentInfo.name}</p>
                      <p>
                        {selectedStudentInfo.gradeLevel || 'Grade level not assigned'} -{' '}
                        {selectedStudentInfo.section || 'Section not assigned'}
                      </p>
                    </div>
                  </aside>

                  <div className="student-performance-column">
                    <section className="student-performance-card">
                      <h4>Skill Mastery</h4>
                      <p className="student-performance-card-subtitle">
                        All competency tags assessed across checked results in this class.
                      </p>
                      {isStudentSkillMasteryLoading ? (
                        <div className="student-chart-empty">Loading skill mastery...</div>
                      ) : studentSkillMasteryMessage ? (
                        <div className="student-chart-empty">{studentSkillMasteryMessage}</div>
                      ) : studentAssessedSkillRows.length ? (
                        <div className="student-skill-list">
                          {studentAssessedSkillRows.map((item) => (
                            <div
                              className={`student-skill-row ${getPerformanceClass(item.value)}`}
                              key={item.id}
                            >
                              <div>
                                <span>
                                  {item.label}
                                  {item.status ? <small>{formatStatus(item.status)}</small> : null}
                                </span>
                                <strong>{formatPercent(item.value)}</strong>
                              </div>
                              <div className="student-skill-track">
                                <span
                                  style={{
                                    width: `${Math.max(4, Math.min(100, item.value))}%`,
                                  }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="student-chart-empty">
                          No assessed competency tags found for this student yet.
                        </div>
                      )}
                    </section>
                  </div>
                </div>
              </section>
            </div>
          ) : null}
        </section>
      </div>
    )
  }

  return (
    <div className="principal-class-records-page">
      <section className="principal-class-header">
        <h2>Teacher Class Assignment</h2>
        <span>Manage and assign teachers to sections and subjects for the current academic year.</span>
      </section>

      <section className="principal-assignment-card">
        <div className="section-toolbar">
          <div>
            <p className="content-card-tag">Assignment Creation Section</p>
            <h3>Assign teacher to a class</h3>
          </div>
          <div className="principal-assignment-toolbar-actions">
            <button
              type="button"
              className="principal-smart-import-card"
              onClick={handleSmartImportPendingClick}
              title={SF1_PENDING_MESSAGE}
              aria-label={SF1_PENDING_MESSAGE}
            >
              <span aria-hidden="true">
                <FileText size={18} strokeWidth={2.3} />
              </span>
              <strong>Smart Import (SF1)</strong>
            </button>

            <button
              type="button"
              className={`principal-manual-input-card ${
                activePrincipalTool === 'manual' ? 'is-active' : ''
              }`}
              onClick={() => setActivePrincipalTool('manual')}
            >
              Manual Input
            </button>

            <button type="button" className="secondary-button" onClick={() => loadTeacherClasses()}>
              Refresh
            </button>
          </div>
        </div>

        {assignmentMessage.error ? (
          <p className="form-message form-message-error">{assignmentMessage.error}</p>
        ) : null}
        {assignmentMessage.success ? (
          <p className="form-message form-message-success">{assignmentMessage.success}</p>
        ) : null}
        {studentsSuccess ? (
          <p className="form-message form-message-success">{studentsSuccess}</p>
        ) : null}

        <form className="principal-assignment-form" onSubmit={handleAssignmentSubmit}>
          <label htmlFor="classAssignmentTeacherId">
            <span>Teacher</span>
            <select
              id="classAssignmentTeacherId"
              name="teacherId"
              value={assignmentForm.teacherId}
              onChange={handleAssignmentFormChange}
            >
              <option value="">Select teacher</option>
              {schoolTeachers.map((teacher) => (
                <option key={teacher.userId ?? teacher.id} value={teacher.userId ?? teacher.id}>
                  {teacher.name}
                </option>
              ))}
            </select>
          </label>

          <label htmlFor="classAssignmentSubjectId">
            <span>Subject</span>
            <select
              id="classAssignmentSubjectId"
              name="subjectId"
              value={assignmentForm.subjectId}
              onChange={handleAssignmentFormChange}
              disabled={!assignmentForm.teacherId}
            >
              <option value="">Select subject</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
          </label>

          <label htmlFor="classAssignmentGradeLevelId">
            <span>Grade Level</span>
            <select
              id="classAssignmentGradeLevelId"
              name="gradeLevelId"
              value={assignmentForm.gradeLevelId}
              onChange={handleAssignmentFormChange}
              disabled={!assignmentForm.subjectId}
            >
              <option value="">Select grade level</option>
              {assignmentGradeOptions.map((gradeLevel) => (
                <option key={gradeLevel.id} value={gradeLevel.id}>
                  {gradeLevel.name}
                </option>
              ))}
            </select>
          </label>

          <label htmlFor="classAssignmentSectionId">
            <span>Section</span>
            <select
              id="classAssignmentSectionId"
              name="classId"
              value={assignmentForm.classId}
              onChange={handleAssignmentFormChange}
              disabled={!assignmentForm.gradeLevelId || !assignmentSectionOptions.length}
            >
              <option value="">
                {assignmentForm.gradeLevelId
                  ? 'Select section'
                  : 'Select section'}
              </option>
              {assignmentForm.gradeLevelId && !assignmentSectionOptions.length ? (
                <option value="" disabled>
                  No available sections for this grade level.
                </option>
              ) : null}
              {assignmentSectionOptions.map((section) => (
                <option key={section.classId ?? section.id} value={section.classId}>
                  {section.sectionName || section.name}
                </option>
              ))}
            </select>
          </label>

          <div className="principal-assignment-readonly-field" aria-label="Academic Year">
            <span>Academic Year</span>
            <strong>{selectedAcademicYearLabel}</strong>
          </div>

          <button type="submit" className="primary-button" disabled={isAssignmentSubmitting}>
            {isAssignmentSubmitting ? 'Assigning...' : 'Assign Teacher'}
          </button>
        </form>
      </section>

      <section className="principal-assignment-card">
        <div className="principal-assignment-table-header">
          <div>
            <p className="content-card-tag">Assignments Table</p>
            <h3>Existing class assignments</h3>
          </div>
          <span>{classAssignments.length} assignment(s)</span>
        </div>

        <div className="approval-table-wrap">
          <table className="approval-table">
            <thead>
              <tr>
                <th>Teacher</th>
                <th>Subject</th>
                <th>Section</th>
                <th>Academic Year</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {!classAssignments.length ? (
                <tr>
                  <td className="approval-empty" colSpan="5">
                    No class assignments found.
                  </td>
                </tr>
              ) : (
                classAssignments.map((assignment, index) => (
                  <tr key={assignment.id ?? `${assignment.teacherName}-${assignment.sectionName}-${index}`}>
                    <td>{assignment.teacherName || 'Not assigned'}</td>
                    <td>{assignment.subjectName || 'Not assigned'}</td>
                    <td>
                      {assignment.gradeLevelName || 'Grade level'} -{' '}
                      {assignment.sectionName || 'Section'}
                    </td>
                    <td>{formatAcademicYear(assignment, 'Not assigned')}</td>
                    <td>
                      <span className="status-pill status-active">Active</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="content-card principal-student-table-panel">
        <div className="section-toolbar">
          <div>
            <p className="content-card-tag">Student Records Table</p>
            <h3>Existing student records</h3>
          </div>
          <button type="button" className="secondary-button" onClick={() => loadStudents()}>
            Refresh
          </button>
        </div>

        {studentsError ? <p className="form-message form-message-error">{studentsError}</p> : null}

        <div className="approval-table-wrap">
          <table className="approval-table">
            <thead>
              <tr>
                <th>LRN</th>
                <th>Name</th>
                <th>Gender</th>
                <th>Section</th>
                <th>Grade Level</th>
                <th>Academic Year</th>
              </tr>
            </thead>
            <tbody>
              {isStudentsLoading ? (
                <tr>
                  <td className="approval-empty" colSpan="6">
                    Loading student records...
                  </td>
                </tr>
              ) : null}

              {!isStudentsLoading && !students.length ? (
                <tr>
                  <td className="approval-empty" colSpan="6">
                    No student records found.
                  </td>
                </tr>
              ) : null}

              {!isStudentsLoading
                ? students.map((student) => (
                    <tr key={student.id ?? `${student.studentLrn}-${student.name}`}>
                      <td>{student.studentLrn || 'Not provided'}</td>
                      <td>{student.name}</td>
                      <td>{student.gender}</td>
                      <td>{student.section || 'Not assigned'}</td>
                      <td>{student.gradeLevel || 'Not assigned'}</td>
                    <td>{formatAcademicYear(student, 'Not assigned')}</td>
                    </tr>
                  ))
                : null}
            </tbody>
          </table>
        </div>
      </section>

      <div className="principal-class-tool-panels">
        <section
          className={`content-card principal-tool-panel ${
            activePrincipalTool === 'manual' ? 'is-active' : ''
          }`}
        >
          <p className="content-card-tag">Manual Student Input</p>
          <h3>Add student to a class</h3>
          <p className="supporting-text">
            Select the teacher, grade level, subject, and class section first so the student record
            is saved under the correct class context.
          </p>

          {manualMessage.error ? (
            <p className="form-message form-message-error">{manualMessage.error}</p>
          ) : null}
          {manualMessage.success ? (
            <p className="form-message form-message-success">{manualMessage.success}</p>
          ) : null}

          <form className="manual-student-table-form" onSubmit={handleManualSubmit}>
            <div className="manual-class-filter-bar">
              <label htmlFor="manualTeacherId">
                <span>Teacher</span>
                <select
                  id="manualTeacherId"
                  name="teacherId"
                  value={manualClassFilters.teacherId}
                  onChange={handleManualClassFilterChange}
                >
                  <option value="">Select teacher</option>
                  {manualTeacherOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label htmlFor="manualGradeLevelId">
                <span>Grade Level</span>
                <select
                  id="manualGradeLevelId"
                  name="gradeLevelId"
                  value={manualClassFilters.gradeLevelId}
                  onChange={handleManualClassFilterChange}
                  disabled={!manualClassFilters.teacherId && Boolean(manualTeacherOptions.length)}
                >
                  <option value="">Select grade level</option>
                  {manualGradeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label htmlFor="manualSubjectId">
                <span>Subject</span>
                <select
                  id="manualSubjectId"
                  name="subjectId"
                  value={manualClassFilters.subjectId}
                  onChange={handleManualClassFilterChange}
                  disabled={!manualClassFilters.gradeLevelId && Boolean(manualGradeOptions.length)}
                >
                  <option value="">Select subject</option>
                  {manualSubjectOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label htmlFor="manualSectionId">
                <span>Section</span>
                <select
                  id="manualSectionId"
                  name="sectionId"
                  value={manualForm.sectionId}
                  onChange={handleManualSectionChange}
                  disabled={!manualClassFilters.subjectId && Boolean(manualSubjectOptions.length)}
                >
                  <option value="">Select section</option>
                  {effectiveManualSectionOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label htmlFor="manualAcademicYearId">
                <span>Academic Year</span>
                <input
                  id="manualAcademicYearId"
                  name="academicYearId"
                  value={manualForm.academicYearId}
                  onChange={handleManualFormChange}
                  placeholder="Select class"
                  readOnly={Boolean(selectedManualClassOption?.assignment)}
                />
              </label>
            </div>

            {selectedManualClassOption?.assignment ? (
              <div className="manual-class-summary">
                <span>Selected Class</span>
                <strong>
                  {selectedManualClassOption.assignment.gradeLevelName || 'Grade level'} -{' '}
                  {selectedManualClassOption.assignment.sectionName || 'Section'}
                </strong>
                <small>
                  {selectedManualClassOption.assignment.teacherName || 'Teacher'} /{' '}
                  {selectedManualClassOption.assignment.subjectName || 'Subject'} /{' '}
                  {formatAcademicYear(
                    selectedManualClassOption.assignment,
                    'Academic year',
                  )}
                </small>
              </div>
            ) : null}

            <div className="manual-table-heading">
              <div>
                <span>Input Student Manually</span>
                <strong>{startedManualRows.length} row(s) ready</strong>
              </div>
              <div className="manual-table-actions">
                <button type="button" className="secondary-button" onClick={handleAddManualRow}>
                  Add Row
                </button>
                <button type="button" className="secondary-button" onClick={handleClearManualRows}>
                  Clear
                </button>
              </div>
            </div>

            <div className="manual-student-table-wrap">
              <table className="manual-student-table">
                <thead>
                  <tr>
                    <th>No.</th>
                    <th>LRN</th>
                    <th>First Name</th>
                    <th>Last Name</th>
                    <th>Gender</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {manualRows.map((row, index) => (
                    <tr key={row.rowId}>
                      <td>{String(index + 1).padStart(2, '0')}</td>
                      <td>
                        <input
                          value={row.studentLrn}
                          onChange={(event) =>
                            handleManualRowChange(row.rowId, 'studentLrn', event.target.value)
                          }
                          placeholder="Enter LRN"
                        />
                      </td>
                      <td>
                        <input
                          value={row.firstName}
                          onChange={(event) =>
                            handleManualRowChange(row.rowId, 'firstName', event.target.value)
                          }
                          placeholder="First name"
                        />
                      </td>
                      <td>
                        <input
                          value={row.lastName}
                          onChange={(event) =>
                            handleManualRowChange(row.rowId, 'lastName', event.target.value)
                          }
                          placeholder="Last name"
                        />
                      </td>
                      <td>
                        <select
                          value={row.gender}
                          onChange={(event) =>
                            handleManualRowChange(row.rowId, 'gender', event.target.value)
                          }
                        >
                          <option value="">Select</option>
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                        </select>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="manual-row-remove"
                          onClick={() => handleRemoveManualRow(row.rowId)}
                          aria-label={`Remove row ${index + 1}`}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="manual-save-row">
              <button type="submit" className="primary-button" disabled={isManualSubmitting}>
                {isManualSubmitting ? 'Saving...' : 'Save Students'}
              </button>
            </div>
          </form>
        </section>

      </div>
    </div>
  )
}

export default ClassRecordsPage

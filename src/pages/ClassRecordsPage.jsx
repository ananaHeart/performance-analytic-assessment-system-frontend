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
  confirmSf1,
  createClassAssignment,
  downloadStudentScoresReport,
  getAssessmentDetails,
  getClassAssignments,
  getIntervention,
  getLms,
  getPartSkillMappings,
  getStudentSkillMastery,
  getTeacherAssessments,
  getTeacherInterventions,
  getTeachers,
  getSyncActivity,
  createManualStudent,
  getManualStudents,
  getSections,
  getSubjects,
  previewSf1,
} from '../api/apiClient'

const initialAssignmentForm = {
  teacherId: '',
  subjectId: '',
  sectionId: '',
  academicYearId: '1',
}

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

function getStudentPartScore(student, part) {
  const maxScore = getPartMaxScore(part)
  const score = parseNumber(student?.score)
  const correctItems = parseNumber(student?.correctItems)
  const pointsPerItem = parseNumber(part?.pointsPerItem)
  const percentage = parseNumber(student?.percentage)

  if (score !== null) {
    if (
      maxScore !== null &&
      percentage !== null &&
      score > maxScore &&
      Math.round(score) === Math.round(percentage)
    ) {
      return (maxScore * percentage) / 100
    }

    return score
  }

  if (correctItems !== null && pointsPerItem !== null) {
    const computedScore = correctItems * pointsPerItem

    return maxScore !== null ? Math.min(computedScore, maxScore) : computedScore
  }

  if (maxScore !== null && percentage !== null) {
    return (maxScore * percentage) / 100
  }

  return null
}

function getPartBranchSkills(part) {
  return Array.isArray(part?.skillMappings) ? part.skillMappings : []
}

function getPrimaryPartSkill(part) {
  return getPartBranchSkills(part)[0] ?? null
}

function getPartSkillLabel(part) {
  const branchSkills = getPartBranchSkills(part)
    .map((mapping) => mapping.competencyName)
    .filter(Boolean)

  if (branchSkills.length) {
    return branchSkills.join(', ')
  }

  return part?.competencyName || 'Competency'
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

function ClassRecordsPage({ role, user, onNavigate, initialClassId = null }) {
  const teacherId = user?.id
  const [classAssignments, setClassAssignments] = useState([])
  const [students, setStudents] = useState([])
  const [schoolTeachers, setSchoolTeachers] = useState([])
  const [subjects, setSubjects] = useState([])
  const [sections, setSections] = useState([])
  const [assessments, setAssessments] = useState([])
  const [selectedClassAssignment, setSelectedClassAssignment] = useState(null)
  const [assignmentForm, setAssignmentForm] = useState(initialAssignmentForm)
  const [manualForm, setManualForm] = useState(initialManualForm)
  const [manualClassFilters, setManualClassFilters] = useState(initialManualClassFilters)
  const [manualRows, setManualRows] = useState(() => createManualStudentRows())
  const [selectedFile, setSelectedFile] = useState(null)
  const [previewData, setPreviewData] = useState(null)
  const [confirmResult, setConfirmResult] = useState(null)
  const [activeTeacherTab, setActiveTeacherTab] = useState('assessment')
  const [selectedAnalyticsTestId, setSelectedAnalyticsTestId] = useState('')
  const [selectedAnalyticsPartId, setSelectedAnalyticsPartId] = useState('')
  const [selectedStudentClassFilter, setSelectedStudentClassFilter] = useState('all')
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
  const [previewMessage, setPreviewMessage] = useState({ error: '', success: '' })
  const [confirmMessage, setConfirmMessage] = useState({ error: '', success: '' })
  const [isStudentsLoading, setIsStudentsLoading] = useState(true)
  const [isAssessmentsLoading, setIsAssessmentsLoading] = useState(true)
  const [, setIsSectionsLoading] = useState(true)
  const [isAssignmentSubmitting, setIsAssignmentSubmitting] = useState(false)
  const [isManualSubmitting, setIsManualSubmitting] = useState(false)
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)
  const [isConfirmSubmitting, setIsConfirmSubmitting] = useState(false)
  const [isAnalyticsLoading, setIsAnalyticsLoading] = useState(false)
  const [isAnalyticsExportLoading, setIsAnalyticsExportLoading] = useState(false)
  const [isStudentSkillMasteryLoading, setIsStudentSkillMasteryLoading] = useState(false)
  const [analyticsMessage, setAnalyticsMessage] = useState({ error: '', success: '' })
  const [studentSkillMasteryMessage, setStudentSkillMasteryMessage] = useState('')

  const previewRows = previewData?.rows ?? []
  const sectionOptions = useMemo(
    () => sections.filter((section) => section.id !== null && section.id !== undefined),
    [sections],
  )
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
  const selectedStudentClassAssignment =
    teacherClassOptions.find((option) => option.key === selectedStudentClassFilter)?.assignment ??
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
    const classFilteredStudents =
      selectedStudentClassFilter === 'all'
        ? teacherAssignedStudents
        : teacherAssignedStudents.filter(
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
  }, [
    selectedStudentClassAssignment,
    selectedStudentClassFilter,
    studentNameSearch,
    teacherAssignedStudents,
  ])
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
  const analyticsParts = analyticsDetails?.parts ?? []
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
        displayScore: getStudentPartScore(student, selectedAnalyticsPart),
        performance: getPerformanceLabel(student.percentage),
        performanceClass: getPerformanceClass(student.percentage),
      })),
    [analyticsStudents, selectedAnalyticsPart],
  )
  const analyticsPercentages = analyticsStudentRows
    .map((student) => parseNumber(student.percentage))
    .filter((value) => value !== null)
  const classAverage =
    analyticsPercentages.length > 0
      ? analyticsPercentages.reduce((total, value) => total + value, 0) / analyticsPercentages.length
      : null
  const rankedAnalyticsRows = [...analyticsStudentRows].sort(
    (left, right) => (parseNumber(right.percentage) ?? -1) - (parseNumber(left.percentage) ?? -1),
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
    selectedStudentClassFilter === 'all'
      ? 'All Classes'
      : getClassDisplayLabel(selectedStudentClassAssignment)
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
      const [sectionRecords, teacherRecords, subjectRecords] = await Promise.all([
        getSections(),
        getTeachers().catch(() => []),
        getSubjects().catch(() => []),
      ])
      setSections(sectionRecords)
      setSchoolTeachers(teacherRecords)
      setSubjects(subjectRecords)
    } catch {
      setSections([])
      setSchoolTeachers([])
      setSubjects([])
    } finally {
      setIsSectionsLoading(false)
    }
  }

  const loadTeacherClasses = async () => {
    try {
      const assignments = await getClassAssignments()
      const nextTeacherAssignments =
        role === 'teacher'
          ? assignments.filter((assignment) => Number(assignment.teacherId) === Number(teacherId))
          : assignments
      setClassAssignments(nextTeacherAssignments)
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
    } catch {
      setSelectedClassAssignment(null)
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

  const loadAnalyticsStudents = async (testId, part) => {
    const branchSkill = getPrimaryPartSkill(part)
    const competencyId = branchSkill?.competencyId ?? part?.competencyId

    if (!testId || !competencyId) {
      setAnalyticsStudents([])
      return
    }

    setIsAnalyticsLoading(true)
    setAnalyticsMessage({ error: '', success: '' })

    try {
      const studentRecords = await getIntervention(testId, competencyId, part.id)
      setAnalyticsStudents(studentRecords)
    } catch (loadError) {
      setAnalyticsStudents([])
      setAnalyticsMessage({
        error: loadError.message || 'Unable to load student LMS percentages for this part.',
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
    loadTeacherClasses()
    loadTeacherAssessments()
  }, [])

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
      loadAnalyticsStudents(selectedAnalyticsTestId, selectedAnalyticsPart)
    }
  }, [
    role,
    activeTeacherTab,
    selectedAnalyticsTestId,
    selectedAnalyticsPart?.id,
    selectedAnalyticsSkillId,
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
    setAssignmentForm((currentForm) => ({ ...currentForm, [name]: value }))
  }

  const handleAssignmentSubmit = async (event) => {
    event.preventDefault()
    setAssignmentMessage({ error: '', success: '' })

    if (
      !assignmentForm.teacherId ||
      !assignmentForm.subjectId ||
      !assignmentForm.sectionId ||
      !assignmentForm.academicYearId.trim()
    ) {
      setAssignmentMessage({
        error: 'Select teacher, subject, section, and academic year before assigning.',
        success: '',
      })
      return
    }

    setIsAssignmentSubmitting(true)

    try {
      await createClassAssignment({
        teacherId: Number(assignmentForm.teacherId),
        subjectId: Number(assignmentForm.subjectId),
        sectionId: Number(assignmentForm.sectionId),
        academicYearId: Number(assignmentForm.academicYearId.trim()),
      })
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

  const handleFileChange = (event) => {
    const nextFile = event.target.files?.[0] ?? null
    setSelectedFile(nextFile)
    setPreviewData(null)
    setConfirmResult(null)
    setPreviewMessage({ error: '', success: '' })
    setConfirmMessage({ error: '', success: '' })
  }

  const handlePreviewSubmit = async () => {
    setPreviewMessage({ error: '', success: '' })
    setConfirmResult(null)

    if (!selectedFile) {
      setPreviewMessage({ error: 'Select an SF1 file before previewing.', success: '' })
      return
    }

    setIsPreviewLoading(true)

    try {
      const previewResult = await previewSf1(selectedFile)
      setPreviewData(previewResult)
      setPreviewMessage({ error: '', success: 'SF1 preview generated successfully.' })
    } catch (previewError) {
      setPreviewMessage({
        error: previewError.message || 'Unable to preview the SF1 file.',
        success: '',
      })
    } finally {
      setIsPreviewLoading(false)
    }
  }

  const handleConfirmSubmit = async (event) => {
    event.preventDefault()
    setConfirmMessage({ error: '', success: '' })

    if (!selectedFile) {
      setConfirmMessage({ error: 'Select an SF1 file before confirming import.', success: '' })
      return
    }

    if (!previewData) {
      setConfirmMessage({ error: 'Run SF1 preview before confirming import.', success: '' })
      return
    }

    setIsConfirmSubmitting(true)

    try {
      const result = await confirmSf1(selectedFile)
      setConfirmResult(result)
      setConfirmMessage({ error: '', success: 'SF1 import confirmed successfully.' })
      setStudentsSuccess('Student records refreshed after SF1 confirm import.')
      await loadStudents({ preserveMessage: true })
    } catch (confirmError) {
      setConfirmMessage({
        error: confirmError.message || 'Unable to confirm SF1 import.',
        success: '',
      })
    } finally {
      setIsConfirmSubmitting(false)
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
            <button
              type="button"
              className={activeTeacherTab === 'students' ? 'is-active' : ''}
              onClick={() => setActiveTeacherTab('students')}
            >
              Students
            </button>
          </div>

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
                      <strong>{formatPercent(highestAnalyticsStudent?.percentage)}</strong>
                      <small>{highestAnalyticsStudent?.studentName || 'No data'}</small>
                    </article>
                    <article>
                      <span>Lowest Score</span>
                      <strong>{formatPercent(lowestAnalyticsStudent?.percentage)}</strong>
                      <small>{lowestAnalyticsStudent?.studentName || 'No data'}</small>
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
                    <div className="teacher-lms-bar-list">
                      {analyticsChartRows.slice(0, 3).map((item) => (
                        <div className="teacher-lms-bar-row" key={item.id}>
                          <div>
                            <strong>{item.label}</strong>
                            <span>{formatPercent(item.value)}</span>
                          </div>
                          <div className="teacher-lms-bar-track">
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
                            <strong>Assessment Part Details</strong>
                            <span>
                              {selectedAnalyticsAssessment?.testName || 'Selected assessment'}
                            </span>
                          </div>
                        </div>

                        <div className="teacher-part-details-layout">
                          <div className="teacher-part-summary-card">
                            <article>
                              <span>Number of Items</span>
                              <strong>{selectedAnalyticsPart?.numberOfItems ?? 0}</strong>
                            </article>
                            <article>
                              <span>Points per Item</span>
                              <strong>{selectedAnalyticsPart?.pointsPerItem ?? 0}</strong>
                            </article>
                          </div>

                          <div className="teacher-part-card-grid">
                            {analyticsParts.map((part, index) => (
                              <button
                                type="button"
                                key={part.id ?? index}
                                className={
                                  String(selectedAnalyticsPart?.id) === String(part.id)
                                    ? 'is-active'
                                    : ''
                                }
                                onClick={() => setSelectedAnalyticsPartId(String(part.id))}
                              >
                                <BookOpen size={22} strokeWidth={2.1} />
                                <span>{part.partOrder || `Part ${index + 1}`}</span>
                                <strong>{getPartSkillLabel(part)}</strong>
                              </button>
                            ))}

                            {!analyticsParts.length && !isAnalyticsLoading ? (
                              <p className="teacher-assessment-empty">No test parts found.</p>
                            ) : null}
                          </div>
                        </div>
                      </section>

                      <section className="teacher-analytics-student-panel">
                        <div className="teacher-section-title">
                          <Users size={18} strokeWidth={2.3} />
                          <div>
                            <strong>Student Results</strong>
                            <span>Scores for the selected assessment part</span>
                          </div>
                        </div>

                        <table>
                          <thead>
                            <tr>
                              <th>Student Name</th>
                              <th>Score</th>
                              <th>LMS Percentage</th>
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
                                <td colSpan="4">No student LMS records found for this part.</td>
                              </tr>
                            ) : null}

                            {!isAnalyticsLoading
                              ? analyticsStudentRows.map((student) => (
                                  <tr
                                    key={student.id ?? `${student.studentName}-${student.rowNumber}`}
                                  >
                                    <td>
                                      <div className="teacher-student-result-name">
                                        <span>
                                          {getStudentInitials({ name: student.studentName })}
                                        </span>
                                        <strong>{student.studentName || 'Student'}</strong>
                                      </div>
                                    </td>
                                    <td>{formatScore(student.displayScore)}</td>
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
                    value={selectedStudentClassFilter}
                    onChange={(event) => setSelectedStudentClassFilter(event.target.value)}
                  >
                    <option value="all">All classes</option>
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
        <p>
          <span>Assessments</span>
          <strong>/</strong>
          <span>Teacher Class Assignment</span>
        </p>
        <h2>Teacher Class Assignment</h2>
        <span>Manage and assign teachers to sections and subjects for the current academic year.</span>
      </section>

      <section className="principal-assignment-card">
        <div className="section-toolbar">
          <div>
            <p className="content-card-tag">Assignment Creation Section</p>
            <h3>Assign teacher to a class</h3>
          </div>
          <button type="button" className="secondary-button" onClick={() => loadTeacherClasses()}>
            Refresh
          </button>
        </div>

        {assignmentMessage.error ? (
          <p className="form-message form-message-error">{assignmentMessage.error}</p>
        ) : null}
        {assignmentMessage.success ? (
          <p className="form-message form-message-success">{assignmentMessage.success}</p>
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
                <option key={teacher.id} value={teacher.id}>
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
            >
              <option value="">Select subject</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
          </label>

          <label htmlFor="classAssignmentSectionId">
            <span>Section</span>
            <select
              id="classAssignmentSectionId"
              name="sectionId"
              value={assignmentForm.sectionId}
              onChange={handleAssignmentFormChange}
            >
              <option value="">Select section</option>
              {sectionOptions.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.gradeLevelName
                    ? `${section.gradeLevelName} - ${section.name}`
                    : section.name}
                </option>
              ))}
            </select>
          </label>

          <label htmlFor="classAssignmentAcademicYearId">
            <span>Academic Year ID</span>
            <input
              id="classAssignmentAcademicYearId"
              name="academicYearId"
              value={assignmentForm.academicYearId}
              onChange={handleAssignmentFormChange}
              placeholder="Input needed"
            />
          </label>

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
                    <td>{assignment.academicYear || 'Not assigned'}</td>
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

      <section className="principal-class-actions" aria-label="Student record tools">
        <button
          type="button"
          className={`principal-smart-import-card ${
            activePrincipalTool === 'smart-import' ? 'is-active' : ''
          }`}
          onClick={() => setActivePrincipalTool('smart-import')}
        >
          <span aria-hidden="true">
            <FileText size={20} strokeWidth={2.3} />
          </span>
          <strong>Smart Import (SF1)</strong>
          <small>Import School Form Here.</small>
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
        {studentsSuccess ? (
          <p className="form-message form-message-success">{studentsSuccess}</p>
        ) : null}

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
                      <td>{student.academicYear || 'Not assigned'}</td>
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
                  {selectedManualClassOption.assignment.academicYear || 'Academic year'}
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

        <section
          className={`content-card principal-tool-panel ${
            activePrincipalTool === 'smart-import' ? 'is-active' : ''
          }`}
        >
          <p className="content-card-tag">SF1 Smart Import Preview</p>
          <h3>Upload and preview an SF1 file</h3>
          <p className="supporting-text">
            Preview the file first to inspect row validity before running the confirm import step.
          </p>

          {previewMessage.error ? (
            <p className="form-message form-message-error">{previewMessage.error}</p>
          ) : null}
          {previewMessage.success ? (
            <p className="form-message form-message-success">{previewMessage.success}</p>
          ) : null}

          <div className="file-upload-block">
            <label className="field-group" htmlFor="sf1File">
              <span>SF1 Excel File</span>
              <input
                id="sf1File"
                type="file"
                accept=".xls,.xlsx"
                onChange={handleFileChange}
              />
            </label>

            <button
              type="button"
              className="secondary-button"
              onClick={handlePreviewSubmit}
              disabled={isPreviewLoading}
            >
              {isPreviewLoading ? 'Previewing...' : 'Preview'}
            </button>
          </div>

          {previewData ? (
            <>
              <div className="mini-stat-grid">
                <article className="mini-stat-card">
                  <span>Detected School Year</span>
                  <strong>{previewData.detectedSchoolYear || 'Not detected'}</strong>
                </article>
                <article className="mini-stat-card">
                  <span>Detected Section</span>
                  <strong>{previewData.detectedSectionName || 'Not detected'}</strong>
                </article>
              </div>

              <div className="mini-stat-grid">
                <article className="mini-stat-card">
                  <span>Total Rows</span>
                  <strong>{previewData.totalRows}</strong>
                </article>
                <article className="mini-stat-card">
                  <span>Valid Rows</span>
                  <strong>{previewData.validRows}</strong>
                </article>
                <article className="mini-stat-card">
                  <span>Invalid Rows</span>
                  <strong>{previewData.invalidRows}</strong>
                </article>
              </div>

              <div className="approval-table-wrap">
                <table className="approval-table preview-table">
                  <thead>
                    <tr>
                      <th>Row Number</th>
                      <th>Student LRN</th>
                      <th>First Name</th>
                      <th>Last Name</th>
                      <th>Gender</th>
                      <th>Status</th>
                      <th>Message</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!previewRows.length ? (
                      <tr>
                        <td className="approval-empty" colSpan="7">
                          No preview rows returned.
                        </td>
                      </tr>
                    ) : (
                      previewRows.map((row, index) => (
                        <tr key={`${row.rowNumber}-${row.studentLrn}-${index}`}>
                          <td>{row.rowNumber || '-'}</td>
                          <td>{row.studentLrn || '-'}</td>
                          <td>{row.firstName || '-'}</td>
                          <td>{row.lastName || '-'}</td>
                          <td>{row.gender || '-'}</td>
                          <td>
                            <span
                              className={`status-pill status-${String(row.status).toLowerCase()}`}
                            >
                              {formatStatus(row.status)}
                            </span>
                          </td>
                          <td>{row.message || '-'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </section>
      </div>

      <section
        className={`content-card principal-tool-panel principal-confirm-panel ${
          activePrincipalTool === 'smart-import' ? 'is-active' : ''
        }`}
      >
        <p className="content-card-tag">SF1 Confirm Import</p>
        <h3>Confirm import using the selected SF1 file</h3>
        <p className="supporting-text">
          Use the same file from the preview step. The detected section and school year from the
          uploaded SF1 file will be used automatically during confirm import.
        </p>

        {confirmMessage.error ? (
          <p className="form-message form-message-error">{confirmMessage.error}</p>
        ) : null}
        {confirmMessage.success ? (
          <p className="form-message form-message-success">{confirmMessage.success}</p>
        ) : null}

        <form className="form-grid confirm-form-grid" onSubmit={handleConfirmSubmit}>
          <div className="confirm-file-indicator">
            <span>Selected File</span>
            <strong>{selectedFile?.name || 'No file selected'}</strong>
          </div>

          <div className="confirm-file-indicator">
            <span>Detected School Year</span>
            <strong>{previewData?.detectedSchoolYear || 'Preview required'}</strong>
          </div>

          <div className="confirm-file-indicator">
            <span>Detected Section</span>
            <strong>{previewData?.detectedSectionName || 'Preview required'}</strong>
          </div>

          <div className="form-actions">
            <button type="submit" className="primary-button" disabled={isConfirmSubmitting}>
              {isConfirmSubmitting ? 'Confirming...' : 'Confirm Import'}
            </button>
          </div>
        </form>

        {confirmResult ? (
          <div className="mini-stat-grid">
            <article className="mini-stat-card">
              <span>Detected School Year</span>
              <strong>{confirmResult.detectedSchoolYear || 'Not detected'}</strong>
            </article>
            <article className="mini-stat-card">
              <span>Detected Section</span>
              <strong>{confirmResult.detectedSectionName || 'Not detected'}</strong>
            </article>
            <article className="mini-stat-card">
              <span>Imported Students</span>
              <strong>{confirmResult.importedStudents}</strong>
            </article>
            <article className="mini-stat-card">
              <span>Updated Students</span>
              <strong>{confirmResult.updatedStudents}</strong>
            </article>
            <article className="mini-stat-card">
              <span>Enrolled Students</span>
              <strong>{confirmResult.enrolledStudents}</strong>
            </article>
            <article className="mini-stat-card">
              <span>Skipped Rows</span>
              <strong>{confirmResult.skippedRows}</strong>
            </article>
          </div>
        ) : null}
      </section>
    </div>
  )
}

export default ClassRecordsPage

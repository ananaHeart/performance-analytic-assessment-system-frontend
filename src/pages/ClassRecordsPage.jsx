import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  Archive,
  AlertTriangle,
  BookOpen,
  ClipboardCheck,
  ClipboardList,
  FileText,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  X,
} from 'lucide-react'
import {
  archiveAssessmentV3,
  archiveClassAssignmentV3,
  createClassAssignmentV3,
  createClassV3,
  getClassAssignmentsV3,
  getClassesV3,
  getAssessmentReferenceDataV3,
  getAssessmentsV3,
  enrollStudentV3,
  getPrincipalClassStudentsV3,
  getSchoolSetupReferenceDataV3,
  getTeacherClassStudentsV3,
  updateStudentEnrollmentStatusV3,
  updateStudentProfileV3,
} from '../api/apiV3Client'
import V3Sf1ImportPanel from '../components/V3Sf1ImportPanel'

const initialAssignmentForm = {
  classId: '',
  subjectId: '',
  teacherId: '',
}

const MAX_BIRTH_DATE = new Date(Date.now() - 86400000).toISOString().slice(0, 10)

const initialManualStudentForm = {
  classId: '',
  studentLrn: '',
  firstName: '',
  middleName: '',
  lastName: '',
  suffixId: '',
  genderId: '',
  birthDate: '',
}

const initialStudentProfileForm = {
  firstName: '',
  middleName: '',
  lastName: '',
  suffixId: '',
  genderId: '',
  birthDate: '',
  reason: '',
}

const ENROLLMENT_STATUSES = ['enrolled', 'transferred', 'dropped', 'completed']

const initialClassForm = {
  gradeLevelId: '',
  sectionName: '',
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

function isActiveClassAssignment(assignment) {
  const status = String(assignment?.status ?? '').trim().toLowerCase()
  return !status || status === 'active'
}

function getAssignmentDeletePhrase(assignment) {
  const gradeLevel = assignment?.gradeLevelName || 'Grade level'
  const section = assignment?.sectionName || 'Section'
  const subject = assignment?.subjectName || 'Subject'

  return `DELETE CLASS ASSIGNMENT - ${gradeLevel} - ${section} - ${subject}`.toUpperCase()
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

function findReferenceIdByName(records, value, idKey, nameKey) {
  const match = records.find((record) => valuesMatch(record?.[nameKey], value))
  return match?.[idKey] ?? ''
}

function getStudentLifecycleErrorMessage(error, fallback) {
  const code = String(error?.code ?? '').trim().toUpperCase()

  if (code === 'STUDENT_ALREADY_ENROLLED') {
    return 'This learner is already enrolled in another class for the same academic year.'
  }

  if (code === 'STUDENT_PROFILE_REVIEW_REQUIRED') {
    return 'This LRN already exists, but the identity details do not match. The existing profile was not overwritten; use Edit Student Profile after reviewing the learner record.'
  }

  if (code === 'STUDENT_LRN_OWNED_BY_ANOTHER_SCHOOL') {
    return 'This LRN belongs to another school and cannot be enrolled here.'
  }

  if (code === 'STUDENT_ENROLLMENT_CONFLICT') {
    return 'The enrollment changed during this request. Refresh the roster and try again.'
  }

  const fieldMessages = Object.entries(error?.errors ?? {})
    .filter(([key, message]) => key !== 'code' && typeof message === 'string' && message.trim())
    .map(([field, message]) => `${formatStatus(field)}: ${message.trim()}`)

  return fieldMessages.join(' ') || error?.message || fallback
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

function getClassSubjectSummary(assignments) {
  const subjectNames = [
    ...new Set(
      assignments
        .map((assignment) => assignment.subjectName)
        .filter(Boolean),
    ),
  ]

  if (!subjectNames.length) {
    return 'No subject assigned'
  }

  return subjectNames.join(', ')
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

function getDisplayName(student) {
  const lastName = toTitleCase(student?.lastName)

  if (!lastName) {
    return toTitleCase(student?.name)
  }

  const givenNames = [toTitleCase(student?.firstName), toTitleCase(student?.middleName)]
    .filter(Boolean)
    .join(' ')

  return givenNames ? `${lastName}, ${givenNames}` : lastName
}

function getStudentLastNameSortKey(student) {
  return normalizeMatchText(student?.lastName || student?.name || '')
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

  if (normalizedStatus.includes('archived')) {
    return 'status-archived'
  }

  if (normalizedStatus.includes('active') || normalizedStatus.includes('complete')) {
    return 'status-active'
  }

  if (normalizedStatus.includes('draft')) {
    return 'status-warning'
  }

  return 'status-pending'
}

function isArchivedAssessment(assessment) {
  return String(assessment?.testStatus ?? assessment?.status ?? '').toLowerCase() === 'archived'
}

function studentBelongsToClass(student, assignment) {
  if (!student || !assignment) {
    return false
  }

  if (student.classId && assignment.classId) {
    return Number(student.classId) === Number(assignment.classId)
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
  initialClassAssignmentId = null,
  initialTeacherTab = 'assessment',
  principalSection = 'classes',
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
  const [assessments, setAssessments] = useState([])
  const [selectedClassAssignment, setSelectedClassAssignment] = useState(null)
  const [assignmentForm, setAssignmentForm] = useState(initialAssignmentForm)
  const [manualStudentForm, setManualStudentForm] = useState(initialManualStudentForm)
  const [studentGenders, setStudentGenders] = useState([])
  const [studentSuffixes, setStudentSuffixes] = useState([])
  const [principalRosterClassId, setPrincipalRosterClassId] = useState('')
  const [principalRosterStatus, setPrincipalRosterStatus] = useState('enrolled')
  const [studentPendingEdit, setStudentPendingEdit] = useState(null)
  const [studentProfileForm, setStudentProfileForm] = useState(initialStudentProfileForm)
  const [studentProfileError, setStudentProfileError] = useState('')
  const [isStudentProfileSaving, setIsStudentProfileSaving] = useState(false)
  const [studentPendingStatus, setStudentPendingStatus] = useState(null)
  const [studentNextStatus, setStudentNextStatus] = useState('')
  const [studentStatusReason, setStudentStatusReason] = useState('')
  const [studentStatusError, setStudentStatusError] = useState('')
  const [isStudentStatusSaving, setIsStudentStatusSaving] = useState(false)
  const activeTeacherTab = initialTeacherTab === 'students' ? initialTeacherTab : 'assessment'
  const [selectedStudentClassFilter, setSelectedStudentClassFilter] = useState('')
  const [studentNameSearch, setStudentNameSearch] = useState('')
  const [selectedStudentInfo, setSelectedStudentInfo] = useState(null)
  const [activePrincipalTool, setActivePrincipalTool] = useState(null)
  const [schoolReferenceError, setSchoolReferenceError] = useState('')
  const [studentsError, setStudentsError] = useState('')
  const [assessmentsError, setAssessmentsError] = useState('')
  const [studentsSuccess, setStudentsSuccess] = useState('')
  const [assignmentMessage, setAssignmentMessage] = useState({ error: '', success: '' })
  const [assignmentPendingCreation, setAssignmentPendingCreation] = useState(null)
  const [assignmentCreateError, setAssignmentCreateError] = useState('')
  const [assignmentPendingEdit, setAssignmentPendingEdit] = useState(null)
  const [assignmentEditForm, setAssignmentEditForm] = useState(initialAssignmentForm)
  const [assignmentEditSections, setAssignmentEditSections] = useState([])
  const [assignmentEditError, setAssignmentEditError] = useState('')
  const [assignmentPendingDeletion, setAssignmentPendingDeletion] = useState(null)
  const [assignmentDeleteConfirmation, setAssignmentDeleteConfirmation] = useState('')
  const [assignmentArchiveReason, setAssignmentArchiveReason] = useState('')
  const [assignmentDeleteError, setAssignmentDeleteError] = useState('')
  const [classForm, setClassForm] = useState(initialClassForm)
  const [isClassDialogOpen, setIsClassDialogOpen] = useState(false)
  const [classCreateError, setClassCreateError] = useState('')
  const [isClassCreating, setIsClassCreating] = useState(false)
  const [manualMessage, setManualMessage] = useState({ error: '', success: '' })
  const [isStudentsLoading, setIsStudentsLoading] = useState(true)
  const [isAssessmentsLoading, setIsAssessmentsLoading] = useState(true)
  const [archivingAssessmentId, setArchivingAssessmentId] = useState(null)
  const [isSectionsLoading, setIsSectionsLoading] = useState(true)
  const [isAssignmentSubmitting, setIsAssignmentSubmitting] = useState(false)
  const isAssignmentUpdating = false
  const [isAssignmentEditSectionsLoading, setIsAssignmentEditSectionsLoading] = useState(false)
  const [isAssignmentDeleting, setIsAssignmentDeleting] = useState(false)
  const [isManualSubmitting, setIsManualSubmitting] = useState(false)
  const activeClassAssignments = useMemo(
    () => classAssignments.filter(isActiveClassAssignment),
    [classAssignments],
  )
  const hasInitialTeacherClassSelection = Boolean(initialClassAssignmentId || initialClassId)
  const assignmentDeletePhrase = assignmentPendingDeletion
    ? getAssignmentDeletePhrase(assignmentPendingDeletion)
    : ''
  const canDeleteAssignment =
    Boolean(assignmentDeletePhrase) &&
    assignmentDeleteConfirmation === assignmentDeletePhrase &&
    assignmentArchiveReason.trim().length >= 5 &&
    assignmentArchiveReason.trim().length <= 255

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
  const assignmentClassOptions = useMemo(
    () =>
      sections
        .filter(
          (section) =>
            !selectedAcademicYearId ||
            String(section.academicYearId) === String(selectedAcademicYearId),
        )
        .map((section) => ({
          classId: section.classId,
          gradeLevelName: section.gradeLevelName,
          sectionName: section.sectionName,
          label: getClassDisplayLabel(section),
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [sections, selectedAcademicYearId],
  )
  const selectedAssignmentClass = useMemo(
    () =>
      assignmentClassOptions.find(
        (option) => String(option.classId) === String(assignmentForm.classId),
      ) ?? null,
    [assignmentClassOptions, assignmentForm.classId],
  )
  const selectedAcademicYear = useMemo(
    () =>
      academicYears.find(
        (academicYear) => String(academicYear.id) === String(selectedAcademicYearId),
      ) ?? null,
    [academicYears, selectedAcademicYearId],
  )
  const selectedTeacherAssignments = useMemo(
    () =>
      assignmentForm.teacherId
        ? activeClassAssignments.filter(
            (assignment) =>
              String(assignment.teacherId) === String(assignmentForm.teacherId) &&
              String(assignment.academicYearId) === String(selectedAcademicYearId),
          )
        : [],
    [activeClassAssignments, assignmentForm.teacherId, selectedAcademicYearId],
  )
  const duplicateClassAssignment = useMemo(
    () =>
      assignmentForm.teacherId && assignmentForm.subjectId && assignmentForm.classId
        ? activeClassAssignments.find(
            (assignment) =>
              String(assignment.teacherId) === String(assignmentForm.teacherId) &&
              String(assignment.subjectId) === String(assignmentForm.subjectId) &&
              String(assignment.classId) === String(assignmentForm.classId) &&
              String(assignment.academicYearId) === String(selectedAcademicYearId),
          ) ?? null
        : null,
    [activeClassAssignments, assignmentForm, selectedAcademicYearId],
  )
  const formatAcademicYear = (value, fallback = 'Academic Year') =>
    formatAcademicYearLabel(value, fallback, academicYears)
  const selectedAcademicYearLabel =
    formatAcademicYear(
      selectedAcademicYear,
      'No academic year selected',
    )
  const selectedAssignmentEditGradeLevel = useMemo(
    () =>
      assignmentGradeOptions.find(
        (gradeLevel) => String(gradeLevel.id) === String(assignmentEditForm.gradeLevelId),
      ) ?? null,
    [assignmentEditForm.gradeLevelId, assignmentGradeOptions],
  )
  const assignmentEditSectionOptions = useMemo(() => {
    if (!selectedAssignmentEditGradeLevel) return []

    return assignmentEditSections.filter((section) => {
      const hasGradeMetadata =
        (section.gradeLevelId !== null && section.gradeLevelId !== undefined) ||
        Boolean(section.gradeLevelName)

      return hasGradeMetadata
        ? sectionMatchesGrade(section, selectedAssignmentEditGradeLevel)
        : true
    })
  }, [assignmentEditSections, selectedAssignmentEditGradeLevel])
  const duplicateEditedAssignment = useMemo(() => {
    if (
      !assignmentPendingEdit ||
      !assignmentEditForm.teacherId ||
      !assignmentEditForm.subjectId ||
      !assignmentEditForm.classId
    ) {
      return null
    }

    const editingId = assignmentPendingEdit.classAssignmentId ?? assignmentPendingEdit.id
    return activeClassAssignments.find((assignment) => {
      const assignmentId = assignment.classAssignmentId ?? assignment.id
      return (
        String(assignmentId) !== String(editingId) &&
        String(assignment.teacherId) === String(assignmentEditForm.teacherId) &&
        String(assignment.subjectId) === String(assignmentEditForm.subjectId) &&
        String(assignment.classId) === String(assignmentEditForm.classId)
      )
    }) ?? null
  }, [activeClassAssignments, assignmentEditForm, assignmentPendingEdit])
  const hasAssignmentEditChanges = Boolean(
    assignmentPendingEdit &&
      (String(assignmentEditForm.teacherId) !== String(assignmentPendingEdit.teacherId) ||
        String(assignmentEditForm.subjectId) !== String(assignmentPendingEdit.subjectId) ||
        String(assignmentEditForm.classId) !== String(assignmentPendingEdit.classId)),
  )
  const principalRosterClassOptions = useMemo(
    () =>
      sectionOptions
        .filter(
          (classRecord) =>
            !selectedAcademicYearId ||
            !classRecord.academicYearId ||
            String(classRecord.academicYearId) === String(selectedAcademicYearId),
        )
        .sort((left, right) => {
          const leftLabel = `${left.gradeLevelName ?? ''} ${left.sectionName ?? left.name ?? ''}`
          const rightLabel = `${right.gradeLevelName ?? ''} ${right.sectionName ?? right.name ?? ''}`
          return leftLabel.localeCompare(rightLabel)
        }),
    [sectionOptions, selectedAcademicYearId],
  )
  const selectedClassStudents = useMemo(
    () => students.filter((student) => studentBelongsToClass(student, selectedClassAssignment)),
    [students, selectedClassAssignment],
  )
  const teacherClassOptions = useMemo(() => {
    const optionMap = new Map()

    activeClassAssignments.forEach((assignment) => {
      const key = getClassSectionKey(assignment)

      if (!optionMap.has(key)) {
        optionMap.set(key, {
          key,
          label: getClassDisplayLabel(assignment),
          primaryAssignment: assignment,
          assignment,
          assignments: [assignment],
        })
        return
      }

      optionMap.get(key).assignments.push(assignment)
    })

    return Array.from(optionMap.values())
  }, [activeClassAssignments])
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

    const searchFilteredStudents = searchText
      ? classFilteredStudents.filter((student) =>
          normalizeMatchText(student.name).includes(searchText),
        )
      : classFilteredStudents

    return [...searchFilteredStudents].sort((left, right) =>
      getStudentLastNameSortKey(left).localeCompare(getStudentLastNameSortKey(right)),
    )
  }, [selectedStudentClassAssignment, studentNameSearch, teacherAssignedStudents])
  const sortedPrincipalRosterStudents = useMemo(
    () =>
      [...students].sort((left, right) =>
        getStudentLastNameSortKey(left).localeCompare(getStudentLastNameSortKey(right)),
      ),
    [students],
  )
  const selectedClassGroupAssignments = useMemo(() => {
    if (!selectedClassAssignment) {
      return []
    }

    const selectedGroupKey = getClassSectionKey(selectedClassAssignment)

    return activeClassAssignments.filter(
      (assignment) => getClassSectionKey(assignment) === selectedGroupKey,
    )
  }, [activeClassAssignments, selectedClassAssignment])
  const selectedClassAssessments = useMemo(
    () =>
      assessments.filter(
        (assessment) =>
          Number(assessment.classAssignmentId) ===
            Number(selectedClassAssignment?.classAssignmentId) &&
          !isArchivedAssessment(assessment),
      ),
    [assessments, selectedClassAssignment?.classAssignmentId],
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

  const loadStudents = async ({
    preserveMessage = false,
    classId = principalRosterClassId,
    enrollmentStatus = principalRosterStatus,
  } = {}) => {
    setIsStudentsLoading(true)
    setStudentsError('')

    if (!preserveMessage) {
      setStudentsSuccess('')
    }

    try {
      if (role === 'teacher') {
        if (!selectedClassAssignment?.classId) {
          setStudents([])
          return
        }

        const studentRecords = await getTeacherClassStudentsV3(
          selectedClassAssignment.classId,
          token,
        )
        setStudents(studentRecords)
        return
      }

      if (!classId) {
        setStudents([])
        return
      }

      const classRecord = sectionOptions.find(
        (option) => String(option.classId) === String(classId),
      )
      const studentRecords = await getPrincipalClassStudentsV3(
        classId,
        token,
        enrollmentStatus,
      )
      setStudents(
        studentRecords.map((student) => ({
          ...student,
          sectionId: classRecord?.sectionId,
          section: classRecord?.sectionName,
          sectionName: classRecord?.sectionName,
          gradeLevel: classRecord?.gradeLevelName,
          gradeLevelName: classRecord?.gradeLevelName,
          academicYearId: classRecord?.academicYearId,
          academicYear: classRecord?.academicYearName,
        })),
      )
    } catch (loadError) {
      setStudentsError(loadError.message || 'Unable to load student records.')
    } finally {
      setIsStudentsLoading(false)
    }
  }

  const loadSections = async () => {
    setIsSectionsLoading(true)

    if (role === 'teacher') {
      try {
        const referenceData = await getAssessmentReferenceDataV3({}, token)
        const nextTeacherAssignments = (referenceData.classAssignments ?? [])
          .map((assignment) => ({
            id: assignment.classAssignmentId,
            classAssignmentId: assignment.classAssignmentId,
            classId: assignment.classId,
            academicYearId: assignment.academicYearId,
            academicYear: assignment.yearName ?? '',
            gradeLevelId: assignment.gradeLevelId,
            gradeLevelName: assignment.gradeLevelName ?? '',
            sectionId: assignment.sectionId,
            sectionName: assignment.sectionName ?? '',
            teacherId,
            teacherName: user?.name ?? 'Teacher',
            subjectId: assignment.subjectId,
            subjectName: assignment.subjectName ?? '',
            assignmentRole: assignment.assignmentRole ?? '',
            status: assignment.status ?? 'active',
          }))
          .filter(isActiveClassAssignment)

        const academicYearMap = new Map()
        nextTeacherAssignments.forEach((assignment) => {
          if (
            assignment.academicYearId &&
            !academicYearMap.has(String(assignment.academicYearId))
          ) {
            academicYearMap.set(String(assignment.academicYearId), {
              id: assignment.academicYearId,
              name: assignment.academicYear,
              isActive: true,
            })
          }
        })
        const teacherAcademicYears = Array.from(academicYearMap.values())

        setClassAssignments(nextTeacherAssignments)
        setAcademicYears(teacherAcademicYears)
        setSelectedAcademicYearId(
          teacherAcademicYears[0]?.id ? String(teacherAcademicYears[0].id) : '',
        )
        setSections(
          nextTeacherAssignments.map((assignment) => ({
            id: assignment.sectionId,
            name: assignment.sectionName,
            gradeLevelId: assignment.gradeLevelId,
            gradeLevelName: assignment.gradeLevelName,
          })),
        )
        const initialTeacherAssignment =
          hasInitialTeacherClassSelection
            ? nextTeacherAssignments.find(
                (assignment) =>
                  Number(assignment.classAssignmentId) === Number(initialClassAssignmentId),
              ) ??
              nextTeacherAssignments.find(
                (assignment) => Number(assignment.classId) === Number(initialClassId),
              ) ??
              null
            : null

        setSelectedClassAssignment(initialTeacherAssignment)
      } catch (loadError) {
        setClassAssignments([])
        setSelectedClassAssignment(null)
        setStudentsError(loadError.message || 'Unable to load assigned classes.')
      } finally {
        setIsSectionsLoading(false)
      }
      return
    }

    setSchoolReferenceError('')
    setAssignmentMessage((currentMessage) => ({ ...currentMessage, error: '' }))

    try {
      const [referenceResult, classResult] = await Promise.allSettled([
        getSchoolSetupReferenceDataV3(token),
        getClassesV3({}, token),
      ])

      if (referenceResult.status === 'rejected') {
        throw referenceResult.reason
      }

      const referenceData = referenceResult.value

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
      const activeClassRecords =
        classResult.status === 'fulfilled'
          ? classResult.value
              .filter((classRecord) => String(classRecord.status ?? '').toLowerCase() === 'active')
              .map(normalizeAvailableClassOption)
          : []
      const defaultClass =
        activeClassRecords.find(
          (classRecord) => String(classRecord.classId) === String(initialClassId),
        ) ??
        activeClassRecords.find(
          (classRecord) =>
            !defaultAcademicYear?.id ||
            String(classRecord.academicYearId) === String(defaultAcademicYear.id),
        ) ??
        activeClassRecords[0] ??
        null

      if (!gradeLevelRecords.length) {
        throw new Error('School reference data did not return any grade levels.')
      }

      setSchoolTeachers(referenceData.teachers ?? [])
      setSubjects(subjectRecords)
      setSchoolGradeLevels(gradeLevelRecords)
      setStudentGenders(referenceData.genders ?? [])
      setStudentSuffixes(referenceData.suffixes ?? [])
      setAcademicYears(academicYearRecords)
      setSections(activeClassRecords)
      setPrincipalRosterClassId((currentClassId) =>
        activeClassRecords.some(
          (classRecord) => String(classRecord.classId) === String(currentClassId),
        )
          ? currentClassId
          : defaultClass?.classId
            ? String(defaultClass.classId)
            : '',
      )
      setManualStudentForm((currentForm) => ({
        ...currentForm,
        classId: activeClassRecords.some(
          (classRecord) => String(classRecord.classId) === String(currentForm.classId),
        )
          ? currentForm.classId
          : defaultClass?.classId
            ? String(defaultClass.classId)
            : '',
      }))
      setSelectedAcademicYearId((currentAcademicYearId) =>
        academicYearRecords.some(
          (academicYear) => String(academicYear.id) === String(currentAcademicYearId),
        )
          ? currentAcademicYearId
          : defaultAcademicYear?.id
            ? String(defaultAcademicYear.id)
            : '',
      )

      if (classResult.status === 'rejected' && !classResult.reason?.isAuthenticationFailure) {
        setAssignmentMessage({
          error: classResult.reason?.message || 'Unable to load active classes.',
          success: '',
        })
      }
    } catch (loadError) {
      setSections([])
      setSchoolTeachers([])
      setSubjects([])
      setSchoolGradeLevels([])
      setStudentGenders([])
      setStudentSuffixes([])
      setAcademicYears([])
      setSelectedAcademicYearId('')
      setPrincipalRosterClassId('')
      setSchoolReferenceError(
        loadError.message || 'Unable to load school setup reference data.',
      )
      setAssignmentMessage({
        error: loadError.message || 'Unable to load school setup reference data.',
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
      const assignments = (await getClassAssignmentsV3(token, selectedAcademicYearId)).filter(
        isActiveClassAssignment,
      )
      const nextTeacherAssignments =
        role === 'teacher'
          ? assignments.filter((assignment) => Number(assignment.teacherId) === Number(teacherId))
          : assignments
      setClassAssignments(nextTeacherAssignments)
      setSelectedClassAssignment((currentAssignment) =>
        nextTeacherAssignments.find(
          (assignment) =>
            Number(assignment.classAssignmentId) ===
            Number(currentAssignment?.classAssignmentId),
        ) ??
        nextTeacherAssignments.find(
          (assignment) =>
            Number(assignment.classAssignmentId) === Number(initialClassAssignmentId),
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
        error: loadError.message || 'Unable to load class assignments.',
        success: '',
      })
    }
  }

  const loadTeacherAssessments = async () => {
    const classAssignmentId = selectedClassAssignment?.classAssignmentId

    if (role !== 'teacher' || !teacherId || !classAssignmentId) {
      setAssessments([])
      setAssessmentsError('')
      setIsAssessmentsLoading(false)
      return
    }

    setIsAssessmentsLoading(true)
    setAssessmentsError('')

    try {
      const assessmentRecords = await getAssessmentsV3(token, classAssignmentId)
      setAssessments(
        assessmentRecords.map((assessment) => ({
          ...assessment,
          testStatus: assessment.testStatus || assessment.status || 'draft',
        })),
      )
    } catch (loadError) {
      setAssessments([])
      setAssessmentsError(loadError.message || 'Unable to load assessments.')
    } finally {
      setIsAssessmentsLoading(false)
    }
  }

  const handleArchiveAssessment = async (event, assessment) => {
    event.stopPropagation()

    if (!assessment?.id || archivingAssessmentId) return

    const confirmed = window.confirm(
      `Archive "${assessment.testName || 'this assessment'}"? It will be hidden from this class's ` +
        'assessment list and moved to Archived Assessments in your profile, where you can restore it.',
    )
    if (!confirmed) return

    setArchivingAssessmentId(assessment.id)
    setAssessmentsError('')

    try {
      await archiveAssessmentV3(assessment.id, token)
      await loadTeacherAssessments()
    } catch (archiveError) {
      setAssessmentsError(archiveError.message || 'Unable to archive this assessment.')
    } finally {
      setArchivingAssessmentId(null)
    }
  }

  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  useEffect(() => {
    loadSections()

  }, [])

  useEffect(() => {
    if (role !== 'teacher') return

    if (!hasInitialTeacherClassSelection) {
      setSelectedClassAssignment(null)
      return
    }

    setSelectedClassAssignment(
      classAssignments.find(
        (assignment) =>
          Number(assignment.classAssignmentId) === Number(initialClassAssignmentId),
      ) ??
        classAssignments.find(
          (assignment) => Number(assignment.classId) === Number(initialClassId),
        ) ??
        null,
    )
  }, [
    role,
    classAssignments,
    hasInitialTeacherClassSelection,
    initialClassAssignmentId,
    initialClassId,
  ])

  useEffect(() => {
    if (role === 'principal' && principalRosterClassId) {
      loadStudents()
    }
  }, [role, principalRosterClassId, principalRosterStatus])

  useEffect(() => {
    if (role !== 'principal' || isSectionsLoading) return

    const fallbackClassId = principalRosterClassOptions[0]?.classId
      ? String(principalRosterClassOptions[0].classId)
      : ''

    if (
      !principalRosterClassOptions.some(
        (classRecord) => String(classRecord.classId) === String(principalRosterClassId),
      )
    ) {
      setPrincipalRosterClassId(fallbackClassId)
    }

    if (!fallbackClassId) {
      setStudents([])
      setIsStudentsLoading(false)
    }

    setManualStudentForm((currentForm) =>
      principalRosterClassOptions.some(
        (classRecord) => String(classRecord.classId) === String(currentForm.classId),
      )
        ? currentForm
        : { ...currentForm, classId: fallbackClassId },
    )
  }, [role, isSectionsLoading, principalRosterClassOptions, principalRosterClassId])

  useEffect(() => {
    if (role === 'teacher') {
      loadTeacherAssessments()
    }
  }, [role, selectedClassAssignment?.classAssignmentId])

  useEffect(() => {
    if (role === 'principal' && selectedAcademicYearId) {
      loadTeacherClasses()
    }
  }, [role, selectedAcademicYearId])

  useEffect(() => {
    if (role === 'teacher' && selectedClassAssignment?.classId) {
      loadStudents()
    }
  }, [role, selectedClassAssignment?.classId])

  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  const handleManualStudentChange = (event) => {
    const { name, value } = event.target
    const nextValue = name === 'studentLrn' ? value.replace(/\D/g, '').slice(0, 12) : value

    setManualMessage({ error: '', success: '' })
    setManualStudentForm((currentForm) => ({ ...currentForm, [name]: nextValue }))
  }

  const handleAssignmentFormChange = (event) => {
    const { name, value } = event.target
    setAssignmentMessage({ error: '', success: '' })
    setAssignmentForm((currentForm) => ({
      ...currentForm,
      [name]: value,
      ...(name === 'classId' ? { subjectId: '', teacherId: '' } : {}),
      ...(name === 'subjectId' ? { teacherId: '' } : {}),
    }))
  }

  const handleAssignmentSubmit = (event) => {
    event.preventDefault()
    setAssignmentMessage({ error: '', success: '' })

    if (
      !assignmentForm.classId ||
      !assignmentForm.subjectId ||
      !assignmentForm.teacherId ||
      !selectedAcademicYearId
    ) {
      setAssignmentMessage({
        error: 'Select class, subject, teacher, and academic year before assigning.',
        success: '',
      })
      return
    }

    if (duplicateClassAssignment) {
      setAssignmentMessage({
        error: `${duplicateClassAssignment.teacherName || 'This teacher'} is already assigned to ${duplicateClassAssignment.gradeLevelName || 'this grade level'} - ${duplicateClassAssignment.sectionName || 'this section'} for ${duplicateClassAssignment.subjectName || 'this subject'}. Select a different subject or class.`,
        success: '',
      })
      return
    }

    const selectedTeacher = schoolTeachers.find(
      (teacher) => String(teacher.userId ?? teacher.id) === String(assignmentForm.teacherId),
    )
    const selectedSubject = subjects.find(
      (subject) => String(subject.id) === String(assignmentForm.subjectId),
    )

    setAssignmentCreateError('')
    setAssignmentPendingCreation({
      payload: {
        classId: Number(assignmentForm.classId),
        teacherUserId: Number(assignmentForm.teacherId),
        subjectId: Number(assignmentForm.subjectId),
        assignmentRole: 'primary',
      },
      teacherName: selectedTeacher?.name || 'Selected teacher',
      subjectName: selectedSubject?.name || 'Selected subject',
      gradeLevelName: selectedAssignmentClass?.gradeLevelName || 'Selected grade level',
      sectionName: selectedAssignmentClass?.sectionName || 'Selected section',
      academicYear: selectedAcademicYearLabel,
    })
  }

  const closeAssignmentCreateDialog = () => {
    if (isAssignmentSubmitting) return

    setAssignmentPendingCreation(null)
    setAssignmentCreateError('')
  }

  const handleAssignmentConfirm = async (event) => {
    event.preventDefault()

    if (!assignmentPendingCreation?.payload) return

    setIsAssignmentSubmitting(true)
    setAssignmentCreateError('')

    try {
      await createClassAssignmentV3(assignmentPendingCreation.payload, token)
      setAssignmentPendingCreation(null)
      setAssignmentForm(initialAssignmentForm)
      setAssignmentMessage({ error: '', success: 'Teacher assigned to class successfully.' })
      await loadTeacherClasses()
    } catch (submitError) {
      setAssignmentCreateError(
        submitError.message || 'Unable to assign teacher to this class.',
      )
    } finally {
      setIsAssignmentSubmitting(false)
    }
  }

  const openClassCreateDialog = () => {
    setClassForm(initialClassForm)
    setClassCreateError('')
    setIsClassDialogOpen(true)
  }

  const closeClassCreateDialog = () => {
    if (isClassCreating) return

    setIsClassDialogOpen(false)
    setClassForm(initialClassForm)
    setClassCreateError('')
  }

  const handleClassCreate = async (event) => {
    event.preventDefault()
    const sectionName = classForm.sectionName.trim()

    if (!selectedAcademicYearId || !classForm.gradeLevelId || !sectionName) {
      setClassCreateError('Select an academic year and grade level, then enter a section name.')
      return
    }

    if (sectionName.length > 50) {
      setClassCreateError('Section name must not exceed 50 characters.')
      return
    }

    setIsClassCreating(true)
    setClassCreateError('')

    try {
      const classRecord = await createClassV3(
        {
          academicYearId: Number(selectedAcademicYearId),
          gradeLevelId: Number(classForm.gradeLevelId),
          sectionName,
        },
        token,
      )
      setAssignmentMessage({
        error: '',
        success: classRecord.created
          ? `${classRecord.gradeLevelName} - ${classRecord.sectionName} created successfully.`
          : `${classRecord.gradeLevelName} - ${classRecord.sectionName} already exists and is ready to use.`,
      })
      setIsClassDialogOpen(false)
      setClassForm(initialClassForm)
      await loadSections()
    } catch (createError) {
      setClassCreateError(createError.message || 'Unable to create this class.')
    } finally {
      setIsClassCreating(false)
    }
  }

  const loadAssignmentEditSections = async (assignment, subjectId, gradeLevelId) => {
    setAssignmentEditSections([])

    if (!assignment || !subjectId || !gradeLevelId) return

    setIsAssignmentEditSectionsLoading(true)
    try {
      const classRecords = await getClassesV3(
        {
          academicYearId: assignment.academicYearId ?? selectedAcademicYearId,
          gradeLevelId,
        },
        token,
      )
      const nextSections = classRecords
        .map(normalizeAvailableClassOption)
        .filter((classRecord) => classRecord.classId !== null && classRecord.classId !== undefined)

      const editingSameSubjectAndGrade =
        String(subjectId) === String(assignment.subjectId) &&
        String(gradeLevelId) === String(assignment.gradeLevelId)
      if (
        editingSameSubjectAndGrade &&
        !nextSections.some((section) => String(section.classId) === String(assignment.classId))
      ) {
        nextSections.push(
          normalizeAvailableClassOption({
            classId: assignment.classId,
            sectionId: assignment.sectionId,
            sectionName: assignment.sectionName,
            gradeLevelId: assignment.gradeLevelId,
            gradeLevelName: assignment.gradeLevelName,
            subjectId: assignment.subjectId,
          }),
        )
      }

      setAssignmentEditSections(nextSections)
    } catch (loadError) {
      setAssignmentEditError(loadError.message || 'Unable to load available classes for editing.')
    } finally {
      setIsAssignmentEditSectionsLoading(false)
    }
  }

  const openAssignmentEditDialog = (assignment) => {
    const nextForm = {
      teacherId: String(assignment.teacherId ?? ''),
      subjectId: String(assignment.subjectId ?? ''),
      gradeLevelId: String(assignment.gradeLevelId ?? ''),
      classId: String(assignment.classId ?? ''),
    }

    setAssignmentPendingEdit(assignment)
    setAssignmentEditForm(nextForm)
    setAssignmentEditError('')
    setAssignmentMessage({ error: '', success: '' })
    loadAssignmentEditSections(assignment, nextForm.subjectId, nextForm.gradeLevelId)
  }

  const closeAssignmentEditDialog = () => {
    if (isAssignmentUpdating) return

    setAssignmentPendingEdit(null)
    setAssignmentEditForm(initialAssignmentForm)
    setAssignmentEditSections([])
    setAssignmentEditError('')
  }

  const handleAssignmentEditFormChange = (event) => {
    const { name, value } = event.target
    setAssignmentEditError('')

    if (name === 'subjectId') {
      setAssignmentEditForm((currentForm) => ({
        ...currentForm,
        subjectId: value,
        gradeLevelId: '',
        classId: '',
      }))
      setAssignmentEditSections([])
      return
    }

    if (name === 'gradeLevelId') {
      setAssignmentEditForm((currentForm) => ({
        ...currentForm,
        gradeLevelId: value,
        classId: '',
      }))
      loadAssignmentEditSections(assignmentPendingEdit, assignmentEditForm.subjectId, value)
      return
    }

    setAssignmentEditForm((currentForm) => ({ ...currentForm, [name]: value }))
  }

  const handleAssignmentUpdate = async (event) => {
    event.preventDefault()
    setAssignmentEditError(
      'Active assignments cannot be edited. Archive it with a reason, then create the corrected assignment.',
    )
  }

  const openAssignmentDeleteDialog = (assignment) => {
    setAssignmentPendingDeletion(assignment)
    setAssignmentDeleteConfirmation('')
    setAssignmentArchiveReason('')
    setAssignmentDeleteError('')
    setAssignmentMessage({ error: '', success: '' })
  }

  const closeAssignmentDeleteDialog = () => {
    if (isAssignmentDeleting) return

    setAssignmentPendingDeletion(null)
    setAssignmentDeleteConfirmation('')
    setAssignmentArchiveReason('')
    setAssignmentDeleteError('')
  }

  const handleAssignmentDelete = async (event) => {
    event.preventDefault()

    const classAssignmentId =
      assignmentPendingDeletion?.classAssignmentId ?? assignmentPendingDeletion?.id

    if (!classAssignmentId || !canDeleteAssignment) return

    setIsAssignmentDeleting(true)
    setAssignmentDeleteError('')
    setAssignmentMessage({ error: '', success: '' })

    try {
      await archiveClassAssignmentV3(
        classAssignmentId,
        assignmentArchiveReason.trim(),
        token,
      )
      setAssignmentPendingDeletion(null)
      setAssignmentDeleteConfirmation('')
      setAssignmentArchiveReason('')
      setAssignmentDeleteError('')
      setAssignmentMessage({
        error: '',
        success: 'Class assignment archived successfully.',
      })
      await loadTeacherClasses()
    } catch (deleteError) {
      setAssignmentDeleteError(
        deleteError.message || 'Unable to archive this class assignment.',
      )
    } finally {
      setIsAssignmentDeleting(false)
    }
  }

  const handleSf1Imported = async (summary) => {
    const outcome = summary?.replayed
      ? 'The previous SF1 confirmation result was replayed safely.'
      : `${summary?.createdStudents ?? 0} student(s) created, ${summary?.unchangedStudents ?? 0} unchanged, and ${summary?.conflictRows ?? 0} conflict row(s).`
    setStudentsSuccess(outcome)
    setActivePrincipalTool(null)
    await Promise.all([loadSections(), loadStudents(), loadTeacherClasses()])
  }

  const handlePrincipalRefresh = async () => {
    await Promise.all([loadSections(), loadStudents(), loadTeacherClasses()])
  }

  const openManualStudentPanel = () => {
    setManualMessage({ error: '', success: '' })
    setManualStudentForm((currentForm) => ({
      ...currentForm,
      classId: principalRosterClassId || currentForm.classId,
    }))
    setActivePrincipalTool('manual')
  }

  const closeManualStudentPanel = () => {
    if (isManualSubmitting) return
    setActivePrincipalTool(null)
    setManualMessage({ error: '', success: '' })
  }

  const openStudentProfileDialog = (student) => {
    setStudentPendingEdit(student)
    setStudentProfileForm({
      firstName: student.firstName ?? '',
      middleName: student.middleName ?? '',
      lastName: student.lastName ?? '',
      suffixId: findReferenceIdByName(
        studentSuffixes,
        student.suffixName,
        'suffixId',
        'suffixName',
      ),
      genderId: findReferenceIdByName(
        studentGenders,
        student.gender,
        'genderId',
        'genderName',
      ),
      birthDate: student.birthDate ?? '',
      reason: '',
    })
    setStudentProfileError('')
  }

  const closeStudentProfileDialog = (force = false) => {
    if (isStudentProfileSaving && !force) return
    setStudentPendingEdit(null)
    setStudentProfileForm(initialStudentProfileForm)
    setStudentProfileError('')
  }

  const handleStudentProfileChange = (event) => {
    const { name, value } = event.target
    setStudentProfileError('')
    setStudentProfileForm((currentForm) => ({ ...currentForm, [name]: value }))
  }

  const openStudentStatusDialog = (student) => {
    const currentStatus = String(student.enrollmentStatus ?? 'enrolled').toLowerCase()
    setStudentPendingStatus(student)
    setStudentNextStatus(currentStatus === 'enrolled' ? 'transferred' : 'enrolled')
    setStudentStatusReason('')
    setStudentStatusError('')
  }

  const closeStudentStatusDialog = (force = false) => {
    if (isStudentStatusSaving && !force) return
    setStudentPendingStatus(null)
    setStudentNextStatus('')
    setStudentStatusReason('')
    setStudentStatusError('')
  }

  const handleTeacherSubjectChange = (event) => {
    const nextClassAssignmentId = Number(event.target.value)

    setSelectedClassAssignment(
      classAssignments.find(
        (assignment) => Number(assignment.classAssignmentId) === nextClassAssignmentId,
      ) ?? null,
    )
  }

  const handleTeacherClassSelect = (assignment) => {
    if (!assignment) return

    setSelectedClassAssignment(assignment)
    onNavigate('class-records', {
      classId: assignment.classId,
      classAssignmentId: assignment.classAssignmentId,
      initialTab: 'assessment',
    })
  }


  const handleManualSubmit = async (event) => {
    event.preventDefault()
    setManualMessage({ error: '', success: '' })
    setStudentsSuccess('')

    if (!manualStudentForm.classId) {
      setManualMessage({ error: 'Select the class that will receive this learner.', success: '' })
      return
    }

    if (!/^\d{12}$/.test(manualStudentForm.studentLrn)) {
      setManualMessage({
        error: 'LRN must contain exactly 12 numeric digits.',
        success: '',
      })
      return
    }

    if (
      !manualStudentForm.firstName.trim() ||
      !manualStudentForm.lastName.trim() ||
      !manualStudentForm.genderId
    ) {
      setManualMessage({
        error: 'First name, last name, and gender are required.',
        success: '',
      })
      return
    }

    setIsManualSubmitting(true)

    try {
      const result = await enrollStudentV3(
        manualStudentForm.classId,
        {
          studentLrn: manualStudentForm.studentLrn,
          firstName: manualStudentForm.firstName.trim(),
          middleName: manualStudentForm.middleName.trim() || null,
          lastName: manualStudentForm.lastName.trim(),
          suffixId: manualStudentForm.suffixId ? Number(manualStudentForm.suffixId) : null,
          genderId: Number(manualStudentForm.genderId),
          birthDate: manualStudentForm.birthDate || null,
        },
        token,
      )
      const successMessage = result.enrollmentReactivated
        ? 'The existing learner enrollment was reactivated.'
        : result.enrollmentCreated
          ? result.studentCreated
            ? 'Student profile created and enrolled successfully.'
            : 'Existing student enrolled in this class successfully.'
          : 'This student is already enrolled in the selected class.'

      setManualMessage({ error: '', success: successMessage })
      setManualStudentForm({
        ...initialManualStudentForm,
        classId: manualStudentForm.classId,
      })
      setPrincipalRosterClassId(String(manualStudentForm.classId))
      setPrincipalRosterStatus('enrolled')
      await loadStudents({
        preserveMessage: true,
        classId: manualStudentForm.classId,
        enrollmentStatus: 'enrolled',
      })
    } catch (saveError) {
      setManualMessage({
        error: getStudentLifecycleErrorMessage(
          saveError,
          'Unable to enroll this student.',
        ),
        success: '',
      })
    } finally {
      setIsManualSubmitting(false)
    }
  }

  const handleStudentProfileSubmit = async (event) => {
    event.preventDefault()
    const classId = studentPendingEdit?.classId ?? principalRosterClassId
    const studentId = studentPendingEdit?.studentId
    const reason = studentProfileForm.reason.trim()

    if (!classId || !studentId) {
      setStudentProfileError('The selected learner is missing its class or student identifier.')
      return
    }

    if (
      !studentProfileForm.firstName.trim() ||
      !studentProfileForm.lastName.trim() ||
      !studentProfileForm.genderId
    ) {
      setStudentProfileError('First name, last name, and gender are required.')
      return
    }

    if (reason.length < 5 || reason.length > 255) {
      setStudentProfileError('Enter a correction reason between 5 and 255 characters.')
      return
    }

    setIsStudentProfileSaving(true)
    setStudentProfileError('')

    try {
      await updateStudentProfileV3(
        classId,
        studentId,
        {
          firstName: studentProfileForm.firstName.trim(),
          middleName: studentProfileForm.middleName.trim() || null,
          lastName: studentProfileForm.lastName.trim(),
          suffixId: studentProfileForm.suffixId ? Number(studentProfileForm.suffixId) : null,
          genderId: Number(studentProfileForm.genderId),
          birthDate: studentProfileForm.birthDate || null,
          reason,
        },
        token,
      )
      closeStudentProfileDialog(true)
      setStudentsSuccess('Student profile corrected successfully.')
      await loadStudents({ preserveMessage: true })
    } catch (saveError) {
      setStudentProfileError(
        getStudentLifecycleErrorMessage(saveError, 'Unable to correct this student profile.'),
      )
    } finally {
      setIsStudentProfileSaving(false)
    }
  }

  const handleStudentStatusSubmit = async (event) => {
    event.preventDefault()
    const classListId = studentPendingStatus?.classListId
    const reason = studentStatusReason.trim()

    if (!classListId) {
      setStudentStatusError('The selected enrollment is missing its class-list identifier.')
      return
    }

    if (!studentNextStatus) {
      setStudentStatusError('Select the learner enrollment status.')
      return
    }

    if (reason.length < 5 || reason.length > 255) {
      setStudentStatusError('Enter a status reason between 5 and 255 characters.')
      return
    }

    setIsStudentStatusSaving(true)
    setStudentStatusError('')

    try {
      await updateStudentEnrollmentStatusV3(
        classListId,
        { enrollmentStatus: studentNextStatus, reason },
        token,
      )
      closeStudentStatusDialog(true)
      setStudentsSuccess(`Enrollment status changed to ${formatStatus(studentNextStatus)}.`)
      await loadStudents({ preserveMessage: true })
    } catch (saveError) {
      setStudentStatusError(
        getStudentLifecycleErrorMessage(saveError, 'Unable to change the enrollment status.'),
      )
    } finally {
      setIsStudentStatusSaving(false)
    }
  }

  if (role === 'teacher') {
    const shouldShowClassSelection =
      activeTeacherTab === 'assessment' && !selectedClassAssignment

    return (
      <div className="content-stack teacher-records-page smart-ui">
        <h1 className="classes-visually-hidden">Classes</h1>
        {studentsError ? <p className="form-message form-message-error">{studentsError}</p> : null}

        <section className="teacher-assessment-workspace-panel">
          {shouldShowClassSelection ? (
            !isSectionsLoading && teacherClassOptions.length > 0 ? (
              <p className="teacher-class-count">{teacherClassOptions.length} assigned classes</p>
            ) : null
          ) : (
            <div className="teacher-assessment-title-row">
              <div className="teacher-class-context">
                <h2>{teacherHeaderLabel}</h2>
                <span>
                  {isStudentsLoading ? 'Loading students' : `${teacherHeaderStudentCount} students`}
                </span>
              </div>
              {activeTeacherTab === 'assessment' ? (
                <div className="teacher-assessment-toolbar" role="group" aria-label="Class controls">
                  <label className="teacher-subject-select" htmlFor="teacherClassSubject">
                    <span id="teacherClassSubjectLabel">Subject</span>
                    <select
                      id="teacherClassSubject"
                      aria-labelledby="teacherClassSubjectLabel"
                      value={selectedClassAssignment?.classAssignmentId ?? ''}
                      onChange={handleTeacherSubjectChange}
                      disabled={!selectedClassGroupAssignments.length}
                    >
                      {selectedClassGroupAssignments.map((assignment) => (
                        <option
                          key={assignment.classAssignmentId ?? assignment.id}
                          value={assignment.classAssignmentId}
                        >
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
                      onNavigate('assessment-setup', {
                        classId: selectedClassAssignment.classId,
                        classAssignmentId: selectedClassAssignment.classAssignmentId,
                      })
                    }
                  >
                    <Plus size={18} strokeWidth={2.5} aria-hidden="true" />
                    <span>Create Assessment</span>
                  </button>
                </div>
              ) : null}
            </div>
          )}

          {shouldShowClassSelection ? (
            <section className="teacher-records-class-grid" aria-label="Assigned classes">
              {isSectionsLoading ? (
                <article className="teacher-records-empty">
                  <strong>Loading assigned classes...</strong>
                </article>
              ) : null}

              {!isSectionsLoading && !teacherClassOptions.length ? (
                <article className="teacher-records-empty">
                  <strong>No assigned classes yet</strong>
                </article>
              ) : null}

              {!isSectionsLoading
                ? teacherClassOptions.map((classOption) => (
                    <button
                      type="button"
                      className="teacher-records-class-card"
                      key={classOption.key}
                      onClick={() => handleTeacherClassSelect(classOption.primaryAssignment)}
                    >
                      <span className="teacher-records-class-card-top">
                        <span className="teacher-class-icon" aria-hidden="true">
                          <BookOpen size={18} strokeWidth={2.2} />
                        </span>
                        <ArrowRight size={17} strokeWidth={2.2} aria-hidden="true" />
                      </span>
                      <span>
                        <strong>{classOption.label}</strong>
                        <small>{classOption.primaryAssignment.academicYear || 'Academic year not set'}</small>
                      </span>
                      <span className="teacher-records-class-meta">
                        <small>{getClassSubjectSummary(classOption.assignments)}</small>
                        <small>
                          {classOption.assignments.length}{' '}
                          {classOption.assignments.length === 1 ? 'subject' : 'subjects'}
                        </small>
                      </span>
                    </button>
                  ))
                : null}
            </section>
          ) : activeTeacherTab === 'assessment' ? (
            <div className="teacher-class-workspace-grid">
              <div className="teacher-class-main-column">
                {assessmentsError ? (
                  <p className="form-message form-message-error">{assessmentsError}</p>
                ) : null}

                <article className="teacher-assessment-panel">
                  <div className="teacher-assessment-panel-header">
                    <h3>Assessments</h3>
                    <small>{selectedClassAssessments.length} total</small>
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
                      <div className="teacher-assessment-empty">
                        <span aria-hidden="true">
                          <ClipboardList size={20} />
                        </span>
                        <strong>No assessments yet</strong>
                      </div>
                    ) : null}

                    {selectedClassAssignment && !isAssessmentsLoading
                      ? selectedClassAssessments.map((assessment, index) => (
                          <div
                            role="button"
                            tabIndex={0}
                            className="teacher-assessment-row"
                            key={assessment.id ?? index}
                            onClick={() =>
                              onNavigate('assessment-setup', {
                                classId: selectedClassAssignment.classId,
                                classAssignmentId: selectedClassAssignment.classAssignmentId,
                                assessmentId: assessment.id,
                              })
                            }
                            onKeyDown={(event) => {
                              if (event.key !== 'Enter' && event.key !== ' ') return
                              event.preventDefault()
                              onNavigate('assessment-setup', {
                                classId: selectedClassAssignment.classId,
                                classAssignmentId: selectedClassAssignment.classAssignmentId,
                                assessmentId: assessment.id,
                              })
                            }}
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
                              <small>Assigned date: {formatDate(assessment.testDate)}</small>
                            </div>
                            <div className="teacher-assessment-row-actions">
                              <span
                                className={`status-pill ${getAssessmentStatusClass(
                                  assessment.testStatus,
                                )}`}
                              >
                                {assessment.testStatus || 'Status not set'}
                              </span>
                              <button
                                type="button"
                                className="teacher-assessment-archive-button"
                                title="Archive this assessment"
                                aria-label={`Archive ${assessment.testName || 'assessment'}`}
                                disabled={archivingAssessmentId === assessment.id}
                                onClick={(event) => handleArchiveAssessment(event, assessment)}
                              >
                                <Archive size={15} strokeWidth={2.2} aria-hidden="true" />
                              </button>
                            </div>
                          </div>
                        ))
                      : null}
                  </div>
                </article>
              </div>
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
                            <td>{getDisplayName(student)}</td>
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
                      <p>NAME: {getDisplayName(selectedStudentInfo)}</p>
                      <p>
                        {selectedStudentInfo.gradeLevel || 'Grade level not assigned'} -{' '}
                        {selectedStudentInfo.section || 'Section not assigned'}
                      </p>
                    </div>
                  </aside>

                  <div className="student-performance-column">
                    <section className="student-performance-card">
                      <h4>Performance Reports</h4>
                      <p className="student-performance-card-subtitle">
                        Student scores, mastery, and interventions require the V3 reporting APIs.
                      </p>
                      <div className="student-chart-empty">Not available in Class Records.</div>
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
    <div
      className={`principal-class-records-page ${
        principalSection === 'students' ? 'is-student-workspace' : 'is-class-workspace'
      }`}
    >
      {principalSection === 'classes' ? (
        <>
          <h1 className="classes-visually-hidden">Class assignments</h1>

          <section className="principal-assignment-card" aria-label="Assign teacher to a class">
        <div className="section-toolbar">
          <div className="principal-assignment-toolbar-actions">
            <button type="button" className="secondary-button" onClick={openClassCreateDialog}>
              <Plus size={17} strokeWidth={2.4} aria-hidden="true" />
              Create Class
            </button>

            <button type="button" className="secondary-button" onClick={handlePrincipalRefresh}>
              <RefreshCw size={16} aria-hidden="true" />
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
        {duplicateClassAssignment ? (
          <p className="form-message form-message-error" role="alert">
            Duplicate assignment blocked: {duplicateClassAssignment.teacherName || 'This teacher'}
            {' '}already teaches {duplicateClassAssignment.subjectName || 'this subject'} in{' '}
            {duplicateClassAssignment.gradeLevelName || 'this grade level'} -{' '}
            {duplicateClassAssignment.sectionName || 'this section'}.
          </p>
        ) : selectedTeacherAssignments.length ? (
          <p className="principal-assignment-rule-warning" role="status">
            This teacher already has {selectedTeacherAssignments.length} active assignment(s) this
            school year. Another class is allowed, and the same class is allowed only for a
            different subject.
          </p>
        ) : null}
        <form className="principal-assignment-form" onSubmit={handleAssignmentSubmit}>
          <label htmlFor="classAssignmentClassId">
            <span>Class</span>
            <select
              id="classAssignmentClassId"
              name="classId"
              value={assignmentForm.classId}
              onChange={handleAssignmentFormChange}
              disabled={!assignmentClassOptions.length}
            >
              <option value="">Select class</option>
              {!assignmentClassOptions.length ? (
                <option value="" disabled>
                  No available classes for this academic year.
                </option>
              ) : null}
              {assignmentClassOptions.map((option) => (
                <option key={option.classId} value={option.classId}>
                  {option.label}
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
              disabled={!assignmentForm.classId}
            >
              <option value="">Select subject</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
          </label>

          <label htmlFor="classAssignmentTeacherId">
            <span>Teacher</span>
            <select
              id="classAssignmentTeacherId"
              name="teacherId"
              value={assignmentForm.teacherId}
              onChange={handleAssignmentFormChange}
              disabled={!assignmentForm.subjectId}
            >
              <option value="">Select teacher</option>
              {schoolTeachers.map((teacher) => (
                <option key={teacher.userId ?? teacher.id} value={teacher.userId ?? teacher.id}>
                  {teacher.name}
                </option>
              ))}
            </select>
          </label>

          <div className="principal-assignment-readonly-field" aria-label="Academic Year">
            <span>Academic Year</span>
            <strong>{selectedAcademicYearLabel}</strong>
          </div>

          <button
            type="submit"
            className="primary-button"
            disabled={isAssignmentSubmitting || Boolean(duplicateClassAssignment)}
          >
            {isAssignmentSubmitting ? 'Assigning...' : 'Assign Teacher'}
          </button>
        </form>
      </section>

      <section className="principal-assignment-card" aria-labelledby="classAssignmentsHeading">
        <div className="principal-assignment-table-header">
          <h2 id="classAssignmentsHeading">Assignments</h2>
          <span>{activeClassAssignments.length} assignment(s)</span>
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
                 <th aria-label="Actions">Actions</th>
               </tr>
             </thead>
             <tbody>
               {!activeClassAssignments.length ? (
                 <tr>
                   <td className="approval-empty" colSpan="6">
                     No class assignments found.
                   </td>
                </tr>
              ) : (
                 activeClassAssignments.map((assignment, index) => (
                  <tr key={assignment.id ?? `${assignment.teacherName}-${assignment.sectionName}-${index}`}>
                    <td>{assignment.teacherName || 'Not assigned'}</td>
                    <td>{assignment.subjectName || 'Not assigned'}</td>
                    <td>
                      {assignment.gradeLevelName || 'Grade level'} -{' '}
                      {assignment.sectionName || 'Section'}
                    </td>
                    <td>{formatAcademicYear(assignment, 'Not assigned')}</td>
                     <td>
                       <span className="status-pill status-active">
                         {formatStatus(assignment.status || 'active')}
                       </span>
                     </td>
                     <td className="principal-assignment-action-cell">
                       <div className="principal-assignment-row-actions">
                         <button
                           type="button"
                         className="principal-assignment-edit-button"
                           onClick={() => openAssignmentEditDialog(assignment)}
                           disabled
                           aria-label={`Edit ${assignment.teacherName || 'teacher'} class assignment`}
                           title="Active assignment editing is not available in the current backend contract"
                         >
                           <Pencil size={16} aria-hidden="true" />
                         </button>
                         <button
                           type="button"
                           className="principal-assignment-delete-button"
                           onClick={() => openAssignmentDeleteDialog(assignment)}
                           aria-label={`Remove ${assignment.teacherName || 'teacher'} from ${assignment.gradeLevelName || 'grade level'} ${assignment.sectionName || 'section'}`}
                           title="Remove class assignment"
                         >
                           <Trash2 size={16} aria-hidden="true" />
                         </button>
                       </div>
                     </td>
                   </tr>
                ))
              )}
            </tbody>
          </table>
         </div>
       </section>

       {isClassDialogOpen ? (
         <div
           className="assignment-delete-backdrop"
           role="presentation"
           onMouseDown={(event) => {
             if (event.target === event.currentTarget) closeClassCreateDialog()
           }}
         >
           <section
             className="assignment-delete-dialog"
             role="dialog"
             aria-modal="true"
             aria-labelledby="classCreateTitle"
           >
             <header className="assignment-delete-header assignment-confirm-header">
               <span className="assignment-delete-warning assignment-confirm-icon" aria-hidden="true">
                 <Plus size={21} strokeWidth={2.4} />
               </span>
               <div>
                 <p>Create class</p>
                 <h3 id="classCreateTitle">Add a grade and section</h3>
               </div>
               <button
                 type="button"
                 className="assignment-delete-close"
                 onClick={closeClassCreateDialog}
                 disabled={isClassCreating}
                 aria-label="Close create class dialog"
               >
                 <X size={18} aria-hidden="true" />
               </button>
             </header>

             <div className="assignment-delete-body">
               <form className="assignment-edit-form" onSubmit={handleClassCreate}>
                 <div className="principal-assignment-readonly-field">
                   <span>Academic year</span>
                   <strong>{selectedAcademicYearLabel}</strong>
                 </div>
                 <label htmlFor="classCreateGradeLevel">
                   <span>Grade level</span>
                   <select
                     id="classCreateGradeLevel"
                     value={classForm.gradeLevelId}
                     onChange={(event) =>
                       setClassForm((current) => ({ ...current, gradeLevelId: event.target.value }))
                     }
                     disabled={isClassCreating}
                     required
                   >
                     <option value="">Select grade level</option>
                     {assignmentGradeOptions.map((gradeLevel) => (
                       <option key={gradeLevel.id} value={gradeLevel.id}>
                         {gradeLevel.name}
                       </option>
                     ))}
                   </select>
                 </label>
                 <label htmlFor="classCreateSectionName">
                   <span>Section name</span>
                   <input
                     id="classCreateSectionName"
                     value={classForm.sectionName}
                     onChange={(event) =>
                       setClassForm((current) => ({ ...current, sectionName: event.target.value }))
                     }
                     maxLength="50"
                     disabled={isClassCreating}
                     required
                   />
                 </label>

                 {classCreateError ? (
                   <p className="form-message form-message-error assignment-edit-message" role="alert">
                     {classCreateError}
                   </p>
                 ) : null}

                 <div className="assignment-delete-actions assignment-edit-actions">
                   <button
                     type="button"
                     className="secondary-button"
                     onClick={closeClassCreateDialog}
                     disabled={isClassCreating}
                   >
                     Cancel
                   </button>
                   <button
                     type="submit"
                     className="assignment-confirm-submit"
                     disabled={
                       isClassCreating ||
                       !selectedAcademicYearId ||
                       !classForm.gradeLevelId ||
                       !classForm.sectionName.trim()
                     }
                   >
                     <Plus size={16} aria-hidden="true" />
                     {isClassCreating ? 'Creating...' : 'Create class'}
                   </button>
                 </div>
               </form>
             </div>
           </section>
         </div>
       ) : null}

       {assignmentPendingCreation ? (
         <div
           className="assignment-delete-backdrop"
           role="presentation"
           onMouseDown={(event) => {
             if (event.target === event.currentTarget) closeAssignmentCreateDialog()
           }}
         >
           <section
             className="assignment-delete-dialog"
             role="dialog"
             aria-modal="true"
             aria-labelledby="assignmentCreateTitle"
           >
             <header className="assignment-delete-header assignment-confirm-header">
               <span
                 className="assignment-delete-warning assignment-confirm-icon"
                 aria-hidden="true"
               >
                 <ClipboardCheck size={21} />
               </span>
               <div>
                 <p>Confirm assignment</p>
                 <h3 id="assignmentCreateTitle">Assign this teacher to the class?</h3>
               </div>
               <button
                 type="button"
                 className="assignment-delete-close"
                 onClick={closeAssignmentCreateDialog}
                 disabled={isAssignmentSubmitting}
                 aria-label="Close assignment confirmation dialog"
               >
                 <X size={18} aria-hidden="true" />
               </button>
             </header>

             <div className="assignment-delete-body">
               <p className="assignment-confirm-instruction">
                 Review the assignment details before confirming.
               </p>
               <dl className="assignment-delete-summary assignment-confirm-summary">
                 <div>
                   <dt>Teacher</dt>
                   <dd>{assignmentPendingCreation.teacherName}</dd>
                 </div>
                 <div>
                   <dt>Subject</dt>
                   <dd>{assignmentPendingCreation.subjectName}</dd>
                 </div>
                 <div>
                   <dt>Class</dt>
                   <dd>
                     {assignmentPendingCreation.gradeLevelName} -{' '}
                     {assignmentPendingCreation.sectionName}
                   </dd>
                 </div>
                 <div>
                   <dt>Academic year</dt>
                   <dd>{assignmentPendingCreation.academicYear}</dd>
                 </div>
               </dl>

               {assignmentCreateError ? (
                 <p className="form-message form-message-error" role="alert">
                   {assignmentCreateError}
                 </p>
               ) : null}

               <form onSubmit={handleAssignmentConfirm}>
                 <div className="assignment-delete-actions">
                   <button
                     type="button"
                     className="secondary-button"
                     onClick={closeAssignmentCreateDialog}
                     disabled={isAssignmentSubmitting}
                   >
                     Cancel
                   </button>
                   <button
                     type="submit"
                     className="assignment-confirm-submit"
                     disabled={isAssignmentSubmitting}
                   >
                     <ClipboardCheck size={16} aria-hidden="true" />
                     {isAssignmentSubmitting ? 'Assigning...' : 'Confirm assignment'}
                   </button>
                 </div>
               </form>
             </div>
           </section>
         </div>
       ) : null}

       {assignmentPendingEdit ? (
         <div
           className="assignment-delete-backdrop"
           role="presentation"
           onMouseDown={(event) => {
             if (event.target === event.currentTarget) closeAssignmentEditDialog()
           }}
         >
           <section
             className="assignment-delete-dialog assignment-edit-dialog"
             role="dialog"
             aria-modal="true"
             aria-labelledby="assignmentEditTitle"
           >
             <header className="assignment-delete-header assignment-confirm-header">
               <span
                 className="assignment-delete-warning assignment-confirm-icon"
                 aria-hidden="true"
               >
                 <Pencil size={20} />
               </span>
               <div>
                 <p>Edit assignment</p>
                 <h3 id="assignmentEditTitle">Update teacher class assignment</h3>
               </div>
               <button
                 type="button"
                 className="assignment-delete-close"
                 onClick={closeAssignmentEditDialog}
                 disabled={isAssignmentUpdating}
                 aria-label="Close edit assignment dialog"
               >
                 <X size={18} aria-hidden="true" />
               </button>
             </header>

             <div className="assignment-delete-body">
               <form className="assignment-edit-form" onSubmit={handleAssignmentUpdate}>
                 <label htmlFor="editAssignmentTeacherId">
                   <span>Teacher</span>
                   <select
                     id="editAssignmentTeacherId"
                     name="teacherId"
                     value={assignmentEditForm.teacherId}
                     onChange={handleAssignmentEditFormChange}
                     disabled={isAssignmentUpdating}
                   >
                     <option value="">Select teacher</option>
                     {schoolTeachers.map((teacher) => (
                       <option key={teacher.userId ?? teacher.id} value={teacher.userId ?? teacher.id}>
                         {teacher.name}
                       </option>
                     ))}
                   </select>
                 </label>

                 <label htmlFor="editAssignmentSubjectId">
                   <span>Subject</span>
                   <select
                     id="editAssignmentSubjectId"
                     name="subjectId"
                     value={assignmentEditForm.subjectId}
                     onChange={handleAssignmentEditFormChange}
                     disabled={isAssignmentUpdating || !assignmentEditForm.teacherId}
                   >
                     <option value="">Select subject</option>
                     {subjects.map((subject) => (
                       <option key={subject.id} value={subject.id}>
                         {subject.name}
                       </option>
                     ))}
                   </select>
                 </label>

                 <label htmlFor="editAssignmentGradeLevelId">
                   <span>Grade level</span>
                   <select
                     id="editAssignmentGradeLevelId"
                     name="gradeLevelId"
                     value={assignmentEditForm.gradeLevelId}
                     onChange={handleAssignmentEditFormChange}
                     disabled={isAssignmentUpdating || !assignmentEditForm.subjectId}
                   >
                     <option value="">Select grade level</option>
                     {assignmentGradeOptions.map((gradeLevel) => (
                       <option key={gradeLevel.id} value={gradeLevel.id}>
                         {gradeLevel.name}
                       </option>
                     ))}
                   </select>
                 </label>

                 <label htmlFor="editAssignmentClassId">
                   <span>Section</span>
                   <select
                     id="editAssignmentClassId"
                     name="classId"
                     value={assignmentEditForm.classId}
                     onChange={handleAssignmentEditFormChange}
                     disabled={
                       isAssignmentUpdating ||
                       isAssignmentEditSectionsLoading ||
                       !assignmentEditForm.gradeLevelId
                     }
                   >
                     <option value="">
                       {isAssignmentEditSectionsLoading ? 'Loading sections...' : 'Select section'}
                     </option>
                     {assignmentEditSectionOptions.map((section) => (
                       <option key={section.classId} value={section.classId}>
                         {section.sectionName || section.name}
                       </option>
                     ))}
                   </select>
                 </label>

                 <div className="principal-assignment-readonly-field assignment-edit-year">
                   <span>Academic year</span>
                   <strong>{formatAcademicYear(assignmentPendingEdit, 'Academic Year')}</strong>
                 </div>

                 {duplicateEditedAssignment ? (
                   <p className="form-message form-message-error assignment-edit-message" role="alert">
                     This teacher already has the same active class and subject assignment.
                   </p>
                 ) : null}
                 {assignmentEditError ? (
                   <p className="form-message form-message-error assignment-edit-message" role="alert">
                     {assignmentEditError}
                   </p>
                 ) : null}

                 <div className="assignment-delete-actions assignment-edit-actions">
                   <button
                     type="button"
                     className="secondary-button"
                     onClick={closeAssignmentEditDialog}
                     disabled={isAssignmentUpdating}
                   >
                     Cancel
                   </button>
                   <button
                     type="submit"
                     className="assignment-confirm-submit"
                     disabled={
                       isAssignmentUpdating ||
                       !assignmentEditForm.teacherId ||
                       !assignmentEditForm.subjectId ||
                       !assignmentEditForm.gradeLevelId ||
                       !assignmentEditForm.classId ||
                       !hasAssignmentEditChanges ||
                       Boolean(duplicateEditedAssignment)
                     }
                   >
                     <Pencil size={16} aria-hidden="true" />
                     {isAssignmentUpdating ? 'Saving...' : 'Save changes'}
                   </button>
                 </div>
               </form>
             </div>
           </section>
         </div>
       ) : null}

       {assignmentPendingDeletion ? (
         <div
           className="assignment-delete-backdrop"
           role="presentation"
           onMouseDown={(event) => {
             if (event.target === event.currentTarget) closeAssignmentDeleteDialog()
           }}
         >
           <section
             className="assignment-delete-dialog"
             role="alertdialog"
             aria-modal="true"
             aria-labelledby="assignmentDeleteTitle"
           >
             <header className="assignment-delete-header">
               <span className="assignment-delete-warning" aria-hidden="true">
                 <AlertTriangle size={21} />
               </span>
               <div>
                 <p>Remove assignment</p>
                 <h3 id="assignmentDeleteTitle">Remove this teacher assignment?</h3>
               </div>
               <button
                 type="button"
                 className="assignment-delete-close"
                 onClick={closeAssignmentDeleteDialog}
                 disabled={isAssignmentDeleting}
                 aria-label="Close remove assignment dialog"
               >
                 <X size={18} aria-hidden="true" />
               </button>
             </header>

             <div className="assignment-delete-body">
               <dl className="assignment-delete-summary">
                 <div>
                   <dt>Teacher</dt>
                   <dd>{assignmentPendingDeletion.teacherName || 'Not assigned'}</dd>
                 </div>
                 <div>
                   <dt>Class and subject</dt>
                   <dd>
                     {assignmentPendingDeletion.gradeLevelName || 'Grade level'} -{' '}
                     {assignmentPendingDeletion.sectionName || 'Section'} ·{' '}
                     {assignmentPendingDeletion.subjectName || 'Subject'}
                   </dd>
                 </div>
               </dl>

               <p className="assignment-delete-instruction">
                 Type the exact phrase below and provide a reason to archive this assignment:
               </p>
               <code className="assignment-delete-phrase">{assignmentDeletePhrase}</code>

               {assignmentDeleteError ? (
                 <p className="form-message form-message-error" role="alert">
                   {assignmentDeleteError}
                 </p>
               ) : null}

               <form onSubmit={handleAssignmentDelete}>
                 <label htmlFor="assignmentDeleteConfirmation">Confirmation phrase</label>
                 <input
                   id="assignmentDeleteConfirmation"
                   value={assignmentDeleteConfirmation}
                   onChange={(event) => setAssignmentDeleteConfirmation(event.target.value)}
                   autoComplete="off"
                   spellCheck="false"
                   disabled={isAssignmentDeleting}
                   autoFocus
                 />

                 <label htmlFor="assignmentArchiveReason">Reason for archiving</label>
                 <textarea
                   id="assignmentArchiveReason"
                   className="assignment-restore-reason"
                   value={assignmentArchiveReason}
                   onChange={(event) => setAssignmentArchiveReason(event.target.value)}
                   minLength="5"
                   maxLength="255"
                   rows="3"
                   required
                   disabled={isAssignmentDeleting}
                 />
                 <span className="assignment-restore-reason-count">
                   {assignmentArchiveReason.length}/255
                 </span>

                 <div className="assignment-delete-actions">
                   <button
                     type="button"
                     className="secondary-button"
                     onClick={closeAssignmentDeleteDialog}
                     disabled={isAssignmentDeleting}
                   >
                     Cancel
                   </button>
                   <button
                     type="submit"
                     className="assignment-delete-confirm"
                     disabled={!canDeleteAssignment || isAssignmentDeleting}
                   >
                     <Trash2 size={16} aria-hidden="true" />
                     {isAssignmentDeleting ? 'Archiving...' : 'Archive assignment'}
                   </button>
                 </div>
               </form>
             </div>
           </section>
         </div>
       ) : null}

        </>
      ) : null}

      {principalSection === 'students' ? (
        <>
          <h1 className="classes-visually-hidden">Students</h1>

      <section className="content-card principal-student-table-panel">
        <div className="section-toolbar">
          <div className="principal-roster-heading">
            <h2>Class roster</h2>
            {!isStudentsLoading && !studentsError ? (
              <span>{students.length} {students.length === 1 ? 'student' : 'students'}</span>
            ) : null}
          </div>
          <div className="principal-assignment-toolbar-actions">
            <button
              type="button"
              className={`principal-smart-import-card ${
                activePrincipalTool === 'sf1' ? 'is-active' : ''
              }`}
              onClick={() => setActivePrincipalTool('sf1')}
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
              onClick={openManualStudentPanel}
              title="Enroll a student in an active class"
            >
              Manual Input
            </button>

            <button type="button" className="secondary-button" onClick={handlePrincipalRefresh}>
              <RefreshCw size={16} aria-hidden="true" />
              Refresh
            </button>
          </div>
        </div>

        <div className="principal-roster-controls">
          <label htmlFor="principalRosterClassId">
            <span id="principalRosterClassLabel">Class</span>
            <select
              id="principalRosterClassId"
              aria-labelledby="principalRosterClassLabel"
              value={principalRosterClassId}
              onChange={(event) => {
                setStudentsSuccess('')
                setPrincipalRosterClassId(event.target.value)
              }}
            >
              <option value="">Select class</option>
              {principalRosterClassOptions.map((classRecord) => (
                <option key={classRecord.classId} value={classRecord.classId}>
                  {classRecord.gradeLevelName || 'Grade level'} -{' '}
                  {classRecord.sectionName || classRecord.name || 'Section'} |{' '}
                  {formatAcademicYear(classRecord, 'Academic year')}
                </option>
              ))}
            </select>
          </label>

          <div className="principal-roster-status-group">
            <span id="principalRosterStatusLabel">Enrollment status</span>
            <div role="group" aria-labelledby="principalRosterStatusLabel">
              {ENROLLMENT_STATUSES.map((status) => (
                <button
                  type="button"
                  key={status}
                  className={principalRosterStatus === status ? 'is-active' : ''}
                  aria-pressed={principalRosterStatus === status}
                  onClick={() => {
                    setStudentsSuccess('')
                    setPrincipalRosterStatus(status)
                  }}
                >
                  {formatStatus(status)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {studentsSuccess ? (
          <p className="form-message form-message-success">{studentsSuccess}</p>
        ) : null}
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
                <th>Status</th>
                <th>Source</th>
                <th aria-label="Actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isStudentsLoading ? (
                <tr>
                  <td className="approval-empty" colSpan="8">
                    Loading student records...
                  </td>
                </tr>
              ) : null}

              {!isStudentsLoading && !students.length ? (
                <tr>
                  <td className="approval-empty" colSpan="8">
                    {principalRosterClassId
                      ? `No ${principalRosterStatus} learners found in this class.`
                      : 'No active class is available for roster management.'}
                  </td>
                </tr>
              ) : null}

              {!isStudentsLoading
                ? sortedPrincipalRosterStudents.map((student) => (
                    <tr key={student.classListId ?? `${student.studentLrn}-${student.name}`}>
                      <td>{student.studentLrn || 'Not provided'}</td>
                      <td>{getDisplayName(student)}</td>
                      <td>{student.gender}</td>
                      <td>{student.section || 'Not assigned'}</td>
                      <td>{student.gradeLevel || 'Not assigned'}</td>
                      <td>
                        <span className={`status-pill status-${student.enrollmentStatus || 'pending'}`}>
                          {formatStatus(student.enrollmentStatus)}
                        </span>
                      </td>
                      <td>{formatStatus(student.enrollmentSource || 'manual')}</td>
                      <td className="principal-student-action-cell">
                        <div className="principal-assignment-row-actions">
                          <button
                            type="button"
                            className="principal-assignment-edit-button"
                            onClick={() => openStudentProfileDialog(student)}
                            aria-label={`Edit ${getDisplayName(student)} profile`}
                            title="Edit Student Profile"
                          >
                            <Pencil size={16} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className="principal-student-status-button"
                            onClick={() => openStudentStatusDialog(student)}
                            aria-label={`Change ${getDisplayName(student)} enrollment status`}
                            title="Change enrollment status"
                          >
                            <RefreshCw size={16} aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                : null}
            </tbody>
          </table>
        </div>
      </section>

      {activePrincipalTool === 'sf1' ? (
        <V3Sf1ImportPanel
          token={token}
          gradeLevels={assignmentGradeOptions}
          academicYears={academicYears}
          classes={sectionOptions}
          initialAcademicYearId={selectedAcademicYearId}
          isGradeLevelsLoading={isSectionsLoading}
          gradeLevelsError={schoolReferenceError}
          onRetryGradeLevels={loadSections}
          onImported={handleSf1Imported}
          onClose={() => setActivePrincipalTool(null)}
        />
      ) : null}

      <div className="principal-class-tool-panels">
        <section
          className={`content-card principal-tool-panel ${
            activePrincipalTool === 'manual' ? 'is-active' : ''
          }`}
        >
          <div className="section-toolbar manual-student-panel-header">
            <h2>Enroll one student</h2>
            <button
              type="button"
              className="assignment-delete-close"
              onClick={closeManualStudentPanel}
              disabled={isManualSubmitting}
              aria-label="Close manual student input"
              title="Close"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
          {schoolReferenceError ? (
            <div className="manual-reference-error">
              <p className="form-message form-message-error">{schoolReferenceError}</p>
              <button type="button" className="secondary-button" onClick={loadSections}>
                <RefreshCw size={16} aria-hidden="true" />
                Retry reference data
              </button>
            </div>
          ) : null}
          {manualMessage.error ? (
            <p className="form-message form-message-error" role="alert">{manualMessage.error}</p>
          ) : null}
          {manualMessage.success ? (
            <p className="form-message form-message-success" role="status">{manualMessage.success}</p>
          ) : null}

          <form className="manual-student-profile-form" onSubmit={handleManualSubmit}>
            <label className="manual-student-class-field" htmlFor="manualStudentClassId">
              <span>Class</span>
              <select
                id="manualStudentClassId"
                name="classId"
                value={manualStudentForm.classId}
                onChange={handleManualStudentChange}
                disabled={isManualSubmitting || !principalRosterClassOptions.length}
                required
              >
                <option value="">Select class</option>
                {principalRosterClassOptions.map((classRecord) => (
                  <option key={classRecord.classId} value={classRecord.classId}>
                    {classRecord.gradeLevelName || 'Grade level'} -{' '}
                    {classRecord.sectionName || classRecord.name || 'Section'} |{' '}
                    {formatAcademicYear(classRecord, 'Academic year')}
                  </option>
                ))}
              </select>
            </label>

            <div className="manual-student-profile-grid">
              <label htmlFor="manualStudentLrn">
                <span>LRN</span>
                <input
                  id="manualStudentLrn"
                  name="studentLrn"
                  value={manualStudentForm.studentLrn}
                  onChange={handleManualStudentChange}
                  inputMode="numeric"
                  pattern="[0-9]{12}"
                  minLength="12"
                  maxLength="12"
                  placeholder="12-digit learner reference number"
                  disabled={isManualSubmitting}
                  required
                />
                <small>{manualStudentForm.studentLrn.length}/12 digits</small>
              </label>

              <label htmlFor="manualStudentFirstName">
                <span>First name</span>
                <input
                  id="manualStudentFirstName"
                  name="firstName"
                  value={manualStudentForm.firstName}
                  onChange={handleManualStudentChange}
                  maxLength="50"
                  disabled={isManualSubmitting}
                  required
                />
              </label>

              <label htmlFor="manualStudentMiddleName">
                <span>Middle name <small>(optional)</small></span>
                <input
                  id="manualStudentMiddleName"
                  name="middleName"
                  value={manualStudentForm.middleName}
                  onChange={handleManualStudentChange}
                  maxLength="50"
                  disabled={isManualSubmitting}
                />
              </label>

              <label htmlFor="manualStudentLastName">
                <span>Last name</span>
                <input
                  id="manualStudentLastName"
                  name="lastName"
                  value={manualStudentForm.lastName}
                  onChange={handleManualStudentChange}
                  maxLength="50"
                  disabled={isManualSubmitting}
                  required
                />
              </label>

              <label htmlFor="manualStudentSuffixId">
                <span>Suffix <small>(optional)</small></span>
                <select
                  id="manualStudentSuffixId"
                  name="suffixId"
                  value={manualStudentForm.suffixId}
                  onChange={handleManualStudentChange}
                  disabled={isManualSubmitting}
                >
                  <option value="">No suffix</option>
                  {studentSuffixes.map((suffix) => (
                    <option key={suffix.suffixId} value={suffix.suffixId}>
                      {suffix.suffixName}
                    </option>
                  ))}
                </select>
              </label>

              <label htmlFor="manualStudentGenderId">
                <span>Gender</span>
                <select
                  id="manualStudentGenderId"
                  name="genderId"
                  value={manualStudentForm.genderId}
                  onChange={handleManualStudentChange}
                  disabled={isManualSubmitting || !studentGenders.length}
                  required
                >
                  <option value="">Select gender</option>
                  {studentGenders.map((gender) => (
                    <option key={gender.genderId} value={gender.genderId}>
                      {gender.genderName}
                    </option>
                  ))}
                </select>
              </label>

              <label htmlFor="manualStudentBirthDate">
                <span>Birth date <small>(optional)</small></span>
                <input
                  id="manualStudentBirthDate"
                  name="birthDate"
                  type="date"
                  value={manualStudentForm.birthDate}
                  onChange={handleManualStudentChange}
                  max={MAX_BIRTH_DATE}
                  disabled={isManualSubmitting}
                />
              </label>
            </div>

            <div className="manual-save-row">
              <button
                type="button"
                className="secondary-button"
                onClick={closeManualStudentPanel}
                disabled={isManualSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="primary-button"
                disabled={
                  isManualSubmitting ||
                  Boolean(schoolReferenceError) ||
                  !studentGenders.length ||
                  !principalRosterClassOptions.length
                }
              >
                {isManualSubmitting ? 'Enrolling...' : 'Enroll student'}
              </button>
            </div>
          </form>
        </section>
      </div>

      {studentPendingEdit ? (
        <div
          className="assignment-delete-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeStudentProfileDialog()
          }}
        >
          <section
            className="assignment-delete-dialog student-lifecycle-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="studentProfileEditTitle"
          >
            <header className="assignment-delete-header assignment-confirm-header">
              <span className="assignment-delete-warning assignment-confirm-icon" aria-hidden="true">
                <Pencil size={20} />
              </span>
              <div>
                <h3 id="studentProfileEditTitle">Correct learner details</h3>
              </div>
              <button
                type="button"
                className="assignment-delete-close"
                onClick={() => closeStudentProfileDialog()}
                disabled={isStudentProfileSaving}
                aria-label="Close student profile dialog"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </header>

            <div className="assignment-delete-body">
              <form className="student-lifecycle-form" onSubmit={handleStudentProfileSubmit}>
                <label className="student-lifecycle-wide" htmlFor="studentProfileLrn">
                  <span>LRN</span>
                  <input
                    id="studentProfileLrn"
                    value={studentPendingEdit.studentLrn ?? ''}
                    readOnly
                    aria-readonly="true"
                  />
                  <small>LRN cannot be changed from profile correction.</small>
                </label>

                <label htmlFor="studentProfileFirstName">
                  <span>First name</span>
                  <input
                    id="studentProfileFirstName"
                    name="firstName"
                    value={studentProfileForm.firstName}
                    onChange={handleStudentProfileChange}
                    maxLength="50"
                    disabled={isStudentProfileSaving}
                    required
                  />
                </label>

                <label htmlFor="studentProfileMiddleName">
                  <span>Middle name <small>(optional)</small></span>
                  <input
                    id="studentProfileMiddleName"
                    name="middleName"
                    value={studentProfileForm.middleName}
                    onChange={handleStudentProfileChange}
                    maxLength="50"
                    disabled={isStudentProfileSaving}
                  />
                </label>

                <label htmlFor="studentProfileLastName">
                  <span>Last name</span>
                  <input
                    id="studentProfileLastName"
                    name="lastName"
                    value={studentProfileForm.lastName}
                    onChange={handleStudentProfileChange}
                    maxLength="50"
                    disabled={isStudentProfileSaving}
                    required
                  />
                </label>

                <label htmlFor="studentProfileSuffixId">
                  <span>Suffix <small>(optional)</small></span>
                  <select
                    id="studentProfileSuffixId"
                    name="suffixId"
                    value={studentProfileForm.suffixId}
                    onChange={handleStudentProfileChange}
                    disabled={isStudentProfileSaving}
                  >
                    <option value="">No suffix</option>
                    {studentSuffixes.map((suffix) => (
                      <option key={suffix.suffixId} value={suffix.suffixId}>
                        {suffix.suffixName}
                      </option>
                    ))}
                  </select>
                </label>

                <label htmlFor="studentProfileGenderId">
                  <span>Gender</span>
                  <select
                    id="studentProfileGenderId"
                    name="genderId"
                    value={studentProfileForm.genderId}
                    onChange={handleStudentProfileChange}
                    disabled={isStudentProfileSaving || !studentGenders.length}
                    required
                  >
                    <option value="">Select gender</option>
                    {studentGenders.map((gender) => (
                      <option key={gender.genderId} value={gender.genderId}>
                        {gender.genderName}
                      </option>
                    ))}
                  </select>
                </label>

                <label htmlFor="studentProfileBirthDate">
                  <span>Birth date <small>(optional)</small></span>
                  <input
                    id="studentProfileBirthDate"
                    name="birthDate"
                    type="date"
                    value={studentProfileForm.birthDate}
                    onChange={handleStudentProfileChange}
                    max={MAX_BIRTH_DATE}
                    disabled={isStudentProfileSaving}
                  />
                </label>

                <label className="student-lifecycle-wide" htmlFor="studentProfileReason">
                  <span>Correction reason</span>
                  <textarea
                    id="studentProfileReason"
                    name="reason"
                    value={studentProfileForm.reason}
                    onChange={handleStudentProfileChange}
                    minLength="5"
                    maxLength="255"
                    rows="3"
                    disabled={isStudentProfileSaving}
                    required
                  />
                  <small>{studentProfileForm.reason.length}/255 characters</small>
                </label>

                {studentProfileError ? (
                  <p className="form-message form-message-error student-lifecycle-wide" role="alert">
                    {studentProfileError}
                  </p>
                ) : null}

                <div className="assignment-delete-actions student-lifecycle-wide">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => closeStudentProfileDialog()}
                    disabled={isStudentProfileSaving}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="assignment-confirm-submit"
                    disabled={
                      isStudentProfileSaving ||
                      studentProfileForm.reason.trim().length < 5 ||
                      studentProfileForm.reason.trim().length > 255
                    }
                  >
                    <Save size={16} aria-hidden="true" />
                    {isStudentProfileSaving ? 'Saving...' : 'Save correction'}
                  </button>
                </div>
              </form>
            </div>
          </section>
        </div>
      ) : null}

      {studentPendingStatus ? (
        <div
          className="assignment-delete-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeStudentStatusDialog()
          }}
        >
          <section
            className="assignment-delete-dialog student-status-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="studentStatusTitle"
          >
            <header className="assignment-delete-header assignment-confirm-header">
              <span className="assignment-delete-warning assignment-confirm-icon" aria-hidden="true">
                <RefreshCw size={20} />
              </span>
              <div>
                <h3 id="studentStatusTitle">Change enrollment status</h3>
              </div>
              <button
                type="button"
                className="assignment-delete-close"
                onClick={() => closeStudentStatusDialog()}
                disabled={isStudentStatusSaving}
                aria-label="Close enrollment status dialog"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </header>

            <div className="assignment-delete-body">
              <dl className="assignment-delete-summary">
                <div>
                  <dt>Student</dt>
                  <dd>{getDisplayName(studentPendingStatus)}</dd>
                </div>
                <div>
                  <dt>Current status</dt>
                  <dd>{formatStatus(studentPendingStatus.enrollmentStatus)}</dd>
                </div>
              </dl>

              <form className="student-status-form" onSubmit={handleStudentStatusSubmit}>
                <label htmlFor="studentNextStatus">
                  <span>New enrollment status</span>
                  <select
                    id="studentNextStatus"
                    value={studentNextStatus}
                    onChange={(event) => {
                      setStudentNextStatus(event.target.value)
                      setStudentStatusError('')
                    }}
                    disabled={isStudentStatusSaving}
                    required
                  >
                    {ENROLLMENT_STATUSES.filter(
                      (status) => status !== studentPendingStatus.enrollmentStatus,
                    ).map((status) => (
                      <option key={status} value={status}>
                        {formatStatus(status)}
                      </option>
                    ))}
                  </select>
                </label>

                <label htmlFor="studentStatusReason">
                  <span>Reason</span>
                  <textarea
                    id="studentStatusReason"
                    value={studentStatusReason}
                    onChange={(event) => {
                      setStudentStatusReason(event.target.value)
                      setStudentStatusError('')
                    }}
                    minLength="5"
                    maxLength="255"
                    rows="3"
                    disabled={isStudentStatusSaving}
                    required
                  />
                  <small>{studentStatusReason.length}/255 characters</small>
                </label>

                {studentStatusError ? (
                  <p className="form-message form-message-error" role="alert">
                    {studentStatusError}
                  </p>
                ) : null}

                <div className="assignment-delete-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => closeStudentStatusDialog()}
                    disabled={isStudentStatusSaving}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="assignment-confirm-submit"
                    disabled={
                      isStudentStatusSaving ||
                      !studentNextStatus ||
                      studentStatusReason.trim().length < 5 ||
                      studentStatusReason.trim().length > 255
                    }
                  >
                    <RefreshCw size={16} aria-hidden="true" />
                    {isStudentStatusSaving ? 'Updating...' : 'Update enrollment'}
                  </button>
                </div>
              </form>
            </div>
          </section>
        </div>
      ) : null}
        </>
      ) : null}
    </div>
  )
}

export default ClassRecordsPage

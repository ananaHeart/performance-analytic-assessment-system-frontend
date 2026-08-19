import { useEffect, useMemo, useState } from 'react'
import { Info, Pencil, PlusCircle, Trash2 } from 'lucide-react'
import {
  createAssessment,
  createTestPart,
  getAssessmentDetails,
  getClassAssignments,
  getCompetencyTree,
  getManualStudents,
  getPartSkillMappings,
  getTeacherAssessments,
  savePartSkillMappings,
} from '../api/apiClient'

const USER_STORAGE_KEY = 'assessment-user'

const initialHeaderForm = {
  testName: '',
  testType: '',
  testDate: '',
  testStatus: 'Active',
}

const initialPartForm = {
  competencyId: '',
  partOrder: '',
  partType: '',
  numberOfItems: '',
  pointsPerItem: '',
  answerKey: '',
  mappingMode: 'RANGE',
  branchMappings: [],
}

const PART_TYPE_OPTIONS = [
  'Multiple Choice',
  'True or False',
  'Identification',
  'Enumeration',
]

const ASSESSMENT_TYPE_OPTIONS = ['Quiz', 'Exam', 'Long Test']
const MULTIPLE_CHOICE_OPTIONS = ['A', 'B', 'C', 'D']
const TRUE_FALSE_OPTIONS = ['True', 'False']

function getAutomaticAssessmentStatus(status) {
  const normalizedStatus = String(status ?? '').trim().toLowerCase()

  return normalizedStatus === 'completed' || normalizedStatus === 'complete'
    ? 'Completed'
    : 'Active'
}

function parseAnswerKeyEntries(answerKey) {
  if (!answerKey.trim()) {
    return []
  }

  return answerKey.split(',').map((entry) => entry.trim())
}

function buildAnswerKey(entries) {
  return entries.map((entry) => entry.trim()).join(',')
}

function formatItemList(items = []) {
  if (!items.length) {
    return 'none'
  }

  if (items.length <= 12) {
    return items.join(', ')
  }

  return `${items.slice(0, 12).join(', ')} and ${items.length - 12} more`
}

function getRangeItemCount(mapping) {
  const startItem = Number(mapping?.startItem)
  const endItem = Number(mapping?.endItem)

  if (!Number.isInteger(startItem) || !Number.isInteger(endItem) || endItem < startItem) {
    return ''
  }

  return String(endItem - startItem + 1)
}

function findCompetencyById(competencies = [], competencyId) {
  for (const competency of competencies) {
    if (String(competency.id) === String(competencyId)) {
      return competency
    }

    const branchMatch = findCompetencyById(competency.branches ?? [], competencyId)
    if (branchMatch) {
      return branchMatch
    }
  }

  return null
}

function getSkillMappingCoverage(partForm) {
  const totalItems = Number(partForm.numberOfItems)
  const hasValidTotal = Number.isInteger(totalItems) && totalItems > 0
  const selectedMappings = Array.isArray(partForm.branchMappings) ? partForm.branchMappings : []
  const mode = 'RANGE'
  const errors = []
  const mappedItems = new Set()
  const itemOwners = new Map()
  const normalizedMappings = []

  selectedMappings.forEach((mapping) => {
    const competencyId = Number(mapping.competencyId)
    const competencyName = mapping.competencyName || 'Selected branch skill'

    if (!competencyId) {
      errors.push('Selected branch skill is missing a competency ID.')
      return
    }

    const hasStart = String(mapping.startItem ?? '').trim()
    const hasEnd = String(mapping.endItem ?? '').trim()
    const startItem = Number(mapping.startItem)
    const endItem = Number(mapping.endItem)

    if (!hasStart || !hasEnd) {
      errors.push(`${competencyName}: enter both start and end item numbers.`)
      return
    }

    if (!Number.isInteger(startItem) || !Number.isInteger(endItem)) {
      errors.push(`${competencyName}: item range must use whole numbers.`)
      return
    }

    if (startItem < 1 || (hasValidTotal && startItem > totalItems)) {
      errors.push(`${competencyName}: start item must be within the number of items.`)
      return
    }

    if (endItem < startItem) {
      errors.push(`${competencyName}: end item must be greater than or equal to start item.`)
      return
    }

    if (hasValidTotal && endItem > totalItems) {
      errors.push(`${competencyName}: end item must not exceed ${totalItems}.`)
      return
    }

    const itemNumbers = Array.from(
      { length: endItem - startItem + 1 },
      (_, index) => startItem + index,
    )

    itemNumbers.forEach((itemNumber) => {
      if (itemOwners.has(itemNumber)) {
        errors.push(`Item ${itemNumber} is assigned to both ${itemOwners.get(itemNumber)} and ${competencyName}.`)
      } else {
        itemOwners.set(itemNumber, competencyName)
        mappedItems.add(itemNumber)
      }
    })

    normalizedMappings.push({
      competencyId,
      competencyName,
      mappingMode: mode,
      itemCount: itemNumbers.length,
      startItem,
      endItem,
      itemNumbers,
    })
  })

  const unmappedItems = hasValidTotal
    ? Array.from({ length: totalItems }, (_, index) => index + 1).filter(
        (itemNumber) => !mappedItems.has(itemNumber),
      )
    : []

  const warnings = []
  if (unmappedItems.length) {
    warnings.push(`Unmapped items: ${formatItemList(unmappedItems)}.`)
  }

  return {
    errors,
    warnings,
    mappings: normalizedMappings,
    mappedItemCount: mappedItems.size,
    totalItems: hasValidTotal ? totalItems : 0,
    unmappedItems,
  }
}

function validatePartForm(partForm) {
  const trimmedPartLabel = partForm.partOrder.trim()
  const trimmedPartType = partForm.partType.trim()
  const trimmedAnswerKey = partForm.answerKey.trim()
  const numberOfItems = Number(partForm.numberOfItems)
  const pointsPerItem = Number(partForm.pointsPerItem)

  if (!trimmedPartLabel) {
    return 'Please enter a test part label.'
  }

  if (!trimmedPartType) {
    return 'Please select a part type.'
  }

  if (!partForm.numberOfItems) {
    return 'Please enter the number of items in this part.'
  }

  if (!Number.isFinite(numberOfItems) || numberOfItems <= 0 || !Number.isInteger(numberOfItems)) {
    return 'Number of items must be a whole number greater than 0.'
  }

  if (!partForm.pointsPerItem) {
    return 'Please enter points per item.'
  }

  if (!Number.isFinite(pointsPerItem) || pointsPerItem <= 0) {
    return 'Points per item must be greater than 0.'
  }

  if (!partForm.competencyId) {
    return 'Please choose a parent competency for this section.'
  }

  if (!partForm.branchMappings?.length) {
    return 'Select at least one branch skill and map its item numbers.'
  }

  const mappingCoverage = getSkillMappingCoverage(partForm)
  if (mappingCoverage.errors.length) {
    return mappingCoverage.errors[0]
  }

  if (mappingCoverage.unmappedItems.length) {
    return 'Map every item to a branch skill before saving this section.'
  }

  if (!trimmedAnswerKey) {
    return 'Please enter the answer key.'
  }

  const answerEntries = parseAnswerKeyEntries(trimmedAnswerKey)

  if (answerEntries.some((entry) => !entry)) {
    return 'Answer key must not contain empty values.'
  }

  if (answerEntries.length !== numberOfItems) {
    return `Answer key must contain ${numberOfItems} answers to match the number of items.`
  }

  return ''
}

function isPartFormStarted(partForm) {
  return Boolean(
    partForm.competencyId ||
      partForm.partOrder.trim() ||
      partForm.partType.trim() ||
      partForm.numberOfItems ||
      partForm.pointsPerItem ||
      partForm.answerKey.trim() ||
      partForm.branchMappings?.length,
  )
}

function buildDraftPartFromForm(partForm, competencies) {
  const competency = findCompetencyById(competencies, partForm.competencyId)
  const mappingCoverage = getSkillMappingCoverage(partForm)

  return {
    ...partForm,
    competencyId: Number(partForm.competencyId),
    competencyName: competency?.label ?? competency?.name ?? 'Selected parent competency',
    mappingMode: 'RANGE',
    branchMappings: mappingCoverage.mappings,
    mappedItemCount: mappingCoverage.mappedItemCount,
    numberOfItems: Number(partForm.numberOfItems),
    pointsPerItem: Number(partForm.pointsPerItem),
  }
}

function buildTestPartPayload(part) {
  return {
    competencyId: Number(part.competencyId),
    partOrder: part.partOrder.trim(),
    partType: part.partType.trim(),
    numberOfItems: Number(part.numberOfItems),
    pointsPerItem: Number(part.pointsPerItem),
    answerKey: part.answerKey.trim(),
  }
}

function buildSkillMappingPayload(part) {
  return (part.branchMappings ?? []).map((mapping) => ({
    competencyId: Number(mapping.competencyId),
    mappingMode: 'RANGE',
    itemCount: Number(mapping.itemCount),
    startItem: Number(mapping.startItem),
    endItem: Number(mapping.endItem),
    itemNumbers: [],
  }))
}

function readStoredTeacher() {
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

function formatDate(dateValue) {
  if (!dateValue) {
    return 'Not assigned'
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

function formatClassAssignmentLabel(assignment) {
  if (!assignment) {
    return 'Choose a class to continue.'
  }

  const gradeLevelName = assignment.gradeLevelName || 'Grade level not assigned'
  const sectionName = assignment.sectionName || 'Section not assigned'
  const subjectName = assignment.subjectName || 'Subject not assigned'
  const academicYear = assignment.academicYear || 'Academic year not assigned'

  return `${subjectName} - ${gradeLevelName} ${sectionName} - ${academicYear}`
}

function formatClassShortLabel(assignment) {
  if (!assignment) {
    return 'selected class'
  }

  return `${assignment.gradeLevelName || 'Grade level'} - ${assignment.sectionName || 'Section'}`
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

function getPartTotals(parts = []) {
  return parts.reduce(
    (totals, part) => {
      const numberOfItems = Number(part.numberOfItems)
      const pointsPerItem = Number(part.pointsPerItem)

      if (Number.isFinite(numberOfItems) && numberOfItems > 0) {
        totals.items += numberOfItems
      }

      if (
        Number.isFinite(numberOfItems) &&
        numberOfItems > 0 &&
        Number.isFinite(pointsPerItem) &&
        pointsPerItem > 0
      ) {
        totals.points += numberOfItems * pointsPerItem
      }

      return totals
    },
    { items: 0, points: 0 },
  )
}

function extractCreatedAssessmentId(response) {
  const candidates = [
    response,
    response?.testId,
    response?.test_id,
    response?.id,
    response?.data,
    response?.data?.testId,
    response?.data?.test_id,
    response?.data?.id,
    response?.test?.testId,
    response?.test?.test_id,
    response?.test?.id,
  ]

  return candidates.find((candidate) => {
    if (candidate === null || candidate === undefined || candidate === '') {
      return false
    }

    return Number.isFinite(Number(candidate))
  })
}

function extractCreatedTestPartId(response) {
  const candidates = [
    response,
    response?.testPartId,
    response?.test_part_id,
    response?.id,
    response?.data,
    response?.data?.testPartId,
    response?.data?.test_part_id,
    response?.data?.id,
    response?.part?.testPartId,
    response?.part?.test_part_id,
    response?.part?.id,
  ]

  return candidates.find((candidate) => {
    if (candidate === null || candidate === undefined || candidate === '') {
      return false
    }

    return Number.isFinite(Number(candidate))
  })
}

function buildBranchMappingsFromSavedMappings(mappings = []) {
  return mappings.map((mapping) => ({
    competencyId: mapping.competencyId ? String(mapping.competencyId) : '',
    competencyName: mapping.competencyName ?? 'Saved branch skill',
    startItem: mapping.startItem ? String(mapping.startItem) : '',
    endItem: mapping.endItem ? String(mapping.endItem) : '',
  }))
}

function AssessmentSetupPage({ user, initialClassId, initialAssessmentId, onNavigate }) {
  const activeUser = user ?? readStoredTeacher()
  const teacherId = activeUser?.id
  const [assessments, setAssessments] = useState([])
  const [studentRecords, setStudentRecords] = useState([])
  const [competencies, setCompetencies] = useState([])
  const [selectedClassAssignment, setSelectedClassAssignment] = useState(null)
  const [selectedAssessmentId, setSelectedAssessmentId] = useState('')
  const [assessmentDetails, setAssessmentDetails] = useState(null)
  const [headerForm, setHeaderForm] = useState(initialHeaderForm)
  const [partForm, setPartForm] = useState(initialPartForm)
  const [draftParts, setDraftParts] = useState([])
  const [savedPartEditIndex, setSavedPartEditIndex] = useState(null)
  const [savedSetupSnapshot, setSavedSetupSnapshot] = useState(null)
  const [pageError, setPageError] = useState('')
  const [pageSuccess, setPageSuccess] = useState('')
  const [headerMessage, setHeaderMessage] = useState({ error: '', success: '' })
  const [partMessage, setPartMessage] = useState({ error: '', success: '' })
  const [detailsError, setDetailsError] = useState('')
  const [isStudentsLoading, setIsStudentsLoading] = useState(false)
  const [isCompetenciesLoading, setIsCompetenciesLoading] = useState(false)
  const [isSetupSaving, setIsSetupSaving] = useState(false)
  const [isDetailsLoading, setIsDetailsLoading] = useState(false)
  const [wizardStep, setWizardStep] = useState(2)

  const selectedClassStudents = useMemo(
    () =>
      studentRecords.filter((student) => studentBelongsToClass(student, selectedClassAssignment)),
    [selectedClassAssignment, studentRecords],
  )

  const selectedAssessment =
    assessments.find((assessment) => String(assessment.id) === String(selectedAssessmentId)) ?? null
  const selectedClassLabel = formatClassAssignmentLabel(selectedClassAssignment)
  const selectedClassShortLabel = formatClassShortLabel(selectedClassAssignment)
  const selectedSubject = selectedClassAssignment?.subjectName || 'Subject not assigned'
  const selectedAssessmentName =
    selectedAssessment?.testName ??
    assessmentDetails?.assessment?.testName ??
    savedSetupSnapshot?.assessment?.testName ??
    headerForm.testName ??
    'Create the assessment details first.'
  const savedParts = assessmentDetails?.parts ?? []
  const reviewParts = savedParts.length ? savedParts : savedSetupSnapshot?.parts ?? draftParts
  const hasSetupParts = reviewParts.length > 0
  const reviewAssessment =
    assessmentDetails?.assessment ?? savedSetupSnapshot?.assessment ?? {
      testName: headerForm.testName,
      testType: headerForm.testType,
      testDate: headerForm.testDate,
      testStatus: headerForm.testStatus,
    }
  const partTotals = getPartTotals(reviewParts)
  const isClassSelected = Boolean(selectedClassAssignment?.classId)
  const isAssessmentSelected = Boolean(selectedAssessmentId)
  const isSavedSetupLocked =
    isAssessmentSelected && Boolean(savedParts.length || savedSetupSnapshot?.parts?.length)
  const isSavedPartEditing = savedPartEditIndex !== null
  const isPartFormLocked = isSetupSaving
  const answerKeyEntries = parseAnswerKeyEntries(partForm.answerKey)
  const answerKeyItemCount = Number(partForm.numberOfItems)
  const answerKeySlotCount =
    Number.isFinite(answerKeyItemCount) && answerKeyItemCount > 0
      ? Math.floor(answerKeyItemCount)
      : 0
  const canBuildAnswerKey = answerKeySlotCount > 0 && Boolean(partForm.partType)
  const parentCompetencyOptions = competencies
  const selectedRootCompetency = parentCompetencyOptions.find(
    (competency) => String(competency.id) === String(partForm.competencyId),
  )
  const branchSkillOptions = selectedRootCompetency?.branches ?? []
  const mappingCoverage = getSkillMappingCoverage(partForm)
  const selectedBranchIds = new Set((partForm.branchMappings ?? []).map((mapping) => String(mapping.competencyId)))
  const isCurrentPartStarted = isPartFormStarted(partForm)
  const loadAssessments = async ({ preserveSuccess = false } = {}) => {
    if (!teacherId) {
      setAssessments([])
      return
    }

    if (!preserveSuccess) {
      setPageSuccess('')
    }

    try {
      const assessmentList = await getTeacherAssessments(teacherId)
      setAssessments(assessmentList)
      setSelectedAssessmentId((currentId) =>
        assessmentList.some((assessment) => String(assessment.id) === String(currentId))
          ? currentId
          : '',
      )
    } catch (loadError) {
      setPageError(loadError.message || 'Unable to load teacher assessments.')
    }
  }

  const loadPageData = async () => {
    if (!teacherId) {
      setPageError('Teacher access is required.')
      return
    }

    setIsStudentsLoading(true)
    setPageError('')

    const [assignmentResult, assessmentResult, studentResult] = await Promise.allSettled([
      getClassAssignments(),
      getTeacherAssessments(teacherId),
      getManualStudents(),
    ])

    if (assignmentResult.status === 'rejected' || assessmentResult.status === 'rejected') {
      setPageError(
        assignmentResult.reason?.message ||
          assessmentResult.reason?.message ||
          'Unable to load assessment setup data.',
      )
      setIsStudentsLoading(false)
      return
    }

    const assignmentList = assignmentResult.value
    const assessmentList = assessmentResult.value

    setAssessments(assessmentList)

    const filteredAssignments = assignmentList.filter(
      (assignment) => Number(assignment.teacherId) === Number(teacherId),
    )
    const preselectedAssignment = initialClassId
      ? filteredAssignments.find((assignment) => Number(assignment.classId) === Number(initialClassId))
      : null

    setSelectedClassAssignment((currentAssignment) => {
      const nextAssignment =
        preselectedAssignment ??
        filteredAssignments.find(
          (assignment) => Number(assignment.classId) === Number(currentAssignment?.classId),
        ) ??
        filteredAssignments[0] ??
        null

      if (nextAssignment) {
        setWizardStep(2)
      }

      return nextAssignment
    })
    setSelectedAssessmentId((currentId) => {
      const preferredAssessmentId =
        initialAssessmentId &&
        assessmentList.some((assessment) => String(assessment.id) === String(initialAssessmentId))
          ? String(initialAssessmentId)
          : currentId

      return assessmentList.some((assessment) => String(assessment.id) === String(preferredAssessmentId))
        ? String(preferredAssessmentId)
        : ''
    })

    if (studentResult.status === 'fulfilled') {
      setStudentRecords(studentResult.value)
    } else {
      setStudentRecords([])
    }

    setIsStudentsLoading(false)
  }

  const loadCompetencies = async (assignment) => {
    if (!assignment?.classId) {
      setCompetencies([])
      return
    }

    setIsCompetenciesLoading(true)
    setPartMessage({ error: '', success: '' })

    try {
      const competencyList = await getCompetencyTree(assignment.gradeLevelId, assignment.subjectId)
      setCompetencies(competencyList)
    } catch (loadError) {
      setPartMessage({
        error: loadError.message || 'Unable to load competency tree for the selected class.',
        success: '',
      })
      setCompetencies([])
    } finally {
      setIsCompetenciesLoading(false)
    }
  }

  const loadAssessmentDetails = async (testId) => {
    if (!testId) {
      setAssessmentDetails(null)
      setDetailsError('')
      return
    }

    setIsDetailsLoading(true)
    setDetailsError('')

    try {
      const detailResult = await getAssessmentDetails(testId)
      const mappingResults = await Promise.allSettled(
        (detailResult.parts ?? []).map((part) =>
          part.id ? getPartSkillMappings(part.id) : Promise.resolve([]),
        ),
      )
      const detailWithMappings = {
        ...detailResult,
        parts: (detailResult.parts ?? []).map((part, index) => ({
          ...part,
          skillMappings:
            mappingResults[index]?.status === 'fulfilled' ? mappingResults[index].value : [],
        })),
      }
      setAssessmentDetails(detailWithMappings)
    } catch (loadError) {
      setDetailsError(loadError.message || 'Unable to load assessment details.')
      setAssessmentDetails(null)
    } finally {
      setIsDetailsLoading(false)
    }
  }

  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  useEffect(() => {
    loadPageData()
  }, [teacherId, initialClassId, initialAssessmentId])

  useEffect(() => {
    if (selectedClassAssignment?.classId) {
      loadCompetencies(selectedClassAssignment)
    } else {
      setCompetencies([])
    }
  }, [selectedClassAssignment?.classId, selectedClassAssignment?.gradeLevelId, selectedClassAssignment?.subjectId])

  useEffect(() => {
    if (selectedAssessmentId) {
      loadAssessmentDetails(selectedAssessmentId)
      setWizardStep(2)
    } else {
      setAssessmentDetails(null)
      setDetailsError('')
    }
  }, [selectedAssessmentId])

  useEffect(() => {
    const loadedAssessment = assessmentDetails?.assessment

    if (!loadedAssessment || !selectedAssessmentId) {
      return
    }

    setHeaderForm({
      testName: loadedAssessment.testName ?? '',
      testType: loadedAssessment.testType ?? '',
      testDate: loadedAssessment.testDate ?? '',
      testStatus: getAutomaticAssessmentStatus(loadedAssessment.testStatus),
    })
    setSavedSetupSnapshot({
      assessment: loadedAssessment,
      parts: assessmentDetails?.parts ?? [],
    })
    setSavedPartEditIndex(null)
    setDraftParts([])
    setPartForm(initialPartForm)
    setHeaderMessage({ error: '', success: '' })
    setPartMessage({ error: '', success: '' })
  }, [assessmentDetails, selectedAssessmentId])
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  const handleHeaderChange = (event) => {
    const { name, value } = event.target
    setHeaderForm((currentForm) => ({ ...currentForm, [name]: value }))
  }

  const handlePartChange = (event) => {
    const { name, value } = event.target
    setPartForm((currentForm) => ({
      ...currentForm,
      [name]: value,
      answerKey: name === 'partType' && value !== currentForm.partType ? '' : currentForm.answerKey,
    }))
  }

  const handleParentCompetencyChange = (event) => {
    const { value } = event.target
    setPartForm((currentForm) => ({
      ...currentForm,
      competencyId: value,
      branchMappings: [],
    }))
  }

  const handleBranchSkillToggle = (branch, isChecked) => {
    setPartForm((currentForm) => {
      const currentMappings = currentForm.branchMappings ?? []

      if (!isChecked) {
        return {
          ...currentForm,
          branchMappings: currentMappings.filter(
            (mapping) => String(mapping.competencyId) !== String(branch.id),
          ),
        }
      }

      if (currentMappings.some((mapping) => String(mapping.competencyId) === String(branch.id))) {
        return currentForm
      }

      return {
        ...currentForm,
        branchMappings: [
          ...currentMappings,
          {
            competencyId: String(branch.id),
            competencyName: branch.label ?? branch.name,
            startItem: '',
            endItem: '',
          },
        ],
      }
    })
  }

  const handleBranchMappingChange = (competencyId, field, value) => {
    setPartForm((currentForm) => ({
      ...currentForm,
      branchMappings: (currentForm.branchMappings ?? []).map((mapping) =>
        String(mapping.competencyId) === String(competencyId)
          ? { ...mapping, [field]: value }
          : mapping,
      ),
    }))
  }

  const handleAnswerKeyEntryChange = (index, value) => {
    const nextEntries = Array.from({ length: answerKeySlotCount }, (_, itemIndex) =>
      itemIndex === index ? value.replace(/,/g, ' ').trimStart() : answerKeyEntries[itemIndex] ?? '',
    )

    setPartForm((currentForm) => ({
      ...currentForm,
      answerKey: buildAnswerKey(nextEntries),
    }))
  }

  const handleAddDraftPart = async (event) => {
    event.preventDefault()
    setPartMessage({ error: '', success: '' })

    const validationError = validatePartForm(partForm)

    if (validationError) {
      setPartMessage({ error: validationError, success: '' })
      return
    }

    const nextPart = buildDraftPartFromForm(partForm, competencies)

    if (isSavedPartEditing) {
      setAssessmentDetails((currentDetails) => {
        if (!currentDetails) {
          return currentDetails
        }

        return {
          ...currentDetails,
          parts: currentDetails.parts.map((part, index) =>
            index === savedPartEditIndex ? { ...part, ...nextPart } : part,
          ),
        }
      })
      setSavedSetupSnapshot((currentSnapshot) =>
        currentSnapshot
          ? {
              ...currentSnapshot,
              parts: (currentSnapshot.parts ?? []).map((part, index) =>
                index === savedPartEditIndex ? { ...part, ...nextPart } : part,
              ),
            }
          : currentSnapshot,
      )
      setSavedPartEditIndex(null)
      setPartForm(initialPartForm)
      setPartMessage({ error: '', success: 'Saved section loaded into the form was updated in this view.' })
      return
    }

    if (isAssessmentSelected) {
      setIsSetupSaving(true)

      try {
        const testPartResponse = await createTestPart(
          selectedAssessmentId,
          buildTestPartPayload(nextPart),
        )
        const createdTestPartId = extractCreatedTestPartId(testPartResponse)

        if (!createdTestPartId) {
          throw new Error(
            'A test part was created, but the system could not continue to its branch skill mapping. Please refresh and review the saved assessment.',
          )
        }

        await savePartSkillMappings({
          testPartId: Number(createdTestPartId),
          mappings: buildSkillMappingPayload(nextPart),
        })

        setSavedPartEditIndex(null)
        setPartForm(initialPartForm)
        await loadAssessmentDetails(selectedAssessmentId)
        setPartMessage({ error: '', success: 'New section added to the saved assessment.' })
        setPageSuccess('Assessment section added and ready for mobile sync.')
      } catch (addPartError) {
        setPartMessage({
          error: addPartError.message || 'Unable to add another section to this assessment.',
          success: '',
        })
      } finally {
        setIsSetupSaving(false)
      }

      return
    }

    setDraftParts((currentParts) => [
      ...currentParts,
      nextPart,
    ])
    setPartForm(initialPartForm)
    setPartMessage({ error: '', success: 'Test part added to this assessment setup.' })
  }

  const handleStartNewPart = () => {
    setSavedPartEditIndex(null)
    setPartForm(initialPartForm)
    setPartMessage({ error: '', success: 'Ready to add another section.' })
  }

  const handleRemoveDraftPart = (indexToRemove) => {
    setDraftParts((currentParts) =>
      currentParts.filter((_, index) => index !== indexToRemove),
    )
  }

  const handleEditDraftPart = (indexToEdit) => {
    const partToEdit = draftParts[indexToEdit]

    if (!partToEdit) {
      return
    }

    setPartForm({
      competencyId: partToEdit.competencyId ? String(partToEdit.competencyId) : '',
      partOrder: partToEdit.partOrder ?? '',
      partType: partToEdit.partType ?? '',
      numberOfItems: partToEdit.numberOfItems ? String(partToEdit.numberOfItems) : '',
      pointsPerItem: partToEdit.pointsPerItem ? String(partToEdit.pointsPerItem) : '',
      answerKey: partToEdit.answerKey ?? '',
      mappingMode: 'RANGE',
      branchMappings: (partToEdit.branchMappings ?? []).map((mapping) => ({
        competencyId: mapping.competencyId ? String(mapping.competencyId) : '',
        competencyName: mapping.competencyName ?? 'Selected branch skill',
        startItem: mapping.startItem ? String(mapping.startItem) : '',
        endItem: mapping.endItem ? String(mapping.endItem) : '',
      })),
    })
    setSavedPartEditIndex(null)
    setDraftParts((currentParts) => currentParts.filter((_, index) => index !== indexToEdit))
    setPartMessage({ error: '', success: 'Test part loaded for editing.' })
  }

  const handleEditSavedPart = (indexToEdit) => {
    const partToEdit = savedParts[indexToEdit]

    if (!partToEdit) {
      return
    }

    setSavedPartEditIndex(indexToEdit)
    setPartForm({
      competencyId: partToEdit.competencyId ? String(partToEdit.competencyId) : '',
      partOrder: partToEdit.partOrder ?? '',
      partType: partToEdit.partType ?? '',
      numberOfItems: partToEdit.numberOfItems ? String(partToEdit.numberOfItems) : '',
      pointsPerItem: partToEdit.pointsPerItem ? String(partToEdit.pointsPerItem) : '',
      answerKey: partToEdit.answerKey ?? '',
      mappingMode: 'RANGE',
      branchMappings: buildBranchMappingsFromSavedMappings(partToEdit.skillMappings ?? []),
    })
    setPartMessage({ error: '', success: 'Saved section loaded into the form for editing.' })
  }

  const handleCancelSavedPartEdit = () => {
    setSavedPartEditIndex(null)
    setPartForm(initialPartForm)
    setPartMessage({ error: '', success: '' })
  }

  const handleSaveCompleteSetup = async () => {
    setHeaderMessage({ error: '', success: '' })
    setPartMessage({ error: '', success: '' })
    setDetailsError('')
    setPageSuccess('')

    if (!selectedClassAssignment?.classId) {
      setHeaderMessage({ error: 'Please select a class first.', success: '' })
      setWizardStep(2)
      return
    }

    if (!headerForm.testName.trim() || !headerForm.testType.trim() || !headerForm.testDate) {
      setHeaderMessage({ error: 'Test name, type, and date are required.', success: '' })
      setWizardStep(2)
      return
    }

    if (isAssessmentSelected && hasSetupParts && !draftParts.length && !isCurrentPartStarted) {
      setPageSuccess('Assessment setup is already saved and ready for mobile sync.')
      setWizardStep(3)
      return
    }

    if (isCurrentPartStarted) {
      const validationError = validatePartForm(partForm)

      if (validationError) {
        setPartMessage({ error: validationError, success: '' })
        setWizardStep(2)
        return
      }
    }

    const partsToSave = isCurrentPartStarted
      ? [...draftParts, buildDraftPartFromForm(partForm, competencies)]
      : draftParts

    if (!partsToSave.length) {
      setPartMessage({ error: 'Add at least one test part before saving.', success: '' })
      setWizardStep(2)
      return
    }

    setIsSetupSaving(true)

    try {
      const assessmentPayload = {
        classId: Number(selectedClassAssignment.classId),
        testName: headerForm.testName.trim(),
        testType: headerForm.testType.trim(),
        testDate: headerForm.testDate,
        testStatus: 'Active',
      }

      const response = await createAssessment(assessmentPayload)
      const createdTestId = extractCreatedAssessmentId(response)

      if (!createdTestId) {
        throw new Error(
          'Assessment was created, but the system could not continue to its sections. Please refresh and select the saved assessment.',
        )
      }

      for (const draftPart of partsToSave) {
        const testPartResponse = await createTestPart(createdTestId, buildTestPartPayload(draftPart))
        const createdTestPartId = extractCreatedTestPartId(testPartResponse)

        if (!createdTestPartId) {
          throw new Error(
            'A test part was created, but the system could not continue to its branch skill mapping. Please refresh and review the saved assessment.',
          )
        }

        await savePartSkillMappings({
          testPartId: Number(createdTestPartId),
          mappings: buildSkillMappingPayload(draftPart),
        })
      }

      setSavedSetupSnapshot({
        assessment: assessmentPayload,
        parts: partsToSave,
      })
      setSelectedAssessmentId(String(createdTestId))
      setHeaderMessage({ error: '', success: 'Assessment setup saved.' })
      setPageSuccess('Assessment setup saved and ready for mobile sync.')
      await loadAssessments({ preserveSuccess: true })
      setSelectedAssessmentId(String(createdTestId))
      await loadAssessmentDetails(createdTestId)
      setDraftParts([])
      setPartForm(initialPartForm)
      setWizardStep(3)
    } catch (submitError) {
      setHeaderMessage({
        error: submitError.message || 'Unable to save the complete assessment setup.',
        success: '',
      })
    } finally {
      setIsSetupSaving(false)
    }
  }

  const handleFinishSetup = () => {
    handleSaveCompleteSetup()
  }

  const renderAnswerKeyInput = (index) => {
    const value = answerKeyEntries[index] ?? ''
    const itemLabel = `Item ${index + 1}`

    if (partForm.partType === 'Multiple Choice') {
      return (
        <div className="answer-key-choice-item is-multiple-choice" key={itemLabel}>
          <span>Q{index + 1}</span>
          <div>
            {MULTIPLE_CHOICE_OPTIONS.map((option) => (
              <button
                type="button"
                className={value === option ? 'is-selected' : ''}
                disabled={isPartFormLocked}
                key={option}
                onClick={() => handleAnswerKeyEntryChange(index, option)}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      )
    }

    if (partForm.partType === 'True or False') {
      return (
        <div className="answer-key-choice-item is-true-false" key={itemLabel}>
          <span>Q{index + 1}</span>
          <div>
            {TRUE_FALSE_OPTIONS.map((option) => (
              <button
                type="button"
                className={value === option ? 'is-selected' : ''}
                disabled={isPartFormLocked}
                key={option}
                onClick={() => handleAnswerKeyEntryChange(index, option)}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      )
    }

    return (
      <label className="answer-key-item" key={itemLabel}>
        <span>Q{index + 1}</span>
        <input
          value={value}
          onChange={(event) => handleAnswerKeyEntryChange(index, event.target.value)}
          placeholder="Accepted answer"
          disabled={isPartFormLocked}
        />
      </label>
    )
  }

  if (!teacherId) {
    return (
      <div className="content-stack assessment-builder-page">
        <section className="hero-panel">
          <p className="section-tag">Assessment Setup</p>
          <h2>Teacher access is required.</h2>
          <p className="supporting-text">
            Sign in with a teacher account to create assessments and add their sections.
          </p>
        </section>
      </div>
    )
  }

  return (
    <div className="assessment-create-page">
    <div className="content-stack assessment-builder-page">
      <button
        type="button"
        className="assessment-back-link"
        onClick={() =>
          onNavigate?.('class-records', { classId: selectedClassAssignment?.classId ?? initialClassId })
        }
      >
        Back to {selectedClassShortLabel}
      </button>

      <section className="assessment-create-heading">
        <h2>{isAssessmentSelected ? 'Assessment Setup' : 'Create New Assessment'}</h2>
        <p>
          {selectedClassShortLabel}, {selectedSubject},{' '}
          {isStudentsLoading ? 'loading students' : `${selectedClassStudents.length} students`}
        </p>
      </section>

      {pageError ? <p className="form-message form-message-error">{pageError}</p> : null}
      {pageSuccess ? <p className="form-message form-message-success">{pageSuccess}</p> : null}

      {wizardStep === 2 ? (
      <>
      <section className={`builder-section ${!isClassSelected ? 'is-locked' : ''}`}>
        <div className="builder-section-heading">
          <span className="assessment-section-icon" aria-hidden="true">
            <Info size={18} strokeWidth={2.2} />
          </span>
          <div>
            <h3>Assessment Details</h3>
            <p className="supporting-text">
              Add the details for the whole paper-based quiz or exam.
            </p>
          </div>
        </div>

        {headerMessage.error ? (
          <p className="form-message form-message-error">{headerMessage.error}</p>
        ) : null}
        {headerMessage.success ? (
          <p className="form-message form-message-success">{headerMessage.success}</p>
        ) : null}

        <form className="builder-form-grid" onSubmit={(event) => event.preventDefault()}>
          <label className="field-group" htmlFor="assessmentTestName">
            <span>Assessment Name</span>
            <input
              id="assessmentTestName"
              name="testName"
              value={headerForm.testName}
              onChange={handleHeaderChange}
              placeholder="Example: Quarter 1 Math Test"
              disabled={!isClassSelected || isSavedSetupLocked}
            />
          </label>

          <label className="field-group" htmlFor="assessmentTestType">
            <span>Assessment Type</span>
            <select
              id="assessmentTestType"
              name="testType"
              value={headerForm.testType}
              onChange={handleHeaderChange}
              disabled={!isClassSelected || isSavedSetupLocked}
            >
              <option value="">Select assessment type</option>
              {ASSESSMENT_TYPE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="field-group" htmlFor="assessmentTestDate">
            <span>Assessment Date</span>
            <input
              id="assessmentTestDate"
              name="testDate"
              type="date"
              value={headerForm.testDate}
              onChange={handleHeaderChange}
              disabled={!isClassSelected || isSavedSetupLocked}
            />
          </label>

          <label className="field-group" htmlFor="assessmentTestStatus">
            <span>Assessment Status</span>
            <input
              id="assessmentTestStatus"
              name="testStatus"
              value={headerForm.testStatus}
              readOnly
              disabled
            />
          </label>

        </form>
        <div className="draft-part-list">
          <p className="content-card-tag">Sections in this Assessment</p>
          {!hasSetupParts ? (
            <p className="supporting-text">No assessment sections added yet.</p>
          ) : null}
          {reviewParts.map((part, index) => {
            const isDraftPart = draftParts.includes(part)

            return (
              <article className="draft-part-card" key={part.id ?? `${part.partOrder}-${index}`}>
                <div>
                  <strong>{part.partOrder}</strong>
                  <span>
                    {part.partType} - {part.numberOfItems} items x {part.pointsPerItem} point(s)
                  </span>
                  <small>Parent: {part.competencyName || 'Competency not assigned'}</small>
                  {part.branchMappings?.length || part.skillMappings?.length ? (
                    <small>
                      Branch skills:{' '}
                      {(part.branchMappings ?? part.skillMappings ?? [])
                        .map((mapping) => mapping.competencyName)
                        .filter(Boolean)
                        .join(', ')}
                    </small>
                  ) : null}
                </div>
                {isDraftPart ? (
                  <div className="draft-part-actions">
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => handleEditDraftPart(index)}
                    >
                      <Pencil size={16} strokeWidth={2.2} />
                      Edit
                    </button>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => handleRemoveDraftPart(index)}
                    >
                      <Trash2 size={16} strokeWidth={2.2} />
                      Remove
                    </button>
                  </div>
                ) : (
                  <div className="draft-part-actions">
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => handleEditSavedPart(index)}
                    >
                      <Pencil size={16} strokeWidth={2.2} />
                      Edit
                    </button>
                    <span className="status-pill status-approved">Saved</span>
                  </div>
                )}
              </article>
            )
          })}
        </div>
      </section>

      <section className={`builder-section ${!isClassSelected ? 'is-locked' : ''}`}>
        <div className="builder-section-heading">
          <span className="assessment-section-icon" aria-hidden="true">
            <PlusCircle size={18} strokeWidth={2.2} />
          </span>
          <div>
            <h3>{isSavedPartEditing ? 'Edit Assessment Section' : 'Add New Assessment Section'}</h3>
            <p className="supporting-text">
              {isSavedPartEditing
                ? 'Update the selected saved section, then return to add-new-section mode.'
                : 'Add another section of this assessment, such as Multiple Choice, Identification, or Enumeration.'}
            </p>
          </div>
          {isAssessmentSelected ? (
            <button
              type="button"
              className="secondary-button"
              onClick={handleStartNewPart}
              disabled={isSetupSaving}
            >
              <PlusCircle size={16} strokeWidth={2.2} />
              New Section
            </button>
          ) : null}
        </div>

        {partMessage.error ? <p className="form-message form-message-error">{partMessage.error}</p> : null}
        {partMessage.success ? (
          <p className="form-message form-message-success">{partMessage.success}</p>
        ) : null}

        <form className="test-part-builder" onSubmit={handleAddDraftPart}>
          <div className="builder-form-grid">
            <label className="field-group" htmlFor="partOrder">
              <span>Section Label / Order</span>
              <input
                id="partOrder"
                name="partOrder"
                value={partForm.partOrder}
                onChange={handlePartChange}
                placeholder="Example: Part I"
                disabled={!isClassSelected || isPartFormLocked}
              />
            </label>

            <label className="field-group" htmlFor="partType">
              <span>Section Type</span>
              <select
                id="partType"
                name="partType"
                value={partForm.partType}
                onChange={handlePartChange}
                disabled={!isClassSelected || isPartFormLocked}
              >
                <option value="">Select section type</option>
                {PART_TYPE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="field-group" htmlFor="partItems">
              <span>Number of Items</span>
              <input
                id="partItems"
                name="numberOfItems"
                type="number"
                min="1"
                value={partForm.numberOfItems}
                onChange={handlePartChange}
                placeholder="Example: 10"
                disabled={!isClassSelected || isPartFormLocked}
              />
            </label>

            <label className="field-group" htmlFor="partPoints">
              <span>Points Per Item</span>
              <input
                id="partPoints"
                name="pointsPerItem"
                type="number"
                min="1"
                value={partForm.pointsPerItem}
                onChange={handlePartChange}
                placeholder="Example: 1"
                disabled={!isClassSelected || isPartFormLocked}
              />
            </label>

            <div className="competency-mapping-panel builder-form-wide">
              <div className="competency-mapping-header">
                <div>
                  <span className="content-card-tag">Item Coverage</span>
                  <h4>Which skill does each item measure?</h4>
                  <p className="field-helper-text">
                    Map item numbers to branch skills so the system can identify least mastered
                    skills more accurately.
                  </p>
                </div>
                <span className="status-pill status-approved">
                  {mappingCoverage.mappedItemCount}/{mappingCoverage.totalItems || 0} mapped
                </span>
              </div>

              <div className="competency-mapping-grid">
                <label className="field-group" htmlFor="partCompetencyId">
                  <span>Parent Competency</span>
                  <select
                    id="partCompetencyId"
                    name="competencyId"
                    value={partForm.competencyId}
                    onChange={handleParentCompetencyChange}
                    disabled={!isClassSelected || isCompetenciesLoading || isPartFormLocked}
                  >
                    <option value="">
                      {isCompetenciesLoading
                        ? 'Loading parent competencies...'
                        : parentCompetencyOptions.length
                          ? 'Select parent competency'
                          : 'No parent competencies found for this class.'}
                    </option>
                    {parentCompetencyOptions.map((competency) => (
                      <option key={competency.id} value={competency.id}>
                        {competency.label}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="field-group mapping-mode-note" aria-label="Mapping behavior">
                  <span>Mapping Behavior</span>
                  <strong>Range-based item mapping</strong>
                </div>
              </div>

              <div className="branch-skill-list">
                <div className="branch-skill-list-heading">
                  <strong>Branch Skills / Learning Skills</strong>
                  <span>
                    {selectedRootCompetency
                      ? `${branchSkillOptions.length} skill(s) under ${selectedRootCompetency.label}`
                      : 'Select a parent competency first'}
                  </span>
                </div>

                {!selectedRootCompetency ? (
                  <p className="form-helper-text">Choose a parent competency to show branch skills.</p>
                ) : null}

                {branchSkillOptions.map((branch) => {
                  const branchMapping = (partForm.branchMappings ?? []).find(
                    (mapping) => String(mapping.competencyId) === String(branch.id),
                  )
                  const isChecked = selectedBranchIds.has(String(branch.id))

                  return (
                    <div className="branch-skill-row" key={branch.id}>
                      <label className="branch-skill-check">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={isPartFormLocked}
                          onChange={(event) => handleBranchSkillToggle(branch, event.target.checked)}
                        />
                        <span>{branch.label}</span>
                      </label>

                      {isChecked ? (
                        <div className="range-inputs">
                          <label>
                            <span>Start</span>
                            <input
                              type="number"
                              min="1"
                              max={answerKeySlotCount || undefined}
                              value={branchMapping?.startItem ?? ''}
                              onChange={(event) =>
                                handleBranchMappingChange(branch.id, 'startItem', event.target.value)
                              }
                              disabled={isPartFormLocked}
                            />
                          </label>
                          <label>
                            <span>End</span>
                            <input
                              type="number"
                              min="1"
                              max={answerKeySlotCount || undefined}
                              value={branchMapping?.endItem ?? ''}
                              onChange={(event) =>
                                handleBranchMappingChange(branch.id, 'endItem', event.target.value)
                              }
                              disabled={isPartFormLocked}
                            />
                          </label>
                          <label>
                            <span>Item Count</span>
                            <input
                              value={getRangeItemCount(branchMapping)}
                              readOnly
                              aria-label={`${branch.label} item count`}
                            />
                          </label>
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>

              <div className="mapping-preview-panel">
                <strong>Item Coverage</strong>
                {mappingCoverage.mappings.length ? (
                  <div className="mapping-preview-list">
                    {mappingCoverage.mappings.map((mapping) => (
                      <span key={mapping.competencyId}>
                        {mapping.competencyName}: items {mapping.startItem}-{mapping.endItem}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="form-helper-text">No branch skill item mapping yet.</p>
                )}

                {mappingCoverage.errors.map((error) => (
                  <p className="form-message form-message-error" key={error}>
                    {error}
                  </p>
                ))}

                {mappingCoverage.warnings.map((warning) => (
                  <p className="form-message form-message-warning" key={warning}>
                    {warning}
                  </p>
                ))}
              </div>
            </div>
          </div>

          <div className="answer-key-builder">
            <div>
              <p className="content-card-tag">Answer Key</p>
              <h3>Enter one answer per item</h3>
              <p className="supporting-text">
                Enter the correct answer for each item in this section.
              </p>
            </div>

            {!canBuildAnswerKey ? (
              <p className="form-helper-text">
                Select a section type and enter the number of items to build the answer key.
              </p>
            ) : (
              <div className="answer-key-grid">
                {Array.from({ length: answerKeySlotCount }, (_, index) => renderAnswerKeyInput(index))}
              </div>
            )}
          </div>

          <div className="builder-form-actions">
            {isSavedPartEditing ? (
              <button
                type="button"
                className="secondary-button"
                onClick={handleCancelSavedPartEdit}
              >
                Cancel Edit
              </button>
            ) : null}
            <button
              type="submit"
              className="primary-button"
              disabled={!isClassSelected || isPartFormLocked}
              >
                <PlusCircle size={18} strokeWidth={2.3} />
                {isSetupSaving
                  ? 'Saving...'
                  : isSavedPartEditing
                    ? 'Apply Section Change'
                    : isAssessmentSelected
                      ? 'Add Another Section'
                      : 'Add Section'}
              </button>
            </div>
          </form>

      </section>
      <div className="builder-wizard-actions">
        <button
          type="button"
          className="primary-button"
          disabled={isSetupSaving || isSavedSetupLocked}
          onClick={handleSaveCompleteSetup}
        >
          {isSetupSaving ? 'Saving...' : isSavedSetupLocked ? 'Saved' : 'Save Assessment Setup'}
        </button>
        <button
          type="button"
          className="secondary-button"
          onClick={() =>
            onNavigate?.('class-records', {
              classId: selectedClassAssignment?.classId ?? initialClassId,
            })
          }
        >
          Cancel
        </button>
      </div>
      </>
      ) : null}

      {wizardStep === 3 ? (
      <section className="builder-section">
        <div className="builder-section-heading">
          <span className="builder-step-label">Step 3</span>
          <div>
            <h3>Review Setup</h3>
            <p className="supporting-text">
              Confirm the class, assessment details, sections, answer keys, and competency tags
              before saving for mobile checking.
            </p>
          </div>
        </div>

        <div className="review-summary-grid">
          <article>
            <span>Selected Class</span>
            <strong>{isClassSelected ? selectedClassLabel : 'Choose a class'}</strong>
          </article>
          <article>
            <span>Selected Assessment</span>
            <strong>{reviewAssessment.testName || selectedAssessmentName}</strong>
          </article>
          <article>
            <span>Assessment Type</span>
            <strong>{reviewAssessment.testType || 'Not assigned'}</strong>
          </article>
          <article>
            <span>Assessment Date</span>
            <strong>{formatDate(reviewAssessment.testDate)}</strong>
          </article>
          <article>
            <span>Total Items</span>
            <strong>{partTotals.items}</strong>
          </article>
          <article>
            <span>Total Points</span>
            <strong>{partTotals.points}</strong>
          </article>
          <article>
            <span>Sections</span>
            <strong>{reviewParts.length}</strong>
          </article>
        </div>

        {detailsError ? <p className="form-message form-message-error">{detailsError}</p> : null}

        <div className="compact-table-wrap">
          <table className="compact-table saved-parts-table">
            <thead>
              <tr>
                <th>Section</th>
                <th>Type</th>
                <th>Items</th>
                <th>Points Each</th>
                <th>Competency Tag</th>
                <th>Answer Key</th>
              </tr>
            </thead>
            <tbody>
              {isDetailsLoading ? (
                <tr>
                  <td className="approval-empty" colSpan="6">
                    Loading assessment sections...
                  </td>
                </tr>
              ) : null}

              {!isDetailsLoading && !reviewParts.length ? (
                <tr>
                  <td className="approval-empty" colSpan="6">
                    No assessment sections added to this setup yet.
                  </td>
                </tr>
              ) : null}

              {!isDetailsLoading
                ? reviewParts.map((part, index) => (
                    <tr key={part.id ?? `${part.partOrder}-${index}`}>
                      <td>{part.partOrder || '-'}</td>
                      <td>{part.partType || '-'}</td>
                      <td>{part.numberOfItems || '-'}</td>
                      <td>{part.pointsPerItem || '-'}</td>
                      <td>
                        <strong>{part.competencyName || 'Not assigned'}</strong>
                        {part.skillMappings?.length ? (
                          <small className="table-cell-note">
                            Branches:{' '}
                            {part.skillMappings
                              .map((mapping) => mapping.competencyName)
                              .filter(Boolean)
                              .join(', ')}
                          </small>
                        ) : null}
                      </td>
                      <td>{part.answerKey || '-'}</td>
                    </tr>
                  ))
                : null}
            </tbody>
          </table>
        </div>

        <div className="builder-wizard-actions">
          <button type="button" className="secondary-button" onClick={() => setWizardStep(2)}>
            Back to Edit
          </button>
          <button
            type="button"
            className="primary-button"
            disabled={isSetupSaving || isSavedSetupLocked}
            onClick={handleFinishSetup}
          >
            {isSetupSaving ? 'Saving...' : isSavedSetupLocked ? 'Saved / Ready' : 'Save / Finish Setup'}
          </button>
        </div>
      </section>
      ) : null}
    </div>
    </div>
  )
}

export default AssessmentSetupPage

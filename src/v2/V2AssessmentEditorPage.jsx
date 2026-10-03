import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CirclePlus,
  CopyPlus,
  LoaderCircle,
  Printer,
  Save,
  Trash2,
} from 'lucide-react'

import {
  activateAssessmentV3,
  createAssessmentV3,
  downloadAnswerSheetPdfV3,
  generateAnswerSheetVersionV3,
  getAnswerSheetEligibilityV3,
  getAssessmentReferenceDataV3,
  getAssessmentV3,
  updateAssessmentV3,
} from '@/api/apiV3Client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { DateTimePicker } from '@/components/ui/date-time-picker'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
const TEST_TYPES = [
  ['quiz', 'Quiz'],
  ['exam', 'Exam'],
  ['diagnostic', 'Diagnostic'],
  ['long_test', 'Long test'],
  ['other', 'Other'],
]

const SUPPORTED_QUESTION_TYPE_CODES = new Set([
  'multiple_choice',
  'true_false',
  'identification',
  'enumeration',
  'essay',
])

const MATCHING_MODES = [
  ['normalized', 'Normalized'],
  ['exact', 'Exact'],
]

const TEXTAREA_CLASS = 'min-h-20 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-70'

function formatCodeLabel(value) {
  if (!value) return ''
  return String(value)
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function emptyRubricCriterion(criterionOrder, maximumPoints = 1) {
  return {
    criterionOrder,
    criterionName: '',
    criterionDescription: '',
    maximumPoints,
    required: true,
  }
}

function emptyEnumerationAnswer(answerOrder, points = 0) {
  return {
    answerOrder,
    primaryAnswer: '',
    variants: [],
    points,
  }
}

function emptyQuestion(itemNumber, partType = '', maximumPoints = 1, questionText = '') {
  const common = {
    itemNumber,
    questionText,
  }

  if (partType === 'multiple_choice') {
    return {
      ...common,
      optionA: '',
      optionB: '',
      optionC: '',
      optionD: '',
      correctOption: '',
      answerExplanation: '',
    }
  }

  if (partType === 'true_false') {
    return {
      ...common,
      correctOption: '',
    }
  }

  if (partType === 'identification') {
    return {
      ...common,
      acceptedAnswers: [{ acceptedText: '' }],
      matchingMode: 'normalized',
      caseSensitive: false,
      maximumResponseLength: '',
      responseRegionSize: '',
    }
  }

  if (partType === 'enumeration') {
    return {
      ...common,
      expectedResponseCount: 1,
      enumerationAnswers: [emptyEnumerationAnswer(1, maximumPoints)],
      matchingMode: 'normalized',
      caseSensitive: false,
      maximumResponseLength: '',
      responseRegionSize: '',
    }
  }

  if (partType === 'essay') {
    return {
      ...common,
      responseInstructions: '',
      maximumResponseLength: '',
      responseRegionSize: '',
      forcePageBreakBefore: false,
      scoringMode: 'manual',
      rubricSource: 'existing',
      rubricId: '',
      inlineRubric: {
        rubricName: '',
        description: '',
        criteria: [emptyRubricCriterion(1, maximumPoints)],
      },
    }
  }

  return common
}

function emptyPart(partOrder) {
  return {
    partOrder,
    partName: '',
    partType: '',
    pointsPerItem: 1,
    questions: [emptyQuestion(1)],
    skillMappings: [
      { fromItemNumber: 1, toItemNumber: 1, rootTagId: '', skillIds: [] },
    ],
    expanded: true,
  }
}

function supportedQuestionTypes(referenceData) {
  return (referenceData.questionTypes ?? []).filter((type) => (
    SUPPORTED_QUESTION_TYPE_CODES.has(type.code)
  ))
}

function toDateTimeLocal(value) {
  if (!value) return ''

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return localDate.toISOString().slice(0, 16)
}

function toInstant(value) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function hydrateSkillMappings(part, skills) {
  const groupedMappings = new Map()

  ;(part.skillMappings ?? []).forEach((mapping) => {
    const fromItemNumber = mapping.startItemNumber ?? mapping.fromItemNumber
    const toItemNumber = mapping.endItemNumber ?? mapping.toItemNumber
    const key = `${fromItemNumber}:${toItemNumber}`
    const current = groupedMappings.get(key) ?? {
      fromItemNumber,
      toItemNumber,
      rootTagId: '',
      skillIds: [],
    }

    if (mapping.skillId) current.skillIds.push(Number(mapping.skillId))
    if (Array.isArray(mapping.skillIds)) {
      current.skillIds.push(...mapping.skillIds.map(Number))
    }
    groupedMappings.set(key, current)
  })

  const mappings = Array.from(groupedMappings.values())
    .map((mapping) => ({
      ...mapping,
      skillIds: [...new Set(mapping.skillIds.map(Number))].sort((left, right) => left - right),
    }))
    .sort(
      (left, right) =>
        Number(left.fromItemNumber) - Number(right.fromItemNumber) ||
        Number(left.toItemNumber) - Number(right.toItemNumber),
    )

  const compactedMappings = mappings.reduce((ranges, mapping) => {
    const previous = ranges[ranges.length - 1]
    const hasSameSkills =
      previous && previous.skillIds.join(':') === mapping.skillIds.join(':')
    const isNextRange =
      previous && Number(previous.toItemNumber) + 1 === Number(mapping.fromItemNumber)

    if (hasSameSkills && isNextRange) {
      ranges[ranges.length - 1] = {
        ...previous,
        toItemNumber: mapping.toItemNumber,
      }
      return ranges
    }

    ranges.push(mapping)
    return ranges
  }, [])

  const hydratedMappings = compactedMappings.map((mapping) => {
    const selectedSkill = skills.find(
      (skill) => String(skill.skillId) === String(mapping.skillIds[0]),
    )
    return {
      ...mapping,
      rootTagId: selectedSkill?.rootTagId ? String(selectedSkill.rootTagId) : '',
    }
  })

  return hydratedMappings.length
    ? hydratedMappings
    : [{ fromItemNumber: 1, toItemNumber: 1, rootTagId: '', skillIds: [] }]
}

function optionText(question, optionKey) {
  return question.options?.find((option) => option.optionKey === optionKey)?.optionText ??
    question[`option${optionKey}`] ??
    ''
}

function hydrateEnumerationAnswers(question, maximumPoints) {
  const acceptedAnswers = question.acceptedAnswers ?? []
  const largestOrder = acceptedAnswers.reduce(
    (largest, answer) => Math.max(largest, Number(answer.answerOrder) || 0),
    0,
  )
  const expectedResponseCount = Math.max(
    1,
    Number(question.expectedResponseCount) || largestOrder || 1,
  )

  return {
    expectedResponseCount,
    enumerationAnswers: Array.from({ length: expectedResponseCount }, (_, index) => {
      const answerOrder = index + 1
      const variants = acceptedAnswers
        .filter((answer) => Number(answer.answerOrder) === answerOrder)
        .sort((left, right) => Number(right.primary) - Number(left.primary))
      const primary = variants.find((answer) => answer.primary) ?? variants[0]

      return {
        answerOrder,
        primaryAnswer: primary?.acceptedText ?? '',
        variants: variants
          .filter((answer) => answer !== primary)
          .map((answer) => ({ acceptedText: answer.acceptedText ?? '' })),
        points: primary?.points ?? (expectedResponseCount === 1 ? maximumPoints : 0),
      }
    }),
  }
}

function hydrateQuestion(question, questionIndex, partType, pointsPerItem, rubrics) {
  const itemNumber = question.itemNumber ?? questionIndex + 1
  const questionText = question.questionText ?? ''

  if (partType === 'multiple_choice') {
    return {
      itemNumber,
      questionText,
      optionA: optionText(question, 'A'),
      optionB: optionText(question, 'B'),
      optionC: optionText(question, 'C'),
      optionD: optionText(question, 'D'),
      correctOption:
        question.answerKey?.correctOptionKey ?? question.correctOptionKey ?? question.correctOption ?? '',
      answerExplanation:
        question.answerKey?.answerExplanation ?? question.answerExplanation ?? '',
    }
  }

  if (partType === 'true_false') {
    return {
      itemNumber,
      questionText,
      correctOption:
        question.answerKey?.correctOptionKey ?? question.correctOptionKey ?? question.correctOption ?? '',
    }
  }

  if (partType === 'identification') {
    const acceptedAnswers = [...(question.acceptedAnswers ?? [])]
      .sort((left, right) => Number(right.primary) - Number(left.primary))

    return {
      itemNumber,
      questionText,
      acceptedAnswers: acceptedAnswers.length
        ? acceptedAnswers.map((answer) => ({ acceptedText: answer.acceptedText ?? '' }))
        : [{ acceptedText: '' }],
      matchingMode:
        acceptedAnswers[0]?.matchingMode ?? question.matchingMode ?? 'normalized',
      caseSensitive: acceptedAnswers.length
        ? acceptedAnswers.every((answer) => Boolean(answer.caseSensitive))
        : false,
      maximumResponseLength: question.maximumResponseLength ?? '',
      responseRegionSize: question.responseRegionSize === 'none'
        ? ''
        : question.responseRegionSize ?? '',
    }
  }

  if (partType === 'enumeration') {
    const enumeration = hydrateEnumerationAnswers(question, pointsPerItem)
    const acceptedAnswers = question.acceptedAnswers ?? []
    return {
      itemNumber,
      questionText,
      ...enumeration,
      matchingMode:
        acceptedAnswers[0]?.matchingMode ?? question.matchingMode ?? 'normalized',
      caseSensitive: acceptedAnswers.length
        ? acceptedAnswers.every((answer) => Boolean(answer.caseSensitive))
        : false,
      maximumResponseLength: question.maximumResponseLength ?? '',
      responseRegionSize: question.responseRegionSize === 'none'
        ? ''
        : question.responseRegionSize ?? '',
    }
  }

  if (partType === 'essay') {
    const savedRubric = question.rubric ?? null
    const savedRubricId = savedRubric?.rubricId ?? question.rubricId ?? ''
    const usesReusableRubric = Boolean(
      savedRubricId && rubrics.some((rubric) => String(rubric.rubricId) === String(savedRubricId)),
    )

    return {
      itemNumber,
      questionText,
      responseInstructions: question.responseInstructions ?? '',
      maximumResponseLength: question.maximumResponseLength ?? '',
      responseRegionSize: question.responseRegionSize === 'none'
        ? ''
        : question.responseRegionSize ?? '',
      forcePageBreakBefore: Boolean(question.forcePageBreakBefore),
      scoringMode: savedRubric ? 'rubric' : 'manual',
      rubricSource: usesReusableRubric ? 'existing' : 'inline',
      rubricId: usesReusableRubric ? String(savedRubricId) : '',
      inlineRubric: {
        rubricName: usesReusableRubric ? '' : savedRubric?.rubricName ?? '',
        description: usesReusableRubric ? '' : savedRubric?.description ?? '',
        criteria: !usesReusableRubric && savedRubric?.criteria?.length
          ? savedRubric.criteria.map((criterion, criterionIndex) => ({
              criterionOrder: criterionIndex + 1,
              criterionName: criterion.criterionName ?? '',
              criterionDescription: criterion.criterionDescription ?? '',
              maximumPoints: criterion.maximumPoints ?? 1,
              required: criterion.required !== false,
            }))
          : [emptyRubricCriterion(1, pointsPerItem)],
      },
    }
  }

  return emptyQuestion(itemNumber, partType, pointsPerItem, questionText)
}

function hydrateAssessment(assessment, referenceData = {}) {
  const skills = referenceData.skills ?? []
  const rubrics = referenceData.rubrics ?? []
  const parts = (assessment.parts ?? []).map((part, index) => {
    const partType = part.questionTypeCode ?? part.partType ?? ''
    const pointsPerItem = Math.max(1, Math.round(Number(part.pointsPerItem ?? 1)))
    const questions = (part.questions ?? []).map((question, questionIndex) => (
      hydrateQuestion(question, questionIndex, partType, pointsPerItem, rubrics)
    ))

    return {
      partOrder: part.partOrder ?? index + 1,
      partName: part.partName ?? '',
      partType,
      pointsPerItem,
      questions: questions.length ? questions : [emptyQuestion(1, partType, pointsPerItem)],
      skillMappings: hydrateSkillMappings(part, skills),
      expanded: true,
    }
  })

  return {
    classAssignmentId: String(assessment.classAssignmentId ?? ''),
    termPeriodId: String(assessment.termPeriodId ?? ''),
    testName: assessment.testName ?? '',
    testType: assessment.testType ?? 'quiz',
    openAt: toDateTimeLocal(assessment.openAt ?? assessment.testDate),
    closeAt: toDateTimeLocal(assessment.closeAt),
    allowLateCapture: Boolean(assessment.allowLateCapture),
    confirmOutsideClassSchedule: Boolean(
      assessment.confirmOutsideClassSchedule ?? assessment.outsideClassScheduleConfirmed,
    ),
    outsideClassScheduleReason: assessment.outsideClassScheduleReason ?? '',
    instructions: assessment.instructions ?? '',
    parts: parts.length ? parts : [emptyPart(1)],
  }
}

function optionalPositiveIntegerIsValid(value) {
  return value === '' || value === null || value === undefined ||
    (Number.isInteger(Number(value)) && Number(value) > 0)
}

function normalizedAnswer(value, matchingMode, caseSensitive) {
  const trimmed = value.trim()
  const comparable = matchingMode === 'normalized'
    ? trimmed.replace(/\s+/g, ' ')
    : trimmed
  return caseSensitive ? comparable : comparable.toLocaleLowerCase()
}

function duplicateAnswerExists(values, matchingMode, caseSensitive) {
  const normalized = values.map((value) => normalizedAnswer(value, matchingMode, caseSensitive))
  return new Set(normalized).size !== normalized.length
}

function questionValidationError(part, question, itemNumber, rubrics = []) {
  const prefix = `${part.partName.trim() || `Part ${part.partOrder}`}, item ${itemNumber}`

  if (!question.questionText.trim()) {
    return `${prefix}: enter the question text.`
  }

  if (part.partType === 'multiple_choice') {
    const requiredOptions = [question.optionA, question.optionB, question.optionC, question.optionD]
    if (requiredOptions.some((value) => !value?.trim())) {
      return `${prefix}: options A to D are required.`
    }
    if (!['A', 'B', 'C', 'D'].includes(question.correctOption)) {
      return `${prefix}: select a correct answer from A to D.`
    }
    return ''
  }

  if (part.partType === 'true_false') {
    return ['A', 'B'].includes(question.correctOption)
      ? ''
      : `${prefix}: select True or False.`
  }

  if (part.partType === 'identification') {
    const answers = (question.acceptedAnswers ?? []).map((answer) => answer.acceptedText?.trim() ?? '')
    if (!answers.length || answers.some((answer) => !answer)) {
      return `${prefix}: enter at least one complete accepted answer.`
    }
    if (!['exact', 'normalized'].includes(question.matchingMode)) {
      return `${prefix}: select an accepted-answer matching mode.`
    }
    if (duplicateAnswerExists(answers, question.matchingMode, question.caseSensitive)) {
      return `${prefix}: accepted answer variants must be unique.`
    }
    if (!optionalPositiveIntegerIsValid(question.maximumResponseLength)) {
      return `${prefix}: response length must be a whole number greater than zero.`
    }
    return ''
  }

  if (part.partType === 'enumeration') {
    const expectedCount = Number(question.expectedResponseCount)
    if (!Number.isInteger(expectedCount) || expectedCount < 1) {
      return `${prefix}: expected answers must be a whole number greater than zero.`
    }
    if ((question.enumerationAnswers ?? []).length !== expectedCount) {
      return `${prefix}: configure exactly ${expectedCount} ordered answers.`
    }
    if (!['exact', 'normalized'].includes(question.matchingMode)) {
      return `${prefix}: select an accepted-answer matching mode.`
    }
    if (!optionalPositiveIntegerIsValid(question.maximumResponseLength)) {
      return `${prefix}: response length must be a whole number greater than zero.`
    }

    let pointTotal = 0
    for (const [answerIndex, answer] of question.enumerationAnswers.entries()) {
      const values = [
        answer.primaryAnswer?.trim() ?? '',
        ...(answer.variants ?? []).map((variant) => variant.acceptedText?.trim() ?? ''),
      ]
      if (values.some((value) => !value)) {
        return `${prefix}: answer ${answerIndex + 1} and all its variants must be complete.`
      }
      if (duplicateAnswerExists(values, question.matchingMode, question.caseSensitive)) {
        return `${prefix}: variants for answer ${answerIndex + 1} must be unique.`
      }
      const points = Number(answer.points)
      if (!Number.isFinite(points) || points < 0) {
        return `${prefix}: answer ${answerIndex + 1} needs explicit non-negative points.`
      }
      pointTotal += points
    }

    if (Math.abs(pointTotal - Number(part.pointsPerItem)) > 0.000001) {
      return `${prefix}: ordered-answer points must total ${part.pointsPerItem}.`
    }
    return ''
  }

  if (part.partType === 'essay') {
    if (!question.responseInstructions?.trim()) {
      return `${prefix}: enter response instructions.`
    }
    if (!optionalPositiveIntegerIsValid(question.maximumResponseLength) || !question.maximumResponseLength) {
      return `${prefix}: enter a valid maximum response length.`
    }
    if (!question.responseRegionSize) {
      return `${prefix}: select a written-region size.`
    }
    if (question.scoringMode === 'manual') return ''
    if (question.scoringMode !== 'rubric') {
      return `${prefix}: select manual or rubric scoring.`
    }

    if (question.rubricSource === 'existing') {
      const selectedRubric = rubrics.find(
        (rubric) => String(rubric.rubricId) === String(question.rubricId),
      )
      if (!selectedRubric) return `${prefix}: select an available rubric.`
      if (Math.abs(Number(selectedRubric.totalPoints) - Number(part.pointsPerItem)) > 0.000001) {
        return `${prefix}: the selected rubric must total ${part.pointsPerItem} points.`
      }
      return ''
    }

    if (question.rubricSource !== 'inline') {
      return `${prefix}: select an existing or inline rubric.`
    }
    const inlineRubric = question.inlineRubric ?? {}
    if (!inlineRubric.rubricName?.trim()) return `${prefix}: enter the inline rubric name.`
    if (!inlineRubric.criteria?.length) return `${prefix}: add at least one rubric criterion.`

    let criterionTotal = 0
    for (const [criterionIndex, criterion] of inlineRubric.criteria.entries()) {
      if (!criterion.criterionName?.trim() || !criterion.criterionDescription?.trim()) {
        return `${prefix}: complete rubric criterion ${criterionIndex + 1}.`
      }
      const points = Number(criterion.maximumPoints)
      if (!Number.isFinite(points) || points <= 0) {
        return `${prefix}: rubric criterion ${criterionIndex + 1} needs points greater than zero.`
      }
      criterionTotal += points
    }

    if (Math.abs(criterionTotal - Number(part.pointsPerItem)) > 0.000001) {
      return `${prefix}: rubric criterion points must total ${part.pointsPerItem}.`
    }
    return ''
  }

  return `${prefix}: select a supported question type.`
}

function validateDraft(form, rubrics = []) {
  if (!form.classAssignmentId || !form.termPeriodId) {
    return 'Assessment class or active term context is unavailable. Return to the class and try again.'
  }

  if (!form.testName.trim()) {
    return 'Enter the assessment name.'
  }

  if (!form.openAt) {
    return 'Set the opening date (when the assessment is conducted).'
  }

  if (form.openAt && form.closeAt && new Date(form.closeAt) <= new Date(form.openAt)) {
    return 'Assessment closing time must be later than its opening time.'
  }

  if (
    form.confirmOutsideClassSchedule &&
    form.outsideClassScheduleReason.trim().length < 5
  ) {
    return 'Enter at least five characters explaining the outside-timetable schedule.'
  }

  if (!form.parts.length) return 'Add at least one assessment part.'

  for (const part of form.parts) {
    const partName = part.partName.trim() || `Part ${part.partOrder}`
    const pointsPerItem = Number(part.pointsPerItem)

    if (!part.partName.trim() || !part.questions.length) {
      return `Complete ${partName} and add at least one question.`
    }

    if (!SUPPORTED_QUESTION_TYPE_CODES.has(part.partType)) {
      return `${partName}: select a question type.`
    }

    if (!Number.isInteger(pointsPerItem) || pointsPerItem < 1) {
      return `${partName}: points per item must be a whole number greater than zero.`
    }

    const coveredItems = new Set()
    for (const mapping of part.skillMappings) {
      const start = Number(mapping.fromItemNumber)
      const end = Number(mapping.toItemNumber)

      if (!start || !end || start > end || end > part.questions.length || !mapping.skillIds.length) {
        return `${partName}: every skill range needs a valid item range and at least one skill.`
      }

      for (let item = start; item <= end; item += 1) coveredItems.add(item)
    }

    if (coveredItems.size !== part.questions.length) {
      return `${partName}: every question must be covered by a skill range.`
    }

    for (const [questionIndex, question] of part.questions.entries()) {
      const itemNumber = questionIndex + 1
      const questionError = questionValidationError(part, question, itemNumber, rubrics)
      if (questionError) return questionError
    }
  }

  return ''
}

function optionalPositiveNumber(value) {
  return value === '' || value === null || value === undefined
    ? null
    : Number(value)
}

function toQuestionPayload(part, question, questionIndex) {
  const maximumPoints = Number(part.pointsPerItem)
  const common = {
    itemNumber: questionIndex + 1,
    questionText: question.questionText.trim(),
    maximumPoints,
  }

  if (part.partType === 'multiple_choice') {
    return {
      ...common,
      options: ['A', 'B', 'C', 'D'].map((optionKey, optionIndex) => ({
        optionKey,
        optionText: question[`option${optionKey}`].trim(),
        optionOrder: optionIndex + 1,
      })),
      correctOptionKey: question.correctOption,
      answerExplanation: question.answerExplanation?.trim() || null,
    }
  }

  if (part.partType === 'true_false') {
    return {
      ...common,
      correctOptionKey: question.correctOption,
    }
  }

  if (part.partType === 'identification') {
    return {
      ...common,
      ...(optionalPositiveNumber(question.maximumResponseLength)
        ? { maximumResponseLength: Number(question.maximumResponseLength) }
        : {}),
      expectedResponseCount: 1,
      ...(question.responseRegionSize ? { responseRegionSize: question.responseRegionSize } : {}),
      matchingMode: question.matchingMode,
      acceptedAnswers: question.acceptedAnswers.map((answer, answerIndex) => ({
        acceptedText: answer.acceptedText.trim(),
        points: maximumPoints,
        primary: answerIndex === 0,
        caseSensitive: Boolean(question.caseSensitive),
      })),
    }
  }

  if (part.partType === 'enumeration') {
    return {
      ...common,
      ...(optionalPositiveNumber(question.maximumResponseLength)
        ? { maximumResponseLength: Number(question.maximumResponseLength) }
        : {}),
      expectedResponseCount: Number(question.expectedResponseCount),
      ...(question.responseRegionSize ? { responseRegionSize: question.responseRegionSize } : {}),
      matchingMode: question.matchingMode,
      acceptedAnswers: question.enumerationAnswers.flatMap((answer, answerIndex) => (
        [
          { acceptedText: answer.primaryAnswer },
          ...answer.variants,
        ].map((variant, variantIndex) => ({
          answerOrder: answerIndex + 1,
          acceptedText: variant.acceptedText?.trim() ?? variant.acceptedText ?? '',
          points: Number(answer.points),
          primary: variantIndex === 0,
          caseSensitive: Boolean(question.caseSensitive),
        }))
      )),
    }
  }

  if (part.partType === 'essay') {
    const essay = {
      ...common,
      responseInstructions: question.responseInstructions.trim(),
      maximumResponseLength: Number(question.maximumResponseLength),
      responseRegionSize: question.responseRegionSize,
      forcePageBreakBefore: Boolean(question.forcePageBreakBefore),
    }

    if (question.scoringMode !== 'rubric') return essay
    if (question.rubricSource === 'existing') {
      return { ...essay, rubricId: Number(question.rubricId) }
    }

    return {
      ...essay,
      rubric: {
        rubricName: question.inlineRubric.rubricName.trim(),
        description: question.inlineRubric.description.trim() || null,
        criteria: question.inlineRubric.criteria.map((criterion, criterionIndex) => ({
          criterionOrder: criterionIndex + 1,
          criterionName: criterion.criterionName.trim(),
          criterionDescription: criterion.criterionDescription.trim(),
          maximumPoints: Number(criterion.maximumPoints),
          required: criterion.required !== false,
        })),
      },
    }
  }

  return common
}

function toPayload(form) {
  return {
    classAssignmentId: Number(form.classAssignmentId),
    termPeriodId: Number(form.termPeriodId),
    testName: form.testName.trim(),
    testType: form.testType,
    instructions: form.instructions.trim() || null,
    openAt: toInstant(form.openAt),
    closeAt: toInstant(form.closeAt),
    allowLateCapture: Boolean(form.allowLateCapture),
    confirmOutsideClassSchedule: Boolean(form.confirmOutsideClassSchedule),
    outsideClassScheduleReason: form.confirmOutsideClassSchedule
      ? form.outsideClassScheduleReason.trim()
      : null,
    parts: form.parts.map((part, partIndex) => ({
      partOrder: partIndex + 1,
      partName: part.partName.trim(),
      questionTypeCode: part.partType,
      numberOfItems: part.questions.length,
      pointsPerItem: Number(part.pointsPerItem),
      partInstructions: null,
      questions: part.questions.map((question, questionIndex) => (
        toQuestionPayload(part, question, questionIndex)
      )),
      skillMappings: part.skillMappings.map((mapping) => ({
        startItemNumber: Number(mapping.fromItemNumber),
        endItemNumber: Number(mapping.toItemNumber),
        skillIds: mapping.skillIds.map(Number),
      })),
    })),
  }
}

function assignmentLabel(assignment = {}) {
  const className = [assignment.gradeLevelName, assignment.sectionName].filter(Boolean).join(' - ')
  const details = [assignment.subjectName, assignment.yearName].filter(Boolean).join(' | ')
  return [className || 'Assigned class', details].filter(Boolean).join(' | ')
}

function ToggleField({ id, checked, onChange, label }) {
  return (
    <label
      className="flex min-h-10 cursor-pointer items-center gap-3 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm"
      htmlFor={id}
    >
      <input
        id={id}
        type="checkbox"
        className="size-4 accent-primary"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{label}</span>
    </label>
  )
}

function WrittenResponseSettings({
  idPrefix,
  question,
  onChange,
  responseRegionSizes,
  required = false,
}) {
  const regionSizes = responseRegionSizes.filter((size) => size !== 'none')

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-response-length`}>
          Maximum response length{required ? '' : ' (optional)'}
        </Label>
        <Input
          id={`${idPrefix}-response-length`}
          type="number"
          min="1"
          step="1"
          value={question.maximumResponseLength}
          placeholder={required ? 'Enter maximum characters' : 'No character limit'}
          onChange={(event) => onChange({ maximumResponseLength: event.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-response-region`}>
          Written-region size{required ? '' : ' (optional)'}
        </Label>
        <Select
          value={question.responseRegionSize || '__default'}
          onValueChange={(value) => onChange({
            responseRegionSize: value === '__default' ? '' : value,
          })}
        >
          <SelectTrigger id={`${idPrefix}-response-region`}>
            <SelectValue placeholder="Select written-region size" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__default">
              {required ? 'Select written-region size' : 'Use backend default'}
            </SelectItem>
            {regionSizes.map((size) => (
              <SelectItem key={size} value={size}>{formatCodeLabel(size)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

function QuestionTypeEditor({
  part,
  partIndex,
  question,
  questionIndex,
  onChange,
  rubrics,
  responseRegionSizes,
}) {
  const idPrefix = `part-${partIndex}-question-${questionIndex}`

  if (part.partType === 'multiple_choice') {
    return (
      <>
        <div className="grid gap-3 sm:grid-cols-2">
          {['A', 'B', 'C', 'D'].map((option) => (
            <div className="space-y-2" key={option}>
              <Label htmlFor={`${idPrefix}-option-${option}`}>Option {option}</Label>
              <Input
                id={`${idPrefix}-option-${option}`}
                value={question[`option${option}`]}
                maxLength="2000"
                onChange={(event) => onChange({ [`option${option}`]: event.target.value })}
              />
            </div>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-[minmax(180px,0.7fr)_minmax(0,1.3fr)]">
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-answer`}>Correct option</Label>
            <Select
              value={question.correctOption || undefined}
              onValueChange={(value) => onChange({ correctOption: value })}
            >
              <SelectTrigger id={`${idPrefix}-answer`}>
                <SelectValue placeholder="Select correct option" />
              </SelectTrigger>
              <SelectContent>
                {['A', 'B', 'C', 'D'].map((option) => (
                  <SelectItem key={option} value={option}>{option}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-explanation`}>Answer explanation (optional)</Label>
            <textarea
              id={`${idPrefix}-explanation`}
              className={TEXTAREA_CLASS}
              rows="2"
              value={question.answerExplanation}
              placeholder="Explain why the selected option is correct"
              onChange={(event) => onChange({ answerExplanation: event.target.value })}
            />
          </div>
        </div>
      </>
    )
  }

  if (part.partType === 'true_false') {
    return (
      <div className="max-w-sm space-y-2">
        <Label htmlFor={`${idPrefix}-answer`}>Correct answer</Label>
        <Select
          value={question.correctOption || undefined}
          onValueChange={(value) => onChange({ correctOption: value })}
        >
          <SelectTrigger id={`${idPrefix}-answer`}>
            <SelectValue placeholder="Select True or False" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="A">True</SelectItem>
            <SelectItem value="B">False</SelectItem>
          </SelectContent>
        </Select>
        <p className="m-0 text-xs text-muted-foreground">
          Marka sends A for True and B for False. Options are generated by the backend.
        </p>
      </div>
    )
  }

  if (part.partType === 'identification') {
    return (
      <div className="space-y-5">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Label>Accepted-answer variants</Label>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onChange({
                acceptedAnswers: [
                  ...question.acceptedAnswers,
                  { acceptedText: '' },
                ],
              })}
            >
              <CirclePlus />
              Add variant
            </Button>
          </div>

          <div className="divide-y divide-border rounded-md border border-border">
            {question.acceptedAnswers.map((answer, answerIndex) => (
              <div
                className="grid gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_auto]"
                key={`${idPrefix}-accepted-${answerIndex}`}
              >
                <div className="space-y-2">
                  <Label htmlFor={`${idPrefix}-accepted-${answerIndex}`}>
                    {answerIndex === 0 ? 'Primary accepted answer' : `Accepted variant ${answerIndex}`}
                  </Label>
                  <Input
                    id={`${idPrefix}-accepted-${answerIndex}`}
                    value={answer.acceptedText}
                    maxLength="500"
                    onChange={(event) => onChange({
                      acceptedAnswers: question.acceptedAnswers.map((item, index) => (
                        index === answerIndex
                          ? { ...item, acceptedText: event.target.value }
                          : item
                      )),
                    })}
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="self-end"
                  disabled={question.acceptedAnswers.length === 1}
                  title="Remove accepted variant"
                  aria-label={`Remove accepted variant ${answerIndex + 1}`}
                  onClick={() => onChange({
                    acceptedAnswers: question.acceptedAnswers.filter((_, index) => index !== answerIndex),
                  })}
                >
                  <Trash2 className="text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-matching`}>Matching mode</Label>
            <Select
              value={question.matchingMode}
              onValueChange={(value) => onChange({ matchingMode: value })}
            >
              <SelectTrigger id={`${idPrefix}-matching`}>
                <SelectValue placeholder="Select matching mode" />
              </SelectTrigger>
              <SelectContent>
                {MATCHING_MODES.map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Letter case</Label>
            <ToggleField
              id={`${idPrefix}-case-sensitive`}
              checked={question.caseSensitive}
              onChange={(caseSensitive) => onChange({ caseSensitive })}
              label="Case-sensitive answers"
            />
          </div>
        </div>

        <WrittenResponseSettings
          idPrefix={idPrefix}
          question={question}
          onChange={onChange}
          responseRegionSizes={responseRegionSizes}
        />
      </div>
    )
  }

  if (part.partType === 'enumeration') {
    const resizeExpectedAnswers = (value) => {
      if (value === '') {
        onChange({ expectedResponseCount: '', enumerationAnswers: [] })
        return
      }

      const expectedResponseCount = Number(value)
      if (!Number.isInteger(expectedResponseCount) || expectedResponseCount < 1) return

      const maximumPoints = Number(part.pointsPerItem) || 0
      const basePoints = Math.floor(maximumPoints / expectedResponseCount)
      const extraPoints = maximumPoints - basePoints * expectedResponseCount
      const enumerationAnswers = Array.from({ length: expectedResponseCount }, (_, index) => {
        const existing = question.enumerationAnswers[index]
        return {
          ...(existing ?? emptyEnumerationAnswer(index + 1)),
          answerOrder: index + 1,
          points: basePoints + (index < extraPoints ? 1 : 0),
        }
      })

      onChange({ expectedResponseCount, enumerationAnswers })
    }

    return (
      <div className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-expected-count`}>Expected number of answers</Label>
            <Input
              id={`${idPrefix}-expected-count`}
              type="number"
              min="1"
              step="1"
              value={question.expectedResponseCount}
              onChange={(event) => resizeExpectedAnswers(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-matching`}>Matching mode</Label>
            <Select
              value={question.matchingMode}
              onValueChange={(value) => onChange({ matchingMode: value })}
            >
              <SelectTrigger id={`${idPrefix}-matching`}>
                <SelectValue placeholder="Select matching mode" />
              </SelectTrigger>
              <SelectContent>
                {MATCHING_MODES.map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Letter case</Label>
            <ToggleField
              id={`${idPrefix}-case-sensitive`}
              checked={question.caseSensitive}
              onChange={(caseSensitive) => onChange({ caseSensitive })}
              label="Case-sensitive answers"
            />
          </div>
        </div>

        <div className="space-y-3">
          <Label>Ordered accepted answers</Label>
          <div className="divide-y divide-border rounded-md border border-border">
            {question.enumerationAnswers.map((answer, answerIndex) => (
              <div className="space-y-3 p-4" key={`${idPrefix}-order-${answerIndex}`}>
                <div className="grid gap-3 md:grid-cols-[auto_minmax(0,1fr)_minmax(130px,0.3fr)] md:items-end">
                  <Badge className="mb-1" variant="secondary">Answer {answerIndex + 1}</Badge>
                  <div className="space-y-2">
                    <Label htmlFor={`${idPrefix}-order-${answerIndex}-primary`}>Primary answer</Label>
                    <Input
                      id={`${idPrefix}-order-${answerIndex}-primary`}
                      value={answer.primaryAnswer}
                      maxLength="500"
                      onChange={(event) => onChange({
                        enumerationAnswers: question.enumerationAnswers.map((item, index) => (
                          index === answerIndex
                            ? { ...item, primaryAnswer: event.target.value }
                            : item
                        )),
                      })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`${idPrefix}-order-${answerIndex}-points`}>Points</Label>
                    <Input
                      id={`${idPrefix}-order-${answerIndex}-points`}
                      type="number"
                      min="0"
                      step="1"
                      value={answer.points}
                      onChange={(event) => onChange({
                        enumerationAnswers: question.enumerationAnswers.map((item, index) => (
                          index === answerIndex
                            ? { ...item, points: event.target.value }
                            : item
                        )),
                      })}
                    />
                  </div>
                </div>

                {answer.variants.map((variant, variantIndex) => (
                  <div
                    className="grid gap-3 pl-0 sm:grid-cols-[minmax(0,1fr)_auto] md:pl-20"
                    key={`${idPrefix}-order-${answerIndex}-variant-${variantIndex}`}
                  >
                    <div className="space-y-2">
                      <Label htmlFor={`${idPrefix}-order-${answerIndex}-variant-${variantIndex}`}>
                        Accepted variant {variantIndex + 1}
                      </Label>
                      <Input
                        id={`${idPrefix}-order-${answerIndex}-variant-${variantIndex}`}
                        value={variant.acceptedText}
                        maxLength="500"
                        onChange={(event) => onChange({
                          enumerationAnswers: question.enumerationAnswers.map((item, index) => (
                            index === answerIndex
                              ? {
                                  ...item,
                                  variants: item.variants.map((itemVariant, indexOfVariant) => (
                                    indexOfVariant === variantIndex
                                      ? { ...itemVariant, acceptedText: event.target.value }
                                      : itemVariant
                                  )),
                                }
                              : item
                          )),
                        })}
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="self-end"
                      title="Remove accepted variant"
                      aria-label={`Remove answer ${answerIndex + 1} variant ${variantIndex + 1}`}
                      onClick={() => onChange({
                        enumerationAnswers: question.enumerationAnswers.map((item, index) => (
                          index === answerIndex
                            ? {
                                ...item,
                                variants: item.variants.filter((_, indexOfVariant) => (
                                  indexOfVariant !== variantIndex
                                )),
                              }
                            : item
                        )),
                      })}
                    >
                      <Trash2 className="text-destructive" />
                    </Button>
                  </div>
                ))}

                <Button
                  variant="outline"
                  size="sm"
                  className="md:ml-20"
                  onClick={() => onChange({
                    enumerationAnswers: question.enumerationAnswers.map((item, index) => (
                      index === answerIndex
                        ? { ...item, variants: [...item.variants, { acceptedText: '' }] }
                        : item
                    )),
                  })}
                >
                  <CirclePlus />
                  Add variant
                </Button>
              </div>
            ))}
          </div>
          <p className="m-0 text-xs text-muted-foreground">
            Points across the primary ordered answers must total {part.pointsPerItem}.
          </p>
        </div>

        <WrittenResponseSettings
          idPrefix={idPrefix}
          question={question}
          onChange={onChange}
          responseRegionSizes={responseRegionSizes}
        />
      </div>
    )
  }

  if (part.partType === 'essay') {
    const inlineRubric = question.inlineRubric
    const updateInlineRubric = (updates) => onChange({
      inlineRubric: { ...inlineRubric, ...updates },
    })

    return (
      <div className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-response-instructions`}>Response instructions</Label>
          <textarea
            id={`${idPrefix}-response-instructions`}
            className={TEXTAREA_CLASS}
            rows="2"
            value={question.responseInstructions}
            placeholder="Tell students how to structure the response"
            onChange={(event) => onChange({ responseInstructions: event.target.value })}
          />
        </div>

        <WrittenResponseSettings
          idPrefix={idPrefix}
          question={question}
          onChange={onChange}
          responseRegionSizes={responseRegionSizes}
          required
        />

        <ToggleField
          id={`${idPrefix}-page-break`}
          checked={question.forcePageBreakBefore}
          onChange={(forcePageBreakBefore) => onChange({ forcePageBreakBefore })}
          label="Start this essay on a new page"
        />

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-scoring-mode`}>Scoring</Label>
            <Select
              value={question.scoringMode}
              onValueChange={(scoringMode) => onChange({
                scoringMode,
                rubricSource: scoringMode === 'rubric'
                  ? rubrics.length ? 'existing' : 'inline'
                  : question.rubricSource,
                rubricId: scoringMode === 'rubric' ? question.rubricId : '',
              })}
            >
              <SelectTrigger id={`${idPrefix}-scoring-mode`}>
                <SelectValue placeholder="Select scoring method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual scoring</SelectItem>
                <SelectItem value="rubric">Rubric scoring</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {question.scoringMode === 'rubric' ? (
            <div className="space-y-2">
              <Label htmlFor={`${idPrefix}-rubric-source`}>Rubric source</Label>
              <Select
                value={question.rubricSource}
                onValueChange={(rubricSource) => onChange({ rubricSource, rubricId: '' })}
              >
                <SelectTrigger id={`${idPrefix}-rubric-source`}>
                  <SelectValue placeholder="Select rubric source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="existing">Use existing rubric</SelectItem>
                  <SelectItem value="inline">Create inline rubric</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>

        {question.scoringMode === 'rubric' && question.rubricSource === 'existing' ? (
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-rubric`}>Rubric</Label>
            <Select
              value={question.rubricId || undefined}
              disabled={!rubrics.length}
              onValueChange={(rubricId) => onChange({ rubricId })}
            >
              <SelectTrigger id={`${idPrefix}-rubric`}>
                <SelectValue placeholder={rubrics.length ? 'Select rubric' : 'No reusable rubrics available'} />
              </SelectTrigger>
              <SelectContent>
                {rubrics.map((rubric) => (
                  <SelectItem key={rubric.rubricId} value={String(rubric.rubricId)}>
                    {rubric.rubricName} ({rubric.totalPoints} points)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        {question.scoringMode === 'rubric' && question.rubricSource === 'inline' ? (
          <div className="space-y-4 border-t border-border pt-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`${idPrefix}-rubric-name`}>Rubric name</Label>
                <Input
                  id={`${idPrefix}-rubric-name`}
                  value={inlineRubric.rubricName}
                  maxLength="120"
                  onChange={(event) => updateInlineRubric({ rubricName: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${idPrefix}-rubric-description`}>Rubric description (optional)</Label>
                <Input
                  id={`${idPrefix}-rubric-description`}
                  value={inlineRubric.description}
                  onChange={(event) => updateInlineRubric({ description: event.target.value })}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <Label>Rubric criteria</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={() => updateInlineRubric({
                  criteria: [
                    ...inlineRubric.criteria,
                    emptyRubricCriterion(inlineRubric.criteria.length + 1),
                  ],
                })}
              >
                <CirclePlus />
                Add criterion
              </Button>
            </div>

            <div className="divide-y divide-border rounded-md border border-border">
              {inlineRubric.criteria.map((criterion, criterionIndex) => (
                <div className="space-y-3 p-4" key={`${idPrefix}-criterion-${criterionIndex}`}>
                  <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_140px_auto] md:items-end">
                    <div className="space-y-2">
                      <Label htmlFor={`${idPrefix}-criterion-${criterionIndex}-name`}>
                        Criterion {criterionIndex + 1}
                      </Label>
                      <Input
                        id={`${idPrefix}-criterion-${criterionIndex}-name`}
                        value={criterion.criterionName}
                        maxLength="120"
                        onChange={(event) => updateInlineRubric({
                          criteria: inlineRubric.criteria.map((item, index) => (
                            index === criterionIndex
                              ? { ...item, criterionName: event.target.value }
                              : item
                          )),
                        })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`${idPrefix}-criterion-${criterionIndex}-points`}>Points</Label>
                      <Input
                        id={`${idPrefix}-criterion-${criterionIndex}-points`}
                        type="number"
                        min="1"
                        step="1"
                        value={criterion.maximumPoints}
                        onChange={(event) => updateInlineRubric({
                          criteria: inlineRubric.criteria.map((item, index) => (
                            index === criterionIndex
                              ? { ...item, maximumPoints: event.target.value }
                              : item
                          )),
                        })}
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      disabled={inlineRubric.criteria.length === 1}
                      title="Remove rubric criterion"
                      aria-label={`Remove rubric criterion ${criterionIndex + 1}`}
                      onClick={() => updateInlineRubric({
                        criteria: inlineRubric.criteria
                          .filter((_, index) => index !== criterionIndex)
                          .map((item, index) => ({ ...item, criterionOrder: index + 1 })),
                      })}
                    >
                      <Trash2 className="text-destructive" />
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`${idPrefix}-criterion-${criterionIndex}-description`}>
                      Criterion description
                    </Label>
                    <textarea
                      id={`${idPrefix}-criterion-${criterionIndex}-description`}
                      className={TEXTAREA_CLASS}
                      rows="2"
                      value={criterion.criterionDescription}
                      onChange={(event) => updateInlineRubric({
                        criteria: inlineRubric.criteria.map((item, index) => (
                          index === criterionIndex
                            ? { ...item, criterionDescription: event.target.value }
                            : item
                        )),
                      })}
                    />
                  </div>

                  <ToggleField
                    id={`${idPrefix}-criterion-${criterionIndex}-required`}
                    checked={criterion.required !== false}
                    onChange={(required) => updateInlineRubric({
                      criteria: inlineRubric.criteria.map((item, index) => (
                        index === criterionIndex ? { ...item, required } : item
                      )),
                    })}
                    label="Required criterion"
                  />
                </div>
              ))}
            </div>
            <p className="m-0 text-xs text-muted-foreground">
              Criterion points must total {part.pointsPerItem}.
            </p>
          </div>
        ) : null}
      </div>
    )
  }

  return null
}

function V2AssessmentEditorPage({
  token,
  testId = null,
  initialClassAssignmentId = null,
  onNavigate,
}) {
  const [currentTestId, setCurrentTestId] = useState(testId)
  const isEditing = Boolean(currentTestId)
  const [currentTestAssignmentId, setCurrentTestAssignmentId] = useState(null)
  const [answerSheetEligibility, setAnswerSheetEligibility] = useState(null)
  const [answerSheetChecking, setAnswerSheetChecking] = useState(false)
  const [answerSheetVersion, setAnswerSheetVersion] = useState(null)
  const [answerSheetPreparing, setAnswerSheetPreparing] = useState(false)
  const [answerSheetError, setAnswerSheetError] = useState('')
  const [form, setForm] = useState({
    classAssignmentId: '',
    termPeriodId: '',
    testName: '',
    testType: 'quiz',
    openAt: '',
    closeAt: '',
    allowLateCapture: false,
    confirmOutsideClassSchedule: false,
    outsideClassScheduleReason: '',
    instructions: '',
    parts: [emptyPart(1)],
  })
  const [assignments, setAssignments] = useState([])
  const [terms, setTerms] = useState([])
  const [skills, setSkills] = useState([])
  const [questionTypes, setQuestionTypes] = useState([])
  const [rubrics, setRubrics] = useState([])
  const [responseRegionSizes, setResponseRegionSizes] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activating, setActivating] = useState(false)
  const [assessmentStatus, setAssessmentStatus] = useState('draft')
  const [savedPayloadSnapshot, setSavedPayloadSnapshot] = useState(null)
  const [message, setMessage] = useState(null)
  const [openAtError, setOpenAtError] = useState('')

  const refreshAnswerSheetEligibility = useCallback(async (testAssignmentId) => {
    if (!testAssignmentId) {
      setAnswerSheetEligibility(null)
      return
    }

    setAnswerSheetChecking(true)
    try {
      const result = await getAnswerSheetEligibilityV3(testAssignmentId, token)
      setAnswerSheetEligibility(result)
    } catch (eligibilityError) {
      setAnswerSheetEligibility({
        eligible: false,
        blockers: [{ code: 'ELIGIBILITY_CHECK_FAILED', message: eligibilityError.message }],
      })
    } finally {
      setAnswerSheetChecking(false)
    }
  }, [token])

  useEffect(() => {
    let active = true

    async function initialize() {
      setLoading(true)

      try {
        const baseReference = await getAssessmentReferenceDataV3({}, token)
        if (!active) return
        setCurrentTestId(testId)
        setAssignments(baseReference.classAssignments ?? [])

        if (testId) {
          const assessment = await getAssessmentV3(testId, token)
          const [termReference, skillReference] = await Promise.all([
            getAssessmentReferenceDataV3({ classAssignmentId: assessment.classAssignmentId }, token),
            getAssessmentReferenceDataV3({
              classAssignmentId: assessment.classAssignmentId,
              termPeriodId: assessment.termPeriodId,
            }, token),
          ])
          if (!active) return
          setTerms(termReference.termPeriods ?? [])
          setSkills(skillReference.skills ?? [])
          setQuestionTypes(supportedQuestionTypes(skillReference))
          setRubrics(skillReference.rubrics ?? [])
          setResponseRegionSizes(skillReference.responseRegionSizes ?? [])
          const hydratedForm = hydrateAssessment(assessment, skillReference)
          setForm(hydratedForm)
          setAssessmentStatus(String(assessment.status ?? 'draft').toLowerCase())
          setSavedPayloadSnapshot(JSON.stringify(toPayload(hydratedForm)))
          setCurrentTestAssignmentId(assessment.testAssignmentId ?? null)
          refreshAnswerSheetEligibility(assessment.testAssignmentId ?? null)
          return
        }

        const availableAssignments = baseReference.classAssignments ?? []
        const classAssignmentId = String(
          initialClassAssignmentId ?? availableAssignments[0]?.classAssignmentId ?? '',
        )

        if (!classAssignmentId) {
          throw new Error('No active class assignment is available for assessment creation.')
        }

        const termReference = await getAssessmentReferenceDataV3({ classAssignmentId }, token)
        const availableTerms = termReference.termPeriods ?? []
        const activeTerm =
          availableTerms.find((term) => String(term.status).toLowerCase() === 'active') ??
          availableTerms[0]

        if (!activeTerm?.termPeriodId) {
          throw new Error('No active term period is available for this class assignment.')
        }

        const termPeriodId = String(activeTerm.termPeriodId)
        const skillReference = await getAssessmentReferenceDataV3(
          { classAssignmentId, termPeriodId },
          token,
        )
        if (!active) return

        setTerms(availableTerms)
        setSkills(skillReference.skills ?? [])
        setQuestionTypes(supportedQuestionTypes(skillReference))
        setRubrics(skillReference.rubrics ?? [])
        setResponseRegionSizes(skillReference.responseRegionSizes ?? [])
        setForm((current) => ({ ...current, classAssignmentId, termPeriodId }))
      } catch (error) {
        if (active) setMessage({ type: 'error', text: error.message })
      } finally {
        if (active) setLoading(false)
      }
    }

    initialize()
    return () => { active = false }
  }, [initialClassAssignmentId, testId, token, refreshAnswerSheetEligibility])

  const selectedAssignment = useMemo(
    () => assignments.find((assignment) => String(assignment.classAssignmentId) === form.classAssignmentId),
    [assignments, form.classAssignmentId],
  )
  const selectedTerm = useMemo(
    () => terms.find((term) => String(term.termPeriodId) === form.termPeriodId),
    [form.termPeriodId, terms],
  )

  const totalItems = form.parts.reduce((total, part) => total + part.questions.length, 0)
  const maximumScore = form.parts.reduce(
    (total, part) => total + part.questions.length * Number(part.pointsPerItem || 0),
    0,
  )
  const completedItems = useMemo(
    () =>
      form.parts.reduce(
        (total, part) =>
          total +
          part.questions.filter((question, questionIndex) => (
            !questionValidationError(part, question, questionIndex + 1, rubrics)
          )).length,
        0,
      ),
    [form.parts, rubrics],
  )
  const rootCompetencies = useMemo(() => {
    const roots = new Map()
    skills.forEach((skill) => {
      if (skill.rootTagId && !roots.has(String(skill.rootTagId))) {
        roots.set(String(skill.rootTagId), {
          rootTagId: skill.rootTagId,
          rootTagName: skill.rootTagName || 'Root competency',
        })
      }
    })
    return Array.from(roots.values())
  }, [skills])
  const mappedItems = useMemo(() => {
    let count = 0

    form.parts.forEach((part) => {
      const coveredItems = new Set()
      part.skillMappings.forEach((mapping) => {
        if (!mapping.skillIds.length) return
        const start = Number(mapping.fromItemNumber)
        const end = Number(mapping.toItemNumber)
        for (let item = start; item <= end && item <= part.questions.length; item += 1) {
          if (item >= 1) coveredItems.add(item)
        }
      })
      count += coveredItems.size
    })

    return count
  }, [form.parts])
  const currentPayloadSnapshot = JSON.stringify(toPayload(form))
  const hasUnsavedChanges = Boolean(
    currentTestId && savedPayloadSnapshot !== currentPayloadSnapshot,
  )
  const isDraft = assessmentStatus === 'draft'
  const reviewError = validateDraft(form, rubrics)
  const answerSheetBlockerMessage = answerSheetEligibility?.blockers
    ?.map((blocker) => blocker.message)
    .filter(Boolean)
    .join(' ')
  const bubbleAnswerSheetTitle = !currentTestAssignmentId
    ? 'Save the assessment before printing the Bubble Answer Sheet.'
    : answerSheetChecking
      ? 'Checking Bubble Answer Sheet eligibility...'
      : answerSheetEligibility && !answerSheetEligibility.eligible
        ? answerSheetBlockerMessage || 'This assessment is not eligible for Bubble Answer Sheet generation yet.'
        : answerSheetPreparing
          ? 'Preparing the Bubble Answer Sheet PDF...'
          : 'Generate and open the Bubble Answer Sheet PDF'
  const updateForm = (field, value) => {
    if (field === 'openAt') setOpenAtError('')
    setForm((current) => ({ ...current, [field]: value }))
  }
  const updatePart = (partIndex, updates) => setForm((current) => ({
    ...current,
    parts: current.parts.map((part, index) => index === partIndex ? { ...part, ...updates } : part),
  }))
  const updateQuestion = (partIndex, questionIndex, field, value) => setForm((current) => ({
    ...current,
    parts: current.parts.map((part, index) => index === partIndex ? {
      ...part,
      questions: part.questions.map((question, itemIndex) => (
        itemIndex === questionIndex ? { ...question, [field]: value } : question
      )),
    } : part),
  }))
  const updateQuestionFields = (partIndex, questionIndex, updates) => setForm((current) => ({
    ...current,
    parts: current.parts.map((part, index) => index === partIndex ? {
      ...part,
      questions: part.questions.map((question, itemIndex) => (
        itemIndex === questionIndex ? { ...question, ...updates } : question
      )),
    } : part),
  }))

  const handleTermChange = async (termPeriodId) => {
    updateForm('termPeriodId', termPeriodId)
    setMessage(null)

    if (!termPeriodId || !form.classAssignmentId) {
      setSkills([])
      return
    }

    try {
      const referenceData = await getAssessmentReferenceDataV3(
        { classAssignmentId: form.classAssignmentId, termPeriodId },
        token,
      )
      setSkills(referenceData.skills ?? [])
      setQuestionTypes(supportedQuestionTypes(referenceData))
      setRubrics(referenceData.rubrics ?? [])
      setResponseRegionSizes(referenceData.responseRegionSizes ?? [])
      setForm((current) => ({
        ...current,
        termPeriodId,
        parts: current.parts.map((part) => ({
          ...part,
          skillMappings: part.skillMappings.map((mapping) => ({
            ...mapping,
            rootTagId: '',
            skillIds: [],
          })),
        })),
      }))
    } catch (error) {
      setSkills([])
      setQuestionTypes([])
      setRubrics([])
      setResponseRegionSizes([])
      setMessage({ type: 'error', text: error.message })
    }
  }

  const handlePartTypeChange = (partIndex, partType) => {
    const currentPart = form.parts[partIndex]
    if (!currentPart || currentPart.partType === partType) return

    if (
      currentPart.partType &&
      !window.confirm(
        'Changing the question type will clear existing answers and type-specific settings in this part. Question text and competency mappings will remain. Continue?',
      )
    ) {
      return
    }

    setForm((current) => ({
      ...current,
      parts: current.parts.map((part, index) => index === partIndex ? {
        ...part,
        partType,
        questions: part.questions.map((question, questionIndex) => (
          emptyQuestion(
            questionIndex + 1,
            partType,
            Number(part.pointsPerItem) || 1,
            question.questionText,
          )
        )),
      } : part),
    }))
    setMessage(null)
  }

  const handleItemCountChange = (partIndex, value) => {
    const requestedCount = Number(value)
    if (!Number.isInteger(requestedCount) || requestedCount < 1 || requestedCount > 200) return

    setForm((current) => ({
      ...current,
      parts: current.parts.map((part, index) => {
        if (index !== partIndex) return part

        const previousCount = part.questions.length
        const questions = Array.from({ length: requestedCount }, (_, questionIndex) => (
          part.questions[questionIndex] ?? emptyQuestion(
            questionIndex + 1,
            part.partType,
            Number(part.pointsPerItem) || 1,
          )
        )).map((question, questionIndex) => ({
          ...question,
          itemNumber: questionIndex + 1,
        }))
        let skillMappings = part.skillMappings
          .filter((mapping) => Number(mapping.fromItemNumber) <= requestedCount)
          .map((mapping) => ({
            ...mapping,
            toItemNumber: Math.min(Number(mapping.toItemNumber), requestedCount),
          }))

        if (
          skillMappings.length === 1 &&
          Number(skillMappings[0].fromItemNumber) === 1 &&
          Number(skillMappings[0].toItemNumber) === previousCount
        ) {
          skillMappings = [{ ...skillMappings[0], toItemNumber: requestedCount }]
        }

        if (!skillMappings.length) {
          skillMappings = [{
            fromItemNumber: 1,
            toItemNumber: requestedCount,
            rootTagId: '',
            skillIds: [],
          }]
        }

        return { ...part, questions, skillMappings }
      }),
    }))
  }

  const handlePointsPerItemChange = (partIndex, value) => {
    const pointsPerItem = Number(value)
    if (!Number.isInteger(pointsPerItem) || pointsPerItem < 1) return
    updatePart(partIndex, { pointsPerItem })
  }

  const updateMapping = (partIndex, mappingIndex, field, value) => setForm((current) => ({
    ...current,
    parts: current.parts.map((part, index) => index === partIndex ? {
      ...part,
      skillMappings: part.skillMappings.map((mapping, rangeIndex) => (
        rangeIndex === mappingIndex ? { ...mapping, [field]: value } : mapping
      )),
    } : part),
  }))

  const handleMappingRootChange = (partIndex, mappingIndex, rootTagId) => {
    setForm((current) => ({
      ...current,
      parts: current.parts.map((part, index) => {
        if (index !== partIndex) return part

        return {
          ...part,
          skillMappings: part.skillMappings.map((mapping, rangeIndex) => {
            if (rangeIndex !== mappingIndex) return mapping
            return { ...mapping, rootTagId, skillIds: [] }
          }),
        }
      }),
    }))
  }

  const handleMappingSkillChange = (partIndex, mappingIndex, skillId) => {
    updateMapping(
      partIndex,
      mappingIndex,
      'skillIds',
      skillId ? [Number(skillId)] : [],
    )
  }

  const submit = async () => {
    const validationError = validateDraft(form, rubrics)
    if (validationError) {
      setMessage({ type: 'error', text: validationError })
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    setSaving(true)
    setMessage(null)

    try {
      const payload = toPayload(form)
      const saved = isEditing
        ? await updateAssessmentV3(currentTestId, payload, token)
        : await createAssessmentV3(payload, token)
      setCurrentTestId(saved.testId)
      setAssessmentStatus(String(saved.status ?? 'draft').toLowerCase())
      setSavedPayloadSnapshot(JSON.stringify(payload))
      setMessage({ type: 'success', text: 'Draft assessment saved successfully.' })
      setCurrentTestAssignmentId(saved.testAssignmentId ?? null)
      setAnswerSheetVersion(null)
      refreshAnswerSheetEligibility(saved.testAssignmentId ?? null)
    } catch (error) {
      setMessage({ type: 'error', text: error.message })
      setOpenAtError(error.errors?.openAt ?? '')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } finally {
      setSaving(false)
    }
  }

  const handlePrintBubbleAnswerSheet = async () => {
    if (!currentTestAssignmentId || !answerSheetEligibility?.eligible) return

    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      setAnswerSheetError('Allow pop-ups to open the Bubble Answer Sheet.')
      return
    }

    setAnswerSheetPreparing(true)
    setAnswerSheetError('')

    try {
      let version = answerSheetVersion
      if (!version) {
        version = await generateAnswerSheetVersionV3(currentTestAssignmentId, 'A4', token)
        setAnswerSheetVersion(version)
      }

      const pdfBlob = await downloadAnswerSheetPdfV3(version.answerSheetVersionId, token)
      const pdfUrl = URL.createObjectURL(pdfBlob)
      printWindow.opener = null
      printWindow.location.replace(pdfUrl)
      window.setTimeout(() => URL.revokeObjectURL(pdfUrl), 60_000)
    } catch (printError) {
      printWindow.close()
      setAnswerSheetError(printError.message)
    } finally {
      setAnswerSheetPreparing(false)
    }
  }

  const handleActivate = async () => {
    if (!currentTestId || !isDraft || hasUnsavedChanges) return

    const validationError = validateDraft(form, rubrics)
    if (validationError) {
      setMessage({ type: 'error', text: validationError })
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    setActivating(true)
    setMessage(null)

    try {
      const activated = await activateAssessmentV3(currentTestId, token)
      setAssessmentStatus(String(activated.status ?? 'active').toLowerCase())
      setMessage({ type: 'success', text: 'Assessment activated successfully.' })
    } catch (error) {
      setMessage({ type: 'error', text: error.message })
      setOpenAtError(error.errors?.openAt ?? '')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } finally {
      setActivating(false)
    }
  }

  const handleBack = () => {
    onNavigate?.('class-records', {
      classId: selectedAssignment?.classId ?? null,
      classAssignmentId: form.classAssignmentId || null,
      initialTab: 'assessment',
    })
  }

  if (loading) {
    return (
      <section className="smart-ui flex min-h-72 items-center justify-center text-sm text-muted-foreground">
        <LoaderCircle className="mr-2 size-5 animate-spin text-primary" />
        Loading assessment editor...
      </section>
    )
  }

  return (
    <section className="smart-ui teacher-assessment-editor-page space-y-6 pb-8">
      <Button variant="link" onClick={handleBack}>
        <ArrowLeft />
        Back to assessments
      </Button>

      <header className="assessment-editor-header border-b border-border pb-5">
        <div className="assessment-editor-header-copy space-y-1">
          <p className="m-0 text-xs font-semibold uppercase text-primary">
            {isEditing ? 'Assessment editor' : 'New assessment'}
          </p>
          <h1 className="m-0 text-2xl font-bold text-foreground">
            {isEditing ? form.testName || 'Edit assessment' : 'Create draft assessment'}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={assessmentStatus === 'active' ? 'default' : 'secondary'}>
              {assessmentStatus === 'active' ? 'Active' : 'Draft'}
            </Badge>
            <p className="m-0 max-w-2xl text-sm text-muted-foreground">
              Complete every part, answer key, and skill range before activation.
            </p>
          </div>
        </div>
        <div className="assessment-editor-header-actions">
          <Button
            variant="outline"
            disabled={saving || activating || !isDraft}
            onClick={submit}
          >
            {saving ? <LoaderCircle className="animate-spin" /> : <Save />}
            Save draft
          </Button>
          <Button
            disabled={
              saving ||
              activating ||
              !currentTestId ||
              !isDraft ||
              hasUnsavedChanges ||
              Boolean(reviewError)
            }
            title={
              hasUnsavedChanges
                ? 'Save the latest draft changes before activation.'
                : reviewError || ''
            }
            onClick={handleActivate}
          >
            {activating ? <LoaderCircle className="animate-spin" /> : <CheckCircle2 />}
            Activate
          </Button>
          <Button
            variant="outline"
            disabled
            title="Test Questionnaire printing has no backend endpoint yet."
          >
            <Printer />
            Print Test Questionnaire
          </Button>
          <Button
            variant="outline"
            disabled={
              !currentTestAssignmentId ||
              answerSheetChecking ||
              answerSheetPreparing ||
              !answerSheetEligibility?.eligible
            }
            title={bubbleAnswerSheetTitle}
            onClick={handlePrintBubbleAnswerSheet}
          >
            {answerSheetChecking || answerSheetPreparing ? (
              <LoaderCircle className="animate-spin" />
            ) : (
              <Printer />
            )}
            Print Bubble Answer Sheet
          </Button>
        </div>
        {answerSheetEligibility && !answerSheetEligibility.eligible ? (
          <p className="col-span-full m-0 text-sm text-muted-foreground">
            Bubble Answer Sheet not available yet:{' '}
            {answerSheetBlockerMessage || 'this assessment does not meet the current template requirements.'}
          </p>
        ) : null}
        {answerSheetError ? (
          <p className="col-span-full m-0 text-sm text-destructive">{answerSheetError}</p>
        ) : null}
      </header>

      {message && (
        <div
          role={message.type === 'error' ? 'alert' : 'status'}
          className={message.type === 'error'
            ? 'rounded-md border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive'
            : 'rounded-md border border-success/20 bg-success-soft px-4 py-3 text-sm font-medium text-success'}
        >
          {message.text}
        </div>
      )}

      <div className="assessment-editor-layout">
        <main className="assessment-editor-configuration">
      <fieldset className="contents" disabled={!isDraft}>
      <Card>
        <CardHeader>
          <CardTitle>Assessment details</CardTitle>
          <CardDescription>Enter the main assessment information.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 border-t border-border pt-5 md:grid-cols-[minmax(0,2fr)_minmax(0,1.25fr)_minmax(0,1fr)]">
          <div className="space-y-2">
            <Label htmlFor="assessment-name">Assessment name</Label>
            <Input
              id="assessment-name"
              value={form.testName}
              maxLength="120"
              placeholder="Example: Quarter 1 Mathematics Quiz"
              onChange={(event) => updateForm('testName', event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="assessment-term">Term period</Label>
            <Select
              value={form.termPeriodId ? String(form.termPeriodId) : undefined}
              onValueChange={handleTermChange}
            >
              <SelectTrigger id="assessment-term">
                <SelectValue placeholder="Select term period" />
              </SelectTrigger>
              <SelectContent>
                {terms.map((term) => (
                  <SelectItem key={term.termPeriodId} value={String(term.termPeriodId)}>
                    {term.termName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="assessment-type">Assessment type</Label>
            <Select
              value={form.testType}
              onValueChange={(value) => updateForm('testType', value)}
            >
              <SelectTrigger id="assessment-type">
                <SelectValue placeholder="Select assessment type" />
              </SelectTrigger>
              <SelectContent>
                {TEST_TYPES.map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-5 md:col-span-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="assessment-open-at">Opens</Label>
              <DateTimePicker
                id="assessment-open-at"
                value={form.openAt}
                onChange={(value) => updateForm('openAt', value)}
                placeholder="Select opening date and time"
              />
              {openAtError ? <p className="m-0 text-sm text-destructive">{openAtError}</p> : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="assessment-close-at">Closes (optional)</Label>
              <DateTimePicker
                id="assessment-close-at"
                value={form.closeAt}
                minDateTime={form.openAt}
                onChange={(value) => updateForm('closeAt', value)}
                placeholder="Select closing date and time"
              />
            </div>
          </div>

          <div className="grid gap-3 md:col-span-3 md:grid-cols-2">
            <ToggleField
              id="assessment-allow-late-capture"
              checked={form.allowLateCapture}
              onChange={(checked) => updateForm('allowLateCapture', checked)}
              label="Allow late result capture"
            />
            <ToggleField
              id="assessment-confirm-outside-timetable"
              checked={form.confirmOutsideClassSchedule}
              onChange={(checked) => {
                setForm((current) => ({
                  ...current,
                  confirmOutsideClassSchedule: checked,
                  outsideClassScheduleReason: checked
                    ? current.outsideClassScheduleReason
                    : '',
                }))
              }}
              label="Allow schedule outside class timetable"
            />
          </div>

          {form.confirmOutsideClassSchedule ? (
            <div className="space-y-2 md:col-span-3">
              <Label htmlFor="assessment-outside-timetable-reason">
                Outside-timetable reason
              </Label>
              <Input
                id="assessment-outside-timetable-reason"
                value={form.outsideClassScheduleReason}
                minLength="5"
                maxLength="255"
                placeholder="Enter the reason for this schedule"
                onChange={(event) => updateForm(
                  'outsideClassScheduleReason',
                  event.target.value,
                )}
              />
            </div>
          ) : null}

          <div className="space-y-2 md:col-span-3">
            <Label htmlFor="assessment-instructions">Instructions (optional)</Label>
            <textarea
              id="assessment-instructions"
              className={TEXTAREA_CLASS}
              rows="3"
              value={form.instructions}
              placeholder="Instructions shown with the assessment"
              onChange={(event) => updateForm('instructions', event.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <p className="m-0 text-xs font-semibold uppercase text-primary">Assessment content</p>
          <h2 className="m-0 text-xl font-semibold text-foreground">Configure test parts</h2>
          <p className="m-0 text-sm text-muted-foreground">Set the part name, item count, and score per item.</p>
        </div>
        <Button
          variant="outline"
          onClick={() => setForm((current) => ({
            ...current,
            parts: [...current.parts, emptyPart(current.parts.length + 1)],
          }))}
        >
          <CopyPlus />
          Add test part
        </Button>
      </div>

      <div className="space-y-5">
        {form.parts.map((part, partIndex) => (
          <Card key={`part-${partIndex + 1}`}>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-3">
                <Badge className="mt-0.5" variant="secondary">Order {partIndex + 1}</Badge>
                <div className="min-w-0 space-y-1">
                  <CardTitle className="truncate">{part.partName || 'Untitled test part'}</CardTitle>
                  <CardDescription>
                    {part.questions.length} item{part.questions.length === 1 ? '' : 's'} · {part.pointsPerItem || 0} point(s) each
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {form.parts.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    title="Remove part"
                    aria-label={`Remove part ${partIndex + 1}`}
                    onClick={() => setForm((current) => ({
                      ...current,
                      parts: current.parts
                        .filter((_, index) => index !== partIndex)
                        .map((item, index) => ({ ...item, partOrder: index + 1 })),
                    }))}
                  >
                    <Trash2 className="text-destructive" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  title={part.expanded ? 'Collapse part' : 'Expand part'}
                  aria-label={part.expanded ? `Collapse part ${partIndex + 1}` : `Expand part ${partIndex + 1}`}
                  onClick={() => updatePart(partIndex, { expanded: !part.expanded })}
                >
                  {part.expanded ? <ChevronUp /> : <ChevronDown />}
                </Button>
              </div>
            </CardHeader>

            {part.expanded && (
              <CardContent className="assessment-part-content border-t border-border pt-5">
                <div className="assessment-part-settings-grid">
                  <div className="space-y-2">
                    <Label htmlFor={`part-${partIndex}-name`}>Part name</Label>
                    <Input
                      id={`part-${partIndex}-name`}
                      value={part.partName}
                      maxLength="80"
                      placeholder="Enter part name"
                      onChange={(event) => updatePart(partIndex, { partName: event.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`part-${partIndex}-type`}>Part type</Label>
                    <Select
                      value={part.partType || undefined}
                      disabled={!questionTypes.length}
                      onValueChange={(value) => handlePartTypeChange(partIndex, value)}
                    >
                      <SelectTrigger id={`part-${partIndex}-type`}>
                        <SelectValue
                          placeholder={questionTypes.length
                            ? 'Select question type'
                            : 'No question types available'}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {questionTypes.map((questionType) => (
                          <SelectItem key={questionType.code} value={questionType.code}>
                            {questionType.name || formatCodeLabel(questionType.code)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`part-${partIndex}-items`}>Number of items</Label>
                    <Input
                      id={`part-${partIndex}-items`}
                      type="number"
                      min="1"
                      max="200"
                      step="1"
                      value={part.questions.length}
                      onChange={(event) => handleItemCountChange(partIndex, event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`part-${partIndex}-points`}>Points per item</Label>
                    <Input
                      id={`part-${partIndex}-points`}
                      type="number"
                      min="1"
                      step="1"
                      value={part.pointsPerItem}
                      onChange={(event) => handlePointsPerItemChange(partIndex, event.target.value)}
                    />
                  </div>
                </div>

                <section className="assessment-questions-section space-y-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="m-0 text-base font-semibold text-foreground">Encode questions</h3>
                      <p className="m-0 mt-1 text-sm text-muted-foreground">
                        Question fields are generated from the configured number of items.
                      </p>
                    </div>
                  </div>

                  {!part.partType ? (
                    <div className="rounded-md border border-dashed border-border bg-muted/40 px-4 py-6 text-sm text-muted-foreground">
                      Select a question type to configure this part's question fields.
                    </div>
                  ) : (
                    <div className="divide-y divide-border rounded-md border border-border">
                    {part.questions.map((question, questionIndex) => (
                      <div className="grid gap-4 p-4 lg:grid-cols-[auto_1fr]" key={`part-${partIndex}-question-${questionIndex}`}>
                        <span className="flex size-8 items-center justify-center rounded-md bg-secondary text-sm font-semibold text-secondary-foreground">
                          {questionIndex + 1}
                        </span>

                        <div className="min-w-0 space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor={`part-${partIndex}-question-${questionIndex}`}>Question</Label>
                            <textarea
                              id={`part-${partIndex}-question-${questionIndex}`}
                              className={TEXTAREA_CLASS}
                              rows="2"
                              value={question.questionText}
                              onChange={(event) => updateQuestion(partIndex, questionIndex, 'questionText', event.target.value)}
                            />
                          </div>

                          <QuestionTypeEditor
                            part={part}
                            partIndex={partIndex}
                            question={question}
                            questionIndex={questionIndex}
                            rubrics={rubrics}
                            responseRegionSizes={responseRegionSizes}
                            onChange={(updates) => updateQuestionFields(
                              partIndex,
                              questionIndex,
                              updates,
                            )}
                          />
                        </div>

                      </div>
                    ))}
                    </div>
                  )}
                </section>

                <section className="assessment-mapping-section space-y-3 border-t border-border pt-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="m-0 text-base font-semibold text-foreground">Configure competency mapping</h3>
                      <p className="m-0 mt-1 text-sm text-muted-foreground">
                        Select one competency skill for each item range and cover every item.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updatePart(partIndex, {
                        skillMappings: [
                          ...part.skillMappings,
                          {
                            fromItemNumber: 1,
                            toItemNumber: part.questions.length,
                            rootTagId: '',
                            skillIds: [],
                          },
                        ],
                      })}
                    >
                      <CirclePlus />
                      Add range
                    </Button>
                  </div>

                  {form.termPeriodId && !skills.length ? (
                    <div
                      className="rounded-md border border-dashed border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground"
                      role="status"
                    >
                      No competencies are available for this class assignment and term period.
                    </div>
                  ) : null}

                  <div className="divide-y divide-border rounded-md border border-border">
                    {part.skillMappings.map((mapping, mappingIndex) => {
                      const mappedSkill = skills.find((skill) => (
                        mapping.skillIds.map(Number).includes(Number(skill.skillId))
                      ))
                      const selectedRootTagId = String(
                        mapping.rootTagId || mappedSkill?.rootTagId || '',
                      )
                      const availableSkills = skills.filter((skill) => (
                        String(skill.rootTagId) === selectedRootTagId
                      ))

                      return (
                      <div className="assessment-mapping-row" key={`mapping-${partIndex}-${mappingIndex}`}>
                        <div className="space-y-2">
                          <Label htmlFor={`part-${partIndex}-mapping-${mappingIndex}-from`}>From item</Label>
                          <Input
                            id={`part-${partIndex}-mapping-${mappingIndex}-from`}
                            type="number"
                            min="1"
                            max={part.questions.length}
                            value={mapping.fromItemNumber}
                            onChange={(event) => updateMapping(partIndex, mappingIndex, 'fromItemNumber', event.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`part-${partIndex}-mapping-${mappingIndex}-to`}>To item</Label>
                          <Input
                            id={`part-${partIndex}-mapping-${mappingIndex}-to`}
                            type="number"
                            min="1"
                            max={part.questions.length}
                            value={mapping.toItemNumber}
                            onChange={(event) => updateMapping(partIndex, mappingIndex, 'toItemNumber', event.target.value)}
                          />
                        </div>

                        <div className="min-w-0 space-y-2">
                          <Label htmlFor={`part-${partIndex}-mapping-${mappingIndex}-root`}>
                            Root competency
                          </Label>
                          <Select
                            value={selectedRootTagId || undefined}
                            disabled={!rootCompetencies.length}
                            onValueChange={(value) => handleMappingRootChange(
                              partIndex,
                              mappingIndex,
                              value,
                            )}
                          >
                            <SelectTrigger id={`part-${partIndex}-mapping-${mappingIndex}-root`}>
                              <SelectValue placeholder="Select root competency" />
                            </SelectTrigger>
                            <SelectContent>
                              {rootCompetencies.map((root) => (
                                <SelectItem key={root.rootTagId} value={String(root.rootTagId)}>
                                  {root.rootTagName}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="min-w-0 space-y-2">
                          <Label htmlFor={`part-${partIndex}-mapping-${mappingIndex}-skill`}>
                            Specific competency / skill
                          </Label>
                          <Select
                            value={mapping.skillIds[0] ? String(mapping.skillIds[0]) : undefined}
                            disabled={!selectedRootTagId || !availableSkills.length}
                            onValueChange={(value) => handleMappingSkillChange(
                              partIndex,
                              mappingIndex,
                              value,
                            )}
                          >
                            <SelectTrigger id={`part-${partIndex}-mapping-${mappingIndex}-skill`}>
                              <SelectValue
                                placeholder={availableSkills.length
                                  ? 'Select competency or skill'
                                  : 'No skills available'}
                              />
                            </SelectTrigger>
                            <SelectContent>
                              {availableSkills.map((skill) => (
                                <SelectItem key={skill.skillId} value={String(skill.skillId)}>
                                  {skill.competencyName || 'Unnamed skill'}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="self-end"
                          title="Remove skill range"
                          aria-label={`Remove skill range ${mappingIndex + 1}`}
                          disabled={part.skillMappings.length === 1}
                          onClick={() => updatePart(partIndex, {
                            skillMappings: part.skillMappings.filter((_, index) => index !== mappingIndex),
                          })}
                        >
                          <Trash2 className="text-destructive" />
                        </Button>
                      </div>
                      )
                    })}
                  </div>
                </section>
              </CardContent>
            )}
          </Card>
        ))}
      </div>
      </fieldset>
        </main>

        <aside className="assessment-editor-summary" aria-label="Assessment configuration summary">
          <Card className="assessment-editor-summary-card">
            <CardHeader>
              <CardTitle>Configuration summary</CardTitle>
              <CardDescription>Current assessment setup.</CardDescription>
            </CardHeader>
            <CardContent className="assessment-editor-summary-content">
              <dl className="assessment-editor-summary-list">
                <div>
                  <dt>Status</dt>
                  <dd>
                    <Badge variant={assessmentStatus === 'active' ? 'default' : 'secondary'}>
                      {assessmentStatus === 'active' ? 'Active' : 'Draft'}
                    </Badge>
                  </dd>
                </div>
                <div>
                  <dt>Class</dt>
                  <dd>{selectedAssignment ? assignmentLabel(selectedAssignment) : 'Not selected'}</dd>
                </div>
                <div>
                  <dt>Term</dt>
                  <dd>{selectedTerm?.termName || 'Not selected'}</dd>
                </div>
                <div>
                  <dt>Content</dt>
                  <dd>
                    {form.parts.length} part{form.parts.length === 1 ? '' : 's'} · {totalItems}{' '}
                    item{totalItems === 1 ? '' : 's'}
                  </dd>
                </div>
                <div>
                  <dt>Questions</dt>
                  <dd>{completedItems} of {totalItems} complete</dd>
                </div>
                <div>
                  <dt>Maximum score</dt>
                  <dd>{maximumScore} point{maximumScore === 1 ? '' : 's'}</dd>
                </div>
                <div>
                  <dt>Skill coverage</dt>
                  <dd>{mappedItems} of {totalItems} items mapped</dd>
                </div>
              </dl>

              {reviewError ? (
                <p className="assessment-editor-summary-error" role="status">
                  {reviewError}
                </p>
              ) : null}
            </CardContent>
          </Card>
        </aside>
      </div>
    </section>
  )
}

export default V2AssessmentEditorPage

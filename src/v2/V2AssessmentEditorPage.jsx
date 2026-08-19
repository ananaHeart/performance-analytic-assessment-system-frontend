import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CirclePlus,
  CopyPlus,
  LoaderCircle,
  Save,
  Trash2,
} from 'lucide-react'

import {
  activateAssessmentV2,
  createAssessmentV2,
  getAssessmentReferenceDataV2,
  getAssessmentV2,
  updateAssessmentV2,
} from '@/api/apiV2Client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { navigateV2, V2_ROUTES } from '@/v2/v2Routes'

const TEST_TYPES = [
  ['quiz', 'Quiz'],
  ['exam', 'Exam'],
  ['diagnostic', 'Diagnostic'],
  ['long_test', 'Long test'],
  ['other', 'Other'],
]

const SELECT_CLASS = 'h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-70'
const TEXTAREA_CLASS = 'min-h-20 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-70'

function emptyQuestion(itemNumber, partType = 'multiple_choice') {
  return {
    itemNumber,
    questionText: '',
    optionA: partType === 'true_false' ? 'True' : '',
    optionB: partType === 'true_false' ? 'False' : '',
    optionC: '',
    optionD: '',
    optionE: '',
    correctOption: 'A',
  }
}

function emptyPart(partOrder) {
  return {
    partOrder,
    partName: `Part ${partOrder}`,
    partType: 'multiple_choice',
    pointsPerItem: 1,
    questions: [emptyQuestion(1)],
    skillMappings: [{ fromItemNumber: 1, toItemNumber: 1, skillIds: [] }],
    expanded: true,
  }
}

function groupQuestionSkills(questions = []) {
  const mappings = []
  const sorted = [...questions].sort((a, b) => a.itemNumber - b.itemNumber)

  sorted.forEach((question) => {
    const skillIds = [...(question.skillIds ?? [])].map(Number).sort((a, b) => a - b)
    const key = skillIds.join(',')
    const previous = mappings[mappings.length - 1]

    if (previous && previous.key === key && previous.toItemNumber + 1 === question.itemNumber) {
      previous.toItemNumber = question.itemNumber
      return
    }

    mappings.push({
      key,
      fromItemNumber: question.itemNumber,
      toItemNumber: question.itemNumber,
      skillIds,
    })
  })

  return mappings.length
    ? mappings.map(({ fromItemNumber, toItemNumber, skillIds }) => ({
        fromItemNumber,
        toItemNumber,
        skillIds,
      }))
    : [{ fromItemNumber: 1, toItemNumber: 1, skillIds: [] }]
}

function hydrateAssessment(assessment) {
  const parts = (assessment.parts ?? []).map((part, index) => {
    const partType = part.partType ?? 'multiple_choice'
    const questions = (part.questions ?? []).map((question, questionIndex) => ({
      itemNumber: question.itemNumber ?? questionIndex + 1,
      questionText: question.questionText ?? '',
      optionA: question.optionA ?? (partType === 'true_false' ? 'True' : ''),
      optionB: question.optionB ?? (partType === 'true_false' ? 'False' : ''),
      optionC: question.optionC ?? '',
      optionD: question.optionD ?? '',
      optionE: question.optionE ?? '',
      correctOption: question.correctOption ?? 'A',
      skillIds: question.skillIds ?? [],
    }))

    return {
      partOrder: part.partOrder ?? index + 1,
      partName: part.partName ?? `Part ${index + 1}`,
      partType,
      pointsPerItem: Number(part.pointsPerItem ?? 1),
      questions: questions.length ? questions : [emptyQuestion(1, partType)],
      skillMappings: groupQuestionSkills(questions),
      expanded: true,
    }
  })

  return {
    classAssignmentId: String(assessment.classAssignmentId ?? ''),
    termPeriodId: String(assessment.termPeriodId ?? ''),
    testName: assessment.testName ?? '',
    testType: assessment.testType ?? 'quiz',
    testDate: assessment.testDate ?? '',
    instructions: assessment.instructions ?? '',
    parts: parts.length ? parts : [emptyPart(1)],
  }
}

function validateDraft(form) {
  if (!form.classAssignmentId || !form.termPeriodId || !form.testName.trim() || !form.testDate) {
    return 'Complete the class assignment, term period, assessment name, and test date.'
  }

  if (!form.parts.length) return 'Add at least one assessment part.'

  for (const part of form.parts) {
    const partName = part.partName.trim() || `Part ${part.partOrder}`
    const pointsPerItem = Number(part.pointsPerItem)

    if (!part.partName.trim() || !part.questions.length) {
      return `Complete ${partName} and add at least one question.`
    }

    if (!Number.isFinite(pointsPerItem) || pointsPerItem < 0.01) {
      return `${partName}: points per item must be greater than zero.`
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

      if (!question.questionText.trim()) {
        return `${partName}, item ${itemNumber}: enter the question text.`
      }

      if (part.partType === 'true_false') {
        if (!['A', 'B'].includes(question.correctOption)) {
          return `${partName}, item ${itemNumber}: True/False must use A for True or B for False.`
        }
        continue
      }

      const requiredOptions = [question.optionA, question.optionB, question.optionC, question.optionD]
      if (requiredOptions.some((value) => !value.trim())) {
        return `${partName}, item ${itemNumber}: options A to D are required.`
      }

      if (question.correctOption === 'E' && !question.optionE.trim()) {
        return `${partName}, item ${itemNumber}: enter option E or select another correct answer.`
      }
    }
  }

  return ''
}

function toPayload(form) {
  return {
    classAssignmentId: Number(form.classAssignmentId),
    termPeriodId: Number(form.termPeriodId),
    testName: form.testName.trim(),
    testType: form.testType,
    testDate: form.testDate,
    instructions: form.instructions.trim() || null,
    parts: form.parts.map((part, partIndex) => ({
      partOrder: partIndex + 1,
      partName: part.partName.trim(),
      partType: part.partType,
      pointsPerItem: Number(part.pointsPerItem),
      questions: part.questions.map((question, questionIndex) => ({
        itemNumber: questionIndex + 1,
        questionText: question.questionText.trim(),
        optionA: part.partType === 'true_false' ? 'True' : question.optionA.trim(),
        optionB: part.partType === 'true_false' ? 'False' : question.optionB.trim(),
        optionC: part.partType === 'true_false' ? null : question.optionC.trim(),
        optionD: part.partType === 'true_false' ? null : question.optionD.trim(),
        optionE: part.partType === 'true_false' ? null : question.optionE.trim() || null,
        correctOption: question.correctOption,
        skillIds: [],
      })),
      skillMappings: part.skillMappings.map((mapping) => ({
        fromItemNumber: Number(mapping.fromItemNumber),
        toItemNumber: Number(mapping.toItemNumber),
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

function skillLabel(skill = {}) {
  return [skill.competencyName || 'Unnamed skill', skill.rootTagName].filter(Boolean).join(' | ')
}

function adjustMappingsAfterQuestionRemoval(mappings, removedItemNumber, nextQuestionCount) {
  const adjusted = mappings.flatMap((mapping) => {
    let start = Number(mapping.fromItemNumber)
    let end = Number(mapping.toItemNumber)

    if (removedItemNumber < start) {
      start -= 1
      end -= 1
    } else if (removedItemNumber <= end) {
      if (start === end) return []
      end -= 1
    }

    if (start > nextQuestionCount) return []

    return [{
      ...mapping,
      fromItemNumber: Math.max(1, start),
      toItemNumber: Math.min(end, nextQuestionCount),
    }]
  })

  return adjusted.length
    ? adjusted
    : [{ fromItemNumber: 1, toItemNumber: Math.max(1, nextQuestionCount), skillIds: [] }]
}

function V2AssessmentEditorPage({ token, testId = null }) {
  const isEditing = Boolean(testId)
  const [form, setForm] = useState({
    classAssignmentId: '',
    termPeriodId: '',
    testName: '',
    testType: 'quiz',
    testDate: '',
    instructions: '',
    parts: [emptyPart(1)],
  })
  const [assignments, setAssignments] = useState([])
  const [terms, setTerms] = useState([])
  const [skills, setSkills] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingReference, setLoadingReference] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    let active = true

    async function initialize() {
      setLoading(true)

      try {
        const baseReference = await getAssessmentReferenceDataV2({}, token)
        if (!active) return
        setAssignments(baseReference.classAssignments ?? [])

        if (isEditing) {
          const assessment = await getAssessmentV2(testId, token)
          const [termReference, skillReference] = await Promise.all([
            getAssessmentReferenceDataV2({ classAssignmentId: assessment.classAssignmentId }, token),
            getAssessmentReferenceDataV2({
              classAssignmentId: assessment.classAssignmentId,
              termPeriodId: assessment.termPeriodId,
            }, token),
          ])
          if (!active) return
          setTerms(termReference.termPeriods ?? [])
          setSkills(skillReference.skills ?? [])
          setForm(hydrateAssessment(assessment))
        }
      } catch (error) {
        if (active) setMessage({ type: 'error', text: error.message })
      } finally {
        if (active) setLoading(false)
      }
    }

    initialize()
    return () => { active = false }
  }, [isEditing, testId, token])

  const selectedAssignment = useMemo(
    () => assignments.find((assignment) => String(assignment.classAssignmentId) === form.classAssignmentId),
    [assignments, form.classAssignmentId],
  )

  const totalItems = form.parts.reduce((total, part) => total + part.questions.length, 0)
  const updateForm = (field, value) => setForm((current) => ({ ...current, [field]: value }))
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

  const handleAssignmentChange = async (value) => {
    setForm((current) => ({ ...current, classAssignmentId: value, termPeriodId: '' }))
    setTerms([])
    setSkills([])
    setMessage(null)
    if (!value) return

    setLoadingReference(true)
    try {
      const reference = await getAssessmentReferenceDataV2({ classAssignmentId: value }, token)
      setTerms(reference.termPeriods ?? [])
    } catch (error) {
      setMessage({ type: 'error', text: error.message })
    } finally {
      setLoadingReference(false)
    }
  }

  const handleTermChange = async (value) => {
    updateForm('termPeriodId', value)
    setSkills([])
    setMessage(null)
    if (!value || !form.classAssignmentId) return

    setLoadingReference(true)
    try {
      const reference = await getAssessmentReferenceDataV2({
        classAssignmentId: form.classAssignmentId,
        termPeriodId: value,
      }, token)
      setSkills(reference.skills ?? [])
    } catch (error) {
      setMessage({ type: 'error', text: error.message })
    } finally {
      setLoadingReference(false)
    }
  }

  const handlePartTypeChange = (partIndex, partType) => {
    setForm((current) => ({
      ...current,
      parts: current.parts.map((part, index) => index === partIndex ? {
        ...part,
        partType,
        questions: part.questions.map((question) => ({
          ...question,
          optionA: partType === 'true_false' ? 'True' : '',
          optionB: partType === 'true_false' ? 'False' : '',
          optionC: '',
          optionD: '',
          optionE: '',
          correctOption: 'A',
        })),
      } : part),
    }))
  }

  const addQuestion = (partIndex) => setForm((current) => ({
    ...current,
    parts: current.parts.map((part, index) => {
      if (index !== partIndex) return part

      const previousCount = part.questions.length
      const nextCount = previousCount + 1
      const skillMappings = part.skillMappings.length === 1
        && Number(part.skillMappings[0].fromItemNumber) === 1
        && Number(part.skillMappings[0].toItemNumber) === previousCount
        ? [{ ...part.skillMappings[0], toItemNumber: nextCount }]
        : part.skillMappings

      return {
        ...part,
        questions: [...part.questions, emptyQuestion(nextCount, part.partType)],
        skillMappings,
      }
    }),
  }))

  const removeQuestion = (partIndex, questionIndex) => setForm((current) => ({
    ...current,
    parts: current.parts.map((part, index) => {
      if (index !== partIndex || part.questions.length === 1) return part

      const removedItemNumber = questionIndex + 1
      const questions = part.questions
        .filter((_, itemIndex) => itemIndex !== questionIndex)
        .map((question, itemIndex) => ({ ...question, itemNumber: itemIndex + 1 }))

      return {
        ...part,
        questions,
        skillMappings: adjustMappingsAfterQuestionRemoval(
          part.skillMappings,
          removedItemNumber,
          questions.length,
        ),
      }
    }),
  }))

  const updateMapping = (partIndex, mappingIndex, field, value) => setForm((current) => ({
    ...current,
    parts: current.parts.map((part, index) => index === partIndex ? {
      ...part,
      skillMappings: part.skillMappings.map((mapping, rangeIndex) => (
        rangeIndex === mappingIndex ? { ...mapping, [field]: value } : mapping
      )),
    } : part),
  }))

  const toggleMappingSkill = (partIndex, mappingIndex, skillId) => {
    setForm((current) => ({
      ...current,
      parts: current.parts.map((part, index) => {
        if (index !== partIndex) return part

        return {
          ...part,
          skillMappings: part.skillMappings.map((mapping, rangeIndex) => {
            if (rangeIndex !== mappingIndex) return mapping
            const selected = new Set(mapping.skillIds.map(Number))
            if (selected.has(skillId)) selected.delete(skillId)
            else selected.add(skillId)
            return { ...mapping, skillIds: [...selected] }
          }),
        }
      }),
    }))
  }

  const submit = async (activateAfterSave = false) => {
    const validationError = validateDraft(form)
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
        ? await updateAssessmentV2(testId, payload, token)
        : await createAssessmentV2(payload, token)

      if (activateAfterSave) {
        await activateAssessmentV2(saved.testId, token)
        navigateV2(V2_ROUTES.assessments)
        return
      }

      setMessage({ type: 'success', text: 'Draft assessment saved successfully.' })
      if (!isEditing) navigateV2(`v2/assessments/${saved.testId}/edit`)
    } catch (error) {
      setMessage({ type: 'error', text: error.message })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } finally {
      setSaving(false)
    }
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
    <section className="smart-ui space-y-6 pb-24">
      <Button variant="link" onClick={() => navigateV2(V2_ROUTES.assessments)}>
        <ArrowLeft />
        Back to assessments
      </Button>

      <header className="flex flex-col gap-4 border-b border-border pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <p className="m-0 text-xs font-semibold uppercase text-primary">
            {isEditing ? 'Edit assessment' : 'New assessment'}
          </p>
          <h1 className="m-0 text-2xl font-bold text-foreground">
            {isEditing ? form.testName || 'Edit assessment' : 'Create draft assessment'}
          </h1>
          <p className="m-0 max-w-2xl text-sm text-muted-foreground">
            Complete every part, answer key, and skill range before activating the assessment.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" disabled={saving} onClick={() => submit(false)}>
            {saving ? <LoaderCircle className="animate-spin" /> : <Save />}
            Save draft
          </Button>
          <Button disabled={saving} onClick={() => submit(true)}>
            {saving ? <LoaderCircle className="animate-spin" /> : <CheckCircle2 />}
            Save and activate
          </Button>
        </div>
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

      <Card>
        <CardHeader>
          <CardTitle>Assessment details</CardTitle>
          <CardDescription>Select the assigned class and term that own this assessment.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 border-t border-border pt-5 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="assessment-assignment">Class assignment</Label>
            <select
              id="assessment-assignment"
              className={SELECT_CLASS}
              value={form.classAssignmentId}
              disabled={isEditing || loadingReference}
              onChange={(event) => handleAssignmentChange(event.target.value)}
            >
              <option value="">Select assigned class</option>
              {assignments.map((assignment) => (
                <option key={assignment.classAssignmentId} value={assignment.classAssignmentId}>
                  {assignmentLabel(assignment)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="assessment-term">Term period</Label>
            <select
              id="assessment-term"
              className={SELECT_CLASS}
              value={form.termPeriodId}
              disabled={!form.classAssignmentId || loadingReference}
              onChange={(event) => handleTermChange(event.target.value)}
            >
              <option value="">Select term</option>
              {terms.map((term) => (
                <option key={term.termPeriodId} value={term.termPeriodId}>{term.termName}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="assessment-type">Assessment type</Label>
            <select
              id="assessment-type"
              className={SELECT_CLASS}
              value={form.testType}
              onChange={(event) => updateForm('testType', event.target.value)}
            >
              {TEST_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>

          <div className="space-y-2 md:col-span-2">
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
            <Label htmlFor="assessment-date">Test date</Label>
            <Input
              id="assessment-date"
              type="date"
              value={form.testDate}
              onChange={(event) => updateForm('testDate', event.target.value)}
            />
          </div>

          <div className="space-y-2 md:col-span-2 xl:col-span-1">
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

          {selectedAssignment && (
            <div className="rounded-md border border-border bg-muted px-4 py-3 md:col-span-2 xl:col-span-4">
              <span className="text-xs font-semibold uppercase text-muted-foreground">Assessment ownership</span>
              <strong className="mt-1 block text-sm text-foreground">{assignmentLabel(selectedAssignment)}</strong>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <p className="m-0 text-xs font-semibold uppercase text-primary">Assessment content</p>
          <h2 className="m-0 text-xl font-semibold text-foreground">Test parts and questions</h2>
          <p className="m-0 text-sm text-muted-foreground">Each item must have an answer key and a skill mapping.</p>
        </div>
        <Button
          variant="outline"
          onClick={() => setForm((current) => ({
            ...current,
            parts: [...current.parts, emptyPart(current.parts.length + 1)],
          }))}
        >
          <CopyPlus />
          Add another part
        </Button>
      </div>

      <div className="space-y-5">
        {form.parts.map((part, partIndex) => (
          <Card key={`part-${partIndex + 1}`}>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-3">
                <Badge className="mt-0.5" variant="secondary">Part {partIndex + 1}</Badge>
                <div className="min-w-0 space-y-1">
                  <CardTitle className="truncate">{part.partName || `Part ${partIndex + 1}`}</CardTitle>
                  <CardDescription>
                    {part.questions.length} question{part.questions.length === 1 ? '' : 's'} · {part.pointsPerItem || 0} point(s) each
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
              <CardContent className="space-y-6 border-t border-border pt-5">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor={`part-${partIndex}-name`}>Part name</Label>
                    <Input
                      id={`part-${partIndex}-name`}
                      value={part.partName}
                      maxLength="80"
                      onChange={(event) => updatePart(partIndex, { partName: event.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`part-${partIndex}-type`}>Question type</Label>
                    <select
                      id={`part-${partIndex}-type`}
                      className={SELECT_CLASS}
                      value={part.partType}
                      onChange={(event) => handlePartTypeChange(partIndex, event.target.value)}
                    >
                      <option value="multiple_choice">Multiple choice</option>
                      <option value="true_false">True or false</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`part-${partIndex}-points`}>Points per item</Label>
                    <Input
                      id={`part-${partIndex}-points`}
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={part.pointsPerItem}
                      onChange={(event) => updatePart(partIndex, { pointsPerItem: event.target.value })}
                    />
                  </div>
                </div>

                <section className="space-y-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="m-0 text-base font-semibold text-foreground">Questions and answer keys</h3>
                      <p className="m-0 mt-1 text-sm text-muted-foreground">Item numbers restart inside each part.</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => addQuestion(partIndex)}>
                      <CirclePlus />
                      Add question
                    </Button>
                  </div>

                  <div className="divide-y divide-border rounded-md border border-border">
                    {part.questions.map((question, questionIndex) => (
                      <div className="grid gap-4 p-4 lg:grid-cols-[auto_1fr_auto]" key={`part-${partIndex}-question-${questionIndex}`}>
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

                          {part.partType === 'multiple_choice' ? (
                            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                              {['A', 'B', 'C', 'D', 'E'].map((option) => (
                                <div className="space-y-2" key={option}>
                                  <Label htmlFor={`part-${partIndex}-question-${questionIndex}-option-${option}`}>
                                    Option {option}{option === 'E' ? ' (optional)' : ''}
                                  </Label>
                                  <Input
                                    id={`part-${partIndex}-question-${questionIndex}-option-${option}`}
                                    value={question[`option${option}`]}
                                    maxLength="255"
                                    onChange={(event) => updateQuestion(
                                      partIndex,
                                      questionIndex,
                                      `option${option}`,
                                      event.target.value,
                                    )}
                                  />
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
                              Printed choices are True and False. The API stores <strong>A = True</strong> and <strong>B = False</strong>.
                            </div>
                          )}

                          <div className="max-w-xs space-y-2">
                            <Label htmlFor={`part-${partIndex}-question-${questionIndex}-answer`}>Correct answer</Label>
                            <select
                              id={`part-${partIndex}-question-${questionIndex}-answer`}
                              className={SELECT_CLASS}
                              value={question.correctOption}
                              onChange={(event) => updateQuestion(partIndex, questionIndex, 'correctOption', event.target.value)}
                            >
                              {(part.partType === 'true_false' ? ['A', 'B'] : ['A', 'B', 'C', 'D', 'E']).map((option) => (
                                <option key={option} value={option} disabled={option === 'E' && !question.optionE.trim()}>
                                  {option}{part.partType === 'true_false' ? option === 'A' ? ' - True' : ' - False' : ''}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="self-start"
                          title="Remove question"
                          aria-label={`Remove question ${questionIndex + 1}`}
                          disabled={part.questions.length === 1}
                          onClick={() => removeQuestion(partIndex, questionIndex)}
                        >
                          <Trash2 className="text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="space-y-3 border-t border-border pt-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="m-0 text-base font-semibold text-foreground">Range-based skill mapping</h3>
                      <p className="m-0 mt-1 text-sm text-muted-foreground">Cover every item with at least one competency or skill.</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updatePart(partIndex, {
                        skillMappings: [
                          ...part.skillMappings,
                          { fromItemNumber: 1, toItemNumber: part.questions.length, skillIds: [] },
                        ],
                      })}
                    >
                      <CirclePlus />
                      Add skill range
                    </Button>
                  </div>

                  <div className="divide-y divide-border rounded-md border border-border">
                    {part.skillMappings.map((mapping, mappingIndex) => (
                      <div className="grid gap-4 p-4 lg:grid-cols-[9rem_9rem_1fr_auto]" key={`mapping-${partIndex}-${mappingIndex}`}>
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

                        <fieldset className="min-w-0 space-y-2" disabled={!form.termPeriodId || loadingReference}>
                          <legend className="text-sm font-medium text-foreground">Competency / skills</legend>
                          <div className="grid max-h-44 gap-2 overflow-y-auto rounded-md border border-input bg-background p-3 sm:grid-cols-2">
                            {skills.map((skill) => (
                              <label className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent" key={skill.skillId}>
                                <input
                                  type="checkbox"
                                  className="mt-0.5 size-4 accent-primary"
                                  checked={mapping.skillIds.map(Number).includes(Number(skill.skillId))}
                                  onChange={() => toggleMappingSkill(partIndex, mappingIndex, Number(skill.skillId))}
                                />
                                <span>{skillLabel(skill)}</span>
                              </label>
                            ))}
                            {!skills.length && (
                              <span className="col-span-full text-sm text-muted-foreground">
                                {form.termPeriodId
                                  ? 'No skills are available for this class and term.'
                                  : 'Select a class assignment and term period first.'}
                              </span>
                            )}
                          </div>
                        </fieldset>

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
                    ))}
                  </div>
                </section>
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      <div className="sticky bottom-4 z-20 flex flex-col gap-3 rounded-lg border border-border bg-background/95 p-3 shadow-md backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="outline">{form.parts.length} part{form.parts.length === 1 ? '' : 's'}</Badge>
          <span>{totalItems} item{totalItems === 1 ? '' : 's'}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" disabled={saving} onClick={() => submit(false)}>
            {saving ? <LoaderCircle className="animate-spin" /> : <Save />}
            Save draft
          </Button>
          <Button disabled={saving} onClick={() => submit(true)}>
            {saving ? <LoaderCircle className="animate-spin" /> : <CheckCircle2 />}
            Save and activate
          </Button>
        </div>
      </div>
    </section>
  )
}

export default V2AssessmentEditorPage

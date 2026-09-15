const REQUIRED_OPTIONS = ['A', 'B', 'C', 'D']

function hasText(value) {
  return Boolean(String(value ?? '').trim())
}

export function isBubbleAnswerSheetEligible(assessment = {}) {
  const status = String(
    assessment.status ?? assessment.testStatus ?? assessment.assessmentStatus ?? '',
  ).toLowerCase()
  const parts = Array.isArray(assessment.parts) ? assessment.parts : []
  const questions = parts.flatMap((part) => (
    Array.isArray(part.questions) ? part.questions : []
  ))

  return (
    status === 'active' &&
    questions.length === 10 &&
    parts.length > 0 &&
    parts.every((part) => {
      const partQuestions = Array.isArray(part.questions) ? part.questions : []

      return (
        part.partType === 'multiple_choice' &&
        partQuestions.length > 0 &&
        partQuestions.every((question) => (
          REQUIRED_OPTIONS.every((option) => hasText(question[`option${option}`])) &&
          !hasText(question.optionE) &&
          REQUIRED_OPTIONS.includes(String(question.correctOption ?? '').toUpperCase())
        ))
      )
    })
  )
}

export const BUBBLE_ANSWER_SHEET_REQUIREMENTS =
  'Requires an active assessment with exactly 10 multiple-choice items, A-D choices, no option E, and A-D answer keys.'

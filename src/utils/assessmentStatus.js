// One status label for an assessment wherever it is listed (teacher dashboard activity and the
// class Assessments list), so the same test never reads "Completed" in one place and "active" in
// another. Both lists come from getAssessmentsV3, which carries learnerCount and uploadedCount.
function formatAssessmentStatus(status) {
  const value = String(status ?? '').trim().toLowerCase()
  return value ? value.replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase()) : 'Draft'
}

export function getAssessmentStatusBadge(assessment) {
  const status = String(assessment?.testStatus ?? assessment?.status ?? 'draft').trim().toLowerCase() || 'draft'
  const learnerCount = Number(assessment?.learnerCount)
  const uploadedCount = Number(assessment?.uploadedCount)
  const hasCounts = Number.isFinite(learnerCount) && Number.isFinite(uploadedCount)

  if (status === 'active' && hasCounts) {
    if (learnerCount > 0 && uploadedCount >= learnerCount) {
      return { label: 'Completed', toneClass: 'is-completed' }
    }
    if (uploadedCount > 0) {
      return { label: `Active · ${uploadedCount}/${learnerCount} uploaded`, toneClass: 'is-active' }
    }
  }

  return { label: formatAssessmentStatus(status), toneClass: `is-${status}` }
}

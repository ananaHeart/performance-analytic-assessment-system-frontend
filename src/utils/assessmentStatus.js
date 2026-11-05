// One status label for an assessment wherever it is listed (teacher dashboard activity and the
// class Assessments list), so the same test never reads "Completed" in one place and "active" in
// another. Both lists come from getAssessmentsV3, which carries learnerCount and uploadedCount.
function formatAssessmentStatus(status) {
  const value = String(status ?? '').trim().toLowerCase()
  return value ? value.replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase()) : 'Draft'
}

export function getAssessmentStatusBadge(assessment) {
  const learnerCount = Number(assessment?.learnerCount)
  const uploadedCount = Number(assessment?.uploadedCount)
  const hasCounts = Number.isFinite(learnerCount) && Number.isFinite(uploadedCount)
  // The backend's displayStatus (draft/active/completed/archived) is the authority when sent;
  // older backends only send status, so "completed" is then worked out from the upload counts.
  const displayStatus = String(assessment?.displayStatus ?? '').trim().toLowerCase()
  const status = displayStatus
    || String(assessment?.testStatus ?? assessment?.status ?? 'draft').trim().toLowerCase()
    || 'draft'

  if (!displayStatus && status === 'active' && hasCounts && learnerCount > 0 && uploadedCount >= learnerCount) {
    return { label: 'Completed', toneClass: 'is-completed' }
  }
  if (status === 'active' && hasCounts && uploadedCount > 0 && uploadedCount < learnerCount) {
    return { label: `Active · ${uploadedCount}/${learnerCount} uploaded`, toneClass: 'is-active' }
  }

  return { label: formatAssessmentStatus(status), toneClass: `is-${status}` }
}

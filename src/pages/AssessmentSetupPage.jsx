import V2AssessmentEditorPage from '../v2/V2AssessmentEditorPage'

function AssessmentSetupPage({
  token,
  userId = null,
  initialClassAssignmentId = null,
  initialAssessmentId = null,
  onNavigate,
}) {
  return (
    <V2AssessmentEditorPage
      token={token}
      userId={userId}
      initialClassAssignmentId={initialClassAssignmentId}
      testId={initialAssessmentId}
      onNavigate={onNavigate}
    />
  )
}

export default AssessmentSetupPage

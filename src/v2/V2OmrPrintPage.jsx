import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, ExternalLink, Printer } from 'lucide-react'
import { getAssessmentV2, getOmrSheetHtmlV2 } from '../api/apiV2Client'
import { navigateV2, V2_ROUTES } from './v2Routes'

function V2OmrPrintPage({ token, testId }) {
  const [assessment, setAssessment] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getAssessmentV2(testId, token).then(setAssessment).catch((requestError) => setError(requestError.message))
  }, [testId, token])

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  const prepareSheet = useCallback(async (openNewTab = false) => {
    setLoading(true)
    setError('')
    try {
      const html = await getOmrSheetHtmlV2(testId, token)
      const nextUrl = URL.createObjectURL(new Blob([html], { type: 'text/html' }))
      setPreviewUrl((currentUrl) => {
        if (currentUrl) URL.revokeObjectURL(currentUrl)
        return nextUrl
      })
      if (openNewTab) window.open(nextUrl, '_blank', 'noopener,noreferrer')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }, [testId, token])

  return (
    <section className="v2-page-stack">
      <button type="button" className="v2-back-button" onClick={() => navigateV2(V2_ROUTES.assessments)}>
        <ArrowLeft size={16} /> Back to assessments
      </button>
      <header className="v2-page-header">
        <div>
          <p className="v2-eyebrow">Printable OMR preparation</p>
          <h1>{assessment?.testName || 'OMR sheet'}</h1>
          <p>Generate the backend-prepared fixed-template sheet. Scanning and learner verification remain on mobile.</p>
        </div>
      </header>

      <div className="v2-print-toolbar">
        <p>Print the active assessment template without exposing internal database identifiers.</p>
        <button type="button" className="v2-secondary-button" onClick={() => prepareSheet(false)} disabled={loading}>
          <Printer size={16} /> {loading ? 'Preparing...' : 'Preview sheet'}
        </button>
        <button type="button" className="v2-primary-button" onClick={() => prepareSheet(true)} disabled={loading}>
          <ExternalLink size={16} /> Open printable view
        </button>
      </div>

      {error && <p className="v2-alert is-error">{error}</p>}
      <div className="v2-omr-preview">
        {previewUrl ? <iframe title="Printable OMR sheet preview" src={previewUrl} /> : <p>Prepare the sheet to display the backend-generated printable OMR view.</p>}
      </div>
    </section>
  )
}

export default V2OmrPrintPage

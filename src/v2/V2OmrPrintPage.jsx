import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, ExternalLink, Printer } from 'lucide-react'
import { getAssessmentV2, getBubbleAnswerSheetPdfV2 } from '../api/apiV2Client'
import {
  BUBBLE_ANSWER_SHEET_REQUIREMENTS,
  isBubbleAnswerSheetEligible,
} from './bubbleAnswerSheet'
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
    const printWindow = openNewTab ? window.open('', '_blank') : null
    if (openNewTab && !printWindow) {
      setError('Allow pop-ups to open the Bubble Answer Sheet.')
      return
    }

    setLoading(true)
    setError('')
    try {
      const pdfBlob = await getBubbleAnswerSheetPdfV2(testId, token)
      const nextUrl = URL.createObjectURL(pdfBlob)

      if (printWindow) {
        printWindow.opener = null
        printWindow.location.replace(nextUrl)
        window.setTimeout(() => URL.revokeObjectURL(nextUrl), 60_000)
      } else {
        setPreviewUrl((currentUrl) => {
          if (currentUrl) URL.revokeObjectURL(currentUrl)
          return nextUrl
        })
      }
    } catch (requestError) {
      printWindow?.close()
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }, [testId, token])

  const canPrepareSheet = isBubbleAnswerSheetEligible(assessment ?? {})

  return (
    <section className="v2-page-stack">
      <button type="button" className="v2-back-button" onClick={() => navigateV2(V2_ROUTES.assessments)}>
        <ArrowLeft size={16} /> Back to assessments
      </button>
      <header className="v2-page-header">
        <div>
          <p className="v2-eyebrow">Bubble Answer Sheet</p>
          <h1>{assessment?.testName || 'Printable answer sheet'}</h1>
          <p>Generate the backend-prepared fixed-template sheet. Scanning and learner verification remain on mobile.</p>
        </div>
      </header>

      <div className="v2-print-toolbar">
        <p>Print the active assessment template without exposing internal database identifiers.</p>
        <button type="button" className="v2-secondary-button" onClick={() => prepareSheet(false)} disabled={loading || !canPrepareSheet} title={canPrepareSheet ? 'Preview Bubble Answer Sheet PDF' : BUBBLE_ANSWER_SHEET_REQUIREMENTS}>
          <Printer size={16} /> {loading ? 'Preparing...' : 'Preview sheet'}
        </button>
        <button type="button" className="v2-primary-button" onClick={() => prepareSheet(true)} disabled={loading || !canPrepareSheet} title={canPrepareSheet ? 'Open Bubble Answer Sheet PDF' : BUBBLE_ANSWER_SHEET_REQUIREMENTS}>
          <ExternalLink size={16} /> Open printable view
        </button>
      </div>

      {error && <p className="v2-alert is-error">{error}</p>}
      <div className="v2-omr-preview">
        {previewUrl ? <iframe title="Printable Bubble Answer Sheet PDF preview" src={previewUrl} /> : <p>Prepare the sheet to display the backend-generated OMR-compatible PDF answer sheet.</p>}
      </div>
    </section>
  )
}

export default V2OmrPrintPage

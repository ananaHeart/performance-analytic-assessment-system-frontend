import { useEffect, useState } from 'react'
import { ArrowRight, RefreshCw } from 'lucide-react'
import { getReportReferenceDataV3, getStudentsNeedingSupportReportV3 } from '../api/apiV3Client'
import { getStudentSupportContext, readStudentSupportReport } from '../utils/studentSupport'

// The dashboard card is a short preview; the full list lives in Reports > Students Needing Support.
const PREVIEW_COUNT = 4

const statusLabel = (value) => String(value ?? '').replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase())

export default function TeacherStudentSupport({ token, teacherUserId, refreshKey, onNavigate }) {
  const [foundation, setFoundation] = useState({ status: 'loading' })
  const [termId, setTermId] = useState('')
  const [report, setReport] = useState({ status: 'loading' })
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    let current = true
    async function load() {
      setFoundation({ status: 'loading' })
      try {
        const reference = await getReportReferenceDataV3(token)
        if (!current) return
        const context = getStudentSupportContext(reference, teacherUserId)
        setTermId((previous) => context.terms.some((term) => String(term.termPeriodId) === previous)
          ? previous : String(context.initialTerm?.termPeriodId ?? ''))
        setFoundation({ status: 'ready', ...context })
      } catch (error) {
        if (current) setFoundation({ status: 'error', message: error.isAuthenticationFailure
          ? 'Please sign in again.' : 'Student-support data is unavailable.' })
      }
    }
    load()
    return () => { current = false }
  }, [token, teacherUserId, refreshKey, retry])

  // One request: the backend returns the flagged learners for the term, weakest first.
  useEffect(() => {
    let current = true
    if (foundation.status !== 'ready' || !termId || !foundation.scopes.length) return
    async function load() {
      setReport({ status: 'loading' })
      try {
        const data = await getStudentsNeedingSupportReportV3({ termPeriodId: termId }, token)
        if (current) setReport({ status: 'ready', termId, foundation, ...readStudentSupportReport(data, termId) })
      } catch (error) {
        if (current) setReport({ status: 'error', termId, foundation, message: error.isAuthenticationFailure
          ? 'Please sign in again.' : 'Student-support data is unavailable.' })
      }
    }
    load()
    return () => { current = false }
  }, [foundation, termId, token])

  const hasScope = Boolean(foundation.status === 'ready' && foundation.year && foundation.scopes.length && termId)
  const settled = hasScope && ['ready', 'error'].includes(report.status) &&
    report.termId === termId && report.foundation === foundation
  const ready = settled && report.status === 'ready'
  const loading = foundation.status === 'loading' || Boolean(hasScope && !settled)
  const failed = foundation.status === 'error' || (settled && report.status === 'error')
  const rows = ready ? report.rows : []
  const visibleRows = rows.slice(0, PREVIEW_COUNT)
  const openFullList = () => onNavigate('reports', { reportType: 'students_needing_support', termPeriodId: termId })

  let emptyMessage = 'No students flagged for support in the available finalized results.'
  if (foundation.status === 'ready' && !foundation.year) emptyMessage = 'No active academic year.'
  else if (foundation.status === 'ready' && !foundation.scopes.length) emptyMessage = 'No assigned classes in the active academic year.'
  else if (foundation.status === 'ready' && !termId) emptyMessage = 'No reporting term available.'
  else if (ready && report.dataStatus === 'empty') emptyMessage = 'No finalized competency data available for this term.'

  return (
    <section className="teacher-dashboard-panel teacher-support-panel" aria-labelledby="studentSupportHeading" aria-busy={loading}>
      <div className="teacher-dashboard-panel-heading">
        <h2 id="studentSupportHeading">Students needing support</h2>
        {rows.length > 0 && (
          <button type="button" className="teacher-dashboard-text-action" onClick={openFullList}>
            View all
          </button>
        )}
      </div>
      {foundation.status === 'ready' && foundation.terms.length > 0 && (
        <div className="teacher-support-scope">
          <label htmlFor="studentSupportTerm">Term</label>
          <select id="studentSupportTerm" value={termId} onChange={(event) => setTermId(event.target.value)}>
            {foundation.terms.map((term) => <option key={term.termPeriodId} value={term.termPeriodId}>{term.termName}</option>)}
          </select>
          {ready && report.dataStatus !== 'empty' && <span>{rows.length} {rows.length === 1 ? 'student' : 'students'}</span>}
        </div>
      )}
      {loading && <div className="teacher-dashboard-compact-empty" role="status">Loading student support...</div>}
      {failed && <div className="teacher-support-notice" role="alert">
        <span>{foundation.message || report.message || 'Student-support data is unavailable.'}</span>
        <button type="button" className="teacher-dashboard-text-action" onClick={() => setRetry((value) => value + 1)}>
          <RefreshCw size={14} aria-hidden="true" /> Retry
        </button>
      </div>}
      {!loading && !failed && !rows.length && <div className="teacher-dashboard-compact-empty">{emptyMessage}</div>}
      {rows.length > 0 && <ul className="teacher-support-list" id="studentSupportList">
        {visibleRows.map((student) => {
          const weakest = student.competencies[0] ?? {}
          const name = student.fullName || 'student'
          return <li key={student.studentId}>
            <button type="button" onClick={() => (weakest.filters ? onNavigate('reports', weakest.filters) : openFullList())}
              aria-label={weakest.filters
                ? `View competency report for ${name}: ${weakest.competencyName}`
                : `View students needing support, including ${name}`}>
              <span className="teacher-support-copy">
                <strong>{student.fullName || 'Student name unavailable'}</strong>
                <small>{[student.gradeLevelName, student.sectionName].filter(Boolean).join(' - ')}{weakest.subjectName ? ` | ${weakest.subjectName}` : ''}</small>
                <span className="teacher-support-competency">{weakest.competencyName || 'Competency name unavailable'}</span>
                <span className="teacher-support-status">{weakest.recommendationLabel || statusLabel(weakest.masteryStatusCode) || 'Needs support'}
                  {student.competencies.length > 1 ? ` (+${student.competencies.length - 1} more)` : ''}
                </span>
              </span>
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          </li>
        })}
      </ul>}
      {ready && report.warnings.length > 0 && <div className="teacher-support-warnings">
        {report.warnings.map((message) => <p key={message}>{message}</p>)}
      </div>}
    </section>
  )
}

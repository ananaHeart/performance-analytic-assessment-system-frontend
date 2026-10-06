import { useEffect, useMemo, useState } from 'react'
import { FileSpreadsheet, X } from 'lucide-react'
import { confirmSf1V3, previewSf1V3 } from '../api/apiV3Client'
import '../styles/v2-sf1-modal.css'

function getAcademicYearId(record) {
  return record?.academicYearId ?? record?.id ?? null
}

function getAcademicYearName(record) {
  return record?.yearName ?? record?.academicYearName ?? record?.name ?? ''
}

function getGradeLevelId(record) {
  return record?.gradeLevelId ?? record?.id ?? null
}

function getGradeLevelName(record) {
  return record?.gradeLevelName ?? record?.name ?? record?.label ?? ''
}

function getClassId(record) {
  return record?.classId ?? record?.id ?? null
}

function V3Sf1ImportPanel({
  token,
  gradeLevels = [],
  academicYears = [],
  classes = [],
  initialAcademicYearId = '',
  isGradeLevelsLoading = false,
  gradeLevelsError = '',
  onRetryGradeLevels,
  onImported,
  onClose,
}) {
  const [file, setFile] = useState(null)
  const [academicYearId, setAcademicYearId] = useState(String(initialAcademicYearId || ''))
  const [gradeLevelId, setGradeLevelId] = useState('')
  const [sectionName, setSectionName] = useState('')
  const [preview, setPreview] = useState(null)
  const [acceptContextMismatch, setAcceptContextMismatch] = useState(false)
  const [message, setMessage] = useState({ error: '', success: '' })
  const [isPreviewing, setIsPreviewing] = useState(false)
  const [isImporting, setIsImporting] = useState(false)

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape' && !isPreviewing && !isImporting) {
        onClose?.()
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isImporting, isPreviewing, onClose])

  const classOptions = useMemo(
    () =>
      classes.filter((classRecord) => {
        const matchesYear =
          !academicYearId || String(classRecord.academicYearId) === String(academicYearId)
        const matchesGrade =
          !gradeLevelId || String(classRecord.gradeLevelId) === String(gradeLevelId)
        return matchesYear && matchesGrade
      }),
    [academicYearId, classes, gradeLevelId],
  )

  const resetPreview = () => {
    setPreview(null)
    setAcceptContextMismatch(false)
    setMessage({ error: '', success: '' })
  }

  const handleFileChange = (event) => {
    setFile(event.target.files?.[0] ?? null)
    resetPreview()
  }

  const handleAcademicYearChange = (event) => {
    setAcademicYearId(event.target.value)
    setSectionName('')
    resetPreview()
  }

  const handleGradeLevelChange = (event) => {
    setGradeLevelId(event.target.value)
    setSectionName('')
    resetPreview()
  }

  const handleSectionChange = (event) => {
    setSectionName(event.target.value)
    resetPreview()
  }

  const resolvedReferenceError =
    gradeLevelsError ||
    (!isGradeLevelsLoading && (!gradeLevels.length || !academicYears.length)
      ? 'Academic-year or grade-level reference data is unavailable.'
      : '')

  const selectedContext = preview?.selectedContext ?? null
  const detectedContext = preview?.detectedContext ?? null
  const confirmationContext = {
    academicYearId: selectedContext?.academicYearId ?? academicYearId,
    gradeLevelId: selectedContext?.gradeLevelId ?? gradeLevelId,
    sectionName: selectedContext?.sectionName ?? sectionName,
  }
  const contextComplete = Boolean(
    confirmationContext.academicYearId &&
      confirmationContext.gradeLevelId &&
      confirmationContext.sectionName,
  )
  const mismatchAccepted = !preview?.requiresContextOverride || acceptContextMismatch

  const handlePreview = async () => {
    setMessage({ error: '', success: '' })

    if (!file) {
      setMessage({ error: 'Choose an SF1 Excel file first.', success: '' })
      return
    }

    if (!academicYearId || !gradeLevelId) {
      setMessage({
        error: 'Select the academic year and grade level before previewing the SF1 file.',
        success: '',
      })
      return
    }

    setIsPreviewing(true)

    try {
      const nextPreview = await previewSf1V3(
        file,
        {
          academicYearId: Number(academicYearId),
          gradeLevelId: Number(gradeLevelId),
          sectionName,
        },
        token,
      )
      setPreview(nextPreview)
      setAcceptContextMismatch(false)
      setMessage({
        error: '',
        success: `SF1 preview ready: ${nextPreview?.validRows ?? 0} valid row(s), ${
          nextPreview?.invalidRows ?? 0
        } invalid row(s).`,
      })
    } catch (previewError) {
      setPreview(null)
      setMessage({
        error: previewError.message || 'Unable to preview the SF1 file.',
        success: '',
      })
    } finally {
      setIsPreviewing(false)
    }
  }

  const handleConfirm = async () => {
    setMessage({ error: '', success: '' })

    if (!file || !preview) {
      setMessage({ error: 'Preview the SF1 file before importing.', success: '' })
      return
    }

    if (!preview.importUuid || !preview.sourceFileHash || !contextComplete) {
      setMessage({
        error: 'The preview did not return a complete confirmation context. Preview the file again.',
        success: '',
      })
      return
    }

    if (!mismatchAccepted) {
      setMessage({
        error: 'Review and accept the detected context difference before importing.',
        success: '',
      })
      return
    }

    setIsImporting(true)

    try {
      const summary = await confirmSf1V3(
        file,
        {
          importUuid: preview.importUuid,
          academicYearId: Number(confirmationContext.academicYearId),
          gradeLevelId: Number(confirmationContext.gradeLevelId),
          sectionName: confirmationContext.sectionName,
          expectedFileHash: preview.sourceFileHash,
          acceptContextMismatch: preview.requiresContextOverride ? acceptContextMismatch : false,
        },
        token,
      )

      await onImported?.(summary)
      onClose?.()
    } catch (importError) {
      setMessage({
        error: importError.message || 'Unable to import the SF1 file.',
        success: '',
      })
    } finally {
      setIsImporting(false)
    }
  }

  const handleBackdropMouseDown = (event) => {
    if (event.target === event.currentTarget && !isPreviewing && !isImporting) {
      onClose?.()
    }
  }

  return (
    <div className="sf1-modal-backdrop" role="presentation" onMouseDown={handleBackdropMouseDown}>
      <section
        className="sf1-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sf1ModalTitle"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="sf1-modal-header">
          <div className="sf1-modal-heading">
            <span className="sf1-modal-icon" aria-hidden="true">
              <FileSpreadsheet size={22} strokeWidth={2.3} />
            </span>
            <div>
              <h3 id="sf1ModalTitle">Import students (SF1)</h3>
            </div>
          </div>

          <button
            type="button"
            className="sf1-modal-close"
            onClick={() => onClose?.()}
            disabled={isPreviewing || isImporting}
            aria-label="Close Smart Import"
          >
            <X size={20} strokeWidth={2.4} />
          </button>
        </div>

        <div className="sf1-modal-body">
          {message.error ? (
            <p className="form-message form-message-error" role="alert">
              {message.error}
            </p>
          ) : null}
          {message.success ? (
            <p className="form-message form-message-success">{message.success}</p>
          ) : null}

          <section className="sf1-modal-config-card">
            {isGradeLevelsLoading ? (
              <div className="sf1-reference-state" role="status">
                <strong>Loading school reference data...</strong>
              </div>
            ) : resolvedReferenceError ? (
              <div className="sf1-reference-state" role="alert">
                <div>
                  <strong>School reference data could not be loaded</strong>
                  <span>{resolvedReferenceError}</span>
                </div>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => onRetryGradeLevels?.()}
                >
                  Retry
                </button>
              </div>
            ) : (
              <div className="sf1-modal-config-grid sf1-modal-config-grid-v3">
                <label htmlFor="sf1File">
                  <span>SF1 Excel File</span>
                  <input
                    id="sf1File"
                    type="file"
                    accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                    onChange={handleFileChange}
                  />
                </label>

                <label htmlFor="sf1AcademicYear">
                  <span>Academic Year</span>
                  <select
                    id="sf1AcademicYear"
                    value={academicYearId}
                    onChange={handleAcademicYearChange}
                  >
                    <option value="">Select academic year</option>
                    {academicYears.map((academicYear) => {
                      const id = getAcademicYearId(academicYear)
                      return (
                        <option key={id} value={id}>
                          {getAcademicYearName(academicYear) || 'Academic Year'}
                        </option>
                      )
                    })}
                  </select>
                </label>

                <label htmlFor="sf1GradeLevel">
                  <span>Grade Level</span>
                  <select id="sf1GradeLevel" value={gradeLevelId} onChange={handleGradeLevelChange}>
                    <option value="">Select grade level</option>
                    {gradeLevels.map((gradeLevel) => {
                      const id = getGradeLevelId(gradeLevel)
                      return (
                        <option key={id} value={id}>
                          {getGradeLevelName(gradeLevel) || 'Grade Level'}
                        </option>
                      )
                    })}
                  </select>
                </label>

                <label htmlFor="sf1Section">
                  <span>Section (optional)</span>
                  <select
                    id="sf1Section"
                    value={sectionName}
                    onChange={handleSectionChange}
                    disabled={!academicYearId || !gradeLevelId}
                  >
                    <option value="">Detect from SF1 file</option>
                    {classOptions.map((classRecord) => (
                      <option key={getClassId(classRecord)} value={classRecord.sectionName}>
                        {classRecord.sectionName}
                      </option>
                    ))}
                  </select>
                </label>

                <button
                  type="button"
                  className="secondary-button sf1-preview-button"
                  onClick={handlePreview}
                  disabled={isPreviewing || !file || !academicYearId || !gradeLevelId}
                >
                  {isPreviewing ? 'Reading SF1...' : 'Preview SF1'}
                </button>
              </div>
            )}
          </section>

          {preview ? (
            <>
              {preview.duplicateFile ? (
                <div className="sf1-import-notice" role="status">
                  <strong>Previously imported file detected</strong>
                  <span>
                    Existing learners will not be duplicated. New learner rows can still be added.
                    {preview.previousCompletedImportCount
                      ? ` Previous completed imports: ${preview.previousCompletedImportCount}.`
                      : ''}
                  </span>
                </div>
              ) : null}

              {(preview.warnings ?? []).length ? (
                <div className="sf1-import-warning-list" role="status">
                  {(preview.warnings ?? []).map((warning, index) => (
                    <p key={`${warning}-${index}`}>{warning}</p>
                  ))}
                </div>
              ) : null}

              <section className="sf1-detected-context sf1-detected-context-three">
                <div>
                  <span>School Year</span>
                  <strong>{selectedContext?.academicYearName || 'Not resolved'}</strong>
                </div>
                <div>
                  <span>Grade Level</span>
                  <strong>{selectedContext?.gradeLevelName || 'Not resolved'}</strong>
                </div>
                <div>
                  <span>Section</span>
                  <strong>{selectedContext?.sectionName || 'Not resolved'}</strong>
                </div>
              </section>

              {preview.requiresContextOverride ? (
                <label className="sf1-context-override">
                  <input
                    type="checkbox"
                    checked={acceptContextMismatch}
                    onChange={(event) => setAcceptContextMismatch(event.target.checked)}
                  />
                  <span>
                    I reviewed the detected context ({detectedContext?.academicYearName || 'unknown year'},{' '}
                    {detectedContext?.gradeLevelName || 'unknown grade'}, {detectedContext?.sectionName || 'unknown section'})
                    and confirm the selected target above.
                  </span>
                </label>
              ) : null}

              {!contextComplete ? (
                <p className="form-message form-message-error" role="alert">
                  The class context is incomplete. Select an existing section or ensure the SF1 file
                  contains a section name, then preview again.
                </p>
              ) : null}

              <section className="sf1-preview-section">
                <div className="sf1-preview-heading">
                  <div>
                    <span>Preview</span>
                    <strong>Planned learner outcomes</strong>
                  </div>
                  <small>
                    {preview.validRows ?? 0} valid / {preview.invalidRows ?? 0} invalid
                  </small>
                </div>

                <div className="sf1-preview-table-wrap">
                  <table className="approval-table">
                    <thead>
                      <tr>
                        <th>LRN</th>
                        <th>Name</th>
                        <th>Parser</th>
                        <th>Message</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(preview.rows ?? []).map((row, index) => {
                        const parserIsValid =
                          String(row.parserStatus ?? '').toLowerCase() === 'valid'
                        const isConflict = row.plannedOutcome === 'enrollment_conflict'
                        return (
                          <tr
                            key={`${row.studentLrn || 'row'}-${row.rowNumber || index}`}
                            className={isConflict ? 'sf1-row-conflict' : ''}
                          >
                            <td>{row.studentLrn || '-'}</td>
                            <td>
                              {[row.lastName, row.firstName].filter(Boolean).join(', ') || 'Incomplete'}
                            </td>
                            <td>
                              <span
                                className={`sf1-row-status ${
                                  parserIsValid ? 'is-valid' : 'is-invalid'
                                }`}
                              >
                                {row.parserStatus || '-'}
                              </span>
                            </td>
                            <td>{row.message || row.warningCode || '-'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          ) : (
            <section className="sf1-empty-preview">
              <FileSpreadsheet size={28} strokeWidth={1.9} />
              <strong>No SF1 preview yet</strong>
              <span>Choose an Excel file and target context, then select Preview SF1.</span>
            </section>
          )}
        </div>

        <div className="sf1-modal-footer">
          <button
            type="button"
            className="secondary-button"
            onClick={() => onClose?.()}
            disabled={isPreviewing || isImporting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={handleConfirm}
            disabled={
              isImporting ||
              !preview ||
              !contextComplete ||
              !mismatchAccepted ||
              !(preview?.validRows > 0)
            }
          >
            {isImporting ? 'Saving Students...' : 'Save SF1 Students'}
          </button>
        </div>
      </section>
    </div>
  )
}

export default V3Sf1ImportPanel

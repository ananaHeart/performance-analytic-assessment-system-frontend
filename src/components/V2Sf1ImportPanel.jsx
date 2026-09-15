import { useEffect, useMemo, useState } from 'react'
import { FileSpreadsheet, X } from 'lucide-react'
import { confirmSf1V2, previewSf1V2 } from '../api/apiV2Client'
import '../styles/v2-sf1-modal.css'

function getGradeLevelId(record) {
  return record?.id ?? record?.gradeLevelId ?? null
}

function getGradeLevelName(record) {
  return record?.name ?? record?.gradeLevelName ?? record?.label ?? ''
}

function V2Sf1ImportPanel({
  token,
  gradeLevels = [],
  isGradeLevelsLoading = false,
  gradeLevelsError = '',
  onRetryGradeLevels,
  onImported,
  onClose,
}) {
  const [file, setFile] = useState(null)
  const [gradeLevelId, setGradeLevelId] = useState('')
  const [preview, setPreview] = useState(null)
  const [message, setMessage] = useState({ error: '', success: '' })
  const [isPreviewing, setIsPreviewing] = useState(false)
  const [isImporting, setIsImporting] = useState(false)

  const selectedGradeLevel = useMemo(
    () =>
      gradeLevels.find(
        (gradeLevel) => String(getGradeLevelId(gradeLevel)) === String(gradeLevelId),
      ) ?? null,
    [gradeLevelId, gradeLevels],
  )

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape' && !isPreviewing && !isImporting) {
        onClose?.()
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isImporting, isPreviewing, onClose])

  const handleFileChange = (event) => {
    const nextFile = event.target.files?.[0] ?? null
    setFile(nextFile)
    setPreview(null)
    setMessage({ error: '', success: '' })
  }

  const handleGradeLevelChange = (event) => {
    setGradeLevelId(event.target.value)
    setMessage({ error: '', success: '' })
  }

  const handlePreview = async () => {
    setMessage({ error: '', success: '' })

    if (!file) {
      setMessage({ error: 'Choose an SF1 Excel file first.', success: '' })
      return
    }

    if (!gradeLevelId) {
      setMessage({ error: 'Select the grade level before previewing the SF1 file.', success: '' })
      return
    }

    setIsPreviewing(true)

    try {
      const nextPreview = await previewSf1V2(file, token)
      setPreview(nextPreview)
      setMessage({
        error: '',
        success: `SF1 preview ready: ${nextPreview.validRows ?? 0} valid row(s), ${
          nextPreview.invalidRows ?? 0
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

    if (!gradeLevelId) {
      setMessage({ error: 'Select the grade level before importing.', success: '' })
      return
    }

    if (!preview.detectedSchoolYear || !preview.detectedSectionName) {
      setMessage({
        error:
          'The SF1 context is incomplete. The school year and section must be detected from the worksheet before saving.',
        success: '',
      })
      return
    }

    setIsImporting(true)

    try {
      const summary = await confirmSf1V2(
        file,
        { gradeLevelId: Number(gradeLevelId) },
        token,
      )

      if (onImported) {
        await onImported(summary)
      }

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

  const contextComplete = Boolean(
    preview?.detectedSchoolYear && gradeLevelId && preview?.detectedSectionName,
  )
  const resolvedGradeLevelsError =
    gradeLevelsError ||
    (!isGradeLevelsLoading && !gradeLevels.length
      ? 'Grade-level reference data is unavailable.'
      : '')

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
              <p className="content-card-tag">Smart Import (SF1)</p>
              <h3 id="sf1ModalTitle">Import students from DepEd School Form 1</h3>
              <p>
                Upload the SF1 Excel file and select its grade level. The system reads the school
                year, section, and learner rows from the worksheet before anything is saved.
              </p>
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
          {message.error ? <p className="form-message form-message-error">{message.error}</p> : null}
          {message.success ? (
            <p className="form-message form-message-success">{message.success}</p>
          ) : null}

          <section className="sf1-modal-config-card">
            <div className="sf1-modal-config-grid sf1-modal-config-grid-with-grade">
              <label htmlFor="sf1File">
                <span>SF1 Excel File</span>
                <input
                  id="sf1File"
                  type="file"
                  accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                  onChange={handleFileChange}
                />
              </label>

              {isGradeLevelsLoading ? (
                <label htmlFor="sf1GradeLevel">
                  <span>Grade Level</span>
                  <select id="sf1GradeLevel" value="" disabled>
                    <option value="">Loading grade levels...</option>
                  </select>
                </label>
              ) : resolvedGradeLevelsError ? (
                <div className="sf1-reference-state" role="alert">
                  <div>
                    <strong>Grade levels could not be loaded</strong>
                    <span>{resolvedGradeLevelsError}</span>
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
                <label htmlFor="sf1GradeLevel">
                  <span>Grade Level</span>
                  <select
                    id="sf1GradeLevel"
                    value={gradeLevelId}
                    onChange={handleGradeLevelChange}
                  >
                    <option value="">Select grade level</option>
                    {gradeLevels.map((gradeLevel) => {
                      const id = getGradeLevelId(gradeLevel)
                      return (
                        <option key={id} value={id}>
                          {getGradeLevelName(gradeLevel) || `Grade Level ${id}`}
                        </option>
                      )
                    })}
                  </select>
                </label>
              )}

              <button
                type="button"
                className="secondary-button sf1-preview-button"
                onClick={handlePreview}
                disabled={
                  isPreviewing ||
                  isGradeLevelsLoading ||
                  Boolean(resolvedGradeLevelsError) ||
                  !file ||
                  !gradeLevelId
                }
              >
                {isPreviewing ? 'Reading SF1...' : 'Preview SF1'}
              </button>
            </div>
          </section>

          {preview ? (
            <>
              <section className="sf1-detected-context sf1-detected-context-three">
                <div>
                  <span>School Year</span>
                  <strong>{preview.detectedSchoolYear || 'Not detected'}</strong>
                </div>
                <div>
                  <span>Grade Level</span>
                  <strong>{getGradeLevelName(selectedGradeLevel) || 'Not selected'}</strong>
                </div>
                <div>
                  <span>Section</span>
                  <strong>{preview.detectedSectionName || 'Not detected'}</strong>
                </div>
              </section>

              {!contextComplete ? (
                <p className="form-message form-message-error">
                  Smart Import could not detect the complete class context. Select a grade level and
                  make sure the SF1 worksheet contains its school year and section.
                </p>
              ) : null}

              <section className="sf1-preview-section">
                <div className="sf1-preview-heading">
                  <div>
                    <span>Preview</span>
                    <strong>Detected learner records</strong>
                  </div>
                  <small>
                    {preview.validRows ?? 0} valid / {preview.invalidRows ?? 0} invalid
                  </small>
                </div>

                <div className="sf1-preview-table-wrap">
                  <table className="approval-table">
                    <thead>
                      <tr>
                        <th>Row</th>
                        <th>LRN</th>
                        <th>Name</th>
                        <th>Gender</th>
                        <th>Status</th>
                        <th>Message</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(preview.rows ?? []).map((row, index) => (
                        <tr key={`${row.studentLrn || 'row'}-${row.rowNumber || index}`}>
                          <td>{row.rowNumber ?? index + 1}</td>
                          <td>{row.studentLrn || '-'}</td>
                          <td>
                            {[row.lastName, row.firstName].filter(Boolean).join(', ') || 'Incomplete'}
                          </td>
                          <td>{row.gender || '-'}</td>
                          <td>
                            <span
                              className={`sf1-row-status ${
                                String(row.status ?? '').toLowerCase() === 'valid'
                                  ? 'is-valid'
                                  : 'is-invalid'
                              }`}
                            >
                              {row.status || '-'}
                            </span>
                          </td>
                          <td>{row.message || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          ) : (
            <section className="sf1-empty-preview">
              <FileSpreadsheet size={28} strokeWidth={1.9} />
              <strong>No SF1 preview yet</strong>
              <span>Choose an Excel file, select Grade Level, and click Preview SF1.</span>
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
            disabled={isImporting || !preview || !contextComplete || !(preview?.validRows > 0)}
          >
            {isImporting ? 'Saving Students...' : 'Save SF1 Students'}
          </button>
        </div>
      </section>
    </div>
  )
}

export default V2Sf1ImportPanel

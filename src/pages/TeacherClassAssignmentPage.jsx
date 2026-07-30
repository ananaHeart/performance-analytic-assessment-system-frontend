import { useEffect, useState } from 'react'
import {
  createClassAssignment,
  getClassAssignments,
  getSections,
  getSubjects,
  getTeachers,
} from '../api/apiClient'

const initialAssignmentForm = {
  teacherId: '',
  subjectId: '',
  sectionId: '',
  academicYearId: '1',
}

const currentAcademicYearLabel = 'SY 2025-2026'

function TeacherClassAssignmentPage() {
  const [teachers, setTeachers] = useState([])
  const [sections, setSections] = useState([])
  const [subjects, setSubjects] = useState([])
  const [assignments, setAssignments] = useState([])
  const [assignmentForm, setAssignmentForm] = useState(initialAssignmentForm)
  const [pageError, setPageError] = useState('')
  const [pageSuccess, setPageSuccess] = useState('')
  const [formError, setFormError] = useState('')
  const [formSuccess, setFormSuccess] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const loadAssignmentData = async ({ preserveSuccess = false } = {}) => {
    setIsLoading(true)
    setPageError('')

    if (!preserveSuccess) {
      setPageSuccess('')
    }

    try {
      const [teacherList, sectionList, subjectList, assignmentList] = await Promise.all([
        getTeachers(),
        getSections(),
        getSubjects(),
        getClassAssignments(),
      ])

      setTeachers(teacherList)
      setSections(sectionList)
      setSubjects(subjectList)
      setAssignments(assignmentList)
    } catch (loadError) {
      setPageError(loadError.message || 'Unable to load class assignment data.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadAssignmentData()
  }, [])

  const handleFormChange = (event) => {
    const { name, value } = event.target
    setAssignmentForm((currentForm) => ({ ...currentForm, [name]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setFormError('')
    setFormSuccess('')
    setPageSuccess('')

    if (
      !assignmentForm.teacherId ||
      !assignmentForm.subjectId ||
      !assignmentForm.sectionId ||
      !assignmentForm.academicYearId.trim()
    ) {
      setFormError('Teacher, subject, section, and academic year are required.')
      return
    }

    setIsSubmitting(true)

    try {
      await createClassAssignment({
        teacherId: Number(assignmentForm.teacherId),
        subjectId: Number(assignmentForm.subjectId),
        sectionId: Number(assignmentForm.sectionId),
        academicYearId: Number(assignmentForm.academicYearId.trim()),
      })

      setAssignmentForm(initialAssignmentForm)
      setFormSuccess('Class assignment created successfully.')
      setPageSuccess('Class assignments refreshed.')
      await loadAssignmentData({ preserveSuccess: true })
    } catch (submitError) {
      setFormError(submitError.message || 'Unable to create class assignment.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="content-stack">
      <section className="hero-panel">
        <p className="section-tag">Class Assignment</p>
        <h2>Teacher class assignment planner</h2>
        <p className="supporting-text">
          Create section assignments using the current teacher, subject, and section setup from
          the backend.
        </p>
      </section>

      <section className="stat-grid">
        <article className="stat-card">
          <p>Teachers</p>
          <strong>{isLoading ? 'Loading...' : teachers.length}</strong>
          <span>Total teacher records available for class assignment.</span>
        </article>
        <article className="stat-card">
          <p>Sections</p>
          <strong>{isLoading ? 'Loading...' : sections.length}</strong>
          <span>Total section records available for mapping.</span>
        </article>
        <article className="stat-card">
          <p>Class Assignments</p>
          <strong>{isLoading ? 'Loading...' : assignments.length}</strong>
          <span>Assignments currently stored in the backend.</span>
        </article>
      </section>

      <div className="two-column-layout">
        <section className="content-card">
          <p className="content-card-tag">Create Assignment</p>
          <h3>Add a class assignment</h3>
          <p className="supporting-text">
            Select the teacher, subject, and section, then submit the assignment for the current
            school year.
          </p>

          {formError ? <p className="form-message form-message-error">{formError}</p> : null}
          {formSuccess ? <p className="form-message form-message-success">{formSuccess}</p> : null}

          <form className="form-grid" onSubmit={handleSubmit}>
            <label className="field-group" htmlFor="assignmentTeacherId">
              <span>Teacher</span>
              <select
                id="assignmentTeacherId"
                name="teacherId"
                value={assignmentForm.teacherId}
                onChange={handleFormChange}
              >
                <option value="">Select teacher</option>
                {teachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="field-group" htmlFor="assignmentSubjectId">
              <span>Subject</span>
              <select
                id="assignmentSubjectId"
                name="subjectId"
                value={assignmentForm.subjectId}
                onChange={handleFormChange}
              >
                <option value="">Select subject</option>
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="field-group" htmlFor="assignmentSectionId">
              <span>Section</span>
              <select
                id="assignmentSectionId"
                name="sectionId"
                value={assignmentForm.sectionId}
                onChange={handleFormChange}
              >
                <option value="">Select section</option>
                {sections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="field-group academic-year-display" aria-label="Academic Year">
              <span>Academic Year</span>
              <strong>{currentAcademicYearLabel}</strong>
            </div>

            <div className="form-actions">
              <button type="submit" className="primary-button" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Save Assignment'}
              </button>
            </div>
          </form>
        </section>

        <section className="content-card">
          <p className="content-card-tag">Assignment Directory</p>
          <h3>Current backend references</h3>
          <p className="supporting-text">
            Use these counts to verify the school setup reference data before creating new
            assignments.
          </p>

          <div className="mini-stat-grid">
            <article className="mini-stat-card">
              <span>Teachers Loaded</span>
              <strong>{teachers.length}</strong>
            </article>
            <article className="mini-stat-card">
              <span>Subjects Loaded</span>
              <strong>{subjects.length}</strong>
            </article>
            <article className="mini-stat-card">
              <span>Sections Loaded</span>
              <strong>{sections.length}</strong>
            </article>
          </div>
        </section>
      </div>

      <section className="content-card">
        <div className="section-toolbar">
          <div>
            <p className="content-card-tag">Class Assignments</p>
            <h3>Existing class assignment records</h3>
          </div>
          <button type="button" className="secondary-button" onClick={() => loadAssignmentData()}>
            Refresh
          </button>
        </div>

        {pageError ? <p className="form-message form-message-error">{pageError}</p> : null}
        {pageSuccess ? <p className="form-message form-message-success">{pageSuccess}</p> : null}

        <div className="approval-table-wrap">
          <table className="approval-table">
            <thead>
              <tr>
                <th>Teacher Name</th>
                <th>Subject Name</th>
                <th>Section Name</th>
                <th>Grade Level</th>
                <th>Academic Year</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td className="approval-empty" colSpan="5">
                    Loading class assignments...
                  </td>
                </tr>
              ) : null}

              {!isLoading && !assignments.length ? (
                <tr>
                  <td className="approval-empty" colSpan="5">
                    No class assignments found.
                  </td>
                </tr>
              ) : null}

              {!isLoading
                ? assignments.map((assignment, index) => (
                    <tr key={assignment.id ?? `${assignment.teacherName}-${assignment.sectionName}-${index}`}>
                      <td>{assignment.teacherName || 'Not assigned'}</td>
                      <td>{assignment.subjectName || 'Not assigned'}</td>
                      <td>{assignment.sectionName || 'Not assigned'}</td>
                      <td>{assignment.gradeLevelName || 'Not assigned'}</td>
                      <td>{assignment.academicYear || 'Not assigned'}</td>
                    </tr>
                  ))
                : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

export default TeacherClassAssignmentPage

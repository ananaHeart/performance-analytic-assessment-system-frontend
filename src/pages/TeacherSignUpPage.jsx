import { useState } from 'react'
import { ArrowRight, Eye, EyeOff, GraduationCap, LockKeyhole, Mail } from 'lucide-react'
import { registerTeacher } from '../api/apiClient'

const initialForm = {
  firstName: '',
  lastName: '',
  gender: '',
  dateBirth: '',
  email: '',
  password: '',
  confirmPassword: '',
}

function TeacherSignUpPage({ onNavigate }) {
  const [form, setForm] = useState(initialForm)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false)

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((currentForm) => ({ ...currentForm, [name]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setSuccess('')

    if (
      !form.firstName.trim() ||
      !form.lastName.trim() ||
      !form.gender ||
      !form.dateBirth ||
      !form.email.trim() ||
      !form.password
    ) {
      setError('All fields are required.')
      return
    }

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setIsSubmitting(true)

    try {
      await registerTeacher({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        gender: form.gender,
        dateBirth: form.dateBirth,
        email: form.email.trim(),
        password: form.password,
      })

      setSuccess('Registration submitted. Wait for principal approval before logging in.')
      setForm(initialForm)
    } catch (submitError) {
      setError(submitError.message || 'Teacher sign-up failed.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="public-page teacher-signup-page">
      <form className="teacher-signup-card" onSubmit={handleSubmit}>
        <div className="teacher-signup-header">
          <span className="login-brand-icon" aria-hidden="true">
            <GraduationCap size={24} strokeWidth={2.2} />
          </span>
          <h1>Teacher Sign Up</h1>
          <p>Create your SMART Assessment account</p>
        </div>

        <label className="teacher-signup-field" htmlFor="firstName">
          <span>First Name</span>
          <input
            id="firstName"
            name="firstName"
            value={form.firstName}
            onChange={handleChange}
            placeholder="e.g. John"
            autoComplete="given-name"
          />
        </label>

        <label className="teacher-signup-field" htmlFor="lastName">
          <span>Last Name</span>
          <input
            id="lastName"
            name="lastName"
            value={form.lastName}
            onChange={handleChange}
            placeholder="e.g. Doe"
            autoComplete="family-name"
          />
        </label>

        <label className="teacher-signup-field" htmlFor="gender">
          <span>Gender</span>
          <select id="gender" name="gender" value={form.gender} onChange={handleChange}>
            <option value="">Select Gender</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
          </select>
        </label>

        <label className="teacher-signup-field" htmlFor="dateBirth">
          <span>Birth Date</span>
          <input
            id="dateBirth"
            name="dateBirth"
            type="date"
            value={form.dateBirth}
            onChange={handleChange}
          />
        </label>

        <label className="teacher-signup-field" htmlFor="signupEmail">
          <span>Email Address</span>
          <div className="teacher-signup-input-wrap">
            <Mail size={16} strokeWidth={2.1} aria-hidden="true" />
            <input
              id="signupEmail"
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              placeholder="teacher@school.edu"
              autoComplete="email"
            />
          </div>
        </label>

        <label className="teacher-signup-field" htmlFor="signupPassword">
          <span>Password</span>
          <div className="teacher-signup-input-wrap">
            <LockKeyhole size={16} strokeWidth={2.1} aria-hidden="true" />
            <input
              id="signupPassword"
              name="password"
              type={isPasswordVisible ? 'text' : 'password'}
              value={form.password}
              onChange={handleChange}
              placeholder="Enter password"
              autoComplete="new-password"
            />
            <button
              type="button"
              className="password-toggle-button"
              onClick={() => setIsPasswordVisible((currentValue) => !currentValue)}
              aria-label={isPasswordVisible ? 'Hide password' : 'Show password'}
            >
              {isPasswordVisible ? (
                <EyeOff size={16} strokeWidth={2.1} />
              ) : (
                <Eye size={16} strokeWidth={2.1} />
              )}
            </button>
          </div>
        </label>

        <label className="teacher-signup-field" htmlFor="confirmPassword">
          <span>Confirm Password</span>
          <div className="teacher-signup-input-wrap">
            <LockKeyhole size={16} strokeWidth={2.1} aria-hidden="true" />
            <input
              id="confirmPassword"
              name="confirmPassword"
              type={isConfirmPasswordVisible ? 'text' : 'password'}
              value={form.confirmPassword}
              onChange={handleChange}
              placeholder="Confirm password"
              autoComplete="new-password"
            />
            <button
              type="button"
              className="password-toggle-button"
              onClick={() => setIsConfirmPasswordVisible((currentValue) => !currentValue)}
              aria-label={isConfirmPasswordVisible ? 'Hide password' : 'Show password'}
            >
              {isConfirmPasswordVisible ? (
                <EyeOff size={16} strokeWidth={2.1} />
              ) : (
                <Eye size={16} strokeWidth={2.1} />
              )}
            </button>
          </div>
        </label>

        {error ? <p className="form-message form-message-error">{error}</p> : null}
        {success ? <p className="form-message form-message-success">{success}</p> : null}

        <button type="submit" className="teacher-signup-submit" disabled={isSubmitting}>
          <span>{isSubmitting ? 'Signing up...' : 'Sign Up'}</span>
          {!isSubmitting ? <ArrowRight size={16} strokeWidth={2.3} aria-hidden="true" /> : null}
        </button>

        <p className="teacher-signup-login-copy">
          Already have an account?{' '}
          <button type="button" onClick={() => onNavigate('login')}>
            Log in
          </button>
        </p>
      </form>
    </section>
  )
}

export default TeacherSignUpPage

import { useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  Mail,
  MapPin,
  ShieldCheck,
  UserRound,
} from 'lucide-react'
import PublicAuthShell from '../components/PublicAuthShell'

const REGISTRATION_STEPS = [
  {
    label: 'Personal',
    description: 'Identity details',
    icon: UserRound,
    heading: 'Personal information',
    helper: 'Enter your legal name, birth date, and gender.',
  },
  {
    label: 'Professional',
    description: 'Work and contact',
    icon: BriefcaseBusiness,
    heading: 'Professional and contact information',
    helper: 'Provide your current teaching profile and contact details.',
  },
  {
    label: 'Address',
    description: 'Home address',
    icon: MapPin,
    heading: 'Current address',
    helper: 'Provide the address that will be included in your teacher profile.',
  },
  {
    label: 'Account',
    description: 'Access and review',
    icon: KeyRound,
    heading: 'Account access and review',
    helper: 'Create your password and review your information before submission.',
  },
]

const initialForm = {
  firstName: '',
  middleName: '',
  lastName: '',
  suffix: '',
  gender: '',
  birthDate: '',
  teachingStartDate: '',
  contactNumber: '',
  email: '',
  major: '',
  educationalAttainment: '',
  addressLine: '',
  regionName: '',
  provinceName: '',
  cityMunicipalityName: '',
  barangayName: '',
  postalCode: '',
  password: '',
  confirmPassword: '',
}

const today = new Date().toISOString().slice(0, 10)

function FieldError({ id, message }) {
  if (!message) return null

  return (
    <small id={id} className="teacher-registration-field-error">
      {message}
    </small>
  )
}

function ReviewItem({ label, value }) {
  return (
    <div className="teacher-registration-review-item">
      <dt>{label}</dt>
      <dd>{value || 'Not provided'}</dd>
    </div>
  )
}

function TeacherSignUpPage({ onNavigate }) {
  const [step, setStep] = useState(0)
  const [form, setForm] = useState(initialForm)
  const [fieldErrors, setFieldErrors] = useState({})
  const [requestError, setRequestError] = useState('')
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false)

  const updateField = (field, value) => {
    setForm((currentForm) => ({ ...currentForm, [field]: value }))
    setRequestError('')
    setFieldErrors((currentErrors) => {
      if (!currentErrors[field]) return currentErrors
      const nextErrors = { ...currentErrors }
      delete nextErrors[field]
      return nextErrors
    })
  }

  const validateStep = (stepIndex) => {
    const errors = {}

    if (stepIndex === 0) {
      if (!form.firstName.trim()) errors.firstName = 'First name is required.'
      if (!form.lastName.trim()) errors.lastName = 'Last name is required.'
      if (!form.gender) errors.gender = 'Select your gender.'
      if (!form.birthDate) errors.birthDate = 'Birth date is required.'
    }

    if (stepIndex === 1) {
      if (!form.teachingStartDate) {
        errors.teachingStartDate = 'Teaching start date is required.'
      }
      if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) {
        errors.email = 'Enter a valid email address.'
      }
      if (!/^[+0-9][0-9\s-]{6,19}$/.test(form.contactNumber.trim())) {
        errors.contactNumber = 'Enter a valid contact number.'
      }
      if (!form.major.trim()) errors.major = 'Major or specialization is required.'
      if (!form.educationalAttainment.trim()) {
        errors.educationalAttainment = 'Educational attainment is required.'
      }
    }

    if (stepIndex === 2) {
      if (!form.addressLine.trim()) errors.addressLine = 'Address line is required.'
      if (!form.cityMunicipalityName.trim()) {
        errors.cityMunicipalityName = 'City or municipality is required.'
      }
      if (!form.barangayName.trim()) errors.barangayName = 'Barangay is required.'
    }

    if (stepIndex === 3) {
      if (form.password.length < 10) {
        errors.password = 'Password must contain at least 10 characters.'
      }
      if (form.confirmPassword !== form.password) {
        errors.confirmPassword = 'Passwords do not match.'
      }
    }

    return errors
  }

  const goToStep = (nextStep) => {
    if (nextStep > step) return
    setStep(nextStep)
    setRequestError('')
  }

  const goToNextStep = () => {
    const errors = validateStep(step)
    setFieldErrors(errors)
    setRequestError('')

    if (Object.keys(errors).length === 0) {
      setStep((currentStep) => Math.min(currentStep + 1, REGISTRATION_STEPS.length - 1))
    }
  }

  const goToPreviousStep = () => {
    setStep((currentStep) => Math.max(currentStep - 1, 0))
    setRequestError('')
  }

  const handleSubmit = (event) => {
    event.preventDefault()

    const allErrors = REGISTRATION_STEPS.reduce(
      (errors, _registrationStep, stepIndex) => ({
        ...errors,
        ...validateStep(stepIndex),
      }),
      {},
    )

    if (Object.keys(allErrors).length > 0) {
      setFieldErrors(allErrors)
      const stepFields = [
        ['firstName', 'lastName', 'gender', 'birthDate'],
        ['teachingStartDate', 'contactNumber', 'email', 'major', 'educationalAttainment'],
        ['addressLine', 'cityMunicipalityName', 'barangayName'],
        ['password', 'confirmPassword'],
      ]
      const firstInvalidStep = stepFields.findIndex((fields) =>
        fields.some((field) => allErrors[field]),
      )

      if (firstInvalidStep >= 0) setStep(firstInvalidStep)
      setRequestError('Review the highlighted fields before submitting your registration.')
      return
    }

    setRequestError(
      'Teacher registration cannot be submitted yet because the backend public registration endpoint is still pending. No account data was sent.',
    )
  }

  const fullName = [form.firstName, form.middleName, form.lastName, form.suffix]
    .filter(Boolean)
    .join(' ')
  const fullAddress = [
    form.addressLine,
    form.barangayName,
    form.cityMunicipalityName,
    form.provinceName,
    form.regionName,
    form.postalCode,
    'Philippines',
  ]
    .filter(Boolean)
    .join(', ')
  const currentStep = REGISTRATION_STEPS[step]

  return (
    <PublicAuthShell
      variant="signup"
      eyebrow="Teacher registration"
      title="Join your school's assessment workspace."
      description="Complete your teacher profile and submit it to your school for account review."
      trustMessage="Your account remains pending until your school principal approves it."
      onNavigate={onNavigate}
    >
      <div className="public-auth-form-content is-signup">
        <div className="public-auth-form-heading teacher-registration-heading">
          <p>Create an account</p>
          <h1>Teacher registration</h1>
          <span>Complete the four steps below to prepare your registration request.</span>
        </div>

        <ol className="teacher-registration-steps" aria-label="Teacher registration progress">
          {REGISTRATION_STEPS.map((registrationStep, index) => {
            const Icon = registrationStep.icon
            const isCurrent = index === step
            const isComplete = index < step

            return (
              <li key={registrationStep.label}>
                <button
                  type="button"
                  className={`teacher-registration-step${isCurrent ? ' is-current' : ''}${isComplete ? ' is-complete' : ''}`}
                  onClick={() => goToStep(index)}
                  disabled={index > step}
                  aria-current={isCurrent ? 'step' : undefined}
                >
                  <span className="teacher-registration-step-icon" aria-hidden="true">
                    {isComplete ? <Check size={16} strokeWidth={2.4} /> : <Icon size={16} strokeWidth={2.2} />}
                  </span>
                  <span className="teacher-registration-step-copy">
                    <strong>{registrationStep.label}</strong>
                    <small>{registrationStep.description}</small>
                  </span>
                </button>
              </li>
            )
          })}
        </ol>

        {requestError ? (
          <p className="public-auth-message is-error teacher-registration-request-error" role="alert" aria-live="polite">
            {requestError}
          </p>
        ) : null}

        <form className="teacher-registration-wizard" onSubmit={handleSubmit} noValidate>
          <header className="teacher-registration-wizard-header">
            <div>
              <p>Step {step + 1} of {REGISTRATION_STEPS.length}</p>
              <h2>{currentStep.heading}</h2>
              <span>{currentStep.helper}</span>
            </div>
            <strong aria-label={`Step ${step + 1} of ${REGISTRATION_STEPS.length}`}>
              {step + 1}/{REGISTRATION_STEPS.length}
            </strong>
          </header>

          <div className="teacher-registration-wizard-body">
            {step === 0 ? (
              <div className="teacher-registration-form-grid">
                <label className="public-auth-field" htmlFor="firstName">
                  <span>First name</span>
                  <input
                    id="firstName"
                    value={form.firstName}
                    onChange={(event) => updateField('firstName', event.target.value)}
                    placeholder="e.g. John"
                    autoComplete="given-name"
                    aria-invalid={Boolean(fieldErrors.firstName)}
                    aria-describedby={fieldErrors.firstName ? 'firstName-error' : undefined}
                  />
                  <FieldError id="firstName-error" message={fieldErrors.firstName} />
                </label>

                <label className="public-auth-field" htmlFor="middleName">
                  <span>Middle name <small>(optional)</small></span>
                  <input
                    id="middleName"
                    value={form.middleName}
                    onChange={(event) => updateField('middleName', event.target.value)}
                    placeholder="e.g. Reyes"
                    autoComplete="additional-name"
                  />
                </label>

                <label className="public-auth-field" htmlFor="lastName">
                  <span>Last name</span>
                  <input
                    id="lastName"
                    value={form.lastName}
                    onChange={(event) => updateField('lastName', event.target.value)}
                    placeholder="e.g. Doe"
                    autoComplete="family-name"
                    aria-invalid={Boolean(fieldErrors.lastName)}
                    aria-describedby={fieldErrors.lastName ? 'lastName-error' : undefined}
                  />
                  <FieldError id="lastName-error" message={fieldErrors.lastName} />
                </label>

                <label className="public-auth-field" htmlFor="suffix">
                  <span>Suffix <small>(optional)</small></span>
                  <input
                    id="suffix"
                    value={form.suffix}
                    onChange={(event) => updateField('suffix', event.target.value)}
                    placeholder="e.g. Jr., III"
                  />
                </label>

                <label className="public-auth-field" htmlFor="gender">
                  <span>Gender</span>
                  <select
                    id="gender"
                    value={form.gender}
                    onChange={(event) => updateField('gender', event.target.value)}
                    aria-invalid={Boolean(fieldErrors.gender)}
                    aria-describedby={fieldErrors.gender ? 'gender-error' : undefined}
                  >
                    <option value="">Select gender</option>
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                  </select>
                  <FieldError id="gender-error" message={fieldErrors.gender} />
                </label>

                <label className="public-auth-field" htmlFor="birthDate">
                  <span>Birth date</span>
                  <input
                    id="birthDate"
                    type="date"
                    max={today}
                    value={form.birthDate}
                    onChange={(event) => updateField('birthDate', event.target.value)}
                    aria-invalid={Boolean(fieldErrors.birthDate)}
                    aria-describedby={fieldErrors.birthDate ? 'birthDate-error' : undefined}
                  />
                  <FieldError id="birthDate-error" message={fieldErrors.birthDate} />
                </label>
              </div>
            ) : null}

            {step === 1 ? (
              <div className="teacher-registration-form-grid">
                <label className="public-auth-field" htmlFor="teachingStartDate">
                  <span>Teaching start date</span>
                  <input
                    id="teachingStartDate"
                    type="date"
                    max={today}
                    value={form.teachingStartDate}
                    onChange={(event) => updateField('teachingStartDate', event.target.value)}
                    aria-invalid={Boolean(fieldErrors.teachingStartDate)}
                    aria-describedby={fieldErrors.teachingStartDate ? 'teachingStartDate-error' : undefined}
                  />
                  <FieldError id="teachingStartDate-error" message={fieldErrors.teachingStartDate} />
                </label>

                <label className="public-auth-field" htmlFor="contactNumber">
                  <span>Contact number</span>
                  <input
                    id="contactNumber"
                    type="tel"
                    value={form.contactNumber}
                    onChange={(event) => updateField('contactNumber', event.target.value)}
                    placeholder="e.g. 09171234567"
                    autoComplete="tel"
                    aria-invalid={Boolean(fieldErrors.contactNumber)}
                    aria-describedby={fieldErrors.contactNumber ? 'contactNumber-error' : undefined}
                  />
                  <FieldError id="contactNumber-error" message={fieldErrors.contactNumber} />
                </label>

                <label className="public-auth-field is-full" htmlFor="signupEmail">
                  <span>Email address</span>
                  <div className="public-auth-input-wrap">
                    <Mail size={18} strokeWidth={2} aria-hidden="true" />
                    <input
                      id="signupEmail"
                      type="email"
                      value={form.email}
                      onChange={(event) => updateField('email', event.target.value)}
                      placeholder="teacher@school.edu"
                      autoComplete="email"
                      aria-invalid={Boolean(fieldErrors.email)}
                      aria-describedby={fieldErrors.email ? 'signupEmail-error' : undefined}
                    />
                  </div>
                  <FieldError id="signupEmail-error" message={fieldErrors.email} />
                </label>

                <label className="public-auth-field" htmlFor="major">
                  <span>Major or specialization</span>
                  <input
                    id="major"
                    value={form.major}
                    onChange={(event) => updateField('major', event.target.value)}
                    placeholder="e.g. Mathematics"
                    aria-invalid={Boolean(fieldErrors.major)}
                    aria-describedby={fieldErrors.major ? 'major-error' : undefined}
                  />
                  <FieldError id="major-error" message={fieldErrors.major} />
                </label>

                <label className="public-auth-field" htmlFor="educationalAttainment">
                  <span>Educational attainment</span>
                  <input
                    id="educationalAttainment"
                    value={form.educationalAttainment}
                    onChange={(event) => updateField('educationalAttainment', event.target.value)}
                    placeholder="e.g. Bachelor's Degree"
                    aria-invalid={Boolean(fieldErrors.educationalAttainment)}
                    aria-describedby={fieldErrors.educationalAttainment ? 'educationalAttainment-error' : undefined}
                  />
                  <FieldError id="educationalAttainment-error" message={fieldErrors.educationalAttainment} />
                </label>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="teacher-registration-form-grid">
                <label className="public-auth-field is-full" htmlFor="addressLine">
                  <span>House, building, and street</span>
                  <input
                    id="addressLine"
                    value={form.addressLine}
                    onChange={(event) => updateField('addressLine', event.target.value)}
                    placeholder="Enter address line"
                    autoComplete="street-address"
                    aria-invalid={Boolean(fieldErrors.addressLine)}
                    aria-describedby={fieldErrors.addressLine ? 'addressLine-error' : undefined}
                  />
                  <FieldError id="addressLine-error" message={fieldErrors.addressLine} />
                </label>

                <label className="public-auth-field" htmlFor="regionName">
                  <span>Region <small>(optional)</small></span>
                  <input
                    id="regionName"
                    value={form.regionName}
                    onChange={(event) => updateField('regionName', event.target.value)}
                    placeholder="e.g. Region VII"
                  />
                </label>

                <label className="public-auth-field" htmlFor="provinceName">
                  <span>Province <small>(optional)</small></span>
                  <input
                    id="provinceName"
                    value={form.provinceName}
                    onChange={(event) => updateField('provinceName', event.target.value)}
                    placeholder="e.g. Cebu"
                    autoComplete="address-level1"
                  />
                </label>

                <label className="public-auth-field" htmlFor="cityMunicipalityName">
                  <span>City or municipality</span>
                  <input
                    id="cityMunicipalityName"
                    value={form.cityMunicipalityName}
                    onChange={(event) => updateField('cityMunicipalityName', event.target.value)}
                    placeholder="Enter city or municipality"
                    autoComplete="address-level2"
                    aria-invalid={Boolean(fieldErrors.cityMunicipalityName)}
                    aria-describedby={fieldErrors.cityMunicipalityName ? 'cityMunicipalityName-error' : undefined}
                  />
                  <FieldError id="cityMunicipalityName-error" message={fieldErrors.cityMunicipalityName} />
                </label>

                <label className="public-auth-field" htmlFor="barangayName">
                  <span>Barangay</span>
                  <input
                    id="barangayName"
                    value={form.barangayName}
                    onChange={(event) => updateField('barangayName', event.target.value)}
                    placeholder="Enter barangay"
                    autoComplete="address-level3"
                    aria-invalid={Boolean(fieldErrors.barangayName)}
                    aria-describedby={fieldErrors.barangayName ? 'barangayName-error' : undefined}
                  />
                  <FieldError id="barangayName-error" message={fieldErrors.barangayName} />
                </label>

                <label className="public-auth-field" htmlFor="postalCode">
                  <span>Postal code <small>(optional)</small></span>
                  <input
                    id="postalCode"
                    value={form.postalCode}
                    onChange={(event) => updateField('postalCode', event.target.value)}
                    placeholder="e.g. 6000"
                    autoComplete="postal-code"
                  />
                </label>

                <label className="public-auth-field" htmlFor="countryName">
                  <span>Country</span>
                  <input id="countryName" value="Philippines" disabled />
                </label>
              </div>
            ) : null}

            {step === 3 ? (
              <div className="teacher-registration-account-step">
                <div className="teacher-registration-form-grid">
                  <label className="public-auth-field" htmlFor="signupPassword">
                    <span>Password</span>
                    <div className="public-auth-input-wrap">
                      <LockKeyhole size={18} strokeWidth={2} aria-hidden="true" />
                      <input
                        id="signupPassword"
                        type={isPasswordVisible ? 'text' : 'password'}
                        value={form.password}
                        onChange={(event) => updateField('password', event.target.value)}
                        placeholder="At least 10 characters"
                        autoComplete="new-password"
                        aria-invalid={Boolean(fieldErrors.password)}
                        aria-describedby={fieldErrors.password ? 'signupPassword-error' : undefined}
                      />
                      <button
                        type="button"
                        className="public-auth-password-toggle"
                        onClick={() => setIsPasswordVisible((currentValue) => !currentValue)}
                        aria-label={isPasswordVisible ? 'Hide password' : 'Show password'}
                      >
                        {isPasswordVisible ? <EyeOff size={17} /> : <Eye size={17} />}
                      </button>
                    </div>
                    <FieldError id="signupPassword-error" message={fieldErrors.password} />
                  </label>

                  <label className="public-auth-field" htmlFor="confirmPassword">
                    <span>Confirm password</span>
                    <div className="public-auth-input-wrap">
                      <LockKeyhole size={18} strokeWidth={2} aria-hidden="true" />
                      <input
                        id="confirmPassword"
                        type={isConfirmPasswordVisible ? 'text' : 'password'}
                        value={form.confirmPassword}
                        onChange={(event) => updateField('confirmPassword', event.target.value)}
                        placeholder="Re-enter password"
                        autoComplete="new-password"
                        aria-invalid={Boolean(fieldErrors.confirmPassword)}
                        aria-describedby={fieldErrors.confirmPassword ? 'confirmPassword-error' : undefined}
                      />
                      <button
                        type="button"
                        className="public-auth-password-toggle"
                        onClick={() => setIsConfirmPasswordVisible((currentValue) => !currentValue)}
                        aria-label={isConfirmPasswordVisible ? 'Hide password' : 'Show password'}
                      >
                        {isConfirmPasswordVisible ? <EyeOff size={17} /> : <Eye size={17} />}
                      </button>
                    </div>
                    <FieldError id="confirmPassword-error" message={fieldErrors.confirmPassword} />
                  </label>
                </div>

                <div className="teacher-registration-review-heading">
                  <span aria-hidden="true"><ShieldCheck size={20} strokeWidth={2.2} /></span>
                  <div>
                    <h3>Review your registration</h3>
                    <p>Your request will remain pending until it is reviewed by your school principal.</p>
                  </div>
                </div>

                <dl className="teacher-registration-review-grid">
                  <ReviewItem label="Full name" value={fullName} />
                  <ReviewItem label="Gender" value={form.gender} />
                  <ReviewItem label="Birth date" value={form.birthDate} />
                  <ReviewItem label="Email" value={form.email} />
                  <ReviewItem label="Contact number" value={form.contactNumber} />
                  <ReviewItem label="Teaching start" value={form.teachingStartDate} />
                  <ReviewItem label="Major" value={form.major} />
                  <ReviewItem label="Educational attainment" value={form.educationalAttainment} />
                  <ReviewItem label="Address" value={fullAddress} />
                </dl>
              </div>
            ) : null}
          </div>

          <footer className="teacher-registration-wizard-footer">
            <button
              type="button"
              className="teacher-registration-secondary"
              onClick={goToPreviousStep}
              disabled={step === 0}
            >
              <ArrowLeft size={17} strokeWidth={2.2} aria-hidden="true" />
              Previous
            </button>

            {step < REGISTRATION_STEPS.length - 1 ? (
              <button type="button" className="public-auth-submit" onClick={goToNextStep}>
                Continue
                <ArrowRight size={17} strokeWidth={2.2} aria-hidden="true" />
              </button>
            ) : (
              <button type="submit" className="public-auth-submit">
                Submit registration
                <Check size={17} strokeWidth={2.3} aria-hidden="true" />
              </button>
            )}
          </footer>
        </form>

        <div className="public-auth-switch teacher-registration-switch">
          <span>Already registered?</span>
          <button type="button" onClick={() => onNavigate('login')}>
            Log in
          </button>
        </div>

        <p className="public-auth-footer">© 2026 SMART Assessment System</p>
      </div>
    </PublicAuthShell>
  )
}

export default TeacherSignUpPage

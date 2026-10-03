import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  BriefcaseBusiness,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  Mail,
  MapPin,
  MessageSquareText,
  RefreshCw,
  ShieldCheck,
  UserRound,
} from 'lucide-react'
import {
  getTeacherRegistrationReferenceDataV3,
  registerTeacherV3,
} from '../api/apiV3Client'
import PublicAuthShell from '../components/PublicAuthShell'
import { storeTeacherVerificationSession } from '../utils/teacherEmailVerification'

const STEPS = [
  { label: 'Personal', description: 'Identity', icon: UserRound },
  { label: 'Professional', description: 'Teaching and contact', icon: BriefcaseBusiness },
  { label: 'Address', description: 'Philippine address', icon: MapPin },
  { label: 'Account', description: 'Password and review', icon: KeyRound },
  { label: 'Verification', description: 'Code delivery', icon: Mail },
]

const REGISTRATION_STEP_FIELDS = [
  ['schoolCode', 'firstName', 'middleName', 'lastName', 'suffixId', 'birthDate', 'genderId'],
  ['teachingStartMonth', 'email', 'contactNumber', 'majorId', 'educationalAttainmentId'],
  [
    'countryCode',
    'regionCode',
    'provinceCode',
    'cityMunicipalityCode',
    'barangayCode',
    'addressLine',
    'postalCode',
  ],
  ['password', 'confirmPassword'],
  ['verificationMethod'],
]

const BACKEND_FIELD_ALIASES = {
  contact: 'contactNumber',
  contact_number: 'contactNumber',
  email_address: 'email',
  teachingStartYear: 'teachingStartMonth',
  teaching_start_month: 'teachingStartMonth',
  teaching_start_year: 'teachingStartMonth',
  verification_method: 'verificationMethod',
  'address.countryCode': 'countryCode',
  'address.country_code': 'countryCode',
  'address.regionCode': 'regionCode',
  'address.regionName': 'regionCode',
  'address.region_code': 'regionCode',
  'address.region_name': 'regionCode',
  'address.provinceCode': 'provinceCode',
  'address.provinceName': 'provinceCode',
  'address.province_code': 'provinceCode',
  'address.province_name': 'provinceCode',
  'address.cityMunicipalityCode': 'cityMunicipalityCode',
  'address.cityMunicipalityName': 'cityMunicipalityCode',
  'address.city_municipality_code': 'cityMunicipalityCode',
  'address.city_municipality_name': 'cityMunicipalityCode',
  'address.barangayCode': 'barangayCode',
  'address.barangayName': 'barangayCode',
  'address.barangay_code': 'barangayCode',
  'address.barangay_name': 'barangayCode',
  'address.addressLine': 'addressLine',
  'address.address_line': 'addressLine',
  'address.postalCode': 'postalCode',
  'address.postal_code': 'postalCode',
}

const ADDRESS_API_BASE_URL = 'https://psgc.gitlab.io/api'

const INITIAL_FORM = {
  schoolCode: '',
  firstName: '',
  middleName: '',
  lastName: '',
  suffixId: '',
  birthDate: '',
  teachingStartMonth: '',
  email: '',
  contactNumber: '',
  password: '',
  confirmPassword: '',
  verificationMethod: '',
  genderId: '',
  majorId: '',
  educationalAttainmentId: '',
  countryCode: 'PH',
  regionCode: '',
  regionName: '',
  provinceCode: '',
  provinceName: '',
  cityMunicipalityCode: '',
  cityMunicipalityName: '',
  barangayCode: '',
  barangayName: '',
  addressLine: '',
  postalCode: '',
}

function getTodayDateString() {
  const today = new Date()
  return [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-')
}

function parseDateOnly(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ''))) {
    return null
  }

  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null
  }

  return date
}

function addYears(date, years) {
  const nextDate = new Date(date)
  nextDate.setFullYear(nextDate.getFullYear() + years)
  return nextDate
}

function formatDateOnly(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

function toTeachingStartDate(monthValue) {
  return monthValue ? `${monthValue}-01` : ''
}

function getYearsOfTeaching(monthValue, currentDateValue) {
  const startMatch = /^(\d{4})-(\d{2})$/.exec(String(monthValue ?? ''))
  const currentMatch = /^(\d{4})-(\d{2})-\d{2}$/.exec(String(currentDateValue ?? ''))

  if (!startMatch || !currentMatch) return ''

  const totalMonths =
    (Number(currentMatch[1]) - Number(startMatch[1])) * 12 +
    (Number(currentMatch[2]) - Number(startMatch[2]))

  if (totalMonths < 0) return ''

  const years = Math.floor(totalMonths / 12)
  return years === 0 ? 'Less than 1 year' : `${years} year${years === 1 ? '' : 's'}`
}

function isValidEmail(value) {
  const email = String(value ?? '').trim()
  return /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/.test(email)
}

function isValidContactNumber(value) {
  return /^(09\d{9}|\+639\d{9})$/.test(String(value ?? '').trim())
}

function getPasswordErrors(value) {
  const password = String(value ?? '')
  const errors = []

  if (password.length < 10) errors.push('at least 10 characters')
  if (!/[A-Z]/.test(password)) errors.push('uppercase letter')
  if (!/[a-z]/.test(password)) errors.push('lowercase letter')
  if (!/\d/.test(password)) errors.push('number')
  if (!/[^A-Za-z0-9]/.test(password)) errors.push('special character')

  return errors
}

function pickValue(record, keys) {
  for (const key of keys) {
    const value = record?.[key]
    if (value !== undefined && value !== null && value !== '') {
      return value
    }
  }

  return ''
}

function getReferenceId(record, keys) {
  return pickValue(record, [...keys, 'id', 'value'])
}

function getReferenceLabel(record, keys) {
  return pickValue(record, [...keys, 'label', 'displayName', 'name'])
}

function getDefaultSchoolCode(schools = []) {
  const school =
    schools.find((item) => item.isActive === true || item.active === true) ??
    schools[0] ??
    null

  return getReferenceId(school, ['schoolId', 'schoolCode', 'code'])
}

function normalizeAddressOption(record = {}) {
  return {
    code: record.code ?? '',
    name: record.name ?? '',
  }
}

function normalizeBackendFieldErrors(error) {
  if (!error?.errors || typeof error.errors !== 'object' || Array.isArray(error.errors)) {
    return {}
  }

  return Object.entries(error.errors).reduce((fieldErrors, [key, value]) => {
    if (key === 'code' || typeof value !== 'string' || !value.trim()) {
      return fieldErrors
    }

    const normalizedKey = BACKEND_FIELD_ALIASES[key] ?? key
    fieldErrors[normalizedKey] ||= value
    return fieldErrors
  }, {})
}

function getFirstRegistrationErrorStep(fieldErrors) {
  return REGISTRATION_STEP_FIELDS.findIndex((fields) =>
    fields.some((field) => fieldErrors[field]),
  )
}

function normalizeRegistrationConflict(error, backendFieldErrors) {
  if (error?.status !== 409) return backendFieldErrors

  const fieldErrors = { ...backendFieldErrors }
  const code = String(error.code ?? '').toUpperCase()
  const message = String(error.message ?? '').trim()
  const normalizedMessage = message.toLowerCase()
  const safeMessage =
    message && !normalizedMessage.includes('unexpected error')
      ? message
      : 'This value is already registered.'

  if (code.includes('EMAIL') || normalizedMessage.includes('email')) {
    fieldErrors.email ||= safeMessage
  }

  if (
    code.includes('CONTACT') ||
    code.includes('PHONE') ||
    normalizedMessage.includes('contact') ||
    normalizedMessage.includes('phone')
  ) {
    fieldErrors.contactNumber ||= safeMessage
  }

  if (!fieldErrors.email && !fieldErrors.contactNumber) {
    fieldErrors.email = 'This email may already be registered.'
    fieldErrors.contactNumber = 'This contact number may already be registered.'
  }

  return fieldErrors
}

function ErrorText({ message }) {
  if (!message) return null
  return <span className="teacher-registration-field-error">{message}</span>
}

function ReviewItem({ label, value }) {
  return (
    <div className="teacher-registration-review-item">
      <dt>{label}</dt>
      <dd>{value || 'Not provided'}</dd>
    </div>
  )
}

async function fetchAddressOptions(path) {
  const response = await fetch(`${ADDRESS_API_BASE_URL}${path}`)

  if (!response.ok) {
    throw new Error('Unable to load address options.')
  }

  const records = await response.json()
  return Array.isArray(records) ? records.map(normalizeAddressOption) : []
}

function TeacherSignUpPage({ onNavigate }) {
  const [step, setStep] = useState(0)
  const [form, setForm] = useState(INITIAL_FORM)
  const [referenceData, setReferenceData] = useState({
    genders: [],
    suffixes: [],
    majors: [],
    educationalAttainments: [],
    schools: [],
    verificationMethods: [],
    verificationPolicy: null,
  })
  const [addressOptions, setAddressOptions] = useState({
    regions: [],
    provinces: [],
    cities: [],
    barangays: [],
  })
  const [loadingReferences, setLoadingReferences] = useState(true)
  const [referenceLoadFailed, setReferenceLoadFailed] = useState(false)
  const [loadingAddress, setLoadingAddress] = useState({
    regions: true,
    provinces: false,
    cities: false,
    barangays: false,
  })
  const [fieldErrors, setFieldErrors] = useState({})
  const [requestError, setRequestError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [accountTouched, setAccountTouched] = useState({
    password: false,
    confirmPassword: false,
  })
  const [accountSubmitAttempted, setAccountSubmitAttempted] = useState(false)

  const todayDate = useMemo(() => getTodayDateString(), [])
  const maxBirthDate = useMemo(() => formatDateOnly(addYears(parseDateOnly(todayDate), -18)), [todayDate])
  const currentMonth = todayDate.slice(0, 7)

  const selectedVerificationMethod = useMemo(
    () =>
      referenceData.verificationMethods.find(
        (method) => String(method.method) === String(form.verificationMethod),
      ) ?? null,
    [form.verificationMethod, referenceData.verificationMethods],
  )
  const hasAvailableVerificationMethod = selectedVerificationMethod?.available === true

  useEffect(() => {
    let active = true

    getTeacherRegistrationReferenceDataV3()
      .then((data) => {
        if (active) {
          const defaultSchoolCode = getDefaultSchoolCode(data.schools)

          if (!defaultSchoolCode) {
            throw new Error('No school is currently available for teacher registration.')
          }

          setReferenceData(data)
          setReferenceLoadFailed(false)

          if (defaultSchoolCode) {
            setForm((current) => ({
              ...current,
              schoolCode: current.schoolCode || defaultSchoolCode,
            }))
          }
        }
      })
      .catch((error) => {
        if (active) {
          setReferenceLoadFailed(true)
          setRequestError(
            error.message ||
              'Unable to load registration reference data. Registration is disabled until dropdown data is available.',
          )
        }
      })
      .finally(() => {
        if (active) setLoadingReferences(false)
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true

    fetchAddressOptions('/regions/')
      .then((regions) => {
        if (active) setAddressOptions((current) => ({ ...current, regions }))
      })
      .catch((error) => {
        if (active) setRequestError(error.message || 'Unable to load address options.')
      })
      .finally(() => {
        if (active) setLoadingAddress((current) => ({ ...current, regions: false }))
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!form.regionCode) {
      return
    }

    let active = true

    Promise.all([
      fetchAddressOptions(`/regions/${form.regionCode}/provinces/`).catch(() => []),
      fetchAddressOptions(`/regions/${form.regionCode}/cities-municipalities/`).catch(() => []),
    ])
      .then(([provinces, cities]) => {
        if (active) {
          setAddressOptions((current) => ({
            ...current,
            provinces,
            cities: provinces.length ? [] : cities,
            barangays: [],
          }))
        }
      })
      .catch((error) => {
        if (active) setRequestError(error.message || 'Unable to load address options.')
      })
      .finally(() => {
        if (active) {
          setLoadingAddress((current) => ({ ...current, provinces: false, cities: false }))
        }
      })

    return () => {
      active = false
    }
  }, [form.regionCode])

  useEffect(() => {
    if (!form.provinceCode) {
      return
    }

    let active = true

    fetchAddressOptions(`/provinces/${form.provinceCode}/cities-municipalities/`)
      .then((cities) => {
        if (active) setAddressOptions((current) => ({ ...current, cities, barangays: [] }))
      })
      .catch((error) => {
        if (active) setRequestError(error.message || 'Unable to load city options.')
      })
      .finally(() => {
        if (active) setLoadingAddress((current) => ({ ...current, cities: false }))
      })

    return () => {
      active = false
    }
  }, [form.provinceCode])

  useEffect(() => {
    if (!form.cityMunicipalityCode) {
      return
    }

    let active = true

    fetchAddressOptions(`/cities-municipalities/${form.cityMunicipalityCode}/barangays/`)
      .then((barangays) => {
        if (active) setAddressOptions((current) => ({ ...current, barangays }))
      })
      .catch((error) => {
        if (active) setRequestError(error.message || 'Unable to load barangay options.')
      })
      .finally(() => {
        if (active) setLoadingAddress((current) => ({ ...current, barangays: false }))
      })

    return () => {
      active = false
    }
  }, [form.cityMunicipalityCode])

  const lookupNames = useMemo(() => {
    const gender = referenceData.genders.find(
      (item) => String(getReferenceId(item, ['genderId'])) === String(form.genderId),
    )
    const suffix = referenceData.suffixes.find(
      (item) => String(getReferenceId(item, ['suffixId'])) === String(form.suffixId),
    )
    const school = referenceData.schools.find(
      (item) =>
        String(getReferenceId(item, ['schoolId', 'schoolCode', 'code'])) ===
        String(form.schoolCode),
    )
    const major = referenceData.majors.find(
      (item) => String(getReferenceId(item, ['majorId'])) === String(form.majorId),
    )
    const attainment = referenceData.educationalAttainments.find(
      (item) =>
        String(getReferenceId(item, ['educationalAttainmentId'])) ===
        String(form.educationalAttainmentId),
    )

    return {
      gender: getReferenceLabel(gender, ['genderName']),
      suffix: getReferenceLabel(suffix, ['suffixName', 'suffix']),
      school: getReferenceLabel(school, ['schoolName']) || form.schoolCode,
      major: getReferenceLabel(major, ['majorName']),
      attainment: getReferenceLabel(attainment, ['educationalAttainmentName']),
    }
  }, [form, referenceData])

  const clearFieldError = (field) => {
    setFieldErrors((current) => {
      if (!current[field]) return current
      const next = { ...current }
      delete next[field]
      return next
    })
  }

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }))
    clearFieldError(field)
    setSuccessMessage('')
  }

  const shouldShowFieldError = (field) =>
    !['password', 'confirmPassword'].includes(field) ||
    accountSubmitAttempted ||
    accountTouched[field]

  const shouldShowRequestError =
    Boolean(requestError) &&
    !(
      step === 3 &&
      !accountSubmitAttempted &&
      requestError.startsWith('Review the highlighted')
    )

  const clearAccountErrors = () => {
    setFieldErrors((current) => {
      if (!current.password && !current.confirmPassword) return current
      const next = { ...current }
      delete next.password
      delete next.confirmPassword
      return next
    })
  }

  const showCurrentAccountErrors = (field) => {
    if (!form[field]) return

    const accountErrors = validateStep(3)
    setAccountTouched((current) => ({ ...current, [field]: true }))
    setFieldErrors((current) => {
      const next = { ...current }

      if (accountErrors[field]) {
        next[field] = accountErrors[field]
      } else {
        delete next[field]
      }

      return next
    })
  }

  const updateAddressSelection = (fieldPrefix, option) => {
    if (fieldPrefix === 'region') {
      setLoadingAddress((current) => ({
        ...current,
        provinces: Boolean(option.code),
        cities: Boolean(option.code),
        barangays: false,
      }))
      setForm((current) => ({
        ...current,
        regionCode: option.code,
        regionName: option.name,
        provinceCode: '',
        provinceName: '',
        cityMunicipalityCode: '',
        cityMunicipalityName: '',
        barangayCode: '',
        barangayName: '',
      }))
    }

    if (fieldPrefix === 'province') {
      setLoadingAddress((current) => ({
        ...current,
        cities: Boolean(option.code),
        barangays: false,
      }))
      setForm((current) => ({
        ...current,
        provinceCode: option.code,
        provinceName: option.name,
        cityMunicipalityCode: '',
        cityMunicipalityName: '',
        barangayCode: '',
        barangayName: '',
      }))
    }

    if (fieldPrefix === 'cityMunicipality') {
      setLoadingAddress((current) => ({ ...current, barangays: Boolean(option.code) }))
      setForm((current) => ({
        ...current,
        cityMunicipalityCode: option.code,
        cityMunicipalityName: option.name,
        barangayCode: '',
        barangayName: '',
      }))
    }

    if (fieldPrefix === 'barangay') {
      setForm((current) => ({
        ...current,
        barangayCode: option.code,
        barangayName: option.name,
      }))
    }

    clearFieldError(`${fieldPrefix}Code`)
  }

  const validateStep = (stepIndex) => {
    const errors = {}
    const today = parseDateOnly(todayDate)
    const birthDate = parseDateOnly(form.birthDate)
    const teachingStartDate = parseDateOnly(toTeachingStartDate(form.teachingStartMonth))

    if (stepIndex === 0) {
      if (!form.schoolCode) errors.schoolCode = 'Select a school.'
      if (!form.firstName.trim()) errors.firstName = 'First name is required.'
      if (!form.lastName.trim()) errors.lastName = 'Last name is required.'
      if (!form.genderId) errors.genderId = 'Select a gender.'
      if (!form.birthDate) {
        errors.birthDate = 'Birthdate is required.'
      } else if (!birthDate) {
        errors.birthDate = 'Enter a valid birthdate.'
      } else if (birthDate >= today) {
        errors.birthDate = 'Birthdate cannot be today or a future date.'
      } else if (addYears(birthDate, 18) > today) {
        errors.birthDate = 'Teacher must be at least 18 years old.'
      }
    }

    if (stepIndex === 1) {
      if (!form.teachingStartMonth) {
        errors.teachingStartMonth = 'Select teaching start month and year.'
      } else if (!teachingStartDate) {
        errors.teachingStartMonth = 'Enter a valid teaching start month.'
      } else if (teachingStartDate >= today) {
        errors.teachingStartMonth = 'Teaching start cannot be today or a future date.'
      } else if (birthDate && teachingStartDate < addYears(birthDate, 18)) {
        errors.teachingStartMonth = 'Teaching start cannot be before the teacher turned 18.'
      }

      if (!isValidEmail(form.email)) errors.email = 'Enter a complete email address.'
      if (!isValidContactNumber(form.contactNumber)) {
        errors.contactNumber = 'Use 09XXXXXXXXX or +639XXXXXXXXX.'
      }
      if (!form.majorId) errors.majorId = 'Select a major or specialization.'
      if (!form.educationalAttainmentId) {
        errors.educationalAttainmentId = 'Select educational attainment.'
      }
    }

    if (stepIndex === 2) {
      if (!form.regionCode) errors.regionCode = 'Select a region.'
      if (addressOptions.provinces.length && !form.provinceCode) {
        errors.provinceCode = 'Select a province.'
      }
      if (!form.cityMunicipalityCode) {
        errors.cityMunicipalityCode = 'Select a city or municipality.'
      }
      if (!form.barangayCode) errors.barangayCode = 'Select a barangay.'
      if (!form.addressLine.trim()) {
        errors.addressLine = 'Enter unit, building, house, or street details.'
      }
    }

    if (stepIndex === 3) {
      const passwordErrors = getPasswordErrors(form.password)

      if (passwordErrors.length) {
        errors.password = `Password must include ${passwordErrors.join(', ')}.`
      }
      if (form.confirmPassword !== form.password) {
        errors.confirmPassword = 'Passwords do not match.'
      }
    }

    if (stepIndex === 4) {
      if (!form.verificationMethod) {
        errors.verificationMethod = 'Select an available verification method.'
      } else if (!selectedVerificationMethod || selectedVerificationMethod.available !== true) {
        errors.verificationMethod =
          selectedVerificationMethod?.unavailableReason ||
          'The selected verification method is not available.'
      }
    }

    return errors
  }

  const goToNextStep = (event) => {
    event.preventDefault()

    if (referenceLoadFailed) {
      setRequestError(
        'Unable to load registration reference data. Registration is disabled until dropdown data is available.',
      )
      return
    }

    if (step === 3) {
      setAccountSubmitAttempted(true)
    }

    const errors = validateStep(step)
    setFieldErrors(errors)
    setRequestError('')

    if (Object.keys(errors).length > 0) {
      return
    }

    if (step === 2) {
      setAccountTouched({ password: false, confirmPassword: false })
      setAccountSubmitAttempted(false)
      setRequestError('')
      clearAccountErrors()
    }

    setStep((current) => Math.min(current + 1, STEPS.length - 1))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const goToPreviousStep = () => {
    setStep((current) => Math.max(current - 1, 0))
    setRequestError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setAccountSubmitAttempted(true)

    if (referenceLoadFailed) {
      setRequestError(
        'Unable to load registration reference data. Registration is disabled until dropdown data is available.',
      )
      return
    }

    const allErrors = STEPS.reduce(
      (errors, _step, stepIndex) => ({ ...errors, ...validateStep(stepIndex) }),
      {},
    )

    if (Object.keys(allErrors).length > 0) {
      setFieldErrors(allErrors)
      setRequestError('Review the highlighted fields before sending the verification code.')
      const firstErrorStep = getFirstRegistrationErrorStep(allErrors)

      if (firstErrorStep >= 0) setStep(firstErrorStep)
      return
    }

    const [teachingStartYear, teachingStartMonth] = form.teachingStartMonth
      .split('-')
      .map(Number)
    const payload = {
      firstName: form.firstName.trim(),
      middleName: form.middleName.trim() || undefined,
      lastName: form.lastName.trim(),
      suffixId: form.suffixId ? Number(form.suffixId) : null,
      birthDate: form.birthDate,
      teachingStartMonth,
      teachingStartYear,
      email: form.email.trim(),
      contactNumber: form.contactNumber.trim(),
      password: form.password,
      verificationMethod: form.verificationMethod,
      genderId: Number(form.genderId),
      majorId: Number(form.majorId),
      educationalAttainmentId: Number(form.educationalAttainmentId),
      address: {
        countryCode: 'PH',
        regionCode: form.regionCode,
        regionName: form.regionName,
        provinceCode: form.provinceCode || null,
        provinceName: form.provinceName || null,
        cityMunicipalityCode: form.cityMunicipalityCode,
        cityMunicipalityName: form.cityMunicipalityName,
        barangayCode: form.barangayCode,
        barangayName: form.barangayName,
        addressLine: form.addressLine.trim(),
        postalCode: form.postalCode.trim() || undefined,
      },
    }

    if (form.schoolCode) payload.schoolCode = form.schoolCode
    if (!payload.middleName) delete payload.middleName
    if (!payload.address.postalCode) delete payload.address.postalCode

    setIsSubmitting(true)
    setRequestError('')
    setSuccessMessage('')

    try {
      const verification = await registerTeacherV3(payload)
      storeTeacherVerificationSession({
        email: payload.email,
        ...verification,
        resendCooldownSeconds:
          referenceData.verificationPolicy?.resendCooldownSeconds ?? 60,
        maximumAttempts: referenceData.verificationPolicy?.maximumAttempts ?? 5,
      })
      onNavigate('verify-email')
    } catch (error) {
      const backendFieldErrors = normalizeRegistrationConflict(
        error,
        normalizeBackendFieldErrors(error),
      )
      const firstBackendErrorStep = getFirstRegistrationErrorStep(backendFieldErrors)
      setFieldErrors(backendFieldErrors)

      if (error.status === 409) {
        setStep(firstBackendErrorStep >= 0 ? firstBackendErrorStep : 1)
        setRequestError('Use a different email address or contact number before continuing.')
        window.scrollTo({ top: 0, behavior: 'smooth' })
      } else if (
        error.code === 'INVALID_VERIFICATION_METHOD' ||
        error.code === 'VERIFICATION_METHOD_UNAVAILABLE'
      ) {
        setStep(4)
        setRequestError(error.message || 'Select an available verification method.')
        window.scrollTo({ top: 0, behavior: 'smooth' })
      } else if (error.status === 503 && error.code === 'EMAIL_DELIVERY_FAILED') {
        setForm((current) => ({ ...current, password: '', confirmPassword: '' }))
        setIsPasswordVisible(false)
        setIsConfirmPasswordVisible(false)
        setAccountTouched({ password: false, confirmPassword: false })
        setAccountSubmitAttempted(false)
        setRequestError('We could not send the verification email. Please try again shortly.')
      } else if (
        firstBackendErrorStep >= 0 &&
        (error.status === 400 || error.code === 'VALIDATION_FAILED')
      ) {
        setStep(firstBackendErrorStep)
        setRequestError('Review the highlighted field before sending the verification code.')
        window.scrollTo({ top: 0, behavior: 'smooth' })
      } else {
        setRequestError(error.message || 'Unable to submit teacher registration.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <PublicAuthShell
      variant="signup"
      eyebrow="Teacher registration"
      title="Request access to Marka."
      description="Submit verified profile, address, and account details for principal approval."
      trustMessage="New teacher accounts remain pending until reviewed by the school."
      onNavigate={onNavigate}
    >
      <div className="public-auth-form-content is-signup">
        <div className="public-auth-form-heading teacher-registration-heading">
          <p>Teacher account request</p>
          <h1>Create your teacher profile</h1>
          <span>Complete each page before continuing. Invalid fields are blocked early.</span>
        </div>

        <ol className="teacher-registration-steps" aria-label="Teacher registration progress">
          {STEPS.map((item, index) => {
            const Icon = item.icon
            const isCurrent = index === step
            const isComplete = index < step

            return (
              <li key={item.label}>
                <button
                  type="button"
                  className={`teacher-registration-step${isCurrent ? ' is-current' : ''}${
                    isComplete ? ' is-complete' : ''
                  }`}
                  disabled={index >= step}
                  onClick={() => setStep(index)}
                  aria-current={isCurrent ? 'step' : undefined}
                >
                  <span className="teacher-registration-step-icon" aria-hidden="true">
                    {isComplete ? <Check size={17} strokeWidth={2.3} /> : <Icon size={17} />}
                  </span>
                  <span className="teacher-registration-step-copy">
                    <strong>{item.label}</strong>
                    <small>{item.description}</small>
                  </span>
                </button>
              </li>
            )
          })}
        </ol>

        {shouldShowRequestError ? (
          <p
            className="public-auth-message is-error teacher-registration-request-error"
            role="alert"
          >
            {requestError}
          </p>
        ) : null}
        {successMessage ? (
          <p className="public-auth-message is-success teacher-registration-request-error">
            {successMessage}
          </p>
        ) : null}

        <form className="teacher-registration-wizard" onSubmit={handleSubmit}>
          <header className="teacher-registration-wizard-header">
            <div>
              <p>{STEPS[step].label}</p>
              <h2>{step === 4 ? 'Choose verification method' : STEPS[step].description}</h2>
              <span>
                {step === 0
                  ? 'Enter the teacher identity details and a valid birthdate.'
                  : step === 1
                    ? 'Teaching start is collected as month and year only.'
                    : step === 2
                      ? 'Address location comes from dropdowns; only address line is free text.'
                      : step === 3
                        ? 'Set a password that matches backend strength rules.'
                        : 'Select where Marka should send your registration verification code.'}
              </span>
            </div>
            <strong>
              Step {step + 1} of {STEPS.length}
            </strong>
          </header>

          <div className="teacher-registration-wizard-body">
            {step === 0 ? (
              <div className="teacher-registration-form-grid">
                {referenceData.schools.length > 1 ? (
                  <label
                    className="public-auth-field teacher-registration-school-field is-full"
                    htmlFor="teacher-school"
                  >
                    <span>School</span>
                    <select
                      id="teacher-school"
                      value={form.schoolCode}
                      onChange={(event) => updateField('schoolCode', event.target.value)}
                      disabled={loadingReferences}
                      aria-invalid={Boolean(fieldErrors.schoolCode)}
                    >
                      <option value="">Select school</option>
                      {referenceData.schools.map((school) => {
                        const schoolId = getReferenceId(school, [
                          'schoolId',
                          'schoolCode',
                          'code',
                        ])
                        return (
                          <option key={schoolId} value={schoolId}>
                            {getReferenceLabel(school, ['schoolName'])}
                          </option>
                        )
                      })}
                    </select>
                    <ErrorText message={fieldErrors.schoolCode} />
                  </label>
                ) : null}

                <label className="public-auth-field" htmlFor="teacher-first-name">
                  <span>First name</span>
                  <input
                    id="teacher-first-name"
                    value={form.firstName}
                    onChange={(event) => updateField('firstName', event.target.value)}
                    autoComplete="given-name"
                    aria-invalid={Boolean(fieldErrors.firstName)}
                  />
                  <ErrorText message={fieldErrors.firstName} />
                </label>

                <label className="public-auth-field" htmlFor="teacher-middle-name">
                  <span>
                    Middle name <small>(optional)</small>
                  </span>
                  <input
                    id="teacher-middle-name"
                    value={form.middleName}
                    onChange={(event) => updateField('middleName', event.target.value)}
                    autoComplete="additional-name"
                  />
                </label>

                <label className="public-auth-field" htmlFor="teacher-last-name">
                  <span>Last name</span>
                  <input
                    id="teacher-last-name"
                    value={form.lastName}
                    onChange={(event) => updateField('lastName', event.target.value)}
                    autoComplete="family-name"
                    aria-invalid={Boolean(fieldErrors.lastName)}
                  />
                  <ErrorText message={fieldErrors.lastName} />
                </label>

                <label className="public-auth-field" htmlFor="teacher-suffix">
                  <span>
                    Suffix <small>(optional)</small>
                  </span>
                  <select
                    id="teacher-suffix"
                    value={form.suffixId}
                    onChange={(event) => updateField('suffixId', event.target.value)}
                    disabled={loadingReferences}
                  >
                    <option value="">No suffix</option>
                    {referenceData.suffixes.map((suffix) => {
                      const suffixId = getReferenceId(suffix, ['suffixId'])
                      return (
                        <option key={suffixId} value={suffixId}>
                          {getReferenceLabel(suffix, ['suffixName', 'suffix'])}
                        </option>
                      )
                    })}
                  </select>
                </label>

                <label className="public-auth-field" htmlFor="teacher-birth-date">
                  <span>Birthdate</span>
                  <input
                    id="teacher-birth-date"
                    type="date"
                    max={maxBirthDate}
                    value={form.birthDate}
                    onChange={(event) => updateField('birthDate', event.target.value)}
                    aria-invalid={Boolean(fieldErrors.birthDate)}
                  />
                  <ErrorText message={fieldErrors.birthDate} />
                </label>

                <label className="public-auth-field" htmlFor="teacher-gender">
                  <span>Gender</span>
                  <select
                    id="teacher-gender"
                    value={form.genderId}
                    onChange={(event) => updateField('genderId', event.target.value)}
                    disabled={loadingReferences}
                    aria-invalid={Boolean(fieldErrors.genderId)}
                  >
                    <option value="">{loadingReferences ? 'Loading genders...' : 'Select gender'}</option>
                    {referenceData.genders.map((gender) => {
                      const genderId = getReferenceId(gender, ['genderId'])
                      return (
                        <option key={genderId} value={genderId}>
                          {getReferenceLabel(gender, ['genderName'])}
                        </option>
                      )
                    })}
                  </select>
                  <ErrorText message={fieldErrors.genderId} />
                </label>
              </div>
            ) : null}

            {step === 1 ? (
              <div className="teacher-registration-form-grid">
                <label className="public-auth-field" htmlFor="teacher-start-month">
                  <span>Teaching start month and year</span>
                  <input
                    id="teacher-start-month"
                    type="month"
                    max={currentMonth}
                    value={form.teachingStartMonth}
                    onChange={(event) => updateField('teachingStartMonth', event.target.value)}
                    aria-invalid={Boolean(fieldErrors.teachingStartMonth)}
                  />
                  <ErrorText message={fieldErrors.teachingStartMonth} />
                </label>

                <label className="public-auth-field" htmlFor="teacher-contact">
                  <span>Contact number</span>
                  <input
                    id="teacher-contact"
                    type="tel"
                    value={form.contactNumber}
                    onChange={(event) => updateField('contactNumber', event.target.value)}
                    placeholder="09XXXXXXXXX or +639XXXXXXXX"
                    autoComplete="tel"
                    aria-invalid={Boolean(fieldErrors.contactNumber)}
                  />
                  <ErrorText message={fieldErrors.contactNumber} />
                </label>

                <label className="public-auth-field is-full" htmlFor="teacher-email">
                  <span>Email address</span>
                  <input
                    id="teacher-email"
                    type="email"
                    value={form.email}
                    onChange={(event) => updateField('email', event.target.value)}
                    placeholder="teachername123@gmail.com"
                    autoComplete="email"
                    aria-invalid={Boolean(fieldErrors.email)}
                  />
                  <ErrorText message={fieldErrors.email} />
                </label>

                <label className="public-auth-field" htmlFor="teacher-major">
                  <span>Major or specialization</span>
                  <select
                    id="teacher-major"
                    value={form.majorId}
                    onChange={(event) => updateField('majorId', event.target.value)}
                    disabled={loadingReferences}
                    aria-invalid={Boolean(fieldErrors.majorId)}
                  >
                    <option value="">{loadingReferences ? 'Loading majors...' : 'Select major'}</option>
                    {referenceData.majors.map((major) => {
                      const majorId = getReferenceId(major, ['majorId'])
                      return (
                        <option key={majorId} value={majorId}>
                          {getReferenceLabel(major, ['majorName'])}
                        </option>
                      )
                    })}
                  </select>
                  <ErrorText message={fieldErrors.majorId} />
                </label>

                <label className="public-auth-field" htmlFor="teacher-attainment">
                  <span>Educational attainment</span>
                  <select
                    id="teacher-attainment"
                    value={form.educationalAttainmentId}
                    onChange={(event) => updateField('educationalAttainmentId', event.target.value)}
                    disabled={loadingReferences}
                    aria-invalid={Boolean(fieldErrors.educationalAttainmentId)}
                  >
                    <option value="">
                      {loadingReferences ? 'Loading attainments...' : 'Select attainment'}
                    </option>
                    {referenceData.educationalAttainments.map((attainment) => {
                      const attainmentId = getReferenceId(attainment, ['educationalAttainmentId'])
                      return (
                        <option key={attainmentId} value={attainmentId}>
                          {getReferenceLabel(attainment, ['educationalAttainmentName'])}
                        </option>
                      )
                    })}
                  </select>
                  <ErrorText message={fieldErrors.educationalAttainmentId} />
                </label>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="teacher-registration-form-grid">
                <label className="public-auth-field" htmlFor="teacher-region">
                  <span>Region</span>
                  <select
                    id="teacher-region"
                    value={form.regionCode}
                    onChange={(event) => {
                      const option = addressOptions.regions.find(
                        (region) => region.code === event.target.value,
                      ) ?? { code: '', name: '' }
                      updateAddressSelection('region', option)
                    }}
                    disabled={loadingAddress.regions}
                    aria-invalid={Boolean(fieldErrors.regionCode)}
                  >
                    <option value="">
                      {loadingAddress.regions ? 'Loading regions...' : 'Select region'}
                    </option>
                    {addressOptions.regions.map((region) => (
                      <option key={region.code} value={region.code}>
                        {region.name}
                      </option>
                    ))}
                  </select>
                  <ErrorText message={fieldErrors.regionCode} />
                </label>

                <label className="public-auth-field" htmlFor="teacher-province">
                  <span>Province</span>
                  <select
                    id="teacher-province"
                    value={form.provinceCode}
                    onChange={(event) => {
                      const option = addressOptions.provinces.find(
                        (province) => province.code === event.target.value,
                      ) ?? { code: '', name: '' }
                      updateAddressSelection('province', option)
                    }}
                    disabled={loadingAddress.provinces || !addressOptions.provinces.length}
                    aria-invalid={Boolean(fieldErrors.provinceCode)}
                  >
                    <option value="">
                      {addressOptions.provinces.length
                        ? 'Select province'
                        : 'No province required for this region'}
                    </option>
                    {addressOptions.provinces.map((province) => (
                      <option key={province.code} value={province.code}>
                        {province.name}
                      </option>
                    ))}
                  </select>
                  <ErrorText message={fieldErrors.provinceCode} />
                </label>

                <label className="public-auth-field" htmlFor="teacher-city">
                  <span>City or municipality</span>
                  <select
                    id="teacher-city"
                    value={form.cityMunicipalityCode}
                    onChange={(event) => {
                      const option = addressOptions.cities.find(
                        (city) => city.code === event.target.value,
                      ) ?? { code: '', name: '' }
                      updateAddressSelection('cityMunicipality', option)
                    }}
                    disabled={loadingAddress.cities || !form.regionCode}
                    aria-invalid={Boolean(fieldErrors.cityMunicipalityCode)}
                  >
                    <option value="">
                      {loadingAddress.cities ? 'Loading cities...' : 'Select city or municipality'}
                    </option>
                    {addressOptions.cities.map((city) => (
                      <option key={city.code} value={city.code}>
                        {city.name}
                      </option>
                    ))}
                  </select>
                  <ErrorText message={fieldErrors.cityMunicipalityCode} />
                </label>

                <label className="public-auth-field" htmlFor="teacher-barangay">
                  <span>Barangay</span>
                  <select
                    id="teacher-barangay"
                    value={form.barangayCode}
                    onChange={(event) => {
                      const option = addressOptions.barangays.find(
                        (barangay) => barangay.code === event.target.value,
                      ) ?? { code: '', name: '' }
                      updateAddressSelection('barangay', option)
                    }}
                    disabled={loadingAddress.barangays || !form.cityMunicipalityCode}
                    aria-invalid={Boolean(fieldErrors.barangayCode)}
                  >
                    <option value="">
                      {loadingAddress.barangays ? 'Loading barangays...' : 'Select barangay'}
                    </option>
                    {addressOptions.barangays.map((barangay) => (
                      <option key={barangay.code} value={barangay.code}>
                        {barangay.name}
                      </option>
                    ))}
                  </select>
                  <ErrorText message={fieldErrors.barangayCode} />
                </label>

                <label className="public-auth-field is-full" htmlFor="teacher-address-line">
                  <span>Unit, building, house, or street details</span>
                  <input
                    id="teacher-address-line"
                    value={form.addressLine}
                    onChange={(event) => updateField('addressLine', event.target.value)}
                    autoComplete="street-address"
                    aria-invalid={Boolean(fieldErrors.addressLine)}
                  />
                  <ErrorText message={fieldErrors.addressLine} />
                </label>

                <label className="public-auth-field" htmlFor="teacher-postal-code">
                  <span>
                    Postal code <small>(optional)</small>
                  </span>
                  <input
                    id="teacher-postal-code"
                    value={form.postalCode}
                    onChange={(event) => updateField('postalCode', event.target.value)}
                    autoComplete="postal-code"
                  />
                </label>

                <label className="public-auth-field" htmlFor="teacher-country">
                  <span>Country</span>
                  <input id="teacher-country" value="Philippines" disabled />
                </label>
              </div>
            ) : null}

            {step === 3 ? (
              <div className="teacher-registration-account-step">
                <input
                  type="email"
                  name="username"
                  value={form.email}
                  autoComplete="username"
                  readOnly
                  hidden
                />
                <div className="teacher-registration-form-grid">
                  <label className="public-auth-field" htmlFor="teacher-password">
                    <span>Password</span>
                    <div className="public-auth-input-wrap">
                      <input
                        id="teacher-password"
                        name="password"
                        type={isPasswordVisible ? 'text' : 'password'}
                        value={form.password}
                        onChange={(event) => updateField('password', event.target.value)}
                        onBlur={() => showCurrentAccountErrors('password')}
                        autoComplete="new-password"
                        aria-invalid={Boolean(
                          shouldShowFieldError('password') && fieldErrors.password,
                        )}
                      />
                      <button
                        type="button"
                        className="public-auth-password-toggle"
                        onClick={() => setIsPasswordVisible((visible) => !visible)}
                        aria-label={isPasswordVisible ? 'Hide password' : 'Show password'}
                        aria-controls="teacher-password"
                        title={isPasswordVisible ? 'Hide password' : 'Show password'}
                      >
                        {isPasswordVisible ? <EyeOff size={17} /> : <Eye size={17} />}
                      </button>
                    </div>
                    <ErrorText
                      message={shouldShowFieldError('password') ? fieldErrors.password : ''}
                    />
                  </label>

                  <label className="public-auth-field" htmlFor="teacher-confirm-password">
                    <span>Confirm password</span>
                    <div className="public-auth-input-wrap">
                      <input
                        id="teacher-confirm-password"
                        name="confirmPassword"
                        type={isConfirmPasswordVisible ? 'text' : 'password'}
                        value={form.confirmPassword}
                        onChange={(event) => updateField('confirmPassword', event.target.value)}
                        onBlur={() => showCurrentAccountErrors('confirmPassword')}
                        autoComplete="new-password"
                        aria-invalid={Boolean(
                          shouldShowFieldError('confirmPassword') && fieldErrors.confirmPassword,
                        )}
                      />
                      <button
                        type="button"
                        className="public-auth-password-toggle"
                        onClick={() => setIsConfirmPasswordVisible((visible) => !visible)}
                        aria-label={
                          isConfirmPasswordVisible
                            ? 'Hide confirmed password'
                            : 'Show confirmed password'
                        }
                        aria-controls="teacher-confirm-password"
                        title={
                          isConfirmPasswordVisible
                            ? 'Hide confirmed password'
                            : 'Show confirmed password'
                        }
                      >
                        {isConfirmPasswordVisible ? <EyeOff size={17} /> : <Eye size={17} />}
                      </button>
                    </div>
                    <ErrorText
                      message={
                        shouldShowFieldError('confirmPassword') ? fieldErrors.confirmPassword : ''
                      }
                    />
                  </label>
                </div>

                <div className="teacher-registration-review-heading">
                  <span aria-hidden="true">
                    <ShieldCheck size={20} />
                  </span>
                  <div>
                    <h3>Review teacher registration</h3>
                    <p>Review the details, then choose where Marka should send the verification code.</p>
                  </div>
                </div>

                <dl className="teacher-registration-review-grid">
                  <ReviewItem
                    label="Full name"
                    value={[
                      form.firstName,
                      form.middleName,
                      form.lastName,
                      lookupNames.suffix,
                    ].filter(Boolean).join(' ')}
                  />
                  <ReviewItem label="Gender" value={lookupNames.gender} />
                  <ReviewItem label="Birthdate" value={form.birthDate} />
                  <ReviewItem
                    label="Years of teaching"
                    value={getYearsOfTeaching(form.teachingStartMonth, todayDate)}
                  />
                  <ReviewItem label="Email" value={form.email} />
                  <ReviewItem label="Contact number" value={form.contactNumber} />
                  <ReviewItem label="Major" value={lookupNames.major} />
                  <ReviewItem label="Educational attainment" value={lookupNames.attainment} />
                  <ReviewItem
                    label="Address"
                    value={[
                      form.addressLine,
                      form.barangayName,
                      form.cityMunicipalityName,
                      form.provinceName,
                      form.regionName,
                      form.postalCode,
                      'Philippines',
                    ].filter(Boolean).join(', ')}
                  />
                </dl>
              </div>
            ) : null}

            {step === 4 ? (
              <fieldset className="teacher-registration-verification-step">
                <legend className="sr-only">Choose verification method</legend>

                {referenceData.verificationMethods.length ? (
                  <div className="teacher-verification-methods">
                    {referenceData.verificationMethods.map((method) => {
                      const methodName = String(method.method ?? '')
                      const isAvailable = method.available === true
                      const isSelected = form.verificationMethod === methodName
                      const MethodIcon =
                        methodName === 'email'
                          ? Mail
                          : methodName === 'sms'
                            ? MessageSquareText
                            : ShieldCheck

                      return (
                        <label
                          key={methodName}
                          className={`teacher-verification-method${
                            isSelected ? ' is-selected' : ''
                          }${isAvailable ? '' : ' is-unavailable'}`}
                        >
                          <input
                            type="radio"
                            name="verificationMethod"
                            value={methodName}
                            checked={isSelected}
                            disabled={!isAvailable}
                            onChange={(event) =>
                              updateField('verificationMethod', event.target.value)
                            }
                          />
                          <span className="teacher-verification-method-icon" aria-hidden="true">
                            <MethodIcon size={20} />
                          </span>
                          <span className="teacher-verification-method-copy">
                            <strong>{method.label || method.displayName || methodName}</strong>
                            {methodName === 'email' ? <small>{form.email}</small> : null}
                            {!isAvailable ? (
                              <small className="is-unavailable-reason">
                                {method.unavailableReason || 'This method is not available.'}
                              </small>
                            ) : null}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                ) : (
                  <p className="public-auth-message is-error teacher-verification-empty" role="alert">
                    No verification methods are currently available. Please try again later.
                  </p>
                )}

                <ErrorText message={fieldErrors.verificationMethod} />
              </fieldset>
            ) : null}
          </div>

          <footer className="teacher-registration-wizard-footer">
            <button
              type="button"
              className="teacher-registration-secondary"
              onClick={goToPreviousStep}
              disabled={step === 0 || isSubmitting}
            >
              Previous
            </button>

            {step < STEPS.length - 1 ? (
              <button
                key="continue-registration"
                type="button"
                className="public-auth-submit"
                onClick={goToNextStep}
                disabled={loadingReferences || referenceLoadFailed || loadingAddress.regions}
              >
                <span>Continue</span>
                <ArrowRight size={18} strokeWidth={2.3} aria-hidden="true" />
              </button>
            ) : (
              <button
                key="submit-registration"
                type="submit"
                className="public-auth-submit"
                disabled={
                  isSubmitting ||
                  loadingReferences ||
                  referenceLoadFailed ||
                  !hasAvailableVerificationMethod
                }
              >
                <span>{isSubmitting ? 'Sending...' : 'Send verification code'}</span>
                {isSubmitting ? (
                  <RefreshCw size={18} className="animate-spin" aria-hidden="true" />
                ) : (
                  <Check size={18} strokeWidth={2.3} aria-hidden="true" />
                )}
              </button>
            )}
          </footer>
        </form>

        <p className="public-auth-switch teacher-registration-switch">
          Already have an account?
          <button type="button" onClick={() => onNavigate('login')}>
            Log in
          </button>
        </p>
      </div>
    </PublicAuthShell>
  )
}

export default TeacherSignUpPage

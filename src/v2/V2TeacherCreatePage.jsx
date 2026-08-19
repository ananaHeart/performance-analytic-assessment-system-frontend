import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  MapPin,
  RefreshCw,
  ShieldCheck,
  UserRound,
} from 'lucide-react'

import {
  createTeacherAccountV2,
  getTeacherReferenceDataV2,
} from '@/api/apiV2Client'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { navigateV2, V2_ROUTES } from '@/v2/v2Routes'
import { storeTeacherFlowFlash } from '@/v2/v2TeacherFlow'

const STEPS = [
  { label: 'Personal', description: 'Identity details', icon: UserRound },
  { label: 'Professional', description: 'Work and contact', icon: BriefcaseBusiness },
  { label: 'Address', description: 'Home address', icon: MapPin },
  { label: 'Account', description: 'Access and review', icon: KeyRound },
]

const INITIAL_FORM = {
  firstName: '',
  middleName: '',
  lastName: '',
  suffix: '',
  birthDate: '',
  teachingStartDate: '',
  email: '',
  contactNumber: '',
  temporaryPassword: '',
  confirmPassword: '',
  genderId: '',
  majorId: '',
  educationalAttainmentId: '',
  countryCode: 'PH',
  regionName: '',
  provinceName: '',
  cityMunicipalityName: '',
  barangayName: '',
  addressLine: '',
  postalCode: '',
}

const SELECT_CLASS = 'h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-70'

function optionalValue(value) {
  const normalized = String(value ?? '').trim()
  return normalized || undefined
}

function generateTemporaryPassword() {
  const randomValues = new Uint32Array(10)
  window.crypto.getRandomValues(randomValues)
  const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%'
  const randomPart = Array.from(randomValues, (value) => characters[value % characters.length]).join('')
  return `Sm1!${randomPart}`
}

function ErrorText({ message }) {
  if (!message) return null
  return <p className="m-0 text-xs font-medium text-destructive">{message}</p>
}

function ReviewItem({ label, value }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold uppercase text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words text-sm font-medium text-foreground">{value || 'Not provided'}</dd>
    </div>
  )
}

function V2TeacherCreatePage({ token }) {
  const [step, setStep] = useState(0)
  const [form, setForm] = useState(INITIAL_FORM)
  const [referenceData, setReferenceData] = useState({
    genders: [],
    majors: [],
    educationalAttainments: [],
  })
  const [loadingReferences, setLoadingReferences] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [fieldErrors, setFieldErrors] = useState({})
  const [requestError, setRequestError] = useState('')

  useEffect(() => {
    let active = true

    getTeacherReferenceDataV2(token)
      .then((data) => {
        if (active) setReferenceData(data)
      })
      .catch((error) => {
        if (active) setRequestError(error.message)
      })
      .finally(() => {
        if (active) setLoadingReferences(false)
      })

    return () => { active = false }
  }, [token])

  const lookupNames = useMemo(() => ({
    gender: referenceData.genders.find((item) => String(item.genderId) === String(form.genderId))?.genderName,
    major: referenceData.majors.find((item) => String(item.majorId) === String(form.majorId))?.majorName,
    attainment: referenceData.educationalAttainments.find(
      (item) => String(item.educationalAttainmentId) === String(form.educationalAttainmentId),
    )?.educationalAttainmentName,
  }), [form.educationalAttainmentId, form.genderId, form.majorId, referenceData])

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }))
    setFieldErrors((current) => {
      if (!current[field]) return current
      const next = { ...current }
      delete next[field]
      return next
    })
  }

  const validateStep = (stepIndex) => {
    const errors = {}

    if (stepIndex === 0) {
      if (!form.firstName.trim()) errors.firstName = 'First name is required.'
      if (!form.lastName.trim()) errors.lastName = 'Last name is required.'
      if (!form.birthDate) errors.birthDate = 'Birth date is required.'
      if (!form.genderId) errors.genderId = 'Select a gender.'
    }

    if (stepIndex === 1) {
      if (!form.teachingStartDate) errors.teachingStartDate = 'Teaching start date is required.'
      if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) errors.email = 'Enter a valid email address.'
      if (!form.contactNumber.trim()) errors.contactNumber = 'Contact number is required.'
      if (!form.majorId) errors.majorId = 'Select a major or specialization.'
      if (!form.educationalAttainmentId) {
        errors.educationalAttainmentId = 'Select the highest educational attainment.'
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
      if (form.temporaryPassword.length < 10) {
        errors.temporaryPassword = 'Temporary password must contain at least 10 characters.'
      }
      if (form.confirmPassword !== form.temporaryPassword) {
        errors.confirmPassword = 'Passwords do not match.'
      }
    }

    return errors
  }

  const goToNextStep = () => {
    const errors = validateStep(step)
    setFieldErrors(errors)
    setRequestError('')

    if (Object.keys(errors).length === 0) {
      setStep((current) => Math.min(current + 1, STEPS.length - 1))
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    const allErrors = STEPS.reduce(
      (errors, _step, index) => ({ ...errors, ...validateStep(index) }),
      {},
    )

    if (Object.keys(allErrors).length > 0) {
      setFieldErrors(allErrors)
      const firstErrorStep = [
        ['firstName', 'lastName', 'birthDate', 'genderId'],
        ['teachingStartDate', 'email', 'contactNumber', 'majorId', 'educationalAttainmentId'],
        ['addressLine', 'cityMunicipalityName', 'barangayName'],
        ['temporaryPassword', 'confirmPassword'],
      ].findIndex((fields) => fields.some((field) => allErrors[field]))
      if (firstErrorStep >= 0) setStep(firstErrorStep)
      setRequestError('Review the highlighted fields before creating the account.')
      return
    }

    const address = {
      countryCode: 'PH',
      cityMunicipalityName: form.cityMunicipalityName.trim(),
      barangayName: form.barangayName.trim(),
      addressLine: form.addressLine.trim(),
      ...(optionalValue(form.regionName) ? { regionName: form.regionName.trim() } : {}),
      ...(optionalValue(form.provinceName) ? { provinceName: form.provinceName.trim() } : {}),
      ...(optionalValue(form.postalCode) ? { postalCode: form.postalCode.trim() } : {}),
    }

    const payload = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      birthDate: form.birthDate,
      teachingStartDate: form.teachingStartDate,
      email: form.email.trim(),
      contactNumber: form.contactNumber.trim(),
      temporaryPassword: form.temporaryPassword,
      genderId: Number(form.genderId),
      majorId: Number(form.majorId),
      educationalAttainmentId: Number(form.educationalAttainmentId),
      address,
      ...(optionalValue(form.middleName) ? { middleName: form.middleName.trim() } : {}),
      ...(optionalValue(form.suffix) ? { suffix: form.suffix.trim() } : {}),
    }

    setSubmitting(true)
    setRequestError('')

    try {
      await createTeacherAccountV2(payload, token)
      storeTeacherFlowFlash(`${form.firstName.trim()} ${form.lastName.trim()}'s teacher account was created and is pending approval.`)
      navigateV2(V2_ROUTES.teachers)
    } catch (error) {
      setRequestError(error.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="smart-ui mx-auto max-w-6xl space-y-6">
      <header className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <button
            type="button"
            className="mb-2 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:text-primary-hover"
            onClick={() => navigateV2(V2_ROUTES.teachers)}
          >
            <ArrowLeft className="size-4" />
            Back to teacher accounts
          </button>
          <p className="m-0 text-xs font-semibold uppercase text-primary">Principal account management</p>
          <h1 className="m-0 text-2xl font-bold text-foreground">Add a teacher</h1>
          <p className="m-0 max-w-2xl text-sm text-muted-foreground">
            Create a complete teacher profile using school-approved reference information.
          </p>
        </div>
        <div className="rounded-md border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
          Step <strong className="text-foreground">{step + 1}</strong> of {STEPS.length}
        </div>
      </header>

      <ol className="grid gap-2 md:grid-cols-4" aria-label="Teacher account creation progress">
        {STEPS.map((item, index) => {
          const Icon = item.icon
          const isCurrent = index === step
          const isComplete = index < step

          return (
            <li
              key={item.label}
              className={isCurrent
                ? 'flex items-center gap-3 rounded-md border border-primary bg-brand-soft px-4 py-3'
                : 'flex items-center gap-3 rounded-md border border-border bg-background px-4 py-3'}
              aria-current={isCurrent ? 'step' : undefined}
            >
              <span className={isComplete
                ? 'flex size-9 shrink-0 items-center justify-center rounded-full bg-success text-success-soft'
                : isCurrent
                  ? 'flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground'
                  : 'flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground'}
              >
                {isComplete ? <Check className="size-4" /> : <Icon className="size-4" />}
              </span>
              <span className="min-w-0">
                <strong className="block text-sm font-semibold text-foreground">{item.label}</strong>
                <small className="block truncate text-xs text-muted-foreground">{item.description}</small>
              </span>
            </li>
          )
        })}
      </ol>

      {requestError ? (
        <div className="rounded-md border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive" role="alert">
          {requestError}
        </div>
      ) : null}

      <form onSubmit={handleSubmit}>
        <Card>
          {step === 0 ? (
            <>
              <CardHeader className="border-b border-border">
                <CardTitle>Personal information</CardTitle>
                <CardDescription>Enter the teacher's name, birth date, and gender.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-5 p-5 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="teacher-first-name">First name</Label>
                  <Input id="teacher-first-name" value={form.firstName} onChange={(event) => updateField('firstName', event.target.value)} autoComplete="given-name" />
                  <ErrorText message={fieldErrors.firstName} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="teacher-middle-name">Middle name <span className="font-normal text-muted-foreground">(optional)</span></Label>
                  <Input id="teacher-middle-name" value={form.middleName} onChange={(event) => updateField('middleName', event.target.value)} autoComplete="additional-name" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="teacher-last-name">Last name</Label>
                  <Input id="teacher-last-name" value={form.lastName} onChange={(event) => updateField('lastName', event.target.value)} autoComplete="family-name" />
                  <ErrorText message={fieldErrors.lastName} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="teacher-suffix">Suffix <span className="font-normal text-muted-foreground">(optional)</span></Label>
                  <Input id="teacher-suffix" value={form.suffix} onChange={(event) => updateField('suffix', event.target.value)} placeholder="e.g. Jr., III" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="teacher-birth-date">Birth date</Label>
                  <Input id="teacher-birth-date" type="date" max={new Date().toISOString().slice(0, 10)} value={form.birthDate} onChange={(event) => updateField('birthDate', event.target.value)} />
                  <ErrorText message={fieldErrors.birthDate} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="teacher-gender">Gender</Label>
                  <select id="teacher-gender" className={SELECT_CLASS} value={form.genderId} onChange={(event) => updateField('genderId', event.target.value)} disabled={loadingReferences}>
                    <option value="">{loadingReferences ? 'Loading genders...' : 'Select gender'}</option>
                    {referenceData.genders.map((gender) => (
                      <option key={gender.genderId} value={gender.genderId}>{gender.genderName}</option>
                    ))}
                  </select>
                  <ErrorText message={fieldErrors.genderId} />
                </div>
              </CardContent>
            </>
          ) : null}

          {step === 1 ? (
            <>
              <CardHeader className="border-b border-border">
                <CardTitle>Professional and contact information</CardTitle>
                <CardDescription>Use the official school contact and teaching profile.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-5 p-5 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="teacher-start-date">Teaching start date</Label>
                  <Input id="teacher-start-date" type="date" max={new Date().toISOString().slice(0, 10)} value={form.teachingStartDate} onChange={(event) => updateField('teachingStartDate', event.target.value)} />
                  <ErrorText message={fieldErrors.teachingStartDate} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="teacher-contact">Contact number</Label>
                  <Input id="teacher-contact" type="tel" value={form.contactNumber} onChange={(event) => updateField('contactNumber', event.target.value)} placeholder="e.g. 09171234567" autoComplete="tel" />
                  <ErrorText message={fieldErrors.contactNumber} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="teacher-email">Email address</Label>
                  <Input id="teacher-email" type="email" value={form.email} onChange={(event) => updateField('email', event.target.value)} placeholder="teacher@school.edu" autoComplete="email" />
                  <ErrorText message={fieldErrors.email} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="teacher-major">Major or specialization</Label>
                  <select id="teacher-major" className={SELECT_CLASS} value={form.majorId} onChange={(event) => updateField('majorId', event.target.value)} disabled={loadingReferences}>
                    <option value="">{loadingReferences ? 'Loading majors...' : 'Select major'}</option>
                    {referenceData.majors.map((major) => (
                      <option key={major.majorId} value={major.majorId}>{major.majorName}</option>
                    ))}
                  </select>
                  <ErrorText message={fieldErrors.majorId} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="teacher-attainment">Educational attainment</Label>
                  <select id="teacher-attainment" className={SELECT_CLASS} value={form.educationalAttainmentId} onChange={(event) => updateField('educationalAttainmentId', event.target.value)} disabled={loadingReferences}>
                    <option value="">{loadingReferences ? 'Loading attainments...' : 'Select attainment'}</option>
                    {referenceData.educationalAttainments.map((attainment) => (
                      <option key={attainment.educationalAttainmentId} value={attainment.educationalAttainmentId}>
                        {attainment.educationalAttainmentName}
                      </option>
                    ))}
                  </select>
                  <ErrorText message={fieldErrors.educationalAttainmentId} />
                </div>
              </CardContent>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <CardHeader className="border-b border-border">
                <CardTitle>Address</CardTitle>
                <CardDescription>Provide the teacher's current Philippine address.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-5 p-5 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="teacher-address-line">House, building, and street</Label>
                  <Input id="teacher-address-line" value={form.addressLine} onChange={(event) => updateField('addressLine', event.target.value)} autoComplete="street-address" />
                  <ErrorText message={fieldErrors.addressLine} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="teacher-region">Region <span className="font-normal text-muted-foreground">(optional)</span></Label>
                  <Input id="teacher-region" value={form.regionName} onChange={(event) => updateField('regionName', event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="teacher-province">Province <span className="font-normal text-muted-foreground">(optional)</span></Label>
                  <Input id="teacher-province" value={form.provinceName} onChange={(event) => updateField('provinceName', event.target.value)} autoComplete="address-level1" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="teacher-city">City or municipality</Label>
                  <Input id="teacher-city" value={form.cityMunicipalityName} onChange={(event) => updateField('cityMunicipalityName', event.target.value)} autoComplete="address-level2" />
                  <ErrorText message={fieldErrors.cityMunicipalityName} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="teacher-barangay">Barangay</Label>
                  <Input id="teacher-barangay" value={form.barangayName} onChange={(event) => updateField('barangayName', event.target.value)} autoComplete="address-level3" />
                  <ErrorText message={fieldErrors.barangayName} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="teacher-postal-code">Postal code <span className="font-normal text-muted-foreground">(optional)</span></Label>
                  <Input id="teacher-postal-code" value={form.postalCode} onChange={(event) => updateField('postalCode', event.target.value)} autoComplete="postal-code" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="teacher-country">Country</Label>
                  <Input id="teacher-country" value="Philippines" disabled />
                </div>
              </CardContent>
            </>
          ) : null}

          {step === 3 ? (
            <>
              <CardHeader className="border-b border-border">
                <CardTitle>Account access and review</CardTitle>
                <CardDescription>Set the initial password, then verify the profile before submission.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 p-5">
                <div className="grid gap-5 md:grid-cols-2">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <Label htmlFor="teacher-temporary-password">Temporary password</Label>
                      <button
                        type="button"
                        className="text-xs font-semibold text-primary hover:text-primary-hover"
                        onClick={() => {
                          const password = generateTemporaryPassword()
                          updateField('temporaryPassword', password)
                          updateField('confirmPassword', password)
                          setShowPassword(true)
                        }}
                      >
                        Generate password
                      </button>
                    </div>
                    <div className="relative">
                      <Input id="teacher-temporary-password" className="pr-11" type={showPassword ? 'text' : 'password'} value={form.temporaryPassword} onChange={(event) => updateField('temporaryPassword', event.target.value)} autoComplete="new-password" />
                      <button
                        type="button"
                        className="absolute right-1 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                        onClick={() => setShowPassword((visible) => !visible)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                    <ErrorText message={fieldErrors.temporaryPassword} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="teacher-confirm-password">Confirm temporary password</Label>
                    <Input id="teacher-confirm-password" type={showPassword ? 'text' : 'password'} value={form.confirmPassword} onChange={(event) => updateField('confirmPassword', event.target.value)} autoComplete="new-password" />
                    <ErrorText message={fieldErrors.confirmPassword} />
                  </div>
                </div>

                <div className="rounded-md border border-border bg-muted p-5">
                  <div className="mb-4 flex items-center gap-3">
                    <span className="flex size-9 items-center justify-center rounded-md bg-brand-soft text-primary">
                      <ShieldCheck className="size-5" />
                    </span>
                    <div>
                      <h3 className="m-0 text-sm font-semibold text-foreground">Review teacher profile</h3>
                      <p className="m-0 mt-1 text-xs text-muted-foreground">The new account starts as Pending and must be approved before teacher access is granted.</p>
                    </div>
                  </div>
                  <dl className="grid gap-x-8 gap-y-5 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-3">
                    <ReviewItem label="Full name" value={[form.firstName, form.middleName, form.lastName, form.suffix].filter(Boolean).join(' ')} />
                    <ReviewItem label="Gender" value={lookupNames.gender} />
                    <ReviewItem label="Birth date" value={form.birthDate} />
                    <ReviewItem label="Email" value={form.email} />
                    <ReviewItem label="Contact number" value={form.contactNumber} />
                    <ReviewItem label="Teaching start" value={form.teachingStartDate} />
                    <ReviewItem label="Major" value={lookupNames.major} />
                    <ReviewItem label="Educational attainment" value={lookupNames.attainment} />
                    <ReviewItem label="Address" value={[form.addressLine, form.barangayName, form.cityMunicipalityName, form.provinceName, form.regionName, form.postalCode, 'Philippines'].filter(Boolean).join(', ')} />
                  </dl>
                </div>
              </CardContent>
            </>
          ) : null}

          <div className="flex flex-col-reverse gap-3 border-t border-border p-5 sm:flex-row sm:items-center sm:justify-between">
            <Button
              variant="outline"
              onClick={() => setStep((current) => Math.max(current - 1, 0))}
              disabled={step === 0 || submitting}
            >
              <ArrowLeft />
              Previous
            </Button>

            {step < STEPS.length - 1 ? (
              <Button type="button" onClick={goToNextStep} disabled={loadingReferences}>
                {loadingReferences ? <RefreshCw className="animate-spin" /> : <ArrowRight />}
                Continue
              </Button>
            ) : (
              <Button type="submit" disabled={submitting || loadingReferences}>
                {submitting ? <RefreshCw className="animate-spin" /> : <Check />}
                {submitting ? 'Creating account...' : 'Create teacher account'}
              </Button>
            )}
          </div>
        </Card>
      </form>
    </section>
  )
}

export default V2TeacherCreatePage

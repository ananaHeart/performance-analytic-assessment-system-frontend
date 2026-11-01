import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Archive,
  ArrowLeft,
  CalendarDays,
  ChevronRight,
  Pencil,
  RefreshCw,
  RotateCcw,
  Save,
  School,
  ShieldCheck,
  UserRound,
  X,
} from 'lucide-react'
import MfaSecurityPanel from '../components/MfaSecurityPanel'
import AccountProfilePanel from '../components/AccountProfilePanel'
import AccountPasswordPanel from '../components/AccountPasswordPanel'
import AccountVerificationPanel from '../components/AccountVerificationPanel'
import AccountContactChangePanel from '../components/AccountContactChangePanel'
import { formatAcademicYearDate, formatTermDate, isThreeTermCalendar } from '../utils/academicCalendar'
import {
  archiveAcademicYearV3,
  getClassAssignmentsV3,
  getAcademicYearsV3,
  getAcademicYearArchiveEligibilityV3,
  getSchoolProfileV3,
  reactivateClassAssignmentV3,
  updateSchoolProfileV3,
  updateTermPeriodDatesV3,
} from '../api/apiV3Client'

const ADDRESS_API_BASE_URL = 'https://psgc.gitlab.io/api'

async function fetchAddressOptions(path) {
  const response = await fetch(`${ADDRESS_API_BASE_URL}${path}`)
  if (!response.ok) throw new Error('Unable to load Philippine address options.')
  const records = await response.json()
  return Array.isArray(records)
    ? records.map((record) => ({ code: record.code ?? '', name: record.name ?? '' }))
    : []
}

function toManilaDateTimeInput(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`
}

function manilaDateTimeToIso(value) {
  if (!value) return ''
  const date = new Date(`${value}:00+08:00`)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString()
}

function isArchivedAssignment(assignment) {
  return String(assignment?.status ?? '').trim().toLowerCase() === 'archived'
}

function getAssignmentAcademicYear(assignment = {}) {
  const id = assignment.academicYearId ?? assignment.yearId ?? assignment.academicYear
  const label =
    assignment.academicYear ??
    assignment.academicYearName ??
    assignment.yearName ??
    'Academic Year'

  return {
    id: String(id ?? label),
    label: String(label),
  }
}

function formatSchoolAddress(address) {
  if (!address) return 'Not provided'

  return [
    address.addressLine,
    address.barangayName,
    address.cityMunicipalityName,
    address.provinceName,
    address.regionName,
    address.postalCode,
    address.countryCode === 'PH' ? 'Philippines' : address.countryCode,
  ]
    .filter(Boolean)
    .join(', ')
}

function createSchoolProfileDraft(profile = {}) {
  return {
    schoolName: profile.schoolName ?? '',
    contactNumber: profile.contactNumber ?? '',
    email: profile.email ?? '',
    regionCode: profile.address?.regionCode ?? '',
    regionName: profile.address?.regionName ?? '',
    provinceCode: profile.address?.provinceCode ?? '',
    provinceName: profile.address?.provinceName ?? '',
    cityMunicipalityCode: profile.address?.cityMunicipalityCode ?? '',
    cityMunicipalityName: profile.address?.cityMunicipalityName ?? '',
    barangayCode: profile.address?.barangayCode ?? '',
    barangayName: profile.address?.barangayName ?? '',
    addressLine: profile.address?.addressLine ?? '',
    postalCode: profile.address?.postalCode ?? '',
  }
}

function PrincipalSettingsPage({ user, token, scrollTarget = null, onAccountUpdated }) {
  const displayName =
    user.name || [user.firstName, user.middleName, user.lastName].filter(Boolean).join(' ')
  const [activeSettingsTab, setActiveSettingsTab] = useState(
    scrollTarget === 'academic-calendar' ? 'calendar' : 'account',
  )
  const [archivedAssignments, setArchivedAssignments] = useState([])
  const [schoolProfile, setSchoolProfile] = useState(null)
  const [schoolProfileDraft, setSchoolProfileDraft] = useState(
    createSchoolProfileDraft(),
  )
  const [schoolProfileError, setSchoolProfileError] = useState('')
  const [schoolProfileFieldErrors, setSchoolProfileFieldErrors] = useState({})
  const [schoolProfileSuccess, setSchoolProfileSuccess] = useState('')
  const [isEditingSchoolProfile, setIsEditingSchoolProfile] = useState(false)
  const [isSavingSchoolProfile, setIsSavingSchoolProfile] = useState(false)
  const [schoolAddressOptions, setSchoolAddressOptions] = useState({
    regions: [], provinces: [], cities: [], barangays: [],
  })
  const [schoolAddressLoading, setSchoolAddressLoading] = useState('')
  const [schoolAddressError, setSchoolAddressError] = useState('')
  const [academicYears, setAcademicYears] = useState([])
  const [academicCalendarView, setAcademicCalendarView] = useState('current')
  const [academicCalendarError, setAcademicCalendarError] = useState('')
  const [isLoadingAcademicCalendar, setIsLoadingAcademicCalendar] = useState(true)
  const [editingTerm, setEditingTerm] = useState(null)
  const [termDraft, setTermDraft] = useState({ startAt: '', endAt: '', reason: '' })
  const [termEditError, setTermEditError] = useState('')
  const [termEditSuccess, setTermEditSuccess] = useState('')
  const [isSavingTerm, setIsSavingTerm] = useState(false)
  const [archiveEligibility, setArchiveEligibility] = useState({})
  const [checkingArchiveYearId, setCheckingArchiveYearId] = useState('')
  const [archiveYearPending, setArchiveYearPending] = useState(null)
  const [archiveYearReason, setArchiveYearReason] = useState('')
  const [archiveYearError, setArchiveYearError] = useState('')
  const [archiveYearSuccess, setArchiveYearSuccess] = useState('')
  const [isArchivingYear, setIsArchivingYear] = useState(false)
  const [selectedArchiveYearId, setSelectedArchiveYearId] = useState('')
  const [isLoadingArchive, setIsLoadingArchive] = useState(true)
  const [archiveError, setArchiveError] = useState('')
  const [restorePending, setRestorePending] = useState(null)
  const [restoreReason, setRestoreReason] = useState('')
  const [restoreError, setRestoreError] = useState('')
  const [restoreSuccess, setRestoreSuccess] = useState('')
  const [isRestoring, setIsRestoring] = useState(false)
  const archiveYearGroups = useMemo(() => {
    const groups = new Map()

    archivedAssignments.forEach((assignment) => {
      const academicYear = getAssignmentAcademicYear(assignment)

      if (!groups.has(academicYear.id)) {
        groups.set(academicYear.id, {
          ...academicYear,
          assignments: [],
        })
      }

      groups.get(academicYear.id).assignments.push(assignment)
    })

    return Array.from(groups.values()).sort((left, right) =>
      right.label.localeCompare(left.label, undefined, { numeric: true }),
    )
  }, [archivedAssignments])
  const selectedArchiveYear =
    archiveYearGroups.find((group) => group.id === selectedArchiveYearId) ?? null

  const loadArchivedAssignments = useCallback(async () => {
    setIsLoadingArchive(true)
    setArchiveError('')

    try {
      const assignments = await getClassAssignmentsV3(token, '', 'archived')
      setArchivedAssignments(assignments.filter(isArchivedAssignment))
    } catch (loadError) {
      setArchivedAssignments([])

      if (!loadError.isAuthenticationFailure && loadError.status !== 401) {
        setArchiveError(loadError.message || 'Unable to load archived class assignments.')
      }
    } finally {
      setIsLoadingArchive(false)
    }
  }, [token])

  const loadSchoolProfile = useCallback(async () => {
    setSchoolProfileError('')

    try {
      const profile = await getSchoolProfileV3(token)
      setSchoolProfile(profile)
      setSchoolProfileDraft(createSchoolProfileDraft(profile))
    } catch (loadError) {
      setSchoolProfile(null)

      if (!loadError.isAuthenticationFailure) {
        setSchoolProfileError(loadError.message || 'Unable to load the school profile.')
      }
    }
  }, [token])

  const loadAcademicCalendar = useCallback(async () => {
    setIsLoadingAcademicCalendar(true)
    setAcademicCalendarError('')

    try {
      const records = await getAcademicYearsV3(token, academicCalendarView)
      setAcademicYears(records)
    } catch (loadError) {
      setAcademicYears([])

      if (!loadError.isAuthenticationFailure) {
        setAcademicCalendarError(
          loadError.message || 'Unable to load the academic calendar.',
        )
      }
    } finally {
      setIsLoadingAcademicCalendar(false)
    }
  }, [academicCalendarView, token])

  const checkAcademicYearArchive = async (academicYear) => {
    const academicYearId = academicYear.academicYearId ?? academicYear.yearId
    if (!academicYearId) return

    setCheckingArchiveYearId(String(academicYearId))
    setArchiveEligibility((current) => ({
      ...current,
      [academicYearId]: null,
    }))

    try {
      const eligibility = await getAcademicYearArchiveEligibilityV3(academicYearId, token)
      setArchiveEligibility((current) => ({
        ...current,
        [academicYearId]: eligibility,
      }))
    } catch (checkError) {
      if (!checkError.isAuthenticationFailure) {
        setArchiveEligibility((current) => ({
          ...current,
          [academicYearId]: {
            canArchive: false,
            reasons: [checkError.message || 'Unable to check archive readiness.'],
            checkFailed: true,
          },
        }))
      }
    } finally {
      setCheckingArchiveYearId('')
    }
  }

  const openAcademicYearArchive = (academicYear, eligibility) => {
    if (!eligibility?.canArchive) return
    setArchiveYearPending(academicYear)
    setArchiveYearReason('')
    setArchiveYearError('')
  }

  const closeAcademicYearArchive = () => {
    if (isArchivingYear) return
    setArchiveYearPending(null)
    setArchiveYearReason('')
    setArchiveYearError('')
  }

  const confirmAcademicYearArchive = async (event) => {
    event.preventDefault()
    const academicYearId = archiveYearPending?.academicYearId ?? archiveYearPending?.yearId
    const reason = archiveYearReason.trim()
    if (!academicYearId || reason.length < 5 || reason.length > 255) {
      setArchiveYearError('Enter a reason between 5 and 255 characters.')
      return
    }

    setIsArchivingYear(true)
    setArchiveYearError('')
    try {
      await archiveAcademicYearV3(academicYearId, reason, token)
      const yearName = archiveYearPending.yearName || 'School year'
      setArchiveYearPending(null)
      setArchiveYearReason('')
      setArchiveEligibility({})
      setArchiveYearSuccess(`${yearName} archived successfully. It is now read-only.`)
      setAcademicCalendarView('archived')
    } catch (archiveRequestError) {
      setArchiveYearError(
        archiveRequestError.message || 'Unable to archive this school year.',
      )
    } finally {
      setIsArchivingYear(false)
    }
  }

  const handleSchoolProfileChange = (field, value) => {
    setSchoolProfileDraft((current) => ({ ...current, [field]: value }))
    setSchoolProfileFieldErrors((current) => {
      if (!current[field]) return current
      const next = { ...current }
      delete next[field]
      return next
    })
    setSchoolProfileError('')
    setSchoolProfileSuccess('')
  }

  const handleSchoolAddressChange = (level, code) => {
    const optionKey = level === 'cityMunicipality' ? 'cities' : `${level}s`
    const selected = schoolAddressOptions[optionKey].find((option) => option.code === code)
    setSchoolAddressLoading(
      code
        ? level === 'region'
          ? 'provinces'
          : level === 'province'
            ? 'cities'
            : level === 'cityMunicipality'
              ? 'barangays'
              : ''
        : '',
    )
    setSchoolProfileDraft((current) => {
      const next = {
        ...current,
        [`${level}Code`]: code,
        [`${level}Name`]: selected?.name ?? '',
      }
      if (level === 'region') {
        Object.assign(next, { provinceCode: '', provinceName: '', cityMunicipalityCode: '', cityMunicipalityName: '', barangayCode: '', barangayName: '' })
      } else if (level === 'province') {
        Object.assign(next, { cityMunicipalityCode: '', cityMunicipalityName: '', barangayCode: '', barangayName: '' })
      } else if (level === 'cityMunicipality') {
        Object.assign(next, { barangayCode: '', barangayName: '' })
      }
      return next
    })
    setSchoolAddressOptions((current) => {
      if (level === 'region') {
        return { ...current, provinces: [], cities: [], barangays: [] }
      }
      if (level === 'province') {
        return { ...current, cities: [], barangays: [] }
      }
      if (level === 'cityMunicipality') {
        return { ...current, barangays: [] }
      }
      return current
    })
    setSchoolProfileError('')
    setSchoolAddressError('')
  }

  useEffect(() => {
    if (!isEditingSchoolProfile) return undefined
    let active = true
    fetchAddressOptions('/regions/')
      .then((regions) => active && setSchoolAddressOptions((current) => ({ ...current, regions })))
      .catch((error) => active && setSchoolAddressError(error.message))
      .finally(() => active && setSchoolAddressLoading(''))
    return () => { active = false }
  }, [isEditingSchoolProfile])

  useEffect(() => {
    if (!isEditingSchoolProfile || !schoolProfileDraft.regionCode) return undefined
    let active = true
    Promise.all([
      fetchAddressOptions(`/regions/${schoolProfileDraft.regionCode}/provinces/`).catch(() => []),
      fetchAddressOptions(`/regions/${schoolProfileDraft.regionCode}/cities-municipalities/`).catch(() => []),
    ]).then(([provinces, cities]) => {
      if (active) {
        setSchoolAddressOptions((current) => ({
          ...current,
          provinces,
          cities: provinces.length ? [] : cities,
          barangays: [],
        }))
      }
    }).catch((error) => active && setSchoolAddressError(error.message))
      .finally(() => active && setSchoolAddressLoading(''))
    return () => { active = false }
  }, [isEditingSchoolProfile, schoolProfileDraft.regionCode])

  useEffect(() => {
    if (!isEditingSchoolProfile || !schoolProfileDraft.provinceCode) return undefined
    let active = true
    fetchAddressOptions(`/provinces/${schoolProfileDraft.provinceCode}/cities-municipalities/`)
      .then((cities) => active && setSchoolAddressOptions((current) => ({ ...current, cities })))
      .catch((error) => active && setSchoolAddressError(error.message))
      .finally(() => active && setSchoolAddressLoading(''))
    return () => { active = false }
  }, [isEditingSchoolProfile, schoolProfileDraft.provinceCode])

  useEffect(() => {
    if (!isEditingSchoolProfile || !schoolProfileDraft.cityMunicipalityCode) return undefined
    let active = true
    fetchAddressOptions(`/cities-municipalities/${schoolProfileDraft.cityMunicipalityCode}/barangays/`)
      .then((barangays) => active && setSchoolAddressOptions((current) => ({ ...current, barangays })))
      .catch((error) => active && setSchoolAddressError(error.message))
      .finally(() => active && setSchoolAddressLoading(''))
    return () => { active = false }
  }, [isEditingSchoolProfile, schoolProfileDraft.cityMunicipalityCode])

  const openTermEditor = (academicYear, term) => {
    setEditingTerm({
      academicYearId: academicYear.academicYearId ?? academicYear.yearId,
      termPeriodId: term.termPeriodId ?? term.id,
      termName: term.termName,
    })
    setTermDraft({
      startAt: toManilaDateTimeInput(term.startAt),
      endAt: toManilaDateTimeInput(term.endAt),
      reason: '',
    })
    setTermEditError('')
    setTermEditSuccess('')
  }

  const cancelTermEditor = () => {
    if (isSavingTerm) return
    setEditingTerm(null)
    setTermEditError('')
  }

  const saveTermDates = async (event) => {
    event.preventDefault()
    const startAt = manilaDateTimeToIso(termDraft.startAt)
    const endAt = manilaDateTimeToIso(termDraft.endAt)
    const reason = termDraft.reason.trim()

    if (!startAt || !endAt) {
      setTermEditError('Enter complete start and end dates.')
      return
    }
    if (new Date(startAt) >= new Date(endAt)) {
      setTermEditError('The end date must be after the start date.')
      return
    }
    if (reason.length < 5 || reason.length > 255) {
      setTermEditError('Enter a reason between 5 and 255 characters.')
      return
    }

    setIsSavingTerm(true)
    setTermEditError('')
    setTermEditSuccess('')
    try {
      await updateTermPeriodDatesV3(
        editingTerm.academicYearId,
        editingTerm.termPeriodId,
        { startAt, endAt, reason },
        token,
      )
      const updatedTermName = editingTerm.termName
      setEditingTerm(null)
      setTermEditSuccess(`${updatedTermName} dates updated successfully.`)
      await loadAcademicCalendar()
    } catch (saveError) {
      const editCount = Number(saveError.errors?.editCount)
      const maxEdits = Number(saveError.errors?.maxEdits)
      const editLimitMessage = Number.isFinite(editCount) && Number.isFinite(maxEdits)
        ? `This term has used ${editCount} of ${maxEdits} allowed date edits. No edits remain.`
        : 'This term has reached its date-edit limit.'
      const messages = {
        TERM_EDIT_LIMIT_REACHED: editLimitMessage,
        TERM_HAS_ASSESSMENTS_OUTSIDE:
          'The new dates would leave existing assessments outside the term.',
        TERM_PERIOD_LOCKED: 'This term period is locked and cannot be edited.',
        ACADEMIC_YEAR_LOCKED: 'This academic year is locked and cannot be edited.',
      }
      const fieldError =
        saveError.errors?.endAt ||
        saveError.errors?.startAt ||
        saveError.errors?.reason
      setTermEditError(
        fieldError || messages[saveError.code] || saveError.message || 'Unable to update term dates.',
      )
    } finally {
      setIsSavingTerm(false)
    }
  }

  const cancelSchoolProfileEdit = () => {
    if (isSavingSchoolProfile) return
    setSchoolProfileDraft(createSchoolProfileDraft(schoolProfile))
    setSchoolProfileError('')
    setSchoolProfileFieldErrors({})
    setIsEditingSchoolProfile(false)
  }

  const handleSchoolProfileSave = async (event) => {
    event.preventDefault()

    const schoolName = schoolProfileDraft.schoolName.trim()
    const contactNumber = schoolProfileDraft.contactNumber.trim()
    const email = schoolProfileDraft.email.trim()
    const addressLine = schoolProfileDraft.addressLine.trim()

    const fieldErrors = {}
    if (!schoolName) fieldErrors.schoolName = 'School name is required.'
    if (!addressLine) fieldErrors.addressLine = 'Building and street address is required.'

    if (contactNumber && !/^(09\d{9}|\+639\d{9})$/.test(contactNumber)) {
      fieldErrors.contactNumber = 'Use 09XXXXXXXXX or +639XXXXXXXXX.'
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      fieldErrors.email = 'Enter a complete school email address.'
    }

    if (Object.keys(fieldErrors).length) {
      setSchoolProfileFieldErrors(fieldErrors)
      setSchoolProfileError('Review the highlighted school profile fields.')
      return
    }

    const currentAddress = schoolProfile?.address ?? {}
    const payload = {
      schoolName,
      contactNumber: contactNumber || null,
      email: email || null,
      address: {
        regionCode: schoolProfileDraft.regionCode || null,
        regionName: schoolProfileDraft.regionName || null,
        provinceCode: schoolProfileDraft.provinceCode || null,
        provinceName: schoolProfileDraft.provinceName || null,
        cityMunicipalityCode: schoolProfileDraft.cityMunicipalityCode || null,
        cityMunicipalityName: schoolProfileDraft.cityMunicipalityName || null,
        barangayCode: schoolProfileDraft.barangayCode || null,
        barangayName: schoolProfileDraft.barangayName || null,
        addressLine,
        postalCode: schoolProfileDraft.postalCode.trim() || null,
        addressSource: currentAddress.addressSource || 'manual',
      },
    }

    setIsSavingSchoolProfile(true)
    setSchoolProfileError('')
    setSchoolProfileFieldErrors({})
    setSchoolProfileSuccess('')

    try {
      const updatedProfile = await updateSchoolProfileV3(payload, token)
      setSchoolProfile(updatedProfile)
      setSchoolProfileDraft(createSchoolProfileDraft(updatedProfile))
      setIsEditingSchoolProfile(false)
      setSchoolProfileSuccess('School profile updated successfully.')
    } catch (saveError) {
      const fieldAliases = {
        schoolName: 'schoolName',
        contactNumber: 'contactNumber',
        email: 'email',
        'address.addressLine': 'addressLine',
        'address.postalCode': 'postalCode',
      }
      const backendFieldErrors = Object.entries(saveError.errors ?? {}).reduce(
        (errors, [key, message]) => {
          const field = fieldAliases[key]
          if (field && typeof message === 'string') errors[field] = message
          return errors
        },
        {},
      )
      setSchoolProfileFieldErrors(backendFieldErrors)
      setSchoolProfileError(
        Object.keys(backendFieldErrors).length
          ? 'Review the highlighted school profile fields.'
          : saveError.message || 'Unable to update the school profile.',
      )
    } finally {
      setIsSavingSchoolProfile(false)
    }
  }

  useEffect(() => {
    loadArchivedAssignments()
    loadSchoolProfile()
    loadAcademicCalendar()
  }, [loadAcademicCalendar, loadArchivedAssignments, loadSchoolProfile])

  useEffect(() => {
    if (scrollTarget !== 'academic-calendar') return
    setActiveSettingsTab('calendar')
  }, [scrollTarget])

  const openRestoreDialog = (assignment) => {
    setRestorePending(assignment)
    setRestoreReason('')
    setRestoreError('')
    setRestoreSuccess('')
  }

  const closeRestoreDialog = () => {
    if (isRestoring) return

    setRestorePending(null)
    setRestoreReason('')
    setRestoreError('')
  }

  const handleRestoreAssignment = async (event) => {
    event.preventDefault()

    const normalizedReason = restoreReason.trim()

    if (!restorePending || normalizedReason.length < 5 || normalizedReason.length > 255) {
      setRestoreError('Enter a reason between 5 and 255 characters.')
      return
    }

    setIsRestoring(true)
    setRestoreError('')

    try {
      await reactivateClassAssignmentV3(
        restorePending.classAssignmentId ?? restorePending.id,
        normalizedReason,
        token,
      )
      setRestorePending(null)
      setRestoreReason('')
      setRestoreSuccess('Class assignment restored successfully.')
      await loadArchivedAssignments()
    } catch (restoreRequestError) {
      setRestoreError(
        restoreRequestError.message || 'Unable to restore this class assignment.',
      )
    } finally {
      setIsRestoring(false)
    }
  }

  return (
    <div className="content-stack principal-settings-page">
      <section className="hero-panel">
        <p className="section-tag">Settings</p>
        <h2>Principal account</h2>
        <p className="supporting-text">
          Manage your account, security, school profile, and academic calendar.
        </p>
      </section>

      <nav className="settings-section-tabs" aria-label="Principal settings sections" role="tablist">
        <button type="button" role="tab" aria-selected={activeSettingsTab === 'account'} className={activeSettingsTab === 'account' ? 'is-active' : ''} onClick={() => setActiveSettingsTab('account')}>
          <UserRound size={17} aria-hidden="true" />
          Account
        </button>
        <button type="button" role="tab" aria-selected={activeSettingsTab === 'security'} className={activeSettingsTab === 'security' ? 'is-active' : ''} onClick={() => setActiveSettingsTab('security')}>
          <ShieldCheck size={17} aria-hidden="true" />
          Security
        </button>
        <button type="button" role="tab" aria-selected={activeSettingsTab === 'school'} className={activeSettingsTab === 'school' ? 'is-active' : ''} onClick={() => setActiveSettingsTab('school')}>
          <School size={17} aria-hidden="true" />
          School
        </button>
        <button type="button" role="tab" aria-selected={activeSettingsTab === 'calendar'} className={activeSettingsTab === 'calendar' ? 'is-active' : ''} onClick={() => setActiveSettingsTab('calendar')}>
          <CalendarDays size={17} aria-hidden="true" />
          Calendar
        </button>
        <button type="button" role="tab" aria-selected={activeSettingsTab === 'archives'} className={activeSettingsTab === 'archives' ? 'is-active' : ''} onClick={() => setActiveSettingsTab('archives')}>
          <Archive size={17} aria-hidden="true" />
          Archives
        </button>
      </nav>

      {/* Same two-column account layout as Teacher settings, minus the logout button
          (the principal sidebar already has one). */}
      <div className="teacher-account-layout is-principal" hidden={activeSettingsTab !== 'account'} role="tabpanel">
        <aside className="teacher-account-summary content-card" aria-label="Account summary">
          <span className="teacher-profile-avatar" aria-hidden="true">
            {(displayName || user.email || 'P').slice(0, 1).toUpperCase()}
          </span>
          <div>
            <p className="content-card-tag">Signed in</p>
            <h2>{displayName || 'Principal'}</h2>
            <p>{user.email || 'No email available'}</p>
            <span className="status-pill status-active">Principal</span>
          </div>
        </aside>

        <div className="teacher-account-security">
          <AccountProfilePanel token={token} onAccountUpdated={onAccountUpdated} />
          <AccountContactChangePanel token={token} onAccountUpdated={onAccountUpdated} />
        </div>
      </div>

      <div className="settings-section-content" hidden={activeSettingsTab !== 'security'} role="tabpanel">
        <AccountPasswordPanel token={token} />
        <AccountVerificationPanel token={token} onAccountUpdated={onAccountUpdated} />
        <MfaSecurityPanel token={token} />
      </div>

      <section
        className="content-card principal-school-profile-card settings-section-panel"
        hidden={activeSettingsTab !== 'school'}
        aria-labelledby="schoolProfileTitle"
      >
        <header className="principal-school-profile-header">
          <div className="principal-settings-avatar" aria-hidden="true">
            {(schoolProfile?.schoolName || 'S').slice(0, 1).toUpperCase()}
          </div>
          <div>
            <p className="content-card-tag">School Profile</p>
            <h3 id="schoolProfileTitle">{schoolProfile?.schoolName || 'School profile'}</h3>
          </div>
          {!isEditingSchoolProfile ? (
            <button
              type="button"
              className="secondary-button principal-school-profile-edit"
              onClick={() => {
                setSchoolProfileDraft(createSchoolProfileDraft(schoolProfile))
                setSchoolProfileError('')
                setSchoolProfileFieldErrors({})
                setSchoolProfileSuccess('')
                setSchoolAddressLoading('regions')
                setSchoolAddressError('')
                setIsEditingSchoolProfile(true)
              }}
              disabled={!schoolProfile}
            >
              <Pencil size={16} aria-hidden="true" />
              Edit profile
            </button>
          ) : null}
        </header>

        {schoolProfileError ? (
          <p className="form-message form-message-error" role="alert">
            {schoolProfileError}
          </p>
        ) : null}
        {schoolProfileSuccess ? (
          <p className="form-message form-message-success" role="status">
            {schoolProfileSuccess}
          </p>
        ) : null}

        {isEditingSchoolProfile ? (
          <form className="principal-school-profile-form" onSubmit={handleSchoolProfileSave}>
            <label>
              <span>School name</span>
              <input
                value={schoolProfileDraft.schoolName}
                maxLength="120"
                onChange={(event) => handleSchoolProfileChange('schoolName', event.target.value)}
                required
              />
              {schoolProfileFieldErrors.schoolName ? <small className="principal-school-profile-field-error">{schoolProfileFieldErrors.schoolName}</small> : null}
            </label>
            <label>
              <span>Contact number</span>
              <input
                value={schoolProfileDraft.contactNumber}
                maxLength="20"
                placeholder="09XXXXXXXXX"
                onChange={(event) =>
                  handleSchoolProfileChange('contactNumber', event.target.value)
                }
              />
              {schoolProfileFieldErrors.contactNumber ? <small className="principal-school-profile-field-error">{schoolProfileFieldErrors.contactNumber}</small> : null}
            </label>
            <label>
              <span>School email</span>
              <input
                type="email"
                value={schoolProfileDraft.email}
                maxLength="120"
                onChange={(event) => handleSchoolProfileChange('email', event.target.value)}
              />
              {schoolProfileFieldErrors.email ? <small className="principal-school-profile-field-error">{schoolProfileFieldErrors.email}</small> : null}
            </label>
            <label>
              <span>Region</span>
              <select
                value={schoolProfileDraft.regionCode}
                onChange={(event) => handleSchoolAddressChange('region', event.target.value)}
                disabled={schoolAddressLoading === 'regions'}
              >
                <option value="">Select region</option>
                {schoolAddressOptions.regions.map((option) => <option key={option.code} value={option.code}>{option.name}</option>)}
              </select>
            </label>
            <label>
              <span>Province</span>
              <select
                value={schoolProfileDraft.provinceCode}
                onChange={(event) => handleSchoolAddressChange('province', event.target.value)}
                disabled={!schoolProfileDraft.regionCode || schoolAddressLoading === 'provinces'}
              >
                <option value="">{schoolAddressOptions.provinces.length ? 'Select province' : 'Not applicable'}</option>
                {schoolAddressOptions.provinces.map((option) => <option key={option.code} value={option.code}>{option.name}</option>)}
              </select>
            </label>
            <label>
              <span>City / municipality</span>
              <select
                value={schoolProfileDraft.cityMunicipalityCode}
                onChange={(event) => handleSchoolAddressChange('cityMunicipality', event.target.value)}
                disabled={!schoolProfileDraft.regionCode || schoolAddressLoading === 'cities'}
              >
                <option value="">Select city or municipality</option>
                {schoolAddressOptions.cities.map((option) => <option key={option.code} value={option.code}>{option.name}</option>)}
              </select>
            </label>
            <label>
              <span>Barangay</span>
              <select
                value={schoolProfileDraft.barangayCode}
                onChange={(event) => handleSchoolAddressChange('barangay', event.target.value)}
                disabled={!schoolProfileDraft.cityMunicipalityCode || schoolAddressLoading === 'barangays'}
              >
                <option value="">Select barangay</option>
                {schoolAddressOptions.barangays.map((option) => <option key={option.code} value={option.code}>{option.name}</option>)}
              </select>
            </label>
            <label>
              <span>Postal code</span>
              <input
                value={schoolProfileDraft.postalCode}
                maxLength="10"
                onChange={(event) => handleSchoolProfileChange('postalCode', event.target.value)}
              />
              {schoolProfileFieldErrors.postalCode ? <small className="principal-school-profile-field-error">{schoolProfileFieldErrors.postalCode}</small> : null}
            </label>
            <label className="principal-school-profile-address-line">
              <span>Building and street address</span>
              <input
                value={schoolProfileDraft.addressLine}
                maxLength="255"
                onChange={(event) => handleSchoolProfileChange('addressLine', event.target.value)}
                required
              />
              {schoolProfileFieldErrors.addressLine ? <small className="principal-school-profile-field-error">{schoolProfileFieldErrors.addressLine}</small> : null}
            </label>
            {schoolAddressError ? <p className="form-message form-message-error principal-school-profile-location" role="alert">{schoolAddressError}</p> : null}
            <div className="principal-school-profile-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={cancelSchoolProfileEdit}
                disabled={isSavingSchoolProfile}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="primary-button"
                disabled={isSavingSchoolProfile}
              >
                <Save size={16} aria-hidden="true" />
                {isSavingSchoolProfile ? 'Saving...' : 'Save profile'}
              </button>
            </div>
          </form>
        ) : schoolProfile ? (
          <dl className="principal-school-profile-details">
            <div>
              <dt>Email</dt>
              <dd>{schoolProfile.email || 'Not provided'}</dd>
            </div>
            <div>
              <dt>Contact number</dt>
              <dd>{schoolProfile.contactNumber || 'Not provided'}</dd>
            </div>
            <div className="principal-school-profile-address-line">
              <dt>Address</dt>
              <dd>{formatSchoolAddress(schoolProfile.address)}</dd>
            </div>
          </dl>
        ) : null}
      </section>

      <section
        id="academicCalendarSection"
        className="content-card principal-academic-calendar-card settings-section-panel"
        hidden={activeSettingsTab !== 'calendar'}
        aria-labelledby="academicCalendarTitle"
      >
        <header className="principal-academic-calendar-header">
          <span className="principal-archive-icon" aria-hidden="true">
            <CalendarDays size={19} strokeWidth={2.2} />
          </span>
          <div>
            <p className="content-card-tag">Academic Calendar</p>
            <h3 id="academicCalendarTitle">School year and term periods</h3>
          </div>
          <div className="principal-academic-calendar-actions">
            <div className="principal-academic-calendar-tabs" aria-label="Academic year view">
              <button
                type="button"
                className={academicCalendarView === 'current' ? 'is-active' : ''}
                aria-pressed={academicCalendarView === 'current'}
                onClick={() => setAcademicCalendarView('current')}
              >
                Current
              </button>
              <button
                type="button"
                className={academicCalendarView === 'archived' ? 'is-active' : ''}
                aria-pressed={academicCalendarView === 'archived'}
                onClick={() => setAcademicCalendarView('archived')}
              >
                Archived
              </button>
            </div>
            <button
              type="button"
              className="principal-archive-refresh"
              onClick={loadAcademicCalendar}
              disabled={isLoadingAcademicCalendar}
            >
              <RefreshCw size={16} strokeWidth={2.2} aria-hidden="true" />
              <span>Refresh</span>
            </button>
          </div>
        </header>

        {academicCalendarError ? (
          <p className="form-message form-message-error" role="alert">
            {academicCalendarError}
          </p>
        ) : null}

        {termEditSuccess ? (
          <p className="form-message form-message-success" role="status">
            {termEditSuccess}
          </p>
        ) : null}

        {archiveYearSuccess ? (
          <p className="form-message form-message-success" role="status">
            {archiveYearSuccess}
          </p>
        ) : null}

        {isLoadingAcademicCalendar ? (
          <div className="principal-archive-empty">Loading academic calendar...</div>
        ) : academicYears.length ? (
          <div className="principal-academic-year-list">
            {academicYears.map((academicYear) => {
              const termPeriods = [...(academicYear.termPeriods ?? [])].sort(
                (left, right) => Number(left.termOrder ?? 0) - Number(right.termOrder ?? 0),
              )
              const threeTermCalendar = isThreeTermCalendar(termPeriods)
              const academicYearId = academicYear.academicYearId ?? academicYear.yearId
              const eligibility = archiveEligibility[academicYearId]
              const isCheckingEligibility =
                String(checkingArchiveYearId) === String(academicYearId)

              return (
                <article
                  className="principal-academic-year"
                  key={academicYear.academicYearId ?? academicYear.yearName}
                >
                  <div className="principal-academic-year-summary">
                    <div>
                      <span>Academic year</span>
                      <strong>{academicYear.yearName || 'Academic Year'}</strong>
                    </div>
                    <div>
                      <span>School year dates</span>
                      <strong>
                        {formatAcademicYearDate(academicYear.startDate)} -{' '}
                        {formatAcademicYearDate(academicYear.endDate)}
                      </strong>
                    </div>
                    <span className={`status-pill status-${academicYear.status || 'inactive'}`}>
                      {academicYear.status || 'Status unavailable'}
                    </span>
                    {academicYear.status === 'completed' ? (
                      <button
                        type="button"
                        className="principal-archive-refresh"
                        onClick={() => checkAcademicYearArchive(academicYear)}
                        disabled={isCheckingEligibility}
                      >
                        <Archive size={15} aria-hidden="true" />
                        {isCheckingEligibility ? 'Checking...' : 'Check archive readiness'}
                      </button>
                    ) : null}
                  </div>

                  {eligibility ? (
                    <div
                      className={`form-message ${
                        eligibility.canArchive
                          ? 'form-message-success'
                          : 'form-message-error'
                      }`}
                      role="status"
                    >
                      <strong>
                        {eligibility.canArchive
                          ? 'Ready to archive.'
                          : eligibility.checkFailed
                            ? 'Readiness check failed.'
                            : 'Not ready to archive.'}
                      </strong>
                      {!eligibility.canArchive && eligibility.reasons.length ? (
                        <span> {eligibility.reasons.join(' ')}</span>
                      ) : null}
                      {!eligibility.checkFailed ? (
                        <dl className="principal-archive-eligibility-details">
                          <div>
                            <dt>Ready date</dt>
                            <dd>{formatAcademicYearDate(eligibility.readyToArchiveOn)}</dd>
                          </div>
                          <div>
                            <dt>Incomplete terms</dt>
                            <dd>{eligibility.incompleteTermCount}</dd>
                          </div>
                          <div>
                            <dt>Open assessments</dt>
                            <dd>{eligibility.openAssessmentCount}</dd>
                          </div>
                          <div>
                            <dt>Pending syncs</dt>
                            <dd>{eligibility.pendingSyncCount}</dd>
                          </div>
                          <div>
                            <dt>Unfinalized results</dt>
                            <dd>{eligibility.unfinalizedResultCount}</dd>
                          </div>
                        </dl>
                      ) : null}
                      {eligibility.canArchive ? (
                        <button
                          type="button"
                          className="assignment-delete-confirm"
                          onClick={() => openAcademicYearArchive(academicYear, eligibility)}
                        >
                          <Archive size={15} aria-hidden="true" />
                          Archive school year
                        </button>
                      ) : null}
                    </div>
                  ) : null}

                  <div
                    className="principal-term-grid"
                    style={{ '--term-count': Math.max(1, termPeriods.length) }}
                  >
                    {termPeriods.map((term) => {
                      const termId = term.termPeriodId ?? term.id
                      const isEditing =
                        String(editingTerm?.termPeriodId) === String(termId) &&
                        String(editingTerm?.academicYearId) === String(academicYearId)

                      return (
                        <div className="principal-term-item" key={termId}>
                          <div className="principal-term-row">
                            <span>{term.termOrder}</span>
                            <div>
                              <strong>{term.termName}</strong>
                              <small>
                                {formatTermDate(term.startAt, { threeTermCalendar })} -{' '}
                                {formatTermDate(term.endAt, {
                                  threeTermCalendar,
                                  exclusiveEnd: true,
                                })}
                              </small>
                            </div>
                            <span className={`status-pill status-${term.status || 'inactive'}`}>
                              {term.status || 'Status unavailable'}
                            </span>
                            <button
                              type="button"
                              className="principal-term-edit"
                              onClick={() => openTermEditor(academicYear, term)}
                              disabled={Boolean(editingTerm) || ['completed', 'archived'].includes(academicYear.status)}
                              title={`Edit ${term.termName} dates`}
                              aria-label={`Edit ${term.termName} dates`}
                            >
                              <Pencil size={15} aria-hidden="true" />
                            </button>
                          </div>

                          {isEditing ? (
                            <form className="principal-term-edit-form" onSubmit={saveTermDates}>
                              <label>
                                <span>Starts (Philippine time)</span>
                                <input
                                  type="datetime-local"
                                  value={termDraft.startAt}
                                  onChange={(event) => {
                                    setTermDraft((current) => ({
                                      ...current,
                                      startAt: event.target.value,
                                    }))
                                    setTermEditError('')
                                  }}
                                  required
                                />
                              </label>
                              <label>
                                <span>Ends (Philippine time)</span>
                                <input
                                  type="datetime-local"
                                  value={termDraft.endAt}
                                  onChange={(event) => {
                                    setTermDraft((current) => ({
                                      ...current,
                                      endAt: event.target.value,
                                    }))
                                    setTermEditError('')
                                  }}
                                  required
                                />
                              </label>
                              <label className="principal-term-edit-reason">
                                <span>Reason</span>
                                <input
                                  value={termDraft.reason}
                                  maxLength={255}
                                  onChange={(event) => {
                                    setTermDraft((current) => ({
                                      ...current,
                                      reason: event.target.value,
                                    }))
                                    setTermEditError('')
                                  }}
                                  placeholder="Reason for changing the term dates"
                                  required
                                />
                              </label>
                              {termEditError ? (
                                <p className="form-message form-message-error" role="alert">
                                  {termEditError}
                                </p>
                              ) : null}
                              <div className="principal-term-edit-actions">
                                <button
                                  type="button"
                                  className="secondary-button"
                                  onClick={cancelTermEditor}
                                  disabled={isSavingTerm}
                                >
                                  <X size={15} aria-hidden="true" />
                                  Cancel
                                </button>
                                <button
                                  type="submit"
                                  className="primary-button"
                                  disabled={isSavingTerm}
                                >
                                  <Save size={15} aria-hidden="true" />
                                  {isSavingTerm ? 'Saving...' : 'Save dates'}
                                </button>
                              </div>
                            </form>
                          ) : null}
                        </div>
                      )
                    })}
                  </div>
                </article>
              )
            })}
          </div>
        ) : (
          <div className="principal-archive-empty">
            {academicCalendarView === 'archived'
              ? 'No archived school years.'
              : 'No current academic calendar is available.'}
          </div>
        )}
      </section>

      <section className="principal-archive-panel settings-section-panel" hidden={activeSettingsTab !== 'archives'} aria-labelledby="archivedAssignmentsTitle">
        <div className="principal-archive-header">
          <div className="principal-archive-heading">
            <span className="principal-archive-icon" aria-hidden="true">
              <Archive size={19} strokeWidth={2.2} />
            </span>
            <div>
              <p className="content-card-tag">Assignment Archive</p>
              <h3 id="archivedAssignmentsTitle">Archived class assignments</h3>
            </div>
          </div>

          <div className="principal-archive-actions">
            <span className="principal-archive-count">
              {isLoadingArchive
                ? 'Loading...'
                : selectedArchiveYear
                  ? `${selectedArchiveYear.assignments.length} archived`
                  : `${archiveYearGroups.length} academic year${archiveYearGroups.length === 1 ? '' : 's'}`}
            </span>
            <button
              type="button"
              className="principal-archive-refresh"
              onClick={loadArchivedAssignments}
              disabled={isLoadingArchive}
            >
              <RefreshCw size={16} strokeWidth={2.2} aria-hidden="true" />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {archiveError ? (
          <p className="form-message form-message-error principal-archive-message" role="alert">
            {archiveError}
          </p>
        ) : null}

        {restoreSuccess ? (
          <p className="form-message form-message-success principal-archive-message" role="status">
            {restoreSuccess}
          </p>
        ) : null}

        {isLoadingArchive ? (
          <div className="principal-archive-empty">Loading archived assignments...</div>
        ) : selectedArchiveYear ? (
          <div className="principal-archive-year-detail">
            <div className="principal-archive-year-detail-header">
              <button
                type="button"
                className="principal-archive-back"
                onClick={() => setSelectedArchiveYearId('')}
              >
                <ArrowLeft size={16} strokeWidth={2.2} aria-hidden="true" />
                Academic years
              </button>
              <div>
                <span>Selected academic year</span>
                <strong>{selectedArchiveYear.label}</strong>
              </div>
            </div>

            <div className="principal-archive-table-wrap">
              <table className="principal-archive-table">
                <thead>
                  <tr>
                    <th>Teacher</th>
                    <th>Class</th>
                    <th>Subject</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedArchiveYear.assignments.map((assignment) => (
                    <tr key={assignment.classAssignmentId ?? assignment.id}>
                      <td>
                        <strong>{assignment.teacherName || 'Teacher unavailable'}</strong>
                      </td>
                      <td>
                        {assignment.gradeLevelName || 'Grade level'} -{' '}
                        {assignment.sectionName || 'Section'}
                      </td>
                      <td>{assignment.subjectName || 'Subject unavailable'}</td>
                      <td>
                        <span className="status-pill status-archived">Archived</span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="principal-archive-restore"
                          onClick={() => openRestoreDialog(assignment)}
                          title="Restore class assignment"
                          aria-label={`Restore ${assignment.teacherName || 'teacher'} assignment`}
                        >
                          <RotateCcw size={16} strokeWidth={2.3} aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : archiveYearGroups.length ? (
          <div className="principal-archive-year-browser">
            <div className="principal-archive-year-browser-heading">
              <span>Academic year</span>
              <span>Archived assignments</span>
            </div>
            <div className="principal-archive-year-list">
              {archiveYearGroups.map((group) => (
                <button
                  type="button"
                  className="principal-archive-year-row"
                  key={group.id}
                  onClick={() => setSelectedArchiveYearId(group.id)}
                >
                  <span className="principal-archive-year-icon" aria-hidden="true">
                    <CalendarDays size={18} strokeWidth={2.2} />
                  </span>
                  <strong>{group.label}</strong>
                  <span>
                    {group.assignments.length} assignment{group.assignments.length === 1 ? '' : 's'}
                  </span>
                  <ChevronRight size={18} strokeWidth={2.2} aria-hidden="true" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="principal-archive-empty">No archived class assignments.</div>
        )}
      </section>

      {archiveYearPending ? (
        <div
          className="assignment-delete-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeAcademicYearArchive()
          }}
        >
          <section
            className="assignment-delete-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="archiveAcademicYearTitle"
          >
            <header className="assignment-delete-header">
              <span className="assignment-delete-warning" aria-hidden="true">
                <Archive size={21} />
              </span>
              <div>
                <p>Final school-year archive</p>
                <h3 id="archiveAcademicYearTitle">
                  Archive {archiveYearPending.yearName || 'this school year'}?
                </h3>
              </div>
              <button
                type="button"
                className="assignment-delete-close"
                onClick={closeAcademicYearArchive}
                disabled={isArchivingYear}
                aria-label="Close school-year archive dialog"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </header>
            <div className="assignment-delete-body">
              <p className="assignment-delete-instruction">
                This action is final. The school year and its records remain available in reports
                and the Archived tab, but the school year cannot be restored.
              </p>
              <form onSubmit={confirmAcademicYearArchive}>
                <label htmlFor="archiveAcademicYearReason">Reason for archiving</label>
                <textarea
                  id="archiveAcademicYearReason"
                  className="assignment-restore-reason"
                  value={archiveYearReason}
                  onChange={(event) => {
                    setArchiveYearReason(event.target.value)
                    setArchiveYearError('')
                  }}
                  minLength="5"
                  maxLength="255"
                  rows="3"
                  required
                  disabled={isArchivingYear}
                  autoFocus
                />
                <span className="assignment-restore-reason-count">
                  {archiveYearReason.length}/255
                </span>
                {archiveYearError ? (
                  <p className="form-message form-message-error" role="alert">
                    {archiveYearError}
                  </p>
                ) : null}
                <div className="assignment-delete-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={closeAcademicYearArchive}
                    disabled={isArchivingYear}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="assignment-delete-confirm"
                    disabled={
                      isArchivingYear ||
                      archiveYearReason.trim().length < 5 ||
                      archiveYearReason.trim().length > 255
                    }
                  >
                    <Archive size={16} aria-hidden="true" />
                    {isArchivingYear ? 'Archiving...' : 'Archive permanently'}
                  </button>
                </div>
              </form>
            </div>
          </section>
        </div>
      ) : null}

      {restorePending ? (
        <div
          className="assignment-delete-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeRestoreDialog()
          }}
        >
          <section
            className="assignment-delete-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="restoreAssignmentTitle"
          >
            <header className="assignment-delete-header assignment-confirm-header">
              <span
                className="assignment-delete-warning assignment-confirm-icon"
                aria-hidden="true"
              >
                <RotateCcw size={21} strokeWidth={2.3} />
              </span>
              <div>
                <p>Restore assignment</p>
                <h3 id="restoreAssignmentTitle">Return this assignment to active?</h3>
              </div>
              <button
                type="button"
                className="assignment-delete-close"
                onClick={closeRestoreDialog}
                disabled={isRestoring}
                aria-label="Close restore assignment dialog"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </header>

            <div className="assignment-delete-body">
              <p className="assignment-confirm-instruction">
                Review the archived assignment before restoring it.
              </p>
              <dl className="assignment-delete-summary assignment-confirm-summary">
                <div>
                  <dt>Teacher</dt>
                  <dd>{restorePending.teacherName || 'Teacher unavailable'}</dd>
                </div>
                <div>
                  <dt>Subject</dt>
                  <dd>{restorePending.subjectName || 'Subject unavailable'}</dd>
                </div>
                <div>
                  <dt>Class</dt>
                  <dd>
                    {restorePending.gradeLevelName || 'Grade level'} -{' '}
                    {restorePending.sectionName || 'Section'}
                  </dd>
                </div>
                <div>
                  <dt>Academic year</dt>
                  <dd>{restorePending.academicYear || 'Academic Year'}</dd>
                </div>
              </dl>

              {restoreError ? (
                <p className="form-message form-message-error" role="alert">
                  {restoreError}
                </p>
              ) : null}

              <form onSubmit={handleRestoreAssignment}>
                <label htmlFor="restoreAssignmentReason">Reason for reactivation</label>
                <textarea
                  id="restoreAssignmentReason"
                  className="assignment-restore-reason"
                  value={restoreReason}
                  onChange={(event) => {
                    setRestoreReason(event.target.value)
                    if (restoreError) setRestoreError('')
                  }}
                  minLength="5"
                  maxLength="255"
                  rows="4"
                  required
                  disabled={isRestoring}
                  placeholder="Enter why this archived assignment should be active again"
                />
                <span className="assignment-restore-reason-count">
                  {restoreReason.length}/255
                </span>
                <div className="assignment-delete-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={closeRestoreDialog}
                    disabled={isRestoring}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="assignment-confirm-submit"
                    disabled={
                      isRestoring ||
                      restoreReason.trim().length < 5 ||
                      restoreReason.trim().length > 255
                    }
                  >
                    <RotateCcw size={16} strokeWidth={2.3} aria-hidden="true" />
                    {isRestoring ? 'Restoring...' : 'Restore assignment'}
                  </button>
                </div>
              </form>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  )
}

export default PrincipalSettingsPage

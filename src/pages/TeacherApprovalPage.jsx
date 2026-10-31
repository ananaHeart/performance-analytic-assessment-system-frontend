import { useEffect, useMemo, useState } from 'react'
import {
  ArrowUpDown,
  Archive,
  CalendarRange,
  GraduationCap,
  Check,
  Eye,
  MapPin,
  Pencil,
  Power,
  RotateCcw,
  ArchiveRestore,
  Search,
  UserRound,
  X,
} from 'lucide-react'
import {
  approveTeacherV3,
  archiveTeacherAccountV3,
  getTeacherAccountV3,
  getTeacherAccountsV3,
  getTeacherRegistrationReferenceDataV3,
  rejectTeacherV3,
  restoreTeacherAccountV3,
  updateTeacherAccountV3,
  updateTeacherAccountStatusV3,
  updateTeacherContractV3,
  updateTeacherDecisionV3,
} from '../api/apiV3Client'

const teacherTabs = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'archived', label: 'Archived' },
]

const teacherSortOptions = [
  { value: 'name-asc', label: 'Name A-Z' },
  { value: 'name-desc', label: 'Name Z-A' },
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
]

function formatDate(dateValue, fallback = 'Not provided') {
  if (!dateValue) {
    return fallback
  }

  const parsedDate = new Date(dateValue)

  if (Number.isNaN(parsedDate.getTime())) {
    return dateValue
  }

  return parsedDate.toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatTeachingExperience(dateValue) {
  if (!dateValue) return 'Not provided'

  const startDate = new Date(dateValue)
  const currentDate = new Date()

  if (Number.isNaN(startDate.getTime()) || startDate > currentDate) {
    return 'Not provided'
  }

  let totalMonths =
    (currentDate.getFullYear() - startDate.getFullYear()) * 12 +
    (currentDate.getMonth() - startDate.getMonth())

  if (currentDate.getDate() < startDate.getDate()) {
    totalMonths -= 1
  }

  const years = Math.floor(totalMonths / 12)
  const months = totalMonths % 12

  if (years === 0) {
    return months === 0 ? 'Less than 1 month' : `${months} month${months === 1 ? '' : 's'}`
  }

  if (months === 0) {
    return `${years} year${years === 1 ? '' : 's'}`
  }

  return `${years} year${years === 1 ? '' : 's'}, ${months} month${months === 1 ? '' : 's'}`
}

function formatAddress(address) {
  if (!address) return 'Not provided'
  if (typeof address === 'string') return address || 'Not provided'

  const parts = [
    address.addressLine ?? address.address_line,
    address.barangayName ?? address.barangay_name,
    address.cityMunicipalityName ?? address.city_municipality_name,
    address.provinceName ?? address.province_name,
    address.regionName ?? address.region_name,
    address.postalCode ?? address.postal_code,
    address.countryName ?? address.country_name ??
      ((address.countryCode ?? address.country_code) === 'PH' ? 'Philippines' : ''),
  ].filter(Boolean)

  return [...new Set(parts)].join(', ') || 'Not provided'
}

function formatStatus(status, fallback = 'Unknown') {
  const value = String(status || '').trim()
  return value
    ? value.replace(/[_-]/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase())
    : fallback
}

function formatTeacherSubjects(subjects) {
  if (!Array.isArray(subjects) || !subjects.length) return 'None listed'
  return subjects.map((subject) => subject.subjectName).filter(Boolean).join(', ') || 'None listed'
}

function toLocalDateInput(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const contractDateToday = new Date()
const contractMinimumDate = new Date(
  contractDateToday.getFullYear(),
  contractDateToday.getMonth(),
  contractDateToday.getDate() + 1,
)
const contractMaximumDate = new Date(
  contractDateToday.getFullYear() + 3,
  contractDateToday.getMonth(),
  contractDateToday.getDate(),
)
const CONTRACT_DATE_MIN = toLocalDateInput(contractMinimumDate)
const CONTRACT_DATE_MAX = toLocalDateInput(contractMaximumDate)

function getApprovalStatus(teacher = {}) {
  const explicitStatus = String(teacher.approvalStatus || '').toLowerCase()
  if (['pending', 'approved', 'rejected'].includes(explicitStatus)) return explicitStatus

  const legacyStatus = String(teacher.status || '').toLowerCase()
  if (legacyStatus === 'active' || legacyStatus === 'approved') return 'approved'
  if (legacyStatus === 'rejected') return 'rejected'
  return 'pending'
}

function getAccountStatus(teacher = {}) {
  const explicitStatus = String(teacher.accountStatus || '').toLowerCase()
  if (['active', 'inactive', 'archived'].includes(explicitStatus)) return explicitStatus

  const legacyStatus = String(teacher.status || '').toLowerCase()
  if (legacyStatus === 'archived') return 'archived'
  if (legacyStatus === 'active') return 'active'
  return 'inactive'
}

function getDisplayAccountStatus(teacher = {}) {
  return getAccountStatus(teacher) === 'active' ? 'active' : 'inactive'
}

function getTeacherTab(teacher = {}) {
  return getAccountStatus(teacher) === 'archived' ? 'archived' : getApprovalStatus(teacher)
}

function getInitials(name) {
  return (
    name
      ?.split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase() || 'T'
  )
}

function TeacherDetail({ label, value, wide = false }) {
  return (
    <div className={`principal-teacher-detail${wide ? ' is-wide' : ''}`}>
      <dt>{label}</dt>
      <dd>{value || 'Not provided'}</dd>
    </div>
  )
}

function createTeacherEditForm(teacher = {}) {
  const address = teacher.address ?? {}
  return {
    firstName: teacher.firstName ?? '',
    middleName: teacher.middleName ?? '',
    lastName: teacher.lastName ?? '',
    suffixId: teacher.suffixId ? String(teacher.suffixId) : '',
    genderId: teacher.genderId ? String(teacher.genderId) : '',
    birthDate: teacher.birthDate ?? '',
    teachingStartMonth: teacher.teachingStartMonth
      ? `${teacher.teachingStartYear}-${String(teacher.teachingStartMonth).padStart(2, '0')}`
      : '',
    majorId: teacher.majorId ? String(teacher.majorId) : '',
    educationalAttainmentId: teacher.educationalAttainmentId
      ? String(teacher.educationalAttainmentId)
      : '',
    countryCode: address.countryCode ?? 'PH',
    regionCode: address.regionCode ?? '',
    regionName: address.regionName ?? '',
    provinceCode: address.provinceCode ?? '',
    provinceName: address.provinceName ?? '',
    cityMunicipalityCode: address.cityMunicipalityCode ?? '',
    cityMunicipalityName: address.cityMunicipalityName ?? '',
    barangayCode: address.barangayCode ?? '',
    barangayName: address.barangayName ?? '',
    addressLine: address.addressLine ?? '',
    postalCode: address.postalCode ?? '',
    reason: '',
  }
}

function TeacherApprovalPage({ token, user }) {
  const [teachers, setTeachers] = useState([])
  const [activeTab, setActiveTab] = useState('pending')
  const [searchTerm, setSearchTerm] = useState('')
  const [sortOrder, setSortOrder] = useState('name-asc')
  const [selectedTeacher, setSelectedTeacher] = useState(null)
  const [pendingAction, setPendingAction] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [activeUserId, setActiveUserId] = useState(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [editForm, setEditForm] = useState(null)
  const [editError, setEditError] = useState('')
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [referenceData, setReferenceData] = useState({
    genders: [],
    suffixes: [],
    majors: [],
    educationalAttainments: [],
  })
  const [statusAction, setStatusAction] = useState(null)
  const [statusReason, setStatusReason] = useState('')
  const [statusError, setStatusError] = useState('')
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
  const [contractForm, setContractForm] = useState(null)
  const [contractError, setContractError] = useState('')
  const [isUpdatingContract, setIsUpdatingContract] = useState(false)
  const [decisionAction, setDecisionAction] = useState(null)
  const [decisionReason, setDecisionReason] = useState('')
  const [decisionError, setDecisionError] = useState('')
  const [isUpdatingDecision, setIsUpdatingDecision] = useState(false)
  const [archiveAction, setArchiveAction] = useState(null)
  const [archiveReason, setArchiveReason] = useState('')
  const [archiveError, setArchiveError] = useState('')
  const [isUpdatingArchive, setIsUpdatingArchive] = useState(false)
  const accessToken = token
  const hasPrincipalAccess = user?.role === 'principal'

  const teachersWithLabels = useMemo(
    () =>
      teachers.map((teacher) => ({
        ...teacher,
        genderLabel: teacher.genderName || 'Not provided',
        majorLabel: teacher.majorName || 'Not provided',
        educationalAttainmentLabel: teacher.educationalAttainmentName || 'Not provided',
      })),
    [teachers],
  )

  const tabCounts = useMemo(
    () =>
      teacherTabs.reduce((counts, tab) => {
        counts[tab.key] = teachersWithLabels.filter(
          (teacher) => getTeacherTab(teacher) === tab.key,
        ).length
        return counts
      }, {}),
    [teachersWithLabels],
  )

  const visibleTeachers = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()

    const filteredTeachers = teachersWithLabels.filter((teacher) => {
      if (getTeacherTab(teacher) !== activeTab) {
        return false
      }

      if (!normalizedSearch) {
        return true
      }

      return [
        teacher.name,
        teacher.email,
        teacher.contactNumber,
        teacher.majorLabel,
        teacher.educationalAttainmentLabel,
      ].some((value) => String(value || '').toLowerCase().includes(normalizedSearch))
    })

    return filteredTeachers.sort((left, right) => {
      if (sortOrder === 'name-asc' || sortOrder === 'name-desc') {
        const comparison = String(left.name || '').localeCompare(String(right.name || ''), 'en', {
          sensitivity: 'base',
        })
        return sortOrder === 'name-desc' ? -comparison : comparison
      }

      const leftDate = new Date(left.createdAt || 0).getTime()
      const rightDate = new Date(right.createdAt || 0).getTime()
      return sortOrder === 'oldest' ? leftDate - rightDate : rightDate - leftDate
    })
  }, [activeTab, searchTerm, sortOrder, teachersWithLabels])

  const loadTeachers = async ({ preserveSuccess = false } = {}) => {
    if (!hasPrincipalAccess) {
      setTeachers([])
      setError('')
      setSuccess('')
      setIsLoading(false)
      return
    }

    if (!accessToken) {
      setTeachers([])
      setSuccess('')
      setError('')
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError('')

    if (!preserveSuccess) {
      setSuccess('')
    }

    const teacherResult = await Promise.allSettled([
      getTeacherAccountsV3(accessToken, 'pending'),
      getTeacherAccountsV3(accessToken, 'approved'),
      getTeacherAccountsV3(accessToken, 'rejected'),
      getTeacherAccountsV3(accessToken, 'archived'),
    ])

    const failedResult = teacherResult.find((result) => result.status === 'rejected')

    if (!failedResult) {
      setTeachers(teacherResult.flatMap((result) => result.value))
    } else {
      setTeachers([])

      if (
        !failedResult.reason?.isAuthenticationFailure &&
        failedResult.reason?.status !== 401
      ) {
        setError(failedResult.reason?.message || 'Unable to load teacher accounts.')
      }
    }

    setIsLoading(false)
  }

  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  useEffect(() => {
    loadTeachers()
  }, [hasPrincipalAccess, accessToken])
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  const openTeacherDetails = async (teacher) => {
    if (!teacher?.userId || !accessToken) return

    setSelectedTeacher(teacher)
    setIsLoadingDetail(true)
    setDetailError('')

    try {
      const detail = await getTeacherAccountV3(teacher.userId, accessToken)
      setSelectedTeacher({
        ...detail,
        genderLabel: detail.genderName || 'Not provided',
        majorLabel: detail.majorName || 'Not provided',
        educationalAttainmentLabel: detail.educationalAttainmentName || 'Not provided',
      })
    } catch (loadError) {
      if (!loadError.isAuthenticationFailure) {
        setDetailError(loadError.message || 'Unable to load the teacher profile.')
      }
    } finally {
      setIsLoadingDetail(false)
    }
  }

  const openTeacherAction = (action, teacher) => {
    setPendingAction({ action, teacher })
    setRejectionReason('')
    setError('')
  }

  const openTeacherEdit = async () => {
    if (!selectedTeacher || getAccountStatus(selectedTeacher) === 'archived') return
    setEditForm(createTeacherEditForm(selectedTeacher))
    setEditError('')

    if (!referenceData.genders.length) {
      try {
        const data = await getTeacherRegistrationReferenceDataV3()
        setReferenceData(data)
      } catch (loadError) {
        setEditError(loadError.message || 'Unable to load teacher field options.')
      }
    }
  }

  const updateEditField = (field, value) => {
    setEditForm((current) => ({ ...current, [field]: value }))
    if (editError) setEditError('')
  }

  const handleSaveTeacherEdit = async (event) => {
    event.preventDefault()
    if (!editForm || !selectedTeacher?.userId || !accessToken) return

    const requiredValues = [
      editForm.firstName,
      editForm.lastName,
      editForm.genderId,
      editForm.birthDate,
      editForm.teachingStartMonth,
      editForm.majorId,
      editForm.educationalAttainmentId,
      editForm.cityMunicipalityName,
      editForm.barangayName,
      editForm.addressLine,
    ]
    if (requiredValues.some((value) => !String(value || '').trim())) {
      setEditError('Complete all required fields before saving.')
      return
    }
    if (!/^\d{4}$/.test(editForm.postalCode.trim())) {
      setEditError('Postal code must contain exactly 4 digits.')
      return
    }

    const [teachingStartYear, teachingStartMonth] = editForm.teachingStartMonth.split('-').map(Number)
    const payload = {
      firstName: editForm.firstName.trim(),
      middleName: editForm.middleName.trim() || null,
      lastName: editForm.lastName.trim(),
      suffixId: editForm.suffixId ? Number(editForm.suffixId) : null,
      genderId: Number(editForm.genderId),
      birthDate: editForm.birthDate,
      teachingStartMonth,
      teachingStartYear,
      majorId: Number(editForm.majorId),
      educationalAttainmentId: Number(editForm.educationalAttainmentId),
      address: {
        countryCode: editForm.countryCode || 'PH',
        regionCode: editForm.regionCode || null,
        regionName: editForm.regionName || null,
        provinceCode: editForm.provinceCode || null,
        provinceName: editForm.provinceName || null,
        cityMunicipalityCode: editForm.cityMunicipalityCode || null,
        cityMunicipalityName: editForm.cityMunicipalityName.trim(),
        barangayCode: editForm.barangayCode || null,
        barangayName: editForm.barangayName.trim(),
        addressLine: editForm.addressLine.trim(),
        postalCode: editForm.postalCode.trim(),
      },
      reason: editForm.reason.trim() || null,
    }

    setIsSavingEdit(true)
    setEditError('')
    try {
      const updatedTeacher = await updateTeacherAccountV3(selectedTeacher.userId, payload, accessToken)
      setSelectedTeacher({
        ...updatedTeacher,
        genderLabel: updatedTeacher.genderName || 'Not provided',
        majorLabel: updatedTeacher.majorName || 'Not provided',
        educationalAttainmentLabel: updatedTeacher.educationalAttainmentName || 'Not provided',
      })
      setEditForm(null)
      setSuccess('Teacher details updated successfully.')
      await loadTeachers({ preserveSuccess: true })
    } catch (updateError) {
      setEditError(updateError.message || 'Unable to update teacher details.')
    } finally {
      setIsSavingEdit(false)
    }
  }

  const openStatusAction = () => {
    if (!selectedTeacher || getApprovalStatus(selectedTeacher) !== 'approved') return
    const currentStatus = getAccountStatus(selectedTeacher)
    if (!['active', 'inactive'].includes(currentStatus)) return
    setStatusAction(currentStatus === 'active' ? 'inactive' : 'active')
    setStatusReason('')
    setStatusError('')
  }

  const handleConfirmStatus = async () => {
    const reason = statusReason.trim()
    if (!selectedTeacher?.userId || !statusAction || !accessToken) return
    if (reason.length < 5 || reason.length > 255) {
      setStatusError('Enter a reason between 5 and 255 characters.')
      return
    }

    setIsUpdatingStatus(true)
    setStatusError('')
    try {
      const updatedTeacher = await updateTeacherAccountStatusV3(
        selectedTeacher.userId,
        statusAction,
        reason,
        accessToken,
      )
      setSelectedTeacher({
        ...updatedTeacher,
        genderLabel: updatedTeacher.genderName || 'Not provided',
        majorLabel: updatedTeacher.majorName || 'Not provided',
        educationalAttainmentLabel: updatedTeacher.educationalAttainmentName || 'Not provided',
      })
      setStatusAction(null)
      setStatusReason('')
      setSuccess(`Teacher account ${statusAction === 'active' ? 'activated' : 'deactivated'} successfully.`)
      await loadTeachers({ preserveSuccess: true })
    } catch (updateError) {
      setStatusError(updateError.message || 'Unable to change the teacher account status.')
    } finally {
      setIsUpdatingStatus(false)
    }
  }

  const openContractAction = () => {
    if (!selectedTeacher || getApprovalStatus(selectedTeacher) !== 'approved') return
    if (!['active', 'inactive'].includes(getAccountStatus(selectedTeacher))) return
    setContractForm({
      contractEndDate: selectedTeacher.contractEndDate ?? '',
      reason: '',
    })
    setContractError('')
  }

  const handleConfirmContract = async (event) => {
    event.preventDefault()
    if (!selectedTeacher?.userId || !contractForm || !accessToken) return

    const reason = contractForm.reason.trim()
    const today = new Date()
    const maximumDate = new Date(today.getFullYear() + 3, today.getMonth(), today.getDate())
    const selectedDate = new Date(`${contractForm.contractEndDate}T00:00:00`)
    if (
      !contractForm.contractEndDate ||
      Number.isNaN(selectedDate.getTime()) ||
      selectedDate <= new Date(today.getFullYear(), today.getMonth(), today.getDate()) ||
      selectedDate > maximumDate
    ) {
      setContractError('Choose a date after today and at most 3 years from today.')
      return
    }
    if (reason.length < 5 || reason.length > 255) {
      setContractError('Enter a reason between 5 and 255 characters.')
      return
    }

    setIsUpdatingContract(true)
    setContractError('')
    try {
      const updatedTeacher = await updateTeacherContractV3(
        selectedTeacher.userId,
        contractForm.contractEndDate,
        reason,
        accessToken,
      )
      setSelectedTeacher({
        ...updatedTeacher,
        genderLabel: updatedTeacher.genderName || 'Not provided',
        majorLabel: updatedTeacher.majorName || 'Not provided',
        educationalAttainmentLabel: updatedTeacher.educationalAttainmentName || 'Not provided',
      })
      setContractForm(null)
      setSuccess('Teacher contract updated successfully.')
      await loadTeachers({ preserveSuccess: true })
    } catch (updateError) {
      setContractError(updateError.message || 'Unable to update the teacher contract.')
    } finally {
      setIsUpdatingContract(false)
    }
  }

  const openDecisionAction = () => {
    if (!selectedTeacher || getAccountStatus(selectedTeacher) === 'archived') return
    const currentDecision = getApprovalStatus(selectedTeacher)
    if (!['approved', 'rejected'].includes(currentDecision)) return
    setDecisionAction(currentDecision === 'approved' ? 'rejected' : 'approved')
    setDecisionReason('')
    setDecisionError('')
  }

  const handleConfirmDecision = async () => {
    const reason = decisionReason.trim()
    if (!selectedTeacher?.userId || !decisionAction || !accessToken) return
    if (reason.length < 5 || reason.length > 255) {
      setDecisionError('Enter a reason between 5 and 255 characters.')
      return
    }

    setIsUpdatingDecision(true)
    setDecisionError('')
    try {
      const updatedTeacher = await updateTeacherDecisionV3(
        selectedTeacher.userId,
        decisionAction,
        reason,
        accessToken,
      )
      setSelectedTeacher({
        ...updatedTeacher,
        genderLabel: updatedTeacher.genderName || 'Not provided',
        majorLabel: updatedTeacher.majorName || 'Not provided',
        educationalAttainmentLabel: updatedTeacher.educationalAttainmentName || 'Not provided',
      })
      setDecisionAction(null)
      setDecisionReason('')
      setSuccess(`Teacher decision changed to ${decisionAction}.`)
      setActiveTab(decisionAction)
      await loadTeachers({ preserveSuccess: true })
    } catch (updateError) {
      setDecisionError(updateError.message || 'Unable to change the teacher approval decision.')
    } finally {
      setIsUpdatingDecision(false)
    }
  }

  const openArchiveAction = () => {
    if (!selectedTeacher) return
    const action = getAccountStatus(selectedTeacher) === 'archived' ? 'restore' : 'archive'
    if (action === 'archive' && getApprovalStatus(selectedTeacher) !== 'approved') return
    setArchiveAction(action)
    setArchiveReason('')
    setArchiveError('')
  }

  const handleConfirmArchive = async () => {
    const reason = archiveReason.trim()
    if (!selectedTeacher?.userId || !archiveAction || !accessToken) return
    if (reason.length < 5 || reason.length > 255) {
      setArchiveError('Enter a reason between 5 and 255 characters.')
      return
    }

    setIsUpdatingArchive(true)
    setArchiveError('')
    try {
      const updatedTeacher = archiveAction === 'archive'
        ? await archiveTeacherAccountV3(selectedTeacher.userId, reason, accessToken)
        : await restoreTeacherAccountV3(selectedTeacher.userId, reason, accessToken)
      setSelectedTeacher({
        ...updatedTeacher,
        genderLabel: updatedTeacher.genderName || 'Not provided',
        majorLabel: updatedTeacher.majorName || 'Not provided',
        educationalAttainmentLabel: updatedTeacher.educationalAttainmentName || 'Not provided',
      })
      const completedAction = archiveAction
      setArchiveAction(null)
      setArchiveReason('')
      setSuccess(
        completedAction === 'archive'
          ? 'Teacher account archived successfully. Open class assignments ended, while historical results remain available.'
          : 'Teacher account restored successfully. Class assignments were not restored; reassign the teacher to the required classes.',
      )
      setActiveTab(completedAction === 'archive' ? 'archived' : 'approved')
      await loadTeachers({ preserveSuccess: true })
    } catch (updateError) {
      setArchiveError(updateError.message || `Unable to ${archiveAction} the teacher account.`)
    } finally {
      setIsUpdatingArchive(false)
    }
  }

  const handleConfirmAction = async () => {
    if (!pendingAction?.teacher?.userId || !accessToken) {
      return
    }

    const { action, teacher } = pendingAction

    if (action === 'reject') {
      const normalizedReason = rejectionReason.trim()

      if (normalizedReason.length < 5 || normalizedReason.length > 500) {
        setError('Enter a rejection reason between 5 and 500 characters.')
        return
      }
    }

    setActiveUserId(teacher.userId)
    setError('')
    setSuccess('')

    try {
      if (action === 'approve') {
        await approveTeacherV3(teacher.userId, accessToken)
      } else {
        await rejectTeacherV3(teacher.userId, rejectionReason.trim(), accessToken)
      }

      setPendingAction(null)
      setRejectionReason('')
      setSelectedTeacher(null)
      setSuccess(
        `${teacher.name || 'Teacher account'} ${action === 'approve' ? 'approved' : 'rejected'} successfully.`,
      )
      await loadTeachers({ preserveSuccess: true })
    } catch (updateError) {
      if (updateError.status !== 401) {
        setError(updateError.message || `Unable to ${action} the teacher account.`)
      }
    } finally {
      setActiveUserId(null)
    }
  }

  if (!hasPrincipalAccess) {
    return (
      <div className="content-stack">
        <section className="hero-panel">
          <p className="section-tag">Teacher Accounts</p>
          <h2>Principal access is required.</h2>
          <p className="supporting-text">
            Only principal accounts can review and update teacher approval status.
          </p>
        </section>
      </div>
    )
  }

  return (
    <div className="principal-teachers-page">
      <h1 className="teachers-visually-hidden">Teacher accounts</h1>

      <div className="principal-teachers-controls">
        <div className="principal-teacher-tabs" role="tablist" aria-label="Teacher account status">
          {teacherTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.key}
              className={activeTab === tab.key ? 'is-active' : ''}
              onClick={() => setActiveTab(tab.key)}
            >
              <span>{tab.label}</span>
              <span className="principal-teacher-tab-count">{tabCounts[tab.key] ?? 0}</span>
            </button>
          ))}
        </div>

        <div className="principal-teachers-toolbar">
          <label className="principal-teachers-search" htmlFor="teacherSearch">
            <Search size={17} strokeWidth={2.1} aria-hidden="true" />
            <input
              id="teacherSearch"
              type="search"
              aria-label="Search teachers by name, email, phone, or specialization"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search teachers"
            />
          </label>
          <label className="principal-teachers-sort" htmlFor="teacherSortOrder">
            <ArrowUpDown size={16} strokeWidth={2.2} aria-hidden="true" />
            <select
              id="teacherSortOrder"
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value)}
              aria-label="Sort teacher accounts"
            >
              {teacherSortOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {error ? (
        <p className="form-message form-message-error" role="alert" aria-live="polite">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="form-message form-message-success" role="status" aria-live="polite">
          {success}
        </p>
      ) : null}

      <section className="principal-teachers-table-panel">
        <div className="principal-teachers-table-wrap">
          <table className="principal-teachers-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>Registered</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td className="principal-teachers-empty" colSpan={4}>
                    Loading teacher accounts...
                  </td>
                </tr>
              ) : null}

              {!isLoading && !visibleTeachers.length ? (
                <tr>
                  <td className="principal-teachers-empty" colSpan={4}>
                    No teacher accounts match this filter.
                  </td>
                </tr>
              ) : null}

              {!isLoading
                ? visibleTeachers.map((teacher) => {
                    return (
                      <tr key={teacher.userId ?? teacher.email}>
                        <td>
                          <div className="principal-teacher-name-cell">
                            <span aria-hidden="true">{getInitials(teacher.name)}</span>
                            <div>
                              <strong>{teacher.name || 'Teacher'}</strong>
                              <small>{teacher.email || 'No email provided'}</small>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className={`principal-teacher-status status-${getDisplayAccountStatus(teacher)}`}>
                            {formatStatus(getDisplayAccountStatus(teacher))}
                          </span>
                        </td>
                        <td>{formatDate(teacher.createdAt)}</td>
                        <td>
                          <div className="principal-teacher-actions">
                            <button
                              type="button"
                              className="principal-teacher-view-button"
                              onClick={() => openTeacherDetails(teacher)}
                            >
                              <Eye size={15} strokeWidth={2.2} aria-hidden="true" />
                              <span>View details</span>
                            </button>
                            {getApprovalStatus(teacher) === 'pending' ? (
                              <>
                                <button
                                  type="button"
                                  className="principal-reject-button"
                                  onClick={() => openTeacherAction('reject', teacher)}
                                >
                                  <X size={15} strokeWidth={2.3} aria-hidden="true" />
                                  Reject
                                </button>
                                <button
                                  type="button"
                                  className="principal-approve-button"
                                  onClick={() => openTeacherAction('approve', teacher)}
                                >
                                  <Check size={15} strokeWidth={2.3} aria-hidden="true" />
                                  Approve
                                </button>
                              </>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                : null}
            </tbody>
          </table>
        </div>
      </section>

      {selectedTeacher ? (
        <div
          className="principal-teacher-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              getApprovalStatus(selectedTeacher) !== 'pending'
            ) {
              setSelectedTeacher(null)
            }
          }}
        >
          <section
            className="principal-teacher-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="teacherDetailsTitle"
          >
            <header className="principal-teacher-modal-header">
              <div className="principal-teacher-modal-identity">
                <span className="principal-teacher-modal-avatar" aria-hidden="true">
                  {getInitials(selectedTeacher.name)}
                </span>
                <div>
                  <h3 id="teacherDetailsTitle">{selectedTeacher.name || 'Teacher details'}</h3>
                  <p>{selectedTeacher.email || 'No email provided'}</p>
                </div>
                <span className={`principal-teacher-status status-${getDisplayAccountStatus(selectedTeacher)}`}>
                  {formatStatus(getDisplayAccountStatus(selectedTeacher))}
                </span>
              </div>
              {getApprovalStatus(selectedTeacher) !== 'pending' ? (
                <button
                  type="button"
                  className="principal-teacher-modal-close"
                  onClick={() => setSelectedTeacher(null)}
                  aria-label="Close teacher details"
                >
                  <X size={18} strokeWidth={2.2} />
                </button>
              ) : null}
            </header>

            <div className="principal-teacher-detail-sections">
              {detailError ? (
                <p className="form-message form-message-error" role="alert">
                  {detailError}
                </p>
              ) : null}
              {isLoadingDetail ? <p className="supporting-text">Loading teacher profile...</p> : null}
              <section className="principal-teacher-detail-section">
                <header>
                  <UserRound size={18} aria-hidden="true" />
                  <h4>Personal information</h4>
                </header>
                <dl className="principal-teacher-detail-grid">
                  <TeacherDetail label="Gender" value={selectedTeacher.genderLabel} />
                  <TeacherDetail label="Birth date" value={formatDate(selectedTeacher.birthDate)} />
                </dl>
              </section>

              <section className="principal-teacher-detail-section">
                <header>
                  <GraduationCap size={19} aria-hidden="true" />
                  <h4>Professional background</h4>
                </header>
                <dl className="principal-teacher-detail-grid">
                  <TeacherDetail label="Major" value={selectedTeacher.majorLabel} />
                  <TeacherDetail
                    label="Educational attainment"
                    value={selectedTeacher.educationalAttainmentLabel}
                  />
                  <TeacherDetail
                    label="Years of teaching"
                    value={formatTeachingExperience(selectedTeacher.teachingStartDate)}
                  />
                  <TeacherDetail
                    label="Registration date"
                    value={formatDate(selectedTeacher.createdAt)}
                  />
                  <TeacherDetail
                    label="Contract end date"
                    value={formatDate(selectedTeacher.contractEndDate)}
                  />
                  <TeacherDetail
                    label="Additional majors"
                    value={formatTeacherSubjects(selectedTeacher.subjects?.additionalMajors)}
                    wide
                  />
                  <TeacherDetail
                    label="Subjects taught before"
                    value={formatTeacherSubjects(selectedTeacher.subjects?.subjectsTaughtBefore)}
                    wide
                  />
                </dl>
              </section>

              <section className="principal-teacher-detail-section">
                <header>
                  <MapPin size={18} aria-hidden="true" />
                  <h4>Contact and address</h4>
                </header>
                <dl className="principal-teacher-detail-grid">
                  <TeacherDetail label="Email address" value={selectedTeacher.email} />
                  <TeacherDetail label="Contact number" value={selectedTeacher.contactNumber} />
                  <TeacherDetail
                    label="Registered address"
                    value={formatAddress(selectedTeacher.address)}
                    wide
                  />
                </dl>
              </section>
            </div>

            <footer className="principal-teacher-modal-footer">
              <div className="principal-teacher-modal-actions">
                {getApprovalStatus(selectedTeacher) !== 'pending' &&
                getAccountStatus(selectedTeacher) !== 'archived' ? (
                  <button
                    type="button"
                    className="principal-teacher-edit-button"
                    onClick={openTeacherEdit}
                    disabled={isLoadingDetail}
                  >
                    <Pencil size={15} strokeWidth={2.2} aria-hidden="true" />
                    Edit details
                  </button>
                ) : null}
                {getApprovalStatus(selectedTeacher) === 'approved' &&
                ['active', 'inactive'].includes(getAccountStatus(selectedTeacher)) ? (
                  <button
                    type="button"
                    className="principal-teacher-contract-button"
                    onClick={openContractAction}
                    disabled={isLoadingDetail}
                  >
                    <CalendarRange size={15} strokeWidth={2.2} aria-hidden="true" />
                    Contract
                  </button>
                ) : null}
                {getAccountStatus(selectedTeacher) !== 'archived' &&
                ['approved', 'rejected'].includes(getApprovalStatus(selectedTeacher)) ? (
                  <button
                    type="button"
                    className="principal-teacher-decision-button"
                    onClick={openDecisionAction}
                    disabled={isLoadingDetail}
                  >
                    <RotateCcw size={15} strokeWidth={2.2} aria-hidden="true" />
                    Reverse decision
                  </button>
                ) : null}
                {(getAccountStatus(selectedTeacher) === 'archived' ||
                  getApprovalStatus(selectedTeacher) === 'approved') ? (
                  <button
                    type="button"
                    className={`principal-teacher-archive-button is-${
                      getAccountStatus(selectedTeacher) === 'archived' ? 'restore' : 'archive'
                    }`}
                    onClick={openArchiveAction}
                    disabled={isLoadingDetail}
                  >
                    {getAccountStatus(selectedTeacher) === 'archived' ? (
                      <ArchiveRestore size={15} strokeWidth={2.2} aria-hidden="true" />
                    ) : (
                      <Archive size={15} strokeWidth={2.2} aria-hidden="true" />
                    )}
                    {getAccountStatus(selectedTeacher) === 'archived' ? 'Restore' : 'Archive'}
                  </button>
                ) : null}
                {getApprovalStatus(selectedTeacher) === 'approved' &&
                ['active', 'inactive'].includes(getAccountStatus(selectedTeacher)) ? (
                  <button
                    type="button"
                    className={`principal-teacher-status-button is-${
                      getAccountStatus(selectedTeacher) === 'active' ? 'deactivate' : 'activate'
                    }`}
                    onClick={openStatusAction}
                    disabled={isLoadingDetail}
                  >
                    <Power size={15} strokeWidth={2.2} aria-hidden="true" />
                    {getAccountStatus(selectedTeacher) === 'active' ? 'Deactivate' : 'Activate'}
                  </button>
                ) : null}
                {getApprovalStatus(selectedTeacher) === 'pending' ? (
                  <button
                    type="button"
                    className="principal-teacher-cancel-button"
                    onClick={() => setSelectedTeacher(null)}
                  >
                    Cancel
                  </button>
                ) : null}
              </div>
            </footer>
          </section>
        </div>
      ) : null}

      {editForm ? (
        <div className="principal-teacher-modal-backdrop" role="presentation">
          <section
            className="principal-teacher-modal principal-teacher-edit-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="teacherEditTitle"
          >
            <header className="principal-teacher-modal-header">
              <div>
                <h3 id="teacherEditTitle">Edit teacher details</h3>
              </div>
              <button
                type="button"
                className="principal-teacher-modal-close"
                onClick={() => setEditForm(null)}
                aria-label="Close teacher edit form"
                disabled={isSavingEdit}
              >
                <X size={18} strokeWidth={2.2} />
              </button>
            </header>

            <form className="principal-teacher-edit-form" onSubmit={handleSaveTeacherEdit}>
              <div className="principal-teacher-edit-grid">
                <label><span>First name *</span><input value={editForm.firstName} onChange={(event) => updateEditField('firstName', event.target.value)} maxLength="50" required /></label>
                <label><span>Middle name</span><input value={editForm.middleName} onChange={(event) => updateEditField('middleName', event.target.value)} maxLength="50" /></label>
                <label><span>Last name *</span><input value={editForm.lastName} onChange={(event) => updateEditField('lastName', event.target.value)} maxLength="50" required /></label>
                <label><span>Suffix</span><select value={editForm.suffixId} onChange={(event) => updateEditField('suffixId', event.target.value)}><option value="">None</option>{referenceData.suffixes.map((item) => <option key={item.suffixId} value={item.suffixId}>{item.suffixName}</option>)}</select></label>
                <label><span>Gender *</span><select value={editForm.genderId} onChange={(event) => updateEditField('genderId', event.target.value)} required><option value="">Select gender</option>{referenceData.genders.map((item) => <option key={item.genderId} value={item.genderId}>{item.genderName}</option>)}</select></label>
                <label><span>Birth date *</span><input type="date" value={editForm.birthDate} onChange={(event) => updateEditField('birthDate', event.target.value)} required /></label>
                <label><span>Teaching start *</span><input type="month" value={editForm.teachingStartMonth} onChange={(event) => updateEditField('teachingStartMonth', event.target.value)} required /></label>
                <label><span>Major *</span><select value={editForm.majorId} onChange={(event) => updateEditField('majorId', event.target.value)} required><option value="">Select major</option>{referenceData.majors.map((item) => <option key={item.majorId} value={item.majorId}>{item.majorName}</option>)}</select></label>
                <label><span>Educational attainment *</span><select value={editForm.educationalAttainmentId} onChange={(event) => updateEditField('educationalAttainmentId', event.target.value)} required><option value="">Select attainment</option>{referenceData.educationalAttainments.map((item) => <option key={item.educationalAttainmentId} value={item.educationalAttainmentId}>{item.educationalAttainmentName}</option>)}</select></label>
                <label><span>Region</span><input value={editForm.regionName} onChange={(event) => updateEditField('regionName', event.target.value)} /></label>
                <label><span>Province</span><input value={editForm.provinceName} onChange={(event) => updateEditField('provinceName', event.target.value)} /></label>
                <label><span>City / municipality *</span><input value={editForm.cityMunicipalityName} onChange={(event) => updateEditField('cityMunicipalityName', event.target.value)} required /></label>
                <label><span>Barangay *</span><input value={editForm.barangayName} onChange={(event) => updateEditField('barangayName', event.target.value)} required /></label>
                <label className="is-wide"><span>Street / address line *</span><input value={editForm.addressLine} onChange={(event) => updateEditField('addressLine', event.target.value)} required /></label>
                <label><span>Postal code *</span><input inputMode="numeric" value={editForm.postalCode} onChange={(event) => updateEditField('postalCode', event.target.value.replace(/\D/g, '').slice(0, 4))} pattern="\d{4}" required /></label>
                <label className="is-wide"><span>Reason (optional)</span><textarea value={editForm.reason} onChange={(event) => updateEditField('reason', event.target.value)} maxLength="255" rows="2" /></label>
              </div>

              {editError ? <p className="form-message form-message-error" role="alert">{editError}</p> : null}

              <footer className="principal-teacher-edit-actions">
                <button type="button" className="principal-teacher-cancel-button" onClick={() => setEditForm(null)} disabled={isSavingEdit}>Cancel</button>
                <button type="submit" className="principal-approve-button" disabled={isSavingEdit}>{isSavingEdit ? 'Saving...' : 'Save changes'}</button>
              </footer>
            </form>
          </section>
        </div>
      ) : null}

      {statusAction ? (
        <div className="principal-teacher-modal-backdrop" role="presentation">
          <section
            className="principal-teacher-confirmation"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="teacherStatusTitle"
          >
            <span
              className={`principal-teacher-confirmation-icon is-${
                statusAction === 'active' ? 'approve' : 'reject'
              }`}
              aria-hidden="true"
            >
              <Power size={22} strokeWidth={2.3} />
            </span>
            <div>
              <h3 id="teacherStatusTitle">
                {statusAction === 'active' ? 'Activate' : 'Deactivate'} teacher account?
              </h3>
              <p>
                {statusAction === 'active'
                  ? `${selectedTeacher?.name || 'This teacher'} will regain access to the teacher workspace.`
                  : `${selectedTeacher?.name || 'This teacher'} will lose access and active sessions may be revoked.`}
              </p>
            </div>
            <label className="public-auth-field" htmlFor="teacherStatusReason">
              <span>Reason</span>
              <textarea
                id="teacherStatusReason"
                className="assignment-restore-reason"
                value={statusReason}
                onChange={(event) => {
                  setStatusReason(event.target.value)
                  if (statusError) setStatusError('')
                }}
                minLength="5"
                maxLength="255"
                rows="3"
                required
                disabled={isUpdatingStatus}
              />
              <small>{statusReason.trim().length}/255 characters</small>
            </label>
            {statusError ? (
              <p className="form-message form-message-error" role="alert">{statusError}</p>
            ) : null}
            <div className="principal-teacher-confirmation-actions">
              <button
                type="button"
                className="principal-teacher-cancel-button"
                onClick={() => {
                  setStatusAction(null)
                  setStatusReason('')
                  setStatusError('')
                }}
                disabled={isUpdatingStatus}
              >
                Cancel
              </button>
              <button
                type="button"
                className={statusAction === 'active' ? 'principal-approve-button' : 'principal-reject-button'}
                onClick={handleConfirmStatus}
                disabled={isUpdatingStatus || statusReason.trim().length < 5 || statusReason.trim().length > 255}
              >
                {isUpdatingStatus
                  ? 'Updating...'
                  : `${statusAction === 'active' ? 'Activate' : 'Deactivate'} account`}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {contractForm ? (
        <div className="principal-teacher-modal-backdrop" role="presentation">
          <section
            className="principal-teacher-confirmation"
            role="dialog"
            aria-modal="true"
            aria-labelledby="teacherContractTitle"
          >
            <span className="principal-teacher-confirmation-icon is-approve" aria-hidden="true">
              <CalendarRange size={22} strokeWidth={2.3} />
            </span>
            <div>
              <h3 id="teacherContractTitle">Update teacher contract</h3>
              <p>
                Choose a future end date. Updating an expired contract may reactivate an account
                that was automatically disabled when the contract ended.
              </p>
            </div>
            <form className="principal-teacher-contract-form" onSubmit={handleConfirmContract}>
              <label className="public-auth-field" htmlFor="teacherContractEndDate">
                <span>Contract end date</span>
                <input
                  id="teacherContractEndDate"
                  type="date"
                  value={contractForm.contractEndDate}
                  min={CONTRACT_DATE_MIN}
                  max={CONTRACT_DATE_MAX}
                  onChange={(event) => {
                    setContractForm((current) => ({ ...current, contractEndDate: event.target.value }))
                    if (contractError) setContractError('')
                  }}
                  required
                  disabled={isUpdatingContract}
                />
              </label>
              <label className="public-auth-field" htmlFor="teacherContractReason">
                <span>Reason</span>
                <textarea
                  id="teacherContractReason"
                  className="assignment-restore-reason"
                  value={contractForm.reason}
                  onChange={(event) => {
                    setContractForm((current) => ({ ...current, reason: event.target.value }))
                    if (contractError) setContractError('')
                  }}
                  minLength="5"
                  maxLength="255"
                  rows="3"
                  required
                  disabled={isUpdatingContract}
                />
                <small>{contractForm.reason.trim().length}/255 characters</small>
              </label>
              {contractError ? (
                <p className="form-message form-message-error" role="alert">{contractError}</p>
              ) : null}
              <div className="principal-teacher-confirmation-actions">
                <button type="button" className="principal-teacher-cancel-button" onClick={() => setContractForm(null)} disabled={isUpdatingContract}>Cancel</button>
                <button type="submit" className="principal-approve-button" disabled={isUpdatingContract || contractForm.reason.trim().length < 5 || contractForm.reason.trim().length > 255}>
                  {isUpdatingContract ? 'Updating...' : 'Update contract'}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {decisionAction ? (
        <div className="principal-teacher-modal-backdrop" role="presentation">
          <section
            className="principal-teacher-confirmation"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="teacherDecisionTitle"
          >
            <span
              className={`principal-teacher-confirmation-icon is-${
                decisionAction === 'approved' ? 'approve' : 'reject'
              }`}
              aria-hidden="true"
            >
              <RotateCcw size={22} strokeWidth={2.3} />
            </span>
            <div>
              <h3 id="teacherDecisionTitle">
                Change decision to {decisionAction === 'approved' ? 'Approved' : 'Rejected'}?
              </h3>
              <p>
                {decisionAction === 'approved'
                  ? `${selectedTeacher?.name || 'This teacher'} will receive access again. The account becomes active and a new contract may be created.`
                  : `${selectedTeacher?.name || 'This teacher'} will be signed out, and all open class assignments will end.`}
              </p>
            </div>
            <label className="public-auth-field" htmlFor="teacherDecisionReason">
              <span>Reason for reversing the decision</span>
              <textarea
                id="teacherDecisionReason"
                className="assignment-restore-reason"
                value={decisionReason}
                onChange={(event) => {
                  setDecisionReason(event.target.value)
                  if (decisionError) setDecisionError('')
                }}
                minLength="5"
                maxLength="255"
                rows="3"
                required
                disabled={isUpdatingDecision}
              />
              <small>{decisionReason.trim().length}/255 characters</small>
            </label>
            {decisionError ? (
              <p className="form-message form-message-error" role="alert">{decisionError}</p>
            ) : null}
            <div className="principal-teacher-confirmation-actions">
              <button
                type="button"
                className="principal-teacher-cancel-button"
                onClick={() => {
                  setDecisionAction(null)
                  setDecisionReason('')
                  setDecisionError('')
                }}
                disabled={isUpdatingDecision}
              >
                Cancel
              </button>
              <button
                type="button"
                className={decisionAction === 'approved' ? 'principal-approve-button' : 'principal-reject-button'}
                onClick={handleConfirmDecision}
                disabled={isUpdatingDecision || decisionReason.trim().length < 5 || decisionReason.trim().length > 255}
              >
                {isUpdatingDecision
                  ? 'Updating...'
                  : `Change to ${decisionAction === 'approved' ? 'Approved' : 'Rejected'}`}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {archiveAction ? (
        <div className="principal-teacher-modal-backdrop" role="presentation">
          <section
            className="principal-teacher-confirmation"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="teacherArchiveTitle"
          >
            <span
              className={`principal-teacher-confirmation-icon is-${
                archiveAction === 'restore' ? 'approve' : 'reject'
              }`}
              aria-hidden="true"
            >
              {archiveAction === 'restore' ? (
                <ArchiveRestore size={22} strokeWidth={2.3} />
              ) : (
                <Archive size={22} strokeWidth={2.3} />
              )}
            </span>
            <div>
              <h3 id="teacherArchiveTitle">
                {archiveAction === 'restore' ? 'Restore' : 'Archive'} teacher account?
              </h3>
              <p>
                {archiveAction === 'restore'
                  ? `${selectedTeacher?.name || 'This teacher'} will return as active when the contract is valid, or inactive when it has ended. Class assignments are not restored automatically.`
                  : `${selectedTeacher?.name || 'This teacher'} will be signed out and all open class assignments will end. Historical assessment results remain available in reports.`}
              </p>
            </div>
            <label className="public-auth-field" htmlFor="teacherArchiveReason">
              <span>Reason</span>
              <textarea
                id="teacherArchiveReason"
                className="assignment-restore-reason"
                value={archiveReason}
                onChange={(event) => {
                  setArchiveReason(event.target.value)
                  if (archiveError) setArchiveError('')
                }}
                minLength="5"
                maxLength="255"
                rows="3"
                required
                disabled={isUpdatingArchive}
              />
              <small>{archiveReason.trim().length}/255 characters</small>
            </label>
            {archiveError ? (
              <p className="form-message form-message-error" role="alert">{archiveError}</p>
            ) : null}
            <div className="principal-teacher-confirmation-actions">
              <button
                type="button"
                className="principal-teacher-cancel-button"
                onClick={() => {
                  setArchiveAction(null)
                  setArchiveReason('')
                  setArchiveError('')
                }}
                disabled={isUpdatingArchive}
              >
                Cancel
              </button>
              <button
                type="button"
                className={archiveAction === 'restore' ? 'principal-approve-button' : 'principal-reject-button'}
                onClick={handleConfirmArchive}
                disabled={isUpdatingArchive || archiveReason.trim().length < 5 || archiveReason.trim().length > 255}
              >
                {isUpdatingArchive
                  ? 'Updating...'
                  : `${archiveAction === 'restore' ? 'Restore' : 'Archive'} account`}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {pendingAction ? (
        <div className="principal-teacher-modal-backdrop" role="presentation">
          <section
            className="principal-teacher-confirmation"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="teacherActionTitle"
          >
            <span
              className={`principal-teacher-confirmation-icon is-${pendingAction.action}`}
              aria-hidden="true"
            >
              {pendingAction.action === 'approve' ? (
                <Check size={23} strokeWidth={2.4} />
              ) : (
                <X size={23} strokeWidth={2.4} />
              )}
            </span>
            <div>
              <h3 id="teacherActionTitle">
                {pendingAction.action === 'approve' ? 'Approve' : 'Reject'} teacher account?
              </h3>
              <p>
                {pendingAction.action === 'approve'
                  ? `${pendingAction.teacher.name || 'This teacher'} will be allowed to access the teacher workspace.`
                  : `${pendingAction.teacher.name || 'This teacher'} will not be allowed to access the system.`}
              </p>
            </div>
            {pendingAction.action === 'reject' ? (
              <label className="public-auth-field" htmlFor="teacherRejectionReason">
                <span>Reason for rejection</span>
                <textarea
                  id="teacherRejectionReason"
                  className="assignment-restore-reason"
                  value={rejectionReason}
                  onChange={(event) => {
                    setRejectionReason(event.target.value)
                    if (error) setError('')
                  }}
                  minLength="5"
                  maxLength="500"
                  rows="3"
                  required
                  disabled={activeUserId !== null}
                />
              </label>
            ) : null}
            {error ? (
              <p className="form-message form-message-error" role="alert">
                {error}
              </p>
            ) : null}
            <div className="principal-teacher-confirmation-actions">
              <button
                type="button"
                className="principal-teacher-cancel-button"
                onClick={() => {
                  setPendingAction(null)
                  setRejectionReason('')
                  setError('')
                }}
                disabled={activeUserId !== null}
              >
                Cancel
              </button>
              <button
                type="button"
                className={
                  pendingAction.action === 'approve'
                    ? 'principal-approve-button'
                    : 'principal-reject-button'
                }
                onClick={handleConfirmAction}
                disabled={
                  activeUserId !== null ||
                  (pendingAction.action === 'reject' &&
                    (rejectionReason.trim().length < 5 || rejectionReason.trim().length > 500))
                }
              >
                {activeUserId !== null
                  ? 'Updating...'
                  : pendingAction.action === 'approve'
                    ? 'Approve account'
                    : 'Reject account'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  )
}

export default TeacherApprovalPage

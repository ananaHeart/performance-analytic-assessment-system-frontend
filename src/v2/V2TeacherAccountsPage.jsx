import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Check,
  Mail,
  Phone,
  RefreshCw,
  Search,
  UserRoundCheck,
  UsersRound,
  X,
} from 'lucide-react'

import {
  approveTeacherV2,
  getTeacherAccountsV2,
  rejectTeacherV2,
} from '@/api/apiV2Client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'active', label: 'Active' },
  { value: 'rejected', label: 'Rejected' },
]

const STATUS_VARIANTS = {
  active: 'success',
  pending: 'warning',
  rejected: 'destructive',
  locked: 'destructive',
}

function formatStatus(status) {
  if (!status) return 'Unknown'
  return status.charAt(0).toUpperCase() + status.slice(1)
}

function formatDateTime(value) {
  if (!value) return 'Not available'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not available'

  return new Intl.DateTimeFormat('en-PH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Manila',
  }).format(date)
}

function getInitials(teacher) {
  return [teacher.firstName, teacher.lastName]
    .filter(Boolean)
    .map((name) => name.charAt(0).toUpperCase())
    .join('') || 'T'
}

function V2TeacherAccountsPage({ token }) {
  const [teachers, setTeachers] = useState([])
  const [statusFilter, setStatusFilter] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)
  const [message, setMessage] = useState(null)
  const [confirmation, setConfirmation] = useState(null)

  const loadTeachers = useCallback(async ({ preserveMessage = false } = {}) => {
    setLoading(true)
    if (!preserveMessage) setMessage(null)

    try {
      const records = await getTeacherAccountsV2(token, statusFilter)
      setTeachers(records)
    } catch (error) {
      setMessage({ type: 'error', text: error.message })
    } finally {
      setLoading(false)
    }
  }, [statusFilter, token])

  useEffect(() => {
    const loadTimer = window.setTimeout(() => loadTeachers(), 0)
    return () => window.clearTimeout(loadTimer)
  }, [loadTeachers])

  useEffect(() => {
    if (!confirmation) return undefined

    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && busyId === null) setConfirmation(null)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [busyId, confirmation])

  const visibleTeachers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()
    if (!query) return teachers

    return teachers.filter((teacher) => [
      teacher.name,
      teacher.email,
      teacher.contactNumber,
      teacher.majorName,
    ].some((value) => String(value ?? '').toLowerCase().includes(query)))
  }, [searchTerm, teachers])

  const runAccountAction = async () => {
    if (!confirmation) return

    const { teacher, action } = confirmation
    setBusyId(teacher.userId)
    setMessage(null)

    try {
      if (action === 'approve') await approveTeacherV2(teacher.userId, token)
      else await rejectTeacherV2(teacher.userId, token)

      setConfirmation(null)
      setMessage({
        type: 'success',
        text: `${teacher.name || teacher.email} was ${action === 'approve' ? 'approved' : 'rejected'} successfully.`,
      })
      await loadTeachers({ preserveMessage: true })
    } catch (error) {
      setMessage({ type: 'error', text: error.message })
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="smart-ui space-y-6">
      <header className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <p className="m-0 text-xs font-semibold uppercase text-primary">User management</p>
          <h1 className="m-0 text-2xl font-bold text-foreground">Teacher account requests</h1>
          <p className="m-0 max-w-2xl text-sm text-muted-foreground">
            Review teacher accounts and control access to your school workspace.
          </p>
        </div>
        <Button variant="outline" onClick={() => loadTeachers()} disabled={loading}>
          <RefreshCw className={loading ? 'animate-spin' : ''} />
          Refresh
        </Button>
      </header>

      {message ? (
        <div
          role={message.type === 'error' ? 'alert' : 'status'}
          className={message.type === 'error'
            ? 'rounded-md border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive'
            : 'rounded-md border border-success/20 bg-success-soft px-4 py-3 text-sm font-medium text-success'}
        >
          {message.text}
        </div>
      ) : null}

      <Card>
        <CardContent className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-1 rounded-md bg-muted p-1" aria-label="Filter teacher accounts by status">
            {STATUS_FILTERS.map((filter) => (
              <button
                key={filter.value || 'all'}
                type="button"
                className={statusFilter === filter.value
                  ? 'h-9 rounded-md bg-background px-4 text-sm font-semibold text-foreground shadow-sm'
                  : 'h-9 rounded-md px-4 text-sm font-medium text-muted-foreground hover:bg-background/70 hover:text-foreground'}
                onClick={() => setStatusFilter(filter.value)}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <div className="relative w-full lg:max-w-sm">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              size={17}
              aria-hidden="true"
            />
            <Input
              className="pl-10"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search name, email, or major"
              aria-label="Search teacher accounts"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 border-b border-border">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <UsersRound className="size-5 text-primary" />
              School teachers
            </CardTitle>
            <CardDescription>Accounts are scoped to the authenticated principal's school.</CardDescription>
          </div>
          <Badge variant="outline">{visibleTeachers.length} shown</Badge>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Teacher</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Professional profile</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!loading && visibleTeachers.map((teacher) => (
                <TableRow key={teacher.userId}>
                  <TableCell className="min-w-60">
                    <div className="flex items-center gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-info-soft text-xs font-bold text-info">
                        {getInitials(teacher)}
                      </span>
                      <div className="min-w-0">
                        <strong className="block truncate font-semibold text-foreground">
                          {teacher.name || 'Unnamed teacher'}
                        </strong>
                        <span className="block text-xs text-muted-foreground">
                          {teacher.genderName || 'Gender not specified'}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="min-w-60">
                    <span className="flex items-center gap-2 text-sm text-foreground">
                      <Mail className="size-4 text-muted-foreground" />
                      {teacher.email || 'No email'}
                    </span>
                    <span className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <Phone className="size-4" />
                      {teacher.contactNumber || 'No contact number'}
                    </span>
                  </TableCell>
                  <TableCell className="min-w-56">
                    <strong className="block text-sm font-medium text-foreground">
                      {teacher.majorName || 'Major not specified'}
                    </strong>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {teacher.educationalAttainmentName || 'Attainment not specified'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANTS[teacher.status] ?? 'outline'}>
                      {formatStatus(teacher.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {formatDateTime(teacher.createdAt)}
                  </TableCell>
                  <TableCell>
                    <div className="flex min-w-max justify-end gap-2">
                      {teacher.status === 'pending' ? (
                        <>
                          <Button
                            size="sm"
                            disabled={busyId === teacher.userId}
                            onClick={() => setConfirmation({ teacher, action: 'approve' })}
                          >
                            <Check />
                            Approve
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={busyId === teacher.userId}
                            onClick={() => setConfirmation({ teacher, action: 'reject' })}
                          >
                            <X />
                            Reject
                          </Button>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">No action required</span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}

              {loading ? (
                <TableRow>
                  <TableCell colSpan="6" className="h-32 text-center text-muted-foreground">
                    <span className="inline-flex items-center gap-2">
                      <RefreshCw className="size-4 animate-spin" />
                      Loading teacher accounts...
                    </span>
                  </TableCell>
                </TableRow>
              ) : null}

              {!loading && visibleTeachers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan="6" className="h-40 text-center">
                    <div className="mx-auto flex max-w-md flex-col items-center gap-2 text-muted-foreground">
                      <UserRoundCheck className="size-8 text-primary" />
                      <strong className="text-sm text-foreground">No teacher accounts found</strong>
                      <span className="text-sm">
                        Adjust the filter or create the first teacher account for this school.
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {confirmation ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/35 p-4" role="presentation">
          <section
            className="w-full max-w-md rounded-lg border border-border bg-background p-6 shadow-[var(--ui-shadow-md)]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="teacher-confirmation-title"
          >
            <div className="mb-5 flex size-10 items-center justify-center rounded-md bg-brand-soft text-primary">
              {confirmation.action === 'approve' ? <Check /> : <X />}
            </div>
            <h2 id="teacher-confirmation-title" className="m-0 text-lg font-semibold text-foreground">
              {confirmation.action === 'approve' ? 'Approve teacher account?' : 'Reject teacher account?'}
            </h2>
            <p className="mb-6 mt-2 text-sm leading-6 text-muted-foreground">
              {confirmation.action === 'approve'
                ? `${confirmation.teacher.name || confirmation.teacher.email} will be able to use the teacher workspace.`
                : `${confirmation.teacher.name || confirmation.teacher.email} will not be granted access to the teacher workspace.`}
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirmation(null)} disabled={busyId !== null}>
                Cancel
              </Button>
              <Button
                variant={confirmation.action === 'reject' ? 'destructive' : 'default'}
                onClick={runAccountAction}
                disabled={busyId !== null}
              >
                {busyId !== null
                  ? 'Saving...'
                  : confirmation.action === 'approve' ? 'Approve account' : 'Reject account'}
              </Button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  )
}

export default V2TeacherAccountsPage

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Archive,
  ClipboardList,
  FilePlus2,
  Pencil,
  Play,
  Printer,
  RefreshCw,
} from 'lucide-react'

import {
  activateAssessmentV2,
  archiveAssessmentV2,
  getAssessmentReferenceDataV2,
  getAssessmentsV2,
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
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { navigateV2, V2_ROUTES } from '@/v2/v2Routes'

const STATUS_VARIANTS = {
  active: 'success',
  archived: 'outline',
  draft: 'secondary',
}

function assignmentLabel(assignment = {}) {
  const className = [assignment.gradeLevelName, assignment.sectionName]
    .filter(Boolean)
    .join(' - ')
  const subjectName = assignment.subjectName || 'Subject not specified'

  return `${className || 'Assigned class'} | ${subjectName}`
}

function formatAssessmentType(value) {
  if (!value) return 'Assessment'
  return String(value)
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

function formatDate(value) {
  const [year, month, day] = String(value ?? '').split('-').map(Number)
  if (!year || !month || !day) return 'Date not set'

  return new Intl.DateTimeFormat('en-PH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Manila',
  }).format(new Date(Date.UTC(year, month - 1, day)))
}

function statusLabel(value) {
  if (!value) return 'Unknown'
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function V2AssessmentListPage({ token }) {
  const [assignments, setAssignments] = useState([])
  const [assessments, setAssessments] = useState([])
  const [selectedAssignmentId, setSelectedAssignmentId] = useState('')
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)
  const [message, setMessage] = useState(null)

  const loadData = useCallback(async ({ preserveMessage = false } = {}) => {
    setLoading(true)
    if (!preserveMessage) setMessage(null)

    try {
      const [referenceData, records] = await Promise.all([
        getAssessmentReferenceDataV2({}, token),
        getAssessmentsV2(token, selectedAssignmentId),
      ])
      setAssignments(referenceData.classAssignments ?? [])
      setAssessments(records)
    } catch (error) {
      setMessage({ type: 'error', text: error.message })
    } finally {
      setLoading(false)
    }
  }, [selectedAssignmentId, token])

  useEffect(() => {
    const loadTimer = window.setTimeout(() => loadData(), 0)
    return () => window.clearTimeout(loadTimer)
  }, [loadData])

  const assignmentById = useMemo(
    () => new Map(assignments.map((assignment) => [String(assignment.classAssignmentId), assignment])),
    [assignments],
  )

  const runAction = async (assessment, action, successText) => {
    setBusyId(assessment.testId)
    setMessage(null)

    try {
      await action(assessment.testId, token)
      setMessage({ type: 'success', text: successText })
      await loadData({ preserveMessage: true })
    } catch (error) {
      setMessage({ type: 'error', text: error.message })
    } finally {
      setBusyId(null)
    }
  }

  const hasAssignments = assignments.length > 0

  return (
    <section className="smart-ui space-y-6">
      <header className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <p className="m-0 text-xs font-semibold uppercase text-primary">Assessment management</p>
          <h1 className="m-0 text-2xl font-bold text-foreground">Assessments</h1>
          <p className="m-0 max-w-2xl text-sm text-muted-foreground">
            Create assessment drafts, complete their questions and answer keys, then activate them for use.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => loadData()} disabled={loading}>
            <RefreshCw className={loading ? 'animate-spin' : ''} />
            Refresh
          </Button>
          <Button
            onClick={() => navigateV2(V2_ROUTES.newAssessment)}
            disabled={!loading && !hasAssignments}
            title={!loading && !hasAssignments ? 'An active class assignment is required.' : undefined}
          >
            <FilePlus2 />
            New assessment
          </Button>
        </div>
      </header>

      <Card>
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="w-full max-w-xl space-y-2">
            <Label htmlFor="assessment-class-assignment">Class assignment</Label>
            <select
              id="assessment-class-assignment"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-60"
              value={selectedAssignmentId}
              disabled={loading && assignments.length === 0}
              onChange={(event) => {
                setLoading(true)
                setSelectedAssignmentId(event.target.value)
              }}
            >
              <option value="">All assigned classes</option>
              {assignments.map((assignment) => (
                <option key={assignment.classAssignmentId} value={assignment.classAssignmentId}>
                  {assignmentLabel(assignment)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex min-w-36 items-center justify-between gap-4 rounded-md bg-muted px-4 py-3 sm:justify-start">
            <span className="text-sm text-muted-foreground">Records</span>
            <strong className="text-xl leading-none text-foreground">{assessments.length}</strong>
          </div>
        </CardContent>
      </Card>

      {message && (
        <div
          role={message.type === 'error' ? 'alert' : 'status'}
          className={message.type === 'error'
            ? 'rounded-md border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive'
            : 'rounded-md border border-success/20 bg-success-soft px-4 py-3 text-sm font-medium text-success'}
        >
          {message.text}
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 border-b border-border">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="size-5 text-primary" />
              Assessment records
            </CardTitle>
            <CardDescription>Only assessments owned through your class assignments are shown.</CardDescription>
          </div>
          <Badge variant="outline">{assessments.length} total</Badge>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Assessment</TableHead>
                <TableHead>Class and subject</TableHead>
                <TableHead>Term</TableHead>
                <TableHead className="text-center">Items</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!loading && assessments.map((assessment) => {
                const assignment = assignmentById.get(String(assessment.classAssignmentId))
                const status = String(assessment.status ?? assessment.testStatus ?? '').toLowerCase()
                const isBusy = busyId === assessment.testId

                return (
                  <TableRow key={assessment.testId}>
                    <TableCell className="min-w-52">
                      <div className="space-y-1">
                        <strong className="block font-semibold text-foreground">{assessment.testName}</strong>
                        <span className="block text-xs text-muted-foreground">
                          {formatAssessmentType(assessment.testType)} · {formatDate(assessment.testDate)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="min-w-60 text-sm text-muted-foreground">
                      {assignment
                        ? assignmentLabel(assignment)
                        : assignmentLabel(assessment)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {assessment.termName || 'Not specified'}
                    </TableCell>
                    <TableCell className="text-center font-semibold">
                      {assessment.totalItems ?? 0}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANTS[status] ?? 'outline'}>
                        {statusLabel(status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex min-w-max justify-end gap-2">
                        {status === 'draft' && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigateV2(`v2/assessments/${assessment.testId}/edit`)}
                            >
                              <Pencil />
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              disabled={isBusy}
                              onClick={() => runAction(
                                assessment,
                                activateAssessmentV2,
                                `${assessment.testName} was activated successfully.`,
                              )}
                            >
                              <Play />
                              Activate
                            </Button>
                          </>
                        )}
                        {status === 'active' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigateV2(`v2/assessments/${assessment.testId}/print-omr`)}
                          >
                            <Printer />
                            Print Bubble Answer Sheet
                          </Button>
                        )}
                        {status !== 'archived' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={isBusy}
                            onClick={() => runAction(
                              assessment,
                              archiveAssessmentV2,
                              `${assessment.testName} was archived successfully.`,
                            )}
                          >
                            <Archive />
                            Archive
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}

              {loading && (
                <TableRow>
                  <TableCell colSpan="6" className="h-32 text-center text-muted-foreground">
                    <span className="inline-flex items-center gap-2">
                      <RefreshCw className="size-4 animate-spin" />
                      Loading assessments...
                    </span>
                  </TableCell>
                </TableRow>
              )}

              {!loading && assessments.length === 0 && (
                <TableRow>
                  <TableCell colSpan="6" className="h-40 text-center">
                    <div className="mx-auto flex max-w-md flex-col items-center gap-2 text-muted-foreground">
                      <ClipboardList className="size-8 text-primary" />
                      <strong className="text-sm text-foreground">
                        {hasAssignments ? 'No assessments found' : 'No active class assignments'}
                      </strong>
                      <span className="text-sm">
                        {hasAssignments
                          ? 'Create a draft assessment or choose another assigned class.'
                          : 'A principal must assign a class and subject before an assessment can be created.'}
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </section>
  )
}

export default V2AssessmentListPage

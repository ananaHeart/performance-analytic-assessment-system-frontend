# V3 Reports Frontend DTO Requirements

Status: frontend foundation only. No report result or export endpoint is connected.

## Contract boundaries

- Base URL: `VITE_V3_API_URL`
- Prefix: `/api/v3`
- Authentication: `Authorization: Bearer <accessToken>`
- The backend derives the requester, role, and school from the access token.
- Identifiers remain distinct: `academicYearId`, `termPeriodId`, `gradeLevelId`,
  `classId`, `classAssignmentId`, `teacherUserId`, `subjectId`, `testId`,
  `studentId`, `classListId`, `testPartId`, `questionId`, and `skillId`.
- Scores, percentages, mastery classifications, LMS rankings, intervention
  recommendations, and consolidated totals must be returned by Backend. The
  frontend will only format and display returned values.

## Required report reference DTO

The Principal cannot use the teacher-owned assessment endpoints. Reports need a
role-aware reference endpoint, for example:

`GET /api/v3/reports/reference-data`

Supported query filters should include the IDs currently selected by the user.
The response should return only records visible to the authenticated user:

- `academicYears[]`: `academicYearId`, `yearName`, `startDate`, `endDate`, `status`
- `termPeriods[]`: `termPeriodId`, `academicYearId`, `termName`, `termOrder`,
  `startAt`, `endAt`, `status`
- `gradeLevels[]`: `gradeLevelId`, `gradeLevelName` (Principal)
- `classes[]`: `classId`, `academicYearId`, `gradeLevelId`, `gradeLevelName`,
  `sectionId`, `sectionName`, `status`
- `teachers[]`: `teacherUserId`, `fullName`, `status` (Principal)
- `subjects[]`: `subjectId`, `subjectCode`, `subjectName`
- `classAssignments[]`: `classAssignmentId`, `classId`, `teacherUserId`,
  `subjectId`, `academicYearId`, `status`
- `assessments[]`: `testId`, `classAssignmentId`, `termPeriodId`, `testName`,
  `testType`, `status`, `openAt`, `closeAt`
- `students[]`: `studentId`, `classListId`, `studentLrn`, `fullName`,
  `enrollmentStatus`

`termPeriodId` is required on every assessment option. The current teacher
assessment summary exposes `termName` but not always `termPeriodId`; report
filtering must not depend on a display label in the final contract.

## Common report request

Each report request needs:

- `reportType`: one of `assessment_results`,
  `item_analysis_competency_mastery`, `student_performance_profile`,
  `lms_intervention_plan`, or `principal_consolidated`
- `academicYearId`
- `termPeriodId`
- `gradeLevelId` when required for Principal scope
- `classId`
- `classAssignmentId`
- `teacherUserId` for Principal-selected teacher scope
- `subjectId`
- `testId`
- optional `studentId`

Backend must reject out-of-scope ID combinations instead of silently widening
the report scope.

## Common report response

Use the standard V3 `ApiResponse`. `data` should contain:

- `reportType`
- `generatedAt` as a UTC ISO-8601 timestamp
- `scope`: IDs and display labels for school, academic year, term, grade,
  class, teacher, subject, assessment, and optional student
- `calculationPolicy`: policy/version identifier used by Backend
- `dataStatus`: `available`, `empty`, `partial`, or `unavailable`
- `warnings[]`: stable `code` and user-safe `message`
- `summary`: report-specific backend-calculated fields
- `rows[]`: report-specific records

Numeric fields should be JSON numbers. Return `null` for a metric that cannot be
calculated; do not use placeholder zeroes.

## Assessment Results / Class Record

Required `rows[]` fields:

- `studentId`, `classListId`, `studentLrn`, `fullName`, `enrollmentStatus`
- `testResultId`, `resultStatus`, `submittedAt`, `verifiedAt`
- `earnedPoints`, `maximumPoints`, `percentage`
- `performanceStatusCode`, `performanceStatusLabel`
- `pendingTeacherVerificationCount`

Required `summary` fields:

- `studentCount`, `submittedCount`, `verifiedCount`, `pendingCount`
- `maximumPoints`, `classMeanPoints`, `classMeanPercentage`

## Item Analysis and Competency Mastery

Required item `rows[]` fields:

- `questionId`, `testPartId`, `partOrder`, `itemNumber`, `questionTypeCode`
- `maximumPoints`, `responseCount`, `correctCount`, `incorrectCount`
- `unansweredCount`, `pendingTeacherVerificationCount`
- `difficultyIndex`, `difficultyLabel`
- `skillIds[]`

Required competency records:

- `skillId`, `rootCompetencyId`, `rootCompetencyName`, `skillName`
- `assessedItemCount`, `studentCount`
- `earnedPoints`, `possiblePoints`, `masteryPercentage`
- `masteryStatusCode`, `masteryStatusLabel`

## Individual Student Performance Profile

Required fields:

- Student: `studentId`, `studentLrn`, `fullName`, `enrollmentStatus`
- Current class context: `classId`, `classListId`, `gradeLevelName`, `sectionName`
- `assessmentResults[]`: `testId`, `testName`, `termPeriodId`, `subjectId`,
  `earnedPoints`, `maximumPoints`, `percentage`, `performanceStatusCode`,
  `resultStatus`, `completedAt`
- `competencyPerformance[]`: `skillId`, `skillName`, `earnedPoints`,
  `possiblePoints`, `masteryPercentage`, `masteryStatusCode`
- `interventions[]`: `interventionPlanId`, `status`, `createdAt`, `updatedAt`

## LMS Intervention Plan

Required fields:

- `interventionPlanId`, `studentId`, `testId`, `termPeriodId`, `status`
- `evidence[]`: `skillId`, `skillName`, `masteryPercentage`,
  `masteryStatusCode`, `supportingQuestionIds[]`
- `actions[]`: `actionId`, `sequence`, `title`, `description`, `targetDate`,
  `status`, `teacherNotes`
- `createdAt`, `updatedAt`, `approvedAt`, `completedAt`

All ranking, least-mastered selection, and recommended actions must be generated
or validated by Backend, not inferred in React.

## Principal Consolidated Report

Required grouped records:

- Group keys: `academicYearId`, `termPeriodId`, `gradeLevelId`, `classId`,
  `teacherUserId`, `subjectId`, and optional `testId`
- Group labels for each key
- `studentCount`, `assessmentCount`, `submittedResultCount`,
  `verifiedResultCount`, `pendingVerificationCount`
- `earnedPoints`, `possiblePoints`, `meanPercentage`
- `masteryStatusCounts[]`: `statusCode`, `statusLabel`, `studentCount`
- `leastMasteredSkills[]`: `skillId`, `skillName`, `masteryPercentage`

Counts must represent distinct student results, not sync events or upload
attempts.

## Export responses

PDF and Excel should be separate authenticated V3 endpoints using the same
validated report scope. Expected response types:

- PDF: `application/pdf`
- Excel: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`

Return a meaningful `Content-Disposition` filename. On errors, return the
standard JSON `ApiResponse` with `errors.code`; never return an HTML error page.

## Error and authorization requirements

The frontend needs stable codes for:

- invalid or missing filter IDs
- cross-school or cross-teacher ownership violations
- incompatible academic-year, term, class, assignment, subject, assessment,
  or student combinations
- report not available because no verified results exist
- report generation failure
- export generation failure

Use HTTP `401` for an invalid session, `403` for role/ownership denial, `404`
for unavailable scoped records, `409` for lifecycle conflicts, and `422` for
invalid filter combinations.

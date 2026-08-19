# Frontend V1/V2 Integration Boundary

Date: August 12, 2026

## Current Runtime

The existing dashboard remains on the implemented V1 `/api/...` endpoints. This preserves the
working authentication, SF1 import, analytics, intervention, exports, and current mobile sync.

The V2 client is isolated in `src/api/apiV2Client.js`. Importing a V2 function is an explicit
screen-level decision; there is no automatic environment switch between V1 and V2.

The current application uses hash routing, so the isolated demo routes are:

- `#/v2/login`
- `#/v2/assessments`
- `#/v2/assessments/new`
- `#/v2/assessments/{testId}/edit`
- `#/v2/assessments/{testId}/print-omr`

V1 remains the default route set. The V2 session uses separate local-storage keys and its Bearer
token is attached only by `apiV2Client`.

## Identity Rules

- `classId` identifies the section and academic-year cohort.
- `classAssignmentId` identifies the teacher, subject, and cohort assignment.
- `classListId` identifies one student's membership in a cohort and is required by V2 attempts and
  sync uploads.
- These IDs must never be substituted for one another.

The V1 normalizers retain their legacy `id` fallback only when the response does not contain a real
`classAssignmentId`. A V2 class assignment always keeps `classId` and `classAssignmentId` separate.

## Verification Status

As of August 13, 2026:

- The React V2 route, authentication client, assessment list/editor, and OMR print preview compile and pass targeted frontend lint.
- Current backend source contains V2 controllers for authentication, teacher accounts, school setup, assessments, OMR printing, and synchronization.
- Those V2 backend files are currently uncommitted in the inspected backend working tree.
- No V2 backend process was listening on local port `8081` during this audit, so live frontend-to-backend behavior is not yet verified.
- V2 analytics, intervention, export, and SF1 frontend integrations remain pending their approved V2 runtime contracts.

Source presence must not be reported as deployed or runtime-validated functionality.

## Prepared V2 API Coverage

- `/api/v2/auth/*`
- `/api/v2/users/teachers/*`
- `/api/v2/school-setup/reference-data`
- `/api/v2/school-setup/available-classes`
- `/api/v2/school-setup/class-assignments`
- `/api/v2/assessments/*`
- `/api/v2/assessments/{testId}/omr-sheet`

All protected V2 functions accept the Bearer token explicitly.

The user-visible V2 frontend currently prepares:

- teacher login, session verification, and logout;
- filtering and listing assessments by `classAssignmentId`;
- creating and editing nested assessment drafts;
- multiple parts using `multiple_choice` or `true_false`;
- question text, choices, and answer keys;
- range-based skill mappings using backend skill IDs;
- activation validation feedback and archive actions; and
- authenticated OMR HTML preview and printable new-tab output.

These statements describe implemented frontend behavior. They do not prove that the corresponding backend profile, database, or endpoints are running.

## Keep on V1

Do not migrate these screens until equivalent V2 endpoints are implemented and deployed:

- SF1 preview and confirmation
- Manual student import
- Item analysis
- LMS and mastery analytics
- Teacher intervention
- Student skill mastery
- Trends and sync activity analytics
- Excel exports

## Deferred Migration Work

1. Commit and verify the backend V2 source, then run it with the V2 profile and approved V2 schema.
2. Keep principal account registration and approval screens out of this teacher demo until their
   full field contract and workflow are explicitly approved.
3. Wait for V2 SF1, analytics, intervention, and export contracts before migrating those screens.

## Data Dictionary Impact

The partial V9 dictionary confirms the relevant V2 relationships: `tests` references
`class_assignments` and `term_periods`; `test_parts`, `questions`, and `answer_keys` hold assessment
content; `class_lists` represents learner membership; and `auth_sessions` supports authenticated
sessions. These relationships are consumed through API DTOs only.

No frontend change in this demo creates or alters database tables or columns. The richer teacher
registration fields in the dictionary, including name components, birth date, gender, contact,
major, educational attainment, and address, require an approved backend/schema contract before a
registration UI is added.

## Database Naming Convention

- Entities/tables: lowercase and plural.
- Fields/columns: lowercase with underscores and singular.

Frontend API DTOs may remain camelCase when that is the backend JSON contract. Database column names
must not be exposed directly as user-facing labels.

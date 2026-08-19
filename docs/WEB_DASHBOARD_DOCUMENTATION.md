# Web Dashboard Documentation

Document created: July 9, 2026  
Last reviewed: July 13, 2026  
Last updated: August 1, 2026  
Coverage period: June 2026 to August 2026

## 1. Overview

The web dashboard is the browser-based frontend of the Performance Analytics Assessment System. It is used by principal and teacher users to manage school setup data, prepare paper-based assessments, view synchronized checking results, review analytics, and export reports.

The dashboard is connected to the Spring Boot backend through REST API calls. The current production backend is deployed on Render:

```text
https://performance-analytics-assessment-system.onrender.com
```

The frontend does not hardcode the backend host. It uses the Vite environment variable `VITE_API_URL`. The legacy `VITE_API_BASE_URL` variable is still supported as a fallback.

## 2. Technology Stack

- React
- Vite
- JavaScript / JSX
- CSS
- CSS design tokens
- Lucide React icons
- Recharts
- Spring Boot REST API backend
- Render deployment target

## 3. Environment Configuration

The shared API client is located at:

```text
src/api/apiClient.js
```

It reads the backend base URL from:

```env
VITE_API_URL
```

Local development example:

```env
VITE_API_URL=http://localhost:8080
```

Production example:

```env
VITE_API_URL=https://performance-analytics-assessment-system.onrender.com
```

Supporting files:

- `.env.example`
- `.env.production`

The endpoint paths remain unchanged. Only the backend host is controlled by the environment variable.

## 4. Documentation and Feature Timeline

The following dates are included to help explain when major frontend documentation and connected functions were prepared. Some feature dates are approximate project milestones based on recorded development history and backend/frontend handoff notes.

- June 2026, third week: Frontend analytics planning and dashboard improvement direction were discussed, including Assessment Setup UI, Competency Tag Library UI, Blueprint Templates UI, Teacher Analytics UI, and trend-related analytics.
- June 2026, fourth week: Backend analytics and export workstream was prepared, including teacher-facing intervention, student skill mastery, and student score export requirements.
- June 30, 2026: Backend/frontend handoff notes for teacher intervention, student skill mastery, and student score export were available for frontend wiring.
- July 9, 2026: Initial frontend documentation files existed in the frontend repository commit history.
- July 12, 2026: Web dashboard documentation was refreshed for panel presentation.
- July 12, 2026: Render backend deployment configuration was documented using `VITE_API_URL`.
- July 12, 2026: Student Profile Skill Mastery documentation was updated to use `GET /api/analytics/student-skill-mastery`.
- July 12, 2026: Teacher Intervention documentation was updated to use `GET /api/analytics/teacher-interventions`.
- July 12, 2026: Selected assessment student score export documentation was updated to use `GET /api/export/student-scores/{testId}`.
- July 13, 2026: Teacher class assignment flow was documented as Teacher -> Subject -> Grade Level -> Section -> Assign, using only backend-returned available sections.
- July 13, 2026: Gantt chart documentation was added in `docs/gantt-chart.md`.
- August 1, 2026: A frontend design-system cleanup was documented, using shared CSS design tokens, a white-first interface, and green only for actions, highlights, hover states, and active states.
- August 1, 2026: Teacher dashboard, class view, assessment list, student results, student profile, teacher analytics, intervention panel, principal dashboard, class assignment, SF1 modal, principal analytics, teachers, and settings screens were reviewed for consistent spacing, card layout, typography, and button styling.
- August 1, 2026: Analytics chart styling was standardized using Recharts for cleaner mastery and assessment visualizations.
- August 1, 2026: Sync activity display was aligned with backend `syncTimestamp` data and formatted as Philippine/local time.
- August 1, 2026: Teacher analytics student results were updated to show whole-assessment scores instead of separate Part 1 and Part 2 score tables.
- August 1, 2026: Performance Summary highest and lowest student cards were updated to show actual score values instead of percentage-only values.

## 5. User Roles

The dashboard supports two main roles:

- Principal
- Teacher

Role-based rendering controls what screens, navigation items, and actions are available to each user.

## 6. Principal Workflow

The principal workflow focuses on school-level management and monitoring.

- Dashboard
  Shows school-level summary cards and recent assessment activity.
- Teacher Approval
  Allows the principal to review teacher registrations and approve or reject teacher accounts.
- Class Assignment
  Assigns teachers to grade levels, sections, subjects, and academic years.
- Class Records / SF1 Import
  Supports student management through manual entry and SF1-based import.
- Analytics
  Displays school-level or class-level analytics generated from synchronized assessment results.
- Export Reports
  Allows report downloads when backend export data is available.

## 7. Teacher Workflow

The teacher workflow focuses on class-level assessment setup and result review.

- Dashboard
  Shows teacher-related summary metrics such as total assigned students, created assessments, and recent sync activity.
- Class Records
  Shows the teacher's assigned classes and class-specific assessment, analytics, and student views.
- Assessment Setup
  Allows the teacher to create assessments, add test parts, define answer keys, and map competencies or branch skills.
- Analytics
  Shows performance summaries, least mastered skills, assessment part details, student scores, and teacher-facing intervention recommendations.
- Student Profile
  Shows an individual student's assessed skill mastery across checked results in the selected class.
- Export Report
  Downloads selected assessment student score rows through the backend export endpoint.

## 8. Class Assignment Model

Within the dashboard, a class context should be understood as a combination of:

- teacher
- grade level
- section
- subject
- academic year

Raw numeric IDs are internal implementation details. User-facing labels should use readable grade, section, subject, teacher, and academic year values.

Current assignment dropdown order:

1. Teacher
2. Subject
3. Grade Level
4. Section
5. Assign

The section dropdown must depend on the selected grade level. The frontend calls the backend section endpoint with the selected grade level and displays only sections returned by the backend. If no available section exists for the selected grade level, the UI shows:

```text
No available sections for this grade level.
```

This supports the intended flow:

```text
Principal imports SF1 -> System creates available sections -> Principal assigns teachers only to available imported sections
```

## 9. Student Records and SF1 Import

Student records can be managed manually or through SF1 import. The SF1 flow supports preview and confirmation before saving records. Student identity and class membership are handled separately by the backend so that student profile data can be reused across class contexts.

Current student-facing frontend displays include:

- student LRN
- student name
- grade and section
- gender-coded profile avatar
- skill mastery list based on backend analytics

## 10. Assessment Setup

Assessment setup is managed by the teacher under a selected class. A complete assessment can contain multiple parts.

Each assessment part can include:

- part label / order
- part type
- number of items
- points per item
- answer key
- parent competency
- branch skill mappings, when available

The dashboard preserves part-level competency mappings so analytics can reflect different skills per part rather than only the parent assessment competency.

## 11. Analytics

The analytics module displays results after the teacher checks student papers on the mobile app and synchronizes the results to the backend.

Current analytics views include:

- performance summary for the selected assessment
- least mastered skills
- assessment score details
- student score table for the selected whole assessment
- score percentage / performance label
- teacher-facing intervention recommendation

The analytics view is assessment-driven. The selected assessment controls which details, scores, LMS data, and interventions are displayed. The student result table is whole-assessment based, so teachers can immediately see each learner's total score for the selected quiz/test.

Part-level backend results are still used when needed to compute or verify scores:

```text
GET /api/analytics/test-part-results?testId={testId}&testPartId={testPartId}
```

The frontend combines the selected assessment's part results into whole-test totals for the teacher-facing student result table.

## 12. Student Profile Skill Mastery

The student profile Skill Mastery section uses:

```text
GET /api/analytics/student-skill-mastery?studentId={studentId}&classId={classId}
```

Purpose:

- show all competencies assessed for the selected student
- aggregate across checked results in the selected class
- include mastered, developing, and needs-support skills
- avoid using intervention endpoints for student profile mastery

This is student-centered, not class-average analytics.

## 13. Teacher Intervention Recommendation

The teacher-facing intervention panel uses:

```text
GET /api/analytics/teacher-interventions?testId={testId}
```

Purpose:

- show the selected competency or skill
- show mastery / LMS status
- show affected learners count
- show recommended teaching action
- show target group
- show follow-up activity or quick reassessment suggestion

Important rule:

This is a teacher guide. It must not be written as an automated direct message to students.

## 14. Export Reports

The dashboard currently supports selected-assessment exports through backend endpoints.

Current export endpoints used by the frontend:

```text
GET /api/export/item-analysis/{testId}
GET /api/export/lms/{testId}
GET /api/export/student-scores/{testId}
```

The Teacher Analytics page Export Report button uses:

```text
GET /api/export/student-scores/{testId}
```

Purpose:

- export actual student score rows for the selected assessment
- include student identity and class metadata
- include total score, max score, percentage, performance status, and checked timestamp

This is not the same as LMS export and not the same as item analysis export.

## 15. API Integration Groups

The frontend API client groups backend usage into these areas:

- authentication
- teacher registration and approval
- student records
- SF1 preview and confirm
- sections, grade levels, teachers, subjects
- class assignments
- teacher assessments
- assessment details and test parts
- competency and branch skill mapping
- analytics item analysis
- LMS and intervention analytics
- student skill mastery
- sync activity
- test part results
- export downloads

The dashboard preserves request payloads and endpoint paths expected by the backend.

## 16. Production Deployment Notes

The frontend is prepared for Render Static Site deployment.

Render frontend settings:

- Build command: `npm run build`
- Publish directory: `dist`
- Environment variable: `VITE_API_URL`
- Production value: `https://performance-analytics-assessment-system.onrender.com`

The backend must allow the deployed frontend domain through CORS.

## 17. Current Confirmed Working Features

The following frontend features are currently documented as implemented:

- login flow
- role-based principal and teacher dashboard views
- teacher approval
- class assignment
- manual student input
- SF1 preview and confirm
- teacher assessment setup
- test part creation
- answer key setup
- competency and branch skill mapping
- teacher analytics
- student result table
- whole-assessment score display in analytics
- teacher-facing intervention recommendation
- student profile skill mastery
- selected assessment student score export
- production backend environment configuration
- teacher class assignment flow using backend-returned grade-level sections
- dated Gantt chart documentation
- shared frontend design tokens and Recharts-based chart styling
- sync activity display using backend timestamp data and Philippine/local time formatting

## 18. Known Remaining Documentation Gaps

The following items are not yet fully documented in this repository:

- final deployed frontend URL after Render deployment
- final screenshots of the deployed frontend pages
- full backend technical documentation
- full mobile app technical documentation
- full database schema documentation
- final panel-ready system architecture diagram
- final user manual with screenshots for principal and teacher users

These gaps are documentation gaps only. They do not necessarily mean the frontend feature is missing.

## 19. UI Rule for Future Refactor

Future UI cleanup should preserve:

- existing API integration
- request payload structure
- backend endpoint structure
- sync behavior
- assessment and analytics data integrity

The visual direction should remain a clean education dashboard using the `#3ACF49` primary accent.

## 20. August 1, 2026 Frontend Update Summary

The August 1 update focused on UI consistency and analytics data clarity.

Implemented and documented:

- shared frontend visual direction using design tokens
- cleaner white-first page background
- green used only for meaningful actions, active states, highlights, and positive status
- more consistent cards, tables, buttons, spacing, and typography
- Recharts-based analytics chart styling
- compact teacher and principal dashboard layout
- compact class assignment and SF1 import modal layout
- student profile Skill Mastery display using the backend student-centered mastery endpoint
- teacher analytics using backend sync activity and test part result data
- whole-assessment student score table for the selected test
- Performance Summary highest and lowest student cards showing actual score values instead of percentage-only values

This update does not change backend endpoint structure or assessment business logic.

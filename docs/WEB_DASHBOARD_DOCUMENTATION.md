# Web Dashboard Documentation

## 1. Overview
The web dashboard is the browser-based interface for principal and teacher users of the Performance Analytic Assessment System. It provides role-based access to management, assessment, analytics, and reporting functions while serving as the main frontend layer connected to the backend assessment services.

## 2. Technology Stack
- React
- Vite
- JavaScript/JSX
- CSS
- Spring Boot REST API backend

## 3. Web Dashboard Purpose
The web dashboard serves as the operational frontend of the system. It functions as the principal management workspace, the teacher assessment setup workspace, the analytics review interface, and the report export interface. It is also the frontend channel through which backend data is displayed, managed, and submitted.

## 4. User Roles
The web dashboard currently supports two primary user roles:

- Principal
- Teacher

The assigned role affects the screens, sidebar modules, and actions available to the logged-in user. Role-based access ensures that each user sees only the modules relevant to their responsibilities in the system.

## 5. Principal Flow
The principal workflow is centered on school-wide management and monitoring.

- Dashboard
  Provides a summary entry point for principal activities and access to the main administrative modules.
- Teacher Approval
  Allows the principal to review teacher registrations and decide whether accounts should be activated for system use.
- Class Assignment
  Supports the assignment of teachers to subjects, sections, grade levels, and academic years.
- Class Records / SF1 Import
  Provides tools for managing student records, including manual entry and SF1-based import workflows.
- Analytics
  Displays school-wide and class-related analytical views based on uploaded checking results.
- Export Reports
  Allows report generation and download based on available analytics and test result data.

## 6. Teacher Flow
The teacher workflow is centered on classroom-level assessment preparation and result review.

- Dashboard
  Provides the teacher with an entry point to the assessment and analytics functions of the system.
- Assessment Setup
  Allows the teacher to select a class assignment, create a test, and define the parts of that test.
- Analytics
  Allows the teacher to review performance data derived from uploaded mobile checking results.
- Export Reports
  Allows the teacher to download report outputs based on available assessment analytics.

## 7. Teacher Approval
Teacher approval is a controlled principal-side process. The principal reviews teacher registrations, approves or rejects accounts, and determines whether the teacher becomes active in the system. Only active teachers should be used in the normal system flow, including class assignment and assessment-related operations.

## 8. Class Assignment
Class assignment defines the instructional ownership structure used by the system. The principal assigns a teacher to a subject, section, grade level, and academic year. Each class assignment creates or uses a class record that becomes the basis for downstream assessment setup and analytics linkage.

Within the system, a class should be understood as the combination of:

- teacher
- subject
- section
- academic year

## 9. Student Records and SF1 Import
The principal can add student records manually or import them through the SF1 workflow. During SF1 processing, the system detects the school year and section from the uploaded file. Students are saved as profile records, while enrollments connect those students to the appropriate section and academic year. This structure supports both student identity management and class membership tracking.

## 10. Assessment Setup
Assessment setup is a teacher-managed process tied to one selected class assignment. The teacher selects one class assignment and creates an assessment or test under that selected class. After the test is created, the teacher adds test parts that define the structure of the assessment.

Each test part includes the following elements:

- competency
- part label
- part type
- number of items
- points per item
- answer key

Raw class IDs are internal identifiers and should not be treated as the user-facing class label. User-facing selection and display should be based on the readable class assignment information rather than internal numeric identifiers.

## 11. Analytics
The analytics module reads uploaded mobile checking results and turns them into classroom or school-level performance views. Item analysis presents correct responses, total responses, and difficulty information. Least mastered skills identifies competency mastery patterns. Affected students highlights learners who may require additional support. Intervention support presents recommendations when such recommendation data is available from the backend.

## 12. Export Reports
The export reports module allows teacher and principal users to generate downloadable reports based on analytics data. These reports are based on uploaded test results and are intended to support classroom review, school analysis, and documentation needs.

## 13. API Integration
The web dashboard integrates with the Spring Boot backend through grouped REST API functions. The main API groups currently used by the dashboard include:

- authentication
- teacher approval
- class assignments
- SF1 import
- assessment setup
- analytics
- export reports

These API groups are used by the frontend according to module purpose rather than exposing every backend endpoint directly within the documentation.

## 14. Current Confirmed Working Features
The following features are currently confirmed as working within the web dashboard flow:

- Login works
- Principal dashboard/sidebar works
- Teacher approval works
- Class assignment works
- SF1 import preview/confirm works
- Teacher assessment setup works
- Analytics reflects uploaded mobile results
- Export report buttons are connected to backend endpoints

## 15. Known UI Improvements
The following user interface improvements remain appropriate for future refinement:

- Full storyboard-based UI cleanup
- Fixed/sticky sidebar polish
- Better mobile-inspired card layout
- Better button flow
- Better status badges
- Hide raw IDs from main user-facing labels
- Improve Assessment Setup screen spacing and guided flow
- Improve Analytics visual presentation

## 16. Important UI Rule for Future Refactor
The web dashboard UI should be refactored after core features are stable. The refactor should follow the storyboard and use the theme color `#3ACF49`. The UI must not break existing API integration, sync behavior, or data integrity rules.

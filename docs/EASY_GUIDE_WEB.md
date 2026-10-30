# Easy Guide to the Marka Web Dashboard

This student-friendly guide follows the backend guide's **Definition, Receives, Checks, Shows or returns, and Why it matters** format. It explains the current V3 web workflow, not every helper or historical screen.

**Source snapshot:** October 22, 2026; local revision `eb2db44`. This is a source-code explanation, not proof that every feature is deployed or has passed live testing. The print layout uses eleven sections with page-break markers.

## The big picture

Marka's web application is the part teachers and principals use in a browser. **React** builds the screens; **Vite** runs the development server and produces the production build. The code uses JavaScript and JSX, CSS and Tailwind CSS, Lucide icons, Radix-based controls, and Recharts charts. The manifest currently declares React 19 and Vite 8.

A **page** manages a workflow, such as opening a class or reading a report. A **component** is a reusable piece, such as navigation or a chart. **Props** carry information into a component; **state** remembers current selections and results; an **effect** runs work such as loading data when a selection changes.

The **API client** is the messenger. It sends HTTP requests to the backend, includes the session token, and returns data or errors. The browser does not connect directly to MySQL/TiDB. The backend remains responsible for authorization, permanent records, official scores, and report calculations.

The main flow is: **click -> React page -> API client -> backend -> response -> React state -> screen**. The mobile app is a separate client; this web repository is not the phone's offline scanning engine.

### Routes and roles

A route identifies a screen. Marka uses its own hash navigation in `App.jsx`, such as `#reports`; it does not use React Router. A screen route is different from an API endpoint such as `/api/v3/reports/reference-data`.

- **Public:** home, features, app download, guide, technology stack, about, privacy, login, registration, and verification.
- **Teacher:** `#teacher-dashboard`, `#class-records`, `#assessment-setup`, `#reports`, and `#teacher-settings`. Work is scoped to assigned classes and subjects.
- **Principal:** `#principal-dashboard`, `#class-records`, `#students`, `#teacher-approval`, `#reports`, and `#principal-settings`. This role manages school records and consolidated reporting.

### Where things live

`src/pages/` holds screens; `src/components/` holds reusable UI; `src/api/` holds request helpers; `src/styles/` holds appearance; `src/utils/` holds focused helpers. `src/assets/`, `src/data/`, and `src/config/` supply images, public content, and configuration. `src/v2/` contains the retained editor discussed below. `public/` holds static files, `docs/` holds explanations, and `dist/` is generated build output.

**Version reminder:** a folder named `v2` does not prove that a screen uses a V2 database. Follow its imports and endpoints. This guide's active editor calls V3 APIs; database versions and migrations belong to the backend.

<div style="page-break-before: always;"></div>

## The 15 most important files

### 1. `src/main.jsx`

**Definition:** The browser entry point that starts React. [Open source](../src/main.jsx)

**Receives.** It finds the HTML element with the ID `root` from `index.html`.

**Checks / organizes.** It imports the shared styles and mounts `App` inside React's `StrictMode`. Development checks may repeat effect setup and cleanup; this is not a second production application.

**Shows or returns.** It renders the application into the root element. Styles are imported in a deliberate order, including public-site, reporting, layout, dashboard, class, student, and teacher styles.

**Why it matters.** A broken mount or stylesheet import can affect the entire site. Later CSS can override earlier CSS, so a visual issue may involve more than the page file.

### 2. `src/App.jsx`

**Definition:** The application's navigation and session coordinator. [Open source](../src/App.jsx)

**Receives.** It reads the URL hash and stored session, then receives navigation, login, and logout callbacks from child components.

**Checks / organizes.** It verifies a restored token through `getCurrentUserV3`, selects routes allowed for the role, and maps old route aliases to current screens. It passes class, assessment, or report context when opening a related page. Clicking the teacher's ordinary Class navigation clears the selected-class context so the class chooser can appear.

**Shows or returns.** Public pages use their public layouts. Protected pages appear inside `ProtectedRoute` and `AppLayout`. It stores the user/token under `assessment-auth-session` in local storage and teacher navigation context in session storage. Matching authentication-expiry events clear the session.

**Why it matters.** It connects the whole app without putting every screen's business logic in one file. Local storage is not the database or proof of permission; the backend must validate the token.

### 3. `src/components/ProtectedRoute.jsx`

**Definition:** A small visibility guard for protected React content. [Open source](../src/components/ProtectedRoute.jsx)

**Receives.** It receives a user, an optional list of allowed roles, the protected content, and a fallback.

**Checks / organizes.** It checks that a user exists and, when supplied, that the role is allowed.

**Shows or returns.** It returns the protected children when permitted, otherwise the fallback. It does not fetch records or independently verify tokens.

**Why it matters.** It prevents inappropriate screens from being shown during ordinary navigation. It is not server security: hiding a button cannot stop someone from calling an endpoint directly.

<div style="page-break-before: always;"></div>

### 4. `src/components/AppLayout.jsx`

**Definition:** The shared frame around signed-in pages. [Open source](../src/components/AppLayout.jsx)

**Receives.** It receives the user, token, navigation items, active page, school-year label, page content, and navigation/logout callbacks.

**Checks / organizes.** The teacher layout uses a top navigation bar. The principal layout uses a sidebar and top bar. It marks the active route, keeps overflowing active navigation visible, derives profile initials, and handles the principal's logout confirmation.

**Shows or returns.** It renders Marka branding, role navigation, account access, notifications, theme controls, and the selected page as `children`. `NotificationCenter`, `ThemeToggle`, and `MarkaMark` remain separate components.

**Why it matters.** Shared layout keeps pages consistent without duplicating navigation. Pages should manage their inner content rather than invent different outer widths.

**Container rules.** `src/styles/app-layout.css` defines a 1320px teacher content-width token, 24px desktop gutters, and 16px top spacing. Teacher dashboard, classes, settings, editor, and reports share that centered width. Principal pages fill the main area beside the sidebar with shared gutters. Responsive rules adjust the layout on smaller screens. Preserve the compact spacing and existing theme tokens; informational statistics are not automatically buttons.

### 5. `src/components/PublicLayout.jsx`

**Definition:** The shared frame for the public website, separate from the working dashboard. [Open source](../src/components/PublicLayout.jsx)

**Receives.** It receives the current public page, optional title and scroll target, sign-in state, navigation callback, and page content.

**Checks / organizes.** It sets the document title, controls the mobile menu, closes it on Escape or an outside pointer action, and handles section scrolling. The `publicNav` helper coordinates links with the hash-based router.

**Shows or returns.** It supplies public navigation, branding, theme control, footer links, and the content area. When told the visitor is signed in, it offers a dashboard action instead of sending that user to login.

**Why it matters.** Public information pages can share one accessible layout without inheriting teacher or principal controls. Actual public-page content belongs to each page, not this wrapper.

<div style="page-break-before: always;"></div>

### 6. `src/pages/LandingPage.jsx`

**Definition:** Marka's public home page, not the authenticated dashboard. [Open source](../src/pages/LandingPage.jsx)

**Receives.** It receives navigation and section-scroll information. It imports the hero image, feature data, and reusable public content blocks.

**Checks / organizes.** It arranges the hero, workflow steps, feature highlights, Android app section, and registration/login actions inside `PublicLayout`. Feature icons are selected from a known icon map.

**Shows or returns.** It presents the product introduction and links visitors to registration, features, and installation information. `PublicBlocks`, `data/publicSite`, and the public configuration support shared content.

**Why it matters.** This is where visitors learn what Marka is. Its descriptions are not evidence that every backend or mobile capability is deployed, and the page does not load private class results.

### 7. `src/pages/LoginPage.jsx`

**Definition:** The screen that turns credentials, and optionally a second factor, into a verified web session. [Open source](../src/pages/LoginPage.jsx)

**Receives.** It collects email and password, or an authenticator/recovery code when the backend requests multi-factor authentication. It also receives success, failure, and navigation callbacks.

**Checks / organizes.** It rejects empty credentials, calls `loginV3` with a browser device identifier, and handles an MFA challenge separately. It checks a six-digit authenticator code or a nonempty recovery code and displays challenge timing/errors. A verification-required response sends the user to the verification page.

**Shows or returns.** After receiving a token, it calls `/api/v3/auth/me` before reporting login success to `App`. It shows loading and error states, and clears password state when entering the MFA step. `PublicAuthShell` supplies the authentication layout.

**Why it matters.** A form submission is not automatically a successful login. The backend decides credentials, account eligibility, and MFA requirements; `App` stores the resulting session and opens the role's dashboard.

<div style="page-break-before: always;"></div>

### 8. `src/api/apiV3Client.js`

**Definition:** The shared HTTP client for the active V3 web workflows. [Open source](../src/api/apiV3Client.js)

**Receives.** Named functions receive record identifiers, filters, form payloads, and a token. Examples include `getAssessmentResultsReportV3`, `createAssessmentV3`, and `approveTeacherV3`.

**Checks / organizes.** The internal `requestV3` reads the configured API base, normalizes a token, and attaches `Authorization: Bearer ...` to authenticated requests. Known public authentication paths do not require a stored token. JSON bodies receive the proper content type; multipart uploads retain browser-generated boundaries. `buildQuery` turns nonempty filter values into URL parameters.

**Shows or returns.** It returns JSON or a binary `Blob`, unwraps response data in endpoint helpers, and normalizes selected records into consistent frontend field names. Errors retain HTTP status, backend code, message, and field details. Network failures receive a separate connection error. HTTP 401 or recognized authentication codes on protected requests dispatch `smart:v3-auth-expired`, which `App` handles.

**Why it matters.** Pages can request school data without repeating token, query, and error handling. A `403` permission failure is not automatically the same thing as an expired session.

**Address block.** The client selects the local backend for `localhost`/`127.0.0.1` and the Render backend for a deployed browser host. `VITE_LOCAL_V3_API_URL` and `VITE_RENDER_V3_API_URL` provide explicit overrides; the existing `VITE_V3_API_URL` and legacy `VITE_API_URL` remain supported. Vite environment values are built into the frontend, so restart development after local changes and rebuild/redeploy production after production changes. Do not put secrets in `VITE_*` values, because they are browser-visible.

**Download block.** Report and answer-sheet helpers request binary files. The questionnaire helper specifically accepts both PDF success and JSON errors, then verifies `application/pdf` and the `%PDF-` signature before opening the result. Do not claim that this extra check is applied to every download helper.

**Session boundary.** The client distinguishes network errors from authentication failures, but session restoration in `App` also has its own error handling. Do not promise that every connectivity failure everywhere preserves login; examine the actual call path.

<div style="page-break-before: always;"></div>

### 9. `src/pages/TeacherDashboard.jsx`

**Definition:** The teacher's compact summary and starting point for assessment work. [Open source](../src/pages/TeacherDashboard.jsx)

**Receives.** It receives the user, token, and navigation callback, then loads assessment reference data, assigned-class rosters, and assessments.

**Checks / organizes.** It groups active assignments by class/section and year so different subjects do not become separate class cards. It loads rosters for distinct classes, excludes archived assessments, and sorts recent activity. Some requests use `Promise.allSettled` so a failure does not discard every successful result.

**Shows or returns.** It shows assigned classes, roster-based student totals, created assessments, five recent activities, refresh, and a small New assessment action. The separate `TeacherStudentSupport` component requests backend-flagged learners for a term, previews four, and links to the full report or a competency report.

**Why it matters.** Teachers can move from a short overview to a specific class, assessment, or learner concern. Support recommendations come from the backend, not invented dashboard thresholds. A failed roster currently contributes zero to the dashboard sum, so that total alone is not proof every roster request succeeded.

### 10. `src/pages/PrincipalDashboard.jsx`

**Definition:** The principal's school overview. [Open source](../src/pages/PrincipalDashboard.jsx)

**Receives.** It loads active teacher accounts, active classes and rosters, reporting reference data, and assessment-result reports.

**Checks / organizes.** It counts unique learners across loaded rosters. To identify conducted assessments, it checks nonarchived assessments for report data marked `available` or `partial`. It records warnings when a group of requests fails.

**Shows or returns.** It displays active teachers, total students, conducted assessments, and up to eight recent assessment rows. Clicking a row, or activating it with the keyboard, opens Reports with the appropriate scope. Affected summary counts can show `Unavailable` instead of an apparently complete total.

**Why it matters.** The principal sees school-level oversight rather than a copy of the teacher dashboard. Here, conducted-assessment count means assessments with available/partial report data, not simply all created drafts.

<div style="page-break-before: always;"></div>

### 11. `src/pages/ClassRecordsPage.jsx`

**Definition:** A shared class-and-roster workspace with different teacher and principal branches. [Open source](../src/pages/ClassRecordsPage.jsx)

**Receives.** It receives the role, user, token, optional class/assignment identifiers, selected teacher tab, principal section, and navigation callback. It loads reference choices and records through the V3 client.

**Checks / organizes: teacher branch.** It limits assignments to the teacher and selected academic year, groups subjects under their classes, and shows the class chooser when no class was explicitly opened. Selecting a class preserves its identifier; selecting a subject selects the corresponding assignment. Assessment requests use that assignment rather than whichever class happened to load last.

**Checks / organizes: principal branch.** The Classes section manages classes and teacher-subject assignments. The Students section manages class rosters, manual enrollment, profile corrections, and enrollment statuses. Client checks catch missing fields, duplicate assignment choices, a non-12-digit LRN, and required reasons; backend validation remains authoritative.

**Shows or returns.** Teachers get separate class entries, class assessment lists, creation/archive actions, and the roster view when opened with that tab. Principals get management tables and forms. `V3Sf1ImportPanel` handles the SF1 preview/confirmation workflow; after import, the parent refreshes the roster. A student's information dialog is not a full analytics report.

**Why it matters.** It connects each learner and assessment to the correct class context. The distinction between **class** and **class assignment** is essential: a class is the learner group; an assignment connects that class to a teacher and subject.

**Safety block.** Follow the called API, not just the icon. The assignment action styled as deletion calls `archiveClassAssignmentV3` with confirmation and a reason. Likewise, assessment archiving is not an instruction to erase database history. A disabled or unavailable edit flow must not be described as fully implemented merely because a dialog exists.

<div style="page-break-before: always;"></div>

### 12. `src/pages/ReportsPage.jsx`

**Definition:** The role-aware coordinator for report filters, requests, tables, charts, and exports. [Open source](../src/pages/ReportsPage.jsx)

**Receives.** It receives the user, role, token, and optional initial filters from another screen. It first loads reporting reference data for valid years, terms, assignments, assessments, and learners.

**Checks / organizes.** It offers only role-appropriate report types, derives dependent choices, and clears incompatible downstream selections. For Assessment Results, a matching assessment and class assignment must exist before fetching. Report effects ignore late responses after their selected context changes. Filters start collapsed to prioritize the report area.

**Shows or returns.** It renders backend scope, summary, rows, warnings, and `available`, `partial`, or `empty` states. Separate loading/error states distinguish missing selections from failed requests. Assessment Results formats backend points and percentages rather than recomputing them; its number formatter shows null/undefined/empty values as `Not available` while preserving actual zero.

**Why it matters.** The same page supports teacher assessment results, item analysis, student profiles, sync activity, learning competency, and student support, plus principal consolidated reporting. PDF/Excel buttons call backend export helpers; their existence does not prove the deployed endpoint works.

**Filter boundary.** In Assessment Results, selecting a student narrows the displayed rows locally. It does not recalculate class-summary values. Its current single-assessment export sends test and assignment identifiers, not the optional student filter.

### 13. `src/components/AnalyticsCharts.jsx`

**Definition:** Reusable percentage bar charts built with Recharts. [Open source](../src/components/AnalyticsCharts.jsx)

**Receives.** It receives rows containing identifiers, labels, values, and optional tone/fill information, plus chart dimensions.

**Checks / organizes.** It converts values, clamps finite percentages to 0-100, applies theme colors, shortens long axis labels, and keeps full labels in tooltips. It provides vertical and horizontal chart variants.

**Shows or returns.** It renders responsive bars, axes, and tooltips. It neither fetches reports nor saves grades. Default 80/60 color bands are presentation rules, not authority to assign official learner statuses.

**Why it matters.** Chart presentation stays reusable and separate from report selection. One current caveat is that `Number(null)` and `Number('')` become zero in its normalization, unlike the report table formatter. Missing-value handling must therefore be verified per chart input; no fix is included in this documentation task.

<div style="page-break-before: always;"></div>

### 14. `src/v2/V2AssessmentEditorPage.jsx`

**Definition:** The active assessment editor, retaining a V2 filename but importing V3 API functions. [Open source](../src/v2/V2AssessmentEditorPage.jsx)

**Receives.** The thin `AssessmentSetupPage` wrapper passes the token, user identifier, initial class assignment, optional existing assessment ID, and navigation callback.

**Checks / organizes.** It loads assignments, terms, question types, skills, rubrics, and response-region sizes. Existing records are hydrated into editable form state. Validation covers question content, answers, points, competency mappings, and applicable written-response/rubric settings. Supported type codes include multiple choice, true/false, identification, enumeration, and essay.

**Shows or returns.** It builds a V3 payload for create/update, tracks saved-versus-unsaved changes, and calls activation separately. Activation requires a saved draft with no unsaved changes and successful validation. The displayed maximum score is an assessment-design calculation, not a learner's finalized score.

**Why it matters.** It connects class setup to the tests later used for scanning and reporting. A historical filename should not cause a future developer to wire it back to obsolete APIs.

**Printing block.** Answer-sheet printing checks backend eligibility, generates/reuses an A4 answer-sheet version, then downloads that version's PDF. Questionnaire printing uses a different endpoint and requires a saved assessment without unsaved edits. Each flow opens a temporary window, handles errors separately, and later releases the object URL. Printable output and successful mobile scoring are separate acceptance checks.

### 15. `src/pages/TeacherApprovalPage.jsx`

**Definition:** The principal's teacher-account review screen. [Open source](../src/pages/TeacherApprovalPage.jsx)

**Receives.** It receives the principal user and token, then requests pending-approval, active, and rejected teacher accounts.

**Checks / organizes.** It gates the page by principal role, filters accounts by status/search, and loads fuller details when a profile is opened. Approve/reject actions require confirmation; rejection requires a reason of 5-500 characters.

**Shows or returns.** It shows status tabs, counts, teacher details, confirmation dialogs, and success/error messages. After a successful API decision, it reloads the account lists rather than only changing a badge locally.

**Why it matters.** Registration is not equivalent to approved access. The principal initiates the decision here, while the backend checks school scope, account eligibility, and the actual status transition. Class assignments are managed elsewhere.

<div style="page-break-before: always;"></div>

## How a report appears on screen

Imagine a teacher opening the results of **English Quiz 1**. This is an illustrative name, not a claim about records currently in the database.

**1. The teacher enters the workspace.** Login supplies a token and verified user. `App.jsx` chooses the teacher routes and `AppLayout` draws the shared navigation. On a later visit, the saved session is checked again.

**2. Reports becomes the active screen.** Clicking Reports changes the route to `#reports`. `App` renders `ReportsPage` with the user and token. A dashboard link may also supply initial report filters.

**3. The page learns what can be selected.** `getReportReferenceDataV3` requests `/api/v3/reports/reference-data`. The page builds appropriate choices from the response and restricts teacher assignments to the current teacher. Loading, empty-reference-data, and failed-request states are distinct.

**4. The teacher chooses the scope.** The filter area can be expanded. The teacher selects a term, a class/subject assignment, and the matching assessment. Changing parent choices clears incompatible selections, preventing a Grade 7 assessment from remaining attached to a Grade 10 choice.

**5. The page asks for the report.** Once the assessment and assignment match, `getAssessmentResultsReportV3(testId, classAssignmentId, token)` sends `GET /api/v3/reports/assessment-results?testId=...&classAssignmentId=...`. The API client attaches the bearer token. Identifiers are references, not permission grants.

**6. The backend supplies the authoritative result.** The server must enforce session and access checks. The web consumes the returned scope, generation time, data status, summary, learner rows, and warnings. It does not grade the answers again in the browser.

**7. React redraws the page.** The response goes into state. React renders counts, maximum points, class means, and learner scores. A genuine `0` remains zero; missing numeric data displays `Not available`. `partial` does not mean complete, and `empty` does not mean every learner scored zero.

**8. Changes and failures remain visible.** Changing scope clears the old report and starts the relevant request. The effect's cleanup prevents an earlier response from replacing newer selections. Authorization, not-found, invalid-request, and service failures receive different states; authentication failure may return the user to login.

**9. Tables and charts serve different report views.** Assessment Results primarily shows the class-record table. Selecting an analysis view requests that view's data; `AnalyticsCharts` only draws the values passed to it. It does not independently discover or finalize scores.

**10. Downloading is another request.** PDF/Excel actions call backend export endpoints and download the returned blob. A visible report does not prove its export succeeds. An optional student row filter also does not automatically change a class-level export's scope.

The short version: **verified session -> valid scope -> authenticated report request -> backend result -> state update -> visible report**.

<div style="page-break-before: always;"></div>

## 10 likely panel questions and simple answers

### 1. What is React responsible for in Marka?

React displays the public website and working screens, remembers UI state, and responds to user actions. The backend owns permanent records, authorization, and official scoring. The web is not a direct database client.

### 2. How does the application switch pages?

`App.jsx` reads hash routes such as `#reports`, chooses the allowed page, and passes shared props. It uses custom navigation rather than React Router. Class and report context can accompany a navigation action.

### 3. What separates principal access from teacher access?

The app shows role-appropriate routes and controls. Teachers work with their assignments; principals manage school records and consolidated views. These UI restrictions improve usability, but backend authorization is the real security boundary.

### 4. Why keep requests in `apiV3Client.js`?

It centralizes the backend address, bearer token, query construction, JSON/blob handling, and errors. Pages can focus on workflow. Local and deployed environments must use the correct configured URL; the current client does not automatically detect a local backend.

### 5. Does a zero score mean the same thing as a missing score?

No. Zero is a recorded numeric value; null means unavailable data. Assessment Results preserves that difference and displays backend calculations. Chart normalization has a separate null-coercion caveat, so we should not claim identical handling everywhere.

### 6. Why is a V3 editor named `V2AssessmentEditorPage`?

The filename was retained during integration. The current editor imports `apiV3Client` and calls V3 assessment endpoints. Runtime imports and contracts are stronger evidence than a historical folder name.

### 7. Why distinguish a class from a class assignment?

A class is a learner group for a school year. A class assignment connects that group with a teacher and subject. Assessments and report requests need the correct assignment, especially when teachers handle several classes or subjects.

### 8. How does the dashboard identify learners needing support?

The teacher-support component requests a backend report for the selected term. It previews returned learners and links to fuller reports. It does not invent missing scores or independently decide official mastery outcomes.

### 9. Why can a report display while its download fails?

Screen data and exported files use different requests. Check the export's URL, HTTP status, content type, session, and deployed backend support. The questionnaire path has an additional PDF check; working answer-sheet printing does not prove questionnaire or report printing works.

### 10. What must another developer preserve or verify?

Preserve the shared compact layout, role boundaries, correct class context, and backend-authoritative values. Check current source and contracts before editing. Treat source presence, a local build, a pushed commit, deployment, and live end-to-end testing as separate milestones.

**Scope reminder:** This guide changes documentation only. It does not certify all adviser requirements as complete, fix the caveats noted above, change the UI, or verify the current production service.

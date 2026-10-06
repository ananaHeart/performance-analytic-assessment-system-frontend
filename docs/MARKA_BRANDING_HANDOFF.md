# Marka Branding Handoff

Date: 2026-10-06  
Applies to: frontend, mobile, and backend-generated documents  
Status: shared instructions documented; new logo implementation is pending

## 1. Read This First

This is the common branding reference for every AI or developer working on Marka. It records the user's requested direction, current source observations, scope boundaries, and the evidence required before calling the branding work complete.

Creating this document does not authorize an immediate implementation across all repositories. The current request is documentation only. Wait for the user to identify the next implementation step and owner before changing assets or application code.

- No logo asset, application code, backend code, mobile code, or database is changed by this document task.
- Existing compact UI changes in the frontend working tree are separate work. Preserve them.
- The Principal Teachers compact UI step is on hold while this handoff is prepared. Do not silently resume it as part of branding.
- A source file existing is not proof that its route, endpoint, export, or device build works at runtime.
- Record implemented, verified, partial, pending, and blocked work separately. Do not report proposed changes as completed.

## 2. User-Requested Direction

### Brand name

The shared product identity is **Marka**, for both teacher and principal experiences.

- Use `Marka` as the product wordmark, without a redundant `Dashboard` subtitle in the brand lockup.
- This does not remove the functional `Dashboard` navigation item, report titles, role labels, school names, or important field labels.
- Do not create different product identities for teacher and principal.
- The mobile application currently uses the display name `Marka Teacher`. This is an observed existing name, not an instruction to rename the installed application immediately. Confirm any app display-name change separately.
- Treat legacy `SMART` references as an audit list, not a global search-and-replace instruction. Technical identifiers and historical documents may legitimately retain that name.

### Logo

The user supplied a visual reference containing two versions of the same symbol and explicitly chose the **green version**:

- A thick green checkmark within a rounded, open square outline.
- Rounded stroke ends and corners.
- The outline is open toward the upper-right, where the rising checkmark extends.
- Use this direction to replace the graduation-cap symbol wherever the cap is being used as the Marka brand mark.
- The black version in the reference is not the chosen default. Do not independently switch surfaces to black, blue, or another logo color.
- Do not keep both the cap and the new mark together as competing product logos.

The reference was supplied in the conversation. A standalone approved master asset has not been established by this task, and the reference image is not embedded in this Markdown file. A receiving AI that cannot see the image must request it before recreating the logo.

### Decisions still required before asset production

1. The approved master artwork, or approval to prepare an exact-match candidate from the reference.
2. The exact green color value. Green is approved; no specific HEX value has been approved in this handoff. Existing greens in the repositories are not automatically the new logo color.
3. The final proportions, transparent bounds, and safe padding of the master asset.
4. Any special monochrome, dark-background, print-only, or platform launcher treatment.

Prepare one canonical master and obtain approval before each AI produces platform-specific versions. Do not let separate agents draw slightly different checkmarks.

## 3. Preserve the Existing UI

This is a branding change, not permission to redesign the system.

- Keep the existing layouts, container widths, compact spacing, typography, navigation, borders, and functional controls.
- Keep teacher and principal navigation appropriate to their existing layouts. They share a brand, not necessarily the same navigation structure.
- Replace the mark inside its existing visual slot. Preserve aspect ratio; do not stretch it or enlarge headers to accommodate it.
- Do not add large branding banners, additional cards, repeated headings, or instructional copy.
- Keep the teacher active-navigation underline and the existing principal active-state treatment.
- A static logo or statistic is not automatically a button. Do not add hover movement, a pointer cursor, or click behavior to a non-interactive element.
- Preserve existing home-link behavior where the brand is already a real link or button, including keyboard focus and accessible names.
- When a visible `Marka` wordmark already labels the same link, avoid duplicate screen-reader announcements from the adjacent mark.
- Preserve field labels, validation messages, report context, status information, and accessibility labels even while removing redundant branding text.

The current compact UI work is not a reason to restart the visual design. Inspect the live working tree before editing shared CSS.

## 4. Repository Ownership

| Side | Local repository | Responsibility |
| --- | --- | --- |
| Frontend | `D:\CAPSTONE_2\web-dashboard` | Teacher/principal web branding, public/auth branding, browser icon and title, client-owned print surfaces if any |
| Backend | `D:\CAPSTONE_2\backend\assessment` | Server-generated report branding, packaged assets, PDF/Excel rendering and relevant document templates |
| Mobile | `D:\ThesisProjects\MobileAssessmentApp` | In-app brand marks, authentication/loading surfaces, launcher/splash assets and mobile-owned generated/shared documents if any |

This document's canonical local location is:

`D:\CAPSTONE_2\web-dashboard\docs\MARKA_BRANDING_HANDOFF.md`

These local paths were present during the read-only inventory. Another AI or computer may not have access to them. Share the document and approved assets explicitly; a path alone does not grant access.

## 5. Current Source Observations

The observations below were checked on 2026-10-06. They are a targeted branding inventory, not a complete runtime audit. Re-check before implementation because other agents may be editing the same repositories.

### Frontend

Paths are relative to `D:\CAPSTONE_2\web-dashboard`.

| File | Observed relevance |
| --- | --- |
| `src/components/AppLayout.jsx` | Teacher and principal brand slots use Lucide `GraduationCap`; the visible brand text is already `Marka`. |
| `src/components/PublicAuthShell.jsx` | Public authentication brand uses the cap and still contains a `Dashboard` brand subtitle and `Marka Dashboard` accessible text. |
| `src/pages/LandingPage.jsx` | Public landing brand uses the cap and the Marka name. |
| `src/pages/LoginPage.jsx` | Contains `Log in to Marka Dashboard` and Marka footer text. Inspect the active rendering branch before changing copy. |
| `src/v2/V2LoginPage.jsx` | Contains a cap-based Marka login presentation. Confirm route reachability rather than assuming it is active. |
| `src/v2/V2Shell.jsx` | Contains Marka brand text; inspect whether this shell is reachable in the current app. |
| `public/favicon.svg` | Still contains the graduation-cap artwork. |
| `index.html` | References `/favicon.svg`; browser title is currently `Marka Dashboard`. |
| `src/styles/app-layout.css` | Shared compact layout and brand-slot sizing. Preserve the current dimensions and responsive behavior. |
| `src/components/MfaSecurityPanel.jsx` | Contains Marka wording in recovery-code output. Do not change MFA issuer/security behavior as a branding shortcut. |

`GraduationCap` also appears as a functional illustration for education-related data, for example in `PrincipalDashboard.jsx`, `ReportsPage.jsx`, and `TeacherApprovalPage.jsx`. Classify each occurrence before editing. A metric or report-tab icon is not necessarily the product logo. Do not blindly replace every icon import with the brand mark.

### Backend and generated reports

Paths below are relative to `D:\CAPSTONE_2\backend\assessment`.

Primary V3 report service directory:

`src/main/java/com/capstone/assessment/v3/report/service/`

| File | Observed relevance |
| --- | --- |
| `ReportPdfDocument.java` | Shared PDF document helper. Contains Marka header/footer text and a `drawLogo(...)` method that draws the cap geometry directly. |
| `ReportExcelSheet.java` | Shared Excel helper. Contains Marka header text and `logoPng()` that draws cap artwork into a cached PNG. |
| `V3ReportExportService.java` | Uses report helpers across export paths. Inventory actual supported export families before changing shared rendering. |
| `V3QuestionnairePdfRenderer.java` | Separate questionnaire renderer present in source. Inspect its own header and branding; do not assume the shared report helper covers it. |

Additional print paths to inspect, without assuming they are safe to modify:

- `src/main/java/com/capstone/assessment/v3/answersheet/service/V3AnswerSheetPdfRenderer.java`
- `src/main/java/com/capstone/assessment/v3/answersheet/service/dynamic/DynamicSheetPdfRenderer.java`
- Legacy report/questionnaire paths under `importexport/` and `v2/`, only if the application still uses them.
- Email templates or other generated user-facing documents, if they carry the product identity.

Important: changing the web favicon or React logo does not update the Java-generated PDF/Excel logos. Those renderers currently contain their own drawing code. The backend owner must explicitly account for that duplication and the Excel logo cache when implementing and verifying the replacement.

No backend export was generated or inspected at runtime for this handoff. File presence and source observations do not establish export availability or correctness.

### Mobile

Paths are relative to `D:\ThesisProjects\MobileAssessmentApp`.

| File or folder | Observed relevance |
| --- | --- |
| `src/components/LoginScreen.tsx` | Contains a `GraduationCap` brand presentation and visible `Marka Teacher` title. |
| `src/components/V3LoginFlow.tsx` | Login-flow file present; trace the active entry point before deciding which screen to update. |
| `src/components/LoginLoading.tsx` | Loading component present; inspect branding separately. |
| `app.json` | Existing `displayName` is `Marka Teacher`. Do not confuse display name with internal app registration identity. |
| `android/app/src/main/res/values/strings.xml` | Existing `app_name` is `Marka Teacher`. |
| `android/app/src/main/res/mipmap-*` | Launcher icon density assets and adaptive-icon definitions are present. |
| `android/app/src/main/res/drawable/ic_launcher_foreground.xml` and `ic_launcher_background.xml` | Android launcher foreground/background resources are present. |
| `ios/MobileAssessmentApp/LaunchScreen.storyboard` | iOS launch-screen file is present; this is not proof of a validated iOS build. |
| `ios/MobileAssessmentApp/Images.xcassets/AppIcon.appiconset/Contents.json` | iOS icon catalog entry is present; inspect required assets before claiming coverage. |

No mobile build, simulator, emulator, or physical-device branding check was performed for this handoff.

## 6. Asset Agreement

After the user approves the master asset, all owners should use the same asset revision.

Recommended deliverables, not yet created:

- `marka-mark.svg`: canonical vector geometry, if appropriate for the approved artwork.
- `marka-mark.png`: transparent raster export for consumers that need a bitmap.
- Platform-specific launcher/splash/favicon derivatives made from that master, not independent redraws.
- A small manifest recording asset revision, exact green value, viewBox or intrinsic dimensions, transparent padding, and SHA-256 checksums of delivered files.

The filenames above are proposed asset names, not existing paths. Record actual locations once created.

- Use local, packaged assets; do not introduce a runtime dependency on an external image URL.
- Preserve crisp edges at small navigation/favicon sizes and at print resolution.
- Preserve the supplied silhouette; a generic check icon is not automatically an approved substitute.
- Keep platform-specific rendering compatible with the existing stack. Do not add a new image/SVG dependency without first checking the current toolchain.
- If a renderer cannot consume the master format, derive an appropriate asset from the approved master and compare the output visually. Do not silently change the shape or color.
- An asset mismatch or unsupported renderer is a reported integration gap, not a reason to invent a new logo.

## 7. Protected Behavior and Data

Branding must not change:

- API URLs, ports, environment settings, contracts, endpoint names, or authentication behavior.
- Teacher ownership boundaries, principal permissions, school/class scope, or report filtering.
- Backend-authoritative scores, null handling, calculations, report totals, or analytics availability.
- V1, V2, or V3 database names, tables, migrations, persisted identifiers, or existing local data.
- Mobile package/application IDs, app-registration keys, signing configuration, update compatibility, or offline storage keys.
- OMR bubble positions, QR payloads, registration marks, scan geometry, template versions, calibration, evidence hashes, or synchronization behavior.
- Immutable scan evidence, stored historical reports, or previously issued answer sheets.

Do not overwrite original report/evidence files merely to display the new brand. If answer-sheet branding touches protected geometry or requires a new template version, stop and report that dependency before proceeding.

Do not add missing exports, result details, image previews, advanced analytics, or other unsupported functionality under the branding task. Report missing contracts separately.

## 8. Coordinated Implementation Route

The sequence below is a proposed execution route, not a claim that work has started.

1. **Read-only inventory.** Each owner checks their branch, dirty state, active entry points, brand occurrences, and generated-output paths. Preserve unrelated work.
2. **Master approval.** One designated owner prepares or receives the canonical artwork. The user approves shape/color before rollout.
3. **Frontend pass.** Replace confirmed product-brand marks on public/auth screens, teacher/principal shells, and browser identity. Preserve compact UI structure and functional navigation.
4. **Mobile pass.** Replace confirmed in-app brand marks and approved launcher/splash assets. Keep display-name changes separate if not yet approved.
5. **Backend pass.** Update brand rendering in supported generated documents, including shared PDF/Excel helpers and any separate active renderer. Keep data and page geometry stable.
6. **Cross-side verification.** Compare the same master revision across web, mobile, and newly generated reports. Record exact checks and limitations.
7. **Review before publishing.** Report file changes, tests, unresolved surfaces, and deployment requirements. Do not push, merge, deploy, or distribute a mobile build without the user's approval.

Agents should not edit each other's repositories at the same time without an explicit ownership agreement. A shared file is a coordination reference, not an automatic communication channel. Changes made in one chat are not automatically known to another AI.

## 9. Verification Checklist

### Frontend owner

- Check both teacher and principal shells, relevant public/auth pages, favicon, and browser title.
- Check desktop and narrow mobile widths at normal browser zoom.
- Confirm no clipping, stretch, text overlap, layout shift, or newly introduced decorative whitespace.
- Confirm existing home navigation, keyboard focus, active navigation, and accessible names still work.
- Run the relevant lint/build checks and inspect screenshots, not only source code.

### Mobile owner

- Confirm the actual login/loading and authenticated screens use the same approved asset revision.
- Verify launcher/adaptive icons and splash rendering on the platforms actually built.
- Confirm important controls and content are not displaced by the new mark.
- Distinguish Android verification from iOS verification; do not claim both from one platform's result.
- Confirm offline data, scan/sync workflows, and installed app identity are unchanged.

### Backend/report owner

- Identify each supported report family that uses the shared helpers and each separate renderer.
- Generate fresh PDF/Excel samples with synthetic or approved test data.
- Inspect first and continuation pages, headers/footers, print layout, logo sharpness, and school/report context.
- Check text, scores, totals, columns, page numbering, and existing content remain correct.
- Validate packaged asset availability after build/restart; a file working only from a developer's absolute path is not sufficient.
- Verify cached images and old browser/native assets are not masking the change.
- Do not call an export verified when only a DTO, unit test, or mock was checked. Label the evidence precisely.

### Completion gate

The branding route is complete only after the agreed surfaces have been inspected with the same approved artwork and any exclusions are disclosed. One changed header is not cross-platform completion.

## 10. Current Status and Next-Agent Report

| Work item | Status at document creation |
| --- | --- |
| Common handoff document | Created in the frontend `docs` folder |
| Green checkmark direction | Requested by the user |
| Exact color and canonical master artwork | Pending confirmation/approval |
| New logo files and derivatives | Not created by this task |
| Frontend logo replacement | Not performed by this task; inspected brand slots still use caps |
| Mobile logo replacement | Not performed by this task; inspected login still uses a cap |
| Backend report logo replacement | Not performed by this task; inspected PDF/Excel helpers still draw caps |
| Cross-platform runtime/print verification | Pending |
| Commit, push, deployment, or release | Not performed by this task |

Each implementing AI should return this concise report:

```text
Side: Frontend / Backend / Mobile
Repository and branch:
Approved scope:
Asset revision and actual asset paths:
Files changed:
Surfaces updated:
Checks performed and actual results:
Source-only / mocked / live / device / generated-document evidence:
Pending or unsupported surfaces:
Risks or coordination needs:
Commit/push/deployment status:
```

Suggested message when sharing this file with another AI:

> Read MARKA_BRANDING_HANDOFF.md before starting. Preserve the existing compact UI and all working behavior. The requested logo is the green checkmark/open rounded-square reference, replacing product-brand graduation caps across web, mobile, and supported generated reports. Start with your repository's read-only inventory and report gaps. Do not implement until the master asset and your assigned scope are approved. Do not assume this document proves cross-platform completion.

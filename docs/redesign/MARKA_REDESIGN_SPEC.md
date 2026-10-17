# Marka redesign, phase 1: light mode

Approved by Heart on 2026-10-17. Written by the designer session in the docs workspace; FRONTEND: STRONGAYST's PART_1 implements it.

Phase 1 covers the style fixes, the gray backgrounds, and the new tech stack page. Dark mode is phase 2 and starts only after Heart approves phase 1 in the browser.

## 0. Before you start

1. **Save Heart's pending work first.** Create branch `redesign/light-mode` from the current branch. Make one commit of Heart's current uncommitted source work before any redesign change, for example `chore: save pending work before redesign`. Include:
   - the modified tracked files: `App.jsx`, `apiV3Client.js`, `ReportsPage.jsx`, `TeacherDashboard.jsx`, `dashboard.css`, `global.css`, `reports.css`
   - the new source files: `TeacherStudentSupport.jsx`, `utils/studentSupport.js` with its test, and `api/apiV3Client.test.js`

   Leave `tmp/`, `output/`, `.codex/`, `*.patch` and `frontend_current.diff` untracked. If anything looks unfinished or unclear, ask Heart before committing it. Do not push.
2. **Keep these rules as they are** (Heart's fixed constraints):
   - Teacher content width is `min(100%, 1320px)` on every teacher page.
   - Reports filters sit above the results, never in a side column.
   - Teacher nav is exactly Dashboard / Class / Reports. Settings and logout stay behind the avatar.
   - No "recent notifications" or "quick actions" block on the teacher dashboard.
   - Principal pages have no footer. The teacher footer is only "© 2026 Marka".
   - Reports show backend data only: no client-side score math, and null scores never shown as 0.
3. **Leave the logo alone.** Don't change `marka-mark.svg`, the favicon, the branding docs or the hero images.
4. **Scope:** this phase changes colors, fonts, corner radius and backgrounds, plus the one new page. It doesn't restructure layouts or rewrite the override passes in `design-tokens.css`.

## 1. One color system

`design-tokens.css :root` becomes the single source of truth.

- `global.css :root`: for every variable that's still used, point it at the matching token, for example `--danger: var(--status-danger-text)`. Delete any variable that `design-tokens.css` already defines under the same name, and any that nothing reads.
- `system.css --ui-*`: map each one to the matching token, for example `--ui-primary: var(--primary)`, `--ui-brand: var(--brand)`, `--ui-border: var(--border)`, `--ui-foreground: var(--text)`. **This matters now:** the live assessment editor (`#assessment-setup`, which wraps `src/v2/V2AssessmentEditorPage.jsx`) is built with the shadcn components and Tailwind classes. After this mapping, the editor must look like the rest of the app.

### Final token values (light)

Rows marked **changed** or **new** differ from today.

| Token | Value | Status | Use |
|---|---|---|---|
| `--font-sans` | `"Inter Variable", "Inter", "Segoe UI", Arial, sans-serif` | changed | Fixes Inter not loading outside `.smart-ui`. `@fontsource-variable/inter` registers the name "Inter Variable". |
| `--app-bg` | `#f1f5f9` | changed | Page canvas (light gray) |
| `--page-bg` | `#f1f5f9` | changed | Page canvas (light gray) |
| `--surface` | `#ffffff` | same | Cards, panels, tables, modals, sidebar, top bar |
| `--surface-strong` | `#ffffff` | same | |
| `--surface-muted` | `#f8fafc` | same | Table header rows, card header strips, inner sections, read-only fields |
| `--border` | `#e2e8f0` | same | Card and table borders |
| `--border-strong` | `#cbd5e1` | same | Input borders, dividers that must show on gray |
| `--text` | `#0f172a` | same | Body text |
| `--muted` | `#5b6b80` | changed | Was `#64748b`, which is 4.35:1 on the gray page. The new value is about 5:1. |
| `--brand` | `#83e841` | **new** | Decorative: active-nav indicator bar, progress-bar fill, highlight strokes, logo tile accents. Never put white text on it. Dark text is fine with `--on-brand` (`#17320b`, about 10:1), as on the landing and auth hero buttons. |
| `--primary` | `#2f7d16` | changed | Was `#83e841`. Anything that carries text or icons: primary buttons, links, the selected-chip fill. White text on it is about 5.2:1. |
| `--primary-hover` | `#276912` | **new** | Primary button hover |
| `--primary-dark` | `#2f7d16` | same | Green text on light backgrounds |
| `--primary-soft` | `#f3fee8` | same | Selected rows and chips, success tints |
| `--primary-border` | `#c9f7a8` | same | |
| `--primary-ring` | `rgba(47, 125, 22, 0.28)` | changed | Focus glow. Also add `:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }` on buttons, links and inputs. |
| `--radius-card` | `8px` | same | |
| `--radius-control` | `8px` | same | |
| `--radius-modal` | `12px` | **new** | Modals and dialogs |
| `--radius-pill` | `999px` | same | |
| `--status-success-bg` / `-text` | `#dcfce7` / `#2f7d16` | same | |
| `--status-warning-bg` / `-text` | `#ffedd5` / `#c2410c` | same | |
| `--status-danger-bg` / `-text` | `#fee2e2` / `#b91c1c` | changed | Text was `#dc2626` (4.0:1 on its pill). Now about 5.4:1. |
| `--status-neutral-bg` / `-text` | `#f1f5f9` / `#475569` | same | On the gray page, give neutral pills a 1px `--border` so they don't disappear. |
| `--status-info-bg` / `-text` | `#dbeafe` / `#1d4ed8` | **new** | Info pills, if any |
| `--chart-success` | `#4a9f27` | changed | Was `#83e841` (1.6:1 against white, so bars were hard to see). Now about 3.3:1. |
| `--chart-warning` | `#d97706` | changed | Was `#f59e0b` (about 2.1:1) |
| `--chart-danger` | `#dc2626` | changed | Was `#ef4444` |
| `--chart-info` | `#2563eb` | same | |
| `--chart-track` / `--chart-grid` | `#eef2f7` / `#e5e7eb` | same | |

Keep the shadows (`--shadow-soft`, `--shadow-control` and the rest) as they are. The hard-offset "pressed" look is part of Marka's identity.

### Primary button rule

Audit every place `--primary` is used today. When the element carries text or an icon (buttons, links, chip fills), keep `var(--primary)`, which is now dark green. When it's decorative (bars, indicators, glows), switch it to `var(--brand)`. This is the main fix for the 1.6:1 button contrast.

## 2. Gray backgrounds

The goal is that every container is visible against the page.

- **Page canvas:** `--app-bg` / `--page-bg` (gray). This already flows through `html, body, #root` and `.dashboard-shell`.
- **White surfaces with a 1px `--border`:** cards, panels, tables, modals, the principal sidebar (right border), the teacher top bar (bottom border) and the principal topbar.
- **`--surface-muted`:** table header rows, card header strips, filter bars inside cards, read-only fields.
- **Inputs, selects and textareas:** white background with a 1px `--border-strong` border, so they're visible on both gray and white.
- **Watch for transparent containers** that relied on the white page, such as sections, filter rows and empty states. Either give them `--surface` and a border, or leave them on gray if they're page-level headings.
- **Footers:** transparent on gray. The teacher footer text uses `--muted`.
- **Landing page:** the hero stays as it is. The workflow section sits on gray, with white workflow items.
- **Auth pages** (login, register, verify email): gray page with a white form card.

## 3. Hard-coded colors and radius

- Replace hex literals in all live CSS with tokens: `global.css`, `reports.css`, `dashboard.css`, `classes.css`, `students.css`, `teachers.css`, `auth.css`, `landing.css`, `security.css`, `notifications.css`, `app-layout.css` and `v2-sf1-modal.css`. Map near-duplicates to the closest token. If a color is genuinely needed and has no token, add a token instead of leaving the literal.
- Skip the dead files: `v2-demo.css` and the `src/v2/*` pages that nothing routes to. **Not dead:** `v2-sf1-modal.css`, and `V2AssessmentEditorPage.jsx`, which is live through `AssessmentSetupPage.jsx`. Also replace any hex values or arbitrary Tailwind colors (`bg-[#...]`) in `V2AssessmentEditorPage.jsx` and `src/components/ui/*` with the `--ui-*` tokens.
- **Target:** `grep -nE "#[0-9a-fA-F]{3,8}\b" src/styles/*.css` only hits token blocks, dead files and comments. `rgba()` inside shadow tokens is fine.
- **`AnalyticsCharts.jsx`:** read colors from the CSS variables, for example with a small `getChartColors()` helper using `getComputedStyle(document.documentElement)`. Don't hard-code hex values, so phase 2 dark mode won't need chart edits.
- **Radius:**
  - Snap stray 6px and 7px values to `--radius-control`.
  - Snap 12–22px values to `--radius-card`, or to `--radius-modal` for dialogs.
  - Pills stay at `--radius-pill`.
  - Exception: landing hero imagery can keep its current radius.
- Commit per file or per group of files, so Heart can review and revert in small pieces.

## 4. Tech stack page

**Content:** `docs/redesign/techStack.js`. Copy it to `src/data/techStack.js`. It holds 54 items in 5 groups: 17 backend, 14 web dashboard, 18 mobile app, 3 deployment and 2 development tools. Definitions are Chapter III's wording; the file marks every edit and new item.

### Files and route
- `src/pages/TechStackPage.jsx`, `src/data/techStack.js` and `src/styles/tech-stack.css`. Import the CSS in `main.jsx` right after `landing.css`.
- Add a public hash route `#tech-stack`, handled like `#home`, with no login required. It's static data, so there are no API calls.
- Reuse the landing header and footer. Extract a small shared component, or reuse the same class names.

### Entry points
- **Landing header:** a "Tech stack" text link to the left of "Log in", in the same style as `.landing-login-link`.
- **Landing footer:** a "Tech stack" link.
- **On the tech stack page:** the brand goes to `#home`, plus a "Log in" link.
- Nothing is added to the teacher or principal app navigation.

### Layout
- Gray page. The content column is `min(100%, 1120px)`, centered, with a 24px gutter (16px at 640px and below).
- **Intro:**
  - Eyebrow: "Technical background"
  - h1: "Tech stack"
  - Lead: "The tools, frameworks, and services behind Marka's backend, web dashboard, and mobile app."
  - Below it, a row of small count pills, for example "17 backend", "14 web dashboard".
- **Controls row:**
  - Filter chips: All, Backend, Web dashboard, Mobile app, Deployment, Development tools.
  - Each chip is a `<button aria-pressed>`. The selected chip uses a `--primary-soft` background, a `--primary-border` border and `--primary-dark` text.
  - A search input with placeholder "Search technologies" filters by name and definition.
  - Show the result count in an `aria-live="polite"` line, for example "Showing 14 technologies".
- **Groups:**
  - One `<section>` per group, with an h2, the one-line description and the count.
  - Grid: `repeat(auto-fill, minmax(300px, 1fr))`, gap 16px.
  - With "All" selected, show every group in order: Backend, Web dashboard, Mobile app, Deployment, Development tools.
- **Card:**
  - `--surface`, a 1px `--border`, `--radius-card`, 16px padding and `--shadow-soft`.
  - Top row: a 36px icon tile (`--primary-soft` background, `--primary-dark` icon), with the name as an h3 (16px, weight 700).
  - Body: the definition at 14px, line-height 1.6, color `--text`.
  - No per-card links.
- **Group icons (lucide-react):** Backend `Server`, Web dashboard `LayoutDashboard`, Mobile app `Smartphone`, Deployment `Cloud`, Development tools `Wrench`.
- **Empty search:** "No match for "{query}". Try another name.", with a "Clear search" button.
- **At 640px and below:** one column, the chips wrap, the search is full width, and there's no horizontal scroll.

## 5. Check before handing back

1. `npm run build`, `npm run lint` and the existing tests all pass.
2. Open every live route at 1440px and at 375px, and check that nothing is unreadable, invisible or broken:
   - Public: `#home`, `#tech-stack`, `#login`, `#register`, `#verify-email`
   - Principal: dashboard, classes, students, teachers, reports (all 5 tabs), settings
   - Teacher: dashboard, class, assessment setup, reports, settings
   - Modals: SF1 import, student info, teacher approval confirmation, assignment delete
3. Take before and after screenshots of the principal dashboard, teacher dashboard, reports, login and the tech stack page, and save them in `docs/redesign/screenshots/` for Heart.
4. Confirm the six rules in section 0 still hold.
5. Report back: what changed, the screenshot paths, any hex literals left and why, and anything you weren't sure about.

## 6. Phase 2: dark mode

The full spec is now in `MARKA_DARK_MODE_SPEC.md` (approved by Heart on 2026-10-17). The outline below is kept for history.

This starts only after Heart approves phase 1. The plan:
- Add a `:root[data-theme="dark"]` token block. Example values: page `#0b1220`, surface `#111a2b`, surface-muted `#172135`, border `#263246`, text `#e2e8f0`, muted `#94a3b8`. The primary button becomes `#83e841` with `#0f172a` text.
- Default to the device setting (`prefers-color-scheme`), with a saved user choice.
- **Toggle (Heart's request, 2026-10-17):** "a sun and moon next to the notification bell". Use one icon button (lucide `Sun` / `Moon`) right beside the bell in the teacher top bar and the principal topbar, with `aria-label` "Switch to dark mode" or "Switch to light mode". Put the same button at the right of the public header, before "Log in". The teacher nav stays Dashboard / Class / Reports.

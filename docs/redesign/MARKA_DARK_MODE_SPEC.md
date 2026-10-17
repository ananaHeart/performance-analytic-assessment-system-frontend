# Marka redesign, phase 2: dark mode

Heart approved phase 1 and 1b on 2026-10-17 and said: "I approve phase 1 and 1b. Start dark mode (phase 2) with the sun and moon next to the notification bell."

Written by the designer session; FRONTEND implements it on `redesign/light-mode` (not pushed). Every rule from phases 1 and 1b still applies. Light mode must look exactly as it does now.

## 1. How the theme is chosen

- **Theme attribute:** `<html data-theme="light|dark">`.
- **Saved choice:** in `localStorage` key `marka-theme`. If nothing is saved, follow the device setting (`prefers-color-scheme`). While there's no saved choice, react live when the device setting changes.
- **No flash on load:** add a tiny inline script in `index.html` `<head>`, before the CSS. It reads the saved choice (inside `try/catch`, since storage can be blocked), falls back to `matchMedia('(prefers-color-scheme: dark)')`, and sets `data-theme`.
- **`src/lib/theme.js`:** `getTheme()`, `setTheme(theme)` (saves the choice and sets the attribute), and a `useTheme()` hook that re-renders subscribers when the theme changes.
- **Native controls:** add `color-scheme: light` on `:root` and `color-scheme: dark` on `:root[data-theme="dark"]`, so selects, scrollbars and date pickers follow the theme.
- **Printing stays light:** wrap the dark token block in `@media screen { ... }`, so printing or saving a page as PDF from a browser in dark mode still uses the light colors. Server-generated PDF and Excel exports aren't affected.

## 2. The toggle (sun and moon)

- **Component:** `src/components/ThemeToggle.jsx`, an icon button with lucide `Moon` in light mode and `Sun` in dark mode.
  - `aria-label` and `title`: "Switch to dark mode" or "Switch to light mode".
  - Same size, shape and hover as the notification bell button, so the two look like a pair.
- **Placement:**
  - **Teacher top bar:** right before the bell. Order: school year, sun/moon, bell, avatar.
  - **Principal topbar:** right before the bell. Order: sun/moon, bell, school year.
  - **Public header (PublicLayout):** right before "Log in" or "Go to dashboard". In the phone menu, it goes in the top bar next to the close button.
  - **PublicAuthShell** (login, register, verify email): right before "Back to home".
- The teacher nav stays exactly Dashboard / Class / Reports. Nothing is added to the avatar menu.

## 3. Dark token values

Put these in `design-tokens.css` as `@media screen { :root[data-theme="dark"] { ... } }`, right after the light `:root` block. Any token not listed keeps its light value: fonts, spacing, radius, `--hero-*`, `--qr-*`, and the avatar gradient start and end colors.

Every text pair below was checked: all are at least 4.5:1. Chart colors and `--text-faint` are at least 3:1 against `--surface`.

| Token | Dark value | Note |
|---|---|---|
| `--app-bg`, `--page-bg` | `#0b1220` | Page canvas |
| `--surface` | `#111a2b` | Cards, panels, tables, sidebar, top bars |
| `--surface-strong` | `#162033` | Modals and popovers, one step lighter |
| `--surface-muted` | `#172135` | Table headers and inner strips |
| `--surface-sunken` | `#0d1526` | Inset fills and disabled buttons |
| `--border` | `#263246` | |
| `--border-strong` | `#475569` | Inputs |
| `--text` | `#e2e8f0` | 14.1:1 on surface |
| `--text-secondary` | `#cbd5e1` | |
| `--muted` | `#94a3b8` | 6.8:1 on surface |
| `--text-faint` | `#64748b` | Disabled text and decorative icons only |
| `--placeholder` | `#8a99ae` | 6.0:1 on surface |
| `--brand` | `#83e841` | Same as light |
| `--brand-hover` | `#9af161` | |
| `--on-brand` | `#17320b` | |
| `--primary` | `#83e841` | Bright green fill, with dark text |
| `--primary-hover` | `#9af161` | Lighter on hover in dark |
| `--primary-dark` | `#a6ef75` | "Green text" becomes light green |
| `--primary-soft` | `#1a3010` | Selected rows and chips, success tints |
| `--primary-border` | `#3f6b1f` | |
| `--primary-ring` | `rgba(131, 232, 65, 0.35)` | |
| `--on-primary` | `#0f172a` | Dark text on green buttons, 11.6:1 |
| `--danger` | `#ef4444` | Works as button fill and as text, 4.6:1 on surface |
| `--danger-hover` | `#f87171` | |
| `--on-danger` | `#0f172a` | **New token.** Light value `#ffffff`. |
| `--status-success-bg` / `-text` | `#163a1f` / `#86efac` | |
| `--status-warning-soft` / `-bg` / `-border` / `-text` | `#2a1d0e` / `#3b2410` / `#6b3d14` / `#fdba74` | |
| `--status-danger-soft` / `-bg` / `-border` / `-text` | `#2a1215` / `#3f1619` / `#7f1d1d` / `#fca5a5` | |
| `--status-neutral-bg` / `-text` | `#1e293b` / `#cbd5e1` | |
| `--status-info-soft` / `-bg` / `-border` / `-text` | `#0f1d33` / `#172a4a` / `#1e3a6a` / `#93c5fd` | |
| `--tone-purple-bg` / `-border` / `-text` | `#241b3d` / `#4c3a8a` / `#c4b5fd` | |
| `--tone-teal-bg` / `-border` / `-text` | `#0f2a28` / `#115e59` / `#5eead4` | |
| `--avatar-female-soft` / `--avatar-male-soft` | `#3b1a2c` / `#172a4a` | |
| `--avatar-teacher-bg` / `-text` | `#3b2418` / `#fdba8c` | |
| `--chart-track` / `--chart-grid` | `#1e293b` / `#263246` | |
| `--chart-success` / `-warning` / `-danger` / `-info` | `#83e841` / `#f59e0b` / `#f87171` / `#60a5fa` | |
| `--shadow` | `0 4px 0 rgba(0, 0, 0, 0.45)` | The hard-offset style stays; only the color changes. |
| `--shadow-soft` | `0 2px 0 rgba(0, 0, 0, 0.35)` | |
| `--shadow-control` | `0 3px 0 rgba(0, 0, 0, 0.5)` | |
| `--shadow-control-hover` | `0 4px 0 rgba(0, 0, 0, 0.55)` | |
| `--shadow-input` | `0 2px 0 rgba(0, 0, 0, 0.3)` | |

`system.css`:
- Set `--ui-destructive-foreground: var(--on-danger)` in both modes. It's `--on-primary` today, which would put dark text on red in light mode.
- Add `--ui-shadow-md: 0 8px 24px rgb(0 0 0 / 0.4)` inside the same dark block.

## 4. Things to audit

- **Red buttons:** any place that puts `--on-primary` text on a `--danger` fill should switch to `--on-danger`.
- **Leftover literals:** search the live CSS and JSX for `white`, `black`, `#fff`, `rgba(255, 255, 255`, `rgb(255 255 255`, and inline `style` colors. If one paints a surface or text, map it to a token. Overlays and backdrops like `rgba(15, 23, 42, 0.5)` are fine in both modes.
- **Charts:** `AnalyticsCharts` must re-read `getChartColors()` when the theme changes, using `useTheme()`. Its `rgba()` tooltip-cursor overlay needs a dark version, for example `rgba(255, 255, 255, 0.06)`.
- **Logo:** the Marka mark must stay readable on dark surfaces. Don't edit the SVG. If its tile uses a token, the token handles it. If the tile is a light literal, keep it: a light tile on dark is fine.
- **QR code:** it stays dark on white in both modes. Keep the white quiet zone around it.
- **Hero images and the hero panel:** unchanged.
- **Assessment editor (shadcn and Tailwind):** it should follow automatically through `--ui-*`. Check its popovers, selects and date-time picker in dark.

## 5. Check before handing back

1. `npm run build` passes, tests pass, and lint stays at the 5-problem baseline.
2. **Light mode didn't change:** compare against the phase 1 and 1b screenshots. It should be pixel-identical apart from the new toggle button.
3. **Every live route in dark at 1440px and 375px:** no white flashes or white panels, no unreadable text, and no invisible borders or inputs. Include modals (SF1 import, student info, teacher approval, assignment delete), the editor's popovers and date picker, the charts with data, the notification panel, and the phone menu.
4. **Toggle behavior:**
   - The choice survives a reload.
   - With no saved choice, the site follows the device setting.
   - There's no light flash when a dark page loads.
   - The icon and `aria-label` switch.
   - It works with the keyboard.
5. **Print preview** of a page in dark mode comes out light.
6. **The QR still decodes** to the Drive URL in dark mode.
7. **Screenshots** in `docs/redesign/screenshots/`, named `dark-*`: principal dashboard, principal reports with a chart, teacher dashboard, the assessment editor, login, home, get-app and the user guide, each at 1440 and 375. Also the toggle close-up in both modes.
8. Send the designer session a report with what changed, anything left as a literal and why, and anything you weren't sure about.

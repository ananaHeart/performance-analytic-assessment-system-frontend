# Marka redesign, phase 1b: public website

Approved by Heart on 2026-10-17. Written by the designer session; FRONTEND: STRONGAYST's PART_1 implements it **after phase 1 is done**, on the same `redesign/light-mode` branch. Phase 1's tokens, gray backgrounds and rules all apply here.

**Page text:** `docs/redesign/PUBLIC_SITE_CONTENT.md`. Use that wording. Don't write new feature claims. If a claim seems wrong, tell the designer session instead of changing it.

## 1. Pages and routes

All pages are public hash routes with no login. Nothing changes in the teacher or principal app navigation.

| Route | Page | Notes |
|---|---|---|
| `#home` | Home | Keep the current hero. Replace the "One connected workflow" section with the new sections in the content file. |
| `#features` | Features | |
| `#get-app` | Get the app | The APK download page |
| `#guide` | User guide | One long page with a table of contents |
| `#tech-stack` | Tech stack | From phase 1 |
| `#about` | About us | Includes a Contact section (see section 4) |
| `#privacy` | Privacy notice | |
| anything unknown | 404 | "We couldn't find that page." with links to Home and User guide |

`#login`, `#register` and `#verify-email` keep `PublicAuthShell`. Add a small "Back to home" link to that shell if it doesn't already have one.

Set `document.title` per page, for example "Features · Marka" and "Get the app · Marka".

## 2. Shared public layout

Create `src/components/PublicLayout.jsx` with the header and footer. Use it for every page in section 1, and move the tech stack page onto it too.

### Header
- **Left:** the brand (mark plus "Marka"), linking to `#home`.
- **Middle (nav):** Features · Get the app · User guide · About. The current page's link is marked with `aria-current="page"` and gets a 2px `--brand` underline.
- **Right:** "Log in" (text button) and "Sign up" (primary button, `#register`).
- **Phone (900px and below):** the nav and both buttons go into a menu button (lucide `Menu`, `aria-expanded`, `aria-controls`). The menu opens as a full-width white panel under the header and closes on link click, Escape, or tapping outside.
- **Behavior:** the header is sticky, white, with a 1px bottom `--border`.
- **Tech stack:** the "Tech stack" header link from the phase 1 spec moves to the footer. The header doesn't get it.

### Footer
- White, with a 1px top `--border`.
- **Three link columns:**
  - Product: Features, Get the app, Tech stack
  - Help: User guide, Privacy notice
  - About: About us, Contact (opens `#about` and scrolls to the contact section)
- **Bottom row:** "© 2026 Marka" on the left. On the right: "A capstone project of Holy Trinity College of General Santos City".
- **Phone:** the columns stack.

## 3. App download (`#get-app` and the Home app section)

The APK is shared from Google Drive, and the link will change after today's rebuild. Make the link **one setting**, so updating it never touches page code.

- Create `src/config/appRelease.js`:

  ```js
  export const APP_RELEASE = {
    // Google Drive share link (Heart, 2026-10-17: Marka-2026-10-07.apk, the cloud build).
    // It may change after today's rebuild; then update this line or set VITE_APK_URL.
    url: import.meta.env.VITE_APK_URL ||
      'https://drive.google.com/file/d/1r9HawQ1YID3OFYRKNU5dVJNpwhXY7qAa/view?usp=sharing',
    version: '',                                // leave empty: every build so far is "1.1-scanner-test"
    size: 'about 33 MB',                        // from MOBILE, 2026-10-17; update after each rebuild
    minAndroid: 'Android 7.0 or later',         // minSdk 24
    updated: '',                                // for example 'October 17, 2026'
  }
  ```

  If a value is empty, hide its line. Don't show "undefined" or a blank label.
- **Download button:** "Download APK" (lucide `Download`). It opens `APP_RELEASE.url` in a new tab with `rel="noopener"`. Google Drive shows its own download page, and that's expected.
- **QR code:** generate it from the same `APP_RELEASE.url` when the page loads, so it always matches the button. Use the `qrcode` npm package to render an SVG, with no network calls. Sizes: 160px on the Get the app page and 132px in the Home section. Caption: "On a laptop? Scan this with your phone to download the app." Hide the QR on screens under 640px, since the visitor is already on a phone.
- **No link yet:** if `url` is empty, show a "Download link coming soon" note in place of the button and the QR. Don't show a disabled button.
- **Updating the link:** document this in `README.md` under "App download link": set `VITE_APK_URL` on Render and redeploy, or edit `appRelease.js`. Also add this tip: in Google Drive, replace the old APK with **Manage versions → Upload new version**. That keeps the same share link, so the website never needs to change.

### Get the app page layout
1. A hero card in the same layout as the Home app section: text and steps on the left, the QR on the right.
2. **Requirements**: a short list.
3. **How to install**: numbered steps with short notes, from the content file. No screenshots for now; leave room to add them.
4. **Before you scan**: a short checklist that links to the scanning tips in the user guide.
5. **Questions**: the app FAQ items from the content file, as a `<details>` accordion.

## 4. Other page layouts

- **Content width:** `min(100%, 1120px)`, centered, with a 24px gutter (16px at 640px and below).
- **Page backgrounds:** every page is gray, with white cards and a 1px `--border`.
- **Features:**
  - An intro block.
  - Two columns of cards headed "For teachers" and "For principals". They stack on phones.
  - A "How checking works" band with the 4-step flow.
  - A "What Marka doesn't do" card. It's honest, and panels like it.
- **User guide:**
  - A sticky table of contents on the left (240px) at 1024px and up. On smaller screens it becomes a "Jump to section" select at the top.
  - Sections use `id` anchors. Scroll with `scrollIntoView` instead of changing the hash, because the hash is the router.
  - Steps are numbered lists.
  - Warnings use a callout: `--status-warning-bg` with `--status-warning-text`.
  - FAQ items use `<details>`.
- **About us:**
  - Study intro.
  - The problem, as a short story with 2 stat callouts from the content file.
  - Team cards: initials avatar with a `--primary-soft` circle and `--primary-dark` initials, then name and role.
  - Adviser card.
  - School card (Holy Trinity College, CETE, BSIT).
  - Acknowledgment.
  - A contact section with `id="contact"`. It's driven by `src/config/site.js` (`CONTACT_EMAIL = 'smartassessment.notifications@gmail.com'`), and the privacy notice uses the same constant. If the value is ever emptied, show "For questions about this study, contact the researchers through the College of Engineering and Technology Education, Holy Trinity College of General Santos City."
- **Privacy notice:**
  - A plain text page at a max width of 760px.
  - "Last updated" date at the top.
  - Headings and short paragraphs, from the content file.

## 5. Home page sections, in order

1. The current hero, unchanged. The hero's "Get started" goes to `#register`, as today.
2. **How Marka works:** 4 steps across (2×2 on tablets, stacked on phones). Each step has a small "Web" or "App" tag, so it's clear which part happens where.
3. **Features:** 4 highlight cards with a "See all features" link to `#features`.
4. **App section:** see section 3 and the mockup in the content file.
5. **Final call to action:** "Ready to start?" with buttons "Create your teacher account" (primary, `#register`) and "Log in" (secondary).

## 6. Sharing details

- `index.html`:
  - `<title>Marka</title>`
  - meta description: "Marka checks paper answer sheets with your phone and turns the results into item analysis and least mastered skills for teachers and principals."
  - Open Graph title, description and image
- **Preview image:** add `public/og-image.png` (1200×630), made from the logo and hero. Ask the designer session if you'd rather not make it.

## 7. Check before handing back

- `npm run build` and `npm run lint` pass.
- Every new route at 1440px and 375px: no horizontal scroll, the mobile menu opens and closes, and keyboard Tab order makes sense.
- The QR scans correctly with a real phone camera when a test URL is set. Remove the test URL afterward.
- The empty-link state shows "Download link coming soon".
- Screenshots of each new page go in `docs/redesign/screenshots/`.
- The teacher and principal app pages are unchanged by this phase.

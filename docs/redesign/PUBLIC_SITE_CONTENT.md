# Marka public website: page content

The text for the phase 1b pages (see `MARKA_PUBLIC_SITE_SPEC.md`). Written by the designer session on 2026-10-17 from:
- the manuscript (Chapters I and III)
- the live web labels
- facts from the BACKEND and MOBILE sessions, checked read-only against their code the same day

**Markers:**
- `{appRelease.x}`: filled from `src/config/appRelease.js`.
- Heart answered all open items on 2026-10-17: team roles, naming the partner school, the contact email and the APK link.

Style rules for all pages:
- Sentence case for headings and buttons.
- Say "learners" on public pages, matching DepEd usage.
- Say "term" in general text. Only the calendar setting mentions that a school can use quarters instead.
- Quote app labels exactly as shown below, including "Send Saved Result to Backend".

---

## Home

The hero stays as it is today.

### How Marka works
- Eyebrow: How Marka works
- Heading: Paper tests in, clear next steps out.
- Steps:
  1. **Set up your assessment.** Tag: Web. Build the test, its answer key, essay rubrics, and the skill each item measures. Then print the bubble answer sheets.
  2. **Download your class.** Tag: App. While you're online, log in to the Marka app and open your assessment, so your class and its answer key are saved on your phone.
  3. **Scan and check.** Tag: App. Photograph each answer sheet. Multiple choice and true or false answers are read for you. You review every sheet and score the written answers. No internet needed.
  4. **See the results.** Tag: Web. After you send your results from the app, Marka computes the official scores and builds the item analysis and least mastered skills here on the web.

Card and step titles have no final period; the bold-plus-period format above is only for this file.

### Feature highlights
Each card has an icon, a title and one line.
- `ScanLine` **Scan paper answer sheets.** Your phone's camera reads the shaded bubbles on Marka's printed answer sheets.
- `WifiOff` **Check without internet.** Scan and check anywhere, then send the results when you're online.
- `BarChart3` **Item analysis, done for you.** See how each item performed and which skills your class has least mastered.
- `School` **Reports for the whole school.** Principals see results by teacher, term, and learning competency, and export them to PDF or Excel.
- Link: See all features

### App section
- Eyebrow: Marka for Android
- Heading: Start on the web. Scan with your phone.
- Body: Marka works in two parts. You set up your classes and assessments here, then check answer sheets with the Marka app. Scanning works without internet, and you send the results when you're back online.
- Steps:
  1. Sign up here on the web and wait for your principal's approval
  2. Create your assessment and print the answer sheets
  3. Install the app, log in with the same account, and scan
  4. Send your results, then see the reports here
- Buttons: **Download APK** (primary), **How to install** (secondary, goes to `#get-app`)
- Meta line: Android only · {appRelease.minAndroid} · {appRelease.size}. Don't show a version number: every build so far has the same one.
- QR caption: On a laptop? Scan this with your phone to download the app.
- Small note: For teachers. Principals use Marka on a computer.

### Final call to action
- Heading: Ready to start?
- Body: Create your teacher account. Once your principal approves it, you can set up your first assessment.
- Buttons: **Create your teacher account** (primary), **Log in** (secondary)

---

## Features

- Eyebrow: Features
- Heading: Everything between the test paper and the next lesson
- Lead: Marka keeps paper tests. It takes over the checking, recording, and analysis, so teachers can spend that time on teaching.

### For teachers
1. **Build assessments on the web.** Mix multiple choice, true or false, identification, enumeration, and essay items. Add the answer key, essay rubrics (and reuse them by name), and the learning competency each group of items measures.
2. **Print ready-to-scan answer sheets.** Marka makes a bubble answer sheet for each assessment, with corner markers and a QR code so the app knows exactly which test and page it's looking at. You can print the test questionnaire too.
3. **Scan with your phone.** The app reads shaded multiple choice and true or false answers from a photo of each page, in portrait or landscape.
4. **Check without internet.** Once your class and answer key are on your phone, you can scan and check anywhere. Results stay on your phone until you send them.
5. **You stay in control.** Every sheet needs your review before it counts. You score identification, enumeration, and essay answers from a picture of each written answer, with your rubric for essays.
6. **Item analysis and least mastered skills.** After you send results, Marka shows how each item performed and each skill's mastery level (Mastered, Developing, or Needs Support), and lists the learners who need support on each skill.
7. **Suggested next steps.** Each skill gets a suggestion based on its mastery: Maintain, Review, Reteach, or Priority Intervention.
8. **Export your class record.** Download your results as PDF or Excel.

### For principals
1. **Approve teachers and classes.** New teacher accounts, classes, and subject assignments all go through you.
2. **Import learners from SF1.** Upload the school's DepEd School Form 1 to add learners, or add and edit them one at a time.
3. **School-wide reports.** See results by teacher, term, and learning competency, plus each learner's performance profile.
4. **Consolidated report.** One printable report of school results that lists the least mastered competencies, with a signature line.
5. **Teacher sync activity.** See when each teacher's results came in from the app.
6. **Export everything.** Download any report as PDF or Excel, or download all of a teacher's assessments at once.

### Security band (one row of small items)
- Principal approval for every teacher account
- Email verification
- Optional authenticator app with recovery codes
- Sign-ins on the phone kept encrypted on the device

### How checking works
Reuse the 4 steps from Home.

### What Marka doesn't do
- It doesn't run online tests. Learners still answer on paper.
- It doesn't read handwriting. You score identification, enumeration, and essay answers yourself.
- It doesn't compute final grades, and its class record isn't the DepEd e-Class Record.
- There's no student or parent portal.
- The app runs on Android only.

---

## Get the app

- Heading: Get the Marka app
- Lead: The Marka app is how teachers check answer sheets. It's shared as an APK file through Google Drive, not the Play Store.
- Callout (info): You need an approved teacher account first. Sign up on the web, wait for your principal's approval, then log in to the app with the same email and password.
- Then the same buttons, QR and meta line as the Home app section.

### Requirements
- An Android phone running {appRelease.minAndroid}
- A working camera
- Internet to log in, download your class, and send results
- About {appRelease.size} of free space

### How to install
1. Open this page on your Android phone, or scan the QR code with it.
2. Tap **Download APK**. Google Drive opens the file. Tap **Download**.
3. Google Drive or your browser may warn that the file might be harmful. This happens with any app that doesn't come from the Play Store. Tap **Download anyway**.
4. Open the downloaded file from your notifications or your Downloads folder.
5. If Android asks, allow the app you're using (Drive, Chrome, or Files) to **Install unknown apps**, then go back and tap **Install**.
6. If Google Play Protect warns about an unknown app, tap **More details**, then **Install anyway**.
7. Open Marka and log in with your teacher email and password.

### Updating the app
- Callout (warning): Never uninstall Marka to update it. Uninstalling deletes any results on your phone that you haven't sent yet.
- To update, download the new APK from this page and install it over the old one. Your saved results stay on the phone.

### Before you scan
- Your assessment is activated on the web.
- You logged in to the app and opened the assessment once while online, so its answer key is saved on your phone.
- The answer sheets were printed from Marka for this assessment, on the paper size they were made for, with the edges untrimmed.
- Learners shaded one bubble per item.
- Link: Read the scanning tips (goes to the user guide's scanning tips section)

### Questions (accordion)
- **Is Marka on the Play Store?** No. It's shared as an APK file from this page.
- **Is there an iPhone version?** No. Marka runs on Android only.
- **Can principals use the app?** No. The app is for teachers. Principals use Marka on a computer.
- **Do I need internet?** Only to log in, download your class and answer key, and send results. Scanning and checking work offline.
- **Can I sign up in the app?** No. Accounts are created on the web. Sign up here first.
- **Is the score on my phone final?** No. The app shows a preliminary score while you check. The official score comes from Marka's server after you send the result, and only official scores appear in reports.

---

## User guide

- Heading: User guide
- Lead: How to set up Marka, check answer sheets, and read your reports.

**Table of contents:**
1. Getting started
2. For principals
3. Setting up an assessment
4. Checking answer sheets with the app
5. Scanning tips
6. Reading your reports
7. Account and security
8. FAQ and troubleshooting

### 1. Getting started
Marka has two roles:
- **Principal:** approves teachers, manages classes and learners, and sees school-wide reports. Principal accounts are set up by the school, and principals use Marka on a computer.
- **Teacher:** builds assessments on the web, checks answer sheets with the Android app, and reads class reports on the web.

**Creating a teacher account:**
1. Select **Sign up** and fill in your teacher profile.
2. Verify your email with the code Marka sends you. If your school has turned on phone verification, you'll also get a code by SMS.
3. Wait for your principal to approve your account. You'll be able to log in after that.

Callout (info): Sign-ups that aren't verified are removed after 30 days.

### 2. For principals
**Approve teachers**
- Open **Teachers** to see new sign-ups.
- Open a teacher's details, then choose **Approve teacher** or **Reject teacher**.

**Set up classes**
- In **Classes**, select **Create class** to add a grade and section.
- Choose **Add a class assignment** to assign a teacher and subject to it.

**Add learners**
- In **Students**, choose **Import students (SF1)** and upload the DepEd School Form 1 file. Marka saves each learner's LRN, name, and sex.
- You can also add a learner manually, or edit one with **Edit Student Profile**.

**Read reports**
- Open **Reports**, pick a report, and set the filters above the results.
- Every report can be exported to PDF or Excel, and you can download all of a teacher's assessments at once.

**School year**
- Set the academic calendar in **Settings**. Your school can use three terms or four quarters.

### 3. Setting up an assessment (teachers)
1. Open your class from **Dashboard** or **Class**, then choose **Create Assessment**.
2. **Assessment details:** enter the assessment name and type, the term, and when it opens and closes.
3. **Configure test parts:** add a part for each item type (multiple choice, true or false, identification, enumeration, or essay), with the number of items and the points per item.
4. **Encode questions:** enter each question and its correct answer.
   - For identification and enumeration, add accepted-answer variants.
   - For essays, create a rubric or use an existing one.
5. **Configure competency mapping:** assign item ranges (from item, to item) to the learning competency they measure.
6. Select **Create draft assessment** and check the configuration summary.
7. Select **Activate** when it's ready.
8. **Print:**
   - Open the Bubble Answer Sheet PDF and print one for each learner.
   - You can also open the Test Questionnaire PDF.

Callout (warning): Print the answer sheet on the paper size it was made for, and don't trim the edges. The app needs all four corner markers and the QR code.

### 4. Checking answer sheets with the app (teachers)
**Log in and download**
1. While online, open Marka and log in with your email or username and your password. Your classes download automatically.
   - If the server has been idle, logging in can take 1–2 minutes while it wakes up.
2. In the **Classes** tab, tap your class, then tap the assessment. Do this once while online so the answer key is saved on your phone.
   - To download again later, tap the refresh icon at the top right of **Classes**.

**Scan a learner's sheet**
3. Under **Select test student**, tap a learner. You can search by name.
4. Tap **Open Camera** to take a photo of the page, or **Choose Photo** to use one you already took.
   - For sheets with more than one page, the app asks for each page in turn, for example "Scan page 1 of 2".

**Review and save**
5. On **Review & Verify**:
   - Check the **Objective answers**. Blank and multiple marks are flagged. If an answer was misread, choose **Discard All and Rescan**.
   - Under **Written-response evidence**, score each written answer as right or wrong, with partial points, or with the rubric.
   - The banner shows a preliminary score as you go.
6. Tap **Accept and Save Result**. It appears once every page is scanned and every written answer is scored. The result is now saved on your phone.
7. Tap **Next Student** and repeat.
   - Learners who were absent stay "Not checked".

**Send**
8. When you're online, tap **Send Saved Result to Backend** for one learner, or **Send All Saved Results** for the whole list.
   - The learner's row then shows the official score.
   - After you send a result, you can't edit it on the phone.
9. On the web, open **Reports** to see the official results.

Callout (info): Before you send, you can still change written-answer scores with **Edit Scores**, or rescan with **Discard & Rescan**.

### 5. Scanning tips
- Use the answer sheet printed from Marka for the assessment you have open. A sheet from a different assessment won't be accepted.
- Keep the whole page in the photo, with all four corner markers and the QR code visible.
- Lay the page flat. Hold the phone parallel to it, close enough that the page fills about half the photo.
- Use bright, even light. Keep your phone's shadow off the page, and move away from lights that reflect on the paper.
- Hold the phone steady so the photo isn't blurry.
- Portrait, landscape, or upside down are all fine. The app reads the QR code in any direction.
- An item with more than one shaded bubble, or a mark the app can't read clearly, counts as no answer.

### 6. Reading your reports
Reports only use official results: sheets you reviewed and sent, scored by Marka's server.
- **Assessment Results / Class Record:** each learner's raw score, percentage, and performance level.
- **Item Analysis and Competency Mastery:** how each item performed, each skill's mastery level, and the learners who need support on each skill.
- **Individual Student Performance Profile:** one learner's results across assessments, with suggestions.
- **Learning Competency:** mastery for each competency across assessments.
- **Principal Consolidated Report** (principals): school results in one printable report, listing the least mastered competencies.
- **Teacher Sync Activity:** when each teacher's results were sent from the app.

**Suggestions**

| Suggestion | Mastery |
|---|---|
| Maintain | 80% and above |
| Review | 60% to below 80% |
| Reteach | 40% to below 60% |
| Priority Intervention | Below 40% |

### 7. Account and security
To add an authenticator app (optional):
1. Go to **Settings** and choose **Add an authenticator app**.
2. Scan the QR code with an authenticator app on your phone.
3. Save your recovery codes somewhere safe. You'll need one if you lose your phone.

When you log in to the app with an authenticator turned on, enter the 6-digit code, or a recovery code, then tap **Verify**.

Sign-in sessions end after 8 hours, so you'll need to log in again after that.

### 8. FAQ and troubleshooting
- **My account is still pending.** Your principal needs to approve it first.
- **The app says "Account not active yet."** Your principal hasn't approved your account yet.
- **The app says "Teacher accounts only."** You're logging in with a principal account. Use Marka on a computer instead.
- **I didn't get the verification email.** Check your spam folder. If it still isn't there, ask your principal for help.
- **The app doesn't show my assessment.** Make sure it's activated on the web, then tap the refresh icon in **Classes** while you're online.
- **"Four registration markers were not found."** Keep the whole page in the photo, flat, with all four corners visible.
- **"Scanned page does not match the selected assignment."** You're scanning a sheet from a different assessment. Open the right one first.
- **My results aren't on the web yet.** Open the app while you're online and send your saved results.
- **Can I change a result after sending?** Not on the phone. Check each sheet before you send it.
- **Does an absent learner block the assessment?** No. They stay "Not checked". The assessment just won't show as complete.

---

## About us

- Eyebrow: About us
- Heading: Built by IT students for public school teachers
- Lead: Marka is the capstone project of three Bachelor of Science in Information Technology students at Holy Trinity College of General Santos City.

### The study
**A Mobile and Web Performance Analytic Assessment System.** We named the system Marka.

### The problem
In many provincial public schools, tests are still checked, tallied, and recorded by hand. Teachers at San Roque National High School told us checking takes one to two hours per section, and item analysis is often skipped because it takes too long. Without it, it's hard to know which skills need to be taught again.

Stat callouts:
- **1–2 hours** to check one section by hand
- **1 phone** to check them with Marka. No special checking machine needed.

### What we built
Marka keeps paper tests. It uses a phone camera to check them and turns the results into item analysis and least mastered skills, so teachers and principals can decide what to teach next.

### The team
Cards show initials, name and role.
- **HA:** Heart M. Añana. Frontend and mobile developer
- **KB:** Kent John B. Baja. Backend developer
- **LS:** Lovely May B. Sumalinog. Documentation

### Adviser
Prof. Leonila R. Juanatas, MIT, capstone adviser

### School
- Holy Trinity College of General Santos City
- College of Engineering and Technology Education
- Bachelor of Science in Information Technology

### Acknowledgment
We thank the principal and teachers of San Roque National High School for their time, feedback, and classrooms.

### Contact
- Heading: Contact
- Body: For questions about Marka or this study, email us at smartassessment.notifications@gmail.com.
- Show the address as a `mailto:` link.

---

## Privacy notice

Note for Heart: the facts below were checked against the backend code on 2026-10-17. Have your adviser review this page before it goes live. It isn't legal advice.

- Heading: Privacy notice
- Last updated: October 17, 2026

### Intro
Marka is a research system developed for a capstone study at Holy Trinity College of General Santos City. This notice explains what personal data Marka handles, why, and how it's protected, in line with the Data Privacy Act of 2012 (Republic Act No. 10173).

### Who is responsible
The researchers of this study (Heart M. Añana, Kent John B. Baja, and Lovely May B. Sumalinog) are responsible for the personal data processed in Marka.

### What Marka collects

**Teachers:**
- Name, birth date, sex, email, contact number, address, educational attainment, major, and when you started teaching.
- Your password is stored only in scrambled (hashed) form.
- If you turn on an authenticator app, its secret is stored encrypted, and your recovery codes are stored hashed.

**Principals:** the account details the school sets up.

**Sign-in and security records:** for teachers and principals, sign-in attempts and sessions, including IP address, device, and browser, plus a log of account actions. These help keep accounts safe.

**Learners:**
- From the school's SF1: LRN, first name, last name, and sex only. The SF1 file itself isn't kept.
- Class enrollment and status.
- Answers, scores, performance levels, and skill mastery.

**Scanned answer sheets:**
- Photos of scanned pages, and cropped images of written answers for teacher checking.
- On the current hosting, these image files are erased whenever the server restarts or goes to sleep after about 15 minutes without use. Scores and records are kept.

### Why
To check assessments, compute scores, produce reports for teachers and the principal, verify accounts, and keep sign-ins secure. Marka doesn't use personal data for advertising and doesn't sell it.

### Who can see it
- Teachers see only their own classes, assessments, and those learners' results.
- The principal sees their own school's data. Each school's data is kept separate.
- Learners and parents don't have accounts.

### Services that help run Marka
- **Render** hosts Marka's server and website.
- **TiDB Cloud** stores the database, in Singapore.
- **Brevo** delivers verification emails. It receives your email address and the code.
- **Twilio** sends SMS verification codes, only if phone verification is turned on. It receives your mobile number.
- On teachers' phones, downloaded class data and unsent results are stored in the app, and the sign-in session is kept encrypted.

### How long it's kept
- Teacher sign-ups that are never verified are deleted after 30 days.
- Sign-in sessions end after 8 hours.
- Other records are kept for the duration of the study. Accounts, classes, and assessments can be archived or rejected, but aren't permanently deleted from inside the app. To ask for deletion, email us (see Your rights below).
- The database has a daily backup that's kept for one day.

### Your rights
Under the Data Privacy Act you have the right to:
- be informed
- access your data
- object
- have your data corrected, erased, or blocked
- data portability
- damages

You can also file a complaint with the National Privacy Commission. To use these rights, or to ask for your data to be deleted, email smartassessment.notifications@gmail.com.

### Changes
We'll update this page when Marka's data handling changes, and change the date above.

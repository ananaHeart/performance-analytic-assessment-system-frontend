import PublicLayout from '../components/PublicLayout'
import { Callout } from '../components/PublicBlocks'

const SECTIONS = [
  { id: 'getting-started', label: 'Getting started' },
  { id: 'for-principals', label: 'For principals' },
  { id: 'setting-up-an-assessment', label: 'Setting up an assessment' },
  { id: 'checking-answer-sheets', label: 'Checking answer sheets with the app' },
  { id: 'scanning-tips', label: 'Scanning tips' },
  { id: 'reading-your-reports', label: 'Reading your reports' },
  { id: 'account-and-security', label: 'Account and security' },
  { id: 'faq', label: 'FAQ and troubleshooting' },
]

const SUGGESTIONS = [
  ['Maintain', '80% and above'],
  ['Review', '60% to below 80%'],
  ['Reteach', '40% to below 60%'],
  ['Priority Intervention', 'Below 40%'],
]

const FAQ = [
  ['My account is still pending.', 'Your principal needs to approve it first.'],
  ['The app says "Account not active yet."', "Your principal hasn't approved your account yet."],
  ['The app says "Teacher accounts only."', "You're logging in with a principal account. Use Marka on a computer instead."],
  ["I didn't get the verification email.", "Check your spam folder. If it still isn't there, ask your principal for help."],
  ["The app doesn't show my assessment.", "Make sure it's activated on the web, then tap the refresh icon in Classes while you're online."],
  ['"Four registration markers were not found."', 'Keep the whole page in the photo, flat, with all four corners visible.'],
  ['"Scanned page does not match the selected assignment."', "You're scanning a sheet from a different assessment. Open the right one first."],
  ["My results aren't on the web yet.", "Open the app while you're online and send your saved results."],
  ['Can I change a result after sending?', 'Not on the phone. Check each sheet before you send it.'],
  ['Does an absent learner block the assessment?', 'No. They stay "Not checked". The assessment just won\'t show as complete.'],
]

// The hash is the router, so table-of-contents links scroll instead of changing the URL.
function scrollToSection(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function GuideSection({ id, number, title, children }) {
  return (
    <section className="site-card public-guide-section public-anchor" id={id} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>
        <span className="public-guide-number">{number}.</span> {title}
      </h2>
      {children}
    </section>
  )
}

function GuidePage({ onNavigate, scrollTarget }) {
  return (
    <PublicLayout currentPage="guide" title="User guide" scrollTarget={scrollTarget} onNavigate={onNavigate}>
      <div className="public-content">
        <header className="public-page-intro">
          <h1>User guide</h1>
          <p className="public-lead">How to set up Marka, check answer sheets, and read your reports.</p>
        </header>

        <div className="public-guide-layout">
          <nav className="public-guide-toc" aria-label="User guide sections">
            <p className="public-guide-toc-title">Contents</p>
            <ol>
              {SECTIONS.map((section) => (
                <li key={section.id}>
                  <button type="button" onClick={() => scrollToSection(section.id)}>
                    {section.label}
                  </button>
                </li>
              ))}
            </ol>
          </nav>

          <label className="public-guide-jump">
            <span>Jump to section</span>
            <select
              value=""
              onChange={(event) => {
                if (event.target.value) scrollToSection(event.target.value)
              }}
            >
              <option value="">Choose a section</option>
              {SECTIONS.map((section, index) => (
                <option key={section.id} value={section.id}>
                  {index + 1}. {section.label}
                </option>
              ))}
            </select>
          </label>

          <div className="public-guide-body">
            <GuideSection id="getting-started" number={1} title="Getting started">
              <p>Marka has two roles:</p>
              <ul>
                <li>
                  <strong>Principal:</strong> approves teachers, manages classes and learners, and sees school-wide
                  reports. Principal accounts are set up by the school, and principals use Marka on a computer.
                </li>
                <li>
                  <strong>Teacher:</strong> builds assessments on the web, checks answer sheets with the Android app,
                  and reads class reports on the web.
                </li>
              </ul>
              <h3>Creating a teacher account</h3>
              <ol>
                <li>Select <strong>Sign up</strong> and fill in your teacher profile.</li>
                <li>
                  Verify your email with the code Marka sends you. If your school has turned on phone verification,
                  you&apos;ll also get a code by SMS.
                </li>
                <li>Wait for your principal to approve your account. You&apos;ll be able to log in after that.</li>
              </ol>
              <Callout tone="info">Sign-ups that aren&apos;t verified are removed after 30 days.</Callout>
            </GuideSection>

            <GuideSection id="for-principals" number={2} title="For principals">
              <h3>Approve teachers</h3>
              <ul>
                <li>Open <strong>Teachers</strong> to see new sign-ups.</li>
                <li>
                  Open a teacher&apos;s details, then choose <strong>Approve teacher</strong> or{' '}
                  <strong>Reject teacher</strong>.
                </li>
              </ul>
              <h3>Set up classes</h3>
              <ul>
                <li>In <strong>Classes</strong>, select <strong>Create class</strong> to add a grade and section.</li>
                <li>Choose <strong>Add a class assignment</strong> to assign a teacher and subject to it.</li>
              </ul>
              <h3>Add learners</h3>
              <ul>
                <li>
                  In <strong>Students</strong>, choose <strong>Import students (SF1)</strong> and upload the DepEd School
                  Form 1 file. Marka saves each learner&apos;s LRN, name, and sex.
                </li>
                <li>You can also add a learner manually, or edit one with <strong>Edit Student Profile</strong>.</li>
              </ul>
              <h3>Read reports</h3>
              <ul>
                <li>Open <strong>Reports</strong>, pick a report, and set the filters above the results.</li>
                <li>
                  Every report can be exported to PDF or Excel, and you can download all of a teacher&apos;s assessments
                  at once.
                </li>
              </ul>
              <h3>School year</h3>
              <ul>
                <li>Set the academic calendar in <strong>Settings</strong>. Your school can use three terms or four quarters.</li>
              </ul>
            </GuideSection>

            <GuideSection id="setting-up-an-assessment" number={3} title="Setting up an assessment (teachers)">
              <ol>
                <li>
                  Open your class from <strong>Dashboard</strong> or <strong>Class</strong>, then choose{' '}
                  <strong>Create Assessment</strong>.
                </li>
                <li>
                  <strong>Assessment details:</strong> enter the assessment name and type, the term, and when it opens
                  and closes.
                </li>
                <li>
                  <strong>Configure test parts:</strong> add a part for each item type (multiple choice, true or false,
                  identification, enumeration, or essay), with the number of items and the points per item.
                </li>
                <li>
                  <strong>Encode questions:</strong> enter each question and its correct answer.
                  <ul>
                    <li>For identification and enumeration, add accepted-answer variants.</li>
                    <li>For essays, create a rubric or use an existing one.</li>
                  </ul>
                </li>
                <li>
                  <strong>Configure competency mapping:</strong> assign item ranges (from item, to item) to the learning
                  competency they measure.
                </li>
                <li>Select <strong>Create draft assessment</strong> and check the configuration summary.</li>
                <li>Select <strong>Activate</strong> when it&apos;s ready.</li>
                <li>
                  <strong>Print:</strong>
                  <ul>
                    <li>Open the Bubble Answer Sheet PDF and print one for each learner.</li>
                    <li>You can also open the Test Questionnaire PDF.</li>
                  </ul>
                </li>
              </ol>
              <Callout tone="warning">
                Print the answer sheet on the paper size it was made for, and don&apos;t trim the edges. The app needs
                all four corner markers and the QR code.
              </Callout>
            </GuideSection>

            <GuideSection id="checking-answer-sheets" number={4} title="Checking answer sheets with the app (teachers)">
              <h3>Log in and download</h3>
              <ol>
                <li>
                  While online, open Marka and log in with your email or username and your password. Your classes
                  download automatically.
                  <ul>
                    <li>If the server has been idle, logging in can take 1–2 minutes while it wakes up.</li>
                  </ul>
                </li>
                <li>
                  In the <strong>Classes</strong> tab, tap your class, then tap the assessment. Do this once while
                  online so the answer key is saved on your phone.
                  <ul>
                    <li>To download again later, tap the refresh icon at the top right of <strong>Classes</strong>.</li>
                  </ul>
                </li>
              </ol>
              <h3>Scan a learner&apos;s sheet</h3>
              <ol start={3}>
                <li>Under <strong>Select test student</strong>, tap a learner. You can search by name.</li>
                <li>
                  Tap <strong>Open Camera</strong> to take a photo of the page, or <strong>Choose Photo</strong> to use
                  one you already took.
                  <ul>
                    <li>For sheets with more than one page, the app asks for each page in turn, for example &quot;Scan page 1 of 2&quot;.</li>
                  </ul>
                </li>
              </ol>
              <h3>Review and save</h3>
              <ol start={5}>
                <li>
                  On <strong>Review &amp; Verify</strong>:
                  <ul>
                    <li>
                      Check the <strong>Objective answers</strong>. Blank and multiple marks are flagged. If an answer
                      was misread, choose <strong>Discard All and Rescan</strong>.
                    </li>
                    <li>
                      Under <strong>Written-response evidence</strong>, score each written answer as right or wrong,
                      with partial points, or with the rubric.
                    </li>
                    <li>The banner shows a preliminary score as you go.</li>
                  </ul>
                </li>
                <li>
                  Tap <strong>Accept and Save Result</strong>. It appears once every page is scanned and every written
                  answer is scored. The result is now saved on your phone.
                </li>
                <li>
                  Tap <strong>Next Student</strong> and repeat.
                  <ul>
                    <li>Learners who were absent stay &quot;Not checked&quot;.</li>
                  </ul>
                </li>
              </ol>
              <h3>Send</h3>
              <ol start={8}>
                <li>
                  When you&apos;re online, tap <strong>Send Saved Result to Backend</strong> for one learner, or{' '}
                  <strong>Send All Saved Results</strong> for the whole list.
                  <ul>
                    <li>The learner&apos;s row then shows the official score.</li>
                    <li>After you send a result, you can&apos;t edit it on the phone.</li>
                  </ul>
                </li>
                <li>On the web, open <strong>Reports</strong> to see the official results.</li>
              </ol>
              <Callout tone="info">
                Before you send, you can still change written-answer scores with <strong>Edit Scores</strong>, or rescan
                with <strong>Discard &amp; Rescan</strong>.
              </Callout>
            </GuideSection>

            <GuideSection id="scanning-tips" number={5} title="Scanning tips">
              <ul>
                <li>
                  Use the answer sheet printed from Marka for the assessment you have open. A sheet from a different
                  assessment won&apos;t be accepted.
                </li>
                <li>Keep the whole page in the photo, with all four corner markers and the QR code visible.</li>
                <li>Lay the page flat. Hold the phone parallel to it, close enough that the page fills about half the photo.</li>
                <li>
                  Use bright, even light. Keep your phone&apos;s shadow off the page, and move away from lights that
                  reflect on the paper.
                </li>
                <li>Hold the phone steady so the photo isn&apos;t blurry.</li>
                <li>Portrait, landscape, or upside down are all fine. The app reads the QR code in any direction.</li>
                <li>An item with more than one shaded bubble, or a mark the app can&apos;t read clearly, counts as no answer.</li>
              </ul>
            </GuideSection>

            <GuideSection id="reading-your-reports" number={6} title="Reading your reports">
              <p>Reports only use official results: sheets you reviewed and sent, scored by Marka&apos;s server.</p>
              <ul>
                <li>
                  <strong>Assessment Results / Class Record:</strong> each learner&apos;s raw score, percentage, and
                  performance level.
                </li>
                <li>
                  <strong>Item Analysis and Competency Mastery:</strong> how each item performed, each skill&apos;s
                  mastery level, and the learners who need support on each skill.
                </li>
                <li>
                  <strong>Individual Student Performance Profile:</strong> one learner&apos;s results across
                  assessments, with suggestions.
                </li>
                <li><strong>Learning Competency:</strong> mastery for each competency across assessments.</li>
                <li>
                  <strong>Principal Consolidated Report</strong> (principals): school results in one printable report,
                  listing the least mastered competencies.
                </li>
                <li><strong>Teacher Sync Activity:</strong> when each teacher&apos;s results were sent from the app.</li>
              </ul>
              <h3>Suggestions</h3>
              <div className="public-table-wrap">
                <table className="public-table">
                  <thead>
                    <tr>
                      <th scope="col">Suggestion</th>
                      <th scope="col">Mastery</th>
                    </tr>
                  </thead>
                  <tbody>
                    {SUGGESTIONS.map(([suggestion, mastery]) => (
                      <tr key={suggestion}>
                        <td>{suggestion}</td>
                        <td>{mastery}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </GuideSection>

            <GuideSection id="account-and-security" number={7} title="Account and security">
              <p>To add an authenticator app (optional):</p>
              <ol>
                <li>Go to <strong>Settings</strong> and choose <strong>Add an authenticator app</strong>.</li>
                <li>Scan the QR code with an authenticator app on your phone.</li>
                <li>Save your recovery codes somewhere safe. You&apos;ll need one if you lose your phone.</li>
              </ol>
              <p>
                When you log in to the app with an authenticator turned on, enter the 6-digit code, or a recovery
                code, then tap <strong>Verify</strong>.
              </p>
              <p>Sign-in sessions end after 8 hours, so you&apos;ll need to log in again after that.</p>
            </GuideSection>

            <GuideSection id="faq" number={8} title="FAQ and troubleshooting">
              <div className="public-accordion">
                {FAQ.map(([question, answer]) => (
                  <details key={question}>
                    <summary>{question}</summary>
                    <p>{answer}</p>
                  </details>
                ))}
              </div>
            </GuideSection>
          </div>
        </div>
      </div>
    </PublicLayout>
  )
}

export default GuidePage

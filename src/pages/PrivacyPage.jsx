import PublicLayout from '../components/PublicLayout'
import { CONTACT_EMAIL, CONTACT_FALLBACK, SCHOOL_NAME } from '../config/site'

function PrivacyPage({ onNavigate, scrollTarget, isSignedIn }) {
  return (
    <PublicLayout currentPage="privacy" isSignedIn={isSignedIn} title="Privacy notice" scrollTarget={scrollTarget} onNavigate={onNavigate}>
      <div className="public-content">
        <article className="site-card public-privacy">
          <h1>Privacy notice</h1>
          <p className="public-updated">Last updated: October 17, 2026</p>

          <p>
            Marka is a research system developed for a capstone study at {SCHOOL_NAME}. This notice explains what
            personal data Marka handles, why, and how it&apos;s protected, in line with the Data Privacy Act of 2012
            (Republic Act No. 10173).
          </p>

          <h2>Who is responsible</h2>
          <p>
            The researchers of this study (Heart M. Añana, Kent John B. Baja, and Lovely May B. Sumalinog) are
            responsible for the personal data processed in Marka.
          </p>

          <h2>What Marka collects</h2>
          <h3>Teachers</h3>
          <ul>
            <li>
              Name, birth date, sex, email, contact number, address, educational attainment, major, and when you
              started teaching.
            </li>
            <li>Your password is stored only in scrambled (hashed) form.</li>
            <li>
              If you turn on an authenticator app, its secret is stored encrypted, and your recovery codes are
              stored hashed.
            </li>
          </ul>
          <h3>Principals</h3>
          <p>The account details the school sets up.</p>
          <h3>Sign-in and security records</h3>
          <p>
            For teachers and principals, sign-in attempts and sessions, including IP address, device, and browser,
            plus a log of account actions. These help keep accounts safe.
          </p>
          <h3>Learners</h3>
          <ul>
            <li>From the school&apos;s SF1: LRN, first name, last name, and sex only. The SF1 file itself isn&apos;t kept.</li>
            <li>Class enrollment and status.</li>
            <li>Answers, scores, performance levels, and skill mastery.</li>
          </ul>
          <h3>Scanned answer sheets</h3>
          <ul>
            <li>Photos of scanned pages, and cropped images of written answers for teacher checking.</li>
            <li>On the current hosting, these image files are erased whenever the server restarts or goes to sleep after about 15 minutes without use. Scores and records are kept.</li>
          </ul>

          <h2>Why</h2>
          <p>
            To check assessments, compute scores, produce reports for teachers and the principal, verify accounts,
            and keep sign-ins secure. Marka doesn&apos;t use personal data for advertising and doesn&apos;t sell it.
          </p>

          <h2>Who can see it</h2>
          <ul>
            <li>Teachers see only their own classes, assessments, and those learners&apos; results.</li>
            <li>The principal sees their own school&apos;s data. Each school&apos;s data is kept separate.</li>
            <li>Learners and parents don&apos;t have accounts.</li>
          </ul>

          <h2>Services that help run Marka</h2>
          <ul>
            <li><strong>Render</strong> hosts Marka&apos;s server and website.</li>
            <li><strong>TiDB Cloud</strong> stores the database, in Singapore.</li>
            <li><strong>Brevo</strong> delivers verification emails. It receives your email address and the code.</li>
            <li>
              <strong>Twilio</strong> sends SMS verification codes, only if phone verification is turned on. It
              receives your mobile number.
            </li>
            <li>
              On teachers&apos; phones, downloaded class data and unsent results are stored in the app, and the
              sign-in session is kept encrypted.
            </li>
          </ul>

          <h2>How long it&apos;s kept</h2>
          <ul>
            <li>Teacher sign-ups that are never verified are deleted after 30 days.</li>
            <li>Sign-in sessions end after 8 hours.</li>
            <li>
              Other records are kept for the duration of the study. Accounts, classes, and assessments can be
              archived or rejected, but aren&apos;t permanently deleted from inside the app. To ask for deletion,
              email us (see Your rights below).
            </li>
            <li>The database has a daily backup that&apos;s kept for one day.</li>
          </ul>

          <h2>Your rights</h2>
          <p>Under the Data Privacy Act you have the right to:</p>
          <ul>
            <li>be informed</li>
            <li>access your data</li>
            <li>object</li>
            <li>have your data corrected, erased, or blocked</li>
            <li>data portability</li>
            <li>damages</li>
          </ul>
          {CONTACT_EMAIL ? (
            <p>
              You can also file a complaint with the National Privacy Commission. To use these rights, or to ask for
              your data to be deleted, email{' '}
              <a className="public-inline-link" href={`mailto:${CONTACT_EMAIL}`}>
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          ) : (
            <p>
              You can also file a complaint with the National Privacy Commission. {CONTACT_FALLBACK}
            </p>
          )}

          <h2>Changes</h2>
          <p>We&apos;ll update this page when Marka&apos;s data handling changes, and change the date above.</p>
        </article>
      </div>
    </PublicLayout>
  )
}

export default PrivacyPage

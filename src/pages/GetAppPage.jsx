import { ArrowRight } from 'lucide-react'
import PublicLayout from '../components/PublicLayout'
import { AppSection, Callout } from '../components/PublicBlocks'
import { APP_RELEASE } from '../config/appRelease'
import { linkTo } from '../utils/publicNav'

const INSTALL_STEPS = [
  { text: 'Open this page on your Android phone, or scan the QR code with it.' },
  { text: 'Tap', strong: 'Download APK', after: '. Google Drive opens the file. Tap', strong2: 'Download', after2: '.' },
  {
    text: "Google Drive or your browser may warn that the file might be harmful. This happens with any app that doesn't come from the Play Store. Tap",
    strong: 'Download anyway',
    after: '.',
  },
  { text: 'Open the downloaded file from your notifications or your Downloads folder.' },
  {
    text: "If Android asks, allow the app you're using (Drive, Chrome, or Files) to",
    strong: 'Install unknown apps',
    after: ', then go back and tap',
    strong2: 'Install',
    after2: '.',
  },
  {
    text: 'If Google Play Protect warns about an unknown app, tap',
    strong: 'More details',
    after: ', then',
    strong2: 'Install anyway',
    after2: '.',
  },
  { text: 'Open Marka and log in with your teacher email and password.' },
]

const BEFORE_YOU_SCAN = [
  'Your assessment is activated on the web.',
  'You logged in to the app and opened the assessment once while online, so its answer key is saved on your phone.',
  'The answer sheets were printed from Marka for this assessment, on the paper size they were made for, with the edges untrimmed.',
  'Learners shaded one bubble per item.',
]

const APP_FAQ = [
  { question: 'Is Marka on the Play Store?', answer: "No. It's shared as an APK file from this page." },
  { question: 'Is there an iPhone version?', answer: 'No. Marka runs on Android only.' },
  { question: 'Can principals use the app?', answer: 'No. The app is for teachers. Principals use Marka on a computer.' },
  {
    question: 'Do I need internet?',
    answer: 'Only to log in, download your class and answer key, and send results. Scanning and checking work offline.',
  },
  { question: 'Can I sign up in the app?', answer: 'No. Accounts are created on the web. Sign up here first.' },
  {
    question: 'Is the score on my phone final?',
    answer:
      "No. The app shows a preliminary score while you check. The official score comes from Marka's server after you send the result, and only official scores appear in reports.",
  },
]

function InstallStep({ step }) {
  return (
    <>
      {step.text}
      {step.strong ? (
        <>
          {' '}
          <strong>{step.strong}</strong>
          {step.after}
        </>
      ) : null}
      {step.strong2 ? (
        <>
          {' '}
          <strong>{step.strong2}</strong>
          {step.after2}
        </>
      ) : null}
    </>
  )
}

function GetAppPage({ onNavigate, scrollTarget }) {
  const requirements = [
    APP_RELEASE.minAndroid ? `An Android phone running ${APP_RELEASE.minAndroid}` : 'An Android phone',
    'A working camera',
    'Internet to log in, download your class, and send results',
    APP_RELEASE.size ? `About ${APP_RELEASE.size.replace(/^about\s+/i, '')} of free space` : '',
  ].filter(Boolean)

  return (
    <PublicLayout currentPage="get-app" title="Get the app" scrollTarget={scrollTarget} onNavigate={onNavigate}>
      <div className="public-content">
        <AppSection
          id="get-app-title"
          titleAs="h1"
          title="Get the Marka app"
          lead="The Marka app is how teachers check answer sheets. It's shared as an APK file through Google Drive, not the Play Store."
          callout={
            <Callout tone="info">
              You need an approved teacher account first. Sign up on the web, wait for your principal&apos;s
              approval, then log in to the app with the same email and password.
            </Callout>
          }
          qrSize={160}
          secondaryAction={
            <a
              className="secondary-button"
              href="#get-app"
              onClick={linkTo(onNavigate, 'get-app', { scrollTo: 'how-to-install' })}
            >
              How to install
            </a>
          }
        />

        <section className="public-card public-text-card" aria-labelledby="get-app-requirements">
          <h2 id="get-app-requirements">Requirements</h2>
          <ul className="public-check-list">
            {requirements.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="public-card public-text-card public-anchor" id="how-to-install" aria-labelledby="get-app-install">
          <h2 id="get-app-install">How to install</h2>
          <ol className="public-numbered-list">
            {INSTALL_STEPS.map((step) => (
              <li key={step.text}>
                <InstallStep step={step} />
              </li>
            ))}
          </ol>
        </section>

        <section className="public-card public-text-card" aria-labelledby="get-app-updating">
          <h2 id="get-app-updating">Updating the app</h2>
          <Callout tone="warning">
            Never uninstall Marka to update it. Uninstalling deletes any results on your phone that you
            haven&apos;t sent yet.
          </Callout>
          <p>To update, download the new APK from this page and install it over the old one. Your saved results stay on the phone.</p>
        </section>

        <section className="public-card public-text-card" aria-labelledby="get-app-before-scan">
          <h2 id="get-app-before-scan">Before you scan</h2>
          <ul className="public-check-list">
            {BEFORE_YOU_SCAN.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <a className="public-text-link" href="#guide" onClick={linkTo(onNavigate, 'guide', { scrollTo: 'scanning-tips' })}>
            Read the scanning tips <ArrowRight size={16} aria-hidden="true" />
          </a>
        </section>

        <section className="public-section" aria-labelledby="get-app-questions">
          <h2 id="get-app-questions" className="public-section-title">Questions</h2>
          <div className="public-accordion">
            {APP_FAQ.map((item) => (
              <details key={item.question}>
                <summary>{item.question}</summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </section>
      </div>
    </PublicLayout>
  )
}

export default GetAppPage

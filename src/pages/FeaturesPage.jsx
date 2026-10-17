import { KeyRound, Lock, MailCheck, UserRoundCheck } from 'lucide-react'
import PublicLayout from '../components/PublicLayout'
import { HowItWorksSteps } from '../components/PublicBlocks'

const TEACHER_FEATURES = [
  {
    title: 'Build assessments on the web.',
    body: 'Mix multiple choice, true or false, identification, enumeration, and essay items. Add the answer key, essay rubrics (and reuse them by name), and the learning competency each group of items measures.',
  },
  {
    title: 'Print ready-to-scan answer sheets.',
    body: "Marka makes a bubble answer sheet for each assessment, with corner markers and a QR code so the app knows exactly which test and page it's looking at. You can print the test questionnaire too.",
  },
  {
    title: 'Scan with your phone.',
    body: 'The app reads shaded multiple choice and true or false answers from a photo of each page, in portrait or landscape.',
  },
  {
    title: 'Check without internet.',
    body: 'Once your class and answer key are on your phone, you can scan and check anywhere. Results stay on your phone until you send them.',
  },
  {
    title: 'You stay in control.',
    body: 'Every sheet needs your review before it counts. You score identification, enumeration, and essay answers from a picture of each written answer, with your rubric for essays.',
  },
  {
    title: 'Item analysis and least mastered skills.',
    body: "After you send results, Marka shows how each item performed and each skill's mastery level (Mastered, Developing, or Needs Support), and lists the learners who need support on each skill.",
  },
  {
    title: 'Suggested next steps.',
    body: 'Each skill gets a suggestion based on its mastery: Maintain, Review, Reteach, or Priority Intervention.',
  },
  {
    title: 'Export your class record.',
    body: 'Download your results as PDF or Excel.',
  },
]

const PRINCIPAL_FEATURES = [
  {
    title: 'Approve teachers and classes.',
    body: 'New teacher accounts, classes, and subject assignments all go through you.',
  },
  {
    title: 'Import learners from SF1.',
    body: "Upload the school's DepEd School Form 1 to add learners, or add and edit them one at a time.",
  },
  {
    title: 'School-wide reports.',
    body: "See results by teacher, term, and learning competency, plus each learner's performance profile.",
  },
  {
    title: 'Consolidated report.',
    body: 'One printable report of school results that lists the least mastered competencies, with a signature line.',
  },
  {
    title: 'Teacher sync activity.',
    body: "See when each teacher's results came in from the app.",
  },
  {
    title: 'Export everything.',
    body: "Download any report as PDF or Excel, or download all of a teacher's assessments at once.",
  },
]

const SECURITY_ITEMS = [
  { icon: UserRoundCheck, label: 'Principal approval for every teacher account' },
  { icon: MailCheck, label: 'Email verification' },
  { icon: KeyRound, label: 'Optional authenticator app with recovery codes' },
  { icon: Lock, label: 'Sign-ins on the phone kept encrypted on the device' },
]

const LIMITS = [
  "It doesn't run online tests. Learners still answer on paper.",
  "It doesn't read handwriting. You score identification, enumeration, and essay answers yourself.",
  "It doesn't compute final grades, and its class record isn't the DepEd e-Class Record.",
  "There's no student or parent portal.",
  'The app runs on Android only.',
]

function FeatureColumn({ id, title, features }) {
  return (
    <section className="site-card public-feature-column" aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      <ol className="public-feature-list">
        {features.map((feature) => (
          <li key={feature.title}>
            <h3>{feature.title}</h3>
            <p>{feature.body}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}

function FeaturesPage({ onNavigate, scrollTarget }) {
  return (
    <PublicLayout currentPage="features" title="Features" scrollTarget={scrollTarget} onNavigate={onNavigate}>
      <div className="public-content">
        <header className="public-page-intro">
          <p className="public-eyebrow">Features</p>
          <h1>Everything between the test paper and the next lesson</h1>
          <p className="public-lead">
            Marka keeps paper tests. It takes over the checking, recording, and analysis, so teachers can spend
            that time on teaching.
          </p>
        </header>

        <div className="public-feature-columns">
          <FeatureColumn id="features-teachers" title="For teachers" features={TEACHER_FEATURES} />
          <FeatureColumn id="features-principals" title="For principals" features={PRINCIPAL_FEATURES} />
        </div>

        <ul className="public-security-band" aria-label="Security">
          {SECURITY_ITEMS.map(({ icon: Icon, label }) => (
            <li key={label}>
              <Icon size={18} strokeWidth={2.2} aria-hidden="true" />
              {label}
            </li>
          ))}
        </ul>

        <section className="public-section" aria-labelledby="features-how-title">
          <h2 id="features-how-title" className="public-section-title">How checking works</h2>
          <HowItWorksSteps />
        </section>

        <section className="site-card public-limits-card" aria-labelledby="features-limits-title">
          <h2 id="features-limits-title">What Marka doesn&apos;t do</h2>
          <ul>
            {LIMITS.map((limit) => (
              <li key={limit}>{limit}</li>
            ))}
          </ul>
        </section>
      </div>
    </PublicLayout>
  )
}

export default FeaturesPage

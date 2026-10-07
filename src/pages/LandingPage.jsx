import {
  BarChart3,
  ClipboardCheck,
  RefreshCw,
  Sparkles,
  UserPlus,
} from 'lucide-react'
import landingHero from '../assets/landing-hero.png'
import MarkaMark from '../components/MarkaMark'

const WORKFLOW_STEPS = [
  {
    title: 'Prepare assessments',
    description: 'Build structured assessments for the classes and subjects you handle.',
    icon: ClipboardCheck,
    tone: 'green',
  },
  {
    title: 'Review and synchronize',
    description: 'Bring verified classroom results into one dependable school record.',
    icon: RefreshCw,
    tone: 'blue',
  },
  {
    title: 'Act on evidence',
    description: 'See mastery patterns and identify the teaching action needed next.',
    icon: BarChart3,
    tone: 'amber',
  },
]

function LandingPage({ onNavigate }) {
  return (
    <main className="landing-page">
      <header className="landing-header">
        <button
          type="button"
          className="landing-brand"
          onClick={() => onNavigate('home')}
          aria-label="Marka home"
        >
          <span className="landing-brand-mark" aria-hidden="true">
            <MarkaMark size={22} />
          </span>
          <span className="landing-brand-copy">
            <strong>Marka</strong>
          </span>
        </button>

        <nav className="landing-header-actions" aria-label="Account access">
          <button type="button" className="landing-login-link" onClick={() => onNavigate('login')}>
            Log in
          </button>
        </nav>
      </header>

      <section
        className="landing-hero"
        style={{ '--landing-hero-image': `url(${landingHero})` }}
        aria-labelledby="landing-title"
      >
        <div className="landing-hero-overlay" aria-hidden="true" />
        <div className="landing-hero-inner">
          <div className="landing-hero-copy">
            <p className="landing-eyebrow">Welcome to Marka</p>
            <h1 id="landing-title">Marka</h1>
            <p className="landing-hero-lead">
              Scan, score, and see how every learner is doing.
            </p>
            <p className="landing-hero-pitch">
              <Sparkles size={19} strokeWidth={2.2} aria-hidden="true" />
              <span>
                Try our powerful analysis system: see which competencies your class has mastered
                and which learners need help next.
              </span>
            </p>

            <div className="landing-hero-actions">
              <button
                type="button"
                className="landing-secondary-action"
                onClick={() => onNavigate('register')}
              >
                <UserPlus size={18} strokeWidth={2.2} aria-hidden="true" />
                Get started
              </button>
            </div>

            <p className="landing-access-note">
              For teachers. Your school principal approves new accounts.
            </p>
          </div>
        </div>
      </section>

      <section className="landing-workflow" aria-labelledby="landing-workflow-title">
        <div className="landing-section-inner">
          <div className="landing-workflow-heading">
            <p className="landing-section-label">One connected workflow</p>
            <h2 id="landing-workflow-title">From checked papers to clear next steps.</h2>
          </div>

          <div className="landing-workflow-list">
            {WORKFLOW_STEPS.map(({ title, description, icon: Icon, tone }, index) => (
              <article className="landing-workflow-item" key={title}>
                <span className={`landing-workflow-icon is-${tone}`} aria-hidden="true">
                  <Icon size={21} strokeWidth={2.1} />
                </span>
                <div>
                  <span className="landing-workflow-number">0{index + 1}</span>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <footer className="landing-footer">
        <span>© 2026 Marka</span>
        <span>Built for evidence-informed teaching.</span>
      </footer>
    </main>
  )
}

export default LandingPage

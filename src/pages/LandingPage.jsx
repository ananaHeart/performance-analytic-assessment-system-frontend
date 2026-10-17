import { ArrowRight, BarChart3, ScanLine, School, Sparkles, UserPlus, WifiOff } from 'lucide-react'
import landingHero from '../assets/landing-hero.png'
import PublicLayout from '../components/PublicLayout'
import { AppSection, HowItWorksSteps } from '../components/PublicBlocks'
import { FEATURE_HIGHLIGHTS } from '../data/publicSite'
import { linkTo } from '../utils/publicNav'

const HIGHLIGHT_ICONS = { ScanLine, WifiOff, BarChart3, School }

function LandingPage({ onNavigate, scrollTarget }) {
  const go = (page, options) => linkTo(onNavigate, page, options)

  return (
    <PublicLayout currentPage="home" scrollTarget={scrollTarget} onNavigate={onNavigate}>
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

      <div className="public-content">
        <section className="public-section" aria-labelledby="home-how-title">
          <p className="public-eyebrow">How Marka works</p>
          <h2 id="home-how-title" className="public-section-title">Paper tests in, clear next steps out.</h2>
          <HowItWorksSteps />
        </section>

        <section className="public-section" aria-labelledby="home-features-title">
          <h2 id="home-features-title" className="public-section-title">Features</h2>
          <div className="public-highlight-grid">
            {FEATURE_HIGHLIGHTS.map((feature) => {
              const Icon = HIGHLIGHT_ICONS[feature.icon]
              return (
                <article className="site-card public-highlight-card" key={feature.title}>
                  <span className="public-icon-tile" aria-hidden="true">
                    <Icon size={20} strokeWidth={2.1} />
                  </span>
                  <h3>{feature.title}</h3>
                  <p>{feature.body}</p>
                </article>
              )
            })}
          </div>
          <a className="public-text-link" href="#features" onClick={go('features')}>
            See all features <ArrowRight size={16} aria-hidden="true" />
          </a>
        </section>

        <div className="public-section">
          <AppSection
            id="home-app-title"
            eyebrow="Marka for Android"
            title="Start on the web. Scan with your phone."
            lead="Marka works in two parts. You set up your classes and assessments here, then check answer sheets with the Marka app. Scanning works without internet, and you send the results when you're back online."
            qrSize={132}
            secondaryAction={
              <a className="secondary-button" href="#get-app" onClick={go('get-app')}>
                How to install
              </a>
            }
            note="For teachers. Principals use Marka on a computer."
          />
        </div>

        <section className="public-section public-cta" aria-labelledby="home-cta-title">
          <h2 id="home-cta-title">Ready to start?</h2>
          <p>Create your teacher account. Once your principal approves it, you can set up your first assessment.</p>
          <div className="public-cta-actions">
            <a className="primary-button" href="#register" onClick={go('register')}>
              Create your teacher account
            </a>
            <a className="secondary-button" href="#login" onClick={go('login')}>
              Log in
            </a>
          </div>
        </section>
      </div>
    </PublicLayout>
  )
}

export default LandingPage

import { ArrowLeft, GraduationCap, ShieldCheck } from 'lucide-react'
import landingHero from '../assets/landing-hero.png'

function PublicAuthShell({
  children,
  description,
  eyebrow,
  onNavigate,
  title,
  trustMessage,
  variant = 'login',
}) {
  return (
    <section className={`public-auth-page is-${variant}`}>
      <header className="public-auth-header">
        <button
          type="button"
          className="public-auth-brand"
          onClick={() => onNavigate('home')}
          aria-label="Marka home"
        >
          <span className="public-auth-brand-mark" aria-hidden="true">
            <GraduationCap size={22} strokeWidth={2.2} />
          </span>
          <span className="public-auth-brand-copy">
            <strong>Marka</strong>
            <span>Dashboard</span>
          </span>
        </button>

        <button type="button" className="public-auth-home-link" onClick={() => onNavigate('home')}>
          <ArrowLeft size={17} strokeWidth={2.2} aria-hidden="true" />
          Back to home
        </button>
      </header>

      <div className="public-auth-layout">
        <aside
          className="public-auth-visual"
          style={{ '--public-auth-image': `url(${landingHero})` }}
          aria-label="Marka Dashboard"
        >
          <div className="public-auth-visual-overlay" aria-hidden="true" />
          <div className="public-auth-visual-copy">
            <p className="public-auth-visual-eyebrow">{eyebrow}</p>
            <h2>{title}</h2>
            <p>{description}</p>
            <div className="public-auth-trust-note">
              <ShieldCheck size={19} strokeWidth={2.1} aria-hidden="true" />
              <span>{trustMessage}</span>
            </div>
          </div>
        </aside>

        <div className="public-auth-form-region">{children}</div>
      </div>
    </section>
  )
}

export default PublicAuthShell

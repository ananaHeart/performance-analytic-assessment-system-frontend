import PublicLayout from '../components/PublicLayout'
import { linkTo } from '../utils/publicNav'

function NotFoundPage({ onNavigate }) {
  return (
    <PublicLayout currentPage="not-found" title="Page not found" onNavigate={onNavigate}>
      <div className="public-content">
        <section className="public-card public-not-found" aria-labelledby="not-found-title">
          <p className="public-eyebrow">404</p>
          <h1 id="not-found-title">We couldn&apos;t find that page.</h1>
          <div className="public-cta-actions">
            <a className="primary-button" href="#home" onClick={linkTo(onNavigate, 'home')}>
              Home
            </a>
            <a className="secondary-button" href="#guide" onClick={linkTo(onNavigate, 'guide')}>
              User guide
            </a>
          </div>
        </section>
      </div>
    </PublicLayout>
  )
}

export default NotFoundPage

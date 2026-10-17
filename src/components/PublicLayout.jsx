import { useEffect, useId, useRef, useState } from 'react'
import { Menu, X } from 'lucide-react'
import MarkaMark from './MarkaMark'
import { SCHOOL_NAME } from '../config/site'
import { linkTo } from '../utils/publicNav'

const NAV_LINKS = [
  { page: 'features', label: 'Features' },
  { page: 'get-app', label: 'Get the app' },
  { page: 'guide', label: 'User guide' },
  { page: 'about', label: 'About' },
]

const FOOTER_COLUMNS = [
  {
    title: 'Product',
    links: [
      { page: 'features', label: 'Features' },
      { page: 'get-app', label: 'Get the app' },
      { page: 'tech-stack', label: 'Tech stack' },
    ],
  },
  {
    title: 'Help',
    links: [
      { page: 'guide', label: 'User guide' },
      { page: 'privacy', label: 'Privacy notice' },
    ],
  },
  {
    title: 'About',
    links: [
      { page: 'about', label: 'About us' },
      { page: 'about', label: 'Contact', scrollTo: 'contact' },
    ],
  },
]

function PublicLayout({ currentPage, title, scrollTarget, isSignedIn = false, onNavigate, children }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const headerRef = useRef(null)
  const hasMountedRef = useRef(false)
  const menuId = useId()

  useEffect(() => {
    document.title = title ? `${title} · Marka` : 'Marka'
    return () => {
      document.title = 'Marka'
    }
  }, [title])

  // New pages start at the top unless a link asked for a section (the hash is the router, so no #anchors).
  useEffect(() => {
    const isFirstRun = !hasMountedRef.current
    hasMountedRef.current = true
    const target = scrollTarget?.page === currentPage ? document.getElementById(scrollTarget.id) : null

    if (target) {
      target.scrollIntoView({ behavior: isFirstRun ? 'instant' : 'smooth', block: 'start' })
    } else if (isFirstRun) {
      window.scrollTo({ top: 0, behavior: 'instant' })
    }
  }, [currentPage, scrollTarget])

  useEffect(() => {
    if (!isMenuOpen) return undefined

    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setIsMenuOpen(false)
    }
    const closeOnOutsidePointer = (event) => {
      if (!headerRef.current?.contains(event.target)) setIsMenuOpen(false)
    }

    document.addEventListener('keydown', closeOnEscape)
    document.addEventListener('pointerdown', closeOnOutsidePointer)
    return () => {
      document.removeEventListener('keydown', closeOnEscape)
      document.removeEventListener('pointerdown', closeOnOutsidePointer)
    }
  }, [isMenuOpen])

  const go = (page, options) => linkTo((nextPage, nextOptions) => {
    setIsMenuOpen(false)
    onNavigate(nextPage, nextOptions)
  }, page, options)

  const navLinks = NAV_LINKS.map((link) => (
    <a
      key={link.page}
      href={`#${link.page}`}
      className="public-nav-link"
      aria-current={currentPage === link.page ? 'page' : undefined}
      onClick={go(link.page)}
    >
      {link.label}
    </a>
  ))

  // Signed-in visitors go back to their dashboard; opening #login would sign them out.
  const accountActions = isSignedIn ? (
    <a href="#home" className="public-signup-link" onClick={go('home')}>
      Go to dashboard
    </a>
  ) : (
    <>
      <a href="#login" className="public-login-link" onClick={go('login')}>
        Log in
      </a>
      <a href="#register" className="public-signup-link" onClick={go('register')}>
        Sign up
      </a>
    </>
  )

  return (
    <div className="public-site">
      <header className="public-header" ref={headerRef}>
        <div className="public-header-inner">
          <a href="#home" className="public-brand" aria-label="Marka home" onClick={go('home')}>
            <span className="public-brand-mark" aria-hidden="true">
              <MarkaMark size={22} />
            </span>
            <strong>Marka</strong>
          </a>

          <nav className="public-nav" aria-label="Main">
            {navLinks}
          </nav>

          <div className="public-header-actions">{accountActions}</div>

          <button
            type="button"
            className="public-menu-button"
            aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={isMenuOpen}
            aria-controls={menuId}
            onClick={() => setIsMenuOpen((open) => !open)}
          >
            {isMenuOpen ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
          </button>
        </div>

        <div id={menuId} className="public-mobile-menu" hidden={!isMenuOpen}>
          <nav className="public-mobile-nav" aria-label="Main">
            {navLinks}
          </nav>
          <div className="public-mobile-actions">{accountActions}</div>
        </div>
      </header>

      <main className="public-main">{children}</main>

      <footer className="public-footer">
        <div className="public-footer-inner">
          <div className="public-footer-columns">
            {FOOTER_COLUMNS.map((column) => (
              <div className="public-footer-column" key={column.title}>
                <h2>{column.title}</h2>
                <ul>
                  {column.links.map((link) => (
                    <li key={link.label}>
                      <a href={`#${link.page}`} onClick={go(link.page, link.scrollTo ? { scrollTo: link.scrollTo } : undefined)}>
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="public-footer-bottom">
            <span>© 2026 Marka</span>
            <span>A capstone project of {SCHOOL_NAME}</span>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default PublicLayout

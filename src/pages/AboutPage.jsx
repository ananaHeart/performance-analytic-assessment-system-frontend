import { GraduationCap, Mail } from 'lucide-react'
import PublicLayout from '../components/PublicLayout'
import { CONTACT_EMAIL, CONTACT_FALLBACK, SCHOOL_NAME } from '../config/site'

const TEAM = [
  { initials: 'HA', name: 'Heart M. Añana', role: 'Frontend and mobile developer' },
  { initials: 'KB', name: 'Kent John B. Baja', role: 'Backend developer' },
  { initials: 'LS', name: 'Lovely May B. Sumalinog', role: 'Documentation' },
]

function AboutPage({ onNavigate, scrollTarget }) {
  return (
    <PublicLayout currentPage="about" title="About us" scrollTarget={scrollTarget} onNavigate={onNavigate}>
      <div className="public-content">
        <header className="public-page-intro">
          <p className="public-eyebrow">About us</p>
          <h1>Built by IT students for public school teachers</h1>
          <p className="public-lead">
            Marka is the capstone project of three Bachelor of Science in Information Technology students at{' '}
            {SCHOOL_NAME}.
          </p>
        </header>

        <section className="site-card public-text-card" aria-labelledby="about-study">
          <h2 id="about-study">The study</h2>
          <p>
            <strong>A Mobile and Web Performance Analytic Assessment System.</strong> We named the system Marka.
          </p>
        </section>

        <section className="site-card public-text-card" aria-labelledby="about-problem">
          <h2 id="about-problem">The problem</h2>
          <p>
            In many provincial public schools, tests are still checked, tallied, and recorded by hand. Teachers at
            San Roque National High School told us checking takes one to two hours per section, and item analysis is
            often skipped because it takes too long. Without it, it&apos;s hard to know which skills need to be
            taught again.
          </p>
          <div className="public-stat-row">
            <p className="public-stat">
              <strong>1–2 hours</strong>
              <span>to check one section by hand</span>
            </p>
            <p className="public-stat">
              <strong>1 phone</strong>
              <span>to check them with Marka. No special checking machine needed.</span>
            </p>
          </div>
        </section>

        <section className="site-card public-text-card" aria-labelledby="about-built">
          <h2 id="about-built">What we built</h2>
          <p>
            Marka keeps paper tests. It uses a phone camera to check them and turns the results into item analysis
            and least mastered skills, so teachers and principals can decide what to teach next.
          </p>
        </section>

        <section className="public-section" aria-labelledby="about-team">
          <h2 id="about-team" className="public-section-title">The team</h2>
          <ul className="public-team-grid">
            {TEAM.map((member) => (
              <li className="site-card public-person-card" key={member.name}>
                <span className="public-person-avatar" aria-hidden="true">
                  {member.initials}
                </span>
                <div>
                  <h3>{member.name}</h3>
                  <p>{member.role}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <div className="public-two-column">
          <section className="site-card public-person-card" aria-labelledby="about-adviser">
            <span className="public-person-avatar" aria-hidden="true">
              LJ
            </span>
            <div>
              <h2 id="about-adviser" className="site-card-label">Adviser</h2>
              <h3>Prof. Leonila R. Juanatas, MIT</h3>
              <p>Capstone adviser</p>
            </div>
          </section>

          <section className="site-card public-person-card" aria-labelledby="about-school">
            <span className="public-icon-tile" aria-hidden="true">
              <GraduationCap size={20} strokeWidth={2.1} />
            </span>
            <div>
              <h2 id="about-school" className="site-card-label">School</h2>
              <h3>{SCHOOL_NAME}</h3>
              <p>College of Engineering and Technology Education</p>
              <p>Bachelor of Science in Information Technology</p>
            </div>
          </section>
        </div>

        <section className="site-card public-text-card" aria-labelledby="about-thanks">
          <h2 id="about-thanks">Acknowledgment</h2>
          <p>
            We thank the principal and teachers of San Roque National High School for their time, feedback, and
            classrooms.
          </p>
        </section>

        <section className="site-card public-text-card public-anchor" id="contact" aria-labelledby="about-contact">
          <h2 id="about-contact">Contact</h2>
          {CONTACT_EMAIL ? (
            <p>
              For questions about Marka or this study, email us at{' '}
              <a className="public-inline-link" href={`mailto:${CONTACT_EMAIL}`}>
                <Mail size={16} aria-hidden="true" />
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          ) : (
            <p>{CONTACT_FALLBACK}</p>
          )}
        </section>
      </div>
    </PublicLayout>
  )
}

export default AboutPage

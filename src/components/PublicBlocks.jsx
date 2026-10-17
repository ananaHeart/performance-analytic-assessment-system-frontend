import { Info, TriangleAlert } from 'lucide-react'
import { AppDownloadButton, AppMetaLine, AppQrCode } from './AppDownload'
import { hasAppDownload } from '../config/appRelease'
import { APP_STEPS, HOW_IT_WORKS_STEPS } from '../data/publicSite'

export function Callout({ tone = 'info', children }) {
  const Icon = tone === 'warning' ? TriangleAlert : Info

  return (
    <div className={`public-callout is-${tone}`}>
      <Icon size={18} strokeWidth={2.2} aria-hidden="true" />
      <div>{children}</div>
    </div>
  )
}

export function HowItWorksSteps() {
  return (
    <ol className="public-steps-grid">
      {HOW_IT_WORKS_STEPS.map((step, index) => (
        <li className="public-step-card" key={step.title}>
          <div className="public-step-top">
            <span className="public-step-number" aria-hidden="true">
              {index + 1}
            </span>
            <span className={`public-step-tag is-${step.tag.toLowerCase()}`}>{step.tag}</span>
          </div>
          <h3>{step.title}</h3>
          <p>{step.body}</p>
        </li>
      ))}
    </ol>
  )
}

// The download block: copy and steps on the left, the QR on the right. Used on Home and Get the app.
export function AppSection({
  id,
  eyebrow,
  title,
  titleAs: Title = 'h2',
  lead,
  callout,
  qrSize,
  secondaryAction,
  note,
}) {
  return (
    <section className="public-app-card" aria-labelledby={id}>
      <div className="public-app-copy">
        {eyebrow ? <p className="public-eyebrow">{eyebrow}</p> : null}
        <Title id={id}>{title}</Title>
        <p className="public-app-lead">{lead}</p>
        {callout}
        <ol className="public-app-steps">
          {APP_STEPS.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <div className="public-app-actions">
          <AppDownloadButton />
          {secondaryAction}
        </div>
        <AppMetaLine />
        {note ? <p className="public-app-note">{note}</p> : null}
      </div>
      {hasAppDownload() ? (
        <div className="public-app-qr">
          <AppQrCode size={qrSize} />
        </div>
      ) : null}
    </section>
  )
}

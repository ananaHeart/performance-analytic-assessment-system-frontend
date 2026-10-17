import { useMemo } from 'react'
import QRCode from 'qrcode'
import { Download } from 'lucide-react'
import { APP_RELEASE, hasAppDownload } from '../config/appRelease'

const QR_MARGIN = 2

// Builds the QR as SVG paths in the browser from the same URL as the button, so they always match.
function buildQrPath(url) {
  const { modules } = QRCode.create(url, { errorCorrectionLevel: 'M' })
  const segments = []

  for (let row = 0; row < modules.size; row += 1) {
    for (let column = 0; column < modules.size; column += 1) {
      if (modules.get(row, column)) {
        segments.push(`M${column + QR_MARGIN} ${row + QR_MARGIN}h1v1h-1z`)
      }
    }
  }

  return { path: segments.join(''), size: modules.size + QR_MARGIN * 2 }
}

export function AppDownloadButton() {
  if (!hasAppDownload()) {
    return <p className="app-download-soon">Download link coming soon</p>
  }

  return (
    <a className="primary-button app-download-button" href={APP_RELEASE.url} target="_blank" rel="noopener">
      <Download size={18} strokeWidth={2.2} aria-hidden="true" />
      Download APK
    </a>
  )
}

export function AppMetaLine() {
  const parts = [
    'Android only',
    APP_RELEASE.minAndroid,
    APP_RELEASE.size,
    APP_RELEASE.version ? `Version ${APP_RELEASE.version}` : '',
    APP_RELEASE.updated ? `Updated ${APP_RELEASE.updated}` : '',
  ].filter(Boolean)

  return <p className="app-download-meta">{parts.join(' · ')}</p>
}

export function AppQrCode({ size = 160 }) {
  const qr = useMemo(() => (hasAppDownload() ? buildQrPath(APP_RELEASE.url) : null), [])

  if (!qr) return null

  return (
    <figure className="app-qr" style={{ '--app-qr-size': `${size}px` }}>
      <svg
        className="app-qr-code"
        viewBox={`0 0 ${qr.size} ${qr.size}`}
        width={size}
        height={size}
        role="img"
        aria-label="QR code for the Marka app download link"
        shapeRendering="crispEdges"
      >
        <rect width={qr.size} height={qr.size} className="app-qr-light" />
        <path d={qr.path} className="app-qr-dark" />
      </svg>
      <figcaption>On a laptop? Scan this with your phone to download the app.</figcaption>
    </figure>
  )
}

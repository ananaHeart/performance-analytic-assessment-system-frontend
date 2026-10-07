import markaMarkUrl from '../assets/marka-mark.svg'

// Approved Marka brand mark (master: docs/branding/marka-mark.svg, revision r1). Decorative only:
// every slot already carries a visible "Marka" wordmark or an accessible name.
function MarkaMark({ size = 20 }) {
  return (
    <img
      className="marka-mark"
      src={markaMarkUrl}
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      draggable="false"
    />
  )
}

export default MarkaMark

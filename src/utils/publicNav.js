// Public pages use real <a href="#page"> links so they can open in a new tab.
// A plain click routes in-app instead (and can carry a section to scroll to).
export function linkTo(onNavigate, page, options) {
  return (event) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    onNavigate(page, options)
  }
}

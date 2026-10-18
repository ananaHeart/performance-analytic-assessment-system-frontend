import { useEffect, useRef, useState } from 'react'
import { ShieldAlert } from 'lucide-react'

// Shown before a teacher starts a new assessment. It only closes through "I understand".
const RULES = [
  {
    title: 'Name',
    text: 'Enter the assessment name. It can’t be saved without one.',
  },
  {
    title: 'Opening and closing time',
    text: 'The opening date and time must be now or later. If you set a closing time, it must be after the opening time.',
  },
  {
    title: 'Outside the class timetable',
    text: 'If you schedule it outside the class timetable, write the reason (at least 5 characters).',
  },
  {
    title: 'Test parts',
    text: 'Every part needs a part name, a question type, and points per item as a whole number of 1 or more.',
  },
  {
    title: 'Answers',
    text: 'Every question needs its correct answer. Changing a part’s question type clears the answers in that part.',
  },
  {
    title: 'Skill mapping',
    text: 'Map every item to a skill. The item ranges must cover all items, from the first item to the last.',
  },
  {
    title: 'Printing',
    text: 'Save before you print. Print the Bubble Answer Sheet on the paper size it was made for and don’t trim the edges, or the app can’t scan it.',
  },
]

function AssessmentRulesDialog({ onAcknowledge }) {
  const [dontShowAgain, setDontShowAgain] = useState(false)
  const dialogRef = useRef(null)

  // Focus the dialog itself so it opens scrolled to the top (the first rules), even on phones.
  useEffect(() => {
    dialogRef.current?.focus()
  }, [])

  // Keep keyboard focus inside the dialog; Escape does nothing because the rules must be acknowledged.
  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      return
    }
    if (event.key !== 'Tab') return
    const focusable = dialogRef.current?.querySelectorAll('input, button')
    if (!focusable?.length) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    const onDialog = document.activeElement === dialogRef.current
    if (event.shiftKey && (onDialog || document.activeElement === first)) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && (onDialog || document.activeElement === last)) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    <div className="assessment-rules-backdrop" role="presentation">
      <section
        ref={dialogRef}
        className="assessment-rules-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="assessmentRulesTitle"
        aria-describedby="assessmentRulesIntro"
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        <header className="assessment-rules-header">
          <span className="assessment-rules-icon" aria-hidden="true">
            <ShieldAlert size={22} strokeWidth={2.1} />
          </span>
          <div>
            <h2 id="assessmentRulesTitle">Before you create this assessment</h2>
            <p id="assessmentRulesIntro">
              Follow these rules. An assessment that breaks them can’t be saved, activated or scanned correctly.
            </p>
          </div>
        </header>

        <ol className="assessment-rules-list">
          {RULES.map((rule) => (
            <li key={rule.title}>
              <strong>{rule.title}</strong>
              <span>{rule.text}</span>
            </li>
          ))}
        </ol>

        <footer className="assessment-rules-footer">
          <label className="assessment-rules-dismiss">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(event) => setDontShowAgain(event.target.checked)}
            />
            Don’t show this again
          </label>
          <button
            type="button"
            className="primary-button"
            onClick={() => onAcknowledge(dontShowAgain)}
          >
            I understand
          </button>
        </footer>
      </section>
    </div>
  )
}

export default AssessmentRulesDialog

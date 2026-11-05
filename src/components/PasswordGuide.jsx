import { Check, X } from 'lucide-react'
import { PASSWORD_EXAMPLES, PASSWORD_RULES } from '../utils/passwordRules'

// REG-5 / R2-2 password guide: the rules with live check marks, plus strong vs weak examples.
function PasswordGuide({ password = '' }) {
  const hasTyped = password.length > 0

  return (
    <section className="teacher-password-guide" aria-label="Password guide">
      <div className="teacher-password-guide-rules">
        <h4>Your password needs</h4>
        <ul>
          {PASSWORD_RULES.map((rule) => {
            const isMet = hasTyped && rule.test(password)
            return (
              <li key={rule.label} className={isMet ? 'is-met' : ''}>
                <span aria-hidden="true">{isMet ? <Check size={13} strokeWidth={3} /> : null}</span>
                {rule.label}
                <span className="teacher-visually-hidden">{isMet ? ' (done)' : ''}</span>
              </li>
            )
          })}
        </ul>
        <p>Avoid your name, birth date, email, or school name. Don't reuse a password from another site.</p>
      </div>

      <div className="teacher-password-guide-examples">
        <h4>Secure passwords are random</h4>
        <ul>
          {PASSWORD_EXAMPLES.map((example) => (
            <li key={example.value} className={example.good ? 'is-good' : 'is-bad'}>
              <span aria-hidden="true">
                {example.good ? <Check size={14} strokeWidth={3} /> : <X size={14} strokeWidth={3} />}
              </span>
              <div>
                <code>{example.value}</code>
                <small>
                  <span className="teacher-visually-hidden">{example.good ? 'Strong: ' : 'Weak: '}</span>
                  {example.note}
                </small>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

export default PasswordGuide

// REG-5 rules, shared by the password guide (shown before typing) and every password form
// (registration, Settings > Change password), so the checklist and the errors never disagree. Matches the backend rule:
// 10-128 characters, upper, lower, number, special character, no spaces.
export const PASSWORD_RULES = [
  { label: '10 to 128 characters', missing: '10 to 128 characters', test: (value) => value.length >= 10 && value.length <= 128 },
  { label: 'An uppercase letter (A-Z)', missing: 'an uppercase letter', test: (value) => /[A-Z]/.test(value) },
  { label: 'A lowercase letter (a-z)', missing: 'a lowercase letter', test: (value) => /[a-z]/.test(value) },
  { label: 'A number (0-9)', missing: 'a number', test: (value) => /\d/.test(value) },
  { label: 'A symbol, such as ! @ # $ % & *', missing: 'a symbol', test: (value) => /[^A-Za-z0-9\s]/.test(value) },
  { label: 'No spaces', missing: 'no spaces', test: (value) => value.length > 0 && !/\s/.test(value) },
]

export const PASSWORD_EXAMPLES = [
  { value: 'Tg7#rQm2!vLx', note: 'Random mix of letters, numbers, and symbols', good: true },
  { value: 'Maria1996!', note: 'Uses a name and a birth year', good: false },
  { value: 'Password123', note: 'Common word, easy to guess', good: false },
  { value: '04121996', note: 'A birth date, numbers only', good: false },
]

export function getPasswordErrors(value) {
  const password = String(value ?? '')
  return PASSWORD_RULES.filter((rule) => !rule.test(password)).map((rule) => rule.missing)
}

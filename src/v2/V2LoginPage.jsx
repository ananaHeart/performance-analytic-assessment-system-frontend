import { useState } from 'react'
import { ArrowRight, Eye, EyeOff, GraduationCap, LockKeyhole, Mail } from 'lucide-react'

import { loginV2 } from '@/api/apiV2Client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getV2DeviceIdentifier } from '@/v2/v2Session'

function V2LoginPage({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    if (!email.trim() || !password) {
      setError('Enter your email address and password.')
      return
    }

    setLoading(true)

    try {
      const session = await loginV2(
        email.trim(),
        password,
        getV2DeviceIdentifier(),
      )

      if (!session.token || !session.user?.role) {
        throw new Error('The login response is incomplete. Please contact the administrator.')
      }

      onLogin(session)
    } catch (requestError) {
      setError(requestError.message || 'Unable to sign in. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="smart-ui flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <section className="w-full max-w-md" aria-labelledby="login-title">
        <header className="mb-6 text-center">
          <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-lg bg-brand-soft text-primary">
            <GraduationCap size={25} strokeWidth={2.1} aria-hidden="true" />
          </span>
          <p className="mb-1 text-sm font-semibold text-primary">SMART Assessment System</p>
          <h1 id="login-title" className="text-2xl font-bold text-foreground">
            Sign in to your account
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Use your active school account to continue.
          </p>
        </header>

        <form
          className="space-y-5 rounded-lg border border-border bg-card p-6 shadow-[var(--ui-shadow-md)]"
          onSubmit={handleSubmit}
        >
          <div className="space-y-2">
            <Label htmlFor="v2-email">Email address</Label>
            <div className="relative">
              <Mail
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                size={17}
                aria-hidden="true"
              />
              <Input
                id="v2-email"
                className="pl-10"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@school.edu"
                autoComplete="email"
                disabled={loading}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="v2-password">Password</Label>
            <div className="relative">
              <LockKeyhole
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                size={17}
                aria-hidden="true"
              />
              <Input
                id="v2-password"
                className="pl-10 pr-11"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
                disabled={loading}
                required
              />
              <button
                type="button"
                className="absolute right-1 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                onClick={() => setShowPassword((visible) => !visible)}
                disabled={loading}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>

          {error ? (
            <p
              className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              role="alert"
              aria-live="polite"
            >
              {error}
            </p>
          ) : null}

          <Button className="w-full" type="submit" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in'}
            {!loading ? <ArrowRight aria-hidden="true" /> : null}
          </Button>
        </form>

        <p className="mt-5 text-center text-xs text-muted-foreground">
          Access is limited to active, verified principal and teacher accounts.
        </p>
      </section>
    </main>
  )
}

export default V2LoginPage

'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { LogIn, Mail, Lock, KeyRound, RefreshCw, ShieldCheck } from 'lucide-react'
import { Suspense } from 'react'
import { SocialButtons } from '@/components/SocialButtons'

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect') || '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Login failed')
        return
      }
      toast.success('Welcome back!')
      router.push(redirect)
      router.refresh()
    } catch {
      toast.error('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div className="card" style={{ width: '100%', maxWidth: '420px', boxShadow: '0 20px 40px rgba(0,0,0,0.5)', border: '1px solid rgba(139,92,246,0.2)' }}>
        <div className="card-body" style={{ padding: '2.25rem' }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <Link href="/" className="navbar-logo" style={{ fontSize: '1.5rem', display: 'inline-block' }}>
              DOGFOOD
            </Link>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: '0.75rem', marginBottom: '0.25rem' }}>
              Sign in to your account
            </h1>
            <p className="text-muted" style={{ fontSize: '0.85rem' }}>
              Enter your verified email and password
            </p>
          </div>

          {/* Social OAuth Buttons */}
          <SocialButtons redirect={redirect} />

          <div style={{ display: 'flex', alignItems: 'center', margin: '1.25rem 0', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
            <span style={{ padding: '0 10px' }}>or continue with email</span>
            <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="login-email">Email Address</label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  id="login-email"
                  className="form-input"
                  style={{ paddingLeft: '2.5rem' }}
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>
            </div>

            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                <label className="form-label" htmlFor="login-password" style={{ marginBottom: 0 }}>Password</label>
                <Link
                  href="/forgot-password"
                  style={{ fontSize: '0.8rem', color: 'var(--violet-400)', textDecoration: 'none', fontWeight: 500 }}
                >
                  Forgot password?
                </Link>
              </div>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  id="login-password"
                  className="form-input"
                  style={{ paddingLeft: '2.5rem' }}
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary w-full"
              disabled={loading}
              style={{ marginTop: '0.5rem', gap: '8px' }}
            >
              {loading ? <RefreshCw size={16} className="animate-spin" /> : <LogIn size={16} />}
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="divider" style={{ margin: '1.75rem 0 1.25rem' }} />

          <div style={{ textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            No account yet?{' '}
            <Link href="/register" style={{ color: 'var(--violet-400)', fontWeight: 600 }}>
              Create an account
            </Link>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              (Protected by Email OTP verification)
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><p className="text-muted">Loading…</p></div>}>
      <LoginContent />
    </Suspense>
  )
}

'use client'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, Sparkles, Shield, User } from 'lucide-react'
import { Suspense } from 'react'

function MockOAuthContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const provider = searchParams.get('provider') || 'google'
  const state = searchParams.get('state') || ''
  const redirect = searchParams.get('redirect') || '/'

  const defaultProfiles: Record<string, { email: string; name: string }> = {
    google: { email: 'alex.rivera@gmail.com', name: 'Alex Rivera (Google)' },
    github: { email: 'sarah.codes@github.com', name: 'Sarah Chen (GitHub)' },
    discord: { email: 'jordan.gamer@discord.gg', name: 'Jordan Sparks (Discord)' },
  }

  const currentDefault = defaultProfiles[provider] || { email: 'user@example.com', name: 'OAuth User' }
  const [email, setEmail] = useState(currentDefault.email)
  const [name, setName] = useState(currentDefault.name)

  const providerNames: Record<string, string> = {
    google: 'Google',
    github: 'GitHub',
    discord: 'Discord',
  }

  const providerColors: Record<string, string> = {
    google: '#ea4335',
    github: '#24292e',
    discord: '#5865f2',
  }

  function handleAuthorize(e: React.FormEvent) {
    e.preventDefault()
    const callbackUrl = `/api/auth/oauth/${provider}/callback?code=mock_${Date.now()}&state=${encodeURIComponent(state)}&mock_email=${encodeURIComponent(email)}&mock_name=${encodeURIComponent(name)}`
    router.push(callbackUrl)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div className="card" style={{ width: '100%', maxWidth: '440px', boxShadow: '0 20px 40px rgba(0,0,0,0.5)', border: '1px solid rgba(139,92,246,0.25)' }}>
        <div className="card-body" style={{ padding: '2.25rem' }}>
          <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
            <Link href="/" className="navbar-logo" style={{ fontSize: '1.5rem', display: 'inline-block' }}>
              DOGFOOD
            </Link>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', margin: '1rem auto 0.5rem', background: 'rgba(255,255,255,0.06)', padding: '4px 12px', borderRadius: 999, fontSize: '0.8rem', color: providerColors[provider] || '#fff', border: '1px solid var(--border)' }}>
              <Sparkles size={14} /> Mock {providerNames[provider] || provider} OAuth Simulator
            </div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: '0.5rem', marginBottom: '0.25rem' }}>
              Authorize with {providerNames[provider] || provider}
            </h1>
            <p className="text-muted" style={{ fontSize: '0.825rem' }}>
              Development mode simulator. In production, configure real client credentials in <code style={{ color: 'var(--violet-400)' }}>.env</code>.
            </p>
          </div>

          <form onSubmit={handleAuthorize} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="mock-email">Simulated Email Address</label>
              <input
                id="mock-email"
                className="form-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="mock-name">Simulated Full Name</label>
              <input
                id="mock-name"
                className="form-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div style={{ padding: '10px 12px', background: 'rgba(34, 197, 94, 0.08)', borderRadius: '8px', border: '1px solid rgba(34, 197, 94, 0.25)', fontSize: '0.75rem', color: '#4ade80', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Shield size={16} style={{ flexShrink: 0 }} />
              <span>Simulates real OAuth callback, links account, and issues active session cookie.</span>
            </div>

            <button
              type="submit"
              className="btn btn-primary w-full"
              style={{ marginTop: '0.5rem', gap: '8px' }}
            >
              <CheckCircle2 size={16} /> Authorize & Sign In →
            </button>
          </form>

          <div className="divider" style={{ margin: '1.75rem 0 1.25rem' }} />

          <p style={{ textAlign: 'center', fontSize: '0.85rem' }}>
            <Link href="/login" style={{ color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <ArrowLeft size={14} /> Back to standard sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default function MockOAuthPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><p className="text-muted">Loading…</p></div>}>
      <MockOAuthContent />
    </Suspense>
  )
}

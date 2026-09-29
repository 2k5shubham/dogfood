'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { Users, CheckCircle2, ArrowRight, LogIn, Loader2 } from 'lucide-react'

export default function JoinTeamByCodePage() {
  const params = useParams()
  const router = useRouter()
  const code = (params.code as string)?.toUpperCase()

  const [status, setStatus] = useState<'loading' | 'ready' | 'joining' | 'success' | 'error' | 'auth'>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [teamName, setTeamName] = useState('')
  const [eventId, setEventId] = useState<string | null>(null)

  useEffect(() => {
    if (!code) return

    // Check auth, then find the event to build the join URL
    Promise.all([
      fetch('/api/auth/me').then(r => r.ok ? r.json() : null),
      fetch('/api/events?status=active&limit=1').then(r => r.json()),
    ]).then(([authData, evData]) => {
      if (!authData?.data?.user) {
        setStatus('auth')
        return
      }
      const ev = evData?.data?.events?.[0]
      if (!ev) {
        setErrorMsg('No active event found.')
        setStatus('error')
        return
      }
      setEventId(ev.id)
      setStatus('ready')
    }).catch(() => {
      setErrorMsg('Failed to load. Please refresh.')
      setStatus('error')
    })
  }, [code])

  const handleJoin = async () => {
    if (!eventId) return
    setStatus('joining')
    try {
      const res = await fetch(`/api/events/${eventId}/teams/join/${code}`, { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setTeamName(data.data.team.name)
        setStatus('success')
        toast.success(`Joined team "${data.data.team.name}"!`)
        setTimeout(() => router.push('/submit'), 2000)
      } else {
        setErrorMsg(data.error?.message || 'Failed to join team')
        setStatus('error')
      }
    } catch {
      setErrorMsg('Network error. Please try again.')
      setStatus('error')
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      {/* Background glow */}
      <div style={{ position: 'fixed', top: '20%', left: '50%', transform: 'translateX(-50%)', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />

      <div style={{ width: '100%', maxWidth: 480, position: 'relative', zIndex: 1 }}>
        <Link href="/" className="navbar-logo" style={{ display: 'block', textAlign: 'center', marginBottom: '2rem', fontSize: '1.5rem' }}>DOGFOOD</Link>

        <div className="card" style={{ padding: '2.5rem', textAlign: 'center' }}>
          {status === 'loading' && (
            <>
              <Loader2 size={40} style={{ color: 'var(--violet-400)', margin: '0 auto 1rem', animation: 'spin 1s linear infinite' }} />
              <p className="text-muted">Verifying invite link…</p>
            </>
          )}

          {status === 'auth' && (
            <>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(139,92,246,0.15)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                <LogIn size={28} style={{ color: 'var(--violet-400)' }} />
              </div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.75rem' }}>Sign in to join</h1>
              <p className="text-muted" style={{ marginBottom: '2rem', lineHeight: 1.6 }}>
                You need to be logged in to join a team with invite code <code style={{ background: 'var(--bg-overlay)', padding: '2px 8px', borderRadius: 6, color: 'var(--violet-400)', fontFamily: 'var(--font-mono)' }}>{code}</code>
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <Link href={`/login?redirect=/join/${code}`} className="btn btn-primary btn-lg" style={{ justifyContent: 'center' }}>
                  <LogIn size={18} /> Log In
                </Link>
                <Link href={`/register?redirect=/join/${code}`} className="btn btn-outline btn-lg" style={{ justifyContent: 'center' }}>
                  Create Account
                </Link>
              </div>
            </>
          )}

          {status === 'ready' && (
            <>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(139,92,246,0.15)', border: '1px solid var(--border-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                <Users size={28} style={{ color: 'var(--violet-400)' }} />
              </div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>Team Invite</h1>
              <p className="text-muted" style={{ marginBottom: '0.5rem' }}>You've been invited to join a team using code:</p>
              <div style={{ display: 'inline-block', background: 'var(--bg-overlay)', border: '1px solid var(--border-hover)', borderRadius: 10, padding: '0.625rem 1.5rem', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '1.5rem', letterSpacing: '0.2em', color: 'var(--violet-400)', margin: '0.75rem 0 2rem' }}>
                {code}
              </div>
              <button className="btn btn-primary btn-lg" onClick={handleJoin} style={{ width: '100%', justifyContent: 'center' }}>
                <Users size={18} /> Accept & Join Team <ArrowRight size={16} />
              </button>
              <p style={{ marginTop: '1rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                Teams can have up to 4 members.
              </p>
            </>
          )}

          {status === 'joining' && (
            <>
              <Loader2 size={40} style={{ color: 'var(--violet-400)', margin: '0 auto 1rem', animation: 'spin 1s linear infinite' }} />
              <p style={{ fontWeight: 600 }}>Joining team…</p>
            </>
          )}

          {status === 'success' && (
            <>
              <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(74,222,128,0.15)', border: '1px solid var(--green-400)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                <CheckCircle2 size={32} style={{ color: 'var(--green-400)' }} />
              </div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--green-400)' }}>You're in!</h1>
              <p className="text-muted" style={{ marginBottom: '1.5rem' }}>
                Welcome to <strong style={{ color: 'var(--text-primary)' }}>{teamName}</strong>. Redirecting to submission portal…
              </p>
              <Link href="/submit" className="btn btn-primary btn-lg" style={{ justifyContent: 'center' }}>
                Go to Submit <ArrowRight size={16} />
              </Link>
            </>
          )}

          {status === 'error' && (
            <>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(239,68,68,0.15)', border: '1px solid var(--red-500)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                <span style={{ fontSize: '2rem' }}>!</span>
              </div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--red-400)' }}>Can't join</h1>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>{errorMsg}</p>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                <button className="btn btn-outline" onClick={() => setStatus('ready')}>Try Again</button>
                <Link href="/" className="btn btn-ghost">Go Home</Link>
              </div>
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

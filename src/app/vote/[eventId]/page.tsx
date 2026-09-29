'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { Heart, LogIn, Shield, CheckCircle2, AlertTriangle, Trophy, ArrowRight } from 'lucide-react'
import { Suspense } from 'react'

interface Project {
  id: string
  title: string
  tagline: string | null
  team: { name: string }
  track: { name: string } | null
  _count: { userVotes: number; comments: number }
}

interface User {
  id: string
  displayName: string
  email: string
}

function VotingContent() {
  const params = useParams()
  const router = useRouter()
  const eventId = params.eventId as string

  const [projects, setProjects] = useState<Project[]>([])
  const [myVotes, setMyVotes] = useState<Set<string>>(new Set())
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState<string | null>(null)
  const [votingClosed, setVotingClosed] = useState(false)
  const [votingNotOpen, setVotingNotOpen] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/auth/me').then(r => r.ok ? r.json() : null),
      fetch(`/api/events/${eventId}/projects?limit=50`).then(r => r.json()),
      fetch(`/api/events/${eventId}/vote/cast`).then(r => r.json()),
      fetch(`/api/events/${eventId}`).then(r => r.json()),
    ]).then(([authData, projData, voteData, evData]) => {
      if (authData?.data?.user) setUser(authData.data.user)

      // Shuffle projects for this viewer (random order = no position bias)
      const allProjects: Project[] = projData?.data?.projects ?? []
      const shuffled = [...allProjects].sort(() => Math.random() - 0.5)
      setProjects(shuffled)

      if (voteData?.data?.myVotes) {
        setMyVotes(new Set(voteData.data.myVotes))
      }

      const ev = evData?.data?.event
      const now = new Date()
      if (ev?.votingDeadline && now > new Date(ev.votingDeadline)) setVotingClosed(true)
      if (ev?.votingOpensAt && now < new Date(ev.votingOpensAt)) setVotingNotOpen(true)

      setLoading(false)
    }).catch(() => setLoading(false))
  }, [eventId])

  async function toggleVote(projectId: string) {
    if (!user) {
      router.push(`/login?redirect=/vote/${eventId}`)
      return
    }
    if (votingClosed || votingNotOpen) return

    setPending(projectId)
    try {
      const res = await fetch(`/api/events/${eventId}/vote/cast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      })
      const d = await res.json()
      if (!res.ok) {
        toast.error(d.error ?? 'Vote failed')
        return
      }
      const wasVoted = myVotes.has(projectId)
      setMyVotes(prev => {
        const next = new Set(prev)
        if (wasVoted) next.delete(projectId)
        else next.add(projectId)
        return next
      })
      // Update local vote count
      setProjects(prev => prev.map(p =>
        p.id === projectId
          ? { ...p, _count: { ...p._count, userVotes: d.data.voteCount } }
          : p
      ))
      toast.success(wasVoted ? 'Vote removed' : '❤️ Vote cast!')
    } finally {
      setPending(null)
    }
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p className="text-muted">Loading ballot…</p>
    </div>
  )

  const totalVotes = myVotes.size

  return (
    <div style={{ minHeight: '100vh', paddingBottom: '5rem' }}>
      <nav className="navbar">
        <div className="container navbar-inner">
          <Link href="/" className="navbar-logo">DOGFOOD</Link>
          {user && (
            <div className="badge badge-green" style={{ gap: '6px' }}>
              <CheckCircle2 size={12} /> Voting as {user.displayName}
            </div>
          )}
          <Link href="/" className="btn btn-ghost btn-sm">← Gallery</Link>
        </div>
      </nav>

      <main className="container" style={{ paddingTop: '2rem', maxWidth: '1100px' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div className="badge badge-violet" style={{ display: 'inline-flex', marginBottom: '1rem', gap: '6px' }}>
            <Trophy size={14} /> Community Vote
          </div>
          <h1 style={{ fontSize: '2.25rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '0.75rem' }}>
            Vote for your favourites
          </h1>
          <p className="text-secondary" style={{ maxWidth: 560, margin: '0 auto 1.5rem' }}>
            One upvote per project. You can vote for as many projects as you like, and retract votes at any time.
          </p>

          {/* Anti-Sybil explanation */}
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap', maxWidth: 700, margin: '0 auto' }}>
            {[
              { icon: <Shield size={14} />, text: 'Account-bound: 1 vote per registered user per project', color: 'var(--violet-400)' },
              { icon: <CheckCircle2 size={14} />, text: 'No self-voting: own team\'s projects excluded', color: 'var(--green-400)' },
              { icon: <Shield size={14} />, text: 'Account age verified: only pre-deadline accounts can vote', color: 'var(--cyan-400)' },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: item.color, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 999, padding: '4px 12px' }}>
                {item.icon} {item.text}
              </div>
            ))}
          </div>
        </div>

        {/* Not logged in banner */}
        {!user && (
          <div style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid var(--border-hover)', borderRadius: 'var(--radius-lg)', padding: '1.5rem 2rem', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
            <LogIn size={24} style={{ color: 'var(--violet-400)', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>Sign in to vote</div>
              <div className="text-muted" style={{ fontSize: '0.875rem' }}>
                Voting requires a registered account. Each account can vote once per project — your email is the Sybil barrier.
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', flexShrink: 0 }}>
              <Link href={`/login?redirect=/vote/${eventId}`} className="btn btn-primary btn-sm">
                <LogIn size={14} /> Log In
              </Link>
              <Link href={`/register?redirect=/vote/${eventId}`} className="btn btn-outline btn-sm">
                Register
              </Link>
            </div>
          </div>
        )}

        {/* Voting closed / not open yet */}
        {votingClosed && (
          <div className="alert alert-warning" style={{ marginBottom: '2rem', justifyContent: 'center' }}>
            <AlertTriangle size={16} /> Voting has closed. Results are being tallied.
          </div>
        )}
        {votingNotOpen && (
          <div className="alert alert-info" style={{ marginBottom: '2rem', justifyContent: 'center' }}>
            Voting has not opened yet. Check back later.
          </div>
        )}

        {/* Vote summary */}
        {user && totalVotes > 0 && (
          <div style={{ textAlign: 'center', marginBottom: '1.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            You've voted for <strong style={{ color: 'var(--violet-400)' }}>{totalVotes}</strong> project{totalVotes !== 1 ? 's' : ''}. You can change your votes anytime before voting closes.
          </div>
        )}

        {/* Project grid */}
        {projects.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '4rem' }}>
            <p className="text-muted">No submitted projects yet.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem' }}>
            {projects.map(p => {
              const voted = myVotes.has(p.id)
              const isPending = pending === p.id
              const disabled = votingClosed || votingNotOpen || isPending

              return (
                <div
                  key={p.id}
                  className="card"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    border: voted ? '1px solid rgba(139,92,246,0.45)' : '1px solid var(--border)',
                    background: voted ? 'rgba(139,92,246,0.06)' : undefined,
                    transition: 'all 0.2s ease',
                  }}
                >
                  {/* Cover placeholder */}
                  <div style={{ height: 130, background: 'linear-gradient(135deg, var(--bg-elevated), var(--bg-overlay))', borderRadius: '14px 14px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem' }}>
                    🚀
                  </div>

                  <div className="card-body" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {p.track && <span className="badge badge-violet">{p.track.name}</span>}
                    <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>
                      <Link href={`/projects/${p.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                        {p.title}
                      </Link>
                    </h3>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>by {p.team.name}</p>
                    {p.tagline && (
                      <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', flex: 1, lineHeight: 1.5 }}>
                        {p.tagline}
                      </p>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
                      {/* Vote count */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.875rem', color: voted ? 'var(--violet-400)' : 'var(--text-muted)' }}>
                        <Heart size={15} fill={voted ? 'var(--violet-400)' : 'none'} />
                        <span style={{ fontWeight: 600 }}>{p._count.userVotes}</span>
                        <span>vote{p._count.userVotes !== 1 ? 's' : ''}</span>
                      </div>

                      {/* Vote button */}
                      <button
                        onClick={() => toggleVote(p.id)}
                        disabled={disabled}
                        className={voted ? 'btn btn-primary btn-sm' : 'btn btn-outline btn-sm'}
                        style={{
                          gap: '5px',
                          opacity: disabled && !isPending ? 0.5 : 1,
                          minWidth: 100,
                          justifyContent: 'center',
                        }}
                      >
                        <Heart size={14} fill={voted ? '#fff' : 'none'} />
                        {isPending ? '…' : voted ? 'Voted ✓' : !user ? 'Login to Vote' : 'Upvote'}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}

export default function VotingPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><p className="text-muted">Loading…</p></div>}>
      <VotingContent />
    </Suspense>
  )
}

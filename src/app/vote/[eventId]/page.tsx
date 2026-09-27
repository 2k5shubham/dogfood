'use client'
import { useState, useEffect } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Minus, Plus, CheckCircle2, Info } from 'lucide-react'
import { Suspense } from 'react'

interface Project { id: string; title: string; tagline: string | null; team: { name: string }; track: { name: string } | null }
interface Vote { projectId: string; voteCount: number; creditsSpent: number }

function VotingContent() {
  const params = useParams()
  const searchParams = useSearchParams()
  const eventId = params.eventId as string
  const token = searchParams.get('token') ?? ''

  const [projects, setProjects] = useState<Project[]>([])
  const [votes, setVotes] = useState<Record<string, number>>({})
  const [creditsRemaining, setCreditsRemaining] = useState(100)
  const [ballotOrder, setBallotOrder] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState<string | null>(null)

  useEffect(() => {
    if (!token) { setLoading(false); return }
    Promise.all([
      fetch(`/api/events/${eventId}/projects?limit=50`).then((r) => r.json()),
      fetch(`/api/events/${eventId}/vote/cast?token=${token}`).then((r) => r.json()),
    ]).then(([projData, voteData]) => {
      const allProjects: Project[] = projData.data?.projects ?? []
      setProjects(allProjects)

      const existingVotes: Record<string, number> = {}
      for (const v of voteData.data?.votes ?? []) existingVotes[v.projectId] = v.voteCount
      setVotes(existingVotes)
      setCreditsRemaining(voteData.data?.creditsRemaining ?? 100)
      setBallotOrder(voteData.data?.ballotOrder ?? allProjects.map((p) => p.id))
      setLoading(false)
    })
  }, [eventId, token])

  function quadCost(k: number) { return k * k }
  function creditDelta(oldV: number, newV: number) { return quadCost(newV) - quadCost(oldV) }

  async function changeVote(projectId: string, newCount: number) {
    const old = votes[projectId] ?? 0
    const delta = creditDelta(old, newCount)
    if (creditsRemaining - delta < 0) { toast.error('Not enough credits!'); return }

    setPending(projectId)
    try {
      const res = await fetch(`/api/events/${eventId}/vote/cast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, projectId, voteCount: newCount }),
      })
      const d = await res.json()
      if (!res.ok) { toast.error(d.error ?? 'Vote failed'); return }
      setVotes((prev) => ({ ...prev, [projectId]: newCount }))
      setCreditsRemaining(d.data.creditsRemaining)
    } finally {
      setPending(null)
    }
  }

  const orderedProjects = ballotOrder.length > 0
    ? ballotOrder.map((id) => projects.find((p) => p.id === id)).filter(Boolean) as Project[]
    : projects

  if (!token) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="card" style={{ maxWidth: 420, padding: '2rem', textAlign: 'center' }}>
        <h2>Community Vote</h2>
        <p className="text-muted" style={{ marginTop: '0.5rem', marginBottom: '1.5rem' }}>Enter your email to get a voting token.</p>
        <VoterTokenForm eventId={eventId} />
      </div>
    </div>
  )

  const totalCredits = 100
  const creditPct = (creditsRemaining / totalCredits) * 100

  return (
    <div style={{ minHeight: '100vh' }}>
      <nav className="navbar">
        <div className="container navbar-inner">
          <span className="navbar-logo">DOGFOOD</span>
          <div className="badge badge-green"><CheckCircle2 size={12} /> Email Verified</div>
        </div>
      </nav>

      <main className="container" style={{ paddingTop: '2rem', paddingBottom: '4rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1>Community Vote</h1>
          <p className="text-secondary" style={{ marginTop: '0.5rem' }}>
            You have <strong style={{ color: 'var(--cyan-400)' }}>{creditsRemaining} credits</strong>.
            Voting k times for a project costs k² credits.
          </p>
          <div className="alert alert-info" style={{ maxWidth: 560, margin: '1rem auto 0', fontSize: '0.8125rem', justifyContent: 'center', gap: '0.5rem' }}>
            <Info size={14} /> Ballot order is randomized per voter to eliminate position bias.
          </div>
        </div>

        {/* Credit budget bar */}
        <div className="credit-bar" style={{ maxWidth: 680, margin: '0 auto 2.5rem' }}>
          <div className="credit-bar-header">
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Credits remaining</span>
            <span className="credit-remaining">{creditsRemaining} / {totalCredits}</span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${creditPct}%` }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <span>1 vote = 1 credit</span>
            <span>2 votes = 4 credits</span>
            <span>5 votes = 25 credits</span>
            <span>10 votes = 100 credits</span>
          </div>
        </div>

        {loading ? (
          <p className="text-muted" style={{ textAlign: 'center' }}>Loading projects...</p>
        ) : (
          <div className="grid-projects stagger">
            {orderedProjects.map((p) => {
              const currentVotes = votes[p.id] ?? 0
              const currentCost = quadCost(currentVotes)
              const nextCost = quadCost(currentVotes + 1) - currentCost
              const canAdd = creditsRemaining >= nextCost

              return (
                <div key={p.id} className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ height: 140, background: 'linear-gradient(135deg, var(--bg-elevated), var(--bg-overlay))', borderRadius: '14px 14px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: '2rem' }}>🚀</span>
                  </div>
                  <div className="card-body" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {p.track && <span className="badge badge-violet">{p.track.name}</span>}
                    <h3 style={{ fontSize: '1rem' }}>{p.title}</h3>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>by {p.team.name}</p>
                    {p.tagline && <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', flex: 1 }}>{p.tagline}</p>}

                    <div className="vote-control" style={{ marginTop: 'auto' }}>
                      <button
                        className="vote-btn"
                        onClick={() => changeVote(p.id, Math.max(0, currentVotes - 1))}
                        disabled={currentVotes === 0 || pending === p.id}
                      >
                        <Minus size={16} />
                      </button>
                      <span className="vote-count" style={{ color: currentVotes > 0 ? 'var(--violet-400)' : 'var(--text-muted)' }}>
                        {currentVotes}
                      </span>
                      <div style={{ position: 'relative' }}>
                        <button
                          className="vote-btn"
                          onClick={() => changeVote(p.id, currentVotes + 1)}
                          disabled={!canAdd || pending === p.id}
                          title={canAdd ? `Next vote costs ${nextCost} credit${nextCost !== 1 ? 's' : ''}` : 'Not enough credits'}
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                    </div>
                    <div className="vote-cost">
                      {currentVotes > 0
                        ? `Cost: ${currentCost} credit${currentCost !== 1 ? 's' : ''}`
                        : canAdd ? `1st vote = 1 credit` : 'No credits left'
                      }
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

function VoterTokenForm({ eventId }: { eventId: string }) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [tokenUrl, setTokenUrl] = useState('')

  async function request() {
    setLoading(true)
    try {
      const res = await fetch(`/api/events/${eventId}/vote/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const d = await res.json()
      if (!res.ok) { toast.error(d.error); return }
      setTokenUrl(d.data.voteUrl)
      toast.success('Voting link generated!')
    } finally {
      setLoading(false)
    }
  }

  if (tokenUrl) return (
    <div>
      <p className="text-secondary" style={{ marginBottom: '1rem', fontSize: '0.875rem' }}>Your voting link:</p>
      <a href={tokenUrl} className="btn btn-primary w-full">{tokenUrl.slice(0, 50)}...</a>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <input className="form-input" type="email" placeholder="your@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
      <button className="btn btn-primary" onClick={request} disabled={!email || loading}>
        {loading ? 'Requesting...' : 'Get Voting Link'}
      </button>
    </div>
  )
}

export default function VotingPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><p className="text-muted">Loading...</p></div>}>
      <VotingContent />
    </Suspense>
  )
}

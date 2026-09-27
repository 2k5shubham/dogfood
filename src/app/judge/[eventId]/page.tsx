'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'
import { CheckCircle2, Circle, Lock, ExternalLink, GitBranch, ChevronRight } from 'lucide-react'

interface Assignment {
  id: string
  completedAt: string | null
  project: { id: string; title: string; tagline: string | null; team: { name: string } }
}
interface Criterion { id: string; name: string; description: string | null; weight: number; maxScore: number; order: number }
interface Score { criterionId: string; score: number; note: string | null }

async function safeJson(res: Response) {
  if (!res.ok) return null
  try { return await res.json() } catch { return null }
}

export default function JudgeDashboard() {
  const params = useParams()
  const eventId = params.eventId as string

  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [criteria, setCriteria] = useState<Criterion[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [scores, setScores] = useState<Record<string, { score: number; note: string }>>({})
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  const completed = assignments.filter((a) => a.completedAt).length
  const pct = assignments.length ? Math.round((completed / assignments.length) * 100) : 0

  useEffect(() => {
    Promise.all([
      fetch(`/api/events/${eventId}/judges`).then(safeJson),
      fetch(`/api/events/${eventId}/rubric`).then(safeJson),
    ]).then(([judgeData, rubricData]) => {
      const a = judgeData?.data?.assignments ?? []
      setAssignments(a)
      setCriteria(rubricData?.data?.criteria ?? [])
      if (a.length > 0) setSelectedProjectId(a[0].project.id)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [eventId])

  useEffect(() => {
    if (!selectedProjectId) return
    fetch(`/api/events/${eventId}/projects/${selectedProjectId}/scores`)
      .then(safeJson)
      .then((d) => {
        const existing: Record<string, { score: number; note: string }> = {}
        for (const s of d?.data?.scores ?? []) {
          existing[s.criterionId] = { score: s.score, note: s.note ?? '' }
        }
        setScores(existing)
      })
      .catch(() => {})
  }, [selectedProjectId, eventId])

  async function saveScores() {
    if (!selectedProjectId) return
    setSaving(true)
    try {
      for (const criterion of criteria) {
        const s = scores[criterion.id]
        if (s === undefined) continue
        const res = await fetch(`/api/events/${eventId}/projects/${selectedProjectId}/scores`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ criterionId: criterion.id, score: s.score, note: s.note }),
        })
        if (!res.ok) { toast.error('Failed to save scores'); return }
      }
      // Mark complete
      await fetch(`/api/events/${eventId}/projects/${selectedProjectId}/scores`, { method: 'PATCH' })
      toast.success('Scores submitted!')
      setAssignments((prev) =>
        prev.map((a) => a.project.id === selectedProjectId ? { ...a, completedAt: new Date().toISOString() } : a)
      )
    } finally {
      setSaving(false)
    }
  }

  const circumference = 2 * Math.PI * 36
  const strokeDash = circumference - (pct / 100) * circumference

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p className="text-muted">Loading your assignments...</p>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Navbar */}
      <nav className="navbar">
        <div className="container navbar-inner">
          <span className="navbar-logo">DOGFOOD</span>
          <div className="isolation-badge">
            <Lock size={12} /> Your scores are private
          </div>
        </div>
      </nav>

      <div style={{ display: 'flex', flex: 1 }}>
        {/* Left sidebar — project list */}
        <aside style={{ width: 280, borderRight: '1px solid var(--border)', padding: '1.5rem 1rem', position: 'sticky', top: 60, height: 'calc(100vh - 60px)', overflowY: 'auto', flexShrink: 0 }}>
          <p className="sidebar-title">Assigned Projects</p>
          {assignments.map((a) => (
            <div
              key={a.id}
              className={`sidebar-item${selectedProjectId === a.project.id ? ' active' : ''}`}
              onClick={() => setSelectedProjectId(a.project.id)}
              style={{ justifyContent: 'space-between', cursor: 'pointer', marginBottom: '0.25rem' }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.875rem', color: selectedProjectId === a.project.id ? 'var(--violet-400)' : 'var(--text-primary)' }}>
                  {a.project.title}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{a.project.team.name}</div>
              </div>
              {a.completedAt
                ? <CheckCircle2 size={16} color="var(--green-400)" />
                : <Circle size={16} color="var(--text-muted)" />
              }
            </div>
          ))}
        </aside>

        {/* Main scoring panel */}
        <main style={{ flex: 1, padding: '2rem', maxWidth: 900 }}>
          {!selectedProjectId ? (
            <div className="card" style={{ textAlign: 'center', padding: '4rem' }}>
              <p className="text-muted">Select a project from the sidebar to begin scoring.</p>
            </div>
          ) : (() => {
            const assignment = assignments.find((a) => a.project.id === selectedProjectId)
            const project = assignment?.project
            if (!project) return null
            return (
              <div className="animate-fade-in">
                {/* Project header */}
                <div className="card" style={{ marginBottom: '1.5rem' }}>
                  <div className="card-body">
                    <div className="flex items-center justify-between" style={{ marginBottom: '0.5rem' }}>
                      <h2 style={{ fontSize: '1.5rem' }}>{project.title}</h2>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <a href="#" className="btn btn-outline btn-sm"><GitBranch size={14} /> Repo</a>
                        <a href="#" className="btn btn-outline btn-sm"><ExternalLink size={14} /> Demo</a>
                      </div>
                    </div>
                    <p className="text-secondary">by {project.team.name}</p>
                    {project.tagline && <p style={{ marginTop: '0.75rem', color: 'var(--text-secondary)' }}>{project.tagline}</p>}
                  </div>
                </div>

                {/* Rubric scoring */}
                <div className="card" style={{ marginBottom: '1.5rem' }}>
                  <div className="card-body">
                    <h3 style={{ marginBottom: '1.5rem' }}>Scoring Rubric</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                      {criteria.map((c) => {
                        const current = scores[c.id] ?? { score: 0, note: '' }
                        return (
                          <div key={c.id} style={{ borderBottom: '1px solid var(--border)', paddingBottom: '1.5rem' }}>
                            <div className="flex items-center justify-between" style={{ marginBottom: '0.75rem' }}>
                              <div>
                                <span style={{ fontWeight: 700 }}>{c.name}</span>
                                <span className="badge badge-violet" style={{ marginLeft: '0.75rem' }}>
                                  {Math.round(c.weight * 100)}%
                                </span>
                              </div>
                              <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--violet-400)', fontFamily: 'var(--font-mono)' }}>
                                {current.score.toFixed(1)} / {c.maxScore}
                              </span>
                            </div>
                            {c.description && <p className="text-muted" style={{ fontSize: '0.8125rem', marginBottom: '0.75rem' }}>{c.description}</p>}
                            <input
                              type="range"
                              className="score-slider"
                              min={0}
                              max={c.maxScore}
                              step={0.5}
                              value={current.score}
                              onChange={(e) => setScores((prev) => ({
                                ...prev,
                                [c.id]: { ...prev[c.id], score: parseFloat(e.target.value) },
                              }))}
                              style={{ marginBottom: '0.75rem' }}
                            />
                            <input
                              className="form-input"
                              style={{ fontSize: '0.875rem' }}
                              placeholder={`Notes for ${c.name}...`}
                              value={current.note}
                              onChange={(e) => setScores((prev) => ({
                                ...prev,
                                [c.id]: { ...prev[c.id], note: e.target.value },
                              }))}
                            />
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>

                <button className="btn btn-primary btn-lg w-full" onClick={saveScores} disabled={saving}>
                  {saving ? 'Saving...' : 'Submit Scores'} {!saving && <ChevronRight size={18} />}
                </button>
              </div>
            )
          })()}
        </main>

        {/* Right — progress ring */}
        <aside style={{ width: 200, padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', borderLeft: '1px solid var(--border)' }}>
          <svg width={100} height={100} viewBox="0 0 100 100">
            <defs>
              <linearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="var(--violet-500)" />
                <stop offset="100%" stopColor="var(--cyan-500)" />
              </linearGradient>
            </defs>
            <circle cx="50" cy="50" r="36" fill="none" stroke="var(--bg-overlay)" strokeWidth="8" />
            <circle
              cx="50" cy="50" r="36" fill="none"
              stroke="url(#ringGradient)" strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDash}
              transform="rotate(-90 50 50)"
              style={{ transition: 'stroke-dashoffset 0.5s ease' }}
            />
            <text x="50" y="46" textAnchor="middle" fill="var(--text-primary)" fontSize="14" fontWeight="bold">{completed}</text>
            <text x="50" y="60" textAnchor="middle" fill="var(--text-muted)" fontSize="10">of {assignments.length}</text>
          </svg>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Projects Scored</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--violet-400)' }}>{pct}%</div>
          </div>
          <div className="isolation-badge" style={{ textAlign: 'center', fontSize: '0.75rem', flexDirection: 'column', gap: '0.25rem' }}>
            <Lock size={14} />
            Score Isolation Active
          </div>
        </aside>
      </div>
    </div>
  )
}

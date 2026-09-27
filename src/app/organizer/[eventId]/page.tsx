'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { Users, FileText, BarChart2, CheckSquare, Download, Play, Eye, EyeOff } from 'lucide-react'

async function safeJson(res: Response) {
  if (!res.ok) return null
  try { return await res.json() } catch { return null }
}

interface Summary {
  projectCount: number; judgeCount: number
  completedAssignments: number; totalAssignments: number; completionPercent: number
}
interface ProgressItem { projectId: string; totalAssigned: number; completed: number }
interface LeaderboardEntry {
  projectId: string; title: string; teamName: string
  trackName?: string; normalizedScore: number | null; judgeCount: number
}

export default function OrganizerDashboard() {
  const params = useParams()
  const eventId = params.eventId as string

  const [summary, setSummary] = useState<Summary | null>(null)
  const [progress, setProgress] = useState<ProgressItem[]>([])
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [published, setPublished] = useState(false)
  const [scoresVisible, setScoresVisible] = useState(false)
  const [normalizing, setNormalizing] = useState(false)
  const [loading, setLoading] = useState(true)

  async function fetchData() {
    try {
      const res = await fetch(`/api/events/${eventId}/scores/summary`)
      const d = await safeJson(res)
      setSummary(d?.data?.summary ?? null)
      setProgress(d?.data?.progress ?? [])
      setLeaderboard(d?.data?.leaderboard ?? [])
      setPublished(d?.data?.resultsPublished ?? false)
    } catch {}
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [eventId])

  async function triggerNormalization() {
    setNormalizing(true)
    try {
      const res = await fetch(`/api/events/${eventId}/scores/summary`, { method: 'POST' })
      const d = await res.json()
      if (!res.ok) { toast.error(d.error); return }
      toast.success(`Normalization complete — ${d.data.projectsNormalized} projects`)
      await fetchData()
    } finally {
      setNormalizing(false)
    }
  }

  async function publishResults() {
    const res = await fetch(`/api/events/${eventId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resultsPublishedAt: new Date().toISOString(), status: 'closed' }),
    })
    if (res.ok) { toast.success('Results published!'); setPublished(true); await fetchData() }
    else toast.error('Failed to publish results')
  }

  const chartData = progress.slice(0, 30).map((p, i) => ({
    name: `P${i + 1}`,
    completed: p.completed,
    pending: p.totalAssigned - p.completed,
  }))

  const rankedLeaderboard = leaderboard
    .map((e, i) => ({ ...e, rank: i + 1 }))
    .sort((a, b) => (b.normalizedScore ?? -999) - (a.normalizedScore ?? -999))

  return (
    <div style={{ minHeight: '100vh' }}>
      <nav className="navbar">
        <div className="container navbar-inner">
          <span className="navbar-logo">DOGFOOD</span>
          <span className="badge badge-violet">Organizer Dashboard</span>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <a href={`/api/events/${eventId}/scores/export`} className="btn btn-cyan btn-sm">
              <Download size={14} /> Export CSV
            </a>
          </div>
        </div>
      </nav>

      <main className="container" style={{ paddingTop: '2rem', paddingBottom: '4rem' }}>
        {loading ? (
          <p className="text-muted">Loading dashboard...</p>
        ) : (
          <>
            {/* Stat cards */}
            <div className="grid-stats stagger" style={{ marginBottom: '2rem' }}>
              {[
                { label: 'Projects Submitted', value: summary?.projectCount ?? 0, icon: <FileText size={20} />, color: 'violet' },
                { label: 'Judges Active', value: summary?.judgeCount ?? 0, icon: <Users size={20} />, color: 'cyan' },
                { label: 'Scoring Complete', value: `${summary?.completionPercent ?? 0}%`, icon: <BarChart2 size={20} />, color: 'green' },
                { label: 'Reviews Done', value: `${summary?.completedAssignments ?? 0}/${summary?.totalAssignments ?? 0}`, icon: <CheckSquare size={20} />, color: 'amber' },
              ].map(({ label, value, icon, color }) => (
                <div key={label} className="card stat-card">
                  <div className={`stat-card-icon ${color}`}>{icon}</div>
                  <div>
                    <div className="stat-card-value">{value}</div>
                    <div className="stat-card-label">{label}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
              {/* Judging progress chart */}
              <div className="card">
                <div className="card-body">
                  <h3 style={{ marginBottom: '1.25rem' }}>Judging Progress by Project</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={chartData} barSize={8} barGap={2}>
                      <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)' }}
                      />
                      <Bar dataKey="completed" fill="var(--violet-500)" radius={[3, 3, 0, 0]} name="Completed" />
                      <Bar dataKey="pending" fill="var(--bg-overlay)" radius={[3, 3, 0, 0]} name="Pending" />
                    </BarChart>
                  </ResponsiveContainer>
                  <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--violet-500)', display: 'inline-block' }} /> Completed</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--bg-overlay)', border: '1px solid var(--border)', display: 'inline-block' }} /> Pending</span>
                  </div>
                </div>
              </div>

              {/* Controls */}
              <div className="card">
                <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <h3>Actions</h3>
                  <button className="btn btn-primary" onClick={triggerNormalization} disabled={normalizing}>
                    <Play size={16} /> {normalizing ? 'Normalizing...' : 'Trigger Normalization'}
                  </button>
                  <div className="alert alert-info" style={{ fontSize: '0.8125rem' }}>
                    Method: <strong>Z-Score (σ-normalized per judge)</strong><br />
                    Handles σ=0 edge case (uniform scorers contribute 0)
                  </div>
                  {!published ? (
                    <button className="btn btn-cyan" onClick={publishResults}>
                      <Eye size={16} /> Publish Results
                    </button>
                  ) : (
                    <div className="badge badge-green" style={{ padding: '0.5rem 1rem', justifyContent: 'center' }}>
                      ✓ Results Published
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Leaderboard */}
            <div className="card">
              <div className="card-body">
                <div className="flex items-center justify-between" style={{ marginBottom: '1.25rem' }}>
                  <h3>Live Leaderboard</h3>
                  {!published && (
                    <button className="btn btn-ghost btn-sm" onClick={() => setScoresVisible((v) => !v)}>
                      {scoresVisible ? <EyeOff size={14} /> : <Eye size={14} />}
                      {scoresVisible ? 'Hide Scores' : 'Preview Scores'}
                    </button>
                  )}
                </div>
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Rank</th>
                        <th>Project</th>
                        <th>Team</th>
                        <th>Track</th>
                        <th>Reviews</th>
                        <th>Normalized Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rankedLeaderboard.map((e) => (
                        <tr key={e.projectId}>
                          <td>
                            <span style={{ fontWeight: 800, color: e.rank <= 3 ? 'var(--amber-400)' : 'var(--text-muted)' }}>
                              #{e.rank}
                            </span>
                          </td>
                          <td style={{ fontWeight: 600 }}>{e.title}</td>
                          <td className="text-muted">{e.teamName}</td>
                          <td>{e.trackName ? <span className="badge badge-violet">{e.trackName}</span> : '—'}</td>
                          <td><span className="badge badge-cyan">{e.judgeCount}</span></td>
                          <td>
                            <span style={{ filter: (!published && !scoresVisible) ? 'blur(6px)' : 'none', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--cyan-400)', transition: 'filter 0.3s' }}>
                              {e.normalizedScore !== null ? e.normalizedScore.toFixed(3) : '—'}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {rankedLeaderboard.length === 0 && (
                        <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>Run normalization to see scores</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}

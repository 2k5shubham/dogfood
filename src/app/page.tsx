'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { 
  Search, 
  Trophy, 
  Code2, 
  Zap, 
  ArrowRight, 
  GitBranch, 
  MessageSquare,
  Sparkles,
  LogOut,
  LayoutDashboard,
  Award,
  PlusCircle
} from 'lucide-react'

interface Project {
  id: string
  title: string
  tagline: string | null
  coverUrl: string | null
  team: { id: string; name: string }
  track: { id: string; name: string } | null
  _count: { comments: number; projectVotes: number }
}

interface Track { id: string; name: string }

interface User {
  id: string
  displayName: string
  email: string
  globalRole: string
}

async function safeJson(res: Response) {
  if (!res.ok) return null
  try { return await res.json() } catch { return null }
}

export default function GalleryPage() {
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [tracks, setTracks] = useState<Track[]>([])
  const [q, setQ] = useState('')
  const [selectedTrack, setSelectedTrack] = useState('')
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [eventId, setEventId] = useState<string | null>(null)
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    // Check auth
    fetch('/api/auth/me')
      .then(safeJson)
      .then((d) => {
        if (d?.data?.user) setUser(d.data.user)
      })
      .catch(() => {})

    // Active event
    fetch('/api/events?status=active&limit=1')
      .then(safeJson)
      .then((d) => {
        const ev = d?.data?.events?.[0]
        if (ev) {
          setEventId(ev.id)
          setTracks(ev.tracks ?? [])
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!eventId) return
    setLoading(true)
    const params = new URLSearchParams({ limit: '12' })
    if (q) params.set('q', q)
    if (selectedTrack) params.set('track', selectedTrack)

    fetch(`/api/events/${eventId}/projects?${params}`)
      .then(safeJson)
      .then((d) => {
        setProjects(d?.data?.projects ?? [])
        setTotal(d?.data?.total ?? 0)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [eventId, q, selectedTrack])

  const handleLogout = async () => {
    await fetch('/api/auth/session', { method: 'DELETE' })
    setUser(null)
    router.refresh()
  }

  return (
    <div>
      {/* Navbar */}
      <nav className="navbar">
        <div className="container navbar-inner">
          <Link href="/" className="navbar-logo">DOGFOOD</Link>
          <ul className="navbar-links">
            <li><Link href="/" className="navbar-link active">Explore</Link></li>
            <li><Link href="/leaderboard" className="navbar-link">Leaderboard</Link></li>
            {eventId && <li><Link href={`/vote/${eventId}`} className="navbar-link">Community Vote</Link></li>}
          </ul>
          <div className="navbar-actions">
            {user ? (
              <div className="flex items-center gap-2">
                <Link href="/submit" className="btn btn-primary btn-sm flex items-center gap-1">
                  <PlusCircle size={14} /> Submit
                </Link>
                {eventId && (user.globalRole === 'admin' || user.globalRole === 'organizer') && (
                  <Link href={`/organizer/${eventId}`} className="btn btn-secondary btn-sm flex items-center gap-1">
                    <LayoutDashboard size={14} /> Organizer
                  </Link>
                )}
                {eventId && (
                  <Link href={`/judge/${eventId}`} className="btn btn-secondary btn-sm flex items-center gap-1">
                    <Award size={14} /> Judge Portal
                  </Link>
                )}
                <div
                  style={{
                    padding: '0.25rem 0.6rem',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.8125rem',
                    color: 'var(--text-secondary)',
                  }}
                >
                  {user.displayName}
                </div>
                <button onClick={handleLogout} className="btn btn-ghost btn-sm" title="Log out">
                  <LogOut size={15} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/login" className="btn btn-ghost btn-sm">Login</Link>
                <Link href="/register" className="btn btn-primary btn-sm">Sign Up</Link>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="hero">
        <div className="container">
          <div className="hero-eyebrow">
            <Zap size={14} />
            Open Source Hackathon Platform
          </div>
          <h1 className="hero-title">
            Build the future of<br />
            <span className="gradient-text">hackathons</span>
          </h1>
          <p className="hero-subtitle">
            A modern, self-hostable submission and judging platform.
            Weighted scoring, quadratic voting, zero cloud dependency.
          </p>
          <div className="hero-actions">
            <Link href={user ? "/submit" : "/register"} className="btn btn-primary btn-lg">
              Start Building <ArrowRight size={18} />
            </Link>
            {eventId && (
              <Link href={`/vote/${eventId}`} className="btn btn-secondary btn-lg">
                <Trophy size={18} /> Quadratic Vote
              </Link>
            )}
            <a href="https://github.com/balyansourabh/raptors" className="btn btn-outline btn-lg" target="_blank" rel="noopener noreferrer">
              <GitBranch size={18} /> View on GitHub
            </a>
          </div>
        </div>
      </section>

      {/* Gallery */}
      <main className="container" style={{ paddingBottom: '4rem' }}>
        {/* Search bar */}
        <div style={{ position: 'relative', marginBottom: '2rem' }}>
          <Search
            size={18}
            style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
          />
          <input
            className="input"
            style={{ paddingLeft: '2.75rem', height: '48px', fontSize: '1rem' }}
            placeholder="Search projects by title, description, or stack..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <div className="layout-sidebar">
          {/* Tracks filter */}
          <aside className="layout-sidebar-aside">
            <div className="sidebar-group">
              <p className="sidebar-title">Tracks</p>
              <div
                className={`sidebar-item${!selectedTrack ? ' active' : ''}`}
                onClick={() => setSelectedTrack('')}
              >
                All Tracks
              </div>
              {tracks.map((t) => (
                <div
                  key={t.id}
                  className={`sidebar-item${selectedTrack === t.id ? ' active' : ''}`}
                  onClick={() => setSelectedTrack(t.id)}
                >
                  {t.name}
                </div>
              ))}
            </div>
          </aside>

          {/* Project grid */}
          <div className="layout-content">
            {loading ? (
              <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '4rem' }}>
                Loading projects...
              </div>
            ) : projects.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: '4rem' }}>
                <Code2 size={48} style={{ color: 'var(--text-muted)', margin: '0 auto 1rem' }} />
                <h3>No projects yet</h3>
                <p className="text-muted" style={{ marginTop: '0.5rem' }}>
                  {q ? 'Try a different search' : 'Be the first to submit!'}
                </p>
              </div>
            ) : (
              <>
                <p className="text-muted" style={{ marginBottom: '1.5rem', fontSize: '0.875rem' }}>
                  {total} project{total !== 1 ? 's' : ''} {selectedTrack ? 'in this track' : ''}
                </p>
                <div className="grid-projects stagger">
                  {projects.map((p) => (
                    <Link key={p.id} href={`/projects/${p.id}`} style={{ textDecoration: 'none' }}>
                      <div className="card project-card">
                        <div
                          className="project-card-cover"
                          style={{
                            background: p.coverUrl
                              ? `url(${p.coverUrl}) center/cover`
                              : 'linear-gradient(135deg, #1a1a2e, #16213e)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {!p.coverUrl && (
                            <Code2 size={40} style={{ color: 'var(--text-muted)' }} />
                          )}
                        </div>
                        <div className="project-card-body">
                          {p.track && (
                            <span className="badge badge-violet" style={{ marginBottom: '0.5rem' }}>
                              {p.track.name}
                            </span>
                          )}
                          <h3 className="project-card-title">{p.title}</h3>
                          <p className="project-card-team">by {p.team.name}</p>
                          {p.tagline && (
                            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                              {p.tagline}
                            </p>
                          )}
                          <div className="project-card-footer">
                            <div className="flex items-center gap-3" style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                              <span className="flex items-center gap-1">
                                <MessageSquare size={13} /> {p._count.comments}
                              </span>
                              <span className="flex items-center gap-1">
                                <Trophy size={13} /> {p._count.projectVotes}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

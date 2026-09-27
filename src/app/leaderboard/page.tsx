'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { 
  Trophy, 
  Medal, 
  Award, 
  Sparkles, 
  Lock, 
  ArrowLeft, 
  Flame, 
  CheckCircle2, 
  Calculator,
  ChevronRight,
  ExternalLink
} from 'lucide-react'

interface LeaderboardEntry {
  rank: number | null
  projectId: string
  title: string
  tagline: string | null
  teamName: string
  trackId: string | null
  trackName: string | null
  coverUrl: string | null
  normalizedScore: number | null
  rawWeightedAvg: number | null
  judgeCount: number
  communityVotes: number
}

interface Track {
  id: string
  name: string
  prizeAmount: number | null
}

interface EventData {
  id: string
  title: string
  resultsPublished: boolean
  resultsPublishedAt: string | null
  votingDeadline: string
  tracks: Track[]
}

export default function LeaderboardPage() {
  const [event, setEvent] = useState<EventData | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [communityWinner, setCommunityWinner] = useState<LeaderboardEntry | null>(null)
  const [selectedTrack, setSelectedTrack] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/events?status=active&limit=1')
      .then((r) => r.json())
      .then(async (d) => {
        const ev = d?.data?.events?.[0]
        if (!ev) {
          setLoading(false)
          return
        }
        const res = await fetch(`/api/events/${ev.id}/leaderboard`)
        if (res.ok) {
          const lbData = await res.json()
          setEvent(lbData.data.event)
          setLeaderboard(lbData.data.leaderboard || [])
          setCommunityWinner(lbData.data.communityWinner)
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const filteredLeaderboard = selectedTrack
    ? leaderboard.filter((p) => p.trackId === selectedTrack)
    : leaderboard

  const topThree = event?.resultsPublished ? filteredLeaderboard.slice(0, 3) : []

  return (
    <div style={{ minHeight: '100vh', paddingBottom: '6rem' }}>
      {/* Navbar */}
      <nav className="navbar">
        <div className="container navbar-inner">
          <Link href="/" className="navbar-logo">DOGFOOD</Link>
          <ul className="navbar-links">
            <li><Link href="/" className="navbar-link">Explore</Link></li>
            <li><Link href="/leaderboard" className="navbar-link active">Leaderboard</Link></li>
          </ul>
          <div className="navbar-actions">
            <Link href="/" className="btn btn-ghost btn-sm">
              <ArrowLeft size={15} /> Back
            </Link>
            {event && (
              <Link href={`/organizer/${event.id}`} className="btn btn-secondary btn-sm">
                Organizer Portal
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div
        style={{
          borderBottom: '1px solid var(--border)',
          background: 'linear-gradient(180deg, rgba(139, 92, 246, 0.12) 0%, rgba(8, 8, 15, 0.95) 100%)',
          padding: '3.5rem 0 2.5rem',
          textAlign: 'center',
        }}
      >
        <div className="container" style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div className="badge badge-violet" style={{ display: 'inline-flex', marginBottom: '1rem', gap: '6px' }}>
            <Trophy size={14} /> Official Standings
          </div>
          <h1 style={{ fontSize: '2.75rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '1rem' }}>
            Hackathon <span className="gradient-text">Leaderboard</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.125rem', lineHeight: 1.6 }}>
            Rankings calibrated via mathematically robust <strong>Z-score normalization</strong> to eliminate judge bias, paired with community quadratic voting.
          </p>

          {/* Normalization Explainer Pill */}
          <div
            style={{
              marginTop: '1.5rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(139, 92, 246, 0.08)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-full)',
              padding: '0.4rem 1rem',
              fontSize: '0.8125rem',
              color: 'var(--violet-400)',
            }}
          >
            <Calculator size={14} />
            <span>Formula: z = (score - &mu;) / &sigma; with &sigma;=0 handled gracefully</span>
          </div>
        </div>
      </div>

      <div className="container" style={{ marginTop: '2.5rem' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '5rem 0', color: 'var(--text-muted)' }}>
            Loading standings...
          </div>
        ) : !event ? (
          <div className="card" style={{ textAlign: 'center', padding: '4rem 1rem' }}>
            <h3>No active event found</h3>
          </div>
        ) : !event.resultsPublished ? (
          /* UNPUBLISHED STATE */
          <div style={{ maxWidth: '750px', margin: '2rem auto' }}>
            <div
              className="card"
              style={{
                textAlign: 'center',
                padding: '3.5rem 2rem',
                border: '1px solid var(--border-hover)',
                background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.06), rgba(6, 182, 212, 0.04))',
              }}
            >
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  background: 'rgba(139, 92, 246, 0.15)',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1.5rem',
                  color: 'var(--violet-400)',
                }}
              >
                <Lock size={30} />
              </div>
              <h2 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '0.75rem' }}>
                Results Under Evaluation
              </h2>
              <p style={{ color: 'var(--text-secondary)', maxWidth: '520px', margin: '0 auto 1.75rem', lineHeight: 1.6 }}>
                Judges are currently reviewing projects with isolated double-blind evaluations. Once all scores are locked, the organizer triggers Z-score normalization and reveals final rankings.
              </p>

              <div className="flex justify-center gap-3">
                <Link href={`/organizer/${event.id}`} className="btn btn-primary">
                  Organizer Control Panel
                </Link>
                <Link href={`/vote/${event.id}`} className="btn btn-secondary">
                  Community Quadratic Voting
                </Link>
              </div>
            </div>

            {/* Blurred Preview Teaser */}
            <div style={{ marginTop: '2rem', filter: 'blur(5px)', opacity: 0.4, pointerEvents: 'none' }}>
              <div className="card" style={{ padding: '1rem' }}>
                <div style={{ height: '40px', background: 'var(--bg-elevated)', borderRadius: '6px', marginBottom: '8px' }} />
                <div style={{ height: '40px', background: 'var(--bg-elevated)', borderRadius: '6px', marginBottom: '8px' }} />
                <div style={{ height: '40px', background: 'var(--bg-elevated)', borderRadius: '6px' }} />
              </div>
            </div>
          </div>
        ) : (
          /* PUBLISHED LEADERBOARD */
          <div>
            {/* Track Filter Tabs */}
            <div className="flex items-center justify-between" style={{ marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div className="flex items-center gap-2" style={{ flexWrap: 'wrap' }}>
                <button
                  className={`btn btn-sm ${!selectedTrack ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setSelectedTrack('')}
                >
                  All Tracks ({leaderboard.length})
                </button>
                {event.tracks.map((t) => (
                  <button
                    key={t.id}
                    className={`btn btn-sm ${selectedTrack === t.id ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setSelectedTrack(t.id)}
                  >
                    {t.name} {t.prizeAmount ? `($${t.prizeAmount})` : ''}
                  </button>
                ))}
              </div>

              {communityWinner && (
                <div
                  className="flex items-center gap-2"
                  style={{
                    background: 'rgba(251, 191, 36, 0.1)',
                    border: '1px solid rgba(251, 191, 36, 0.3)',
                    padding: '0.4rem 0.85rem',
                    borderRadius: 'var(--radius-full)',
                    fontSize: '0.85rem',
                  }}
                >
                  <Flame size={15} style={{ color: 'var(--amber-400)' }} />
                  <span style={{ color: 'var(--text-secondary)' }}>Community Choice:</span>
                  <strong style={{ color: 'var(--amber-400)' }}>{communityWinner.title}</strong>
                  <span className="badge badge-sm badge-amber">{communityWinner.communityVotes} votes</span>
                </div>
              )}
            </div>

            {/* Podium Cards for Top 3 */}
            {topThree.length >= 3 && !selectedTrack && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: '1.5rem',
                  marginBottom: '3rem',
                }}
              >
                {/* 2nd Place */}
                <div
                  className="card"
                  style={{
                    background: 'linear-gradient(135deg, rgba(148, 163, 184, 0.1), rgba(14, 14, 26, 0.8))',
                    border: '1px solid rgba(148, 163, 184, 0.3)',
                    textAlign: 'center',
                    padding: '2rem 1.5rem',
                    position: 'relative',
                  }}
                >
                  <div
                    style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      background: 'rgba(148, 163, 184, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 1rem',
                      color: '#cbd5e1',
                      fontWeight: 800,
                    }}
                  >
                    <Medal size={24} />
                  </div>
                  <span className="badge badge-muted" style={{ marginBottom: '0.5rem' }}>2nd Place</span>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.25rem' }}>{topThree[1].title}</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1rem' }}>by {topThree[1].teamName}</p>
                  <div className="flex items-center justify-center gap-2">
                    <span className="badge badge-violet">Z: {topThree[1].normalizedScore}</span>
                    <span className="badge badge-cyan">Raw: {topThree[1].rawWeightedAvg}/5</span>
                  </div>
                </div>

                {/* 1st Place (Grand Champion) */}
                <div
                  className="card"
                  style={{
                    background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.15), rgba(14, 14, 26, 0.9))',
                    border: '2px solid rgba(251, 191, 36, 0.5)',
                    boxShadow: '0 0 30px rgba(251, 191, 36, 0.2)',
                    textAlign: 'center',
                    padding: '2.5rem 1.5rem',
                    transform: 'translateY(-10px)',
                    position: 'relative',
                  }}
                >
                  <div
                    style={{
                      width: '56px',
                      height: '56px',
                      borderRadius: '50%',
                      background: 'rgba(251, 191, 36, 0.25)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 1rem',
                      color: 'var(--amber-400)',
                      fontWeight: 900,
                    }}
                  >
                    <Trophy size={30} />
                  </div>
                  <span className="badge badge-amber" style={{ marginBottom: '0.5rem' }}>🏆 Grand Champion</span>
                  <h3 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.25rem' }}>{topThree[0].title}</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>by {topThree[0].teamName}</p>
                  <div className="flex items-center justify-center gap-2">
                    <span className="badge badge-violet" style={{ fontSize: '0.85rem' }}>Z-Score: +{topThree[0].normalizedScore}</span>
                    <span className="badge badge-cyan" style={{ fontSize: '0.85rem' }}>Raw: {topThree[0].rawWeightedAvg}/5</span>
                  </div>
                </div>

                {/* 3rd Place */}
                <div
                  className="card"
                  style={{
                    background: 'linear-gradient(135deg, rgba(205, 127, 50, 0.1), rgba(14, 14, 26, 0.8))',
                    border: '1px solid rgba(205, 127, 50, 0.3)',
                    textAlign: 'center',
                    padding: '2rem 1.5rem',
                    position: 'relative',
                  }}
                >
                  <div
                    style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      background: 'rgba(205, 127, 50, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 1rem',
                      color: '#d97706',
                      fontWeight: 800,
                    }}
                  >
                    <Award size={24} />
                  </div>
                  <span className="badge badge-muted" style={{ marginBottom: '0.5rem' }}>3rd Place</span>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.25rem' }}>{topThree[2].title}</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1rem' }}>by {topThree[2].teamName}</p>
                  <div className="flex items-center justify-center gap-2">
                    <span className="badge badge-violet">Z: {topThree[2].normalizedScore}</span>
                    <span className="badge badge-cyan">Raw: {topThree[2].rawWeightedAvg}/5</span>
                  </div>
                </div>
              </div>
            )}

            {/* Standings Table */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '1rem 1.25rem', width: '80px' }}>Rank</th>
                      <th style={{ padding: '1rem 1.25rem' }}>Project & Team</th>
                      <th style={{ padding: '1rem 1.25rem' }}>Track</th>
                      <th style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>Normalized Z-Score</th>
                      <th style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>Raw Avg</th>
                      <th style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>Community Votes</th>
                      <th style={{ padding: '1rem 1.25rem', width: '100px', textAlign: 'center' }}>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLeaderboard.map((p, idx) => (
                      <tr
                        key={p.projectId}
                        style={{
                          borderBottom: '1px solid var(--border)',
                          background: idx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.01)',
                        }}
                      >
                        <td style={{ padding: '1rem 1.25rem', fontWeight: 700 }}>
                          {idx === 0 ? (
                            <span style={{ color: 'var(--amber-400)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Trophy size={15} /> #1
                            </span>
                          ) : idx === 1 ? (
                            <span style={{ color: '#cbd5e1' }}>#2</span>
                          ) : idx === 2 ? (
                            <span style={{ color: '#d97706' }}>#3</span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>#{idx + 1}</span>
                          )}
                        </td>
                        <td style={{ padding: '1rem 1.25rem' }}>
                          <Link href={`/projects/${p.projectId}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2px' }}>
                              {p.title}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                              by {p.teamName}
                            </div>
                          </Link>
                        </td>
                        <td style={{ padding: '1rem 1.25rem' }}>
                          {p.trackName ? (
                            <span className="badge badge-sm badge-violet">{p.trackName}</span>
                          ) : (
                            <span style={{ color: 'var(--text-disabled)' }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: '1rem 1.25rem', textAlign: 'right', fontWeight: 700, color: 'var(--violet-400)', fontFamily: 'var(--font-mono)' }}>
                          {p.normalizedScore !== null ? (p.normalizedScore > 0 ? `+${p.normalizedScore}` : p.normalizedScore) : '—'}
                        </td>
                        <td style={{ padding: '1rem 1.25rem', textAlign: 'right', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                          {p.rawWeightedAvg !== null ? `${p.rawWeightedAvg} / 5` : '—'}
                        </td>
                        <td style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>
                          <span className="badge badge-sm badge-muted">
                            {p.communityVotes} votes
                          </span>
                        </td>
                        <td style={{ padding: '1rem 1.25rem', textAlign: 'center' }}>
                          <Link href={`/projects/${p.projectId}`} className="btn btn-ghost btn-sm" style={{ padding: '4px 8px' }}>
                            <ChevronRight size={16} />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

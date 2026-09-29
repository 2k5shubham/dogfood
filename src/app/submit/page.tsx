'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { 
  Send, 
  ArrowLeft, 
  Code2, 
  GitBranch, 
  Globe, 
  Video, 
  Users, 
  Clock, 
  AlertCircle,
  CheckCircle2,
  Sparkles
} from 'lucide-react'

interface Track {
  id: string
  name: string
  prizeAmount: number | null
}

interface Team {
  id: string
  name: string
}

export default function SubmitProjectPage() {
  const router = useRouter()

  const [eventId, setEventId] = useState<string | null>(null)
  const [eventTitle, setEventTitle] = useState('')
  const [deadline, setDeadline] = useState<Date | null>(null)
  const [tracks, setTracks] = useState<Track[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // Form State
  const [teamId, setTeamId] = useState('')
  const [title, setTitle] = useState('')
  const [tagline, setTagline] = useState('')
  const [description, setDescription] = useState('')
  const [trackId, setTrackId] = useState('')
  const [repoUrl, setRepoUrl] = useState('')
  const [demoUrl, setDemoUrl] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Team creation modal/inline
  const [newTeamName, setNewTeamName] = useState('')
  const [creatingTeam, setCreatingTeam] = useState(false)
  const [inviteCode, setInviteCode] = useState<string | null>(null)
  const [copiedInvite, setCopiedInvite] = useState(false)

  useEffect(() => {
    // 1. Verify user authentication
    fetch('/api/auth/me')
      .then((r) => {
        if (!r.ok) {
          router.push('/login?redirect=/submit')
          return null
        }
        return r.json()
      })
      .then((d) => {
        if (d?.data?.user) setCurrentUser(d.data.user)
      })

    // 2. Fetch active event
    fetch('/api/events?status=active&limit=1')
      .then((r) => r.json())
      .then(async (d) => {
        let ev = d?.data?.events?.[0]
        if (!ev) {
          const fb = await fetch('/api/events?limit=1').then((r) => r.json()).catch(() => null)
          ev = fb?.data?.events?.[0]
        }
        if (ev) {
          setEventId(ev.id)
          setEventTitle(ev.title)
          setTracks(ev.tracks || [])
          if (ev.submissionDeadline) setDeadline(new Date(ev.submissionDeadline))

          // 3. Fetch user's own teams in this event
          fetch(`/api/events/${ev.id}/teams?mine=true`)
            .then((r) => r.json())
            .then((td) => {
              const myTeams: any[] = td?.data?.teams || []
              setTeams(myTeams)
              if (myTeams.length > 0) {
                setTeamId(myTeams[0].id)
                // Show invite code so user can share with teammates
                if (myTeams[0].inviteCode) setInviteCode(myTeams[0].inviteCode)
              }
              setLoading(false)
            })
            .catch(() => setLoading(false))
        } else {
          setLoading(false)
        }
      })
      .catch(() => setLoading(false))
  }, [router])

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTeamName.trim()) {
      toast.error('Please enter a team name')
      return
    }
    if (!eventId) {
      toast.error('Event is still loading, please wait')
      return
    }
    setCreatingTeam(true)

    try {
      const res = await fetch(`/api/events/${eventId}/teams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTeamName.trim() }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(`Team "${data.data.team.name}" created!`)
        setTeams((prev) => [...prev, data.data.team])
        setTeamId(data.data.team.id)
        setInviteCode(data.data.team.inviteCode ?? null)
        setNewTeamName('')
      } else {
        toast.error(data.error?.message || 'Failed to create team')
      }
    } catch {
      toast.error('Network error creating team')
    } finally {
      setCreatingTeam(false)
    }
  }

  const handleSubmitProject = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!eventId) {
      toast.error('Event information not found. Please refresh the page.')
      return
    }

    if (!teamId) {
      toast.error('Please create or select a team first')
      return
    }
    if (!title.trim()) {
      toast.error('Please enter a project title')
      return
    }
    if (!description.trim()) {
      toast.error('Please describe your project')
      return
    }

    setSubmitting(true)

    try {
      // 1. Create project
      const createRes = await fetch(`/api/events/${eventId}/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          tagline: tagline.trim() || null,
          description: description.trim(),
          trackId: trackId || null,
          repoUrl: repoUrl.trim() || null,
          demoUrl: demoUrl.trim() || null,
          videoUrl: videoUrl.trim() || null,
        }),
      })

      const createData = await createRes.json()
      if (!createRes.ok) {
        toast.error(createData.error?.message || 'Failed to save project')
        setSubmitting(false)
        return
      }

      const projectId = createData.data.project.id

      // 2. Lock & submit project
      const submitRes = await fetch(`/api/events/${eventId}/projects/${projectId}/submit`, {
        method: 'POST',
      })
      const submitData = await submitRes.json()

      if (submitRes.ok) {
        toast.success('🎉 Project submitted successfully!')
        router.push(`/projects/${projectId}`)
      } else {
        toast.error(submitData.error?.message || 'Draft saved, but failed to submit')
        router.push(`/projects/${projectId}`)
      }
    } catch {
      toast.error('Network error submitting project')
    } finally {
      setSubmitting(false)
    }
  }

  const isDeadlinePassed = deadline ? new Date() > deadline : false

  return (
    <div style={{ minHeight: '100vh', paddingBottom: '6rem' }}>
      {/* Navbar */}
      <nav className="navbar">
        <div className="container navbar-inner">
          <Link href="/" className="navbar-logo">DOGFOOD</Link>
          <ul className="navbar-links">
            <li><Link href="/" className="navbar-link">Explore</Link></li>
            <li><Link href="/leaderboard" className="navbar-link">Leaderboard</Link></li>
          </ul>
          <div className="navbar-actions">
            <Link href="/" className="btn btn-ghost btn-sm">
              <ArrowLeft size={15} /> Cancel
            </Link>
          </div>
        </div>
      </nav>

      <div className="container" style={{ maxWidth: '800px', marginTop: '3rem' }}>
        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <div className="badge badge-violet" style={{ display: 'inline-flex', marginBottom: '0.75rem', gap: '6px' }}>
            <Sparkles size={14} /> Submission Portal
          </div>
          <h1 style={{ fontSize: '2.25rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '0.5rem' }}>
            Submit Your Project
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Submit your hackathon project for <strong>{eventTitle || 'DOGFOOD Hackathon'}</strong>.
          </p>

          {/* Deadline notice */}
          {deadline && (
            <div
              style={{
                marginTop: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-md)',
                background: isDeadlinePassed ? 'rgba(239, 68, 68, 0.1)' : 'rgba(139, 92, 246, 0.08)',
                border: `1px solid ${isDeadlinePassed ? 'var(--red-500)' : 'var(--border)'}`,
                color: isDeadlinePassed ? 'var(--red-400)' : 'var(--text-primary)',
              }}
            >
              <Clock size={16} />
              <span style={{ fontSize: '0.875rem' }}>
                {isDeadlinePassed ? (
                  <strong>Submission deadline passed on {deadline.toLocaleString()}</strong>
                ) : (
                  <>Submission Deadline: <strong>{deadline.toLocaleString()}</strong> (Enforced strictly at the API layer)</>
                )}
              </span>
            </div>
          )}
        </div>

        {loading ? (
          <div className="card" style={{ textAlign: 'center', padding: '4rem 1rem' }}>
            <p className="text-muted">Loading submission form...</p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {/* Step 1: Team Selection / Creation */}
            <div className="card" style={{ padding: '1.75rem' }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users size={18} style={{ color: 'var(--violet-400)' }} /> 1. Team Formation
              </h2>

              {teams.length > 0 ? (
                <div>
                  <label className="label" htmlFor="teamSelect">Select Your Team</label>
                  <select
                    id="teamSelect"
                    className="form-input"
                    value={teamId}
                    onChange={(e) => setTeamId(e.target.value)}
                    style={{ marginBottom: '1rem' }}
                  >
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>

                  {/* Invite code for existing team — fetch from team detail if not set yet */}
                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                    Share your invite link to add teammates (up to 4 members total).
                  </p>
                  {inviteCode && (
                    <div style={{ marginTop: '0.75rem', background: 'rgba(139,92,246,0.06)', border: '1px solid var(--border-hover)', borderRadius: 'var(--radius-md)', padding: '0.875rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Team Invite Link</div>
                        <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem', color: 'var(--violet-400)' }}>
                          {typeof window !== 'undefined' ? `${window.location.origin}/join/${inviteCode}` : `/join/${inviteCode}`}
                        </code>
                      </div>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => {
                          const link = `${window.location.origin}/join/${inviteCode}`
                          navigator.clipboard.writeText(link).then(() => {
                            setCopiedInvite(true)
                            setTimeout(() => setCopiedInvite(false), 2000)
                          })
                        }}
                      >
                        {copiedInvite ? '✓ Copied!' : 'Copy Link'}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                    You are not on a team for this event yet. Create one now (solo or group, up to 4 members):
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. CyberPunks, Team Rocket, SoloDev"
                      value={newTeamName}
                      onChange={(e) => setNewTeamName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleCreateTeam(e)}
                    />
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleCreateTeam}
                      disabled={creatingTeam || !newTeamName.trim()}
                      style={{ alignSelf: 'flex-start', minWidth: '140px', color: '#ffffff' }}
                    >
                      {creatingTeam ? 'Creating…' : '+ Create Team'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Step 2: Project Info */}
            <form onSubmit={handleSubmitProject} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '1.75rem' }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Code2 size={18} style={{ color: 'var(--cyan-400)' }} /> 2. Project Details
              </h2>

              <div>
                <label className="label" htmlFor="projectTitle">Project Title *</label>
                <input
                  id="projectTitle"
                  type="text"
                  className="input"
                  placeholder="e.g. NeuralFlow, MeshVPN"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div>
                <label className="label" htmlFor="projectTagline">Tagline (One-liner)</label>
                <input
                  id="projectTagline"
                  type="text"
                  className="input"
                  placeholder="e.g. Decentralized neural network orchestration for edge computing"
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                />
              </div>

              {tracks.length > 0 && (
                <div>
                  <label className="label" htmlFor="trackSelect">Challenge Track</label>
                  <select
                    id="trackSelect"
                    className="input"
                    value={trackId}
                    onChange={(e) => setTrackId(e.target.value)}
                  >
                    <option value="">General / No specific track</option>
                    {tracks.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} {t.prizeAmount ? `(Prize: $${t.prizeAmount})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="label" htmlFor="projectDescription">Project Description / Pitch (Markdown supported) *</label>
                <textarea
                  id="projectDescription"
                  className="input"
                  placeholder="Describe your architecture, the problem it solves, how you built it, challenges overcome, and stack..."
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  style={{ resize: 'vertical', minHeight: '200px' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label className="label" htmlFor="repoUrl" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <GitBranch size={14} /> GitHub Repository URL
                  </label>
                  <input
                    id="repoUrl"
                    type="url"
                    className="input"
                    placeholder="https://github.com/your-org/your-repo"
                    value={repoUrl}
                    onChange={(e) => setRepoUrl(e.target.value)}
                  />
                </div>

                <div>
                  <label className="label" htmlFor="demoUrl" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Globe size={14} /> Live Demo URL
                  </label>
                  <input
                    id="demoUrl"
                    type="url"
                    className="input"
                    placeholder="https://my-app.vercel.app"
                    value={demoUrl}
                    onChange={(e) => setDemoUrl(e.target.value)}
                  />
                </div>

                <div>
                  <label className="label" htmlFor="videoUrl" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Video size={14} /> Demo Video URL
                  </label>
                  <input
                    id="videoUrl"
                    type="url"
                    className="input"
                    placeholder="https://youtube.com/watch?v=..."
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border)', paddingTop: '1.25rem' }}>
                <button
                  type="submit"
                  className="btn btn-primary btn-lg w-full"
                  disabled={submitting || isDeadlinePassed}
                  style={{ justifyContent: 'center' }}
                >
                  <Send size={18} /> {submitting ? 'Submitting Project...' : 'Submit Final Project'}
                </button>
                <p style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.75rem' }}>
                  Submissions can be updated until the deadline. All submissions are audit logged.
                </p>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}

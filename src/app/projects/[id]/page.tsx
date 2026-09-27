'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { 
  GitBranch, 
  ExternalLink, 
  Video, 
  Users, 
  ArrowLeft, 
  Trophy, 
  MessageSquare, 
  Send, 
  Calendar,
  Sparkles,
  Award
} from 'lucide-react'

interface TeamMember {
  id: string
  role: string
  user: {
    id: string
    displayName: string
    avatarUrl: string | null
  }
}

interface ProjectData {
  id: string
  title: string
  tagline: string | null
  description: string
  repoUrl: string | null
  demoUrl: string | null
  videoUrl: string | null
  coverUrl: string | null
  status: string
  submittedAt: string | null
  eventId: string
  team: {
    id: string
    name: string
    members: TeamMember[]
  }
  track: {
    id: string
    name: string
  } | null
  comments: Array<{
    id: string
    content: string
    createdAt: string
    user: {
      id: string
      displayName: string
      avatarUrl: string | null
      role?: string
    }
  }>
  _count: {
    projectVotes: number
    comments: number
  }
}

export default function ProjectDetailPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string

  const [project, setProject] = useState<ProjectData | null>(null)
  const [loading, setLoading] = useState(true)
  const [commentText, setCommentText] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)
  const [currentUser, setCurrentUser] = useState<{ id: string; displayName: string } | null>(null)

  useEffect(() => {
    // Fetch current user
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.data?.user) setCurrentUser(d.data.user)
      })
      .catch(() => {})

    // Find the event ID or fetch directly
    fetch(`/api/events?status=active&limit=1`)
      .then((r) => r.json())
      .then(async (evData) => {
        const evId = evData?.data?.events?.[0]?.id
        if (!evId) return
        const res = await fetch(`/api/events/${evId}/projects/${projectId}`)
        if (res.ok) {
          const data = await res.json()
          setProject({ ...data.data.project, eventId: evId })
        } else {
          toast.error('Project not found')
        }
        setLoading(false)
      })
      .catch(() => {
        setLoading(false)
        toast.error('Failed to load project')
      })
  }, [projectId])

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!commentText.trim() || !project) return
    if (!currentUser) {
      toast.error('Please login to leave a comment')
      router.push('/login')
      return
    }

    setSubmittingComment(true)
    try {
      const res = await fetch(`/api/events/${project.eventId}/projects/${projectId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: commentText }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success('Comment posted!')
        setProject((prev) => {
          if (!prev) return prev
          return {
            ...prev,
            comments: [...prev.comments, data.data.comment],
            _count: { ...prev._count, comments: prev._count.comments + 1 },
          }
        })
        setCommentText('')
      } else {
        toast.error(data.error?.message || 'Failed to post comment')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setSubmittingComment(false)
    }
  }

  if (loading) {
    return (
      <div className="container" style={{ padding: '6rem 1rem', textAlign: 'center' }}>
        <p className="text-muted">Loading project details...</p>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="container" style={{ padding: '6rem 1rem', textAlign: 'center' }}>
        <h2>Project not found</h2>
        <Link href="/" className="btn btn-primary" style={{ marginTop: '1.5rem', display: 'inline-flex' }}>
          <ArrowLeft size={16} /> Return to Explore
        </Link>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', paddingBottom: '5rem' }}>
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
              <ArrowLeft size={15} /> All Projects
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Header */}
      <div
        style={{
          borderBottom: '1px solid var(--border)',
          background: 'linear-gradient(180deg, rgba(139, 92, 246, 0.08) 0%, rgba(8, 8, 15, 0.95) 100%)',
          padding: '3rem 0 2rem',
        }}
      >
        <div className="container">
          <div className="flex items-center gap-2" style={{ marginBottom: '1rem', flexWrap: 'wrap' }}>
            {project.track && (
              <span className="badge badge-violet">
                <Sparkles size={12} style={{ marginRight: '4px' }} />
                {project.track.name}
              </span>
            )}
            <span className="badge badge-green">
              Status: {project.status.toUpperCase()}
            </span>
            {project.submittedAt && (
              <span className="badge badge-muted flex items-center gap-1">
                <Calendar size={12} />
                Submitted {new Date(project.submittedAt).toLocaleDateString()}
              </span>
            )}
          </div>

          <h1 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '0.75rem', letterSpacing: '-0.02em' }}>
            {project.title}
          </h1>

          {project.tagline && (
            <p style={{ fontSize: '1.25rem', color: 'var(--text-secondary)', maxWidth: '800px', lineHeight: 1.5, marginBottom: '1.5rem' }}>
              {project.tagline}
            </p>
          )}

          {/* Links & CTA Bar */}
          <div className="flex items-center gap-3" style={{ flexWrap: 'wrap' }}>
            {project.repoUrl && (
              <a
                href={project.repoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary btn-sm"
              >
                <GitBranch size={15} /> Source Code
              </a>
            )}
            {project.demoUrl && (
              <a
                href={project.demoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary btn-sm"
              >
                <ExternalLink size={15} /> Live Demo
              </a>
            )}
            {project.videoUrl && (
              <a
                href={project.videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary btn-sm"
              >
                <Video size={15} /> Demo Video
              </a>
            )}
            <Link
              href={`/vote/${project.eventId}`}
              className="btn btn-primary btn-sm"
              style={{ marginLeft: 'auto' }}
            >
              <Trophy size={15} /> Quadratic Voting ({project._count.projectVotes} votes)
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="container" style={{ marginTop: '2.5rem' }}>
        <div className="layout-sidebar" style={{ alignItems: 'flex-start' }}>
          {/* Main Column */}
          <div className="layout-content">
            {/* Project Overview Card */}
            <div className="card" style={{ marginBottom: '2rem' }}>
              <h2 style={{ fontSize: '1.375rem', fontWeight: 700, marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
                Project Overview
              </h2>
              <div
                style={{
                  color: 'var(--text-secondary)',
                  lineHeight: 1.8,
                  fontSize: '1.05rem',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {project.description}
              </div>
            </div>

            {/* Video Preview Embed if URL is valid */}
            {project.videoUrl && (
              <div className="card" style={{ marginBottom: '2rem' }}>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem' }}>
                  Video Showcase
                </h3>
                <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden', borderRadius: 'var(--radius-md)', background: '#000' }}>
                  <iframe
                    src={project.videoUrl.replace('watch?v=', 'embed/')}
                    title="Project Video Demo"
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 }}
                    allowFullScreen
                  />
                </div>
              </div>
            )}

            {/* Comments & Community Discussion Card */}
            <div className="card">
              <div className="flex items-center justify-between" style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
                <h3 className="flex items-center gap-2" style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                  <MessageSquare size={18} style={{ color: 'var(--violet-400)' }} />
                  Discussion ({project.comments.length})
                </h3>
              </div>

              {/* Comment submission form */}
              <form onSubmit={handlePostComment} style={{ marginBottom: '2rem' }}>
                <div style={{ position: 'relative' }}>
                  <textarea
                    className="input"
                    rows={3}
                    placeholder={currentUser ? "Share constructive feedback or ask a question..." : "Log in to post a comment"}
                    disabled={!currentUser}
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    style={{ resize: 'vertical', paddingRight: '4rem', marginBottom: '0.75rem' }}
                  />
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm"
                    disabled={submittingComment || !commentText.trim() || !currentUser}
                    style={{ position: 'absolute', right: '10px', bottom: '22px' }}
                  >
                    <Send size={14} /> Post
                  </button>
                </div>
                {!currentUser && (
                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                    <Link href="/login" style={{ color: 'var(--violet-400)', textDecoration: 'underline' }}>Login</Link> to join the discussion.
                  </p>
                )}
              </form>

              {/* Comment list */}
              {project.comments.length === 0 ? (
                <p className="text-muted" style={{ textAlign: 'center', padding: '2rem 0' }}>
                  No comments yet. Start the conversation!
                </p>
              ) : (
                <div className="flex flex-col gap-3">
                  {project.comments.map((c) => (
                    <div
                      key={c.id}
                      style={{
                        background: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-md)',
                        padding: '1rem',
                      }}
                    >
                      <div className="flex items-center justify-between" style={{ marginBottom: '0.5rem' }}>
                        <div className="flex items-center gap-2">
                          <div
                            style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: '50%',
                              background: 'var(--gradient-brand)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: '0.75rem',
                            }}
                          >
                            {c.user.displayName[0]?.toUpperCase() || 'U'}
                          </div>
                          <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{c.user.displayName}</span>
                          {c.user.role && c.user.role !== 'participant' && (
                            <span className="badge badge-sm badge-violet">{c.user.role}</span>
                          )}
                        </div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {new Date(c.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p style={{ fontSize: '0.925rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                        {c.content}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <aside className="layout-sidebar-aside" style={{ width: '320px' }}>
            {/* Team Info Card */}
            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <div className="flex items-center gap-2" style={{ marginBottom: '1rem' }}>
                <Users size={18} style={{ color: 'var(--violet-400)' }} />
                <h3 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Built by {project.team.name}</h3>
              </div>
              <div className="flex flex-col gap-2">
                {project.team.members.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between"
                    style={{
                      padding: '0.5rem 0.75rem',
                      background: 'rgba(255, 255, 255, 0.02)',
                      borderRadius: 'var(--radius-sm)',
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        style={{
                          width: '26px',
                          height: '26px',
                          borderRadius: '50%',
                          background: 'var(--bg-overlay)',
                          border: '1px solid var(--border)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.75rem',
                        }}
                      >
                        {m.user.displayName[0]?.toUpperCase()}
                      </div>
                      <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{m.user.displayName}</span>
                    </div>
                    <span className="badge badge-sm badge-muted">{m.role}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Judging & Voting Card */}
            <div className="card" style={{ background: 'var(--gradient-surface)', borderColor: 'var(--border-focus)' }}>
              <div className="flex items-center gap-2" style={{ marginBottom: '0.75rem' }}>
                <Award size={18} style={{ color: 'var(--amber-400)' }} />
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Evaluation & Voting</h3>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: 1.5 }}>
                Official rankings are calculated using weighted rubric criteria and mathematically proven Z-score normalization.
              </p>
              <Link href={`/vote/${project.eventId}`} className="btn btn-primary w-full btn-sm">
                Cast Quadratic Votes
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}

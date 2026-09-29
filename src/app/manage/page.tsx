'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  Plus, Save, ArrowLeft, Calendar, Trophy, Settings,
  Trash2, LayoutDashboard, Eye, ExternalLink, CheckCircle2
} from 'lucide-react'

interface Track {
  id?: string
  name: string
  description: string
  prizeAmount: string
  prizeCurrency: string
}

interface EventData {
  id: string
  title: string
  slug: string
  description: string
  status: string
  submissionDeadline: string
  submissionOpensAt: string | null
  registrationOpensAt: string | null
  votingOpensAt: string | null
  votingDeadline: string | null
  tracks: Array<{ id: string; name: string; description: string | null; prizeAmount: number | null; prizeCurrency: string | null }>
  _count: { projects: number }
}

function toDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return ''
  return new Date(iso).toISOString().slice(0, 16)
}

export default function EventManagePage() {
  const router = useRouter()

  const [tab, setTab] = useState<'list' | 'create' | 'edit'>('list')
  const [events, setEvents] = useState<EventData[]>([])
  const [editEvent, setEditEvent] = useState<EventData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [currentUser, setCurrentUser] = useState<any>(null)

  // Create/Edit form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState('draft')
  const [submissionOpensAt, setSubmissionOpensAt] = useState('')
  const [submissionDeadline, setSubmissionDeadline] = useState('')
  const [registrationOpensAt, setRegistrationOpensAt] = useState('')
  const [votingOpensAt, setVotingOpensAt] = useState('')
  const [votingDeadline, setVotingDeadline] = useState('')
  const [tracks, setTracks] = useState<Track[]>([
    { name: '', description: '', prizeAmount: '', prizeCurrency: 'INR' },
  ])

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.ok ? r.json() : null).then(d => {
      const u = d?.data?.user
      if (!u) { router.push('/login?redirect=/manage'); return }
      if (u.globalRole !== 'admin') {
        toast.error('Admin access required')
        router.push('/')
        return
      }
      setCurrentUser(u)
    })

    fetchEvents()
  }, [router])

  async function fetchEvents() {
    setLoading(true)
    const res = await fetch('/api/events?limit=50').then(r => r.json()).catch(() => null)
    setEvents(res?.data?.events ?? [])
    setLoading(false)
  }

  function resetForm() {
    setTitle(''); setDescription(''); setStatus('draft')
    setSubmissionOpensAt(''); setSubmissionDeadline('')
    setRegistrationOpensAt(''); setVotingOpensAt(''); setVotingDeadline('')
    setTracks([{ name: '', description: '', prizeAmount: '', prizeCurrency: 'INR' }])
    setEditEvent(null)
  }

  function loadEventForEdit(ev: EventData) {
    setEditEvent(ev)
    setTitle(ev.title)
    setDescription(ev.description)
    setStatus(ev.status)
    setRegistrationOpensAt(toDatetimeLocal(ev.registrationOpensAt))
    setSubmissionOpensAt(toDatetimeLocal(ev.submissionOpensAt))
    setSubmissionDeadline(toDatetimeLocal(ev.submissionDeadline))
    setVotingOpensAt(toDatetimeLocal(ev.votingOpensAt))
    setVotingDeadline(toDatetimeLocal(ev.votingDeadline))
    setTracks(ev.tracks.length > 0
      ? ev.tracks.map(t => ({ id: t.id, name: t.name, description: t.description ?? '', prizeAmount: t.prizeAmount?.toString() ?? '', prizeCurrency: t.prizeCurrency ?? 'INR' }))
      : [{ name: '', description: '', prizeAmount: '', prizeCurrency: 'INR' }]
    )
    setTab('edit')
  }

  const addTrack = () => setTracks(prev => [...prev, { name: '', description: '', prizeAmount: '', prizeCurrency: 'INR' }])
  const removeTrack = (i: number) => setTracks(prev => prev.filter((_, idx) => idx !== i))
  const updateTrack = (i: number, field: keyof Track, val: string) =>
    setTracks(prev => prev.map((t, idx) => idx === i ? { ...t, [field]: val } : t))

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!title || !description || !submissionDeadline) {
      toast.error('Title, description, and submission deadline are required')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title, description,
          submissionDeadline: new Date(submissionDeadline).toISOString(),
          submissionOpensAt: submissionOpensAt ? new Date(submissionOpensAt).toISOString() : undefined,
          registrationOpensAt: registrationOpensAt ? new Date(registrationOpensAt).toISOString() : undefined,
          votingOpensAt: votingOpensAt ? new Date(votingOpensAt).toISOString() : undefined,
          votingDeadline: votingDeadline ? new Date(votingDeadline).toISOString() : undefined,
          tracks: tracks.filter(t => t.name.trim()).map(t => ({
            name: t.name.trim(),
            description: t.description || undefined,
            prizeAmount: t.prizeAmount ? parseFloat(t.prizeAmount) : undefined,
            prizeCurrency: t.prizeCurrency || 'INR',
          })),
        }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(`Event "${data.data.event.title}" created!`)
        resetForm()
        await fetchEvents()
        setTab('list')
      } else {
        toast.error(data.error?.message || 'Failed to create event')
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    if (!editEvent) return
    setSaving(true)
    try {
      const res = await fetch(`/api/events/${editEvent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title, description, status,
          submissionDeadline: submissionDeadline ? new Date(submissionDeadline).toISOString() : undefined,
          submissionOpensAt: submissionOpensAt ? new Date(submissionOpensAt).toISOString() : undefined,
          registrationOpensAt: registrationOpensAt ? new Date(registrationOpensAt).toISOString() : undefined,
          votingOpensAt: votingOpensAt ? new Date(votingOpensAt).toISOString() : undefined,
          votingDeadline: votingDeadline ? new Date(votingDeadline).toISOString() : undefined,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success('Event updated!')
        await fetchEvents()
        setTab('list')
        resetForm()
      } else {
        toast.error(data.error?.message || 'Failed to update event')
      }
    } finally {
      setSaving(false)
    }
  }

  const statusColor: Record<string, string> = {
    draft: 'var(--text-muted)',
    registration: 'var(--cyan-400)',
    active: 'var(--green-400)',
    judging: 'var(--amber-400)',
    voting: 'var(--violet-400)',
    closed: 'var(--red-400)',
  }

  const formContent = (
    <form onSubmit={tab === 'create' ? handleCreate : handleUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Basic Info */}
      <div className="card">
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Settings size={18} style={{ color: 'var(--violet-400)' }} /> Event Details</h3>
          <div>
            <label className="label" htmlFor="ev-title">Event Title *</label>
            <input id="ev-title" className="form-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="DOGFOOD Hackathon 2026" required />
          </div>
          <div>
            <label className="label" htmlFor="ev-desc">Description *</label>
            <textarea id="ev-desc" className="form-input" value={description} onChange={e => setDescription(e.target.value)} placeholder="What is this hackathon about?" required rows={4} style={{ resize: 'vertical' }} />
          </div>
          {tab === 'edit' && (
            <div>
              <label className="label" htmlFor="ev-status">Status</label>
              <select id="ev-status" className="form-input" value={status} onChange={e => setStatus(e.target.value)}>
                <option value="draft">Draft</option>
                <option value="registration">Registration Open</option>
                <option value="active">Active (Submissions Open)</option>
                <option value="judging">Judging</option>
                <option value="voting">Voting</option>
                <option value="closed">Closed</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Dates */}
      <div className="card">
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Calendar size={18} style={{ color: 'var(--cyan-400)' }} /> Key Dates</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label className="label" htmlFor="reg-opens">Registration Opens</label>
              <input id="reg-opens" type="datetime-local" className="form-input" value={registrationOpensAt} onChange={e => setRegistrationOpensAt(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="sub-opens">Submissions Open</label>
              <input id="sub-opens" type="datetime-local" className="form-input" value={submissionOpensAt} onChange={e => setSubmissionOpensAt(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="sub-deadline">Submission Deadline *</label>
              <input id="sub-deadline" type="datetime-local" className="form-input" value={submissionDeadline} onChange={e => setSubmissionDeadline(e.target.value)} required />
            </div>
            <div>
              <label className="label" htmlFor="vote-opens">Voting Opens</label>
              <input id="vote-opens" type="datetime-local" className="form-input" value={votingOpensAt} onChange={e => setVotingOpensAt(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="vote-deadline">Voting Deadline</label>
              <input id="vote-deadline" type="datetime-local" className="form-input" value={votingDeadline} onChange={e => setVotingDeadline(e.target.value)} />
            </div>
          </div>
        </div>
      </div>

      {/* Tracks (only on create) */}
      {tab === 'create' && (
        <div className="card">
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Trophy size={18} style={{ color: 'var(--amber-400)' }} /> Tracks & Prizes</h3>
              <button type="button" className="btn btn-outline btn-sm" onClick={addTrack}><Plus size={14} /> Add Track</button>
            </div>
            {tracks.map((track, i) => (
              <div key={i} style={{ background: 'var(--bg-overlay)', borderRadius: 'var(--radius-md)', padding: '1rem', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-muted)' }}>Track {i + 1}</span>
                  {tracks.length > 1 && (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeTrack(i)} style={{ color: 'var(--red-400)', padding: '2px 6px' }}><Trash2 size={14} /></button>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label className="label">Track Name</label>
                    <input className="form-input" value={track.name} onChange={e => updateTrack(i, 'name', e.target.value)} placeholder="AI/ML" />
                  </div>
                  <div>
                    <label className="label">Prize Amount</label>
                    <input className="form-input" type="number" value={track.prizeAmount} onChange={e => updateTrack(i, 'prizeAmount', e.target.value)} placeholder="50000" />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label className="label">Track Description</label>
                    <input className="form-input" value={track.description} onChange={e => updateTrack(i, 'description', e.target.value)} placeholder="AI and machine learning projects" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '1rem' }}>
        <button type="submit" className="btn btn-primary btn-lg" disabled={saving} style={{ flex: 1, justifyContent: 'center' }}>
          <Save size={18} /> {saving ? 'Saving…' : tab === 'create' ? 'Create Event' : 'Save Changes'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => { resetForm(); setTab('list') }}>
          Cancel
        </button>
      </div>
    </form>
  )

  return (
    <div style={{ minHeight: '100vh', paddingBottom: '5rem' }}>
      <nav className="navbar">
        <div className="container navbar-inner">
          <Link href="/" className="navbar-logo">DOGFOOD</Link>
          <span className="badge badge-violet">Admin — Event Management</span>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <Link href="/" className="btn btn-ghost btn-sm"><ArrowLeft size={14} /> Home</Link>
          </div>
        </div>
      </nav>

      <main className="container" style={{ paddingTop: '2rem', maxWidth: '900px' }}>
        {/* Tab Nav */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
          <button
            className={`btn btn-sm ${tab === 'list' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => { resetForm(); setTab('list') }}
          >
            <LayoutDashboard size={15} /> All Events
          </button>
          <button
            className={`btn btn-sm ${tab === 'create' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => { resetForm(); setTab('create') }}
          >
            <Plus size={15} /> Create New Event
          </button>
        </div>

        {tab === 'list' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Events</h1>
              <button className="btn btn-primary btn-sm" onClick={() => { resetForm(); setTab('create') }}>
                <Plus size={15} /> New Event
              </button>
            </div>

            {loading ? (
              <p className="text-muted">Loading events…</p>
            ) : events.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: '4rem' }}>
                <p className="text-muted" style={{ marginBottom: '1.5rem' }}>No events yet. Create your first hackathon!</p>
                <button className="btn btn-primary" onClick={() => setTab('create')}><Plus size={16} /> Create Event</button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {events.map(ev => (
                  <div key={ev.id} className="card">
                    <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                          <h3 style={{ fontWeight: 700, fontSize: '1.1rem' }}>{ev.title}</h3>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '2px 10px', borderRadius: 999, background: 'var(--bg-overlay)', color: statusColor[ev.status] ?? 'var(--text-muted)', border: '1px solid currentColor', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {ev.status}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                          <span>📦 {ev._count.projects} projects</span>
                          <span>🏷️ {ev.tracks?.length ?? 0} tracks</span>
                          <span>⏰ Deadline: {new Date(ev.submissionDeadline).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                        <Link href={`/organizer/${ev.id}`} className="btn btn-outline btn-sm" title="Judging Dashboard">
                          <LayoutDashboard size={14} /> Dashboard
                        </Link>
                        <button className="btn btn-primary btn-sm" onClick={() => loadEventForEdit(ev)}>
                          <Settings size={14} /> Edit
                        </button>
                        <Link href="/" className="btn btn-ghost btn-sm" title="View Gallery">
                          <Eye size={14} />
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'create' && (
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Plus size={24} style={{ color: 'var(--violet-400)' }} /> Create New Event
            </h1>
            {formContent}
          </div>
        )}

        {tab === 'edit' && editEvent && (
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Settings size={24} style={{ color: 'var(--cyan-400)' }} /> Edit: {editEvent.title}
            </h1>
            <p className="text-muted" style={{ marginBottom: '2rem', fontSize: '0.875rem' }}>
              Slug: <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--violet-400)' }}>{editEvent.slug}</code>
              &nbsp;·&nbsp; {editEvent._count.projects} projects submitted
            </p>
            {formContent}
          </div>
        )}
      </main>
    </div>
  )
}

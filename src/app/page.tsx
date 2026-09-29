'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Search, Trophy, Code2, Zap, ArrowRight, GitBranch, MessageSquare,
  Sparkles, LogOut, LayoutDashboard, Award, PlusCircle, Shield,
  BarChart3, Globe, Lock, Users, ChevronDown, Star, CheckCircle,
  Server, Layers, Vote
} from 'lucide-react'

interface Project {
  id: string
  title: string
  tagline: string | null
  coverUrl: string | null
  team: { id: string; name: string }
  track: { id: string; name: string } | null
  _count: { comments: number; userVotes?: number }
}

interface Track { id: string; name: string }
interface User { id: string; displayName: string; email: string; globalRole: string }

async function safeJson(res: Response) {
  if (!res.ok) return null
  try { return await res.json() } catch { return null }
}

/* ── Animated counter hook ── */
function useCounter(target: number, duration = 1800) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return
      obs.disconnect()
      let start = 0
      const step = target / (duration / 16)
      const t = setInterval(() => {
        start += step
        if (start >= target) { setCount(target); clearInterval(t) }
        else setCount(Math.floor(start))
      }, 16)
    }, { threshold: 0.3 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [target, duration])
  return { count, ref }
}

function StatCounter({ value, suffix = '', label }: { value: number; suffix?: string; label: string }) {
  const { count, ref } = useCounter(value)
  return (
    <div ref={ref} style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '3rem', fontWeight: 900, letterSpacing: '-0.04em', background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
        {count}{suffix}
      </div>
      <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '0.25rem', fontWeight: 500 }}>{label}</div>
    </div>
  )
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
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    fetch('/api/auth/me').then(safeJson).then(d => { if (d?.data?.user) setUser(d.data.user) }).catch(() => {})
    fetch('/api/events?status=active&limit=1').then(safeJson).then(d => {
      const ev = d?.data?.events?.[0]
      if (ev) { setEventId(ev.id); setTracks(ev.tracks ?? []) }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!eventId) return
    setLoading(true)
    const params = new URLSearchParams({ limit: '12' })
    if (q) params.set('q', q)
    if (selectedTrack) params.set('track', selectedTrack)
    fetch(`/api/events/${eventId}/projects?${params}`).then(safeJson).then(d => {
      setProjects(d?.data?.projects ?? [])
      setTotal(d?.data?.total ?? 0)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [eventId, q, selectedTrack])

  const handleLogout = async () => {
    await fetch('/api/auth/session', { method: 'DELETE' })
    setUser(null)
    router.refresh()
  }

  return (
    <div style={{ overflowX: 'hidden' }}>

      {/* ══════════════════════════════ NAVBAR ══════════════════════════════ */}
      <nav className="navbar" style={{
        transition: 'all 0.3s ease',
        backdropFilter: scrolled ? 'blur(24px) saturate(180%)' : 'blur(12px)',
        background: scrolled ? 'rgba(8,8,15,0.92)' : 'rgba(8,8,15,0.5)',
        borderBottom: scrolled ? '1px solid rgba(139,92,246,0.15)' : '1px solid transparent',
      }}>
        <div className="container navbar-inner">
          <Link href="/" className="navbar-logo">DOGFOOD</Link>
          <ul className="navbar-links">
            <li><Link href="/" className="navbar-link active">Explore</Link></li>
            <li><Link href="/leaderboard" className="navbar-link">Leaderboard</Link></li>
            {eventId && <li><Link href={`/vote/${eventId}`} className="navbar-link">Vote</Link></li>}
          </ul>
          <div className="navbar-actions">
            {user ? (
              <div className="flex items-center gap-2">
                <Link href="/submit" className="btn btn-primary btn-sm" style={{ color: '#fff' }}><PlusCircle size={14} /> Submit</Link>
                {user.globalRole === 'admin' && (
                  <Link href="/manage" className="btn btn-outline btn-sm"><Shield size={14} /> Manage</Link>
                )}
                {eventId && (user.globalRole === 'admin' || user.globalRole === 'organizer') && (
                  <Link href={`/organizer/${eventId}`} className="btn btn-outline btn-sm"><LayoutDashboard size={14} /> Organizer</Link>
                )}
                {eventId && <Link href={`/judge/${eventId}`} className="btn btn-outline btn-sm"><Award size={14} /> Judge</Link>}
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', padding: '0 0.5rem' }}>{user.displayName}</span>
                <button onClick={handleLogout} className="btn btn-ghost btn-sm" title="Log out"><LogOut size={15} /></button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/login" className="btn btn-ghost btn-sm">Login</Link>
                <Link href="/register" className="btn btn-primary btn-sm" style={{ color: '#fff' }}>Sign Up</Link>
              </div>
            )}
          </div>
        </div>
      </nav>


      {/* ══════════════════════════════ HERO ══════════════════════════════ */}
      <section style={{ position: 'relative', minHeight: '100vh', display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
        {/* Hero background image */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'url(/hero_banner.jpg)',
          backgroundSize: 'cover', backgroundPosition: 'center',
          filter: 'brightness(0.35)',
          zIndex: 0,
        }} />
        {/* Gradient overlay */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 1,
          background: 'linear-gradient(to bottom, rgba(8,8,15,0.3) 0%, rgba(8,8,15,0) 40%, rgba(8,8,15,0.8) 80%, rgba(8,8,15,1) 100%)',
        }} />
        {/* Animated grid */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 1,
          backgroundImage: 'linear-gradient(rgba(139,92,246,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,0.04) 1px, transparent 1px)',
          backgroundSize: '80px 80px',
          animation: 'gridScroll 30s linear infinite',
        }} />
        {/* Floating orbs */}
        <div style={{ position: 'absolute', top: '20%', left: '10%', width: '300px', height: '300px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.18), transparent 70%)', filter: 'blur(40px)', zIndex: 1, animation: 'float1 8s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', top: '40%', right: '8%', width: '400px', height: '400px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(6,182,212,0.12), transparent 70%)', filter: 'blur(60px)', zIndex: 1, animation: 'float2 10s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', bottom: '20%', left: '30%', width: '200px', height: '200px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.1), transparent 70%)', filter: 'blur(30px)', zIndex: 1, animation: 'float3 6s ease-in-out infinite' }} />

        <div className="container" style={{ position: 'relative', zIndex: 2, textAlign: 'center', padding: '6.5rem 1rem 3rem' }}>
          <div className="hero-eyebrow" style={{ display: 'inline-flex', animation: 'fadeInDown 0.6s ease forwards' }}>
            <Zap size={14} /> Open Source · Self-Hostable · Free Forever
          </div>

          <h1 style={{ fontSize: 'clamp(2rem, 3.8vw, 3.25rem)', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.15, margin: '1.25rem 0 1.25rem', animation: 'fadeInUp 0.7s 0.1s ease both' }}>
            The hackathon platform<br />
            <span style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 50%, #8b5cf6 100%)', backgroundSize: '200% auto', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', animation: 'shimmer 4s linear infinite' }}>
              that doesn't suck.
            </span>
          </h1>

          <p style={{ fontSize: 'clamp(0.9375rem, 1.4vw, 1.05rem)', color: 'var(--text-secondary)', maxWidth: '520px', margin: '0 auto 2rem', lineHeight: 1.65, animation: 'fadeInUp 0.7s 0.2s ease both' }}>
            Weighted rubric scoring, Z-score normalization, quadratic community voting,
            audit-logged judging. <strong style={{ color: 'var(--text-primary)' }}>One command</strong> to self-host.
          </p>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap', animation: 'fadeInUp 0.7s 0.3s ease both' }}>
            <Link href={user ? '/submit' : '/register'} className="btn btn-primary" style={{ color: '#fff', padding: '0.55rem 1.25rem', fontSize: '0.875rem', boxShadow: '0 0 24px rgba(139,92,246,0.35)' }}>
              Start Building <ArrowRight size={15} />
            </Link>
            {eventId && (
              <Link href={`/vote/${eventId}`} className="btn btn-outline" style={{ borderColor: 'rgba(6,182,212,0.4)', color: 'var(--cyan-400)', padding: '0.55rem 1.25rem', fontSize: '0.875rem' }}>
                <Vote size={15} /> Cast Your Vote
              </Link>
            )}
            <a href="https://github.com" className="btn btn-ghost" target="_blank" rel="noopener noreferrer" style={{ borderColor: 'rgba(255,255,255,0.12)', border: '1px solid', padding: '0.55rem 1.25rem', fontSize: '0.875rem' }}>
              <GitBranch size={15} /> View on GitHub
            </a>
          </div>

          {/* Scroll cue */}
          <div style={{ marginTop: '3.5rem', animation: 'bounce 2s ease-in-out infinite', opacity: 0.4 }}>
            <ChevronDown size={22} style={{ margin: '0 auto', display: 'block' }} />
          </div>
        </div>
      </section>

      {/* ══════════════════════════════ STATS ══════════════════════════════ */}
      <section style={{ padding: '5rem 0', background: 'rgba(14,14,26,0.8)', borderTop: '1px solid rgba(139,92,246,0.1)', borderBottom: '1px solid rgba(139,92,246,0.1)' }}>
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '3rem', alignItems: 'center' }}>
            <StatCounter value={35} suffix="+" label="Events run worldwide" />
            <StatCounter value={85} suffix="+" label="Countries represented" />
            <StatCounter value={2500} suffix="+" label="Projects submitted" />
            <StatCounter value={100} suffix="%" label="Open source, forever" />
          </div>
        </div>
      </section>

      {/* ══════════════════════════════ FEATURES ══════════════════════════════ */}
      <section style={{ padding: '8rem 0' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
            <div className="badge badge-violet" style={{ display: 'inline-flex', marginBottom: '1rem', padding: '6px 14px' }}>
              <Sparkles size={13} /> Platform Features
            </div>
            <h2 className="heading-ibm" style={{ letterSpacing: '-0.02em', marginBottom: '1rem' }}>
              Everything judging needs.<br />
              <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.75em' }}>Nothing it doesn't.</span>
            </h2>
            <p style={{ color: 'var(--text-secondary)', maxWidth: '500px', margin: '0 auto', lineHeight: 1.7 }}>
              Built to replace Devpost and Devfolio. Deep on the features that actually matter.
            </p>
          </div>

          {/* Big feature: Z-score Judging */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem', marginBottom: '2rem' }}>
            <div className="card" style={{
              padding: 0, overflow: 'hidden', gridColumn: 'span 1',
              background: 'linear-gradient(135deg, rgba(139,92,246,0.08), rgba(8,8,15,0.9))',
              border: '1px solid rgba(139,92,246,0.2)',
              transition: 'all 0.4s ease',
            }}>
              <img src="/feat_judging.jpg" alt="Z-score judging visualization" style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', opacity: 0.85 }} />
              <div style={{ padding: '2rem' }}>
                <div className="badge badge-violet" style={{ marginBottom: '1rem' }}><BarChart3 size={12} /> Judge Normalization</div>
                <h3 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '0.75rem' }}>Z-Score fair scoring</h3>
                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                  Judges have wildly different grading scales. Our algorithm normalizes every score
                  per-judge (z = (x−μ)/σ), then applies weighted rubric criteria. Harsh graders
                  can't sink a team, lenient graders can't inflate one.
                </p>
                <div style={{ marginTop: '1.25rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {['Round-robin assignment','Rubric builder','CSV export','Live dashboard'].map(t => (
                    <span key={t} style={{ fontSize: '0.75rem', padding: '3px 10px', borderRadius: '999px', background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.2)', color: 'var(--violet-400)' }}>{t}</span>
                  ))}
                </div>
              </div>
            </div>

            <div className="card" style={{
              padding: 0, overflow: 'hidden',
              background: 'linear-gradient(135deg, rgba(6,182,212,0.06), rgba(8,8,15,0.9))',
              border: '1px solid rgba(6,182,212,0.15)',
            }}>
              <img src="/feat_voting.jpg" alt="Quadratic voting illustration" style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', opacity: 0.85 }} />
              <div style={{ padding: '2rem' }}>
                <div className="badge badge-cyan" style={{ marginBottom: '1rem' }}><Vote size={12} /> Community Voice</div>
                <h3 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '0.75rem' }}>Quadratic voting</h3>
                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                  k votes costs k² credits. This forces genuine conviction — you can't flood one
                  project. Randomized ballot order eliminates position bias.
                </p>
                <div style={{ marginTop: '1.25rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {['100 credits/voter','k² cost curve','Email-gated tokens','Randomized ballot'].map(t => (
                    <span key={t} style={{ fontSize: '0.75rem', padding: '3px 10px', borderRadius: '999px', background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.2)', color: 'var(--cyan-400)' }}>{t}</span>
                  ))}
                </div>
              </div>
            </div>

            <div className="card" style={{
              padding: 0, overflow: 'hidden',
              background: 'linear-gradient(135deg, rgba(74,222,128,0.06), rgba(8,8,15,0.9))',
              border: '1px solid rgba(74,222,128,0.15)',
            }}>
              <img src="/feat_selfhost.jpg" alt="Self-hosting illustration" style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', opacity: 0.75 }} />
              <div style={{ padding: '2rem' }}>
                <div className="badge badge-green" style={{ marginBottom: '1rem' }}><Server size={12} /> One Command Deploy</div>
                <h3 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '0.75rem' }}>Self-host. Zero cloud.</h3>
                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                  <code style={{ fontFamily: 'monospace', color: 'var(--green-400)', background: 'rgba(74,222,128,0.08)', padding: '2px 6px', borderRadius: '4px' }}>docker compose up</code> and you're live.
                  PostgreSQL, migrations, seed data — all automated.
                </p>
                <div style={{ marginTop: '1.25rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {['MIT licensed','No vendor lock-in','PostgreSQL 16','Prisma ORM'].map(t => (
                    <span key={t} style={{ fontSize: '0.75rem', padding: '3px 10px', borderRadius: '999px', background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.2)', color: 'var(--green-400)' }}>{t}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Smaller feature pills row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            {[
              { icon: <Shield size={20} />, color: 'var(--violet-400)', bg: 'rgba(139,92,246,0.08)', title: 'Threat Model', desc: '7 attack vectors documented & mitigated' },
              { icon: <Lock size={20} />, color: 'var(--cyan-400)', bg: 'rgba(6,182,212,0.08)', title: 'Judge Isolation', desc: 'Every query scoped to session user only' },
              { icon: <Layers size={20} />, color: 'var(--amber-400)', bg: 'rgba(251,191,36,0.08)', title: 'Multi-Track', desc: 'Unlimited tracks with separate prize pools' },
              { icon: <Users size={20} />, color: 'var(--green-400)', bg: 'rgba(74,222,128,0.08)', title: 'Team Formation', desc: 'Invite-code team joins, up to 4 members' },
              { icon: <Globe size={20} />, color: 'var(--violet-400)', bg: 'rgba(139,92,246,0.08)', title: 'Public Gallery', desc: 'Search & filter all submitted projects' },
            ].map(f => (
              <div key={f.title} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1.5rem', background: f.bg, border: `1px solid ${f.color}22` }}>
                <div style={{ color: f.color }}>{f.icon}</div>
                <div>
                  <h4 style={{ fontWeight: 700, marginBottom: '0.25rem' }}>{f.title}</h4>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════ HOW IT WORKS ══════════════════════════════ */}
      <section style={{ padding: '8rem 0', background: 'rgba(10,10,20,0.6)', borderTop: '1px solid rgba(139,92,246,0.08)' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
            <div className="badge badge-cyan" style={{ display: 'inline-flex', marginBottom: '1rem', padding: '6px 14px' }}>
              <CheckCircle size={13} /> Workflow
            </div>
            <h2 className="heading-ibm" style={{ letterSpacing: '-0.02em' }}>
              From idea to ranked winner
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0', position: 'relative' }}>
            {[
              { num: '01', color: '#8b5cf6', title: 'Organizer creates event', desc: 'Set up tracks, rubric criteria with weights, judging deadlines, and invite judges via role assignment.', icon: <LayoutDashboard size={22} /> },
              { num: '02', color: '#06b6d4', title: 'Teams submit projects', desc: 'Participants form teams (invite codes), submit with GitHub/demo/video links before the enforced deadline.', icon: <Code2 size={22} /> },
              { num: '03', color: '#a855f7', title: 'Judges score', desc: 'Round-robin assignment. Judges score rubric criteria 1–5. All scoring is isolated — judges never see each other\'s scores.', icon: <Award size={22} /> },
              { num: '04', color: '#22d3ee', title: 'Community votes', desc: 'Anyone with a voter token casts quadratic votes. 100 credits, k votes = k² cost. Ballot order randomized.', icon: <Vote size={22} /> },
              { num: '05', color: '#4ade80', title: 'Results published', desc: 'Organizer triggers Z-score normalization, then flips the publish switch. Leaderboard goes live instantly.', icon: <Trophy size={22} /> },
            ].map((step, i) => (
              <div key={step.num} style={{ position: 'relative', padding: '2rem 1.5rem', textAlign: 'center' }}>
                {/* Connector line */}
                {i < 4 && (
                  <div style={{ position: 'absolute', top: '3rem', right: 0, width: '50%', height: '2px', background: `linear-gradient(90deg, ${step.color}44, transparent)`, display: 'block' }} />
                )}
                <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: `${step.color}18`, border: `2px solid ${step.color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem', color: step.color, boxShadow: `0 0 20px ${step.color}20` }}>
                  {step.icon}
                </div>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em', color: step.color, marginBottom: '0.5rem', opacity: 0.7 }}>{step.num}</div>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.5rem' }}>{step.title}</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════ GALLERY ══════════════════════════════ */}
      <section style={{ padding: '8rem 0' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <div className="badge badge-amber" style={{ display: 'inline-flex', marginBottom: '1rem', padding: '6px 14px' }}>
              <Sparkles size={13} /> Project Gallery
            </div>
            <h2 className="heading-ibm" style={{ letterSpacing: '-0.02em', marginBottom: '0.75rem' }}>
              What teams are building
            </h2>
            <p style={{ color: 'var(--text-secondary)', maxWidth: '440px', margin: '0 auto' }}>
              Browse all submitted projects. Filter by track, search by keyword.
            </p>
          </div>

          {/* Search bar */}
          <div style={{ position: 'relative', marginBottom: '2rem', maxWidth: '640px', margin: '0 auto 2rem' }}>
            <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            <input
              className="input"
              style={{ paddingLeft: '2.75rem', height: '52px', fontSize: '1rem', borderRadius: '999px', borderColor: 'rgba(139,92,246,0.2)', boxShadow: '0 0 30px rgba(139,92,246,0.08)' }}
              placeholder="Search projects by title, description, or stack…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          {/* Track filter chips */}
          {tracks.length > 0 && (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '2.5rem' }}>
              <button
                className="btn btn-sm"
                onClick={() => setSelectedTrack('')}
                style={{ borderRadius: '999px', background: !selectedTrack ? 'rgba(139,92,246,0.2)' : 'transparent', color: !selectedTrack ? 'var(--violet-400)' : 'var(--text-muted)', border: '1px solid', borderColor: !selectedTrack ? 'rgba(139,92,246,0.3)' : 'var(--border)' }}
              >All Tracks</button>
              {tracks.map(t => (
                <button
                  key={t.id}
                  className="btn btn-sm"
                  onClick={() => setSelectedTrack(t.id)}
                  style={{ borderRadius: '999px', background: selectedTrack === t.id ? 'rgba(139,92,246,0.2)' : 'transparent', color: selectedTrack === t.id ? 'var(--violet-400)' : 'var(--text-muted)', border: '1px solid', borderColor: selectedTrack === t.id ? 'rgba(139,92,246,0.3)' : 'var(--border)' }}
                >{t.name}</button>
              ))}
            </div>
          )}

          {loading ? (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '4rem' }}>Loading projects…</div>
          ) : projects.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '5rem' }}>
              <Code2 size={52} style={{ color: 'var(--text-muted)', margin: '0 auto 1.25rem', opacity: 0.5 }} />
              <h3 style={{ marginBottom: '0.5rem' }}>{q ? 'No matches' : 'No projects yet'}</h3>
              <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>{q ? 'Try a different search' : 'Be the first to submit!'}</p>
              <Link href="/submit" className="btn btn-primary" style={{ color: '#fff' }}>Submit Project <ArrowRight size={16} /></Link>
            </div>
          ) : (
            <>
              <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.875rem', textAlign: 'center' }}>
                {total} project{total !== 1 ? 's' : ''} {selectedTrack ? 'in this track' : 'submitted'}
              </p>
              <div className="grid-projects">
                {projects.map((p, i) => (
                  <Link
                    key={p.id}
                    href={`/projects/${p.id}`}
                    style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', height: '100%', animation: `fadeInUp 0.5s ${i * 0.06}s ease both` }}
                  >
                    <div className="card project-card" style={{ padding: 0, overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column' }}>
                      <div
                        className="project-card-cover"
                        style={{
                          background: p.coverUrl ? `url(${p.coverUrl}) center/cover` : `linear-gradient(135deg, hsl(${(i * 47) % 360},40%,12%), hsl(${(i * 47 + 60) % 360},50%,16%))`,
                          height: '135px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          position: 'relative',
                          flexShrink: 0,
                        }}
                      >
                        {!p.coverUrl && <Code2 size={28} style={{ color: 'rgba(255,255,255,0.15)' }} />}
                        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 50%, rgba(8,8,15,0.6))' }} />
                      </div>
                      <div className="project-card-body" style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '0.875rem 1rem 0.875rem' }}>
                        <div style={{ minHeight: '22px', marginBottom: '0.375rem', display: 'flex', alignItems: 'center' }}>
                          {p.track ? (
                            <span className="badge badge-violet" style={{ fontSize: '0.7rem', padding: '2px 8px' }}>{p.track.name}</span>
                          ) : (
                            <span className="badge" style={{ visibility: 'hidden', fontSize: '0.7rem' }}>Track</span>
                          )}
                        </div>
                        <h3 className="project-card-title">{p.title}</h3>
                        <p className="project-card-team">by {p.team.name}</p>
                        <p className="project-card-tagline">
                          {p.tagline || '\u00A0'}
                        </p>
                        <div className="project-card-footer" style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '0.5rem', borderTop: '1px solid rgba(139, 92, 246, 0.1)' }}>
                          <div className="flex items-center gap-2" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            <span className="flex items-center gap-1"><MessageSquare size={12} /> {p._count.comments}</span>
                            <span className="flex items-center gap-1"><Trophy size={12} /> {p._count.userVotes ?? 0}</span>
                          </div>
                          <span style={{ fontSize: '0.75rem', color: 'var(--violet-400)', fontWeight: 600 }}>View →</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      {/* ══════════════════════════════ CTA ══════════════════════════════ */}
      <section style={{ padding: '8rem 0', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 80% 60% at 50% 50%, rgba(139,92,246,0.12), transparent)' }} />
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(139,92,246,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,0.05) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
        <div className="container" style={{ position: 'relative', textAlign: 'center' }}>
          <h2 className="heading-ibm" style={{ letterSpacing: '-0.02em', marginBottom: '1.25rem' }}>
            Ready to run your hackathon?
          </h2>
          <p style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', maxWidth: '480px', margin: '0 auto 2.5rem', lineHeight: 1.7 }}>
            Fork it. Self-host it. Own it. Your data stays on your server. No subscriptions. No limits.
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/register" className="btn btn-primary btn-lg" style={{ color: '#fff', boxShadow: '0 0 40px rgba(139,92,246,0.4)' }}>
              Create Account <ArrowRight size={18} />
            </Link>
            <a href="https://github.com" className="btn btn-outline btn-lg" target="_blank" rel="noopener noreferrer">
              <GitBranch size={18} /> Star on GitHub
            </a>
          </div>
          <p style={{ marginTop: '2rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            MIT License · No credit card · Self-hostable in 60 seconds
          </p>
        </div>
      </section>

      {/* ══════════════════════════════ FOOTER ══════════════════════════════ */}
      <footer style={{ borderTop: '1px solid var(--border)', padding: '2rem 0', background: 'rgba(8,8,15,0.8)' }}>
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <span style={{ fontWeight: 800, fontSize: '1rem', letterSpacing: '-0.02em' }}>DOGFOOD</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginLeft: '0.75rem' }}>Built by Hackathon Raptors · MIT License</span>
          </div>
          <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            <Link href="/leaderboard" style={{ color: 'inherit', textDecoration: 'none' }}>Leaderboard</Link>
            <Link href="/login" style={{ color: 'inherit', textDecoration: 'none' }}>Login</Link>
            <Link href="/register" style={{ color: 'inherit', textDecoration: 'none' }}>Register</Link>
          </div>
        </div>
      </footer>

      {/* ══════════════════════════════ ANIMATIONS ══════════════════════════════ */}
      <style>{`
        @keyframes gridScroll {
          0% { background-position: 0 0; }
          100% { background-position: 80px 80px; }
        }
        @keyframes float1 {
          0%,100% { transform: translate(0,0) scale(1); }
          50% { transform: translate(30px,-40px) scale(1.08); }
        }
        @keyframes float2 {
          0%,100% { transform: translate(0,0) scale(1); }
          50% { transform: translate(-25px,35px) scale(1.05); }
        }
        @keyframes float3 {
          0%,100% { transform: translate(0,0); }
          50% { transform: translate(20px,-20px); }
        }
        @keyframes shimmer {
          0% { background-position: 0% center; }
          100% { background-position: 200% center; }
        }
        @keyframes fadeInDown {
          from { opacity: 0; transform: translateY(-20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes bounce {
          0%,100% { transform: translateY(0); }
          50% { transform: translateY(10px); }
        }
        .card:hover img { transform: scale(1.03); }
        .card img { transition: transform 0.5s ease; }
      `}</style>
    </div>
  )
}

'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { UserPlus, Mail, Lock, User, CheckCircle2, RefreshCw, ArrowLeft, KeyRound, Sparkles, ShieldCheck } from 'lucide-react'
import { Suspense } from 'react'
import { SocialButtons } from '@/components/SocialButtons'

function RegisterContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect') || '/'

  // Step 1: Form details
  const [form, setForm] = useState({ displayName: '', email: '', password: '', confirmPassword: '' })
  // Step 2: OTP verification
  const [step, setStep] = useState<'details' | 'otp'>('details')
  const [otpCode, setOtpCode] = useState('')
  const [devCode, setDevCode] = useState<string | null>(null)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [loading, setLoading] = useState(false)

  const otpInputRef = useRef<HTMLInputElement>(null)

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(timer)
  }, [resendCooldown])

  // Focus OTP input on step change
  useEffect(() => {
    if (step === 'otp') {
      setTimeout(() => otpInputRef.current?.focus(), 100)
    }
  }, [step])

  // Step 1: Validate details and send registration OTP
  async function handleSendRegistrationOtp(e: React.FormEvent) {
    e.preventDefault()

    if (!form.displayName.trim()) {
      toast.error('Please enter your display name')
      return
    }
    if (!form.email || !form.email.includes('@')) {
      toast.error('Please enter a valid email address')
      return
    }
    if (form.password.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }
    if (form.password !== form.confirmPassword) {
      toast.error('Passwords do not match')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/register/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: form.displayName.trim(),
          email: form.email.trim().toLowerCase(),
          password: form.password,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error ?? 'Failed to send verification code')
        return
      }

      toast.success(`Verification code sent to ${form.email}`)
      setStep('otp')
      setResendCooldown(60)

      if (data.data?.devCode) {
        setDevCode(data.data.devCode)
      }
    } catch {
      toast.error('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Step 2: Verify OTP and create verified account
  async function handleVerifyAndRegister(codeToVerify?: string) {
    const code = (codeToVerify || otpCode).trim()
    if (code.length < 6) {
      toast.error('Please enter the 6-digit verification code')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/register/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: form.displayName.trim(),
          email: form.email.trim().toLowerCase(),
          password: form.password,
          code,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error ?? 'Verification failed')
        return
      }

      toast.success('Account created & email verified! Welcome to DOGFOOD.')
      router.push(redirect)
      router.refresh()
    } catch {
      toast.error('Network error during verification.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div className="card" style={{ width: '100%', maxWidth: '440px', boxShadow: '0 20px 40px rgba(0,0,0,0.5)', border: '1px solid rgba(139,92,246,0.2)' }}>
        <div className="card-body" style={{ padding: '2.25rem' }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
            <Link href="/" className="navbar-logo" style={{ fontSize: '1.5rem', display: 'inline-block' }}>
              DOGFOOD
            </Link>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: '0.75rem', marginBottom: '0.25rem' }}>
              {step === 'details' ? 'Create your account' : 'Verify your email'}
            </h1>
            <p className="text-muted" style={{ fontSize: '0.85rem' }}>
              {step === 'details'
                ? 'Email verification required for genuine participant identity'
                : `We sent a 6-digit verification code to ${form.email}`}
            </p>
          </div>

          {step === 'details' ? (
            /* STEP 1: Registration Form */
            <div>
              {/* One-click OAuth sign up */}
              <SocialButtons redirect={redirect} />

              <div style={{ display: 'flex', alignItems: 'center', margin: '1.25rem 0', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
                <span style={{ padding: '0 10px' }}>or register with email</span>
                <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
              </div>

              <form onSubmit={handleSendRegistrationOtp} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="reg-name">Display Name</label>
                <div style={{ position: 'relative' }}>
                  <User size={16} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    id="reg-name"
                    className="form-input"
                    style={{ paddingLeft: '2.5rem' }}
                    type="text"
                    placeholder="Your name"
                    value={form.displayName}
                    onChange={(e) => set('displayName', e.target.value)}
                    required
                    autoFocus
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="reg-email">Email Address</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={16} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    id="reg-email"
                    className="form-input"
                    style={{ paddingLeft: '2.5rem' }}
                    type="email"
                    placeholder="you@example.com"
                    value={form.email}
                    onChange={(e) => set('email', e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="reg-password">Password</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    id="reg-password"
                    className="form-input"
                    style={{ paddingLeft: '2.5rem' }}
                    type="password"
                    placeholder="Min. 8 characters"
                    value={form.password}
                    onChange={(e) => set('password', e.target.value)}
                    required
                    minLength={8}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="reg-confirm">Confirm Password</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    id="reg-confirm"
                    className="form-input"
                    style={{ paddingLeft: '2.5rem' }}
                    type="password"
                    placeholder="Re-enter password"
                    value={form.confirmPassword}
                    onChange={(e) => set('confirmPassword', e.target.value)}
                    required
                    minLength={8}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', background: 'rgba(139,92,246,0.06)', borderRadius: '8px', border: '1px solid rgba(139,92,246,0.2)', fontSize: '0.75rem', color: 'var(--violet-300)', marginTop: '0.25rem' }}>
                <ShieldCheck size={16} style={{ flexShrink: 0 }} />
                <span>An OTP verification code will be sent to your email to confirm ownership.</span>
              </div>

              <button
                type="submit"
                className="btn btn-primary w-full"
                disabled={loading}
                style={{ marginTop: '0.5rem', gap: '8px' }}
              >
                {loading ? <RefreshCw size={16} className="animate-spin" /> : <UserPlus size={16} />}
                {loading ? 'Sending Code…' : 'Continue to Email Verification →'}
              </button>
            </form>
          </div>
        ) : (
            /* STEP 2: Enter OTP Code */
            <form
              onSubmit={(e) => { e.preventDefault(); handleVerifyAndRegister(); }}
              style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
            >
              <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1rem' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Sent verification code to:</div>
                <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.95rem', marginTop: '2px' }}>{form.email}</div>
                <button
                  type="button"
                  onClick={() => { setStep('details'); setOtpCode(''); setDevCode(null); }}
                  style={{ background: 'none', border: 'none', color: 'var(--violet-400)', fontSize: '0.8rem', cursor: 'pointer', marginTop: '6px', textDecoration: 'underline' }}
                >
                  ← Edit registration details
                </button>
              </div>

              {/* Dev Code Quick Auto-Fill Helper */}
              {devCode && (
                <div
                  onClick={() => { setOtpCode(devCode); handleVerifyAndRegister(devCode); }}
                  style={{
                    background: 'rgba(34, 197, 94, 0.1)',
                    border: '1px dashed #22c55e',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    color: '#4ade80',
                  }}
                  title="Click to auto-fill code"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Sparkles size={14} />
                    <span>Dev OTP: <strong>{devCode}</strong></span>
                  </div>
                  <span style={{ textDecoration: 'underline', fontSize: '0.75rem' }}>Auto-fill & Verify →</span>
                </div>
              )}

              <div className="form-group" style={{ textAlign: 'center' }}>
                <label className="form-label" htmlFor="reg-otp-code" style={{ marginBottom: '0.5rem', display: 'block' }}>
                  Enter 6-digit Code
                </label>
                <input
                  ref={otpInputRef}
                  id="reg-otp-code"
                  className="form-input"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="••••••"
                  value={otpCode}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 6)
                    setOtpCode(val)
                    if (val.length === 6) {
                      handleVerifyAndRegister(val)
                    }
                  }}
                  style={{
                    fontSize: '1.75rem',
                    letterSpacing: '0.5rem',
                    textAlign: 'center',
                    fontWeight: 800,
                    fontFamily: 'monospace',
                    padding: '0.75rem 1rem',
                    color: 'var(--violet-300)',
                    background: 'rgba(139,92,246,0.06)',
                    border: '2px solid rgba(139,92,246,0.3)',
                  }}
                  required
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary w-full"
                disabled={loading || otpCode.length < 6}
                style={{ gap: '8px' }}
              >
                {loading ? <RefreshCw size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                {loading ? 'Verifying & Creating Account…' : 'Verify Email & Create Account'}
              </button>

              {/* Resend Code Button */}
              <div style={{ textAlign: 'center' }}>
                {resendCooldown > 0 ? (
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Resend code in <strong>{resendCooldown}s</strong>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => handleSendRegistrationOtp(e)}
                    disabled={loading}
                    style={{ background: 'none', border: 'none', color: 'var(--violet-400)', fontSize: '0.825rem', cursor: 'pointer', fontWeight: 600 }}
                  >
                    Didn't receive code? Resend
                  </button>
                )}
              </div>
            </form>
          )}

          <div className="divider" style={{ margin: '1.75rem 0 1.25rem' }} />

          <p style={{ textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Already have an account?{' '}
            <Link href="/login" style={{ color: 'var(--violet-400)', fontWeight: 600 }}>Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><p className="text-muted">Loading…</p></div>}>
      <RegisterContent />
    </Suspense>
  )
}

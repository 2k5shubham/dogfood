'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Mail, Lock, KeyRound, CheckCircle2, RefreshCw, ArrowLeft, Sparkles, ShieldAlert } from 'lucide-react'
import { Suspense } from 'react'

function ForgotPasswordContent() {
  const router = useRouter()

  const [step, setStep] = useState<'email' | 'reset'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [devCode, setDevCode] = useState<string | null>(null)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [loading, setLoading] = useState(false)

  const codeInputRef = useRef<HTMLInputElement>(null)

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(timer)
  }, [resendCooldown])

  // Focus code input on entering reset step
  useEffect(() => {
    if (step === 'reset') {
      setTimeout(() => codeInputRef.current?.focus(), 100)
    }
  }, [step])

  // Step 1: Send reset OTP
  async function handleSendResetOtp(e?: React.FormEvent) {
    if (e) e.preventDefault()
    if (!email || !email.includes('@')) {
      toast.error('Please enter a valid email address')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/forgot-password/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      })
      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error ?? 'Failed to send reset code')
        return
      }

      toast.success(`Reset code sent to ${email}`)
      setStep('reset')
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

  // Step 2: Verify OTP and reset password
  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault()

    const cleanCode = code.trim()
    if (cleanCode.length < 6) {
      toast.error('Please enter the 6-digit reset code')
      return
    }
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/forgot-password/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          code: cleanCode,
          newPassword,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error ?? 'Failed to reset password')
        return
      }

      toast.success('Password reset successfully! Please sign in.')
      router.push('/login')
    } catch {
      toast.error('Network error during password reset.')
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
              {step === 'email' ? 'Forgot your password?' : 'Reset your password'}
            </h1>
            <p className="text-muted" style={{ fontSize: '0.85rem' }}>
              {step === 'email'
                ? 'Enter your registered email and we will send a 6-digit OTP code to reset your password'
                : `Enter the 6-digit code sent to ${email} and choose a new password`}
            </p>
          </div>

          {step === 'email' ? (
            /* STEP 1: Enter Email */
            <form onSubmit={handleSendResetOtp} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="reset-email">Email Address</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={16} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    id="reset-email"
                    className="form-input"
                    style={{ paddingLeft: '2.5rem' }}
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary w-full"
                disabled={loading || !email}
                style={{ marginTop: '0.25rem', gap: '8px' }}
              >
                {loading ? <RefreshCw size={16} className="animate-spin" /> : <KeyRound size={16} />}
                {loading ? 'Sending Code…' : 'Send Reset Code'}
              </button>
            </form>
          ) : (
            /* STEP 2: Enter OTP + New Password */
            <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '12px', padding: '0.875rem' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Code sent to:</div>
                <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.95rem', marginTop: '2px' }}>{email}</div>
                <button
                  type="button"
                  onClick={() => { setStep('email'); setCode(''); setDevCode(null); }}
                  style={{ background: 'none', border: 'none', color: 'var(--violet-400)', fontSize: '0.8rem', cursor: 'pointer', marginTop: '4px', textDecoration: 'underline' }}
                >
                  Change email
                </button>
              </div>

              {/* Dev Code Quick Auto-Fill Helper */}
              {devCode && (
                <div
                  onClick={() => setCode(devCode)}
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
                  title="Click to paste code"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Sparkles size={14} />
                    <span>Dev OTP: <strong>{devCode}</strong></span>
                  </div>
                  <span style={{ textDecoration: 'underline', fontSize: '0.75rem' }}>Paste code →</span>
                </div>
              )}

              <div className="form-group" style={{ textAlign: 'center' }}>
                <label className="form-label" htmlFor="reset-code" style={{ marginBottom: '0.4rem', display: 'block' }}>
                  6-digit Reset Code
                </label>
                <input
                  ref={codeInputRef}
                  id="reset-code"
                  className="form-input"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="••••••"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  style={{
                    fontSize: '1.5rem',
                    letterSpacing: '0.4rem',
                    textAlign: 'center',
                    fontWeight: 800,
                    fontFamily: 'monospace',
                    padding: '0.6rem 1rem',
                    color: 'var(--violet-300)',
                    background: 'rgba(139,92,246,0.06)',
                    border: '2px solid rgba(139,92,246,0.3)',
                  }}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="reset-new-pw">New Password</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    id="reset-new-pw"
                    className="form-input"
                    style={{ paddingLeft: '2.5rem' }}
                    type="password"
                    placeholder="Min. 8 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={8}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="reset-confirm-pw">Confirm New Password</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    id="reset-confirm-pw"
                    className="form-input"
                    style={{ paddingLeft: '2.5rem' }}
                    type="password"
                    placeholder="Re-enter new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={8}
                  />
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary w-full"
                disabled={loading || code.length < 6 || !newPassword}
                style={{ marginTop: '0.25rem', gap: '8px' }}
              >
                {loading ? <RefreshCw size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                {loading ? 'Updating Password…' : 'Set New Password'}
              </button>

              <div style={{ textAlign: 'center' }}>
                {resendCooldown > 0 ? (
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Resend code in <strong>{resendCooldown}s</strong>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSendResetOtp()}
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
            Remembered your password?{' '}
            <Link href="/login" style={{ color: 'var(--violet-400)', fontWeight: 600 }}>Back to Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><p className="text-muted">Loading…</p></div>}>
      <ForgotPasswordContent />
    </Suspense>
  )
}

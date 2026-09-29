import { prisma } from '@/lib/prisma'
import { hashPassword, createSession, setSessionCookie } from '@/lib/auth'
import { ok, err, logAudit } from '@/lib/utils'
import { verifyEmailOtp } from '@/lib/otp'

/**
 * POST /api/auth/register/verify
 * Verifies the 6-digit OTP code, creates the verified account, and initiates session.
 */
export async function POST(request: Request) {
  try {
    const { email, code, displayName, password } = await request.json()

    if (!email || !code || !displayName || !password) {
      return err('All fields (email, code, displayName, password) are required', 400)
    }

    if (password.length < 8) {
      return err('Password must be at least 8 characters', 400)
    }

    const normalizedEmail = email.toLowerCase().trim()
    const cleanCode = String(code).trim()

    // 1. Verify OTP code scoped to REGISTER
    const otpResult = await verifyEmailOtp(normalizedEmail, cleanCode, 'REGISTER')
    if (!otpResult.valid) {
      return err(otpResult.error || 'Invalid or expired verification code', 400)
    }

    // 2. Ensure email was not registered in the interim
    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    })
    if (existing) {
      return err('Email already registered. Please sign in.', 409)
    }

    // 3. Hash password and create user
    const passwordHash = await hashPassword(password)
    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        displayName: displayName.trim(),
        passwordHash,
        globalRole: 'user',
      },
      select: { id: true, email: true, displayName: true, globalRole: true },
    })

    const forwarded = request.headers.get('x-forwarded-for')
    const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown'
    const ua = request.headers.get('user-agent') || 'unknown'

    // 4. Create session and set cookie
    const token = await createSession(user.id, ip, ua)
    await setSessionCookie(token)

    await logAudit({
      userId: user.id,
      action: 'USER_REGISTERED_VERIFIED',
      entityType: 'user',
      entityId: user.id,
      ipAddress: ip,
      userAgent: ua,
      newValue: { email: normalizedEmail, displayName: user.displayName },
    })

    return ok({ user, message: 'Account created and email verified successfully!' }, 201)
  } catch (error) {
    console.error('Error verifying registration OTP:', error)
    return err('Failed to verify registration. Please try again.', 500)
  }
}

import { prisma } from '@/lib/prisma'
import { ok, err, logAudit } from '@/lib/utils'
import { verifyEmailOtp } from '@/lib/otp'
import { createSession, setSessionCookie } from '@/lib/auth'

/**
 * POST /api/auth/otp/verify
 * Verifies a 6-digit OTP code, authenticates the user, and creates a session.
 * If user does not exist, registers them automatically.
 */
export async function POST(request: Request) {
  try {
    const { email, code, displayName } = await request.json()

    if (!email || !code) {
      return err('Email and 6-digit verification code are required', 400)
    }

    const normalizedEmail = email.toLowerCase().trim()
    const cleanCode = String(code).trim()

    // 1. Verify OTP against database
    const verifyResult = await verifyEmailOtp(normalizedEmail, cleanCode)
    if (!verifyResult.valid) {
      return err(verifyResult.error || 'Invalid verification code', 400)
    }

    const forwarded = request.headers.get('x-forwarded-for')
    const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    // 2. Lookup existing user or register new user
    let user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    })

    let isNewUser = false

    if (!user) {
      isNewUser = true
      // Generate readable default display name if none provided
      const rawName = displayName?.trim() || normalizedEmail.split('@')[0]
      const formattedName = rawName.charAt(0).toUpperCase() + rawName.slice(1)

      user = await prisma.user.create({
        data: {
          email: normalizedEmail,
          displayName: formattedName,
          globalRole: 'user',
        },
      })

      await logAudit({
        userId: user.id,
        action: 'REGISTER_OTP',
        entityType: 'user',
        entityId: user.id,
        ipAddress: ip,
        userAgent,
        newValue: { email: normalizedEmail, displayName: formattedName, method: 'otp' },
      })
    }

    // 3. Create active session and set HTTP-only cookie
    const token = await createSession(user.id, ip, userAgent)
    await setSessionCookie(token)

    await logAudit({
      userId: user.id,
      action: 'LOGIN_OTP',
      entityType: 'session',
      entityId: user.id,
      ipAddress: ip,
      userAgent,
      newValue: { email: normalizedEmail, method: 'otp' },
    })

    return ok({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        globalRole: user.globalRole,
        avatarUrl: user.avatarUrl,
      },
      isNewUser,
      message: isNewUser ? 'Welcome to Dogfood! Your account has been created.' : 'Welcome back!',
    })
  } catch (error) {
    console.error('Error verifying OTP:', error)
    return err('Failed to verify code. Please try again.', 500)
  }
}

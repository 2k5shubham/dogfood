import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/auth'
import { ok, err, logAudit } from '@/lib/utils'
import { verifyEmailOtp } from '@/lib/otp'

/**
 * POST /api/auth/forgot-password/reset
 * Verifies the password reset OTP code and updates the user's password.
 */
export async function POST(request: Request) {
  try {
    const { email, code, newPassword } = await request.json()

    if (!email || !code || !newPassword) {
      return err('Email, verification code, and new password are required', 400)
    }

    if (newPassword.length < 8) {
      return err('New password must be at least 8 characters', 400)
    }

    const normalizedEmail = email.toLowerCase().trim()
    const cleanCode = String(code).trim()

    // 1. Verify OTP code scoped to PASSWORD_RESET
    const otpResult = await verifyEmailOtp(normalizedEmail, cleanCode, 'PASSWORD_RESET')
    if (!otpResult.valid) {
      return err(otpResult.error || 'Invalid or expired reset code', 400)
    }

    // 2. Lookup user
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    })

    if (!user) {
      return err('User account not found', 404)
    }

    // 3. Hash new password and update
    const passwordHash = await hashPassword(newPassword)
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    })

    // 4. Invalidate all existing sessions for this user for security
    await prisma.session.deleteMany({
      where: { userId: user.id },
    })

    const forwarded = request.headers.get('x-forwarded-for')
    const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown'
    const ua = request.headers.get('user-agent') || 'unknown'

    await logAudit({
      userId: user.id,
      action: 'PASSWORD_RESET_COMPLETED',
      entityType: 'user',
      entityId: user.id,
      ipAddress: ip,
      userAgent: ua,
      newValue: { email: normalizedEmail },
    })

    return ok({ message: 'Password has been reset successfully. You can now sign in with your new password.' })
  } catch (error) {
    console.error('Error resetting password:', error)
    return err('Failed to reset password. Please try again.', 500)
  }
}

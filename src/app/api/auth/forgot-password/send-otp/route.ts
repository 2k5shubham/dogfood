import { prisma } from '@/lib/prisma'
import { ok, err, rateLimit } from '@/lib/utils'
import { createEmailOtp } from '@/lib/otp'
import { sendPasswordResetOtpEmail } from '@/lib/email'

/**
 * POST /api/auth/forgot-password/send-otp
 * Dispatches a password reset OTP code to the user's verified email.
 */
export async function POST(request: Request) {
  try {
    const { email } = await request.json()

    if (!email || typeof email !== 'string') {
      return err('Email address is required', 400)
    }

    const normalizedEmail = email.toLowerCase().trim()

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    })

    if (!user) {
      return err('No account found with this email address', 404)
    }

    const forwarded = request.headers.get('x-forwarded-for')
    const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown'

    // Rate limit: 1 reset request per email per 60s
    const emailLimit = rateLimit(`otp-reset-email:${normalizedEmail}`, 1, 60 * 1000)
    if (!emailLimit.allowed) {
      return err('Please wait 60 seconds before requesting another reset code', 429)
    }

    // Rate limit: 5 reset requests per IP per hour
    const ipLimit = rateLimit(`otp-reset-ip:${ip}`, 5, 60 * 60 * 1000)
    if (!ipLimit.allowed) {
      return err('Too many reset requests. Please try again later.', 429)
    }

    // Generate code and persist hashed version with PASSWORD_RESET purpose
    const code = await createEmailOtp(normalizedEmail, 'PASSWORD_RESET')

    // Send email
    const delivery = await sendPasswordResetOtpEmail(normalizedEmail, code)
    const isDev = process.env.NODE_ENV !== 'production' || delivery.method === 'console'

    return ok({
      message: `Password reset code sent to ${normalizedEmail}`,
      method: delivery.method,
      ...(isDev ? { devCode: code } : {}),
    })
  } catch (error) {
    console.error('Error sending reset OTP:', error)
    return err('Failed to send reset code. Please try again.', 500)
  }
}

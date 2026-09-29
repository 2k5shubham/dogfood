import { prisma } from '@/lib/prisma'
import { ok, err, rateLimit } from '@/lib/utils'
import { createEmailOtp } from '@/lib/otp'
import { sendRegistrationOtpEmail } from '@/lib/email'

/**
 * POST /api/auth/register/send-otp
 * Validates registration data and dispatches email verification OTP code.
 */
export async function POST(request: Request) {
  try {
    const { email, displayName, password } = await request.json()

    if (!email || typeof email !== 'string') {
      return err('A valid email address is required', 400)
    }

    const normalizedEmail = email.toLowerCase().trim()
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(normalizedEmail)) {
      return err('Invalid email format', 400)
    }

    if (!displayName || displayName.trim().length < 2) {
      return err('Display name must be at least 2 characters', 400)
    }

    if (!password || password.length < 8) {
      return err('Password must be at least 8 characters', 400)
    }

    // Check if email already registered
    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    })
    if (existing) {
      return err('An account with this email already exists. Please sign in.', 409)
    }

    const forwarded = request.headers.get('x-forwarded-for')
    const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown'

    // Rate limit: 1 OTP request per email per 60 seconds
    const emailLimit = rateLimit(`otp-reg-email:${normalizedEmail}`, 1, 60 * 1000)
    if (!emailLimit.allowed) {
      return err('Please wait 60 seconds before requesting another verification code', 429)
    }

    // Rate limit: 10 OTP requests per IP per hour
    const ipLimit = rateLimit(`otp-reg-ip:${ip}`, 10, 60 * 60 * 1000)
    if (!ipLimit.allowed) {
      return err('Too many requests from this network. Try again later.', 429)
    }

    // Generate code and persist hashed version
    const code = await createEmailOtp(normalizedEmail, 'REGISTER')

    // Send email
    const delivery = await sendRegistrationOtpEmail(normalizedEmail, code)
    const isDev = process.env.NODE_ENV !== 'production' || delivery.method === 'console'

    return ok({
      message: `Verification code sent to ${normalizedEmail}`,
      method: delivery.method,
      ...(isDev ? { devCode: code } : {}),
    })
  } catch (error) {
    console.error('Error sending registration OTP:', error)
    return err('Failed to send verification code. Please try again.', 500)
  }
}

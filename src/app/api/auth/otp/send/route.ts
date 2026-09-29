import { ok, err, rateLimit } from '@/lib/utils'
import { createEmailOtp } from '@/lib/otp'
import { sendOtpEmail } from '@/lib/email'

/**
 * POST /api/auth/otp/send
 * Request a 6-digit OTP code sent to an email address.
 */
export async function POST(request: Request) {
  try {
    const { email } = await request.json()

    if (!email || typeof email !== 'string') {
      return err('A valid email address is required', 400)
    }

    const normalizedEmail = email.toLowerCase().trim()
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(normalizedEmail)) {
      return err('Invalid email format', 400)
    }

    const forwarded = request.headers.get('x-forwarded-for')
    const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown'

    // Rate limit: 1 OTP request per email per 60 seconds
    const emailLimit = rateLimit(`otp-email:${normalizedEmail}`, 1, 60 * 1000)
    if (!emailLimit.allowed) {
      return err('Please wait 60 seconds before requesting another code', 429)
    }

    // Rate limit: 10 OTP requests per IP per hour
    const ipLimit = rateLimit(`otp-ip:${ip}`, 10, 60 * 60 * 1000)
    if (!ipLimit.allowed) {
      return err('Too many OTP requests from this network. Try again later.', 429)
    }

    // Generate code and persist hashed version
    const code = await createEmailOtp(normalizedEmail)

    // Send email
    const delivery = await sendOtpEmail(normalizedEmail, code)

    const isDev = process.env.NODE_ENV !== 'production' || delivery.method === 'console'

    return ok({
      message: `Verification code sent to ${normalizedEmail}`,
      method: delivery.method,
      // For local development and automated testing without external mailer:
      ...(isDev ? { devCode: code } : {}),
    })
  } catch (error) {
    console.error('Error sending OTP:', error)
    return err('Failed to send verification code. Please try again.', 500)
  }
}

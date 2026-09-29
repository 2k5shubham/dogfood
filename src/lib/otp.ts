import crypto from 'crypto'
import { prisma } from './prisma'

const OTP_EXPIRY_MINUTES = 10
const MAX_ATTEMPTS = 5

export type OtpPurpose = 'REGISTER' | 'PASSWORD_RESET'

export function hashOtp(code: string): string {
  return crypto.createHash('sha256').update(code.trim()).digest('hex')
}

export function generateNumericOtp(): string {
  // Generates cryptographically secure 6-digit code: 100000 - 999999
  return crypto.randomInt(100000, 1000000).toString()
}

/**
 * Creates and stores a new OTP for an email address with specific purpose.
 * Invalidates any existing unexpired OTPs for this email and purpose.
 */
export async function createEmailOtp(email: string, purpose: OtpPurpose = 'REGISTER'): Promise<string> {
  const normalizedEmail = email.toLowerCase().trim()
  const code = generateNumericOtp()
  const codeHash = hashOtp(code)

  const expiresAt = new Date()
  expiresAt.setMinutes(expiresAt.getMinutes() + OTP_EXPIRY_MINUTES)

  // Invalidate any older OTPs for this email and purpose
  await prisma.emailOtp.deleteMany({
    where: { email: normalizedEmail, purpose },
  })

  // Store new hashed OTP
  await prisma.emailOtp.create({
    data: {
      email: normalizedEmail,
      codeHash,
      purpose,
      expiresAt,
      attempts: 0,
    },
  })

  return code
}

export interface VerifyOtpResult {
  valid: boolean
  error?: string
}

/**
 * Verifies an OTP for an email address and purpose.
 * Enforces expiration, max attempts, and deletes the record once verified.
 */
export async function verifyEmailOtp(
  email: string,
  code: string,
  purpose: OtpPurpose = 'REGISTER'
): Promise<VerifyOtpResult> {
  const normalizedEmail = email.toLowerCase().trim()
  const cleanCode = code.trim()

  const record = await prisma.emailOtp.findFirst({
    where: { email: normalizedEmail, purpose },
    orderBy: { createdAt: 'desc' },
  })

  if (!record) {
    return { valid: false, error: 'No verification code found or code has already been used. Please request a new code.' }
  }

  // Check expiration
  if (new Date() > record.expiresAt) {
    await prisma.emailOtp.delete({ where: { id: record.id } })
    return { valid: false, error: 'Verification code has expired. Please request a new one.' }
  }

  // Check attempt limit
  if (record.attempts >= MAX_ATTEMPTS) {
    await prisma.emailOtp.delete({ where: { id: record.id } })
    return { valid: false, error: 'Too many incorrect attempts. Please request a new code.' }
  }

  // Verify code hash
  const inputHash = hashOtp(cleanCode)
  if (inputHash !== record.codeHash) {
    const remaining = MAX_ATTEMPTS - (record.attempts + 1)
    await prisma.emailOtp.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    })

    return {
      valid: false,
      error: remaining > 0
        ? `Incorrect code. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`
        : 'Too many incorrect attempts. Please request a new code.',
    }
  }

  // Successful verification -> delete OTP so it cannot be reused
  await prisma.emailOtp.delete({ where: { id: record.id } })
  return { valid: true }
}

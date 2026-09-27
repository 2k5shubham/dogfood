import { prisma } from '@/lib/prisma'
import { hashPassword, createSession, setSessionCookie } from '@/lib/auth'
import { ok, err } from '@/lib/utils'

export async function POST(request: Request) {
  try {
    const { email, password, displayName } = await request.json()

    if (!email || !password || !displayName) {
      return err('Email, password, and display name are required')
    }

    if (password.length < 8) {
      return err('Password must be at least 8 characters')
    }

    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })
    if (existing) {
      return err('Email already registered', 409)
    }

    const passwordHash = await hashPassword(password)
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        displayName,
      },
      select: { id: true, email: true, displayName: true, globalRole: true },
    })

    const forwarded = request.headers.get('x-forwarded-for')
    const ip = forwarded ? forwarded.split(',')[0].trim() : undefined
    const ua = request.headers.get('user-agent') ?? undefined

    const token = await createSession(user.id, ip, ua)
    await setSessionCookie(token)

    return ok({ user }, 201)
  } catch (e) {
    console.error('[register]', e)
    return err('Internal server error', 500)
  }
}

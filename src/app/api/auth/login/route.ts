import { prisma } from '@/lib/prisma'
import { verifyPassword, createSession, setSessionCookie } from '@/lib/auth'
import { ok, err } from '@/lib/utils'

export async function POST(request: Request) {
  try {
    let body: any
    try {
      body = await request.json()
    } catch {
      return err('Invalid JSON payload', 400)
    }

    const { email, password } = body || {}

    if (!email || !password) {
      return err('Email and password are required')
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    })

    if (!user || !user.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
      return err('Invalid email or password', 401)
    }

    const forwarded = request.headers.get('x-forwarded-for')
    const ip = forwarded ? forwarded.split(',')[0].trim() : undefined
    const ua = request.headers.get('user-agent') ?? undefined

    const token = await createSession(user.id, ip, ua)
    await setSessionCookie(token)

    return ok({
      user: { id: user.id, email: user.email, displayName: user.displayName, globalRole: user.globalRole },
    })
  } catch (e) {
    console.error('[login]', e)
    return err('Internal server error', 500)
  }
}

import { getCurrentUser, deleteSession, clearSessionCookie } from '@/lib/auth'
import { cookies } from 'next/headers'
import { ok } from '@/lib/utils'

export async function DELETE() {
  const cookieStore = await cookies()
  const token = cookieStore.get('dogfood_session')?.value
  if (token) {
    await deleteSession(token)
  }
  await clearSessionCookie()
  return ok({ message: 'Logged out' })
}

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return Response.json({ user: null }, { status: 401 })
  return Response.json({
    user: { id: user.id, email: user.email, displayName: user.displayName, globalRole: user.globalRole },
  })
}

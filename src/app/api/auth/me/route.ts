import { getCurrentUser } from '@/lib/auth'
import { ok, unauthorized } from '@/lib/utils'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return unauthorized()
  return ok({
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      globalRole: user.globalRole,
      avatarUrl: user.avatarUrl,
    },
  })
}

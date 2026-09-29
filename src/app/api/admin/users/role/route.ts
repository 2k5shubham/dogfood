import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ok, err, unauthorized, forbidden, logAudit } from '@/lib/utils'

/**
 * POST /api/admin/users/role
 * Allows an existing Global Admin to promote or demote other users to/from 'admin'.
 * Body: { targetUserId: string, globalRole: 'admin' | 'user' }
 */
export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) return unauthorized()

  if (user.globalRole !== 'admin') {
    return forbidden('Superadmin privileges required')
  }

  const { targetUserId, globalRole } = await request.json()

  if (!targetUserId || !['admin', 'user'].includes(globalRole)) {
    return err('targetUserId and valid globalRole ("admin" | "user") are required', 400)
  }

  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
  })

  if (!target) {
    return err('Target user not found', 404)
  }

  // Prevent demoting the last active administrator
  if (globalRole === 'user' && target.globalRole === 'admin') {
    const adminCount = await prisma.user.count({
      where: { globalRole: 'admin' },
    })
    if (adminCount <= 1) {
      return err('Cannot demote the last remaining administrator', 400)
    }
  }

  const updated = await prisma.user.update({
    where: { id: targetUserId },
    data: { globalRole },
    select: { id: true, email: true, displayName: true, globalRole: true },
  })

  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown'

  await logAudit({
    userId: user.id,
    action: 'GLOBAL_ROLE_CHANGED',
    entityType: 'user',
    entityId: targetUserId,
    ipAddress: ip,
    oldValue: { globalRole: target.globalRole },
    newValue: { globalRole },
  })

  return ok({
    message: `Successfully set ${updated.displayName} (${updated.email}) to ${globalRole}`,
    user: updated,
  })
}

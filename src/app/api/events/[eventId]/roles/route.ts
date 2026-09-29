import { getCurrentUser, canOrganize } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ok, err, unauthorized, forbidden, logAudit } from '@/lib/utils'

const VALID_ROLES = ['organizer', 'judge', 'participant'] as const

/**
 * GET /api/events/[eventId]/roles
 * List all users assigned to roles in this event (organizers, judges, participants).
 * Only accessible by organizers and admins.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return unauthorized()

  const { eventId } = await params
  const allowed = await canOrganize(user.id, eventId)
  if (!allowed) return forbidden('Only organizers or admins can view event roles')

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      title: true,
      organizer: { select: { id: true, email: true, displayName: true, avatarUrl: true } },
    },
  })
  if (!event) return err('Event not found', 404)

  const roles = await prisma.eventRole.findMany({
    where: { eventId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          displayName: true,
          avatarUrl: true,
          globalRole: true,
          createdAt: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  // Group by role
  const organizers = roles.filter(r => r.role === 'organizer')
  const judges = roles.filter(r => r.role === 'judge')
  const participants = roles.filter(r => r.role === 'participant')

  return ok({
    event: { id: event.id, title: event.title, primaryOrganizer: event.organizer },
    summary: {
      total: roles.length,
      organizersCount: organizers.length,
      judgesCount: judges.length,
      participantsCount: participants.length,
    },
    roles: roles.map(r => ({
      id: r.id,
      role: r.role,
      invitedBy: r.invitedBy,
      acceptedAt: r.acceptedAt,
      createdAt: r.createdAt,
      user: r.user,
    })),
  })
}

/**
 * POST /api/events/[eventId]/roles
 * Assign, invite, or change a user's role in this event.
 * Body: { email: string, role: 'organizer' | 'judge' | 'participant' }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return unauthorized()

  const { eventId } = await params
  const allowed = await canOrganize(user.id, eventId)
  if (!allowed) return forbidden('Only organizers or admins can manage event roles')

  const { email, role } = await request.json()

  if (!email || typeof email !== 'string') {
    return err('A valid email is required', 400)
  }

  if (!role || !VALID_ROLES.includes(role)) {
    return err(`Invalid role. Valid roles are: ${VALID_ROLES.join(', ')}`, 400)
  }

  const normalizedEmail = email.toLowerCase().trim()

  // Find or create user account for this email
  let targetUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  })

  if (!targetUser) {
    const rawName = normalizedEmail.split('@')[0]
    const formattedName = rawName.charAt(0).toUpperCase() + rawName.slice(1)
    targetUser = await prisma.user.create({
      data: {
        email: normalizedEmail,
        displayName: formattedName,
        globalRole: 'user',
      },
    })
  }

  // Upsert event role
  const eventRole = await prisma.eventRole.upsert({
    where: { userId_eventId: { userId: targetUser.id, eventId } },
    create: {
      userId: targetUser.id,
      eventId,
      role,
      invitedBy: user.id,
      acceptedAt: new Date(),
    },
    update: {
      role,
      acceptedAt: new Date(),
    },
    include: {
      user: { select: { id: true, email: true, displayName: true, globalRole: true } },
    },
  })

  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown'

  await logAudit({
    userId: user.id,
    action: 'ROLE_ASSIGNED',
    entityType: 'event_role',
    entityId: eventRole.id,
    eventId,
    ipAddress: ip,
    newValue: { targetUserId: targetUser.id, targetEmail: targetUser.email, role, assignedBy: user.id },
  })

  return ok({
    message: `Successfully assigned ${targetUser.displayName} as ${role}`,
    eventRole: {
      id: eventRole.id,
      role: eventRole.role,
      user: eventRole.user,
    },
  })
}

/**
 * DELETE /api/events/[eventId]/roles
 * Revoke a user's role in this event.
 * Body: { userId: string }
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return unauthorized()

  const { eventId } = await params
  const allowed = await canOrganize(user.id, eventId)
  if (!allowed) return forbidden('Only organizers or admins can revoke event roles')

  const { userId } = await request.json()
  if (!userId) return err('userId is required', 400)

  // Prevent organizer from removing themselves if they are the primary event creator
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { organizerId: true },
  })
  if (event?.organizerId === userId) {
    return err('Cannot remove the primary event creator from the event', 400)
  }

  const existingRole = await prisma.eventRole.findUnique({
    where: { userId_eventId: { userId, eventId } },
    include: { user: { select: { email: true, displayName: true } } },
  })

  if (!existingRole) {
    return err('Role not found for this user in this event', 404)
  }

  await prisma.eventRole.delete({
    where: { id: existingRole.id },
  })

  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown'

  await logAudit({
    userId: user.id,
    action: 'ROLE_REVOKED',
    entityType: 'event_role',
    entityId: existingRole.id,
    eventId,
    ipAddress: ip,
    oldValue: { targetUserId: userId, role: existingRole.role },
  })

  return ok({ message: `Revoked ${existingRole.role} role from ${existingRole.user.displayName}` })
}

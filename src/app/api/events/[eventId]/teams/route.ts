import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ok, err, unauthorized, forbidden, notFound } from '@/lib/utils'
import crypto from 'crypto'

// POST /api/events/[eventId]/teams — create team
export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return unauthorized()

  const { eventId } = await params
  const { name, bio } = await request.json()
  if (!name) return err('Team name is required')

  const event = await prisma.event.findUnique({ where: { id: eventId } })
  if (!event) return notFound('Event')

  // Check not already in a team
  const existingMembership = await prisma.teamMember.findFirst({
    where: { userId: user.id, team: { eventId } },
  })
  if (existingMembership) return err('You are already in a team for this event', 409)

  const inviteCode = crypto.randomBytes(5).toString('hex').toUpperCase()

  const team = await prisma.team.create({
    data: {
      eventId,
      name,
      bio,
      inviteCode,
      createdById: user.id,
      members: {
        create: { userId: user.id, role: 'lead' },
      },
    },
    include: { members: true },
  })

  // Ensure participant role
  await prisma.eventRole.upsert({
    where: { userId_eventId: { userId: user.id, eventId } },
    create: { userId: user.id, eventId, role: 'participant', acceptedAt: new Date() },
    update: {},
  })

  return ok({ team }, 201)
}

// GET /api/events/[eventId]/teams — list teams
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params

  const teams = await prisma.team.findMany({
    where: { eventId },
    include: {
      members: {
        include: { user: { select: { id: true, displayName: true, avatarUrl: true } } },
      },
      _count: { select: { projects: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  return ok({ teams })
}

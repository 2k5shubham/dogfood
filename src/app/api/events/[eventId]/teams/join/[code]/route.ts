import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ok, err, unauthorized, notFound } from '@/lib/utils'

// POST /api/events/[eventId]/teams/join/[code]
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ eventId: string; code: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return unauthorized()

  const { eventId, code } = await params

  const team = await prisma.team.findFirst({
    where: { inviteCode: code.toUpperCase(), eventId },
    include: { members: true },
  })

  if (!team) return notFound('Invite link')

  const alreadyMember = team.members.some((m) => m.userId === user.id)
  if (alreadyMember) return err('You are already in this team', 409)

  // Check not in another team
  const otherTeam = await prisma.teamMember.findFirst({
    where: { userId: user.id, team: { eventId } },
  })
  if (otherTeam) return err('You are already in a team for this event', 409)

  if (team.members.length >= 4) return err('Team is full (max 4 members)', 409)

  await prisma.teamMember.create({
    data: { teamId: team.id, userId: user.id, role: 'member' },
  })

  // Ensure participant role
  await prisma.eventRole.upsert({
    where: { userId_eventId: { userId: user.id, eventId } },
    create: { userId: user.id, eventId, role: 'participant', acceptedAt: new Date() },
    update: {},
  })

  return ok({ team: { id: team.id, name: team.name } })
}

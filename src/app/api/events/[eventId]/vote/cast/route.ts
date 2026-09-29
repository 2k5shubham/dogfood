import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logAudit, ok, err, unauthorized, rateLimit } from '@/lib/utils'

/**
 * POST /api/events/[eventId]/vote/cast
 * Toggle upvote: authenticated user casts or retracts one vote per project.
 *
 * Anti-Sybil guarantees:
 * 1. Must be logged in (registered account = unique email enforced at DB level)
 * 2. @@unique([userId, projectId]) in DB — duplicate vote is a hard constraint violation
 * 3. Account must have been created before the submission deadline (account-age check)
 * 4. Rate limit: 20 vote actions per user per minute
 * 5. Cannot vote for your own team's project
 * 6. Full audit trail with userId + IP
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return unauthorized()

  const { eventId } = await params
  const { projectId } = await request.json()
  if (!projectId) return err('projectId required')

  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown'

  // Rate limit: 20 vote actions per user per minute
  const { allowed } = rateLimit(`vote:${user.id}`, 20, 60 * 1000)
  if (!allowed) return err('Too many votes. Wait a moment.', 429)

  // Load event + project in parallel
  const [event, project] = await Promise.all([
    prisma.event.findUnique({
      where: { id: eventId },
      select: { votingOpensAt: true, votingDeadline: true, submissionDeadline: true },
    }),
    prisma.project.findUnique({
      where: { id: projectId },
      include: { team: { include: { members: { select: { userId: true } } } } },
    }),
  ])

  if (!event) return err('Event not found', 404)
  if (!project) return err('Project not found', 404)

  // Voting window check
  const now = new Date()
  if (event.votingDeadline && now > event.votingDeadline) return err('Voting has closed', 403)
  if (event.votingOpensAt && now < event.votingOpensAt) return err('Voting has not opened yet', 403)

  // Account-age check: account must exist before the submission deadline.
  // This means an attacker cannot create new accounts specifically to vote after
  // seeing which projects were submitted.
  if (user.createdAt > event.submissionDeadline) {
    return err('Your account was created after the submission deadline. Only accounts pre-dating the deadline can vote.', 403)
  }

  // Self-vote prevention: cannot vote for your own team's project
  const isOwnTeam = project.team.members.some(m => m.userId === user.id)
  if (isOwnTeam) return err('You cannot vote for your own team\'s project', 403)

  // Toggle vote: if vote exists → remove it (retract). If not → create it.
  const existing = await prisma.userVote.findUnique({
    where: { userId_projectId: { userId: user.id, projectId } },
  })

  if (existing) {
    // Retract vote
    await prisma.userVote.delete({ where: { id: existing.id } })
    await logAudit({
      userId: user.id,
      action: 'VOTE_RETRACT',
      entityType: 'user_vote',
      entityId: projectId,
      eventId,
      ipAddress: ip,
      newValue: { projectId, action: 'retract' },
    })
    const count = await prisma.userVote.count({ where: { projectId } })
    return ok({ voted: false, voteCount: count })
  } else {
    // Cast vote (DB UNIQUE constraint is the final safety net against duplicates)
    await prisma.userVote.create({
      data: { userId: user.id, projectId, eventId },
    })
    await logAudit({
      userId: user.id,
      action: 'VOTE_CAST',
      entityType: 'user_vote',
      entityId: projectId,
      eventId,
      ipAddress: ip,
      newValue: { projectId, action: 'cast' },
    })
    const count = await prisma.userVote.count({ where: { projectId } })
    return ok({ voted: true, voteCount: count })
  }
}

/**
 * GET /api/events/[eventId]/vote/cast
 * Returns the current user's votes in this event.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return ok({ myVotes: [], authenticated: false })

  const { eventId } = await params

  const myVotes = await prisma.userVote.findMany({
    where: { userId: user.id, eventId },
    select: { projectId: true },
  })

  return ok({ myVotes: myVotes.map(v => v.projectId), authenticated: true })
}

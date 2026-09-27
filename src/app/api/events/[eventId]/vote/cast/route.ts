import { prisma } from '@/lib/prisma'
import { logAudit, ok, err, rateLimit, quadraticCost, creditDelta } from '@/lib/utils'
import crypto from 'crypto'

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

// POST /api/events/[eventId]/vote/cast — cast quadratic vote
export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params
  const { token, projectId, voteCount } = await request.json()

  if (!token) return err('Voter token required')
  if (typeof voteCount !== 'number' || voteCount < 0 || voteCount > 10) {
    return err('voteCount must be 0-10')
  }

  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown'

  // Rate limit: 30 votes per token per minute
  const { allowed } = rateLimit(`vote-cast:${token.slice(0, 8)}`, 30, 60 * 1000)
  if (!allowed) return err('Too many vote changes. Wait a moment.', 429)

  const tokenHash = hashToken(token)
  const voterToken = await prisma.voterToken.findFirst({
    where: { tokenHash, eventId, emailVerified: true },
  })

  if (!voterToken) return err('Invalid or unverified voter token', 401)

  // Check voting window
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { votingDeadline: true, votingOpensAt: true, resultsPublishedAt: true },
  })

  const now = new Date()
  if (event?.votingDeadline && now > event.votingDeadline) return err('Voting has closed', 403)
  if (event?.votingOpensAt && now < event.votingOpensAt) return err('Voting not open yet', 403)

  // Calculate credit delta
  const existing = await prisma.projectVote.findUnique({
    where: { voterTokenId_projectId: { voterTokenId: voterToken.id, projectId } },
  })
  const currentVotes = existing?.voteCount ?? 0
  const delta = creditDelta(currentVotes, voteCount)
  const newCreditsUsed = voterToken.creditsUsed + delta

  if (newCreditsUsed > voterToken.totalCredits) {
    return err(
      `Insufficient credits. Need ${delta} more but only have ${voterToken.totalCredits - voterToken.creditsUsed} remaining.`,
      400
    )
  }

  // Atomic transaction
  await prisma.$transaction([
    prisma.voterToken.update({
      where: { id: voterToken.id },
      data: { creditsUsed: newCreditsUsed },
    }),
    voteCount === 0
      ? prisma.projectVote.deleteMany({
          where: { voterTokenId: voterToken.id, projectId },
        })
      : prisma.projectVote.upsert({
          where: { voterTokenId_projectId: { voterTokenId: voterToken.id, projectId } },
          create: { voterTokenId: voterToken.id, projectId, voteCount, creditsSpent: quadraticCost(voteCount) },
          update: { voteCount, creditsSpent: quadraticCost(voteCount) },
        }),
  ])

  await logAudit({
    action: 'VOTE_CAST',
    entityType: 'project_vote',
    entityId: projectId,
    eventId,
    newValue: { voteCount, creditsSpent: quadraticCost(voteCount), delta },
    ipAddress: ip,
  })

  return ok({
    voteCount,
    creditsSpent: quadraticCost(voteCount),
    creditsRemaining: voterToken.totalCredits - newCreditsUsed,
  })
}

// GET /api/events/[eventId]/vote/cast?token=... — get voter's current votes
export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')

  if (!token) return err('Token required', 400)

  const tokenHash = hashToken(token)
  const voterToken = await prisma.voterToken.findFirst({
    where: { tokenHash, eventId },
    include: { votes: true },
  })

  if (!voterToken) return err('Invalid token', 401)

  // Results hidden during voting window
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { votingDeadline: true, resultsPublishedAt: true },
  })

  return ok({
    creditsRemaining: voterToken.totalCredits - voterToken.creditsUsed,
    creditsUsed: voterToken.creditsUsed,
    totalCredits: voterToken.totalCredits,
    votes: voterToken.votes,
    ballotOrder: voterToken.ballotOrder, // randomized project order
  })
}

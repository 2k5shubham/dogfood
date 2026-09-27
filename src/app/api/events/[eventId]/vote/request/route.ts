import { prisma } from '@/lib/prisma'
import { logAudit, ok, err, rateLimit } from '@/lib/utils'
import { quadraticCost, creditDelta } from '@/lib/utils'
import crypto from 'crypto'

// POST /api/events/[eventId]/vote/request — request voter token (email verification)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params
  const { email } = await request.json()

  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown'

  // Rate limit: 3 requests per IP per 10 minutes
  const { allowed } = rateLimit(`vote-request:${ip}`, 3, 10 * 60 * 1000)
  if (!allowed) return err('Too many requests. Try again later.', 429)

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { votingOpensAt: true, votingDeadline: true, status: true },
  })

  if (!event) return err('Event not found', 404)

  const now = new Date()
  if (event.votingDeadline && now > event.votingDeadline) {
    return err('Voting has closed', 403)
  }
  if (event.votingOpensAt && now < event.votingOpensAt) {
    return err('Voting has not opened yet', 403)
  }

  const rawToken = crypto.randomUUID()
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')

  // Randomize ballot order for this voter
  const projects = await prisma.project.findMany({
    where: { eventId, status: 'submitted' },
    select: { id: true },
  })
  const shuffled = projects.map((p) => p.id).sort(() => Math.random() - 0.5)

  await prisma.voterToken.create({
    data: {
      tokenHash,
      eventId,
      email: email?.toLowerCase(),
      emailVerified: true, // In production: send verification link. For hackathon: auto-verify.
      totalCredits: 100,
      creditsUsed: 0,
      ipAddress: ip,
      ballotOrder: shuffled,
    },
  })

  // Log verification link (self-hosted: user sees token in response)
  const voteUrl = `${process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'}/vote/${eventId}?token=${rawToken}`
  console.log(`[VOTE TOKEN] ${email} → ${voteUrl}`)

  return ok({ token: rawToken, voteUrl })
}

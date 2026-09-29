import { getCurrentUser, getUserEventRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logAudit, ok, err, unauthorized, forbidden } from '@/lib/utils'

function generateSlug(title: string) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') +
    '-' + Math.random().toString(36).slice(2, 7)
}

// GET /api/events — public list
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20'), 100)

  const events = await prisma.event.findMany({
    where: status ? { status } : undefined,
    select: {
      id: true, slug: true, title: true, description: true, status: true,
      submissionDeadline: true, submissionOpensAt: true, registrationOpensAt: true,
      votingOpensAt: true, votingDeadline: true, resultsPublishedAt: true,
      tracks: { select: { id: true, name: true, prizeAmount: true, prizeCurrency: true, description: true } },
      _count: { select: { projects: true, eventRoles: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  return ok({ events })
}

// POST /api/events — organizer creates event
export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) return unauthorized()

  const body = await request.json()
  const { title, description, submissionDeadline, votingOpensAt, votingDeadline,
    submissionOpensAt, registrationOpensAt, tracks = [] } = body

  if (!title || !description || !submissionDeadline) {
    return err('title, description, and submissionDeadline are required')
  }

  const slug = generateSlug(title)

  const event = await prisma.event.create({
    data: {
      slug,
      title,
      description,
      organizerId: user.id,
      submissionDeadline: new Date(submissionDeadline),
      submissionOpensAt: submissionOpensAt ? new Date(submissionOpensAt) : undefined,
      registrationOpensAt: registrationOpensAt ? new Date(registrationOpensAt) : undefined,
      votingOpensAt: votingOpensAt ? new Date(votingOpensAt) : undefined,
      votingDeadline: votingDeadline ? new Date(votingDeadline) : undefined,
      status: 'draft',
      eventRoles: {
        create: { userId: user.id, role: 'organizer', acceptedAt: new Date() },
      },
      tracks: {
        create: tracks.map((t: { name: string; description?: string; prizeAmount?: number }, i: number) => ({
          name: t.name,
          description: t.description,
          prizeAmount: t.prizeAmount,
          order: i,
        })),
      },
    },
    include: { tracks: true },
  })

  await logAudit({
    userId: user.id,
    action: 'EVENT_CREATE',
    entityType: 'event',
    entityId: event.id,
    eventId: event.id,
    newValue: { title, slug },
  })

  return ok({ event }, 201)
}

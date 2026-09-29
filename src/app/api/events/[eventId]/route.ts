import { getCurrentUser, getUserEventRole, canOrganize } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logAudit, ok, err, unauthorized, forbidden, notFound } from '@/lib/utils'

// GET /api/events/[eventId] — public event detail
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      tracks: { orderBy: { order: 'asc' } },
      rubricCriteria: { orderBy: { order: 'asc' } },
      _count: { select: { projects: true } },
    },
  })

  if (!event) return notFound('Event')
  return ok({ event })
}

// PATCH /api/events/[eventId] — organizer updates event
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return unauthorized()

  const { eventId } = await params
  const allowed = await canOrganize(user.id, eventId)
  if (!allowed) return forbidden()

  const body = await request.json()
  const {
    title, description, status,
    submissionDeadline, submissionOpensAt, registrationOpensAt,
    votingOpensAt, votingDeadline, resultsPublishedAt,
  } = body

  const event = await prisma.event.update({
    where: { id: eventId },
    data: {
      ...(title && { title }),
      ...(description && { description }),
      ...(status && { status }),
      ...(submissionDeadline && { submissionDeadline: new Date(submissionDeadline) }),
      ...(submissionOpensAt && { submissionOpensAt: new Date(submissionOpensAt) }),
      ...(registrationOpensAt && { registrationOpensAt: new Date(registrationOpensAt) }),
      ...(votingOpensAt && { votingOpensAt: new Date(votingOpensAt) }),
      ...(votingDeadline && { votingDeadline: new Date(votingDeadline) }),
      ...(resultsPublishedAt && { resultsPublishedAt: new Date(resultsPublishedAt) }),
    },
  })

  await logAudit({
    userId: user.id,
    action: 'EVENT_UPDATE',
    entityType: 'event',
    entityId: eventId,
    eventId,
    newValue: body,
  })

  return ok({ event })
}

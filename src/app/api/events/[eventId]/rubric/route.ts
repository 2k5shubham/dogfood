import { getCurrentUser, canOrganize } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ok, err, unauthorized, forbidden, notFound } from '@/lib/utils'

// GET /api/events/[eventId]/rubric
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params
  const criteria = await prisma.rubricCriterion.findMany({
    where: { eventId },
    orderBy: { order: 'asc' },
  })
  return ok({ criteria })
}

// PUT /api/events/[eventId]/rubric — replace entire rubric
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return unauthorized()

  const { eventId } = await params
  const allowed = await canOrganize(user.id, eventId)
  if (!allowed) return forbidden()

  const { criteria } = await request.json()
  if (!Array.isArray(criteria) || criteria.length === 0) {
    return err('criteria must be a non-empty array')
  }

  // Validate weights sum to 1.0 (allow small floating point error)
  const totalWeight = criteria.reduce((sum: number, c: { weight: number }) => sum + c.weight, 0)
  if (Math.abs(totalWeight - 1.0) > 0.01) {
    return err(`Criterion weights must sum to 1.0 (got ${totalWeight.toFixed(3)})`)
  }

  // Replace all criteria for this event
  await prisma.rubricCriterion.deleteMany({ where: { eventId } })

  const created = await prisma.rubricCriterion.createMany({
    data: criteria.map((c: { name: string; description?: string; weight: number; maxScore?: number }, i: number) => ({
      eventId,
      name: c.name,
      description: c.description,
      weight: c.weight,
      maxScore: c.maxScore ?? 5,
      order: i,
    })),
  })

  const newCriteria = await prisma.rubricCriterion.findMany({
    where: { eventId },
    orderBy: { order: 'asc' },
  })

  return ok({ criteria: newCriteria })
}

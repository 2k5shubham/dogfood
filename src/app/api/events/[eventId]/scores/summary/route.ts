import { getCurrentUser, canOrganize } from '@/lib/auth'
import { getJudgingProgress, getEventSummary, runZScoreNormalization, getLeaderboard } from '@/lib/judging.dal'
import { logAudit, ok, err, unauthorized, forbidden } from '@/lib/utils'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/events/[eventId]/scores/summary
 * Organizer-only: aggregated judging progress + normalized leaderboard.
 * NEVER returns per-judge raw scores.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return unauthorized()

  const { eventId } = await params
  const allowed = await canOrganize(user.id, eventId)
  if (!allowed) return forbidden()

  const [summary, progress] = await Promise.all([
    getEventSummary(eventId),
    getJudgingProgress(eventId),
  ])

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { resultsPublishedAt: true },
  })

  const isPublished = !!event?.resultsPublishedAt && event.resultsPublishedAt <= new Date()

  // Get leaderboard from cache
  const leaderboard = await getLeaderboard(eventId)

  return ok({
    summary,
    progress,
    leaderboard: leaderboard.map((entry) => ({
      projectId: entry.projectId,
      title: entry.project.title,
      teamName: entry.project.team.name,
      trackName: entry.project.track?.name,
      // Hide actual scores until published
      normalizedScore: isPublished ? entry.normalizedScore : null,
      judgeCount: entry.judgeCount,
      rank: null, // filled client-side
    })),
    resultsPublished: isPublished,
  })
}

/**
 * POST /api/events/[eventId]/scores/normalize
 * Trigger Z-score normalization. Organizer only.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return unauthorized()

  const { eventId } = await params
  const allowed = await canOrganize(user.id, eventId)
  if (!allowed) return forbidden()

  const results = await runZScoreNormalization(eventId)

  await prisma.normalizationRun.create({
    data: {
      eventId,
      method: 'z-score',
      parametersJson: { version: '1.0', edgeCaseHandling: 'sigma0_contributes_zero' },
      runBy: user.id,
      affectedProjectCount: results.length,
    },
  })

  await logAudit({
    userId: user.id,
    action: 'NORMALIZATION_RUN',
    entityType: 'event',
    entityId: eventId,
    eventId,
    newValue: { method: 'z-score', projectCount: results.length },
  })

  return ok({ message: 'Normalization complete', projectsNormalized: results.length })
}

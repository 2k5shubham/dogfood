import { getCurrentUser, canOrganize } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ok, err, unauthorized, forbidden } from '@/lib/utils'
import { getLeaderboard } from '@/lib/judging.dal'

// GET /api/events/[eventId]/scores/export — CSV export (organizer only)
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return unauthorized()

  const { eventId } = await params
  const allowed = await canOrganize(user.id, eventId)
  if (!allowed) return forbidden()

  const [allScores, criteria, leaderboard] = await Promise.all([
    prisma.judgeScore.findMany({
      where: { eventId },
      include: {
        project: { select: { title: true, team: { select: { name: true } } } },
        criterion: { select: { name: true, weight: true } },
      },
      orderBy: [{ projectId: 'asc' }, { criterionId: 'asc' }],
    }),
    prisma.rubricCriterion.findMany({ where: { eventId }, orderBy: { order: 'asc' } }),
    getLeaderboard(eventId),
  ])

  // Anonymize judges: assign Judge A, B, C...
  const judgeIds = [...new Set(allScores.map((s) => s.judgeId))]
  const judgeLabel = Object.fromEntries(judgeIds.map((id, i) => [id, `Judge ${String.fromCharCode(65 + i)}`]))

  const rows: string[] = [
    ['Project', 'Team', 'Judge', 'Criterion', 'Weight', 'Raw Score', 'Normalized Score', 'Rank'].join(','),
  ]

  const rankMap = new Map(leaderboard.map((e, i) => [e.projectId, i + 1]))

  for (const score of allScores) {
    const norm = leaderboard.find((e) => e.projectId === score.projectId)
    rows.push([
      `"${score.project.title}"`,
      `"${score.project.team.name}"`,
      judgeLabel[score.judgeId] ?? 'Unknown',
      `"${score.criterion.name}"`,
      score.criterion.weight.toFixed(2),
      score.score.toString(),
      norm?.normalizedScore?.toFixed(4) ?? 'pending',
      (rankMap.get(score.projectId) ?? '').toString(),
    ].join(','))
  }

  const csv = rows.join('\n')

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="scores-${eventId}.csv"`,
    },
  })
}

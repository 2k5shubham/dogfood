import { prisma } from '@/lib/prisma'
import { getLeaderboard } from '@/lib/judging.dal'
import { ok, notFound } from '@/lib/utils'

// GET /api/events/[eventId]/leaderboard — public leaderboard
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      title: true,
      resultsPublishedAt: true,
      votingDeadline: true,
      submissionDeadline: true,
      tracks: { select: { id: true, name: true, prizeAmount: true } },
    },
  })

  if (!event) return notFound('Event')

  const isPublished = !!event.resultsPublishedAt && event.resultsPublishedAt <= new Date()

  // Get community vote counts per project
  const communityVotes = await prisma.projectVote.groupBy({
    by: ['projectId'],
    _sum: { voteCount: true },
    where: { project: { eventId } },
  })

  const voteMap = new Map<string, number>()
  for (const v of communityVotes) {
    voteMap.set(v.projectId, v._sum.voteCount || 0)
  }

  const cachedLeaderboard = await getLeaderboard(eventId)

  const rankedProjects = cachedLeaderboard.map((entry, index) => ({
    rank: index + 1,
    projectId: entry.projectId,
    title: entry.project.title,
    tagline: entry.project.tagline,
    teamName: entry.project.team.name,
    trackId: entry.project.track?.id ?? null,
    trackName: entry.project.track?.name,
    coverUrl: entry.project.coverUrl,
    normalizedScore: isPublished ? (entry.normalizedScore !== null ? Number(entry.normalizedScore.toFixed(3)) : null) : null,
    rawWeightedAvg: isPublished ? (entry.rawWeightedAvg !== null ? Number(entry.rawWeightedAvg.toFixed(2)) : null) : null,
    judgeCount: entry.judgeCount,
    communityVotes: voteMap.get(entry.projectId) || 0,
  }))

  // Community Award winner (highest quadratic votes)
  let communityWinner = null
  if (rankedProjects.length > 0) {
    const sortedByVotes = [...rankedProjects].sort((a, b) => b.communityVotes - a.communityVotes)
    if (sortedByVotes[0].communityVotes > 0) {
      communityWinner = sortedByVotes[0]
    }
  }

  return ok({
    event: {
      id: event.id,
      title: event.title,
      resultsPublished: isPublished,
      resultsPublishedAt: event.resultsPublishedAt,
      votingDeadline: event.votingDeadline,
      tracks: event.tracks,
    },
    leaderboard: isPublished ? rankedProjects : rankedProjects.map(p => ({
      ...p,
      rank: null,
      normalizedScore: null,
      rawWeightedAvg: null,
      title: '••••••••••••••',
      teamName: '••••••••',
    })),
    communityWinner: isPublished ? communityWinner : null,
  })
}

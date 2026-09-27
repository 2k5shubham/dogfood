import { prisma } from './prisma'

/**
 * JUDGING DATA ACCESS LAYER
 * 
 * ⚠️ SECURITY CRITICAL: Every function that reads judge scores MUST filter by
 * the authenticated judge's ID. The judgeId parameter ALWAYS comes from the
 * verified session (server-side), never from the request body or URL params.
 * 
 * This makes score isolation backend-enforced, not just hidden in UI.
 */

// ─── SCORE READS (judge-isolated) ────────────────────────────────────────────

/**
 * Get scores for a specific judge on a specific project.
 * judgeId MUST come from authenticated session, not request.
 */
export async function getMyScoresForProject(judgeId: string, projectId: string) {
  return prisma.judgeScore.findMany({
    where: { judgeId, projectId }, // ← hardcoded isolation
    include: { criterion: true },
    orderBy: { criterion: { order: 'asc' } },
  })
}

/**
 * Get all scores submitted by this judge across the event.
 * Returns only this judge's scores.
 */
export async function getMyEventScores(judgeId: string, eventId: string) {
  return prisma.judgeScore.findMany({
    where: { judgeId, eventId }, // ← hardcoded isolation
    include: { project: { select: { id: true, title: true } }, criterion: true },
  })
}

/**
 * Get assignments for a judge (which projects they must score).
 */
export async function getMyAssignments(judgeId: string, eventId: string) {
  return prisma.judgeAssignment.findMany({
    where: { judgeId, eventId },
    include: {
      project: {
        select: { id: true, title: true, tagline: true, team: { select: { name: true } } },
      },
    },
    orderBy: { assignedAt: 'asc' },
  })
}

// ─── SCORE WRITES ────────────────────────────────────────────────────────────

export async function upsertScore(
  judgeId: string,
  projectId: string,
  criterionId: string,
  eventId: string,
  score: number,
  note?: string
) {
  return prisma.judgeScore.upsert({
    where: { judgeId_projectId_criterionId: { judgeId, projectId, criterionId } },
    create: { judgeId, projectId, criterionId, eventId, score, note },
    update: { score, note, updatedAt: new Date() },
  })
}

export async function markAssignmentComplete(judgeId: string, projectId: string) {
  return prisma.judgeAssignment.updateMany({
    where: { judgeId, projectId },
    data: { completedAt: new Date() },
  })
}

// ─── ORGANIZER AGGREGATES (never exposes per-judge rows) ─────────────────────

/**
 * Get judging progress per project for organizer dashboard.
 * Returns counts only — never individual judge scores.
 */
export async function getJudgingProgress(eventId: string) {
  const assignments = await prisma.judgeAssignment.groupBy({
    by: ['projectId'],
    where: { eventId },
    _count: { judgeId: true },
  })

  const completed = await prisma.judgeAssignment.groupBy({
    by: ['projectId'],
    where: { eventId, completedAt: { not: null } },
    _count: { judgeId: true },
  })

  const completedMap = new Map(completed.map((c) => [c.projectId, c._count.judgeId]))

  return assignments.map((a) => ({
    projectId: a.projectId,
    totalAssigned: a._count.judgeId,
    completed: completedMap.get(a.projectId) ?? 0,
  }))
}

/**
 * Get summary counts for the organizer dashboard.
 */
export async function getEventSummary(eventId: string) {
  const [projects, judges, completedAssignments, totalAssignments] = await Promise.all([
    prisma.project.count({ where: { eventId, status: 'submitted' } }),
    prisma.eventRole.count({ where: { eventId, role: 'judge' } }),
    prisma.judgeAssignment.count({ where: { eventId, completedAt: { not: null } } }),
    prisma.judgeAssignment.count({ where: { eventId } }),
  ])

  return {
    projectCount: projects,
    judgeCount: judges,
    completedAssignments,
    totalAssignments,
    completionPercent: totalAssignments > 0
      ? Math.round((completedAssignments / totalAssignments) * 100)
      : 0,
  }
}

// ─── NORMALIZATION (Z-Score) ──────────────────────────────────────────────────

/**
 * Z-score normalization per judge per criterion.
 * 
 * Algorithm:
 *   For each judge j, criterion k:
 *     μ_jk = mean of judge j's scores on criterion k
 *     σ_jk = std dev of judge j's scores on criterion k
 *     if σ_jk == 0: z = 0  (judge contributes no info, not NaN)
 *     else: z = (score - μ_jk) / σ_jk
 * 
 *   For each project i, criterion k:
 *     z̄_ik = mean z-scores across all assigned judges
 *   
 *   weighted_score_i = Σ(w_k × z̄_ik) for all criteria k
 */
export async function runZScoreNormalization(eventId: string) {
  // 1. Fetch all scores for this event
  const allScores = await prisma.judgeScore.findMany({
    where: { eventId },
    include: { criterion: true },
  })

  const criteria = await prisma.rubricCriterion.findMany({
    where: { eventId },
    orderBy: { order: 'asc' },
  })

  if (allScores.length === 0 || criteria.length === 0) return []

  // 2. Compute per-judge, per-criterion mean and std
  type JudgeCritStats = { scores: number[]; mean: number; std: number }
  const judgeStats = new Map<string, Map<string, JudgeCritStats>>()

  for (const s of allScores) {
    if (!judgeStats.has(s.judgeId)) judgeStats.set(s.judgeId, new Map())
    const critMap = judgeStats.get(s.judgeId)!
    if (!critMap.has(s.criterionId)) critMap.set(s.criterionId, { scores: [], mean: 0, std: 0 })
    critMap.get(s.criterionId)!.scores.push(s.score)
  }

  for (const [, critMap] of judgeStats) {
    for (const [, stats] of critMap) {
      const n = stats.scores.length
      const mean = stats.scores.reduce((a: number, b: number) => a + b, 0) / n
      const variance = stats.scores.reduce((a: number, b: number) => a + (b - mean) ** 2, 0) / n
      stats.mean = mean
      stats.std = Math.sqrt(variance)
    }
  }

  // 3. Compute z-scores per score entry
  const zScores = new Map<string, Map<string, number[]>>() // projectId → criterionId → z[]

  for (const s of allScores) {
    const critMap = judgeStats.get(s.judgeId)
    const stats = critMap?.get(s.criterionId)
    let z = 0
    if (stats && stats.std > 0) {
      z = (s.score - stats.mean) / stats.std
    }
    // if std === 0, z = 0 (judge provides no discriminating information)

    if (!zScores.has(s.projectId)) zScores.set(s.projectId, new Map())
    const projCrit = zScores.get(s.projectId)!
    if (!projCrit.has(s.criterionId)) projCrit.set(s.criterionId, [])
    projCrit.get(s.criterionId)!.push(z)
  }

  // 4. Compute weighted score per project
  const rawScores = new Map<string, Map<string, number[]>>()
  for (const s of allScores) {
    if (!rawScores.has(s.projectId)) rawScores.set(s.projectId, new Map())
    const projCrit = rawScores.get(s.projectId)!
    if (!projCrit.has(s.criterionId)) projCrit.set(s.criterionId, [])
    projCrit.get(s.criterionId)!.push(s.score)
  }

  const results: { projectId: string; normalizedScore: number; rawWeightedAvg: number; judgeCount: number }[] = []

  for (const [projectId, critMap] of zScores) {
    let weightedScore = 0
    let rawWeightedSum = 0
    let judgeCount = 0
    const rawCritMap = rawScores.get(projectId)

    for (const criterion of criteria) {
      const zList = critMap.get(criterion.id) ?? []
      judgeCount = Math.max(judgeCount, zList.length)
      const meanZ = zList.length > 0 ? zList.reduce((a, b) => a + b, 0) / zList.length : 0
      weightedScore += criterion.weight * meanZ

      const sList = rawCritMap?.get(criterion.id) ?? []
      const meanRaw = sList.length > 0 ? sList.reduce((a, b) => a + b, 0) / sList.length : 0
      rawWeightedSum += criterion.weight * meanRaw
    }

    results.push({ 
      projectId, 
      normalizedScore: Number(weightedScore.toFixed(4)), 
      rawWeightedAvg: Number(rawWeightedSum.toFixed(2)), 
      judgeCount 
    })
  }

  // 5. Write to score cache
  const now = new Date()
  for (const r of results) {
    await prisma.scoreCache.upsert({
      where: { eventId_projectId: { eventId, projectId: r.projectId } },
      create: { 
        eventId, 
        projectId: r.projectId, 
        normalizedScore: r.normalizedScore, 
        rawWeightedAvg: r.rawWeightedAvg,
        judgeCount: r.judgeCount, 
        computedAt: now 
      },
      update: { 
        normalizedScore: r.normalizedScore, 
        rawWeightedAvg: r.rawWeightedAvg,
        judgeCount: r.judgeCount, 
        computedAt: now 
      },
    })
  }

  return results
}

/**
 * Get normalized leaderboard (public after results_published_at).
 */
export async function getLeaderboard(eventId: string) {
  return prisma.scoreCache.findMany({
    where: { eventId },
    include: {
      project: {
        select: {
          id: true,
          title: true,
          tagline: true,
          coverUrl: true,
          team: { select: { name: true } },
          track: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { normalizedScore: 'desc' },
  })
}

// ─── JUDGE ASSIGNMENT ────────────────────────────────────────────────────────

/**
 * Round-robin assignment: distribute projects evenly across judges.
 * Each project gets at most `reviewsPerProject` judges.
 */
export async function assignJudgesRoundRobin(
  eventId: string,
  assignedBy: string,
  reviewsPerProject = 3
) {
  const judges = await prisma.eventRole.findMany({
    where: { eventId, role: 'judge' },
    select: { userId: true },
  })

  const projects = await prisma.project.findMany({
    where: { eventId, status: 'submitted' },
    select: { id: true },
  })

  if (judges.length === 0 || projects.length === 0) return 0

  let assignmentCount = 0
  const judgeIds = judges.map((j: { userId: string }) => j.userId)

  for (let i = 0; i < projects.length; i++) {
    const project = projects[i]
    const assignedJudges = new Set<string>()

    for (let r = 0; r < reviewsPerProject && r < judgeIds.length; r++) {
      const judgeId = judgeIds[(i + r) % judgeIds.length]
      if (assignedJudges.has(judgeId)) continue
      assignedJudges.add(judgeId)

      await prisma.judgeAssignment.upsert({
        where: { judgeId_projectId: { judgeId, projectId: project.id } },
        create: { judgeId, projectId: project.id, eventId, assignedBy },
        update: {},
      })
      assignmentCount++
    }
  }

  return assignmentCount
}

import { getCurrentUser, getUserEventRole, isAssignedJudge } from '@/lib/auth'
import {
  getMyScoresForProject,
  upsertScore,
  markAssignmentComplete,
} from '@/lib/judging.dal'
import { logAudit, ok, err, unauthorized, forbidden } from '@/lib/utils'

/**
 * GET /api/events/[eventId]/projects/[projectId]/scores
 * 
 * Returns ONLY the authenticated judge's scores for this project.
 * judgeId comes from session — never from URL or body.
 * Organizers get aggregated data via a separate endpoint.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventId: string; projectId: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return unauthorized()

  const { eventId, projectId } = await params
  const role = await getUserEventRole(user.id, eventId)

  if (role === 'judge') {
    // Judges see only their own scores — enforced in DAL
    const scores = await getMyScoresForProject(user.id, projectId)
    return ok({ scores, judgeId: user.id })
  }

  if (role === 'organizer' || role === 'admin') {
    // Organizers get aggregated only — redirect them to the summary endpoint
    return err('Use /api/events/[eventId]/scores/summary for organizer data', 400)
  }

  return forbidden()
}

/**
 * POST /api/events/[eventId]/projects/[projectId]/scores
 * 
 * Submit or update a score. Only assigned judges can score a project.
 * judgeId is taken from session, never from body.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string; projectId: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return unauthorized()

  const { eventId, projectId } = await params
  const role = await getUserEventRole(user.id, eventId)

  if (role !== 'judge' && role !== 'admin') return forbidden()

  // Verify judge is assigned to this project
  const assigned = await isAssignedJudge(user.id, projectId)
  if (!assigned && role !== 'admin') {
    return err('You are not assigned to review this project', 403)
  }

  const { criterionId, score, note } = await request.json()

  if (score === undefined || score === null) return err('Score is required')
  if (typeof score !== 'number' || score < 0 || score > 5) {
    return err('Score must be a number between 0 and 5')
  }

  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded ? forwarded.split(',')[0].trim() : undefined

  const savedScore = await upsertScore(
    user.id, // ← always from session
    projectId,
    criterionId,
    eventId,
    score,
    note
  )

  await logAudit({
    userId: user.id,
    action: 'SCORE_SUBMIT',
    entityType: 'judge_score',
    entityId: savedScore.id,
    eventId,
    newValue: { projectId, criterionId, score, note },
    ipAddress: ip,
  })

  return ok({ score: savedScore })
}

/**
 * PATCH /api/events/[eventId]/projects/[projectId]/scores/complete
 * Marks the judge's assignment as complete for this project.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ eventId: string; projectId: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return unauthorized()

  const { eventId, projectId } = await params
  const role = await getUserEventRole(user.id, eventId)
  if (role !== 'judge' && role !== 'admin') return forbidden()

  await markAssignmentComplete(user.id, projectId)

  await logAudit({
    userId: user.id,
    action: 'ASSIGNMENT_COMPLETE',
    entityType: 'judge_assignment',
    entityId: `${user.id}:${projectId}`,
    eventId,
  })

  return ok({ message: 'Assignment marked complete' })
}

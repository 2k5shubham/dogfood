import { getCurrentUser, canOrganize } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { assignJudgesRoundRobin, getMyAssignments } from '@/lib/judging.dal'
import { logAudit, ok, err, unauthorized, forbidden } from '@/lib/utils'
import { hashPassword } from '@/lib/auth'
import crypto from 'crypto'

// GET /api/events/[eventId]/judges — judge gets own assignments
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return unauthorized()

  const { eventId } = await params

  const assignments = await getMyAssignments(user.id, eventId)
  return ok({ assignments })
}

// POST /api/events/[eventId]/judges — organizer invites judges (batch or single)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return unauthorized()

  const { eventId } = await params
  const allowed = await canOrganize(user.id, eventId)
  if (!allowed) return forbidden()

  const body = await request.json()
  // body: { judges: [{ email, name }] } or { action: 'assign', reviewsPerProject: 3 }

  if (body.action === 'assign') {
    const count = await assignJudgesRoundRobin(eventId, user.id, body.reviewsPerProject ?? 3)
    await logAudit({
      userId: user.id,
      action: 'JUDGES_ASSIGNED',
      entityType: 'event',
      entityId: eventId,
      eventId,
      newValue: { assignmentCount: count },
    })
    return ok({ assignmentCount: count })
  }

  // Batch invite
  const judges: { email: string; name: string }[] = body.judges ?? []
  if (judges.length === 0) return err('Provide judges array or action: assign')

  const results = []
  for (const j of judges) {
    // Create account if not exists
    let judgeUser = await prisma.user.findUnique({ where: { email: j.email.toLowerCase() } })
    const tempPassword = crypto.randomBytes(10).toString('hex')

    if (!judgeUser) {
      judgeUser = await prisma.user.create({
        data: {
          email: j.email.toLowerCase(),
          displayName: j.name || j.email,
          passwordHash: await hashPassword(tempPassword),
        },
      })
    }

    await prisma.eventRole.upsert({
      where: { userId_eventId: { userId: judgeUser.id, eventId } },
      create: { userId: judgeUser.id, eventId, role: 'judge', invitedBy: user.id, acceptedAt: new Date() },
      update: { role: 'judge' },
    })

    // In production, send email. For self-hosted: log the temp password
    results.push({
      email: j.email,
      userId: judgeUser.id,
      tempPassword: judgeUser ? undefined : tempPassword,
      loginUrl: `${process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'}/login`,
    })

    await logAudit({
      userId: user.id,
      action: 'JUDGE_INVITE',
      entityType: 'event_role',
      entityId: `${judgeUser.id}:${eventId}`,
      eventId,
      newValue: { judgeEmail: j.email },
    })
  }

  return ok({ invited: results }, 201)
}

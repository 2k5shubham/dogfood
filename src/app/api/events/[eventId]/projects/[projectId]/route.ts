import { getCurrentUser, getUserEventRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logAudit, ok, err, unauthorized, forbidden, notFound } from '@/lib/utils'

// GET /api/events/[eventId]/projects/[projectId]
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ eventId: string; projectId: string }> }
) {
  const { projectId } = await params

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      team: { include: { members: { include: { user: { select: { id: true, displayName: true, avatarUrl: true } } } } } },
      track: true,
      comments: {
        where: { isDeleted: false },
        include: { user: { select: { id: true, displayName: true, avatarUrl: true } } },
        orderBy: { createdAt: 'asc' },
      },
      _count: { select: { userVotes: true, comments: true } },
    },
  })

  if (!project) return notFound('Project')
  return ok({ project })
}

// PUT /api/events/[eventId]/projects/[projectId] — edit (only before deadline)
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ eventId: string; projectId: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return unauthorized()

  const { eventId, projectId } = await params

  const [project, event] = await Promise.all([
    prisma.project.findUnique({ where: { id: projectId }, include: { team: { include: { members: true } } } }),
    prisma.event.findUnique({ where: { id: eventId }, select: { submissionDeadline: true } }),
  ])

  if (!project) return notFound('Project')
  if (!event) return notFound('Event')

  // Only team members or organizers can edit
  const isTeamMember = project.team.members.some((m) => m.userId === user.id)
  const role = await getUserEventRole(user.id, eventId)
  if (!isTeamMember && role !== 'organizer' && role !== 'admin') return forbidden()

  // Deadline enforcement — in DAL, not UI
  if (project.status === 'submitted' && new Date() > event.submissionDeadline) {
    return err('Submission deadline has passed. No further edits allowed.', 403)
  }

  const { title, tagline, description, repoUrl, demoUrl, videoUrl, trackId } = await request.json()

  const updated = await prisma.project.update({
    where: { id: projectId },
    data: {
      ...(title && { title }),
      ...(tagline !== undefined && { tagline }),
      ...(description && { description }),
      ...(repoUrl !== undefined && { repoUrl }),
      ...(demoUrl !== undefined && { demoUrl }),
      ...(videoUrl !== undefined && { videoUrl }),
      ...(trackId !== undefined && { trackId }),
    },
  })

  return ok({ project: updated })
}

// POST /api/events/[eventId]/projects/[projectId]/submit — lock submission
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ eventId: string; projectId: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return unauthorized()

  const { eventId, projectId } = await params

  const [project, event] = await Promise.all([
    prisma.project.findUnique({ where: { id: projectId }, include: { team: { include: { members: true } } } }),
    prisma.event.findUnique({ where: { id: eventId }, select: { submissionDeadline: true } }),
  ])

  if (!project) return notFound('Project')
  if (!event) return notFound('Event')

  if (new Date() > event.submissionDeadline) {
    return err('Submission deadline has passed', 403)
  }

  const isTeamMember = project.team.members.some((m) => m.userId === user.id)
  if (!isTeamMember) return forbidden()

  if (!project.title || !project.description) {
    return err('Project must have title and description before submitting')
  }

  const updated = await prisma.project.update({
    where: { id: projectId },
    data: { status: 'submitted', submittedAt: new Date() },
  })

  await logAudit({
    userId: user.id,
    action: 'PROJECT_SUBMIT',
    entityType: 'project',
    entityId: projectId,
    eventId,
    newValue: { title: project.title },
  })

  return ok({ project: updated })
}

import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ok, err, unauthorized, notFound } from '@/lib/utils'

// GET /api/events/[eventId]/projects/[projectId]/comments
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ eventId: string; projectId: string }> }
) {
  const { projectId } = await params

  const comments = await prisma.comment.findMany({
    where: { projectId, isDeleted: false },
    include: {
      user: {
        select: { id: true, displayName: true, avatarUrl: true, globalRole: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  return ok({ comments })
}

// POST /api/events/[eventId]/projects/[projectId]/comments
export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string; projectId: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return unauthorized()

  const { projectId } = await params
  const { content } = await request.json()

  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    return err('Comment cannot be empty')
  }

  if (content.length > 2000) {
    return err('Comment is too long (max 2000 characters)')
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true },
  })
  if (!project) return notFound('Project')

  const comment = await prisma.comment.create({
    data: {
      projectId,
      userId: user.id,
      content: content.trim(),
    },
    include: {
      user: {
        select: { id: true, displayName: true, avatarUrl: true, globalRole: true },
      },
    },
  })

  return ok({ comment }, 201)
}

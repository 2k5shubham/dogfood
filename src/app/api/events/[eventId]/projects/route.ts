import { getCurrentUser, getUserEventRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ok, err, unauthorized, forbidden, notFound } from '@/lib/utils'
import crypto from 'crypto'

// GET /api/events/[eventId]/projects — public gallery with search/filter
export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q') ?? ''
  const trackId = searchParams.get('track')
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '12'), 50)
  const skip = (page - 1) * limit

  const where = {
    eventId,
    status: 'submitted' as const,
    ...(trackId && { trackId }),
    ...(q && {
      OR: [
        { title: { contains: q, mode: 'insensitive' as const } },
        { tagline: { contains: q, mode: 'insensitive' as const } },
        { description: { contains: q, mode: 'insensitive' as const } },
      ],
    }),
  }

  const [projects, total] = await Promise.all([
    prisma.project.findMany({
      where,
      select: {
        id: true, title: true, tagline: true, coverUrl: true, status: true,
        submittedAt: true, repoUrl: true, demoUrl: true,
        team: { select: { id: true, name: true } },
        track: { select: { id: true, name: true } },
        _count: { select: { comments: true, userVotes: true } },
      },
      orderBy: { submittedAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.project.count({ where }),
  ])

  return ok({ projects, total, page, pages: Math.ceil(total / limit) })
}

// POST /api/events/[eventId]/projects — create project (draft)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return unauthorized()

  const { eventId } = await params

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { submissionDeadline: true, submissionOpensAt: true, status: true },
  })
  if (!event) return notFound('Event')

  const role = await getUserEventRole(user.id, eventId)
  if (!role || role === 'judge') return forbidden()

  // Find user's team in this event
  const teamMembership = await prisma.teamMember.findFirst({
    where: { userId: user.id, team: { eventId } },
    include: { team: true },
  })
  if (!teamMembership) return err('You must be in a team to submit a project')

  // Check one project per team
  const existing = await prisma.project.findUnique({
    where: { teamId_eventId: { teamId: teamMembership.teamId, eventId } },
  })
  if (existing) return err('Your team already has a project for this event', 409)

  const { title, tagline, description, repoUrl, demoUrl, videoUrl, trackId } = await request.json()
  if (!title || !description) return err('title and description are required')

  // Duplicate repo detection
  let repoHash: string | undefined
  if (repoUrl) {
    const normalized = repoUrl.toLowerCase().trim().replace(/\/+$/, '').replace(/\.git$/, '')
    repoHash = crypto.createHash('sha1').update(normalized).digest('hex')
    const dup = await prisma.project.findFirst({ where: { repoHash, eventId } })
    if (dup) return err('A project with this repository URL already exists', 409)
  }

  const project = await prisma.project.create({
    data: {
      teamId: teamMembership.teamId,
      eventId,
      ownerId: user.id,
      title,
      tagline,
      description,
      repoUrl,
      demoUrl,
      videoUrl,
      trackId,
      repoHash,
      status: 'draft',
    },
  })

  return ok({ project }, 201)
}

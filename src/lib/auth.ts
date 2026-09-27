import { cookies } from 'next/headers'
import { prisma } from './prisma'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

const SESSION_COOKIE = 'dogfood_session'
const SESSION_EXPIRY_DAYS = 7

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export async function createSession(
  userId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<string> {
  const token = crypto.randomUUID() + crypto.randomUUID()
  const tokenHash = hashToken(token)
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + SESSION_EXPIRY_DAYS)

  await prisma.session.create({
    data: { userId, tokenHash, ipAddress, userAgent, expiresAt },
  })

  return token
}

export async function getSessionUser(token: string) {
  const tokenHash = hashToken(token)
  const session = await prisma.session.findFirst({
    where: { tokenHash, expiresAt: { gt: new Date() } },
    include: { user: true },
  })
  return session?.user ?? null
}

export async function deleteSession(token: string): Promise<void> {
  const tokenHash = hashToken(token)
  await prisma.session.deleteMany({ where: { tokenHash } })
}

/** Read session from cookies (Server Components / Route Handlers) */
export async function getCurrentUser() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) return null
  return getSessionUser(token)
}

/** Set session cookie */
export async function setSessionCookie(token: string) {
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_EXPIRY_DAYS * 24 * 60 * 60,
    path: '/',
  })
}

/** Clear session cookie */
export async function clearSessionCookie() {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE)
}

/** Get user's role in a specific event */
export async function getUserEventRole(
  userId: string,
  eventId: string
): Promise<string | null> {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (user?.globalRole === 'admin') return 'admin'

  const role = await prisma.eventRole.findUnique({
    where: { userId_eventId: { userId, eventId } },
  })
  return role?.role ?? null
}

/** Check if user can organize an event */
export async function canOrganize(userId: string, eventId: string): Promise<boolean> {
  const role = await getUserEventRole(userId, eventId)
  return role === 'organizer' || role === 'admin'
}

/** Check if user is assigned as judge to a specific project */
export async function isAssignedJudge(userId: string, projectId: string): Promise<boolean> {
  const assignment = await prisma.judgeAssignment.findUnique({
    where: { judgeId_projectId: { judgeId: userId, projectId } },
  })
  return !!assignment
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE

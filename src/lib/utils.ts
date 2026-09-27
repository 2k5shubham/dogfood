import { prisma } from './prisma'

// ─── AUDIT LOG ────────────────────────────────────────────────────────────────

export async function logAudit(params: {
  userId?: string
  action: string
  entityType: string
  entityId: string
  eventId?: string
  oldValue?: unknown
  newValue?: unknown
  ipAddress?: string
  userAgent?: string
}) {
  await prisma.auditLog.create({
    data: {
      userId: params.userId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      eventId: params.eventId,
      oldValueJson: params.oldValue ? (params.oldValue as object) : undefined,
      newValueJson: params.newValue ? (params.newValue as object) : undefined,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    },
  })
}

// ─── API HELPERS ─────────────────────────────────────────────────────────────

export function ok<T>(data: T, status = 200): Response {
  return Response.json({ success: true, data }, { status })
}

export function err(message: string, status = 400): Response {
  return Response.json({ success: false, error: message }, { status })
}

export function unauthorized(): Response {
  return err('Unauthorized', 401)
}

export function forbidden(): Response {
  return err('Forbidden', 403)
}

export function notFound(resource = 'Resource'): Response {
  return err(`${resource} not found`, 404)
}

// ─── RATE LIMITING (in-memory, suitable for single-instance) ─────────────────

const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

export function rateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; remaining: number } {
  const now = Date.now()
  const entry = rateLimitMap.get(key)

  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: maxRequests - 1 }
  }

  entry.count++
  if (entry.count > maxRequests) {
    return { allowed: false, remaining: 0 }
  }

  return { allowed: true, remaining: maxRequests - entry.count }
}

// ─── DUPLICATE DETECTION ─────────────────────────────────────────────────────

import crypto from 'crypto'

export function repoUrlHash(repoUrl: string): string {
  // Normalize: lowercase, strip trailing slashes, strip .git
  const normalized = repoUrl
    .toLowerCase()
    .trim()
    .replace(/\/+$/, '')
    .replace(/\.git$/, '')
  return crypto.createHash('sha1').update(normalized).digest('hex')
}

// ─── QUADRATIC VOTING MATH ───────────────────────────────────────────────────

/** Cost (in credits) to cast k votes */
export function quadraticCost(votes: number): number {
  return votes * votes
}

/** Maximum votes purchasable with remaining credits */
export function maxVotesWith(currentVotes: number, creditsRemaining: number): number {
  const currentCost = quadraticCost(currentVotes)
  let k = currentVotes
  while (quadraticCost(k + 1) - currentCost <= creditsRemaining) k++
  return k
}

/** Credit delta when changing from oldVotes to newVotes */
export function creditDelta(oldVotes: number, newVotes: number): number {
  return quadraticCost(newVotes) - quadraticCost(oldVotes)
}

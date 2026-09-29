import { ok } from '@/lib/utils'

/**
 * Legacy token voting request route.
 * Replaced by account-bound community voting with anti-Sybil guarantees.
 */
export async function POST() {
  return ok({
    message: 'Token voting is deprecated. Dogfood now uses account-bound voting with anti-Sybil protection at /vote/[eventId].',
  })
}

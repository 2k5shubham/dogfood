const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

async function main() {
  // Open voting now for demo
  const event = await p.event.update({
    where: { slug: 'dogfood-2026' },
    data: {
      votingOpensAt: new Date('2026-09-01T00:00:00Z'), // past - voting is open
      status: 'voting'
    },
    select: { id: true, status: true, votingOpensAt: true, votingDeadline: true }
  })
  console.log('Updated event:', JSON.stringify(event, null, 2))
}

main().finally(() => p.$disconnect())

const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')
const crypto = require('crypto')

const prisma = new PrismaClient()

async function hash(password) {
  return bcrypt.hash(password, 12)
}

async function main() {
  console.log('🌱 Seeding database...')

  // Admin user
  const admin = await prisma.user.upsert({
    where: { email: 'admin@dogfood.dev' },
    update: {},
    create: {
      email: 'admin@dogfood.dev',
      displayName: 'Admin',
      passwordHash: await hash('password123'),
      globalRole: 'admin',
    },
  })
  console.log(`✓ Admin: admin@dogfood.dev / password123`)

  // Organizer
  const organizer = await prisma.user.upsert({
    where: { email: 'organizer@dogfood.dev' },
    update: {},
    create: {
      email: 'organizer@dogfood.dev',
      displayName: 'Event Organizer',
      passwordHash: await hash('password123'),
    },
  })

  // Judge accounts
  const judges = []
  for (let i = 1; i <= 5; i++) {
    const judge = await prisma.user.upsert({
      where: { email: `judge${i}@dogfood.dev` },
      update: {},
      create: {
        email: `judge${i}@dogfood.dev`,
        displayName: `Judge ${i}`,
        passwordHash: await hash('password123'),
      },
    })
    judges.push(judge)
  }
  console.log(`✓ Judges: judge1-5@dogfood.dev / password123`)

  // Test participants
  const participants = []
  for (let i = 1; i <= 8; i++) {
    const p = await prisma.user.upsert({
      where: { email: `team${i}@dogfood.dev` },
      update: {},
      create: {
        email: `team${i}@dogfood.dev`,
        displayName: `Team ${i} Lead`,
        passwordHash: await hash('password123'),
      },
    })
    participants.push(p)
  }

  // Create demo event
  const existing = await prisma.event.findFirst({ where: { slug: { startsWith: 'dogfood-2026' } } })
  if (existing) { console.log('✓ Event already exists, skipping'); return }

  const event = await prisma.event.create({
    data: {
      slug: 'dogfood-2026',
      title: 'DOGFOOD Hackathon 2026',
      description: 'Build the future of hackathon platforms.',
      organizerId: organizer.id,
      registrationOpensAt: new Date('2026-08-24'),
      submissionOpensAt: new Date('2026-09-25T18:00:00Z'),
      submissionDeadline: new Date('2026-09-28T18:00:00Z'),
      votingOpensAt: new Date('2026-09-28T18:00:00Z'),
      votingDeadline: new Date('2026-10-05T18:00:00Z'),
      status: 'active',
    },
  })

  // Organizer role
  await prisma.eventRole.upsert({
    where: { userId_eventId: { userId: organizer.id, eventId: event.id } },
    update: {},
    create: { userId: organizer.id, eventId: event.id, role: 'organizer', acceptedAt: new Date() },
  })

  // Tracks
  const trackData = [
    { name: 'AI/ML', description: 'Artificial intelligence and machine learning', prizeAmount: 500, order: 0 },
    { name: 'Web3', description: 'Blockchain and decentralized applications', prizeAmount: 400, order: 1 },
    { name: 'DevTools', description: 'Developer productivity tools', prizeAmount: 350, order: 2 },
    { name: 'Open Source', description: 'Open source contributions', prizeAmount: 250, order: 3 },
  ]
  const tracks = await Promise.all(
    trackData.map((t) => prisma.track.create({ data: { ...t, eventId: event.id } }))
  )
  console.log(`✓ Created ${tracks.length} tracks`)

  // Rubric criteria (weights sum to 1.0)
  const criteria = await Promise.all([
    prisma.rubricCriterion.create({ data: { eventId: event.id, name: 'Innovation', description: 'Novelty and creativity of the solution', weight: 0.25, maxScore: 5, order: 0 } }),
    prisma.rubricCriterion.create({ data: { eventId: event.id, name: 'Technical Depth', description: 'Code quality, architecture, and implementation', weight: 0.30, maxScore: 5, order: 1 } }),
    prisma.rubricCriterion.create({ data: { eventId: event.id, name: 'Impact', description: 'Real-world applicability and potential impact', weight: 0.25, maxScore: 5, order: 2 } }),
    prisma.rubricCriterion.create({ data: { eventId: event.id, name: 'Presentation', description: 'Demo quality, documentation, and communication', weight: 0.20, maxScore: 5, order: 3 } }),
  ])
  console.log(`✓ Created rubric with ${criteria.length} criteria`)

  // Judge roles
  for (const judge of judges) {
    await prisma.eventRole.upsert({
      where: { userId_eventId: { userId: judge.id, eventId: event.id } },
      update: {},
      create: { userId: judge.id, eventId: event.id, role: 'judge', acceptedAt: new Date() },
    })
  }

  // Teams + projects
  const projectNames = [
    { title: 'NeuralFlow', tagline: 'Visual AI pipeline builder for non-engineers', track: 0 },
    { title: 'ChainAuth', tagline: 'Decentralized identity verification', track: 1 },
    { title: 'DevPulse', tagline: 'Real-time developer productivity insights', track: 2 },
    { title: 'EcoSync', tagline: 'Carbon footprint tracker for software teams', track: 0 },
    { title: 'OpenDocs', tagline: 'AI-powered open source documentation generator', track: 3 },
    { title: 'MeshVPN', tagline: 'Zero-config peer-to-peer VPN', track: 2 },
  ]

  const teams = []
  for (let i = 0; i < Math.min(participants.length, projectNames.length); i++) {
    const p = participants[i]
    const proj = projectNames[i]
    const inviteCode = crypto.randomBytes(5).toString('hex').toUpperCase()

    const team = await prisma.team.create({
      data: {
        eventId: event.id,
        name: `Team ${proj.title}`,
        inviteCode,
        createdById: p.id,
        members: { create: { userId: p.id, role: 'lead' } },
      },
    })
    teams.push(team)

    await prisma.eventRole.upsert({
      where: { userId_eventId: { userId: p.id, eventId: event.id } },
      update: {},
      create: { userId: p.id, eventId: event.id, role: 'participant', acceptedAt: new Date() },
    })

    await prisma.project.create({
      data: {
        teamId: team.id,
        eventId: event.id,
        ownerId: p.id,
        trackId: tracks[proj.track].id,
        title: proj.title,
        tagline: proj.tagline,
        description: `${proj.title} is a hackathon project that ${proj.tagline.toLowerCase()}. Built with modern technologies during the DOGFOOD 2026 hackathon.`,
        repoUrl: `https://github.com/team-${proj.title.toLowerCase()}/project`,
        status: 'submitted',
        submittedAt: new Date(),
      },
    })
  }
  console.log(`✓ Created ${teams.length} teams and projects`)

  // Assign judges round-robin (3 reviews per project)
  const submittedProjects = await prisma.project.findMany({ where: { eventId: event.id, status: 'submitted' } })
  let assignCount = 0
  for (let i = 0; i < submittedProjects.length; i++) {
    for (let r = 0; r < 3 && r < judges.length; r++) {
      const judgeId = judges[(i + r) % judges.length].id
      await prisma.judgeAssignment.upsert({
        where: { judgeId_projectId: { judgeId, projectId: submittedProjects[i].id } },
        update: {},
        create: { judgeId, projectId: submittedProjects[i].id, eventId: event.id, assignedBy: organizer.id },
      })
      assignCount++
    }
  }
  console.log(`✓ Created ${assignCount} judge assignments`)

  // Seed some scores (fixture edge cases)
  for (let pi = 0; pi < submittedProjects.length; pi++) {
    const project = submittedProjects[pi]
    for (let ji = 0; ji < 3 && ji < judges.length; ji++) {
      const judgeIdx = (pi + ji) % judges.length
      const judge = judges[judgeIdx]
      
      for (const criterion of criteria) {
        // Edge case: Judge 5 (index 4) always scores the same (σ=0 test)
        const score = judgeIdx === 4
          ? 3.0
          : Math.min(5, Math.max(0, parseFloat((Math.random() * 4 + 1).toFixed(1))))

        await prisma.judgeScore.upsert({
          where: { judgeId_projectId_criterionId: { judgeId: judge.id, projectId: project.id, criterionId: criterion.id } },
          update: {},
          create: {
            judgeId: judge.id,
            projectId: project.id,
            criterionId: criterion.id,
            eventId: event.id,
            score,
            note: `Evaluation of ${criterion.name}`,
          },
        })
      }

      await prisma.judgeAssignment.updateMany({
        where: { judgeId: judge.id, projectId: project.id },
        data: { completedAt: new Date() },
      })
    }
  }
  console.log(`✓ Seeded judge scores (including σ=0 edge case for Judge 5)`)

  console.log('\n✅ Seed complete!')
  console.log('   Admin:     admin@dogfood.dev / password123')
  console.log('   Organizer: organizer@dogfood.dev / password123')
  console.log('   Judges:    judge1-5@dogfood.dev / password123')
  console.log('   Teams:     team1-6@dogfood.dev / password123')
  console.log(`   Event:     http://localhost:3000 (slug: dogfood-2026)`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())

async function test() {
  const BASE = 'http://localhost:3001'

  // 1. Get active event
  const evRes = await fetch(`${BASE}/api/events?status=active&limit=1`)
  const evData = await evRes.json()
  const event = evData.data?.events?.[0]
  console.log('Active event:', event.id, event.title)

  // 2. Login as organizer
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'organizer@dogfood.dev', password: 'password123' })
  })
  const setCookie = loginRes.headers.get('set-cookie')
  console.log('Organizer logged in:', loginRes.status, 'Cookie present:', !!setCookie)

  // 3. Trigger normalization
  const normRes = await fetch(`${BASE}/api/events/${event.id}/scores/summary`, {
    method: 'POST',
    headers: { Cookie: setCookie || '' }
  })
  const normData = await normRes.json()
  console.log('Normalization result:', normData)

  // 4. Fetch summary
  const sumRes = await fetch(`${BASE}/api/events/${event.id}/scores/summary`, {
    headers: { Cookie: setCookie || '' }
  })
  const sumData = await sumRes.json()
  console.log('Judging progress:', sumData.data?.progress)

  // 5. Publish results
  const pubRes = await fetch(`${BASE}/api/events/${event.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: setCookie || '' },
    body: JSON.stringify({ resultsPublishedAt: new Date().toISOString(), status: 'closed' })
  })
  const pubData = await pubRes.json()
  console.log('Results published status:', pubRes.status, pubData)

  // 6. Check public leaderboard
  const lbRes = await fetch(`${BASE}/api/events/${event.id}/leaderboard`)
  const lbData = await lbRes.json()
  console.log('Public Leaderboard Published?', lbData.data?.event?.resultsPublished)
  console.log('Rankings:')
  lbData.data?.leaderboard?.forEach((p) => {
    console.log(`  #${p.rank} ${p.title} (${p.teamName}) — Normalized Z: ${p.normalizedScore}, Raw: ${p.rawWeightedAvg}/5, Votes: ${p.communityVotes}`)
  })
}

test().catch(console.error)

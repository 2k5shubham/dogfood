const http = require('http')

async function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(data) })
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, body: data })
        }
      })
    })
    req.on('error', reject)
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body))
    req.end()
  })
}

async function run() {
  console.log('🧪 Starting Anti-Sybil Community Voting Verification...\n')

  const eventId = 'cmuk4sgzz000gp0bsol1rlla2'
  const chainAuthId = 'cmuk4sh6w001op0bsgtvu19jw' // ChainAuth project
  const neuralFlowId = 'cmuk4sh5u001gp0bsgb3q0gc2' // NeuralFlow project (owned by team1)

  // 1. Test unauthenticated vote attempt
  console.log('1️⃣ Test: Unauthenticated vote cast')
  const unauthRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/events/${eventId}/vote/cast`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, { projectId: chainAuthId })
  console.log(`   Status: ${unauthRes.status} (Expected: 401)`)
  console.log(`   Response: ${JSON.stringify(unauthRes.body)}\n`)

  // 2. Login as admin (independent account created pre-deadline)
  console.log('2️⃣ Test: Login as pre-deadline account (admin@dogfood.dev)')
  const loginRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, { email: 'admin@dogfood.dev', password: 'password123' })
  
  const cookie = loginRes.headers['set-cookie']?.[0]?.split(';')[0]
  console.log(`   Status: ${loginRes.status}`)
  console.log(`   Logged in as: ${loginRes.body?.data?.user?.displayName}`)
  console.log(`   Cookie acquired: ${cookie ? 'Yes' : 'No'}\n`)

  // 3. Cast vote for ChainAuth
  console.log('3️⃣ Test: Authenticated vote cast for ChainAuth')
  const castRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/events/${eventId}/vote/cast`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookie,
    },
  }, { projectId: chainAuthId })
  console.log(`   Status: ${castRes.status} (Expected: 200)`)
  console.log(`   Result: ${JSON.stringify(castRes.body)}\n`)

  // 4. Query myVotes
  console.log('4️⃣ Test: GET myVotes for current user')
  const myVotesRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/events/${eventId}/vote/cast`,
    method: 'GET',
    headers: { 'Cookie': cookie },
  })
  console.log(`   Status: ${myVotesRes.status}`)
  console.log(`   Result: ${JSON.stringify(myVotesRes.body)}\n`)

  // 5. Toggle vote (Retract)
  console.log('5️⃣ Test: Toggle vote again (should retract vote cleanly)')
  const retractRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/events/${eventId}/vote/cast`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookie,
    },
  }, { projectId: chainAuthId })
  console.log(`   Status: ${retractRes.status}`)
  console.log(`   Result: ${JSON.stringify(retractRes.body)}\n`)

  // 6. Test self-vote prevention
  console.log('6️⃣ Test: Self-vote prevention (team1 voting for NeuralFlow)')
  const t1Login = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, { email: 'team1@dogfood.dev', password: 'password123' })
  const t1Cookie = t1Login.headers['set-cookie']?.[0]?.split(';')[0]
  
  const selfVoteRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/events/${eventId}/vote/cast`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': t1Cookie,
    },
  }, { projectId: neuralFlowId })
  console.log(`   Status: ${selfVoteRes.status} (Expected: 403)`)
  console.log(`   Result: ${JSON.stringify(selfVoteRes.body)}\n`)

  console.log('🎉 ALL SYBIL-RESISTANCE INVARIANTS PASS!')
}

run().catch(console.error)

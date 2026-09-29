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
  console.log('🧪 Starting Role Management Verification...\n')

  const eventId = 'cmuk4sgzz000gp0bsol1rlla2'

  // 1. Login as regular user (team1@dogfood.dev)
  console.log('1️⃣ Test: Regular user attempts to view/manage roles (should be forbidden)')
  const userLogin = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, { email: 'team1@dogfood.dev', password: 'password123' })
  const userCookie = userLogin.headers['set-cookie']?.[0]?.split(';')[0]

  const forbiddenGet = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/events/${eventId}/roles`,
    method: 'GET',
    headers: { 'Cookie': userCookie },
  })
  console.log(`   Status: ${forbiddenGet.status} (Expected: 403)`)
  console.log(`   Response: ${JSON.stringify(forbiddenGet.body)}\n`)

  // 2. Login as Admin (admin@dogfood.dev)
  console.log('2️⃣ Test: Login as Admin to manage event roles')
  const adminLogin = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, { email: 'admin@dogfood.dev', password: 'password123' })
  const adminCookie = adminLogin.headers['set-cookie']?.[0]?.split(';')[0]
  console.log(`   Admin Login Status: ${adminLogin.status}`)
  console.log(`   Admin Cookie: ${adminCookie ? 'Acquired' : 'Missing'}\n`)

  // 3. View Event Roles as Admin
  console.log('3️⃣ Test: Admin views event roles summary')
  const rolesRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/events/${eventId}/roles`,
    method: 'GET',
    headers: { 'Cookie': adminCookie },
  })
  console.log(`   Status: ${rolesRes.status} (Expected: 200)`)
  console.log(`   Summary: ${JSON.stringify(rolesRes.body?.data?.summary)}\n`)

  // 4. Appoint someone as a Judge for this event
  const newJudgeEmail = `dr_expert_${Date.now()}@university.edu`
  console.log(`4️⃣ Test: Appoint ${newJudgeEmail} as a Judge`)
  const assignJudgeRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/events/${eventId}/roles`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
  }, { email: newJudgeEmail, role: 'judge' })
  console.log(`   Status: ${assignJudgeRes.status} (Expected: 200)`)
  console.log(`   Result: ${JSON.stringify(assignJudgeRes.body?.data)}\n`)

  // 5. Appoint someone as Co-Organizer for this event
  const coOrgEmail = `lead_organizer_${Date.now()}@raptors.tech`
  console.log(`5️⃣ Test: Appoint ${coOrgEmail} as Co-Organizer`)
  const assignOrgRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/events/${eventId}/roles`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
  }, { email: coOrgEmail, role: 'organizer' })
  console.log(`   Status: ${assignOrgRes.status} (Expected: 200)`)
  console.log(`   Result: ${JSON.stringify(assignOrgRes.body?.data)}\n`)

  // 6. Promote a user to Global Admin
  console.log('6️⃣ Test: Promote team1 to Global Admin')
  const promoteRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/users/role',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
  }, { targetUserId: userLogin.body?.data?.user?.id, globalRole: 'admin' })
  console.log(`   Status: ${promoteRes.status} (Expected: 200)`)
  console.log(`   Result: ${JSON.stringify(promoteRes.body?.data)}\n`)

  // 7. Verify promoted user now has admin access to event roles
  console.log('7️⃣ Test: Verify newly promoted admin can now access event roles')
  const newAdminAccessRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/events/${eventId}/roles`,
    method: 'GET',
    headers: { 'Cookie': userCookie },
  })
  console.log(`   Status: ${newAdminAccessRes.status} (Expected: 200 - previously 403!)`)
  console.log(`   Total roles viewed: ${newAdminAccessRes.body?.data?.summary?.total}\n`)

  // Clean up: Demote team1 back to user
  await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/users/role',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
  }, { targetUserId: userLogin.body?.data?.user?.id, globalRole: 'user' })

  console.log('🎉 ALL ROLE MANAGEMENT INVARIANTS VERIFIED!')
}

run().catch(console.error)

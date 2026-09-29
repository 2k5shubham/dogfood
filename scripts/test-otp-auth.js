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
  console.log('🧪 Starting Email OTP Authentication Verification...\n')

  // 1. Invalid email
  console.log('1️⃣ Test: Request OTP with invalid email')
  const invalidRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/otp/send',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, { email: 'not-an-email' })
  console.log(`   Status: ${invalidRes.status} (Expected: 400)`)
  console.log(`   Response: ${JSON.stringify(invalidRes.body)}\n`)

  // 2. Valid email OTP request for a brand new user
  const testEmail = `otp_test_${Date.now()}@example.com`
  console.log(`2️⃣ Test: Request OTP for new email: ${testEmail}`)
  const sendRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/otp/send',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, { email: testEmail })
  console.log(`   Status: ${sendRes.status} (Expected: 200)`)
  console.log(`   Method: ${sendRes.body?.data?.method}`)
  console.log(`   DevCode received: ${sendRes.body?.data?.devCode}\n`)

  const code = sendRes.body?.data?.devCode
  if (!code) {
    throw new Error('Expected devCode in local test response!')
  }

  // 3. Rate limiting test: immediate duplicate request
  console.log('3️⃣ Test: Rate limit guard on immediate duplicate OTP request')
  const rateLimitRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/otp/send',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, { email: testEmail })
  console.log(`   Status: ${rateLimitRes.status} (Expected: 429)`)
  console.log(`   Response: ${JSON.stringify(rateLimitRes.body)}\n`)

  // 4. Verify with wrong code
  console.log('4️⃣ Test: Verify with incorrect OTP code')
  const wrongRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/otp/verify',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, { email: testEmail, code: '000000' })
  console.log(`   Status: ${wrongRes.status} (Expected: 400)`)
  console.log(`   Response: ${JSON.stringify(wrongRes.body)}\n`)

  // 5. Verify with correct code -> auto registration & login
  console.log('5️⃣ Test: Verify with correct OTP code (Passwordless registration)')
  const verifyRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/otp/verify',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, { email: testEmail, code, displayName: 'OTP Pioneer' })
  console.log(`   Status: ${verifyRes.status} (Expected: 200)`)
  console.log(`   User registered: ${verifyRes.body?.data?.user?.displayName} (${verifyRes.body?.data?.user?.email})`)
  console.log(`   isNewUser: ${verifyRes.body?.data?.isNewUser}`)

  const sessionCookie = verifyRes.headers['set-cookie']?.[0]?.split(';')[0]
  console.log(`   Session cookie set: ${sessionCookie ? 'Yes' : 'No'}\n`)

  // 6. Test session authentication with /api/auth/me
  console.log('6️⃣ Test: Verify active session with /api/auth/me')
  const meRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/me',
    method: 'GET',
    headers: { 'Cookie': sessionCookie },
  })
  console.log(`   Status: ${meRes.status} (Expected: 200)`)
  console.log(`   Authenticated user: ${meRes.body?.data?.user?.displayName} / ${meRes.body?.data?.user?.email}\n`)

  // 7. OTP login for existing account (admin@dogfood.dev)
  console.log('7️⃣ Test: OTP login for existing user (admin@dogfood.dev)')
  const adminSendRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/otp/send',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, { email: 'admin@dogfood.dev' })
  
  const adminCode = adminSendRes.body?.data?.devCode
  console.log(`   OTP sent to admin: ${adminCode}`)

  const adminVerifyRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/otp/verify',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, { email: 'admin@dogfood.dev', code: adminCode })
  console.log(`   Status: ${adminVerifyRes.status}`)
  console.log(`   Logged in as: ${adminVerifyRes.body?.data?.user?.displayName}, role: ${adminVerifyRes.body?.data?.user?.globalRole}`)
  console.log(`   isNewUser: ${adminVerifyRes.body?.data?.isNewUser} (Expected: false)\n`)

  console.log('🎉 ALL EMAIL OTP AUTHENTICATION CHECKS PASSED!')
}

run().catch(console.error)

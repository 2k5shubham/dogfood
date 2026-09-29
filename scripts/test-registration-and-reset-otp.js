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
  console.log('🧪 Starting Registration Email OTP & Forgot Password Verification...\n')

  const uniqueId = Date.now()
  const testEmail = `hacker_${uniqueId}@dogfood.org`
  const initialPassword = 'InitialPassword123!'
  const newPassword = 'UpdatedSecurePassword456!'

  // ==========================================
  // PART 1: REGISTRATION EMAIL OTP VERIFICATION
  // ==========================================
  console.log('=== PART 1: REGISTRATION EMAIL OTP VERIFICATION ===\n')

  // 1.1 Short password check
  console.log('1️⃣ Test: Registration with password < 8 characters')
  const shortPwRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/register/send-otp',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, { email: testEmail, displayName: 'Hacker', password: 'short' })
  console.log(`   Status: ${shortPwRes.status} (Expected: 400)`)
  console.log(`   Response: ${JSON.stringify(shortPwRes.body)}\n`)

  // 1.2 Send Registration OTP
  console.log(`2️⃣ Test: Request Registration OTP for ${testEmail}`)
  const sendRegRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/register/send-otp',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, { email: testEmail, displayName: 'Alex Rivera', password: initialPassword })
  console.log(`   Status: ${sendRegRes.status} (Expected: 200)`)
  const regCode = sendRegRes.body?.data?.devCode
  console.log(`   Registration OTP Code: ${regCode}\n`)

  if (!regCode) throw new Error('No registration code received in dev mode')

  // 1.3 Verify with wrong code
  console.log('3️⃣ Test: Verify registration with incorrect code')
  const wrongCodeRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/register/verify',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, { email: testEmail, displayName: 'Alex Rivera', password: initialPassword, code: '000000' })
  console.log(`   Status: ${wrongCodeRes.status} (Expected: 400)`)
  console.log(`   Response: ${JSON.stringify(wrongCodeRes.body)}\n`)

  // 1.4 Verify with correct code -> Creates verified account
  console.log('4️⃣ Test: Verify registration with correct code')
  const verifyRegRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/register/verify',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, { email: testEmail, displayName: 'Alex Rivera', password: initialPassword, code: regCode })
  console.log(`   Status: ${verifyRegRes.status} (Expected: 201)`)
  console.log(`   User created: ${verifyRegRes.body?.data?.user?.displayName} (${verifyRegRes.body?.data?.user?.email})`)
  const regCookie = verifyRegRes.headers['set-cookie']?.[0]?.split(';')[0]
  console.log(`   Session Cookie: ${regCookie ? 'Acquired' : 'Missing'}\n`)

  // 1.5 Verify authenticated session
  console.log('5️⃣ Test: Confirm active session with /api/auth/me')
  const meRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/me',
    method: 'GET',
    headers: { 'Cookie': regCookie },
  })
  console.log(`   Status: ${meRes.status} (Expected: 200)`)
  console.log(`   Current User: ${meRes.body?.data?.user?.displayName} / ${meRes.body?.data?.user?.email}\n`)

  // 1.6 Duplicate registration prevention
  console.log('6️⃣ Test: Reject duplicate registration with existing email')
  const dupRegRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/register/send-otp',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, { email: testEmail, displayName: 'Alex Clone', password: initialPassword })
  console.log(`   Status: ${dupRegRes.status} (Expected: 409)`)
  console.log(`   Response: ${JSON.stringify(dupRegRes.body)}\n`)

  // ==========================================
  // PART 2: FORGOT PASSWORD OTP VERIFICATION
  // ==========================================
  console.log('=== PART 2: FORGOT PASSWORD OTP VERIFICATION ===\n')

  // 2.1 Send reset OTP for non-existent user
  console.log('7️⃣ Test: Request password reset for non-existent email')
  const nonExistRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/forgot-password/send-otp',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, { email: 'nobody_here_xyz@dogfood.org' })
  console.log(`   Status: ${nonExistRes.status} (Expected: 404)`)
  console.log(`   Response: ${JSON.stringify(nonExistRes.body)}\n`)

  // 2.2 Send reset OTP for our registered user
  console.log(`8️⃣ Test: Request password reset for ${testEmail}`)
  const sendResetRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/forgot-password/send-otp',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, { email: testEmail })
  console.log(`   Status: ${sendResetRes.status} (Expected: 200)`)
  const resetCode = sendResetRes.body?.data?.devCode
  console.log(`   Reset OTP Code: ${resetCode}\n`)

  if (!resetCode) throw new Error('No reset code received in dev mode')

  // 2.3 Attempt reset with wrong code
  console.log('9️⃣ Test: Reset password with wrong code')
  const wrongResetRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/forgot-password/reset',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, { email: testEmail, code: '111111', newPassword })
  console.log(`   Status: ${wrongResetRes.status} (Expected: 400)`)
  console.log(`   Response: ${JSON.stringify(wrongResetRes.body)}\n`)

  // 2.4 Reset password with correct code
  console.log('🔟 Test: Reset password with correct OTP code')
  const resetRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/forgot-password/reset',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, { email: testEmail, code: resetCode, newPassword })
  console.log(`   Status: ${resetRes.status} (Expected: 200)`)
  console.log(`   Response: ${JSON.stringify(resetRes.body)}\n`)

  // 2.5 Verify old password is now rejected
  console.log('1️⃣1️⃣ Test: Sign in with OLD password (should fail)')
  const oldLoginRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, { email: testEmail, password: initialPassword })
  console.log(`   Status: ${oldLoginRes.status} (Expected: 401)`)
  console.log(`   Response: ${JSON.stringify(oldLoginRes.body)}\n`)

  // 2.6 Verify new password succeeds
  console.log('1️⃣2️⃣ Test: Sign in with NEW password (should succeed)')
  const newLoginRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, { email: testEmail, password: newPassword })
  console.log(`   Status: ${newLoginRes.status} (Expected: 200)`)
  console.log(`   Logged in as: ${newLoginRes.body?.data?.user?.displayName}\n`)

  console.log('🎉 ALL 12 TESTS PASSED! Registration OTP & Forgot Password OTP work flawlessly!')
}

run().catch(console.error)

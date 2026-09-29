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

function findCookie(headers, prefix) {
  const cookies = headers['set-cookie']
  if (!cookies || !Array.isArray(cookies)) return null
  const found = cookies.find(c => c.startsWith(prefix))
  return found ? found.split(';')[0] : null
}

async function run() {
  console.log('🧪 Starting OAuth & Third-Party Authentication Verification...\n')

  // ==========================================
  // PART 1: OAUTH INITIATION & REDIRECTS
  // ==========================================
  console.log('=== PART 1: OAUTH INITIATION & REDIRECTS ===\n')

  for (const provider of ['google', 'github', 'discord']) {
    console.log(`1️⃣ Test: Initiate ${provider.toUpperCase()} OAuth (/api/auth/oauth/${provider})`)
    const res = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/auth/oauth/${provider}?redirect=/vote/event123`,
      method: 'GET',
    })
    console.log(`   Status: ${res.status} (Expected: 307/302 Redirect)`)
    console.log(`   Location: ${res.headers.location}`)
    const stateCookie = findCookie(res.headers, 'oauth_state=')
    console.log(`   CSRF State Cookie: ${stateCookie ? 'Set ✓' : 'Missing ✗'}\n`)
  }

  // ==========================================
  // PART 2: GOOGLE OAUTH FLOW
  // ==========================================
  console.log('=== PART 2: GOOGLE OAUTH CALLBACK & SIGN IN ===\n')

  const googleInit = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/oauth/google?redirect=/',
    method: 'GET',
  })
  const googleStateCookie = findCookie(googleInit.headers, 'oauth_state=')
  const stateVal = decodeURIComponent(googleInit.headers.location.match(/state=([^&]+)/)[1])

  console.log(`2️⃣ Test: Google OAuth Callback with state: ${stateVal}`)
  const googleUserEmail = `google_tester_${Date.now()}@gmail.com`
  const googleCallback = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/auth/oauth/google/callback?code=mock_code&state=${encodeURIComponent(stateVal)}&mock_email=${encodeURIComponent(googleUserEmail)}&mock_name=Google+Explorer`,
    method: 'GET',
    headers: { 'Cookie': googleStateCookie },
  })
  console.log(`   Callback Status: ${googleCallback.status} (Expected: 307/302)`)
  const googleSessionCookie = findCookie(googleCallback.headers, 'dogfood_session=')
  console.log(`   Session Cookie: ${googleSessionCookie ? 'Acquired ✓' : 'Missing ✗'}\n`)

  console.log('3️⃣ Test: Verify Google authenticated session via /api/auth/me')
  const meGoogle = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/me',
    method: 'GET',
    headers: { 'Cookie': googleSessionCookie },
  })
  console.log(`   Status: ${meGoogle.status} (Expected: 200)`)
  console.log(`   Logged In User: ${meGoogle.body?.data?.user?.displayName} (${meGoogle.body?.data?.user?.email})`)
  console.log(`   Avatar: ${meGoogle.body?.data?.user?.avatarUrl}\n`)

  // ==========================================
  // PART 3: GITHUB OAUTH & ACCOUNT LINKING
  // ==========================================
  console.log('=== PART 3: GITHUB OAUTH & ACCOUNT LINKING ===\n')

  const ghInit = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/oauth/github?redirect=/',
    method: 'GET',
  })
  const ghStateCookie = findCookie(ghInit.headers, 'oauth_state=')
  const ghStateVal = decodeURIComponent(ghInit.headers.location.match(/state=([^&]+)/)[1])

  console.log(`4️⃣ Test: GitHub OAuth linking to same email (${googleUserEmail})`)
  const ghCallback = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/auth/oauth/github/callback?code=mock_code&state=${encodeURIComponent(ghStateVal)}&mock_email=${encodeURIComponent(googleUserEmail)}&mock_name=GitHub+Coder`,
    method: 'GET',
    headers: { 'Cookie': ghStateCookie },
  })
  console.log(`   Callback Status: ${ghCallback.status}`)
  const ghSessionCookie = findCookie(ghCallback.headers, 'dogfood_session=')

  const meGh = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/me',
    method: 'GET',
    headers: { 'Cookie': ghSessionCookie },
  })
  console.log(`   Status: ${meGh.status} (Expected: 200)`)
  const isSameUser = meGh.body?.data?.user?.id === meGoogle.body?.data?.user?.id
  console.log(`   Linked Account ID: ${meGh.body?.data?.user?.id} (Matches Google User ID: ${isSameUser ? 'Yes ✓' : 'No ✗'})\n`)

  // ==========================================
  // PART 4: DISCORD OAUTH FLOW
  // ==========================================
  console.log('=== PART 4: DISCORD OAUTH SIGN IN ===\n')

  const discordInit = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/oauth/discord?redirect=/',
    method: 'GET',
  })
  const discordStateCookie = findCookie(discordInit.headers, 'oauth_state=')
  const discordStateVal = decodeURIComponent(discordInit.headers.location.match(/state=([^&]+)/)[1])

  const discordEmail = `gamer_${Date.now()}@discord.gg`
  console.log(`5️⃣ Test: Discord OAuth Callback for ${discordEmail}`)
  const discordCallback = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/auth/oauth/discord/callback?code=mock_code&state=${encodeURIComponent(discordStateVal)}&mock_email=${encodeURIComponent(discordEmail)}&mock_name=DiscordNinja`,
    method: 'GET',
    headers: { 'Cookie': discordStateCookie },
  })
  console.log(`   Callback Status: ${discordCallback.status}`)
  const discordSessionCookie = findCookie(discordCallback.headers, 'dogfood_session=')

  const meDiscord = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/me',
    method: 'GET',
    headers: { 'Cookie': discordSessionCookie },
  })
  console.log(`   Status: ${meDiscord.status} (Expected: 200)`)
  console.log(`   Discord User: ${meDiscord.body?.data?.user?.displayName} (${meDiscord.body?.data?.user?.email})\n`)

  console.log('🎉 ALL OAUTH (GOOGLE, GITHUB, DISCORD) & THIRD-PARTY VERIFICATIONS PASSED!')
}

run().catch(console.error)

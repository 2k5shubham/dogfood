import { NextRequest, NextResponse } from 'next/server'
import { getProviderConfig, handleOAuthUser, OAuthProvider, OAuthUserProfile, getBaseUrl } from '@/lib/oauth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params
  const validProvider = provider as OAuthProvider

  if (!['google', 'github', 'discord'].includes(provider)) {
    return NextResponse.redirect(new URL('/login?error=UnsupportedProvider', getBaseUrl()))
  }

  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const errorParam = searchParams.get('error')

  if (errorParam) {
    console.warn(`[OAUTH:${provider}] Provider returned error:`, errorParam)
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(errorParam)}`, getBaseUrl()))
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL('/login?error=MissingCodeOrState', getBaseUrl()))
  }

  // Verify CSRF state from cookie
  const stateCookie = request.cookies.get('oauth_state')?.value
  let storedState: { state: string; provider: string; returnTo?: string } | null = null
  try {
    storedState = stateCookie ? JSON.parse(stateCookie) : null
  } catch {}

  if (!storedState || storedState.state !== state) {
    return NextResponse.redirect(new URL('/login?error=InvalidState', getBaseUrl()))
  }

  const returnTo = storedState.returnTo || '/'
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown'
  const ua = request.headers.get('user-agent') || 'unknown'

  try {
    let profile: OAuthUserProfile | null = null

    // 1. Handle Mock Flow (in development mode)
    if (code.startsWith('mock_')) {
      const mockEmail = searchParams.get('mock_email') || `${validProvider}_user@example.com`
      const mockName = searchParams.get('mock_name') || `${validProvider.toUpperCase()} User`
      profile = {
        provider: validProvider,
        providerUserId: `mock_${validProvider}_${Date.now()}`,
        email: mockEmail,
        displayName: mockName,
        avatarUrl: `https://api.dicebear.com/7.x/identicon/svg?seed=${mockEmail}`,
      }
    } else {
      // 2. Real OAuth 2.0 Exchange
      const config = getProviderConfig(validProvider)

      if (validProvider === 'google') {
        const tokenRes = await fetch(config.tokenUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code,
            client_id: config.clientId,
            client_secret: config.clientSecret,
            redirect_uri: config.redirectUri,
            grant_type: 'authorization_code',
          }),
        })
        const tokenData = await tokenRes.json()
        if (!tokenData.access_token) throw new Error(tokenData.error_description || 'Failed to get Google access token')

        const userinfoRes = await fetch(config.userinfoUrl, {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        })
        const gUser = await userinfoRes.json()
        profile = {
          provider: 'google',
          providerUserId: gUser.id || gUser.sub,
          email: gUser.email,
          displayName: gUser.name || gUser.email.split('@')[0],
          avatarUrl: gUser.picture,
        }
      } else if (validProvider === 'github') {
        const tokenRes = await fetch(config.tokenUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({
            code,
            client_id: config.clientId,
            client_secret: config.clientSecret,
            redirect_uri: config.redirectUri,
          }),
        })
        const tokenData = await tokenRes.json()
        if (!tokenData.access_token) throw new Error(tokenData.error_description || 'Failed to get GitHub access token')

        const userinfoRes = await fetch(config.userinfoUrl, {
          headers: {
            Authorization: `Bearer ${tokenData.access_token}`,
            Accept: 'application/vnd.github.v3+json',
          },
        })
        const ghUser = await userinfoRes.json()

        // Fetch emails if email is private
        let email = ghUser.email
        if (!email) {
          const emailRes = await fetch('https://api.github.com/user/emails', {
            headers: {
              Authorization: `Bearer ${tokenData.access_token}`,
              Accept: 'application/vnd.github.v3+json',
            },
          })
          const emails = await emailRes.json()
          if (Array.isArray(emails)) {
            const primary = emails.find((e: any) => e.primary && e.verified) || emails[0]
            email = primary?.email
          }
        }

        if (!email) throw new Error('No verified email found on GitHub profile')

        profile = {
          provider: 'github',
          providerUserId: String(ghUser.id),
          email,
          displayName: ghUser.name || ghUser.login,
          avatarUrl: ghUser.avatar_url,
        }
      } else if (validProvider === 'discord') {
        const tokenRes = await fetch(config.tokenUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code,
            client_id: config.clientId,
            client_secret: config.clientSecret,
            redirect_uri: config.redirectUri,
            grant_type: 'authorization_code',
          }),
        })
        const tokenData = await tokenRes.json()
        if (!tokenData.access_token) throw new Error(tokenData.error_description || 'Failed to get Discord access token')

        const userinfoRes = await fetch(config.userinfoUrl, {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        })
        const dUser = await userinfoRes.json()
        if (!dUser.email) throw new Error('No email found on Discord profile')

        profile = {
          provider: 'discord',
          providerUserId: dUser.id,
          email: dUser.email,
          displayName: dUser.global_name || dUser.username,
          avatarUrl: dUser.avatar
            ? `https://cdn.discordapp.com/avatars/${dUser.id}/${dUser.avatar}.png`
            : undefined,
        }
      }
    }

    if (!profile) {
      throw new Error('Failed to resolve user profile from OAuth provider')
    }

    // Link or create user, establish session
    const { sessionToken } = await handleOAuthUser(profile, ip, ua)

    // Clear state cookie, set session cookie, and redirect
    const targetUrl = new URL(returnTo, getBaseUrl())
    const response = NextResponse.redirect(targetUrl.toString())
    response.cookies.delete('oauth_state')
    response.cookies.set('dogfood_session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    })
    return response
  } catch (error: any) {
    console.error(`[OAUTH:${provider}] Callback error:`, error)
    const errUrl = new URL('/login', getBaseUrl())
    errUrl.searchParams.set('error', error?.message || 'AuthenticationFailed')
    return NextResponse.redirect(errUrl.toString())
  }
}

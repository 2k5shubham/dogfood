import { NextRequest, NextResponse } from 'next/server'
import { getProviderConfig, OAuthProvider, getBaseUrl } from '@/lib/oauth'
import crypto from 'crypto'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params

  if (!['google', 'github', 'discord'].includes(provider)) {
    return NextResponse.json({ error: 'Unsupported OAuth provider' }, { status: 400 })
  }

  const searchParams = request.nextUrl.searchParams
  const returnTo = searchParams.get('redirect') || '/'
  const config = getProviderConfig(provider as OAuthProvider)

  // Generate random state to prevent CSRF
  const state = crypto.randomBytes(16).toString('hex')

  const isDev = process.env.NODE_ENV !== 'production'

  // If not configured in .env and in development, redirect to mock OAuth screen
  if (!config.configured) {
    if (isDev) {
      const mockUrl = new URL(`/auth/oauth/mock`, getBaseUrl())
      mockUrl.searchParams.set('provider', provider)
      mockUrl.searchParams.set('state', state)
      mockUrl.searchParams.set('redirect', returnTo)

      const response = NextResponse.redirect(mockUrl.toString())
      response.cookies.set('oauth_state', JSON.stringify({ state, provider, returnTo }), {
        httpOnly: true,
        maxAge: 60 * 10,
        path: '/',
      })
      return response
    } else {
      return NextResponse.json(
        { error: `${provider} OAuth is not configured on this server. Please contact administrator.` },
        { status: 503 }
      )
    }
  }

  // Build standard OAuth authorization URL
  const authUrl = new URL(config.authUrl)
  authUrl.searchParams.set('client_id', config.clientId)
  authUrl.searchParams.set('redirect_uri', config.redirectUri)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('scope', config.scopes.join(' '))
  authUrl.searchParams.set('state', state)

  if (provider === 'google') {
    authUrl.searchParams.set('access_type', 'offline')
    authUrl.searchParams.set('prompt', 'select_account')
  }

  const response = NextResponse.redirect(authUrl.toString())
  response.cookies.set('oauth_state', JSON.stringify({ state, provider, returnTo }), {
    httpOnly: true,
    maxAge: 60 * 10,
    path: '/',
  })

  return response
}

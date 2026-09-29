import { prisma } from './prisma'
import { createSession, setSessionCookie } from './auth'
import { logAudit } from './utils'

export type OAuthProvider = 'google' | 'github' | 'discord'

export interface OAuthUserProfile {
  provider: OAuthProvider
  providerUserId: string
  email: string
  displayName: string
  avatarUrl?: string
}

export function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return 'http://localhost:3000'
}

export function getProviderConfig(provider: OAuthProvider) {
  const baseUrl = getBaseUrl()
  const redirectUri = `${baseUrl}/api/auth/oauth/${provider}/callback`

  switch (provider) {
    case 'google':
      return {
        clientId: process.env.GOOGLE_CLIENT_ID || '',
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
        authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        userinfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
        scopes: ['openid', 'email', 'profile'],
        redirectUri,
        configured: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
      }
    case 'github':
      return {
        clientId: process.env.GITHUB_CLIENT_ID || '',
        clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
        authUrl: 'https://github.com/login/oauth/authorize',
        tokenUrl: 'https://github.com/login/oauth/access_token',
        userinfoUrl: 'https://api.github.com/user',
        scopes: ['read:user', 'user:email'],
        redirectUri,
        configured: Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
      }
    case 'discord':
      return {
        clientId: process.env.DISCORD_CLIENT_ID || '',
        clientSecret: process.env.DISCORD_CLIENT_SECRET || '',
        authUrl: 'https://discord.com/api/oauth2/authorize',
        tokenUrl: 'https://discord.com/api/oauth2/token',
        userinfoUrl: 'https://discord.com/api/users/@me',
        scopes: ['identify', 'email'],
        redirectUri,
        configured: Boolean(process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET),
      }
  }
}

/**
 * Handles OAuth user profile:
 * 1. Finds existing linked OAuthAccount -> signs in.
 * 2. If email exists on an existing User -> links account -> signs in.
 * 3. If new user -> creates User & OAuthAccount -> signs in.
 */
export async function handleOAuthUser(
  profile: OAuthUserProfile,
  ip?: string,
  ua?: string
) {
  const normalizedEmail = profile.email.toLowerCase().trim()

  // 1. Check existing OAuth link
  const existingOAuth = await prisma.oAuthAccount.findUnique({
    where: {
      provider_providerUserId: {
        provider: profile.provider,
        providerUserId: profile.providerUserId,
      },
    },
    include: { user: true },
  })

  let user = existingOAuth?.user
  let isNewUser = false

  if (user) {
    // Existing linked user -> update avatar if not set
    if (!user.avatarUrl && profile.avatarUrl) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { avatarUrl: profile.avatarUrl },
      })
    }
  } else {
    // 2. Check if a User exists with this email
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    })

    if (existingUser) {
      user = existingUser
      // Link this OAuth provider to the existing user
      await prisma.oAuthAccount.create({
        data: {
          userId: user.id,
          provider: profile.provider,
          providerUserId: profile.providerUserId,
          email: normalizedEmail,
        },
      })
      if (!user.avatarUrl && profile.avatarUrl) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { avatarUrl: profile.avatarUrl },
        })
      }
    } else {
      // 3. Brand new user -> auto-create User & OAuthAccount
      isNewUser = true
      user = await prisma.user.create({
        data: {
          email: normalizedEmail,
          displayName: profile.displayName || normalizedEmail.split('@')[0],
          avatarUrl: profile.avatarUrl || null,
          globalRole: 'user',
          oauthAccounts: {
            create: {
              provider: profile.provider,
              providerUserId: profile.providerUserId,
              email: normalizedEmail,
            },
          },
        },
      })

      await logAudit({
        userId: user.id,
        action: 'USER_REGISTERED_OAUTH',
        entityType: 'user',
        entityId: user.id,
        ipAddress: ip,
        userAgent: ua,
        newValue: { provider: profile.provider, email: normalizedEmail },
      })
    }
  }

  // 4. Create active session and set cookie
  const token = await createSession(user.id, ip, ua)
  await setSessionCookie(token)

  await logAudit({
    userId: user.id,
    action: 'LOGIN_OAUTH',
    entityType: 'session',
    entityId: user.id,
    ipAddress: ip,
    userAgent: ua,
    newValue: { provider: profile.provider, email: normalizedEmail },
  })

  return { user, isNewUser, sessionToken: token }
}

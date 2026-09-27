import type { Metadata } from 'next'
import './globals.css'
import { Toaster } from 'sonner'

export const metadata: Metadata = {
  title: {
    default: 'DOGFOOD — Open Source Hackathon Platform',
    template: '%s | DOGFOOD',
  },
  description:
    'A modern, self-hostable hackathon submission and judging platform. Run it with one command.',
  keywords: ['hackathon', 'judging', 'open source', 'self-hosted', 'platform'],
  openGraph: {
    title: 'DOGFOOD — Open Source Hackathon Platform',
    description: 'Self-hostable hackathon platform with weighted judging and quadratic voting.',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
            },
          }}
        />
      </body>
    </html>
  )
}

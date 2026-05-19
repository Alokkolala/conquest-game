import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Conquest — Territory Chess',
  description: 'Win chess. Claim territory. Rule the map.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body
        style={{
          margin: 0,
          padding: 0,
          background: 'var(--bg-warm)',
          fontFamily: 'var(--sans)',
          color: 'var(--ink)',
          minHeight: '100dvh',
        }}
      >
        {children}
      </body>
    </html>
  )
}

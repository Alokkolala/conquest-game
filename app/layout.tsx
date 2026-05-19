import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Conquest — Territory Chess',
  description: 'Win chess. Claim territory. Rule the map.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#0a0a0a] text-neutral-200 antialiased">
        {children}
      </body>
    </html>
  )
}

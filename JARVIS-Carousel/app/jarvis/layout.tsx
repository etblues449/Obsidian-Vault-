import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: 'J.A.R.V.I.S — V.A.U.L.T.',
  description: 'Vault capture terminal',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'JARVIS',
  },
}

export const viewport: Viewport = {
  themeColor: '#0a0612',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function JarvisLayout({ children }: { children: React.ReactNode }) {
  return children
}

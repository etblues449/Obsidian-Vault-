import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: 'Trade Guard — J.A.R.V.I.S',
  description: 'Autonomous XAUUSD executor dashboard: heartbeat, positions, scorecard, gates, kill switch',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Trade Guard',
  },
}

export const viewport: Viewport = {
  themeColor: '#0a0612',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function TradeLayout({ children }: { children: React.ReactNode }) {
  return children
}

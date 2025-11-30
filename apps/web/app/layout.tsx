import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'QaHub - Quality Management System',
  description: 'Test Management System with Document Management and Analytics',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}


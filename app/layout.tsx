import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'TIU Tracker — Мониторинг конкурсных списков ТИУ',
  description: 'Отслеживай свою позицию в конкурсных списках ТИУ по уникальному идентификатору',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700;800&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  )
}

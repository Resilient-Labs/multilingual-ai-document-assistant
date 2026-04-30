import type { Metadata } from 'next'
import { Nunito, Nunito_Sans } from 'next/font/google'
import { ErrorPopup } from '@/components/features/error/ErrorPopup'
import { ErrorProvider } from '@/hooks/useErrorPopup'
import './globals.css'

const nunito = Nunito({
  subsets: ['latin'],
  variable: '--font-nunito',
  display: 'swap',
})

const nunitoSans = Nunito_Sans({
  subsets: ['latin'],
  variable: '--font-nunito-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'AI Document Translator',
  description: 'Multilingual AI document assistant',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body
        suppressHydrationWarning
        className={`${nunito.variable} ${nunitoSans.variable} font-sans`}
      >
        <ErrorProvider>
          {children}
          <ErrorPopup />
        </ErrorProvider>
      </body>
    </html>
  )
}

import type { Metadata } from 'next'
import './globals.css'
import Sidebar from '@/components/Sidebar'
import AuthProvider from '@/components/AuthProvider'

export const metadata: Metadata = {
  title: '취업지원센터 매칭 시스템',
  description: '구직자-채용공고 AI 매칭 및 알림 발송 관리',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="bg-gray-100">
        <AuthProvider>
          <div className="flex min-h-screen">
            <Sidebar />
            <main className="flex-1 p-4 md:p-8 pt-14 md:pt-8 min-w-0">
              {children}
            </main>
          </div>
        </AuthProvider>
      </body>
    </html>
  )
}

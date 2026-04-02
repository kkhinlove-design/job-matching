'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useAuth } from './AuthProvider'

const nav = [
  { href: '/', label: '대시보드', icon: '📊' },
  { href: '/employers', label: '구인처 관리', icon: '🏢' },
  { href: '/jobseekers', label: '구직자 관리', icon: '👤' },
  { href: '/postings', label: '채용공고', icon: '📋' },
  { href: '/matching', label: 'AI 매칭', icon: '🤖' },
  { href: '/send', label: '문자 발송', icon: '📱' },
]

const adminNav = [
  { href: '/admin/users', label: '사용자 관리', icon: '🔐' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { user, isAdmin, signOut } = useAuth()
  const [open, setOpen] = useState(false)

  const inner = (
    <aside className="w-56 h-full bg-gray-900 text-white flex flex-col">
      <div className="p-4 border-b border-gray-700 flex items-center justify-between">
        <Image src="/top_logo.png" alt="로고" width={160} height={48} className="object-contain brightness-0 invert" priority />
        {/* 모바일 닫기 버튼 */}
        <button onClick={() => setOpen(false)} className="md:hidden text-gray-400 hover:text-white p-1 shrink-0">✕</button>
      </div>
      <nav className="flex-1 p-3 overflow-y-auto">
        {nav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 text-sm transition-colors ${
              pathname === item.href ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800'
            }`}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
        {isAdmin && (
          <>
            <div className="border-t border-gray-700 my-2" />
            <p className="text-[10px] text-gray-500 uppercase tracking-wider px-3 mb-1">관리자</p>
            {adminNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 text-sm transition-colors ${
                  pathname === item.href ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800'
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))}
          </>
        )}
      </nav>
      {user && (
        <div className="p-3 border-t border-gray-700">
          <p className="text-xs text-gray-400 truncate px-2 mb-2">{user.email}</p>
          <button
            onClick={signOut}
            className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 rounded-lg transition-colors"
          >
            로그아웃
          </button>
        </div>
      )}
    </aside>
  )

  return (
    <>
      {/* 데스크탑: 항상 표시 */}
      <div className="hidden md:flex min-h-screen w-56 shrink-0">
        {inner}
      </div>

      {/* 모바일: 햄버거 버튼 */}
      <button
        onClick={() => setOpen(true)}
        className="md:hidden fixed top-3 left-3 z-40 bg-gray-900 text-white p-2 rounded-lg shadow-lg"
      >
        ☰
      </button>

      {/* 모바일: 오버레이 드로어 */}
      {open && (
        <>
          <div className="md:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setOpen(false)} />
          <div className="md:hidden fixed left-0 top-0 h-full z-50 flex">
            {inner}
          </div>
        </>
      )}
    </>
  )
}

'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import Image from 'next/image'
import { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

interface AuthCtx {
  user: User | null
  userName: string
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthCtx>({ user: null, userName: '', signOut: async () => {} })

export function useAuth() {
  return useContext(AuthContext)
}

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // 로그인 폼
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // 이름 설정 모달
  const [nameInput, setNameInput] = useState('')
  const [nameError, setNameError] = useState('')
  const [savingName, setSavingName] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function signIn(e: React.FormEvent) {
    e.preventDefault()
    setLoginError('')
    setSubmitting(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setLoginError(error.message === 'Invalid login credentials' ? '이메일 또는 비밀번호가 올바르지 않습니다.' : error.message)
    setSubmitting(false)
  }

  async function saveName(e: React.FormEvent) {
    e.preventDefault()
    if (!nameInput.trim()) { setNameError('이름을 입력해주세요.'); return }
    setSavingName(true)
    const { error } = await supabase.auth.updateUser({ data: { name: nameInput.trim() } })
    if (error) { setNameError('저장 실패: ' + error.message); setSavingName(false); return }
    // 세션 새로고침
    const { data } = await supabase.auth.getUser()
    setUser(data.user)
    setSavingName(false)
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <p className="text-gray-400">로딩 중...</p>
      </div>
    )
  }

  // 로그인 화면
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg w-full max-w-sm p-8">
          <div className="flex justify-center mb-8">
            <Image src="/top_logo.png" alt="로고" width={180} height={54} className="object-contain" priority />
          </div>
          <form onSubmit={signIn} className="space-y-4">
            <div>
              <label className="text-sm text-gray-600 mb-1 block">이메일</label>
              <input type="email" required autoFocus
                className="w-full border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="admin@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="text-sm text-gray-600 mb-1 block">비밀번호</label>
              <input type="password" required
                className="w-full border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            {loginError && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{loginError}</p>}
            <button type="submit" disabled={submitting}
              className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {submitting ? '로그인 중...' : '로그인'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  const userName: string = user.user_metadata?.name ?? ''

  // 이름 미설정 시 이름 입력 화면
  if (!userName) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg w-full max-w-sm p-8">
          <div className="text-center mb-6">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-2xl">👤</span>
            </div>
            <h2 className="text-lg font-bold text-gray-800">담당자 이름 설정</h2>
            <p className="text-sm text-gray-400 mt-1">구직자 등록 시 담당자명으로 사용됩니다.</p>
          </div>
          <form onSubmit={saveName} className="space-y-4">
            <div>
              <label className="text-sm text-gray-600 mb-1 block">이름</label>
              <input autoFocus required
                className="w-full border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="홍길동" value={nameInput} onChange={(e) => setNameInput(e.target.value)} />
            </div>
            {nameError && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{nameError}</p>}
            <button type="submit" disabled={savingName}
              className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {savingName ? '저장 중...' : '시작하기'}
            </button>
          </form>
          <button onClick={signOut} className="w-full mt-3 text-xs text-gray-400 hover:text-gray-600">
            다른 계정으로 로그인
          </button>
        </div>
      </div>
    )
  }

  return (
    <AuthContext.Provider value={{ user, userName, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

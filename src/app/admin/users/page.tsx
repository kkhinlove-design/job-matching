'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { supabase } from '@/lib/supabase'

interface AppUser {
  id: string
  email: string
  name: string
  role: string
  created_at: string
  last_sign_in_at: string | null
}

export default function AdminUsersPage() {
  const { user, isAdmin } = useAuth()
  const [users, setUsers] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // 생성 폼
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ email: '', password: '', name: '', role: 'user' })
  const [saving, setSaving] = useState(false)

  // 비밀번호 재설정
  const [resetId, setResetId] = useState<string | null>(null)
  const [newPassword, setNewPassword] = useState('')

  async function getToken() {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token ?? ''
  }

  async function loadUsers() {
    setLoading(true)
    setError('')
    const token = await getToken()
    const res = await fetch('/api/admin/users', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      setError('사용자 목록을 불러올 수 없습니다.')
      setLoading(false)
      return
    }
    const data = await res.json()
    setUsers(data)
    setLoading(false)
  }

  useEffect(() => {
    if (isAdmin) loadUsers()
    else setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin])

  async function createUser(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const token = await getToken()
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(form),
    })
    if (!res.ok) {
      const d = await res.json()
      setError(d.error || '생성 실패')
      setSaving(false)
      return
    }
    setForm({ email: '', password: '', name: '', role: 'user' })
    setShowForm(false)
    setSaving(false)
    loadUsers()
  }

  async function deleteUser(u: AppUser) {
    if (u.id === user?.id) { alert('자기 자신은 삭제할 수 없습니다.'); return }
    if (!confirm(`${u.name || u.email} 사용자를 삭제하시겠습니까?`)) return
    const token = await getToken()
    const res = await fetch('/api/admin/users', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id: u.id }),
    })
    if (!res.ok) {
      const d = await res.json()
      alert(d.error || '삭제 실패')
      return
    }
    loadUsers()
  }

  async function toggleRole(u: AppUser) {
    if (u.id === user?.id) { alert('자기 자신의 역할은 변경할 수 없습니다.'); return }
    const newRole = u.role === 'admin' ? 'user' : 'admin'
    if (!confirm(`${u.name || u.email}의 역할을 ${newRole === 'admin' ? '관리자' : '일반'}(으)로 변경하시겠습니까?`)) return
    const token = await getToken()
    await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id: u.id, role: newRole }),
    })
    loadUsers()
  }

  async function resetPassword(id: string) {
    if (!newPassword || newPassword.length < 6) { alert('비밀번호는 6자 이상이어야 합니다.'); return }
    const token = await getToken()
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id, password: newPassword }),
    })
    if (!res.ok) {
      const d = await res.json()
      alert(d.error || '변경 실패')
      return
    }
    alert('비밀번호가 변경되었습니다.')
    setResetId(null)
    setNewPassword('')
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-gray-500">접근 권한이 없습니다.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-800">사용자 관리</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition-colors"
        >
          {showForm ? '취소' : '+ 사용자 추가'}
        </button>
      </div>

      {error && <p className="text-sm text-red-500 bg-red-50 px-4 py-2 rounded-lg mb-4">{error}</p>}

      {/* 생성 폼 */}
      {showForm && (
        <form onSubmit={createUser} className="bg-white rounded-xl shadow p-6 mb-6 space-y-4">
          <h2 className="font-semibold text-gray-700 mb-2">새 사용자 등록</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-600 mb-1 block">이메일 *</label>
              <input type="email" required value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="user@example.com" />
            </div>
            <div>
              <label className="text-sm text-gray-600 mb-1 block">비밀번호 *</label>
              <input type="password" required minLength={6} value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="6자 이상" />
            </div>
            <div>
              <label className="text-sm text-gray-600 mb-1 block">이름</label>
              <input value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="홍길동" />
            </div>
            <div>
              <label className="text-sm text-gray-600 mb-1 block">역할</label>
              <select value={form.role}
                onChange={e => setForm({ ...form, role: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="user">일반 사용자</option>
                <option value="admin">관리자</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={saving}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
              {saving ? '등록 중...' : '등록'}
            </button>
          </div>
        </form>
      )}

      {/* 사용자 목록 */}
      {loading ? (
        <p className="text-gray-400 text-center py-12">로딩 중...</p>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">이메일</th>
                  <th className="text-left px-4 py-3 font-medium">이름</th>
                  <th className="text-left px-4 py-3 font-medium">역할</th>
                  <th className="text-left px-4 py-3 font-medium">마지막 로그인</th>
                  <th className="text-left px-4 py-3 font-medium">가입일</th>
                  <th className="text-center px-4 py-3 font-medium">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-800">{u.email}</td>
                    <td className="px-4 py-3 text-gray-600">{u.name || '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                        u.role === 'admin'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {u.role === 'admin' ? '관리자' : '일반'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString('ko-KR') : '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {new Date(u.created_at).toLocaleDateString('ko-KR')}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => toggleRole(u)}
                          className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50"
                          title="역할 변경">
                          {u.role === 'admin' ? '일반으로' : '관리자로'}
                        </button>
                        <button onClick={() => { setResetId(resetId === u.id ? null : u.id); setNewPassword('') }}
                          className="text-xs text-orange-600 hover:text-orange-800 px-2 py-1 rounded hover:bg-orange-50"
                          title="비밀번호 변경">
                          비밀번호
                        </button>
                        <button onClick={() => deleteUser(u)}
                          className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50"
                          title="삭제">
                          삭제
                        </button>
                      </div>
                      {resetId === u.id && (
                        <div className="flex items-center gap-2 mt-2">
                          <input type="password" placeholder="새 비밀번호 (6자 이상)"
                            value={newPassword} onChange={e => setNewPassword(e.target.value)}
                            className="flex-1 border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
                          <button onClick={() => resetPassword(u.id)}
                            className="text-xs bg-orange-500 text-white px-2 py-1 rounded hover:bg-orange-600">
                            변경
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {users.length === 0 && (
            <p className="text-gray-400 text-center py-8">등록된 사용자가 없습니다.</p>
          )}
        </div>
      )}
    </div>
  )
}

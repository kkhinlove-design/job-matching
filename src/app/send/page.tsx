'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface PendingMatch {
  id: string
  score: number
  reason: string
  sent: boolean
  jobseeker_id: string
  posting_id: string
  job_seekers: { name: string; phone: string }
  job_postings: { title: string; company_name: string; region: string; url: string | null }
}

export default function SendPage() {
  const [pending, setPending] = useState<PendingMatch[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [sendType, setSendType] = useState<'sms' | 'kakao'>('sms')

  async function fetchPending() {
    const { data } = await supabase
      .from('match_results')
      .select('*, job_seekers(name, phone), job_postings(title, company_name, region, url)')
      .eq('sent', false)
      .order('score', { ascending: false })
    setPending((data ?? []) as PendingMatch[])
    setLoading(false)
  }

  useEffect(() => { fetchPending() }, [])

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAll() {
    if (selected.size === pending.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(pending.map((p) => p.id)))
    }
  }

  async function handleSend() {
    if (selected.size === 0) {
      setMessage('발송할 항목을 선택해주세요.')
      return
    }
    if (!confirm(`${selected.size}명에게 알림을 발송하시겠습니까?`)) return
    setSending(true)
    setMessage('')
    try {
      const res = await fetch('/api/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchIds: Array.from(selected), sendType }),
      })
      const data = await res.json()
      setMessage(data.message ?? '발송 완료')
      setSelected(new Set())
      fetchPending()
    } catch {
      setMessage('발송 중 오류가 발생했습니다.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">알림 발송</h2>
          <p className="text-sm text-gray-500 mt-1">미발송 매칭 결과 목록입니다. 선택 후 발송하세요.</p>
        </div>
        <div className="flex items-center gap-3">
          {/* 발송 수단 선택 */}
          <div className="flex rounded-lg border overflow-hidden text-sm">
            <button
              onClick={() => setSendType('sms')}
              className={`px-4 py-2 ${sendType === 'sms' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              📱 문자(SMS)
            </button>
            <button
              onClick={() => setSendType('kakao')}
              className={`px-4 py-2 ${sendType === 'kakao' ? 'bg-yellow-400 text-gray-900' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              💬 카카오 알림톡
            </button>
          </div>
          <button
            onClick={handleSend}
            disabled={sending || selected.size === 0}
            className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            {sending ? (
              <><span className="animate-spin">⟳</span> 발송 중...</>
            ) : (
              <>발송 ({selected.size})</>
            )}
          </button>
        </div>
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${message.includes('오류') ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'}`}>
          {message}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <p className="p-6 text-gray-500">불러오는 중...</p>
        ) : pending.length === 0 ? (
          <p className="p-6 text-gray-500">발송 대기 중인 매칭 결과가 없습니다.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-4 py-3">
                  <input type="checkbox" checked={selected.size === pending.length} onChange={selectAll} className="w-4 h-4" />
                </th>
                {['구직자', '연락처', '공고 제목', '회사', '점수'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pending.map((p) => (
                <tr key={p.id} className={`hover:bg-gray-50 ${selected.has(p.id) ? 'bg-blue-50' : ''}`}>
                  <td className="px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={selected.has(p.id)}
                      onChange={() => toggleSelect(p.id)}
                      className="w-4 h-4"
                    />
                  </td>
                  <td className="px-4 py-3 font-medium">{p.job_seekers?.name}</td>
                  <td className="px-4 py-3">{p.job_seekers?.phone}</td>
                  <td className="px-4 py-3 max-w-xs truncate">
                    {p.job_postings?.url ? (
                      <a href={p.job_postings.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                        {p.job_postings?.title}
                      </a>
                    ) : p.job_postings?.title}
                  </td>
                  <td className="px-4 py-3">{p.job_postings?.company_name}</td>
                  <td className="px-4 py-3 font-semibold text-purple-600">{p.score}점</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { JobSeeker } from '@/types'

interface MatchWithJoin {
  id: string
  score: number
  reason: string
  sent: boolean
  jobseeker_id: string
  posting_id: string
  created_at: string
  job_seekers: { name: string; phone: string } | null
  job_postings: { title: string; company_name: string; region: string; url: string | null } | null
}

export default function MatchingPage() {
  const [jobseekers, setJobseekers] = useState<JobSeeker[]>([])
  const [results, setResults] = useState<MatchWithJoin[]>([])
  const [running, setRunning] = useState(false)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [selectedSeeker, setSelectedSeeker] = useState<string>('all')
  const [seekerSearch, setSeekerSearch] = useState<string>('')

  async function fetchData() {
    const [seekers, matches] = await Promise.all([
      supabase.from('job_seekers').select('*').eq('active', true),
      supabase
        .from('match_results')
        .select('*, job_seekers(name, phone, desired_job), job_postings(title, company_name, region, url)')
        .order('created_at', { ascending: false })
        .limit(100),
    ])
    setJobseekers(seekers.data ?? [])
    setResults(matches.data ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  async function handleMatch() {
    setRunning(true)
    setMessage('')
    try {
      const res = await fetch('/api/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seekerId: selectedSeeker === 'all' ? null : selectedSeeker }),
      })
      const data = await res.json()
      setMessage(data.message ?? '매칭 완료')
      fetchData()
    } catch {
      setMessage('매칭 중 오류가 발생했습니다.')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">AI 매칭</h2>
        <div className="flex items-center gap-3">
          <input
            className="border rounded-lg px-3 py-2 text-sm w-36"
            placeholder="이름 검색"
            value={seekerSearch}
            onChange={(e) => setSeekerSearch(e.target.value)}
          />
          <select
            className="border rounded-lg px-3 py-2 text-sm"
            value={selectedSeeker}
            onChange={(e) => setSelectedSeeker(e.target.value)}
          >
            <option value="all">전체 구직자</option>
            {jobseekers
              .filter((js) => js.name.includes(seekerSearch))
              .sort((a, b) => a.name.localeCompare(b.name, 'ko'))
              .map((js) => {
                const rn = (js.resident_number ?? '').replace('-', '')
                let birth = ''
                if (rn.length >= 7) {
                  const g = parseInt(rn[6])
                  const century = [1,2,5,6].includes(g) ? '19' : '20'
                  birth = `${century}${rn.slice(0,2)}.${rn.slice(2,4)}.${rn.slice(4,6)}`
                }
                return (
                  <option key={js.id} value={js.id}>
                    {js.name}{birth ? ` (${birth}생)` : js.desired_job ? ` (${js.desired_job})` : ''}
                  </option>
                )
              })}
          </select>
          <button
            onClick={handleMatch}
            disabled={running}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
          >
            {running ? (
              <><span className="animate-spin">⟳</span> 매칭 중...</>
            ) : (
              <>🤖 AI 매칭 실행</>
            )}
          </button>
        </div>
      </div>

      {message && (
        <div className="mb-4 p-3 bg-purple-50 text-purple-700 rounded-lg text-sm">{message}</div>
      )}

      <div className="bg-white rounded-xl shadow-sm overflow-auto max-h-[calc(100vh-220px)]">
        {loading ? (
          <p className="p-6 text-gray-500">불러오는 중...</p>
        ) : results.length === 0 ? (
          <p className="p-6 text-gray-500">매칭 결과가 없습니다. AI 매칭을 실행해주세요.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 sticky top-0 z-10">
              <tr>
                {['구직자', '공고 제목', '회사', '점수', '매칭 이유', '발송 여부'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {results.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">
                    {r.job_seekers?.name}
                  </td>
                  <td className="px-4 py-3 max-w-xs truncate">
                    {r.job_postings?.url ? (
                      <a
                        href={r.job_postings.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {r.job_postings?.title}
                      </a>
                    ) : (
                      r.job_postings?.title
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {r.job_postings?.company_name}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-semibold text-purple-600">{r.score}점</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{r.reason}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${r.sent ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {r.sent ? '발송완료' : '미발송'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

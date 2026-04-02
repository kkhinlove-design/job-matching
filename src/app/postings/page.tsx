'use client'

import { useEffect, useState } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'
import { JobPosting } from '@/types'

type StatusFilter = 'all' | 'active' | 'closed'
type Source = 'worknet' | 'saramin' | 'jobkorea'

const SOURCE_LABELS: Record<string, { label: string; color: string }> = {
  worknet:  { label: '워크넷',  color: 'bg-blue-100 text-blue-700' },
  saramin:  { label: '사람인',  color: 'bg-purple-100 text-purple-700' },
  jobkorea: { label: '잡코리아', color: 'bg-orange-100 text-orange-700' },
}

function isExpired(deadline: string | null): boolean {
  if (!deadline) return false
  const d = new Date(deadline)
  return !isNaN(d.getTime()) && d < new Date()
}

export default function PostingsPage() {
  const [list, setList] = useState<JobPosting[]>([])
  const [loading, setLoading] = useState(true)
  const [collecting, setCollecting] = useState<Source | 'all' | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active')
  const [sourceFilter, setSourceFilter] = useState<string>('all')
  const [message, setMessage] = useState('')
  const [selectedSources, setSelectedSources] = useState<Record<Source, boolean>>({
    worknet: true,
    saramin: true,
    jobkorea: true,
  })

  async function fetchList() {
    const { data } = await supabase
      .from('job_postings')
      .select('*')
      .order('collected_at', { ascending: false })
      .limit(500)
    setList(data ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchList() }, [])

  async function handleCollect(sources: Source[]) {
    const key = sources.length === 3 ? 'all' : sources[0]
    setCollecting(key)
    setMessage('')
    try {
      const res = await fetch('/api/collect-postings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sources }),
      })
      const data = await res.json()
      setMessage(data.message ?? '수집 완료')
      fetchList()
    } catch {
      setMessage('수집 중 오류가 발생했습니다.')
    } finally {
      setCollecting(null)
    }
  }

  async function handleToggleClosed(p: JobPosting) {
    const newClosed = !p.closed
    await supabase.from('job_postings').update({ closed: newClosed }).eq('id', p.id)
    setList((prev) => prev.map((item) => item.id === p.id ? { ...item, closed: newClosed } : item))
  }

  function handleDownload() {
    const rows = filtered.map((p) => ({
      공고제목: p.title,
      회사명: p.company_name,
      지역: p.region,
      직종: p.job_type,
      급여: p.salary_type,
      마감일: p.deadline ?? '',
      출처: SOURCE_LABELS[p.source]?.label ?? p.source,
      상태: p.closed || isExpired(p.deadline) ? '마감' : '진행중',
      링크: p.url ?? '',
      수집일: p.collected_at?.slice(0, 10) ?? '',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '채용공고')
    XLSX.writeFile(wb, `채용공고_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  const activeSources = (Object.keys(selectedSources) as Source[]).filter((s) => selectedSources[s])

  const searched = list.filter((p) =>
    p.title.includes(search) ||
    p.company_name.includes(search) ||
    p.region.includes(search)
  )

  const filtered = searched.filter((p) => {
    const closed = p.closed || isExpired(p.deadline)
    if (statusFilter === 'active' && closed) return false
    if (statusFilter === 'closed' && !closed) return false
    if (sourceFilter !== 'all' && p.source !== sourceFilter) return false
    return true
  })

  const activeCount = searched.filter((p) => !(p.closed || isExpired(p.deadline))).length
  const closedCount = searched.filter((p) => p.closed || isExpired(p.deadline)).length

  const sourceCount = (s: string) => searched.filter((p) => p.source === s).length

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-gray-800">채용공고</h2>
        <div className="flex gap-2">
          <button
            onClick={handleDownload}
            className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-emerald-700"
          >
            엑셀 다운로드
          </button>
        </div>
      </div>

      {/* 수집 패널 */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
        <div className="flex items-center gap-4 flex-wrap">
          <span className="text-sm font-medium text-gray-600">공고 수집:</span>
          <div className="flex gap-2">
            {(Object.keys(selectedSources) as Source[]).map((src) => (
              <label key={src} className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedSources[src]}
                  onChange={(e) => setSelectedSources((prev) => ({ ...prev, [src]: e.target.checked }))}
                  className="w-4 h-4"
                />
                <span className="text-sm">{SOURCE_LABELS[src].label}</span>
              </label>
            ))}
          </div>
          <div className="flex gap-2 ml-auto">
            {(Object.keys(SOURCE_LABELS) as Source[]).map((src) => (
              <button
                key={src}
                onClick={() => handleCollect([src])}
                disabled={collecting !== null}
                className={`px-3 py-1.5 text-sm rounded-lg border hover:bg-gray-50 disabled:opacity-40 ${
                  collecting === src ? 'bg-gray-100' : ''
                }`}
              >
                {collecting === src ? '수집 중...' : `${SOURCE_LABELS[src].label} 수집`}
              </button>
            ))}
            <button
              onClick={() => handleCollect(activeSources)}
              disabled={collecting !== null || activeSources.length === 0}
              className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40"
            >
              {collecting === 'all' ? '⟳ 수집 중...' : '전체 수집'}
            </button>
          </div>
        </div>
      </div>

      {message && (
        <div className="mb-4 p-3 bg-blue-50 text-blue-700 rounded-lg text-sm whitespace-pre-line">{message}</div>
      )}

      <div className="flex gap-3 mb-4 items-center flex-wrap">
        <input
          className="border rounded-lg px-3 py-2 text-sm w-64"
          placeholder="제목, 회사명, 지역으로 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {/* 상태 필터 */}
        <div className="flex gap-1">
          {([
            { key: 'active', label: `진행중 (${activeCount})` },
            { key: 'closed', label: `마감 (${closedCount})` },
            { key: 'all', label: `전체 (${searched.length})` },
          ] as const).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className={`px-3 py-1.5 text-sm rounded-lg ${statusFilter === key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {label}
            </button>
          ))}
        </div>
        {/* 출처 필터 */}
        <div className="flex gap-1">
          <button
            onClick={() => setSourceFilter('all')}
            className={`px-3 py-1.5 text-sm rounded-lg ${sourceFilter === 'all' ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            전체
          </button>
          {(Object.keys(SOURCE_LABELS) as Source[]).map((src) => (
            <button
              key={src}
              onClick={() => setSourceFilter(src)}
              className={`px-3 py-1.5 text-sm rounded-lg ${sourceFilter === src ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {SOURCE_LABELS[src].label} ({sourceCount(src)})
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-auto max-h-[calc(100vh-280px)]">
        {loading ? (
          <p className="p-6 text-gray-500">불러오는 중...</p>
        ) : filtered.length === 0 ? (
          <p className="p-6 text-gray-500">공고가 없습니다.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 sticky top-0 z-10">
              <tr>
                {['출처', '공고제목', '회사명', '지역', '직종', '마감일', '상태', '링크', '관리'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((p) => {
                const closed = p.closed || isExpired(p.deadline)
                const srcInfo = SOURCE_LABELS[p.source]
                return (
                  <tr key={p.id} className={`hover:bg-gray-50 ${closed ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${srcInfo?.color ?? 'bg-gray-100 text-gray-600'}`}>
                        {srcInfo?.label ?? p.source}
                      </span>
                    </td>
                    <td className={`px-4 py-3 font-medium max-w-xs truncate ${closed ? 'line-through text-gray-400' : ''}`}>
                      {p.title}
                    </td>
                    <td className="px-4 py-3">{p.company_name}</td>
                    <td className="px-4 py-3">{p.region}</td>
                    <td className="px-4 py-3">{p.job_type}</td>
                    <td className="px-4 py-3 text-gray-500">{p.deadline ?? '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${closed ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'}`}>
                        {closed ? '마감' : '진행중'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {p.url ? (
                        <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">보기</a>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleToggleClosed(p)}
                        className={`text-xs px-2 py-1 rounded ${p.closed ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-red-100 text-red-600 hover:bg-red-200'}`}
                      >
                        {p.closed ? '재오픈' : '마감처리'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

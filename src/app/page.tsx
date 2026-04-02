'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

const JEONBUK_SIGUNGU = [
  '전주시', '군산시', '익산시', '정읍시', '남원시', '김제시',
  '완주군', '진안군', '무주군', '장수군', '임실군', '순창군', '고창군', '부안군',
]

function classifyRegion(region: string): string {
  if (!region) return '도외'
  for (const sg of JEONBUK_SIGUNGU) {
    if (region.includes(sg)) return sg
  }
  return '도외'
}

interface SeekerRow { region: string; active: boolean; employment_type: string | null; job_category: string | null; job_expiry_date: string | null }
interface RegionStat { name: string; total: number; active: number; alsen: number; bonjin: number; expired: number }
interface ExpiringSeeker { id: string; name: string; phone: string; job_expiry_date: string }
interface Stats {
  employers: number; totalJobCount: number; activeJobseekers: number; totalJobseekers: number
  foodCenter: number; otherCategory: number
  alsenEmployed: number; bonjinEmployed: number
  activePostings: number; totalPostings: number; todayPostings: number
  pendingMatches: number; sentMatches: number
  postingsBySource: { worknet: number; saramin: number; jobkorea: number; other: number }
}
interface ExpiringPosting { id: string; title: string; company_name: string; deadline: string; source: string; url: string | null }
interface RecentSeeker { id: string; name: string; desired_job: string; region: string; created_at: string }

const SOURCE_LABEL: Record<string, string> = { worknet: '워크넷', saramin: '사람인', jobkorea: '잡코리아' }
const SOURCE_COLOR: Record<string, string> = {
  worknet: 'bg-blue-500', saramin: 'bg-purple-500', jobkorea: 'bg-orange-500', other: 'bg-gray-400',
}

function daysLeft(deadline: string) {
  const d = new Date(deadline); const now = new Date(); now.setHours(0, 0, 0, 0)
  return Math.ceil((d.getTime() - now.getTime()) / 86400000)
}

function StatCard({ label, value, sub, href, colorClass }: {
  label: string; value: number | string; sub?: string; href: string; colorClass: string
}) {
  return (
    <Link href={href}>
      <div className="bg-white rounded-xl shadow-sm p-4 md:p-5 hover:shadow-md transition-shadow cursor-pointer h-full">
        <p className="text-xs md:text-sm text-gray-500 mb-1">{label}</p>
        <p className={`text-2xl md:text-3xl font-bold ${colorClass}`}>{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-1 leading-tight">{sub}</p>}
      </div>
    </Link>
  )
}

// 시군별 수직 막대 그래프 열
function RegionCol({ r, max }: { r: RegionStat; max: number }) {
  const employed = r.alsen + r.bonjin
  const seekingOnly = Math.max(r.active - employed - r.expired, 0)
  const BAR_H = 120 // px

  return (
    <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
      {/* 총합 숫자 */}
      <span className="text-[11px] font-semibold text-gray-600">{r.total || ''}</span>
      {/* 막대 */}
      <div className="w-full flex flex-col-reverse rounded overflow-hidden bg-gray-100"
        style={{ height: BAR_H }}>
        {r.alsen > 0 && (
          <div className="bg-indigo-500 w-full shrink-0" title={`알선취업 ${r.alsen}명`}
            style={{ height: `${(r.alsen / max) * BAR_H}px` }} />
        )}
        {r.bonjin > 0 && (
          <div className="bg-teal-400 w-full shrink-0" title={`본인취업 ${r.bonjin}명`}
            style={{ height: `${(r.bonjin / max) * BAR_H}px` }} />
        )}
        {seekingOnly > 0 && (
          <div className="bg-green-300 w-full shrink-0" title={`구직활동중 ${seekingOnly}명`}
            style={{ height: `${(seekingOnly / max) * BAR_H}px` }} />
        )}
        {r.expired > 0 && (
          <div className="bg-orange-300 w-full shrink-0" title={`구직만료자 ${r.expired}명`}
            style={{ height: `${(r.expired / max) * BAR_H}px` }} />
        )}
      </div>
      {/* 시군명 */}
      <span className={`text-[10px] text-center leading-tight ${r.name === '도외' ? 'text-gray-400' : 'text-gray-600 font-medium'}`}
        style={{ wordBreak: 'keep-all' }}>
        {r.name}
      </span>
    </div>
  )
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [regionStats, setRegionStats] = useState<RegionStat[]>([])
  const [recentSeekers, setRecentSeekers] = useState<RecentSeeker[]>([])
  const [expiringPostings, setExpiringPostings] = useState<ExpiringPosting[]>([])
  const [expiringSeekersData, setExpiringSeekersData] = useState<ExpiringSeeker[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchAll() {
      const today = new Date().toISOString().slice(0, 10)
      const threeDaysLater = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10)

      const [
        { data: employersData },
        { count: totalJobseekers },
        { count: totalPostings },
        { count: pendingMatches },
        { count: sentMatches },
        { data: seekersData },
        { data: postingsData },
        { data: recentSeekersData },
        { data: expiringData },
        { data: expiringSeekersRaw },
      ] = await Promise.all([
        supabase.from('employers').select('job_count'),
        supabase.from('job_seekers').select('*', { count: 'exact', head: true }),
        supabase.from('job_postings').select('*', { count: 'exact', head: true }),
        supabase.from('match_results').select('*', { count: 'exact', head: true }).eq('sent', false),
        supabase.from('match_results').select('*', { count: 'exact', head: true }).eq('sent', true),
        supabase.from('job_seekers').select('region, active, employment_type, job_category, job_expiry_date'),
        supabase.from('job_postings').select('source, closed, deadline, collected_at'),
        supabase.from('job_seekers').select('id, name, desired_job, region, created_at').order('created_at', { ascending: false }).limit(5),
        supabase.from('job_postings').select('id, title, company_name, deadline, source, url')
          .eq('closed', false).gte('deadline', today).lte('deadline', threeDaysLater)
          .order('deadline', { ascending: true }).limit(5),
        supabase.from('job_seekers').select('id, name, phone, job_expiry_date')
          .eq('active', true).not('job_expiry_date', 'is', null).lte('job_expiry_date', today)
          .order('job_expiry_date', { ascending: true }).limit(5),
      ])

      const employers = employersData?.length ?? 0
      const totalJobCount = (employersData ?? []).reduce((sum, e) => sum + (e.job_count ?? 0), 0)

      const seekers: SeekerRow[] = seekersData ?? []
      const alsenEmployed = seekers.filter((s) => s.employment_type === '알선취업').length
      const bonjinEmployed = seekers.filter((s) => s.employment_type === '본인취업').length
      const activeJobseekers = seekers.filter((s) => s.active).length
      const foodCenter = seekers.filter((s) => s.active && s.job_category === '식품센터').length
      const otherCategory = seekers.filter((s) => s.active && s.job_category === '그 외').length

      const postRows = postingsData ?? []
      const todayPostings = postRows.filter((r) => r.collected_at?.slice(0, 10) === today).length
      const activePostings = postRows.filter((r) => {
        if (r.closed) return false
        if (r.deadline) { const d = new Date(r.deadline); if (!isNaN(d.getTime()) && d < new Date()) return false }
        return true
      }).length
      const bySource = { worknet: 0, saramin: 0, jobkorea: 0, other: 0 }
      for (const r of postRows) {
        if (r.source in bySource) (bySource as Record<string, number>)[r.source]++
        else bySource.other++
      }

      // 시군별 집계
      const allKeys = [...JEONBUK_SIGUNGU, '도외']
      const regionMap: Record<string, RegionStat> = {}
      for (const k of allKeys) regionMap[k] = { name: k, total: 0, active: 0, alsen: 0, bonjin: 0, expired: 0 }
      for (const s of seekers) {
        const key = classifyRegion(s.region)
        if (!regionMap[key]) regionMap[key] = { name: key, total: 0, active: 0, alsen: 0, bonjin: 0, expired: 0 }
        regionMap[key].total++
        if (s.active) regionMap[key].active++
        if (s.employment_type === '알선취업') regionMap[key].alsen++
        if (s.employment_type === '본인취업') regionMap[key].bonjin++
        if (s.active && s.job_expiry_date && s.job_expiry_date <= today) regionMap[key].expired++
      }

      setStats({ employers, totalJobCount, activeJobseekers, totalJobseekers: totalJobseekers ?? 0, foodCenter, otherCategory, alsenEmployed, bonjinEmployed, activePostings, totalPostings: totalPostings ?? 0, todayPostings, pendingMatches: pendingMatches ?? 0, sentMatches: sentMatches ?? 0, postingsBySource: bySource })
      setRegionStats(allKeys.map((k) => regionMap[k]))
      setRecentSeekers(recentSeekersData ?? [])
      setExpiringPostings(expiringData ?? [])
      setExpiringSeekersData((expiringSeekersRaw ?? []) as ExpiringSeeker[])
      setLoading(false)
    }
    fetchAll()
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <p className="text-gray-400">불러오는 중...</p>
    </div>
  )

  const s = stats!
  const totalEmployed = s.alsenEmployed + s.bonjinEmployed
  const maxSource = Math.max(...Object.values(s.postingsBySource), 1)
  const maxRegion = Math.max(...regionStats.map((r) => r.total), 1)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl md:text-2xl font-bold text-gray-800">대시보드</h2>
        <p className="text-xs md:text-sm text-gray-400 hidden sm:block">
          {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}
        </p>
      </div>

      {/* 주요 통계 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="구인처" value={s.employers} sub={`구인인원 전체 ${s.totalJobCount}명`} href="/employers" colorClass="text-blue-600" />
        <StatCard label="활동 구직자" value={s.activeJobseekers} sub={`전체 ${s.totalJobseekers}명`} href="/jobseekers" colorClass="text-green-600" />
        <StatCard label="진행중 공고" value={s.activePostings} sub={`전체 ${s.totalPostings}건 · 오늘 ${s.todayPostings}건`} href="/postings" colorClass="text-yellow-600" />
        <StatCard label="미발송 매칭" value={s.pendingMatches} sub={`누적 발송 ${s.sentMatches}건`} href="/matching" colorClass={s.pendingMatches > 0 ? 'text-red-500' : 'text-gray-600'} />
      </div>

      {/* 취업 통계 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Link href="/jobseekers">
          <div className="bg-white rounded-xl shadow-sm p-4 md:p-5 hover:shadow-md transition-shadow cursor-pointer h-full">
            <p className="text-xs md:text-sm text-gray-500 mb-1">식품센터</p>
            <p className="text-2xl md:text-3xl font-bold text-orange-500">{s.foodCenter}</p>
            <p className="text-xs text-gray-400 mt-1">그 외 {s.otherCategory}명 / 전체 {s.activeJobseekers}명</p>
          </div>
        </Link>
        <Link href="/jobseekers?type=알선취업">
          <div className="bg-white rounded-xl shadow-sm p-4 md:p-5 hover:shadow-md transition-shadow cursor-pointer h-full">
            <p className="text-xs md:text-sm text-gray-500 mb-1">알선취업</p>
            <p className="text-2xl md:text-3xl font-bold text-indigo-600">{s.alsenEmployed}</p>
            <p className="text-xs text-gray-400 mt-1">총 취업 {totalEmployed}명 중</p>
          </div>
        </Link>
        <Link href="/jobseekers?type=본인취업">
          <div className="bg-white rounded-xl shadow-sm p-4 md:p-5 hover:shadow-md transition-shadow cursor-pointer h-full">
            <p className="text-xs md:text-sm text-gray-500 mb-1">본인취업</p>
            <p className="text-2xl md:text-3xl font-bold text-teal-600">{s.bonjinEmployed}</p>
            <p className="text-xs text-gray-400 mt-1">총 취업 {totalEmployed}명 중</p>
          </div>
        </Link>
        <div className="bg-white rounded-xl shadow-sm p-4 md:p-5">
          <p className="text-xs md:text-sm text-gray-500 mb-3">취업형태 비율</p>
          {totalEmployed === 0 ? (
            <p className="text-sm text-gray-300">취업 데이터 없음</p>
          ) : (
            <>
              <div className="flex rounded-full overflow-hidden h-4 mb-2">
                <div className="bg-indigo-500" style={{ width: `${(s.alsenEmployed / totalEmployed) * 100}%` }} />
                <div className="bg-teal-400 flex-1" />
              </div>
              <div className="flex gap-3 text-xs text-gray-500">
                <span><span className="inline-block w-2 h-2 rounded-full bg-indigo-500 mr-1" />알선 {Math.round(s.alsenEmployed / totalEmployed * 100)}%</span>
                <span><span className="inline-block w-2 h-2 rounded-full bg-teal-400 mr-1" />본인 {Math.round(s.bonjinEmployed / totalEmployed * 100)}%</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 시군별 세로 막대그래프 */}
      <div className="bg-white rounded-xl shadow-sm p-4 md:p-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-semibold text-gray-700">시군별 구직자·취업 현황</h3>
            <p className="text-xs text-gray-400 mt-0.5">전북특별자치도 14개 시군 + 도외</p>
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-indigo-500 inline-block" />알선취업</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-teal-400 inline-block" />본인취업</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-green-300 inline-block" />구직활동중</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-orange-300 inline-block" />구직만료자</span>
          </div>
        </div>
        <div className="flex gap-1 items-end overflow-x-auto pb-1">
          {regionStats.map((r) => (
            <RegionCol key={r.name} r={r} max={maxRegion} />
          ))}
        </div>
        <div className="flex gap-4 text-xs text-gray-400 mt-3 pt-3 border-t border-gray-100">
          <span>전체 <strong className="text-gray-600">{s.totalJobseekers}</strong>명</span>
          <span>활동 <strong className="text-green-600">{s.activeJobseekers}</strong>명</span>
          <span>알선취업 <strong className="text-indigo-600">{s.alsenEmployed}</strong>명</span>
          <span>본인취업 <strong className="text-teal-600">{s.bonjinEmployed}</strong>명</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 최근 구직자 */}
        <div className="bg-white rounded-xl shadow-sm p-4 md:p-6">
          <h3 className="font-semibold text-gray-700 mb-4">최근 등록 구직자</h3>
          {recentSeekers.length === 0 ? (
            <p className="text-sm text-gray-400">등록된 구직자가 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {recentSeekers.map((js) => (
                <div key={js.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div className="min-w-0">
                    <span className="text-sm font-medium text-gray-800">{js.name}</span>
                    <span className="text-xs text-gray-400 ml-2 hidden sm:inline">{js.desired_job} · {js.region}</span>
                  </div>
                  <span className="text-xs text-gray-300 shrink-0">{js.created_at?.slice(0, 10)}</span>
                </div>
              ))}
            </div>
          )}
          <Link href="/jobseekers" className="mt-3 block text-xs text-blue-500 hover:underline text-right">전체 보기 →</Link>
        </div>

        {/* 구직만료대상자 */}
        <div className="bg-white rounded-xl shadow-sm p-4 md:p-6">
          <h3 className="font-semibold text-gray-700 mb-4">구직만료대상자 <span className="text-xs text-gray-400 font-normal">(만료일 가까운 순)</span></h3>
          {expiringSeekersData.length === 0 ? (
            <p className="text-sm text-gray-400">구직만료 대상자가 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {expiringSeekersData.map((js) => {
                const expDate = new Date(js.job_expiry_date)
                const now = new Date(); now.setHours(0,0,0,0)
                const daysOver = Math.ceil((now.getTime() - expDate.getTime()) / 86400000)
                return (
                  <div key={js.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-gray-800">{js.name}</span>
                      <span className="text-xs text-gray-400 ml-2">{js.phone}</span>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="text-xs text-orange-500 font-medium block">{js.job_expiry_date}</span>
                      {daysOver > 0 && <span className="text-[10px] text-red-400">+{daysOver}일 초과</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          <Link href="/jobseekers" className="mt-3 block text-xs text-blue-500 hover:underline text-right">전체 보기 →</Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 출처별 공고 */}
        <div className="bg-white rounded-xl shadow-sm p-4 md:p-6">
          <h3 className="font-semibold text-gray-700 mb-4">출처별 공고 현황</h3>
          <div className="space-y-3">
            {(Object.entries(s.postingsBySource) as [string, number][]).map(([src, cnt]) => (
              <div key={src}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">{SOURCE_LABEL[src] ?? src}</span>
                  <span className="font-medium text-gray-800">{cnt}건</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div className={`h-2 rounded-full ${SOURCE_COLOR[src] ?? 'bg-gray-400'}`} style={{ width: `${(cnt / maxSource) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
          <Link href="/postings" className="mt-4 block text-xs text-blue-500 hover:underline text-right">공고 목록 →</Link>
        </div>

        {/* 마감 임박 공고 */}
        <div className="bg-white rounded-xl shadow-sm p-4 md:p-6 lg:col-span-2">
          <h3 className="font-semibold text-gray-700 mb-4">마감 임박 공고 <span className="text-xs text-gray-400 font-normal">(3일 이내)</span></h3>
          {expiringPostings.length === 0 ? (
            <p className="text-sm text-gray-400">마감 임박 공고가 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {expiringPostings.map((p) => {
                const days = daysLeft(p.deadline)
                return (
                  <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-red-50 gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{p.title}</p>
                      <p className="text-xs text-gray-500">{p.company_name} · {SOURCE_LABEL[p.source] ?? p.source}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${days === 0 ? 'bg-red-500 text-white' : 'bg-red-100 text-red-600'}`}>
                        {days === 0 ? 'D-Day' : `D-${days}`}
                      </span>
                      {p.url && <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline hidden sm:block">보기</a>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

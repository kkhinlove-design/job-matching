'use client'

import { useEffect, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'
import { Employer } from '@/types'
import { addMonthsExpiry, excelToDateStr } from '@/lib/date'

function formatBizReg(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 10)
  if (digits.length <= 3) return digits
  if (digits.length <= 5) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`
}

const SUPPORT_PROGRAMS = ['채움프로젝트', '고용환경개선', '재직자 직무스트레스 관리', '일손든든']

const empty: Omit<Employer, 'id' | 'created_at'> = {
  company_name: '',
  business_type: '',
  business_reg_number: '',
  job_duty: '',
  job_count: 0,
  hiring_status: '구인중',
  contact_name: '',
  contact_phone: '',
  address: '',
  region: '',
  job_application_date: null,
  job_expiry_date: null,
  support_programs: [],
  notes: '',
}

export default function EmployersPage() {
  const [list, setList] = useState<Employer[]>([])
  const [form, setForm] = useState(empty)
  const [editId, setEditId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [uploadMsg, setUploadMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function fetchList() {
    const { data } = await supabase.from('employers').select('*').order('created_at', { ascending: false })
    setList(data ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchList() }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (editId) {
      await supabase.from('employers').update(form).eq('id', editId)
    } else {
      await supabase.from('employers').insert(form)
    }
    setForm(empty)
    setEditId(null)
    setShowForm(false)
    fetchList()
  }

  async function handleDelete(id: string) {
    if (!confirm('삭제하시겠습니까?')) return
    await supabase.from('employers').delete().eq('id', id)
    fetchList()
  }

  function handleEdit(emp: Employer) {
    setForm({
      company_name: emp.company_name,
      business_type: emp.business_type,
      business_reg_number: emp.business_reg_number ?? '',
      job_duty: emp.job_duty ?? '',
      job_count: emp.job_count ?? 0,
      hiring_status: emp.hiring_status ?? '구인중',
      contact_name: emp.contact_name,
      contact_phone: emp.contact_phone,
      address: emp.address,
      region: emp.region,
      job_application_date: emp.job_application_date ?? null,
      job_expiry_date: emp.job_expiry_date ?? null,
      support_programs: emp.support_programs ?? [],
      notes: emp.notes ?? '',
    })
    setEditId(emp.id)
    setShowForm(true)
  }

  function handleDownload() {
    const wb = XLSX.utils.book_new()

    const rows = list.map((e) => {
      const programs = e.support_programs ?? []
      const base: Record<string, string | number> = {
        회사명: e.company_name,
        업종: e.business_type,
        사업자등록번호: e.business_reg_number ?? '',
        구인직무: e.job_duty ?? '',
        구인인원: e.job_count ?? 0,
        구인상태: e.hiring_status ?? '',
        구인신청일: e.job_application_date ?? '',
        구인만료일: e.job_expiry_date ?? '',
        담당자: e.contact_name,
        연락처: e.contact_phone,
        지역: e.region,
        주소: e.address,
      }
      for (const p of SUPPORT_PROGRAMS) base[p] = programs.includes(p) ? 'Y' : ''
      base['지원사업합계'] = programs.length
      base['메모'] = e.notes ?? ''
      return base
    })
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), '구인처')

    const programSummary = SUPPORT_PROGRAMS.map((p) => ({
      지원사업: p,
      참여기업수: list.filter((e) => (e.support_programs ?? []).includes(p)).length,
    }))
    programSummary.push({ 지원사업: '미참여', 참여기업수: list.filter((e) => !(e.support_programs ?? []).length).length })
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(programSummary), '지원사업집계')

    XLSX.writeFile(wb, `구인처_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  function handleTemplateDownload() {
    const row: Record<string, string | number> = { 회사명: '', 업종: '', 사업자등록번호: '', 구인직무: '', 구인인원: 0, 구인상태: '구인중', 구인신청일: '', 구인만료일: '', 담당자: '', 연락처: '', 지역: '', 주소: '' }
    for (const p of SUPPORT_PROGRAMS) row[p] = ''
    row['메모'] = ''
    const ws = XLSX.utils.json_to_sheet([row])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '구인처')
    XLSX.writeFile(wb, '구인처_업로드양식.xlsx')
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadMsg('업로드 중...')
    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf)
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<Record<string, string | number | Date>>(ws, { raw: true })
      const records = rows
        .filter((r) => r['회사명'])
        .map((r) => {
          const programs = SUPPORT_PROGRAMS.filter((p) => {
            const v = String(r[p] ?? '').trim().toUpperCase()
            return v === 'Y' || v === 'O' || v === 'TRUE' || v === '1' || v === '참여'
          })
          return {
            company_name: String(r['회사명'] ?? ''),
            business_type: String(r['업종'] ?? ''),
            business_reg_number: String(r['사업자등록번호'] ?? ''),
            job_duty: String(r['구인직무'] ?? ''),
            job_count: Number(r['구인인원'] ?? 0),
            hiring_status: String(r['구인상태'] ?? '구인중'),
            job_application_date: excelToDateStr(r['구인신청일']),
            job_expiry_date: excelToDateStr(r['구인만료일']),
            contact_name: String(r['담당자'] ?? ''),
            contact_phone: String(r['연락처'] ?? ''),
            region: String(r['지역'] ?? ''),
            address: String(r['주소'] ?? ''),
            support_programs: programs,
            notes: String(r['메모'] ?? ''),
          }
        })
      if (records.length === 0) {
        setUploadMsg('유효한 데이터가 없습니다. (회사명 필수)')
        return
      }
      const { error } = await supabase.from('employers').insert(records)
      if (error) throw error
      setUploadMsg(`${records.length}건 업로드 완료`)
      fetchList()
    } catch (err) {
      setUploadMsg('업로드 실패: ' + (err instanceof Error ? err.message : '오류'))
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">구인처 관리</h2>
        <div className="flex gap-2">
          <button onClick={handleTemplateDownload} className="border px-4 py-2 rounded-lg text-sm hover:bg-gray-50 text-gray-600">
            양식 다운로드
          </button>
          <label className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-orange-600 cursor-pointer">
            엑셀 업로드
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleUpload} />
          </label>
          <button onClick={handleDownload} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-emerald-700">
            엑셀 다운로드
          </button>
          <button
            onClick={() => { setForm(empty); setEditId(null); setShowForm(true) }}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"
          >
            + 구인처 등록
          </button>
        </div>
      </div>

      {uploadMsg && (
        <div className="mb-4 p-3 bg-orange-50 text-orange-700 rounded-lg text-sm">{uploadMsg}</div>
      )}

      {showForm && (
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-5 mb-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <span className="w-2 h-6 rounded bg-orange-500 inline-block" />
              <h3 className="font-bold text-gray-800 text-base">{editId ? '구인처 수정' : '구인처 등록'}</h3>
            </div>
            <button type="button" onClick={() => setShowForm(false)}
              className="text-gray-400 hover:text-gray-600 text-xl leading-none px-1">×</button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* ── 1. 기본 정보 ── */}
            <div className="bg-white rounded-xl border border-blue-100 overflow-hidden">
              <div className="flex items-center gap-2.5 px-4 py-2.5 bg-blue-50 border-b border-blue-100">
                <span className="w-5 h-5 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center font-bold shrink-0">1</span>
                <span className="text-sm font-semibold text-blue-700">기본 정보</span>
                <span className="ml-auto text-xs text-blue-400">* 필수항목</span>
              </div>
              <div className="p-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">회사명 <span className="text-red-400">*</span></label>
                  <input required className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-blue-400 focus:border-blue-400 outline-none"
                    value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">업종</label>
                  <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-blue-400 focus:border-blue-400 outline-none"
                    value={form.business_type} onChange={(e) => setForm({ ...form, business_type: e.target.value })} />
                </div>
                <div className="lg:col-span-2">
                  <label className="text-xs font-medium text-gray-500 mb-1 block">사업자등록번호</label>
                  <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:ring-1 focus:ring-blue-400 focus:border-blue-400 outline-none"
                    placeholder="000-00-00000" value={form.business_reg_number}
                    onChange={(e) => setForm({ ...form, business_reg_number: formatBizReg(e.target.value) })} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">담당자</label>
                  <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-blue-400 focus:border-blue-400 outline-none"
                    value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">연락처</label>
                  <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-blue-400 focus:border-blue-400 outline-none"
                    placeholder="010-0000-0000" value={form.contact_phone}
                    onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">지역</label>
                  <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-blue-400 focus:border-blue-400 outline-none"
                    value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">주소</label>
                  <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-blue-400 focus:border-blue-400 outline-none"
                    value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                </div>
              </div>
            </div>

            {/* ── 2. 구인 정보 ── */}
            <div className="bg-white rounded-xl border border-green-100 overflow-hidden">
              <div className="flex items-center gap-2.5 px-4 py-2.5 bg-green-50 border-b border-green-100">
                <span className="w-5 h-5 rounded-full bg-green-500 text-white text-xs flex items-center justify-center font-bold shrink-0">2</span>
                <span className="text-sm font-semibold text-green-700">구인 정보</span>
                {form.hiring_status && (
                  <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium ${form.hiring_status === '구인중' ? 'bg-green-200 text-green-800' : 'bg-gray-200 text-gray-600'}`}>{form.hiring_status}</span>
                )}
              </div>
              <div className="p-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="lg:col-span-2">
                  <label className="text-xs font-medium text-gray-500 mb-1 block">구인직무</label>
                  <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-green-400 outline-none"
                    placeholder="예) 조리원, 요양보호사" value={form.job_duty}
                    onChange={(e) => setForm({ ...form, job_duty: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">구인인원</label>
                  <input type="number" min={0}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-green-400 outline-none"
                    value={form.job_count} onChange={(e) => setForm({ ...form, job_count: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">구인상태</label>
                  <div className="flex gap-2 h-[38px] items-center">
                    {['구인중', '만료'].map((s) => (
                      <label key={s} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer text-sm transition-colors ${form.hiring_status === s ? (s === '구인중' ? 'bg-green-100 border-green-400 text-green-700 font-medium' : 'bg-gray-100 border-gray-400 text-gray-700 font-medium') : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                        <input type="radio" name="hiring_status" value={s}
                          checked={form.hiring_status === s}
                          onChange={() => setForm({ ...form, hiring_status: s })}
                          className="w-3.5 h-3.5" />
                        {s}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">구인신청일</label>
                  <input type="date"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-green-400 outline-none"
                    value={form.job_application_date ?? ''}
                    onChange={(e) => setForm({ ...form, job_application_date: e.target.value || null })} />
                </div>
                <div className="lg:col-span-3">
                  <label className="text-xs font-medium text-gray-500 mb-1 block">구인만료일</label>
                  <div className="flex gap-1.5">
                    <input type="date"
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-green-400 outline-none"
                      value={form.job_expiry_date ?? ''}
                      onChange={(e) => setForm({ ...form, job_expiry_date: e.target.value || null })} />
                    <button type="button" className="px-2.5 py-2 text-xs bg-green-50 border border-green-200 text-green-600 rounded-lg hover:bg-green-100 whitespace-nowrap"
                      onClick={() => setForm({ ...form, job_expiry_date: addMonthsExpiry(form.job_application_date, 3) })}>3개월</button>
                    <button type="button" className="px-2.5 py-2 text-xs bg-green-50 border border-green-200 text-green-600 rounded-lg hover:bg-green-100 whitespace-nowrap"
                      onClick={() => setForm({ ...form, job_expiry_date: addMonthsExpiry(form.job_application_date, 6) })}>6개월</button>
                  </div>
                </div>
              </div>
            </div>

            {/* ── 3. 참여 지원사업 ── */}
            <div className="bg-white rounded-xl border border-rose-100 overflow-hidden">
              <div className="flex items-center gap-2.5 px-4 py-2.5 bg-rose-50 border-b border-rose-100">
                <span className="w-5 h-5 rounded-full bg-rose-500 text-white text-xs flex items-center justify-center font-bold shrink-0">3</span>
                <span className="text-sm font-semibold text-rose-700">참여 지원사업</span>
                <span className="text-xs text-rose-400">중복 선택 가능</span>
                {(form.support_programs ?? []).length > 0 && (
                  <span className="ml-auto px-2 py-0.5 rounded-full text-xs bg-rose-200 text-rose-800 font-medium">{(form.support_programs ?? []).length}건 참여</span>
                )}
              </div>
              <div className="p-4 flex flex-wrap gap-2">
                {SUPPORT_PROGRAMS.map((p) => {
                  const checked = (form.support_programs ?? []).includes(p)
                  return (
                    <label key={p} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border cursor-pointer text-sm transition-colors ${checked ? 'bg-rose-100 border-rose-400 text-rose-700 font-medium' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                      <input type="checkbox" className="w-4 h-4"
                        checked={checked}
                        onChange={(e) => {
                          const cur = form.support_programs ?? []
                          setForm({ ...form, support_programs: e.target.checked ? [...cur, p] : cur.filter((x) => x !== p) })
                        }} />
                      {p}
                    </label>
                  )
                })}
              </div>
            </div>

            {/* 메모 */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <label className="text-xs font-medium text-gray-500 mb-2 block">메모</label>
              <textarea className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-gray-400 outline-none resize-none" rows={2}
                value={form.notes ?? ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>

            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setShowForm(false)}
                className="px-5 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600">취소</button>
              <button type="submit"
                className="px-7 py-2 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600 font-medium">저장</button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm overflow-auto max-h-[calc(100vh-260px)]">
        {loading ? (
          <p className="p-6 text-gray-500">불러오는 중...</p>
        ) : list.length === 0 ? (
          <p className="p-6 text-gray-500">등록된 구인처가 없습니다.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 sticky top-0 z-10">
              <tr>
                {['회사명', '업종', '구인직무', '구인인원', '구인상태', '구인신청일', '구인만료일', '지원사업', '담당자', '연락처', '지역', '관리'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {list.map((emp) => (
                <tr key={emp.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{emp.company_name}</td>
                  <td className="px-4 py-3 text-gray-600">{emp.business_type || '-'}</td>
                  <td className="px-4 py-3 text-gray-600">{emp.job_duty || '-'}</td>
                  <td className="px-4 py-3 text-gray-600">{emp.job_count ? `${emp.job_count}명` : '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${emp.hiring_status === '구인중' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                      {emp.hiring_status || '구인중'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{emp.job_application_date ?? '-'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {emp.job_expiry_date ? (
                      <span className={emp.job_expiry_date <= new Date().toISOString().slice(0, 10) ? 'text-red-500 font-medium' : ''}>
                        {emp.job_expiry_date}
                      </span>
                    ) : '-'}
                  </td>
                  <td className="px-4 py-3">
                    {(emp.support_programs ?? []).length === 0 ? (
                      <span className="text-gray-300 text-xs">-</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {(emp.support_programs ?? []).map((p) => (
                          <span key={p} className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-[11px] whitespace-nowrap">{p}</span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">{emp.contact_name}</td>
                  <td className="px-4 py-3">{emp.contact_phone}</td>
                  <td className="px-4 py-3">{emp.region}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleEdit(emp)} className="text-blue-600 hover:underline mr-3">수정</button>
                    <button onClick={() => handleDelete(emp.id)} className="text-red-500 hover:underline">삭제</button>
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

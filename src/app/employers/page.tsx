'use client'

import { useEffect, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'
import { Employer } from '@/types'

function formatBizReg(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 10)
  if (digits.length <= 3) return digits
  if (digits.length <= 5) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`
}

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
      notes: emp.notes ?? '',
    })
    setEditId(emp.id)
    setShowForm(true)
  }

  function handleDownload() {
    const rows = list.map((e) => ({
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
      메모: e.notes ?? '',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '구인처')
    XLSX.writeFile(wb, `구인처_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  function handleTemplateDownload() {
    const rows = [{ 회사명: '', 업종: '', 사업자등록번호: '', 구인직무: '', 구인인원: 0, 구인상태: '구인중', 구인신청일: '', 구인만료일: '', 담당자: '', 연락처: '', 지역: '', 주소: '', 메모: '' }]
    const ws = XLSX.utils.json_to_sheet(rows)
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
      const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws)
      const records = rows
        .filter((r) => r['회사명'])
        .map((r) => ({
          company_name: r['회사명'] ?? '',
          business_type: r['업종'] ?? '',
          business_reg_number: r['사업자등록번호'] ?? '',
          job_duty: r['구인직무'] ?? '',
          job_count: Number(r['구인인원'] ?? 0),
          hiring_status: r['구인상태'] ?? '구인중',
          job_application_date: r['구인신청일'] ? String(r['구인신청일']) : null,
          job_expiry_date: r['구인만료일'] ? String(r['구인만료일']) : null,
          contact_name: r['담당자'] ?? '',
          contact_phone: String(r['연락처'] ?? ''),
          region: r['지역'] ?? '',
          address: r['주소'] ?? '',
          notes: r['메모'] ?? '',
        }))
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
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h3 className="font-semibold mb-4">{editId ? '구인처 수정' : '구인처 등록'}</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
            {[
              { label: '회사명', key: 'company_name', required: true },
              { label: '업종', key: 'business_type' },
              { label: '담당자', key: 'contact_name' },
              { label: '연락처', key: 'contact_phone' },
              { label: '지역', key: 'region' },
              { label: '주소', key: 'address' },
            ].map(({ label, key, required }) => (
              <div key={key}>
                <label className="text-sm text-gray-600 mb-1 block">{label}</label>
                <input
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={(form as Record<string, unknown>)[key] as string}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  required={required}
                />
              </div>
            ))}
            <div>
              <label className="text-sm text-gray-600 mb-1 block">사업자등록번호</label>
              <input
                className="w-full border rounded-lg px-3 py-2 text-sm"
                placeholder="000-00-00000"
                value={form.business_reg_number}
                onChange={(e) => setForm({ ...form, business_reg_number: formatBizReg(e.target.value) })}
              />
            </div>
            <div>
              <label className="text-sm text-gray-600 mb-1 block">구인직무</label>
              <input
                className="w-full border rounded-lg px-3 py-2 text-sm"
                placeholder="예) 조리원, 요양보호사"
                value={form.job_duty}
                onChange={(e) => setForm({ ...form, job_duty: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm text-gray-600 mb-1 block">구인인원</label>
              <input
                type="number" min={0}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={form.job_count}
                onChange={(e) => setForm({ ...form, job_count: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="text-sm text-gray-600 mb-1 block">구인상태</label>
              <div className="flex gap-3 h-[38px] items-center">
                {['구인중', '만료'].map((s) => (
                  <label key={s} className="flex items-center gap-1.5 cursor-pointer">
                    <input type="radio" name="hiring_status" value={s}
                      checked={form.hiring_status === s}
                      onChange={() => setForm({ ...form, hiring_status: s })}
                      className="w-4 h-4" />
                    <span className="text-sm text-gray-700">{s}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm text-gray-600 mb-1 block">구인신청일</label>
              <input type="date"
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={form.job_application_date ?? ''}
                onChange={(e) => setForm({ ...form, job_application_date: e.target.value || null })} />
            </div>
            <div>
              <label className="text-sm text-gray-600 mb-1 block">구인만료일</label>
              <div className="flex gap-1.5">
                <input type="date"
                  className="flex-1 border rounded-lg px-3 py-2 text-sm"
                  value={form.job_expiry_date ?? ''}
                  onChange={(e) => setForm({ ...form, job_expiry_date: e.target.value || null })} />
                <button type="button" className="px-2.5 py-2 text-xs bg-blue-50 border border-blue-200 text-blue-600 rounded-lg hover:bg-blue-100 whitespace-nowrap"
                  onClick={() => { const d = new Date(form.job_application_date ?? new Date().toISOString().slice(0,10)); d.setMonth(d.getMonth()+3); setForm({...form, job_expiry_date: d.toISOString().slice(0,10)}) }}>3개월</button>
                <button type="button" className="px-2.5 py-2 text-xs bg-blue-50 border border-blue-200 text-blue-600 rounded-lg hover:bg-blue-100 whitespace-nowrap"
                  onClick={() => { const d = new Date(form.job_application_date ?? new Date().toISOString().slice(0,10)); d.setMonth(d.getMonth()+6); setForm({...form, job_expiry_date: d.toISOString().slice(0,10)}) }}>6개월</button>
              </div>
            </div>
            <div className="col-span-2">
              <label className="text-sm text-gray-600 mb-1 block">메모</label>
              <textarea
                className="w-full border rounded-lg px-3 py-2 text-sm"
                rows={2}
                value={form.notes ?? ''}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
            <div className="col-span-2 flex gap-2 justify-end">
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">취소</button>
              <button type="submit" className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">저장</button>
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
                {['회사명', '업종', '구인직무', '구인인원', '구인상태', '구인신청일', '구인만료일', '담당자', '연락처', '지역', '관리'].map((h) => (
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

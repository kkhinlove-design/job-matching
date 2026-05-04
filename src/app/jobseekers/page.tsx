'use client'

import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'
import { JobSeeker, PlacementHistory, EmploymentHistory, JobApplicationHistory } from '@/types'
import { useAuth } from '@/components/AuthProvider'
import { addMonthsExpiry } from '@/lib/date'

// ─── 주민등록번호 유틸 ───────────────────────────────────────
function calcAge(rn: string): number | null {
  const clean = rn.replace('-', '')
  if (clean.length < 7) return null
  const yy = parseInt(clean.slice(0, 2))
  const mm = parseInt(clean.slice(2, 4))
  const dd = parseInt(clean.slice(4, 6))
  const g = parseInt(clean[6])
  if (isNaN(g) || isNaN(mm) || isNaN(dd)) return null
  const year = [1, 2, 5, 6].includes(g) ? 1900 + yy : 2000 + yy
  const birth = new Date(year, mm - 1, dd)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  if (today.getMonth() < birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age--
  return age
}

function calcGender(rn: string): string {
  const clean = rn.replace('-', '')
  if (clean.length < 7) return ''
  const g = parseInt(clean[6])
  if (isNaN(g)) return ''
  return g % 2 === 1 ? '남' : '여'
}

function maskRN(rn: string): string {
  if (!rn) return ''
  const clean = rn.replace('-', '')
  if (clean.length < 7) return rn
  return `${clean.slice(0, 6)}-${clean[6]}******`
}

// ─── 유틸 ──────────────────────────────────────────────────
// 로컬(KST) 기준 오늘 날짜를 YYYY-MM-DD로 반환 (toISOString은 UTC라 D-1 버그 발생)
function todayLocal(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

function formatBizReg(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 10)
  if (digits.length <= 3) return digits
  if (digits.length <= 5) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`
}

// ─── 상수 ──────────────────────────────────────────────────
const EDUCATION_OPTIONS = ['무학', '초졸', '중졸', '고졸', '전문대졸', '대졸', '대학원졸']
const EMPLOYMENT_TYPE_OPTIONS = ['알선취업', '본인취업']
const INCENTIVES = ['채움프로젝트', '청년 버팀목', '새싹정착', '보건증발급', '복리후생']

type FormData = Omit<JobSeeker, 'id' | 'seq_no' | 'created_at' | 'placement_history'>

const emptyForm: FormData = {
  service_date: todayLocal(),
  name: '',
  resident_number: '',
  education: '',
  phone: '',
  region: '',
  desired_job: '',
  desired_job_code: '',
  career_years: 0,
  certifications: '',
  desired_salary: null,
  active: true,
  job_category: '',
  job_application_date: null,
  job_expiry_date: null,
  job_application_place: '',
  manager_name: '',
  employment_type: '',
  employment_date: null,
  employment_company: '',
  business_reg_number: '',
  incentives: [],
  notes: '',
}

type PlacementRow = { id?: string; placement_date: string; company: string; business_reg_number: string }
type EmpHistoryRow = { id?: string; employment_date: string; resignation_date: string; company: string; employment_type: string }
type AppHistoryRow = { id?: string; application_date: string; expiry_date: string; application_place: string; job_category: string }

// ─── 컴포넌트 ──────────────────────────────────────────────
export default function JobSeekersPage() {
  const { userName } = useAuth()
  const searchParams = useSearchParams()
  const [list, setList] = useState<JobSeeker[]>([])
  const [form, setForm] = useState<FormData>(emptyForm)
  const [editId, setEditId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [employmentFilter, setEmploymentFilter] = useState<string>('')
  const [categoryFilter, setCategoryFilter] = useState<string>('')
  const [uploadMsg, setUploadMsg] = useState('')
  const [placements, setPlacements] = useState<PlacementRow[]>([])
  const [empHistories, setEmpHistories] = useState<EmpHistoryRow[]>([])
  const [appHistories, setAppHistories] = useState<AppHistoryRow[]>([])
  const [showRN, setShowRN] = useState(false)        // 주민번호 보기 토글
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const fileRef = useRef<HTMLInputElement>(null)

  async function fetchList() {
    const { data } = await supabase
      .from('job_seekers')
      .select('*, placement_history(*), employment_history(*), job_application_history(*)')
      .order('seq_no', { ascending: true })
    setList(data ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchList() }, [])
  useEffect(() => {
    const type = searchParams.get('type')
    if (type) setEmploymentFilter(type)
    const category = searchParams.get('category')
    if (category) setCategoryFilter(category)
  }, [searchParams])

  function openNew() {
    setForm({ ...emptyForm, manager_name: userName })
    setEditId(null)
    setPlacements([])
    setEmpHistories([])
    setAppHistories([])
    setShowRN(false)
    setShowForm(true)
  }

  function openEdit(js: JobSeeker) {
    setForm({
      service_date: js.service_date ?? '',
      name: js.name,
      resident_number: js.resident_number ?? '',
      education: js.education ?? '',
      phone: js.phone,
      region: js.region,
      desired_job: js.desired_job,
      desired_job_code: js.desired_job_code,
      career_years: js.career_years,
      certifications: js.certifications ?? '',
      desired_salary: js.desired_salary,
      active: js.active,
      job_category: js.job_category ?? '',
      job_application_date: js.job_application_date ?? null,
      job_expiry_date: js.job_expiry_date ?? null,
      job_application_place: js.job_application_place ?? '',
      manager_name: js.manager_name ?? '',
      employment_type: js.employment_type ?? '',
      employment_date: js.employment_date ?? null,
      employment_company: js.employment_company ?? '',
      business_reg_number: js.business_reg_number ?? '',
      incentives: js.incentives ?? [],
      notes: js.notes ?? '',
    })
    setPlacements(
      (js.placement_history ?? [])
        .sort((a, b) => a.placement_date.localeCompare(b.placement_date))
        .map((h) => ({ id: h.id, placement_date: h.placement_date, company: h.company, business_reg_number: h.business_reg_number ?? '' }))
    )
    setEmpHistories(
      (js.employment_history ?? [])
        .sort((a, b) => a.employment_date.localeCompare(b.employment_date))
        .map((h) => ({ id: h.id, employment_date: h.employment_date, resignation_date: h.resignation_date ?? '', company: h.company, employment_type: h.employment_type ?? '' }))
    )
    setAppHistories(
      (js.job_application_history ?? [])
        .sort((a, b) => a.application_date.localeCompare(b.application_date))
        .map((h) => ({ id: h.id, application_date: h.application_date, expiry_date: h.expiry_date ?? '', application_place: h.application_place ?? '', job_category: h.job_category ?? '' }))
    )
    setEditId(js.id)
    setShowRN(false)
    setShowForm(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    let seekerId = editId

    if (editId) {
      const { error } = await supabase.from('job_seekers').update(form).eq('id', editId)
      if (error) { alert('저장 실패: ' + error.message); return }
    } else {
      const { data, error } = await supabase.from('job_seekers').insert(form).select('id').single()
      if (error) { alert('저장 실패: ' + error.message); return }
      seekerId = data?.id ?? null
    }

    // 현재 취업 상태가 설정되어 있으면 취업이력에 자동 동기화
    if (seekerId && form.employment_type && form.employment_company) {
      const alreadyExists = empHistories.some(
        (h) => h.company === form.employment_company && h.employment_type === form.employment_type
      )
      if (!alreadyExists) {
        empHistories.push({
          employment_date: form.employment_date ?? todayLocal(),
          resignation_date: '',
          company: form.employment_company,
          employment_type: form.employment_type,
        })
        setEmpHistories([...empHistories])
      }
    }

    // 알선이력 저장: 기존 삭제 후 재삽입
    if (seekerId) {
      await supabase.from('placement_history').delete().eq('jobseeker_id', seekerId)
      const validPlacements = placements.filter((p) => p.placement_date && p.company)
      if (validPlacements.length > 0) {
        const { error } = await supabase.from('placement_history').insert(
          validPlacements.map((p) => ({
            jobseeker_id: seekerId,
            placement_date: p.placement_date,
            company: p.company,
            business_reg_number: p.business_reg_number || null,
          }))
        )
        if (error) { alert('알선이력 저장 실패: ' + error.message); return }
      }

      // 취업이력 저장
      await supabase.from('employment_history').delete().eq('jobseeker_id', seekerId)
      const validEmpHistories = empHistories.filter((h) => h.employment_date && h.company)
      if (validEmpHistories.length > 0) {
        const { error: ehError } = await supabase.from('employment_history').insert(
          validEmpHistories.map((h) => ({
            jobseeker_id: seekerId,
            employment_date: h.employment_date,
            resignation_date: h.resignation_date || null,
            company: h.company,
            employment_type: h.employment_type || null,
          }))
        )
        if (ehError) { alert('취업이력 저장 실패: ' + ehError.message); return }
      }

      // 구직신청이력 저장
      await supabase.from('job_application_history').delete().eq('jobseeker_id', seekerId)
      const validAppHistories = appHistories.filter((h) => h.application_date)
      if (validAppHistories.length > 0) {
        const { error: ahError } = await supabase.from('job_application_history').insert(
          validAppHistories.map((h) => ({
            jobseeker_id: seekerId,
            application_date: h.application_date,
            expiry_date: h.expiry_date || null,
            application_place: h.application_place || null,
            job_category: h.job_category || null,
          }))
        )
        if (ahError) { alert('구직신청이력 저장 실패: ' + ahError.message); return }
      }
    }

    setShowForm(false)
    fetchList()
  }

  async function handleDelete(id: string) {
    if (!confirm('삭제하시겠습니까? 알선이력도 함께 삭제됩니다.')) return
    await supabase.from('job_seekers').delete().eq('id', id)
    fetchList()
  }

  // ─── 선택/전체 삭제 ─────────────────────────────────────
  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  function toggleSelectAll() {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filtered.map((js) => js.id)))
    }
  }
  async function handleDeleteSelected() {
    if (selectedIds.size === 0) return
    if (!confirm(`선택한 ${selectedIds.size}명을 삭제하시겠습니까? 관련 이력도 함께 삭제됩니다.`)) return
    const ids = Array.from(selectedIds)
    await supabase.from('job_seekers').delete().in('id', ids)
    setSelectedIds(new Set())
    fetchList()
  }
  async function handleDeleteAll() {
    if (filtered.length === 0) return
    if (!confirm(`현재 표시된 ${filtered.length}명을 전체 삭제하시겠습니까? 관련 이력도 함께 삭제됩니다.`)) return
    if (!confirm('정말로 전체 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return
    const ids = filtered.map((js) => js.id)
    await supabase.from('job_seekers').delete().in('id', ids)
    setSelectedIds(new Set())
    fetchList()
  }

  // ─── 알선이력 행 관리 ────────────────────────────────────
  function addPlacement() {
    setPlacements((prev) => [...prev, { placement_date: todayLocal(), company: '', business_reg_number: '' }])
  }
  function removePlacement(idx: number) {
    setPlacements((prev) => prev.filter((_, i) => i !== idx))
  }
  function updatePlacement(idx: number, field: keyof PlacementRow, value: string) {
    setPlacements((prev) => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p))
  }

  // ─── 구직신청이력 행 관리 ──────────────────────────────────
  function addAppHistory() {
    setAppHistories((prev) => [...prev, { application_date: todayLocal(), expiry_date: '', application_place: '', job_category: '' }])
  }
  function removeAppHistory(idx: number) {
    setAppHistories((prev) => prev.filter((_, i) => i !== idx))
  }
  function updateAppHistory(idx: number, field: keyof AppHistoryRow, value: string) {
    setAppHistories((prev) => prev.map((h, i) => i === idx ? { ...h, [field]: value } : h))
  }

  // ─── 취업이력 행 관리 ─────────────────────────────────────
  function addEmpHistory() {
    setEmpHistories((prev) => [...prev, { employment_date: todayLocal(), resignation_date: '', company: '', employment_type: '' }])
  }
  function removeEmpHistory(idx: number) {
    setEmpHistories((prev) => prev.filter((_, i) => i !== idx))
  }
  function updateEmpHistory(idx: number, field: keyof EmpHistoryRow, value: string) {
    setEmpHistories((prev) => prev.map((h, i) => i === idx ? { ...h, [field]: value } : h))
  }

  // ─── 엑셀 ────────────────────────────────────────────────
  function handleDownload() {
    const wb = XLSX.utils.book_new()

    // Sheet1: 구직자 기본 정보
    const mainRows = list.map((js, idx) => {
      const incs = js.incentives ?? []
      const row: Record<string, string | number> = {
        연번: idx + 1,
        서비스신청일: js.service_date ?? '',
        구직신청일: js.job_application_date ?? '',
        구직기간만료일: js.job_expiry_date ?? '',
        구직자구분: js.job_category ?? '',
        이름: js.name,
        주민등록번호: js.resident_number ?? '',
        성별: calcGender(js.resident_number ?? ''),
        만나이: calcAge(js.resident_number ?? '') ?? '',
        최종학력: js.education ?? '',
        휴대폰번호: js.phone,
        거주지: js.region,
        구직신청여부: js.active ? 'Y' : 'N',
        구직신청처: js.job_application_place ?? '',
        담당자: js.manager_name ?? '',
        희망직종: js.desired_job,
        경력: js.career_years,
        '희망급여(만원)': js.desired_salary ?? '',
        자격증: js.certifications ?? '',
        알선횟수: js.placement_history?.length ?? 0,
        취업횟수: js.employment_history?.length ?? 0,
        현재취업형태: js.employment_type ?? '',
        현재취업일자: js.employment_date ?? '',
        현재취업처: js.employment_company ?? '',
        현재사업자등록번호: js.business_reg_number ?? '',
      }
      for (const p of INCENTIVES) row[`장려금_${p}`] = incs.includes(p) ? 'Y' : ''
      row['장려금수령건수'] = incs.length
      row['메모'] = js.notes ?? ''
      return row
    })
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(mainRows), '구직자')

    // 장려금 집계 시트
    const incentiveSummary: Record<string, string | number>[] = INCENTIVES.map((p) => ({
      장려금: p,
      수령자수: list.filter((js) => (js.incentives ?? []).includes(p)).length,
    }))
    const multiCount = list.filter((js) => (js.incentives ?? []).length >= 2).length
    incentiveSummary.push({ 장려금: '2개이상 수령자', 수령자수: multiCount })
    incentiveSummary.push({ 장려금: '미수령', 수령자수: list.filter((js) => !(js.incentives ?? []).length).length })
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(incentiveSummary), '장려금집계')

    // Sheet2: 취업이력 전체
    const empRows: Record<string, unknown>[] = []
    list.forEach((js, idx) => {
      (js.employment_history ?? [])
        .sort((a, b) => a.employment_date.localeCompare(b.employment_date))
        .forEach((h, hIdx) => {
          empRows.push({
            연번: idx + 1,
            이름: js.name,
            휴대폰번호: js.phone,
            거주지: js.region,
            취업순번: hIdx + 1,
            취업형태: h.employment_type ?? '',
            취업일자: h.employment_date,
            퇴사일자: h.resignation_date ?? '',
            취업처: h.company,
          })
        })
    })
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(empRows.length > 0 ? empRows : [{ 데이터없음: '' }]), '취업이력')

    // Sheet3: 구직신청이력 전체
    const appRows: Record<string, unknown>[] = []
    list.forEach((js, idx) => {
      (js.job_application_history ?? [])
        .sort((a, b) => a.application_date.localeCompare(b.application_date))
        .forEach((h, hIdx) => {
          appRows.push({
            연번: idx + 1,
            이름: js.name,
            휴대폰번호: js.phone,
            신청순번: hIdx + 1,
            구직신청일: h.application_date,
            구직기간만료일: h.expiry_date ?? '',
            구직신청처: h.application_place ?? '',
            구직자구분: h.job_category ?? '',
          })
        })
    })
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(appRows.length > 0 ? appRows : [{ 데이터없음: '' }]), '구직신청이력')

    // Sheet4: 알선이력 전체
    const plcRows: Record<string, unknown>[] = []
    list.forEach((js, idx) => {
      (js.placement_history ?? [])
        .sort((a, b) => a.placement_date.localeCompare(b.placement_date))
        .forEach((h, hIdx) => {
          plcRows.push({
            연번: idx + 1,
            이름: js.name,
            휴대폰번호: js.phone,
            알선순번: hIdx + 1,
            알선일자: h.placement_date,
            알선처: h.company,
            사업자등록번호: h.business_reg_number ?? '',
          })
        })
    })
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(plcRows.length > 0 ? plcRows : [{ 데이터없음: '' }]), '알선이력')

    // Sheet5: 취업이력 (이미 Sheet2로 있음 — 순서 조정 완료)

    XLSX.writeFile(wb, `구직자_${todayLocal()}.xlsx`)
  }

  function handleTemplateDownload() {
    const rows = [{
      서비스신청일: '', 구직신청일: '', 구직기간만료일: '', 구직자구분: '',
      이름: '', 주민등록번호: '', 최종학력: '', 휴대폰번호: '',
      거주지: '', 희망직종: '', 경력: 0, '희망급여(만원)': '', 자격증: '',
      구직신청여부: 'Y', 구직신청처: '', 담당자: '',
      취업형태: '', 취업일자: '', 취업처: '', 사업자등록번호: '', 메모: '',
    }]
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '구직자')
    XLSX.writeFile(wb, '구직자_업로드양식.xlsx')
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadMsg('업로드 중...')
    try {
      const buf = await file.arrayBuffer()
      // cellDates를 쓰지 않고 원본값(시리얼/문자열) 그대로 받아 타임존 영향 제거
      const wb = XLSX.read(buf)
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<Record<string, string | number | Date>>(ws, { raw: true })

      function toDateStr(val: string | number | Date | undefined | null): string | null {
        if (val === null || val === undefined || val === '') return null
        // 엑셀 시리얼(숫자) → UTC 연산만으로 날짜 추출 (타임존 무관)
        if (typeof val === 'number') {
          const ms = Math.round((val - 25569) * 86400 * 1000)
          const d = new Date(ms)
          const y = d.getUTCFullYear()
          const m = String(d.getUTCMonth() + 1).padStart(2, '0')
          const dd = String(d.getUTCDate()).padStart(2, '0')
          return `${y}-${m}-${dd}`
        }
        // Date 객체인 경우도 UTC 기준으로 통일
        if (val instanceof Date) {
          const y = val.getUTCFullYear()
          const m = String(val.getUTCMonth() + 1).padStart(2, '0')
          const dd = String(val.getUTCDate()).padStart(2, '0')
          return `${y}-${m}-${dd}`
        }
        // 문자열: "YYYY-MM-DD" / "YYYY/MM/DD" / "YYYY.MM.DD" 파싱
        const s = String(val).trim()
        const match = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/)
        if (match) {
          return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`
        }
        return s || null
      }

      const records = rows
        .filter((r) => r['이름'] && r['휴대폰번호'])
        .map((r) => ({
          service_date: toDateStr(r['서비스신청일'] as string | number | Date),
          name: String(r['이름']),
          resident_number: String(r['주민등록번호'] ?? ''),
          education: String(r['최종학력'] ?? ''),
          phone: String(r['휴대폰번호']),
          region: String(r['거주지'] ?? ''),
          desired_job: String(r['희망직종'] ?? ''),
          desired_job_code: '',
          career_years: Number(r['경력'] ?? 0),
          desired_salary: r['희망급여(만원)'] ? Number(r['희망급여(만원)']) : null,
          certifications: String(r['자격증'] ?? ''),
          active: String(r['구직신청여부'] ?? 'Y').toUpperCase() !== 'N',
          job_application_place: String(r['구직신청처'] ?? ''),
          employment_type: String(r['취업형태'] ?? ''),
          employment_date: toDateStr(r['취업일자'] as string | number | Date),
          employment_company: String(r['취업처'] ?? ''),
          business_reg_number: String(r['사업자등록번호'] ?? ''),
          notes: String(r['메모'] ?? ''),
        }))
      if (records.length === 0) {
        setUploadMsg('유효한 데이터가 없습니다. (이름, 휴대폰번호 필수)')
        return
      }
      const { error } = await supabase.from('job_seekers').insert(records)
      if (error) throw error
      setUploadMsg(`${records.length}건 업로드 완료`)
      fetchList()
    } catch (err) {
      const msg = (err as { message?: string })?.message ?? JSON.stringify(err)
      setUploadMsg('업로드 실패: ' + msg)
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  // ─── 파생값 ──────────────────────────────────────────────
  const rn = form.resident_number ?? ''
  const autoGender = calcGender(rn)
  const autoAge = calcAge(rn)

  const filtered = list.filter((js) => {
    if (employmentFilter && js.employment_type !== employmentFilter) return false
    if (categoryFilter && js.job_category !== categoryFilter) return false
    if (!search) return true
    const s = search.toLowerCase()
    const gender = calcGender(js.resident_number ?? '')
    const age = calcAge(js.resident_number ?? '')
    return [
      js.name,
      js.phone,
      js.desired_job,
      js.region,
      js.education,
      js.certifications,
      js.employment_company,
      js.employment_type,
      js.job_application_place,
      js.business_reg_number,
      js.notes,
      js.service_date,
      js.employment_date,
      gender,
      age !== null ? `${age}세` : '',
      js.active ? '구직신청' : '',
      ...(js.placement_history ?? []).map((h) => h.company),
    ].some((v) => v && String(v).toLowerCase().includes(s))
  }
  )

  // ─── 렌더 ────────────────────────────────────────────────
  return (
    <div>
      {/* 헤더 */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">구직자 관리</h2>
        <div className="flex gap-2">
          <button onClick={handleTemplateDownload} className="border px-4 py-2 rounded-lg text-sm hover:bg-gray-50 text-gray-600">양식 다운로드</button>
          <label className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-orange-600 cursor-pointer">
            엑셀 업로드
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleUpload} />
          </label>
          <button onClick={handleDownload} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-emerald-700">엑셀 다운로드</button>
          <button onClick={openNew} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">+ 구직자 등록</button>
        </div>
      </div>

      {uploadMsg && <div className="mb-4 p-3 bg-orange-50 text-orange-700 rounded-lg text-sm">{uploadMsg}</div>}

      {/* 등록/수정 폼 */}
      {showForm && (
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-5 mb-6">
          {/* 폼 타이틀 */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <span className="w-2 h-6 rounded bg-blue-500 inline-block" />
              <h3 className="font-bold text-gray-800 text-base">{editId ? '구직자 수정' : '구직자 등록'}</h3>
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
                  <label className="text-xs font-medium text-gray-500 mb-1 block">서비스신청일</label>
                  <input type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-blue-400 focus:border-blue-400 outline-none"
                    value={form.service_date ?? ''}
                    onChange={(e) => setForm({ ...form, service_date: e.target.value || null })} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">구직신청일</label>
                  <input type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-blue-400 focus:border-blue-400 outline-none"
                    value={form.job_application_date ?? ''}
                    onChange={(e) => setForm({ ...form, job_application_date: e.target.value || null })} />
                </div>
                <div className="lg:col-span-2">
                  <label className="text-xs font-medium text-gray-500 mb-1 block">구직기간만료일</label>
                  <div className="flex gap-1.5">
                    <input type="date" className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-blue-400 focus:border-blue-400 outline-none"
                      value={form.job_expiry_date ?? ''}
                      onChange={(e) => setForm({ ...form, job_expiry_date: e.target.value || null })} />
                    <button type="button" className="px-2.5 py-2 text-xs bg-blue-50 border border-blue-200 text-blue-600 rounded-lg hover:bg-blue-100 whitespace-nowrap"
                      onClick={() => setForm({ ...form, job_expiry_date: addMonthsExpiry(form.job_application_date, 3) })}>3개월</button>
                    <button type="button" className="px-2.5 py-2 text-xs bg-blue-50 border border-blue-200 text-blue-600 rounded-lg hover:bg-blue-100 whitespace-nowrap"
                      onClick={() => setForm({ ...form, job_expiry_date: addMonthsExpiry(form.job_application_date, 6) })}>6개월</button>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">이름 <span className="text-red-400">*</span></label>
                  <input required className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-blue-400 focus:border-blue-400 outline-none"
                    value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="lg:col-span-2">
                  <label className="text-xs font-medium text-gray-500 mb-1 flex items-center gap-2">
                    주민등록번호
                    <button type="button" onClick={() => setShowRN(!showRN)} className="text-blue-500 underline font-normal">{showRN ? '가리기' : '보기'}</button>
                  </label>
                  <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:ring-1 focus:ring-blue-400 focus:border-blue-400 outline-none"
                    placeholder="000000-0000000" type={showRN ? 'text' : 'password'}
                    value={form.resident_number ?? ''} onChange={(e) => setForm({ ...form, resident_number: e.target.value })} maxLength={14} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">성별 / 나이 <span className="text-gray-300 font-normal">(자동)</span></label>
                  <div className="flex gap-1.5">
                    <div className={`flex-1 border rounded-lg px-3 py-2 text-sm text-center font-medium ${autoGender === '남' ? 'bg-blue-50 border-blue-200 text-blue-600' : autoGender === '여' ? 'bg-pink-50 border-pink-200 text-pink-600' : 'bg-gray-50 border-gray-200 text-gray-400'}`}>
                      {autoGender || '-'}
                    </div>
                    <div className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500 text-center">
                      {autoAge !== null ? `${autoAge}세` : '-'}
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">최종학력</label>
                  <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-blue-400 outline-none"
                    value={form.education ?? ''} onChange={(e) => setForm({ ...form, education: e.target.value })}>
                    <option value="">선택</option>
                    {EDUCATION_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">휴대폰번호 <span className="text-red-400">*</span></label>
                  <input required className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-blue-400 focus:border-blue-400 outline-none"
                    placeholder="010-0000-0000" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">거주지</label>
                  <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-blue-400 focus:border-blue-400 outline-none"
                    value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">담당자</label>
                  <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 focus:ring-1 focus:ring-blue-400 focus:border-blue-400 outline-none"
                    value={form.manager_name ?? ''} onChange={(e) => setForm({ ...form, manager_name: e.target.value })} />
                </div>
              </div>
            </div>

            {/* ── 2. 구직 정보 ── */}
            <div className="bg-white rounded-xl border border-green-100 overflow-hidden">
              <div className="flex items-center gap-2.5 px-4 py-2.5 bg-green-50 border-b border-green-100">
                <span className="w-5 h-5 rounded-full bg-green-500 text-white text-xs flex items-center justify-center font-bold shrink-0">2</span>
                <span className="text-sm font-semibold text-green-700">구직 정보</span>
                {form.active && form.job_category && (
                  <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-green-200 text-green-800 font-medium">{form.job_category}</span>
                )}
              </div>
              <div className="p-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="lg:col-span-2">
                  <label className="text-xs font-medium text-gray-500 mb-1 block">구직신청여부</label>
                  <div className="flex items-center gap-2 h-[38px]">
                    <label className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${form.active ? 'bg-green-50 border-green-300 text-green-700' : 'border-gray-200 text-gray-400'}`}>
                      <input type="checkbox" id="active" checked={form.active}
                        onChange={(e) => setForm({ ...form, active: e.target.checked })} className="w-4 h-4" />
                      <span className="text-sm font-medium">{form.active ? '구직신청 중' : '미신청'}</span>
                    </label>
                    {form.active && (
                      <select className="border border-gray-200 rounded-lg px-2 py-2 text-sm focus:ring-1 focus:ring-green-400 outline-none"
                        value={form.job_category ?? ''} onChange={(e) => setForm({ ...form, job_category: e.target.value })}>
                        <option value="">구분 선택</option>
                        <option value="식품센터">식품센터</option>
                        <option value="그 외">그 외</option>
                      </select>
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">구직신청처</label>
                  <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-green-400 outline-none"
                    placeholder="신청 기관명" value={form.job_application_place ?? ''}
                    onChange={(e) => setForm({ ...form, job_application_place: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">희망직종</label>
                  <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-green-400 outline-none"
                    value={form.desired_job} onChange={(e) => setForm({ ...form, desired_job: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">경력(년)</label>
                  <input type="number" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-green-400 outline-none"
                    value={form.career_years} onChange={(e) => setForm({ ...form, career_years: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">희망급여(만원)</label>
                  <input type="number" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-green-400 outline-none"
                    value={form.desired_salary ?? ''} onChange={(e) => setForm({ ...form, desired_salary: e.target.value ? Number(e.target.value) : null })} />
                </div>
                <div className="lg:col-span-2">
                  <label className="text-xs font-medium text-gray-500 mb-1 block">자격증</label>
                  <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-green-400 outline-none"
                    placeholder="쉼표로 구분" value={form.certifications ?? ''}
                    onChange={(e) => setForm({ ...form, certifications: e.target.value })} />
                </div>
              </div>
            </div>

            {/* ── 3. 구직신청이력 ── */}
            <div className="bg-white rounded-xl border border-sky-100 overflow-hidden">
              <div className="flex items-center gap-2.5 px-4 py-2.5 bg-sky-50 border-b border-sky-100">
                <span className="w-5 h-5 rounded-full bg-sky-500 text-white text-xs flex items-center justify-center font-bold shrink-0">3</span>
                <span className="text-sm font-semibold text-sky-700">구직신청이력</span>
                {appHistories.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-xs bg-sky-200 text-sky-800 font-medium">{appHistories.length}회</span>
                )}
                <button type="button" onClick={addAppHistory}
                  className="ml-auto text-xs bg-sky-100 text-sky-700 px-3 py-1 rounded-lg hover:bg-sky-200 font-medium">+ 추가</button>
              </div>
              <div className="p-4">
                {appHistories.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-2">구직신청이력이 없습니다.</p>
                ) : (
                  <div className="space-y-2">
                    {appHistories.map((h, idx) => (
                      <div key={idx} className="flex gap-2 items-center flex-wrap bg-sky-50 rounded-lg px-3 py-2">
                        <span className="text-xs text-sky-500 font-bold w-5 shrink-0">{idx + 1}</span>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-gray-400 whitespace-nowrap">신청일</span>
                          <input type="date" className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
                            value={h.application_date} onChange={(e) => updateAppHistory(idx, 'application_date', e.target.value)} />
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-gray-400 whitespace-nowrap">만료일</span>
                          <input type="date" className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
                            value={h.expiry_date} onChange={(e) => updateAppHistory(idx, 'expiry_date', e.target.value)} />
                          <button type="button" className="px-2 py-1.5 text-xs bg-sky-100 border border-sky-200 text-sky-600 rounded-lg hover:bg-sky-200 whitespace-nowrap"
                            onClick={() => updateAppHistory(idx, 'expiry_date', addMonthsExpiry(h.application_date, 3))}>3개월</button>
                          <button type="button" className="px-2 py-1.5 text-xs bg-sky-100 border border-sky-200 text-sky-600 rounded-lg hover:bg-sky-200 whitespace-nowrap"
                            onClick={() => updateAppHistory(idx, 'expiry_date', addMonthsExpiry(h.application_date, 6))}>6개월</button>
                        </div>
                        <input className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm min-w-[100px]" placeholder="신청처"
                          value={h.application_place} onChange={(e) => updateAppHistory(idx, 'application_place', e.target.value)} />
                        <select className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
                          value={h.job_category} onChange={(e) => updateAppHistory(idx, 'job_category', e.target.value)}>
                          <option value="">구분</option>
                          <option value="식품센터">식품센터</option>
                          <option value="그 외">그 외</option>
                        </select>
                        <button type="button" onClick={() => removeAppHistory(idx)}
                          className="text-red-400 hover:text-red-600 text-sm shrink-0">✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ── 4. 알선이력 ── */}
            <div className="bg-white rounded-xl border border-amber-100 overflow-hidden">
              <div className="flex items-center gap-2.5 px-4 py-2.5 bg-amber-50 border-b border-amber-100">
                <span className="w-5 h-5 rounded-full bg-amber-400 text-white text-xs flex items-center justify-center font-bold shrink-0">4</span>
                <span className="text-sm font-semibold text-amber-700">알선이력</span>
                {placements.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-xs bg-amber-200 text-amber-800 font-medium">{placements.length}회</span>
                )}
                <button type="button" onClick={addPlacement}
                  className="ml-auto text-xs bg-amber-100 text-amber-700 px-3 py-1 rounded-lg hover:bg-amber-200 font-medium">+ 추가</button>
              </div>
              <div className="p-4">
                {placements.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-2">알선이력이 없습니다.</p>
                ) : (
                  <div className="space-y-2">
                    {placements.map((p, idx) => (
                      <div key={idx} className="flex gap-2 items-center bg-amber-50 rounded-lg px-3 py-2">
                        <span className="text-xs text-amber-500 font-bold w-5 shrink-0">{idx+1}</span>
                        <input type="date" className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
                          value={p.placement_date} onChange={(e) => updatePlacement(idx, 'placement_date', e.target.value)} />
                        <input className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm" placeholder="알선처"
                          value={p.company} onChange={(e) => updatePlacement(idx, 'company', e.target.value)} />
                        <input className="w-32 border border-gray-200 rounded-lg px-2 py-1.5 text-sm" placeholder="사업자번호"
                          value={p.business_reg_number} onChange={(e) => updatePlacement(idx, 'business_reg_number', formatBizReg(e.target.value))} />
                        <button type="button" onClick={() => removePlacement(idx)}
                          className="text-red-400 hover:text-red-600 text-sm shrink-0">✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ── 5. 취업이력 ── */}
            <div className="bg-white rounded-xl border border-purple-100 overflow-hidden">
              <div className="flex items-center gap-2.5 px-4 py-2.5 bg-purple-50 border-b border-purple-100">
                <span className="w-5 h-5 rounded-full bg-purple-500 text-white text-xs flex items-center justify-center font-bold shrink-0">5</span>
                <span className="text-sm font-semibold text-purple-700">취업이력</span>
                {empHistories.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-xs bg-purple-200 text-purple-800 font-medium">{empHistories.length}회</span>
                )}
                <button type="button" onClick={addEmpHistory}
                  className="ml-auto text-xs bg-purple-100 text-purple-700 px-3 py-1 rounded-lg hover:bg-purple-200 font-medium">+ 추가</button>
              </div>
              <div className="p-4">
                {empHistories.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-2">취업이력이 없습니다.</p>
                ) : (
                  <div className="space-y-2">
                    {empHistories.map((h, idx) => (
                      <div key={idx} className="flex gap-2 items-center flex-wrap bg-purple-50 rounded-lg px-3 py-2">
                        <span className="text-xs text-purple-500 font-bold w-5 shrink-0">{idx+1}</span>
                        <select className={`border rounded-lg px-2 py-1.5 text-xs font-medium ${h.employment_type === '알선취업' ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : h.employment_type === '본인취업' ? 'border-teal-300 bg-teal-50 text-teal-700' : 'border-gray-200 text-gray-500'}`}
                          value={h.employment_type} onChange={(e) => updateEmpHistory(idx, 'employment_type', e.target.value)}>
                          <option value="">유형</option>
                          <option value="알선취업">알선취업</option>
                          <option value="본인취업">본인취업</option>
                        </select>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-gray-400">취업일</span>
                          <input type="date" className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
                            value={h.employment_date} onChange={(e) => updateEmpHistory(idx, 'employment_date', e.target.value)} />
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-gray-400">퇴사일</span>
                          <input type="date" className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
                            value={h.resignation_date} onChange={(e) => updateEmpHistory(idx, 'resignation_date', e.target.value)} />
                        </div>
                        <input className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm min-w-[100px]" placeholder="취업처"
                          value={h.company} onChange={(e) => updateEmpHistory(idx, 'company', e.target.value)} />
                        <button type="button" onClick={() => removeEmpHistory(idx)}
                          className="text-red-400 hover:text-red-600 text-sm shrink-0">✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ── 6. 현재 취업 상태 ── */}
            <div className="bg-white rounded-xl border border-indigo-100 overflow-hidden">
              <div className="flex items-center gap-2.5 px-4 py-2.5 bg-indigo-50 border-b border-indigo-100">
                <span className="w-5 h-5 rounded-full bg-indigo-500 text-white text-xs flex items-center justify-center font-bold shrink-0">6</span>
                <span className="text-sm font-semibold text-indigo-700">현재 취업 상태</span>
                {form.employment_type && (
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${form.employment_type === '알선취업' ? 'bg-indigo-200 text-indigo-800' : 'bg-teal-100 text-teal-800'}`}>{form.employment_type}</span>
                )}
              </div>
              <div className="p-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">취업형태</label>
                  <div className="flex gap-2 flex-wrap">
                    {EMPLOYMENT_TYPE_OPTIONS.map((o) => (
                      <label key={o} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border cursor-pointer text-sm transition-colors ${form.employment_type === o ? (o === '알선취업' ? 'bg-indigo-100 border-indigo-400 text-indigo-700 font-medium' : 'bg-teal-50 border-teal-400 text-teal-700 font-medium') : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                        <input type="radio" name="employment_type" value={o}
                          checked={form.employment_type === o}
                          onChange={() => setForm({ ...form, employment_type: o, active: false })}
                          className="w-3.5 h-3.5" />
                        {o}
                      </label>
                    ))}
                    {form.employment_type && (
                      <button type="button" onClick={() => setForm({ ...form, employment_type: '', active: true })}
                        className="text-xs text-gray-400 hover:text-gray-600 px-1">초기화</button>
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">취업일자</label>
                  <input type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-400 outline-none"
                    value={form.employment_date ?? ''} onChange={(e) => setForm({ ...form, employment_date: e.target.value || null })} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">취업처</label>
                  {form.employment_type === '알선취업' && placements.filter(p => p.company).length > 0 ? (
                    <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-400 outline-none"
                      value={form.employment_company ?? ''}
                      onChange={(e) => {
                        const selected = placements.find(p => p.company === e.target.value)
                        setForm({ ...form, employment_company: e.target.value, ...(selected ? { employment_date: selected.placement_date } : {}) })
                      }}>
                      <option value="">알선처 선택</option>
                      {placements.filter(p => p.company).map((p, i) => (
                        <option key={i} value={p.company}>{p.placement_date} — {p.company}</option>
                      ))}
                    </select>
                  ) : (
                    <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-400 outline-none"
                      value={form.employment_company ?? ''} onChange={(e) => setForm({ ...form, employment_company: e.target.value })} />
                  )}
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">사업자등록번호</label>
                  <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-400 outline-none"
                    placeholder="000-00-00000" value={form.business_reg_number ?? ''}
                    onChange={(e) => setForm({ ...form, business_reg_number: formatBizReg(e.target.value) })} />
                </div>
              </div>
            </div>

            {/* ── 7. 장려금 지원 ── */}
            <div className="bg-white rounded-xl border border-rose-100 overflow-hidden">
              <div className="flex items-center gap-2.5 px-4 py-2.5 bg-rose-50 border-b border-rose-100">
                <span className="w-5 h-5 rounded-full bg-rose-500 text-white text-xs flex items-center justify-center font-bold shrink-0">7</span>
                <span className="text-sm font-semibold text-rose-700">장려금 지원</span>
                <span className="text-xs text-rose-400">중복 선택 가능</span>
                {(form.incentives ?? []).length > 0 && (
                  <span className="ml-auto px-2 py-0.5 rounded-full text-xs bg-rose-200 text-rose-800 font-medium">{(form.incentives ?? []).length}건 수령</span>
                )}
              </div>
              <div className="p-4 flex flex-wrap gap-2">
                {INCENTIVES.map((p) => {
                  const checked = (form.incentives ?? []).includes(p)
                  return (
                    <label key={p} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border cursor-pointer text-sm transition-colors ${checked ? 'bg-rose-100 border-rose-400 text-rose-700 font-medium' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                      <input type="checkbox" className="w-4 h-4"
                        checked={checked}
                        onChange={(e) => {
                          const cur = form.incentives ?? []
                          setForm({ ...form, incentives: e.target.checked ? [...cur, p] : cur.filter((x) => x !== p) })
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
                className="px-7 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">저장</button>
            </div>
          </form>
        </div>
      )}

      {/* 검색 + 삭제 */}
      <div className="mb-4 flex gap-3 items-center flex-wrap">
        <input className="border rounded-lg px-3 py-2 text-sm w-64"
          placeholder="이름, 연락처, 직종, 지역으로 검색"
          value={search} onChange={(e) => setSearch(e.target.value)} />
        {employmentFilter && (
          <div className="flex items-center gap-1.5 bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-full text-sm">
            <span>{employmentFilter}</span>
            <button onClick={() => setEmploymentFilter('')} className="text-indigo-400 hover:text-indigo-700 font-bold">×</button>
          </div>
        )}
        {categoryFilter && (
          <div className="flex items-center gap-1.5 bg-orange-50 text-orange-700 px-3 py-1.5 rounded-full text-sm">
            <span>{categoryFilter}</span>
            <button onClick={() => setCategoryFilter('')} className="text-orange-400 hover:text-orange-700 font-bold">×</button>
          </div>
        )}
        <span className="text-sm text-gray-500">총 {filtered.length}명</span>
        <div className="ml-auto flex gap-2">
          {selectedIds.size > 0 && (
            <button onClick={handleDeleteSelected}
              className="bg-red-500 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-red-600">
              선택 삭제 ({selectedIds.size})
            </button>
          )}
          <button onClick={handleDeleteAll}
            className="border border-red-300 text-red-500 px-3 py-1.5 rounded-lg text-sm hover:bg-red-50">
            전체 삭제
          </button>
        </div>
      </div>

      {/* 목록 테이블 */}
      <div className="bg-white rounded-xl shadow-sm overflow-auto max-h-[calc(100vh-260px)]">
        {loading ? (
          <p className="p-6 text-gray-500">불러오는 중...</p>
        ) : filtered.length === 0 ? (
          <p className="p-6 text-gray-500">등록된 구직자가 없습니다.</p>
        ) : (
          <table className="text-sm whitespace-nowrap">
            <thead className="bg-gray-50 text-gray-600 sticky top-0 z-10">
              <tr>
                <th className="px-3 py-3 w-8">
                  <input type="checkbox" className="w-4 h-4 rounded"
                    checked={filtered.length > 0 && selectedIds.size === filtered.length}
                    onChange={toggleSelectAll} />
                </th>
                {['연번', '서비스신청일', '이름', '성별', '만나이', '최종학력', '휴대폰', '거주지',
                  '구직신청', '알선횟수', '취업형태', '취업처', '취업횟수', '장려금', '담당자', '관리'].map((h) => (
                  <th key={h} className="text-left px-3 py-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((js, idx) => {
                const age = calcAge(js.resident_number ?? '')
                const gender = calcGender(js.resident_number ?? '')
                const placementCount = js.placement_history?.length ?? 0
                const empHistoryCount = (js.employment_history?.length ?? 0) || (js.employment_type ? 1 : 0)
                const appHistoryCount = js.job_application_history?.length ?? 0
                return (
                  <tr key={js.id} className={`hover:bg-gray-50 ${selectedIds.has(js.id) ? 'bg-blue-50' : ''}`}>
                    <td className="px-3 py-2.5">
                      <input type="checkbox" className="w-4 h-4 rounded"
                        checked={selectedIds.has(js.id)}
                        onChange={() => toggleSelect(js.id)} />
                    </td>
                    <td className="px-3 py-2.5 text-gray-400 text-xs">{idx + 1}</td>
                    <td className="px-3 py-2.5 text-gray-500 text-xs">{js.service_date?.slice(0, 10) ?? '-'}</td>
                    <td className="px-3 py-2.5 font-medium">{js.name}</td>
                    <td className="px-3 py-2.5">
                      {gender && (
                        <span className={`px-1.5 py-0.5 rounded text-xs ${gender === '남' ? 'bg-blue-50 text-blue-600' : 'bg-pink-50 text-pink-600'}`}>
                          {gender}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-gray-600">{age !== null ? `${age}세` : '-'}</td>
                    <td className="px-3 py-2.5 text-gray-500">{js.education || '-'}</td>
                    <td className="px-3 py-2.5">{js.phone}</td>
                    <td className="px-3 py-2.5 text-gray-500">{js.region || '-'}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${js.active ? 'bg-green-100 text-green-700' : js.employment_type ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'}`}>
                          {js.active ? '신청중' : js.employment_type ? '취업완료' : '미신청'}
                        </span>
                        {appHistoryCount > 0 && (
                          <span className="px-1.5 py-0.5 bg-sky-100 text-sky-600 rounded-full text-xs font-medium">{appHistoryCount}회</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      {placementCount > 0 ? (
                        <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
                          {placementCount}회
                        </span>
                      ) : <span className="text-gray-300 text-xs">-</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      {js.employment_type === '알선취업' ? (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-indigo-100 text-indigo-700 font-medium">알선취업</span>
                      ) : js.employment_type === '본인취업' ? (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-teal-100 text-teal-700 font-medium">본인취업</span>
                      ) : (
                        <span className="text-gray-300 text-xs">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-gray-500">{js.employment_company || '-'}</td>
                    <td className="px-3 py-2.5">
                      {empHistoryCount > 0 ? (
                        <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                          {empHistoryCount}회
                        </span>
                      ) : <span className="text-gray-300 text-xs">-</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      {(js.incentives ?? []).length === 0 ? (
                        <span className="text-gray-300 text-xs">-</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {(js.incentives ?? []).map((p) => (
                            <span key={p} className="px-1.5 py-0.5 bg-rose-50 text-rose-700 rounded text-[11px] whitespace-nowrap">{p}</span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-gray-500">{js.manager_name || '-'}</td>
                    <td className="px-3 py-2.5 flex gap-2">
                      <button onClick={() => openEdit(js)} className="text-blue-600 hover:underline text-xs">수정</button>
                      <button onClick={() => handleDelete(js.id)} className="text-red-500 hover:underline text-xs">삭제</button>
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

// 로컬(KST) 기준 오늘 날짜 YYYY-MM-DD
export function todayLocal(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

// 구직/구인 만료일은 신청일 + N개월 - 1일 (행정 관행)
// new Date(yyyy-mm-dd) UTC 파싱 회피 — 로컬 기준 계산
export function addMonthsExpiry(dateStr: string | null | undefined, months: number): string {
  const base = dateStr && /^\d{4}-\d{2}-\d{2}/.test(dateStr) ? dateStr : todayLocal()
  const [y, m, d] = base.slice(0, 10).split('-').map(Number)
  const dt = new Date(y, m - 1 + months, d - 1)
  const yy = dt.getFullYear()
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

// 엑셀 셀(시리얼/Date/문자열)을 'YYYY-MM-DD'로 통일
export function excelToDateStr(val: string | number | Date | undefined | null): string | null {
  if (val === null || val === undefined || val === '') return null
  if (typeof val === 'number') {
    const ms = Math.round((val - 25569) * 86400 * 1000)
    const dt = new Date(ms)
    const y = dt.getUTCFullYear()
    const m = String(dt.getUTCMonth() + 1).padStart(2, '0')
    const dd = String(dt.getUTCDate()).padStart(2, '0')
    return `${y}-${m}-${dd}`
  }
  if (val instanceof Date) {
    const y = val.getUTCFullYear()
    const m = String(val.getUTCMonth() + 1).padStart(2, '0')
    const dd = String(val.getUTCDate()).padStart(2, '0')
    return `${y}-${m}-${dd}`
  }
  const s = String(val).trim()
  const match = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/)
  if (match) {
    return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`
  }
  return s || null
}

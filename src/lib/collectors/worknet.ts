import axios from 'axios'

export interface CollectedPosting {
  source: string
  external_id: string
  title: string
  company_name: string
  region: string
  job_type: string
  job_code: string
  salary_type: string
  salary_amount: number | null
  deadline: string | null
  description: string | null
  url: string | null
  closed: boolean
  collected_at: string
}

export async function collectWorknet(): Promise<CollectedPosting[]> {
  const apiKey = process.env.WORKNET_API_KEY
  if (!apiKey) throw new Error('WORKNET_API_KEY 미설정')

  const res = await axios.get('https://openapi.gg.go.kr/RecruitInfo', {
    params: { KEY: apiKey, Type: 'json', pIndex: 1, pSize: 100 },
    timeout: 15000,
  })

  const items: Record<string, string>[] = res.data?.RecruitInfo?.[1]?.row ?? []

  return items
    .filter((item) => item.RECRU_ID || item.JO_SN)
    .map((item) => ({
    source: 'worknet',
    external_id: `worknet_${item.RECRU_ID ?? item.JO_SN}`,
    title: item.JO_SJ ?? '',
    company_name: item.CMPNY_NM ?? '',
    region: item.WORK_PARAR_BASS_ADRES_CN ?? '',
    job_type: item.RCRIT_JO_CN ?? '',
    job_code: item.OCCUPTN_CD ?? '',
    salary_type: item.WAGE_COND_NM ?? '',
    salary_amount: null,
    deadline: item.DEADLINE_YMD ?? null,
    description: item.DTL_RECRUIT_CN ?? null,
    url: item.RECRU_ID
      ? `https://www.work24.go.kr/wk/a/b/1200/retrivJobDetailInfo.do?wantedAuthNo=${item.RECRU_ID}`
      : null,
    closed: false,
    collected_at: new Date().toISOString(),
  }))
}

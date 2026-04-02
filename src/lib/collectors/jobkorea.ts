import * as cheerio from 'cheerio'
import type { CollectedPosting } from './worknet'

export async function collectJobkorea(): Promise<CollectedPosting[]> {
  const apiKey = process.env.JOBKOREA_API_KEY
  if (!apiKey) throw new Error('JOBKOREA_API_KEY 미설정')

  const url = `http://www.jobkorea.co.kr/Service_JK/Data/JK_GI_XML_List.asp?api=${apiKey}`

  const res = await fetch(url, {
    signal: AbortSignal.timeout(30000),
  })

  if (!res.ok) throw new Error(`잡코리아 API 오류: ${res.status}`)

  const xml = await res.text()
  const $ = cheerio.load(xml, { xmlMode: true })
  const postings: CollectedPosting[] = []
  const now = new Date().toISOString()

  $('JK_GI').each((_, el) => {
    try {
      const giNo = $(el).find('GI_No').text().trim()
      const title = $(el).find('GI_Name').text().trim()
      const company = $(el).find('Comp_Name').text().trim()

      if (!giNo || !title || !company) return

      const region = $(el).find('Work_Place').text().trim()
      const jobType = $(el).find('Career').text().trim()
      const jobCode = $(el).find('Duty_Code').text().trim()
      const salaryType = $(el).find('Pay_Type').text().trim()
      const salaryRaw = $(el).find('Pay_Min').text().trim()
      const salaryAmount = salaryRaw ? parseInt(salaryRaw.replace(/,/g, ''), 10) || null : null
      const deadline = $(el).find('End_Date').text().trim() || null
      const postUrl =
        $(el).find('GI_URL').text().trim() ||
        `https://www.jobkorea.co.kr/Recruit/GI_Read/${giNo}`

      postings.push({
        source: 'jobkorea',
        external_id: `jobkorea_${giNo}`,
        title,
        company_name: company,
        region,
        job_type: jobType,
        job_code: jobCode,
        salary_type: salaryType,
        salary_amount: salaryAmount,
        deadline,
        description: $(el).find('Work_Content').text().trim() || null,
        url: postUrl,
        closed: false,
        collected_at: now,
      })
    } catch {
      // 개별 항목 파싱 실패 시 건너뜀
    }
  })

  if (postings.length === 0) {
    throw new Error('잡코리아 API: 수집된 공고가 없습니다. XML 구조를 확인하세요.')
  }

  return postings
}

import axios from 'axios'
import type { CollectedPosting } from './worknet'

interface SaraminJob {
  id: string
  url: string
  'posting-date': string
  'modification-date': string
  'opening-timestamp': number
  'expiration-timestamp': number
  'expiration-date': string
  close_type: { code: string; name: string }
  company: { detail: { name: string; href: string } }
  position: {
    title: string
    location: { code: string; name: string }
    'job-type': { code: string; name: string }
    'job-code': { code: string; name: string }
    'experience-level': { code: number; min: number; max: number; name: string }
    'required-education-level': { code: string; name: string }
    industry: { code: string; name: string }
  }
  salary: { code: string; name: string }
  'posting-timestamp': number
  'keyword': string
}

export async function collectSaramin(keyword = ''): Promise<CollectedPosting[]> {
  const apiKey = process.env.SARAMIN_API_KEY
  if (!apiKey) throw new Error('SARAMIN_API_KEY 미설정')

  const params: Record<string, string | number> = {
    'access-key': apiKey,
    count: 100,
    start: 1,
    sort: 'pd',
  }
  if (keyword) params.keywords = keyword

  const res = await axios.get('https://oapi.saramin.co.kr/job-search', {
    params,
    headers: { Accept: 'application/json' },
    timeout: 15000,
  })

  const jobs: SaraminJob[] = res.data?.jobs?.job ?? []

  return jobs.map((job) => ({
    source: 'saramin',
    external_id: `saramin_${job.id}`,
    title: job.position?.title ?? '',
    company_name: job.company?.detail?.name ?? '',
    region: job.position?.location?.name ?? '',
    job_type: job.position?.['job-type']?.name ?? '',
    job_code: job.position?.['job-code']?.code ?? '',
    salary_type: job.salary?.name ?? '',
    salary_amount: null,
    deadline: job['expiration-date'] ?? null,
    description: null,
    url: job.url ?? null,
    closed: false,
    collected_at: new Date().toISOString(),
  }))
}

export interface Employer {
  id: string
  company_name: string
  business_type: string
  business_reg_number: string
  job_duty: string
  job_count: number
  hiring_status: string
  contact_name: string
  contact_phone: string
  address: string
  region: string
  notes: string | null
  created_at: string
}

export interface JobApplicationHistory {
  id: string
  jobseeker_id: string
  application_date: string
  expiry_date: string | null
  application_place: string | null
  job_category: string | null
  created_at: string
}

export interface EmploymentHistory {
  id: string
  jobseeker_id: string
  employment_date: string
  resignation_date: string | null
  company: string
  employment_type: string | null
  created_at: string
}

export interface PlacementHistory {
  id: string
  jobseeker_id: string
  placement_date: string
  company: string
  business_reg_number: string | null
  created_at: string
}

export interface JobSeeker {
  id: string
  seq_no: number
  service_date: string | null       // 서비스신청일
  name: string
  resident_number: string | null    // 주민등록번호
  education: string | null          // 최종학력
  phone: string
  region: string                    // 거주지
  desired_job: string
  desired_job_code: string
  career_years: number
  certifications: string | null
  desired_salary: number | null
  active: boolean                   // 구직신청여부
  job_category: string | null          // 구직자 구분 (식품센터/그 외)
  job_application_date: string | null  // 구직신청일
  job_expiry_date: string | null       // 구직기간만료일
  job_application_place: string | null // 구직신청처
  manager_name: string | null       // 담당자
  employment_type: string | null    // 취업형태
  employment_date: string | null    // 취업일자
  employment_company: string | null // 취업처
  business_reg_number: string | null // 사업자등록번호
  notes: string | null
  created_at: string
  placement_history?: PlacementHistory[]
  employment_history?: EmploymentHistory[]
  job_application_history?: JobApplicationHistory[]
}

export interface JobPosting {
  id: string
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

export interface MatchResult {
  id: string
  jobseeker_id: string
  posting_id: string
  score: number
  reason: string
  sent: boolean
  sent_at: string | null
  created_at: string
  jobseeker?: JobSeeker
  posting?: JobPosting
}

-- 구인처 테이블
create table employers (
  id uuid default gen_random_uuid() primary key,
  company_name text not null,
  business_type text default '',
  contact_name text default '',
  contact_phone text default '',
  address text default '',
  region text default '',
  notes text,
  created_at timestamptz default now()
);

-- 구직자 테이블
create table job_seekers (
  id uuid default gen_random_uuid() primary key,
  seq_no integer generated always as identity,  -- 연번
  service_date date,                            -- 서비스신청일
  name text not null,                           -- 이름
  resident_number text default '',              -- 주민등록번호
  education text default '',                    -- 최종학력
  phone text not null,                          -- 휴대폰번호
  region text default '',                       -- 거주지
  desired_job text default '',                  -- 희망직종
  desired_job_code text default '',
  career_years int default 0,
  certifications text,
  desired_salary int,
  active boolean default true,                  -- 구직신청여부
  employment_type text default '',              -- 취업형태
  employment_date date,                         -- 취업일자
  employment_company text default '',           -- 취업처
  business_reg_number text default '',          -- 사업자등록번호
  notes text,
  created_at timestamptz default now()
);

-- 알선이력 테이블
create table placement_history (
  id uuid default gen_random_uuid() primary key,
  jobseeker_id uuid references job_seekers(id) on delete cascade,
  placement_date date not null,   -- 알선일
  company text not null,          -- 알선처
  created_at timestamptz default now()
);

-- 채용공고 테이블
create table job_postings (
  id uuid default gen_random_uuid() primary key,
  source text default 'worknet',
  external_id text unique,
  title text not null,
  company_name text default '',
  region text default '',
  job_type text default '',
  job_code text default '',
  salary_type text default '',
  salary_amount int,
  deadline text,
  description text,
  url text,
  closed boolean default false,
  collected_at timestamptz default now()
);

-- 매칭 결과 테이블
create table match_results (
  id uuid default gen_random_uuid() primary key,
  jobseeker_id uuid references job_seekers(id) on delete cascade,
  posting_id uuid references job_postings(id) on delete cascade,
  score int not null,
  reason text default '',
  sent boolean default false,
  sent_at timestamptz,
  created_at timestamptz default now(),
  unique(jobseeker_id, posting_id)
);

-- 인덱스
create index on job_seekers(active);
create index on job_seekers(seq_no);
create index on placement_history(jobseeker_id);
create index on job_postings(collected_at desc);
create index on match_results(sent);
create index on match_results(jobseeker_id);

-- =============================================
-- 기존 DB 마이그레이션 (이미 테이블이 있는 경우)
-- Supabase SQL Editor에서 아래 실행:
-- =============================================
-- alter table job_seekers add column if not exists seq_no integer generated always as identity;
-- alter table job_seekers add column if not exists service_date date;
-- alter table job_seekers add column if not exists resident_number text default '';
-- alter table job_seekers add column if not exists education text default '';
-- alter table job_seekers add column if not exists employment_type text default '';
-- alter table job_seekers add column if not exists employment_date date;
-- alter table job_seekers add column if not exists employment_company text default '';
-- alter table job_seekers add column if not exists business_reg_number text default '';
--
-- create table if not exists placement_history (
--   id uuid default gen_random_uuid() primary key,
--   jobseeker_id uuid references job_seekers(id) on delete cascade,
--   placement_date date not null,
--   company text not null,
--   created_at timestamptz default now()
-- );
-- create index if not exists on placement_history(jobseeker_id);

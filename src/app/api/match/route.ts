import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI } from '@google/generative-ai'

export async function POST(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
  try {
    const { seekerId } = await req.json()

    // 구직자 조회
    let seekerQuery = supabase.from('job_seekers').select('*').eq('active', true)
    if (seekerId) seekerQuery = seekerQuery.eq('id', seekerId)
    const { data: seekers, error: seekerError } = await seekerQuery
    if (seekerError) throw new Error('구직자 조회 실패: ' + seekerError.message)

    if (!seekers || seekers.length === 0) {
      return NextResponse.json({ message: '활동 중인 구직자가 없습니다.' })
    }

    // 최근 공고 조회 (최대 50개)
    const { data: postings } = await supabase
      .from('job_postings')
      .select('*')
      .order('collected_at', { ascending: false })
      .limit(50)

    if (!postings || postings.length === 0) {
      return NextResponse.json({ message: '채용공고가 없습니다. 공고를 먼저 수집해주세요.' })
    }

    let totalMatches = 0

    for (const seeker of seekers) {
      const postingList = postings
        .map((p, i) => `[${i + 1}] ${p.title} | ${p.company_name} | ${p.region} | ${p.job_type}`)
        .join('\n')

      const prompt = `당신은 취업 매칭 전문가입니다.

구직자 정보:
- 이름: ${seeker.name}
- 희망직종: ${seeker.desired_job}
- 거주지역: ${seeker.region}
- 경력: ${seeker.career_years}년
- 자격증: ${seeker.certifications ?? '없음'}
- 희망급여: ${seeker.desired_salary ? seeker.desired_salary + '만원' : '무관'}

채용공고 목록:
${postingList}

위 구직자에게 가장 적합한 공고 3개를 선택하여 아래 JSON 형식으로 반환하세요.
점수는 100점 만점으로 매겨주세요.

[
  {"index": 1, "score": 85, "reason": "희망직종과 일치하며 거주지역과 가까움"},
  {"index": 3, "score": 75, "reason": "경력 조건 부합"},
  {"index": 7, "score": 70, "reason": "자격증 활용 가능"}
]

JSON만 반환하고 다른 텍스트는 포함하지 마세요.`

      const result = await model.generateContent(prompt)
      const text = result.response.text().trim()

      let matches: Array<{ index: number; score: number; reason: string }>
      try {
        const jsonText = text.replace(/```json|```/g, '').trim()
        matches = JSON.parse(jsonText)
      } catch {
        continue
      }

      const matchRecords = matches
        .filter((m) => m.index >= 1 && m.index <= postings.length)
        .map((m) => ({
          jobseeker_id: seeker.id,
          posting_id: postings[m.index - 1].id,
          score: m.score,
          reason: m.reason,
          sent: false,
        }))

      if (matchRecords.length > 0) {
        await supabase
          .from('match_results')
          .upsert(matchRecords, { onConflict: 'jobseeker_id,posting_id' })
        totalMatches += matchRecords.length
      }
    }

    return NextResponse.json({
      message: `${seekers.length}명의 구직자에 대해 ${totalMatches}개의 매칭을 생성했습니다.`,
    })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ message: '매칭 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

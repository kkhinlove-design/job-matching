import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { collectWorknet, type CollectedPosting } from '@/lib/collectors/worknet'
import { collectSaramin } from '@/lib/collectors/saramin'
import { collectJobkorea } from '@/lib/collectors/jobkorea'

type Source = 'worknet' | 'saramin' | 'jobkorea'

const collectors: Record<Source, () => Promise<CollectedPosting[]>> = {
  worknet: collectWorknet,
  saramin: () => collectSaramin(),
  jobkorea: () => collectJobkorea(),
}

export async function POST(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const body = await req.json().catch(() => ({}))
  const sources: Source[] = body.sources ?? ['worknet', 'saramin', 'jobkorea']

  const results = await Promise.allSettled(
    sources.map(async (source) => {
      const collect = collectors[source]
      if (!collect) throw new Error(`알 수 없는 소스: ${source}`)
      const postings = await collect()
      if (postings.length === 0) return { source, count: 0 }
      const { error } = await supabase
        .from('job_postings')
        .upsert(postings, { onConflict: 'external_id' })
      if (error) throw new Error(`DB 저장 실패 (${source}): ${error.message}`)
      return { source, count: postings.length }
    })
  )

  const summary: string[] = []
  const errors: string[] = []

  const sourceNames: Record<Source, string> = {
    worknet: '워크넷',
    saramin: '사람인',
    jobkorea: '잡코리아',
  }

  for (const result of results) {
    if (result.status === 'fulfilled') {
      const { source, count } = result.value
      summary.push(`${sourceNames[source as Source] ?? source} ${count}건`)
    } else {
      errors.push(result.reason?.message ?? '알 수 없는 오류')
    }
  }

  const message = [
    summary.length > 0 ? `수집 완료: ${summary.join(', ')}` : '',
    errors.length > 0 ? `오류: ${errors.join(' / ')}` : '',
  ]
    .filter(Boolean)
    .join('\n')

  return NextResponse.json({ message })
}

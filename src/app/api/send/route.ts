import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSender() {
  return process.env.ALIGO_SENDER ?? ''
}

async function sendSms(messages: Array<{ to: string; text: string }>) {
  const apiKey = process.env.ALIGO_API_KEY!
  const userId = process.env.ALIGO_USER_ID!
  const sender = getSender()

  const cnt = messages.length
  const params = new URLSearchParams({ key: apiKey, user_id: userId, sender, cnt: String(cnt) })
  messages.forEach((m, i) => {
    params.append(`rec_${i + 1}`, m.to.replace(/-/g, ''))
    params.append(`msg_${i + 1}`, m.text)
  })

  const res = await fetch('https://apis.aligo.in/send_mass/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })
  return res.json()
}

async function sendKakao(messages: Array<{ to: string; text: string; subject: string }>) {
  const apiKey = process.env.ALIGO_API_KEY!
  const userId = process.env.ALIGO_USER_ID!
  const senderKey = process.env.ALIGO_KAKAO_SENDER_KEY!
  const tplCode = process.env.ALIGO_KAKAO_TEMPLATE_CODE!
  const sender = getSender()

  const cnt = messages.length
  const params = new URLSearchParams({
    apikey: apiKey,
    userid: userId,
    senderkey: senderKey,
    tpl_code: tplCode,
    sender,
    cnt: String(cnt),
  })
  messages.forEach((m, i) => {
    params.append(`receiver_${i + 1}`, m.to.replace(/-/g, ''))
    params.append(`subject_${i + 1}`, m.subject)
    params.append(`message_${i + 1}`, m.text)
    // 알림톡 발송 실패 시 SMS 대체 발송
    params.append(`failover_${i + 1}`, 'Y')
    params.append(`fsubject_${i + 1}`, m.subject)
    params.append(`fmessage_${i + 1}`, m.text)
  })

  const res = await fetch('https://kakaoapi.aligo.in/akv10/alimtalk/send/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })
  return res.json()
}

export async function POST(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  try {
    const { matchIds, sendType = 'sms' }: { matchIds: string[]; sendType?: 'sms' | 'kakao' } = await req.json()

    if (!matchIds || matchIds.length === 0) {
      return NextResponse.json({ message: '발송할 항목이 없습니다.' }, { status: 400 })
    }

    if (sendType === 'kakao') {
      const senderKey = process.env.ALIGO_KAKAO_SENDER_KEY
      const tplCode = process.env.ALIGO_KAKAO_TEMPLATE_CODE
      if (!senderKey || !tplCode) {
        return NextResponse.json(
          { message: '카카오 알림톡 설정이 완료되지 않았습니다. (ALIGO_KAKAO_SENDER_KEY, ALIGO_KAKAO_TEMPLATE_CODE 필요)' },
          { status: 400 }
        )
      }
    }

    const { data: matches } = await supabase
      .from('match_results')
      .select('*, job_seekers(name, phone), job_postings(title, company_name, region, url)')
      .in('id', matchIds)

    if (!matches || matches.length === 0) {
      return NextResponse.json({ message: '발송할 데이터가 없습니다.' }, { status: 400 })
    }

    const msgList = matches.map((m: Record<string, unknown> & {
      job_seekers: { phone: string; name: string }
      job_postings: { title: string; company_name: string; region: string; url?: string }
      score: number
    }) => {
      const seeker = m.job_seekers
      const posting = m.job_postings
      const text = `[취업알림] ${seeker.name}님께 맞춤 공고를 안내드립니다.\n\n${posting.title}\n${posting.company_name} (${posting.region})\n매칭점수: ${m.score}점${posting.url ? `\n${posting.url}` : ''}\n\n문의: 취업지원센터`
      return { to: seeker.phone, text, subject: '취업 맞춤 공고 안내' }
    })

    let result
    if (sendType === 'kakao') {
      result = await sendKakao(msgList)
    } else {
      result = await sendSms(msgList)
    }

    if (result.result_code < 0) {
      return NextResponse.json(
        { message: `발송 실패: ${result.message}` },
        { status: 500 }
      )
    }

    await supabase
      .from('match_results')
      .update({ sent: true, sent_at: new Date().toISOString() })
      .in('id', matchIds)

    const typeLabel = sendType === 'kakao' ? '카카오 알림톡' : '문자'
    return NextResponse.json({
      message: `${matches.length}명에게 ${typeLabel}을 발송했습니다.`,
    })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ message: '발송 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

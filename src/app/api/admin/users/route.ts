import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

function getAdmin() {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
}

// 요청자가 admin인지 확인
async function verifyAdmin(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return false
  const admin = getAdmin()
  const { data } = await admin.auth.getUser(token)
  return data.user?.user_metadata?.role === 'admin'
}

// 사용자 목록 조회
export async function GET(req: NextRequest) {
  if (!(await verifyAdmin(req))) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
  }
  const admin = getAdmin()
  const { data, error } = await admin.auth.admin.listUsers()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const users = data.users.map(u => ({
    id: u.id,
    email: u.email,
    name: u.user_metadata?.name ?? '',
    role: u.user_metadata?.role ?? 'user',
    created_at: u.created_at,
    last_sign_in_at: u.last_sign_in_at,
  }))
  return NextResponse.json(users)
}

// 사용자 생성
export async function POST(req: NextRequest) {
  if (!(await verifyAdmin(req))) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
  }
  const { email, password, name, role } = await req.json()
  if (!email || !password) {
    return NextResponse.json({ error: '이메일과 비밀번호는 필수입니다.' }, { status: 400 })
  }
  const admin = getAdmin()
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: name || '', role: role || 'user' },
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: data.user.id, email: data.user.email })
}

// 사용자 삭제
export async function DELETE(req: NextRequest) {
  if (!(await verifyAdmin(req))) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
  }
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id 필수' }, { status: 400 })
  const admin = getAdmin()
  const { error } = await admin.auth.admin.deleteUser(id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

// 사용자 수정 (역할, 이름, 비밀번호 변경)
export async function PATCH(req: NextRequest) {
  if (!(await verifyAdmin(req))) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
  }
  const { id, name, role, password } = await req.json()
  if (!id) return NextResponse.json({ error: 'id 필수' }, { status: 400 })
  const admin = getAdmin()

  const updateData: Record<string, unknown> = {}
  if (name !== undefined || role !== undefined) {
    const { data: existing } = await admin.auth.admin.getUserById(id)
    const meta = { ...existing?.user?.user_metadata }
    if (name !== undefined) meta.name = name
    if (role !== undefined) meta.role = role
    updateData.user_metadata = meta
  }
  if (password) updateData.password = password

  const { error } = await admin.auth.admin.updateUserById(id, updateData)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

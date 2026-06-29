import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const hasServiceRoleKey = !!serviceRoleKey && serviceRoleKey !== process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  const adminDb = createAdminClient()
  
  // Try to query predictions count as admin
  const { count, error } = await adminDb
    .from('predictions')
    .select('*', { count: 'exact', head: true })

  // Let's also query Rixia's predictions directly
  const targetUserId = 'f07bdbc2-9dec-4ccc-8e37-8960ecee00fc' // Rixia
  const { data: RixiaPreds, error: RixiaError } = await adminDb
    .from('predictions')
    .select('*')
    .eq('user_id', targetUserId)

  return NextResponse.json({
    hasServiceRoleKey,
    serviceRoleKeyLength: serviceRoleKey ? serviceRoleKey.length : 0,
    serviceRoleKeyPrefix: serviceRoleKey ? serviceRoleKey.slice(0, 15) : 'none',
    predictionsCount: count ?? 0,
    queryError: error ? error.message : null,
    rixiaPredictionsFetched: RixiaPreds ? RixiaPreds.length : 0,
    rixiaQueryError: RixiaError ? RixiaError.message : null
  })
}

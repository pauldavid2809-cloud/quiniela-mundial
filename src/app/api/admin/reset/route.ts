import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate user
    const clientDb = createClient()
    const { data: { user } } = await clientDb.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // 2. Check if user is admin in profiles
    const adminDb = createAdminClient()
    const { data: profile, error: profileError } = await adminDb
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    if (profileError || !profile?.is_admin) {
      return NextResponse.json({ error: 'No autorizado (se requieren privilegios de admin)' }, { status: 403 })
    }

    // 3. Get query parameters
    const { searchParams } = new URL(req.url)
    const target = searchParams.get('target') || 'admin' // 'admin' or 'all'

    if (target === 'all') {
      // Reset entire quiniela
      console.log('Reiniciando quiniela para TODOS los usuarios...')
      
      // Delete all predictions
      const { error: errPred } = await adminDb
        .from('predictions')
        .delete()
        .neq('id', 0) // delete all rows

      if (errPred) throw errPred

      // Delete all trivia answers
      const { error: errTrivia } = await adminDb
        .from('trivia_answers')
        .delete()
        .neq('id', 0) // delete all rows

      if (errTrivia) throw errTrivia

      // Reset total points of all profiles
      const { error: errProfilePoints } = await adminDb
        .from('profiles')
        .update({ total_points: 0 })
        .neq('username', '') // update all profiles

      if (errProfilePoints) throw errProfilePoints

      return NextResponse.json({
        success: true,
        message: 'La quiniela ha sido reiniciada por completo para TODOS los usuarios (predicciones, respuestas de trivia y puntos a 0).'
      })
    } else {
      // Reset only admin user's predictions and answers
      console.log(`Reiniciando quiniela para el usuario admin (${user.email})...`)

      // Delete predictions for admin user
      const { error: errPred } = await adminDb
        .from('predictions')
        .delete()
        .eq('user_id', user.id)

      if (errPred) throw errPred

      // Delete trivia answers for admin user
      const { error: errTrivia } = await adminDb
        .from('trivia_answers')
        .delete()
        .eq('user_id', user.id)

      if (errTrivia) throw errTrivia

      // Recalculate admin user's points
      const { error: errRpc } = await adminDb.rpc('recalculate_user_points', {
        p_user_id: user.id
      })

      if (errRpc) throw errRpc

      return NextResponse.json({
        success: true,
        message: `La quiniela ha sido reiniciada para el usuario admin (${user.email}). Se eliminaron sus predicciones, respuestas de trivia y sus puntos volvieron a 0.`
      })
    }
  } catch (error: any) {
    console.error('Error in reset endpoint:', error)
    return NextResponse.json({ error: error.message || 'Error interno del servidor' }, { status: 500 })
  }
}

// Permitir también GET para fácil llamada desde el navegador si se está autenticado
export async function GET(req: NextRequest) {
  return POST(req)
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 10;

/**
 * POST /api/admin/recalculate-prepare
 *
 * Paso 1 del recálculo distribuido: hace el reset global de is_dead y
 * points_earned a 0 para TODAS las predicciones, y devuelve la lista de
 * userIds únicos que tienen predicciones en el cuadro.
 *
 * El cliente llama a este endpoint primero, luego itera la lista de userIds
 * llamando a /api/admin/recalculate-user para cada uno secuencialmente.
 * Así el recálculo total se divide en N peticiones pequeñas, cada una
 * bien por debajo del límite de 10s de Vercel Hobby.
 */
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles').select('role, approved').eq('id', user.id).single();
  if (!profile || profile.role !== 'admin' || !profile.approved) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  try {
    const admin = createAdminClient();

    // Reset global: is_dead y points a 0 para todos los usuarios
    await admin
      .from('bracket_predictions')
      .update({ is_dead: false, points_earned: 0 })
      .neq('id', -1);

    // Devolver lista de userIds únicos con predicciones
    const { data: rows } = await admin
      .from('bracket_predictions')
      .select('user_id');

    const userIds = [...new Set((rows ?? []).map((r: any) => r.user_id as string))];

    return NextResponse.json({ ok: true, userIds });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Error' }, { status: 500 });
  }
}

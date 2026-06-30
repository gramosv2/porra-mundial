import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { recalculateUserTotals } from '@/lib/scoring-engine';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/admin/repair-all-totals
 *
 * Reparación puntual de un bug ya corregido: recalculateUserTotals (grupos)
 * pisaba total_points sin sumar bracket_points, dejando desincronizados a
 * los usuarios que ya tenían puntos del cuadro calculados. Este endpoint
 * recorre TODOS los perfiles aprobados y vuelve a llamar a
 * recalculateUserTotals (ya con el fix activo), dejando total_points
 * correctamente recompuesto para todos de golpe.
 *
 * Seguro de ejecutar más de una vez — es idempotente.
 */
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, approved')
    .eq('id', user.id)
    .single();
  if (!profile || profile.role !== 'admin' || !profile.approved) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  try {
    const admin = createAdminClient();
    const { data: profiles, error } = await admin.from('profiles').select('id').eq('approved', true);
    if (error) throw error;

    let repaired = 0;
    for (const p of profiles ?? []) {
      await recalculateUserTotals(admin, p.id);
      repaired++;
    }

    return NextResponse.json({ ok: true, repaired });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Error' }, { status: 500 });
  }
}

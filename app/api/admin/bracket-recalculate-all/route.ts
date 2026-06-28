import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { recalculateAllBracketSlots } from '@/lib/bracket-engine';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/admin/bracket-recalculate-all
 * Recalcula desde cero todas las predicciones del bracket: puntos + ramas
 * muertas. Útil tras corregir manualmente un resultado antiguo.
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
    await recalculateAllBracketSlots(admin);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Error' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { setBracketGlobalLock } from '@/lib/bracket-engine';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/admin/bracket-toggle-lock
 * Body: { locked: boolean }
 * Cierra (o reabre) TODAS las predicciones del cuadro de eliminatorias de
 * golpe, para todos los usuarios, independientemente de si han terminado
 * de rellenarlo o no.
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

  const body = await req.json().catch(() => ({}));
  const locked = body.locked === true;

  try {
    const admin = createAdminClient();
    await setBracketGlobalLock(admin, locked);
    return NextResponse.json({ ok: true, locked });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Error' }, { status: 500 });
  }
}

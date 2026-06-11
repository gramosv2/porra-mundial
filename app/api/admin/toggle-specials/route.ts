import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/toggle-specials
 * Body: { locked: boolean }
 *  - locked=true  → cierra las predicciones especiales (premios + semis).
 *  - locked=false → las reabre (siempre que no haya pasado el deadline).
 *
 * Escribe la clave 'specials_locked' en app_settings. La función
 * specials_open() de la BD la respeta, así que el cierre se aplica también
 * a nivel de RLS y no sólo en la interfaz.
 */
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

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

  const admin = createAdminClient();
  const { error } = await admin
    .from('app_settings')
    .upsert(
      { key: 'specials_locked', value: locked },
      { onConflict: 'key' }
    );
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, locked });
}

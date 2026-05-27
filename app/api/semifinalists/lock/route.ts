import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/semifinalists/lock
 * Body: { lock: boolean }
 *  - Cierra o reabre las 4 semifinalistas del usuario como bloque.
 *  - Solo si el deadline de especiales aún no ha pasado.
 *  - Solo si las predicciones no se han resuelto (is_correct == null).
 */
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const lock = body.lock === true;

  const admin = createAdminClient();

  // Verificar deadline
  const { data: setting } = await admin
    .from('app_settings')
    .select('value')
    .eq('key', 'special_predictions_deadline')
    .maybeSingle();
  const deadline = typeof setting?.value === 'string' ? new Date(setting.value) : null;
  if (deadline && Date.now() >= deadline.getTime()) {
    return NextResponse.json(
      { error: 'Las predicciones especiales ya están cerradas por deadline.' },
      { status: 400 }
    );
  }

  const { data: preds } = await admin
    .from('semifinalist_predictions')
    .select('id, is_correct')
    .eq('user_id', user.id);

  if (!preds || preds.length === 0) {
    return NextResponse.json(
      { error: 'Aún no tienes semifinalistas guardadas.' },
      { status: 400 }
    );
  }
  if (preds.some((p: { is_correct: boolean | null }) => p.is_correct !== null)) {
    return NextResponse.json(
      { error: 'Las semifinalistas ya están resueltas por el admin.' },
      { status: 400 }
    );
  }

  const { error } = await admin
    .from('semifinalist_predictions')
    .update({ locked: lock, locked_at: lock ? new Date().toISOString() : null })
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, locked: lock, count: preds.length });
}

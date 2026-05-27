import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/awards/lock
 * Body: { awardType: AwardType, lock: boolean }
 *  - lock=true / false
 *  - Solo si el deadline de especiales aún no ha pasado.
 *  - Solo si el premio aún no se ha resuelto (is_correct == null).
 */
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const awardType = body.awardType as string | undefined;
  const lock = body.lock === true;
  if (!awardType) return NextResponse.json({ error: 'awardType requerido' }, { status: 400 });

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

  // Buscar el premio del usuario
  const { data: pred } = await admin
    .from('award_predictions')
    .select('id, is_correct, locked')
    .eq('user_id', user.id)
    .eq('award_type', awardType)
    .maybeSingle();
  if (!pred) {
    return NextResponse.json(
      { error: 'Aún no tienes una predicción para este premio.' },
      { status: 400 }
    );
  }
  if (pred.is_correct !== null) {
    return NextResponse.json(
      { error: 'Este premio ya está resuelto por el admin.' },
      { status: 400 }
    );
  }

  const { error } = await admin
    .from('award_predictions')
    .update({
      locked: lock,
      locked_at: lock ? new Date().toISOString() : null,
    })
    .eq('id', pred.id)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, locked: lock });
}

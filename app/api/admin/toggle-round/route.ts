import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const VALID_PHASES = [
  'grupos',
  'r32',
  'r16',
  'cuartos',
  'semis',
  'tercero',
  'final',
];

/**
 * POST /api/admin/toggle-round
 * Body: { phase: string, open: boolean }
 * Añade o quita la fase del array open_rounds en app_settings.
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
  const phase = body.phase as string | undefined;
  const open = body.open === true;
  if (!phase || !VALID_PHASES.includes(phase)) {
    return NextResponse.json({ error: 'Fase inválida' }, { status: 400 });
  }

  const admin = createAdminClient();

  // Leer estado actual
  const { data: setting } = await admin
    .from('app_settings')
    .select('value')
    .eq('key', 'open_rounds')
    .maybeSingle();

  let current: string[] = Array.isArray(setting?.value)
    ? (setting!.value as string[])
    : ['grupos'];

  if (open) {
    if (!current.includes(phase)) current.push(phase);
  } else {
    current = current.filter((p) => p !== phase);
  }

  const { error } = await admin
    .from('app_settings')
    .upsert(
      { key: 'open_rounds', value: current },
      { onConflict: 'key' }
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, open_rounds: current });
}

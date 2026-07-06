import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { SCORING_CONFIG } from '@/config/scoring';
import type { BracketPhase } from '@/config/bracket';

export const dynamic = 'force-dynamic';

const VALID_PHASES: BracketPhase[] = ['r16', 'r8', 'qf', 'sf', 't3', 'f'];

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles').select('role, approved').eq('id', user.id).single();
  if (!profile || profile.role !== 'admin' || !profile.approved) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const bonus = body.bonus as Record<string, unknown> | undefined;
  if (!bonus || typeof bonus !== 'object') {
    return NextResponse.json({ error: 'Faltan datos' }, { status: 400 });
  }

  const defaults = SCORING_CONFIG.bracket_phase_bonus_default;
  const sanitized: Record<string, number> = {};
  for (const phase of VALID_PHASES) {
    const val = bonus[phase];
    const num = typeof val === 'number' ? val : Number(val);
    sanitized[phase] = Number.isFinite(num) && num >= 0 ? num : defaults[phase];
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from('app_settings')
    .upsert({ key: 'bracket_phase_bonus', value: sanitized }, { onConflict: 'key' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, saved: sanitized });
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { resolveAward } from '@/lib/scoring-engine';
import { SCORING_CONFIG } from '@/config/scoring';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

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
  const awardType = body.awardType as keyof typeof SCORING_CONFIG.awards;
  const winner = body.winner;

  if (!awardType || !(awardType in SCORING_CONFIG.awards)) {
    return NextResponse.json({ error: 'awardType inválido' }, { status: 400 });
  }
  if (typeof winner !== 'string' || !winner.trim()) {
    return NextResponse.json({ error: 'winner requerido' }, { status: 400 });
  }

  try {
    const admin = createAdminClient();
    await resolveAward(admin, awardType, winner);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Error' }, { status: 500 });
  }
}

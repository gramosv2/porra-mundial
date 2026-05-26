import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

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
  const iso = body.deadline as string | undefined;
  if (!iso || Number.isNaN(new Date(iso).getTime())) {
    return NextResponse.json({ error: 'deadline inválido' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from('app_settings')
    .upsert(
      { key: 'special_predictions_deadline', value: JSON.stringify(iso) },
      { onConflict: 'key' }
    );
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

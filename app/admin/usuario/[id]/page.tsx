import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { resolveRealMatchup } from '@/lib/bracket-engine';
import { BRACKET_SLOTS } from '@/config/bracket';
import { UserDetailClient } from './user-detail-client';
import type { Match, Prediction, BracketSlot, BracketPrediction, Profile } from '@/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Ficha de un usuario: junta sus predicciones de fase de grupos y su
 * cuadro de eliminatorias completo en una sola pantalla, ambos editables.
 * No toca /admin/predicciones ni /admin/cuadro, que siguen existiendo
 * igual que antes (organizados por partido/casilla en vez de por usuario).
 */
export default async function AdminUserDetailPage({ params }: { params: { id: string } }) {
  await requireAdmin();
  const admin = createAdminClient();
  const supabase = createClient();

  const { data: profile } = await admin
    .from('profiles')
    .select('*')
    .eq('id', params.id)
    .single();

  if (!profile) notFound();

  // --- Grupos ---
  const { data: groupMatches } = await supabase
    .from('matches')
    .select('*')
    .eq('phase', 'grupos')
    .order('match_date', { ascending: true });

  const { data: groupPreds } = await admin
    .from('predictions')
    .select('*')
    .eq('user_id', params.id);

  // --- Cuadro ---
  const { data: slots } = await supabase
    .from('bracket_slots')
    .select('*')
    .order('phase', { ascending: true })
    .order('order_num', { ascending: true });

  const { data: bracketPreds } = await admin
    .from('bracket_predictions')
    .select('*')
    .eq('user_id', params.id);

  const { data: lockSetting } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'bracket_locked')
    .maybeSingle();

  const slotsList = (slots ?? []) as BracketSlot[];
  const matchups: Record<string, { team1: string | null; team2: string | null }> = {};
  for (const def of BRACKET_SLOTS) {
    matchups[def.id] = resolveRealMatchup(slotsList, def.id);
  }

  return (
    <UserDetailClient
      profile={profile as Profile}
      groupMatches={(groupMatches ?? []) as Match[]}
      groupPreds={(groupPreds ?? []) as Prediction[]}
      slots={slotsList}
      bracketPreds={(bracketPreds ?? []) as BracketPrediction[]}
      bracketLocked={lockSetting?.value === true}
      matchups={matchups}
    />
  );
}

import { createClient } from '@/lib/supabase/server';
import { EspecialesAdminClient } from './especiales-client';
import { AWARD_LABELS, type AwardType } from '@/config/scoring';
import type { AwardPrediction, SemifinalistPrediction } from '@/types';

export const dynamic = 'force-dynamic';

export default async function AdminEspecialesPage() {
  const supabase = createClient();

  // Equipos disponibles (de partidos de grupos)
  const { data: matches } = await supabase
    .from('matches')
    .select('team1, team2')
    .eq('phase', 'grupos');
  const teamSet = new Set<string>();
  for (const m of matches ?? []) {
    if (m.team1) teamSet.add(m.team1);
    if (m.team2) teamSet.add(m.team2);
  }
  const teams = Array.from(teamSet).sort();

  // Awards con perfil
  const { data: awards } = await supabase
    .from('award_predictions')
    .select('*, profiles(display_name, username)');

  const awardsList = (awards ?? []) as Array<
    AwardPrediction & { profiles: { display_name: string; username: string } | null }
  >;

  const groupedAwards: Record<AwardType, typeof awardsList> = {
    balon_oro: [],
    bota_oro: [],
    guante_oro: [],
    mejor_joven: [],
    fair_play: [],
  };
  for (const a of awardsList) groupedAwards[a.award_type].push(a);

  // Semifinalistas con perfil
  const { data: semis } = await supabase
    .from('semifinalist_predictions')
    .select('*, profiles(display_name, username)')
    .order('user_id')
    .order('position');

  const semisList = (semis ?? []) as Array<
    SemifinalistPrediction & {
      profiles: { display_name: string; username: string } | null;
    }
  >;

  // Deadline actual
  const { data: settings } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'special_predictions_deadline')
    .maybeSingle();
  const deadline = typeof settings?.value === 'string' ? settings.value : null;

  return (
    <EspecialesAdminClient
      teams={teams}
      awardTypes={Object.keys(AWARD_LABELS) as AwardType[]}
      groupedAwards={groupedAwards}
      semis={semisList}
      deadline={deadline}
    />
  );
}

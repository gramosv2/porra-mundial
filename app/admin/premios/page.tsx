import { createClient } from '@/lib/supabase/server';
import { AwardsAdminClient } from './premios-client';
import { AWARD_LABELS, type AwardType } from '@/config/scoring';
import type { AwardPrediction } from '@/types';

export const dynamic = 'force-dynamic';

export default async function AdminPremiosPage() {
  const supabase = createClient();

  const { data: preds } = await supabase
    .from('award_predictions')
    .select('*, profiles(display_name, username)');

  const list = (preds ?? []) as Array<
    AwardPrediction & { profiles: { display_name: string; username: string } | null }
  >;

  // Agrupar por award_type
  const grouped: Record<AwardType, typeof list> = {
    balon_oro: [],
    bota_oro: [],
    guante_oro: [],
    mejor_joven: [],
    fair_play: [],
  };

  for (const p of list) {
    grouped[p.award_type].push(p);
  }

  const awardTypes = Object.keys(AWARD_LABELS) as AwardType[];

  return <AwardsAdminClient grouped={grouped} awardTypes={awardTypes} />;
}

import { createClient } from '@/lib/supabase/server';
import { AwardsClient } from './awards-client';
import { AWARD_LABELS, type AwardType } from '@/config/scoring';

export async function AwardsForm({ userId }: { userId: string }) {
  const supabase = createClient();
  const { data } = await supabase
    .from('award_predictions')
    .select('award_type, prediction, is_correct, points_earned')
    .eq('user_id', userId);

  const byType = new Map<string, any>();
  for (const a of data ?? []) byType.set(a.award_type, a);

  const items = Object.entries(AWARD_LABELS).map(([type, label]) => ({
    type: type as AwardType,
    label,
    prediction: byType.get(type)?.prediction ?? '',
    is_correct: byType.get(type)?.is_correct ?? null,
    points_earned: byType.get(type)?.points_earned ?? 0,
  }));

  return <AwardsClient items={items} userId={userId} />;
}

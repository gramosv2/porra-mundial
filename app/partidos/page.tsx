import { AppShell, requireApprovedUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PartidosClient } from './partidos-client';
import type { Match, Prediction } from '@/types';

export default async function PartidosPage({
  searchParams,
}: {
  searchParams: { phase?: string; group?: string; pendientes?: string };
}) {
  const profile = await requireApprovedUser();
  const supabase = createClient();

  const { data: matches } = await supabase
    .from('matches')
    .select('*')
    .order('match_date', { ascending: true });

  const { data: myPreds } = await supabase
    .from('predictions')
    .select('*')
    .eq('user_id', profile.id);

  // Rondas abiertas a predicción
  const { data: setting } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'open_rounds')
    .maybeSingle();
  const openRounds: string[] = Array.isArray(setting?.value)
    ? (setting!.value as string[])
    : ['grupos'];

  // Predicciones de todos los partidos FINISHED (RLS lo filtra)
  const finishedIds = (matches ?? []).filter((m) => m.status === 'finished').map((m) => m.id);
  const { data: othersRaw } = finishedIds.length
    ? await supabase
        .from('predictions')
        .select('user_id, match_id, pred_team1, pred_team2, points_earned, profiles(display_name)')
        .in('match_id', finishedIds)
    : { data: [] };

  const othersByMatch = new Map<number, Array<any>>();
  for (const o of (othersRaw as any[]) ?? []) {
    const arr = othersByMatch.get(o.match_id) ?? [];
    arr.push({
      user_id: o.user_id,
      display_name: o.profiles?.display_name ?? '?',
      pred_team1: o.pred_team1,
      pred_team2: o.pred_team2,
      points_earned: o.points_earned,
    });
    othersByMatch.set(o.match_id, arr);
  }

  const predsByMatch = new Map<number, Prediction>(
    (myPreds ?? []).map((p) => [p.match_id, p as Prediction])
  );

  return (
    <AppShell>
      <div className="mb-8">
        <h1 className="font-display text-4xl font-bold">Partidos</h1>
        <p className="text-text-muted text-sm mt-1">
          {matches?.length ?? 0} partidos totales · predice antes de que cierren
        </p>
      </div>

      <PartidosClient
        matches={(matches ?? []) as Match[]}
        userId={profile.id}
        predsByMatchEntries={Array.from(predsByMatch.entries())}
        othersByMatchEntries={Array.from(othersByMatch.entries())}
        openRounds={openRounds}
        initialPhase={searchParams.phase}
        initialGroup={searchParams.group}
        initialPendientes={searchParams.pendientes === '1'}
      />
    </AppShell>
  );
}

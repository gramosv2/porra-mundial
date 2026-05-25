import { AppShell, requireApprovedUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { MatchCard } from '@/components/match-card';
import { Badge, Card, Avatar } from '@/components/ui';
import { SpainBanner } from './spain-banner';
import { AwardsForm } from './awards-form';
import { formatMadridDate, teamES } from '@/lib/utils';
import Link from 'next/link';
import type { Match, Prediction } from '@/types';

export default async function DashboardPage() {
  const profile = await requireApprovedUser();
  const supabase = createClient();

  // Próximos partidos abiertos (los 5 más cercanos)
  const { data: upcomingMatches } = await supabase
    .from('matches')
    .select('*')
    .eq('status', 'open')
    .gte('match_date', new Date().toISOString())
    .order('match_date', { ascending: true })
    .limit(5);

  const upcomingIds = (upcomingMatches ?? []).map((m) => m.id);
  const { data: upcomingPreds } = upcomingIds.length
    ? await supabase
        .from('predictions')
        .select('*')
        .eq('user_id', profile.id)
        .in('match_id', upcomingIds)
    : { data: [] };
  const predsByMatch = new Map<number, Prediction>((upcomingPreds ?? []).map((p) => [p.match_id, p as Prediction]));

  // Últimos resultados finalizados con la predicción del usuario
  const { data: recentFinished } = await supabase
    .from('matches')
    .select('*, predictions!left(*)')
    .eq('status', 'finished')
    .order('match_date', { ascending: false })
    .limit(5);

  // Mi posición en el ranking
  const { data: rankRows } = await supabase
    .from('profiles')
    .select('id, total_points')
    .eq('approved', true)
    .order('total_points', { ascending: false });

  const myRank = (rankRows ?? []).findIndex((r) => r.id === profile.id) + 1;
  const totalPlayers = rankRows?.length ?? 1;
  const leaderPoints = rankRows?.[0]?.total_points ?? 0;
  const myPoints = profile.total_points;
  const progressPct = leaderPoints > 0 ? Math.round((myPoints / leaderPoints) * 100) : 0;

  // Próximos partidos en próximas 24h donde no ha predicho
  const next24h = (upcomingMatches ?? []).filter((m) => {
    const diff = new Date(m.match_date).getTime() - Date.now();
    return diff > 0 && diff < 24 * 60 * 60 * 1000 && !predsByMatch.has(m.id);
  });

  return (
    <AppShell>
      <SpainBanner />

      {/* Hero personal */}
      <section className="mt-6 mb-10">
        <div className="flex items-end gap-4 mb-6">
          <Avatar name={profile.display_name} size={56} />
          <div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold leading-tight">
              Hola, {profile.display_name}
            </h1>
            <p className="text-text-muted text-sm">Aquí tienes tu porra</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="!p-4">
            <div className="text-xs text-text-muted uppercase tracking-wide">Posición</div>
            <div className="font-display text-4xl font-bold mt-1 text-accent">
              {myRank === 0 ? '–' : `#${myRank}`}
            </div>
            <div className="text-xs text-text-muted mt-1">de {totalPlayers} jugadores</div>
          </Card>
          <Card className="!p-4">
            <div className="text-xs text-text-muted uppercase tracking-wide">Puntos totales</div>
            <div className="font-display text-4xl font-bold mt-1">{myPoints}</div>
            <div className="text-xs text-text-muted mt-1">
              {progressPct}% hacia el líder
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-surface-2 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-accent to-gold transition-all"
                style={{ width: `${Math.min(progressPct, 100)}%` }}
              />
            </div>
          </Card>
          <Card className="!p-4">
            <div className="text-xs text-text-muted uppercase tracking-wide">Marcadores exactos</div>
            <div className="font-display text-4xl font-bold mt-1 text-accent">{profile.exact_scores}</div>
            <div className="text-xs text-text-muted mt-1">3+ pts cada uno</div>
          </Card>
          <Card className="!p-4">
            <div className="text-xs text-text-muted uppercase tracking-wide">Resultados acertados</div>
            <div className="font-display text-4xl font-bold mt-1 text-gold">{profile.correct_results}</div>
            <div className="text-xs text-text-muted mt-1">1+ pts cada uno</div>
          </Card>
        </div>
      </section>

      {/* Alerta partidos a punto de cerrar */}
      {next24h.length > 0 && (
        <div className="mb-8 bg-gold/10 border border-gold/30 rounded-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl">⚠️</span>
            <h3 className="font-display font-semibold text-gold">
              Tienes {next24h.length} partido{next24h.length > 1 ? 's' : ''} sin predecir en las próximas 24h
            </h3>
          </div>
          <ul className="text-sm text-text-muted">
            {next24h.map((m) => (
              <li key={m.id}>
                · {teamES(m.team1)} vs {teamES(m.team2)} — {formatMadridDate(m.match_date)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Próximas predicciones */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-2xl font-bold">Próximas predicciones</h2>
          <Link href="/partidos" className="text-sm text-accent hover:underline">
            Ver todos →
          </Link>
        </div>
        {upcomingMatches && upcomingMatches.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {(upcomingMatches as Match[]).map((m) => (
              <MatchCard
                key={m.id}
                match={m}
                userId={profile.id}
                userPrediction={predsByMatch.get(m.id) ?? null}
              />
            ))}
          </div>
        ) : (
          <Card>
            <p className="text-text-muted text-sm text-center py-4">
              No hay partidos abiertos en este momento.
            </p>
          </Card>
        )}
      </section>

      {/* Últimos resultados */}
      {recentFinished && recentFinished.length > 0 && (
        <section className="mb-10">
          <h2 className="font-display text-2xl font-bold mb-4">Últimos resultados</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {recentFinished.map((row: any) => {
              const myPred = (row.predictions ?? []).find((p: any) => p.user_id === profile.id);
              return (
                <MatchCard
                  key={row.id}
                  match={row}
                  userId={profile.id}
                  userPrediction={myPred ?? null}
                />
              );
            })}
          </div>
        </section>
      )}

      {/* Premios individuales */}
      <section className="mb-6">
        <AwardsForm userId={profile.id} />
      </section>
    </AppShell>
  );
}

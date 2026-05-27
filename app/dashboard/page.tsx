import { AppShell, requireApprovedUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { MatchCard } from '@/components/match-card';
import { Badge, Card, Avatar } from '@/components/ui';
import { SpainBanner } from './spain-banner';
import { DashboardNewsletter } from './dashboard-newsletter';
import { formatMadridDate, teamES } from '@/lib/utils';
import Link from 'next/link';
import type { Match, Prediction, Newsletter } from '@/types';

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

  // Última newsletter publicada
  const { data: latestNewsletter } = await supabase
    .from('newsletters')
    .select('*')
    .order('published_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <AppShell>
      {/* Grid: España 1/4 + Newsletter 3/4 en desktop; apilado en mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
        <div className="lg:col-span-1">
          <SpainBanner />
        </div>
        <div className="lg:col-span-3">
          <DashboardNewsletter newsletter={(latestNewsletter as Newsletter | null) ?? null} />
        </div>
      </div>

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

      {/* CTA: predicciones especiales + reparto del bote */}
      <section className="mb-6 grid lg:grid-cols-2 gap-4">
        <Link
          href="/predicciones-especiales"
          className="group rounded-card border border-accent/30 bg-gradient-to-br from-accent/15 to-accent/5 p-6 hover:border-accent transition-all"
        >
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">🎯</span>
            <h3 className="font-display text-xl font-bold">Predicciones especiales</h3>
          </div>
          <p className="text-sm text-text-muted">
            Elige tus semifinalistas y los premios individuales (Balón de Oro, Bota, Guante…).
            Se cierran al empezar el primer partido.
          </p>
          <div className="mt-3 text-accent text-sm font-semibold group-hover:underline">
            Ir →
          </div>
        </Link>

        <div className="rounded-card border border-gold/30 bg-gradient-to-br from-gold/10 to-transparent p-6">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-3xl">💶</span>
            <h3 className="font-display text-xl font-bold">Reparto del bote</h3>
          </div>
          <div className="grid grid-cols-3 gap-3 mt-2">
            <div className="text-center">
              <div className="text-2xl">🥇</div>
              <div className="font-display text-2xl font-bold text-gold mt-1">75%</div>
              <div className="text-[10px] uppercase tracking-wide text-text-muted mt-1">
                1er puesto
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl">🥈</div>
              <div className="font-display text-2xl font-bold text-text mt-1">20%</div>
              <div className="text-[10px] uppercase tracking-wide text-text-muted mt-1">
                2º puesto
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl">🥉</div>
              <div className="font-display text-2xl font-bold text-text mt-1">5%</div>
              <div className="text-[10px] uppercase tracking-wide text-text-muted mt-1">
                3er puesto
              </div>
            </div>
          </div>
        </div>
      </section>
    </AppShell>
  );
}

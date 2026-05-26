import { AppShell, requireApprovedUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { MatchCard } from '@/components/match-card';
import { Badge, Card } from '@/components/ui';
import { PHASE_LABELS, AWARD_LABELS, SCORING_CONFIG, type Phase } from '@/config/scoring';
import { teamES, teamFlag } from '@/lib/utils';
import type { Match, Prediction } from '@/types';

export default async function MisPrediccionesPage() {
  const profile = await requireApprovedUser();
  const supabase = createClient();

  const { data: rows } = await supabase
    .from('predictions')
    .select('*, matches(*)')
    .eq('user_id', profile.id)
    .order('submitted_at', { ascending: false });

  const { data: awards } = await supabase
    .from('award_predictions')
    .select('*')
    .eq('user_id', profile.id);

  const { data: semis } = await supabase
    .from('semifinalist_predictions')
    .select('*')
    .eq('user_id', profile.id)
    .order('position', { ascending: true });

  const allPreds = (rows ?? []) as Array<Prediction & { matches: Match }>;
  const byPhase = new Map<Phase, typeof allPreds>();
  for (const p of allPreds) {
    const arr = byPhase.get(p.matches.phase) ?? [];
    arr.push(p);
    byPhase.set(p.matches.phase, arr);
  }

  // Estadísticas
  const finished = allPreds.filter((p) => p.matches.status === 'finished');
  const hits = finished.filter((p) => p.points_earned > 0).length;
  const accuracy = finished.length > 0 ? Math.round((hits / finished.length) * 100) : 0;

  return (
    <AppShell>
      <div className="mb-8">
        <h1 className="font-display text-4xl font-bold">Mis predicciones</h1>
        <p className="text-text-muted text-sm mt-1">{allPreds.length} predicciones realizadas</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <Card className="!p-4">
          <div className="text-xs text-text-muted uppercase tracking-wide">Predicciones</div>
          <div className="font-display text-3xl font-bold mt-1">{allPreds.length}</div>
        </Card>
        <Card className="!p-4">
          <div className="text-xs text-text-muted uppercase tracking-wide">% Acierto</div>
          <div className="font-display text-3xl font-bold mt-1 text-accent">{accuracy}%</div>
        </Card>
        <Card className="!p-4">
          <div className="text-xs text-text-muted uppercase tracking-wide">Exactos</div>
          <div className="font-display text-3xl font-bold mt-1 text-accent">{profile.exact_scores}</div>
        </Card>
        <Card className="!p-4">
          <div className="text-xs text-text-muted uppercase tracking-wide">Total puntos</div>
          <div className="font-display text-3xl font-bold mt-1 text-gold">{profile.total_points}</div>
        </Card>
      </div>

      {/* Por fase */}
      {Array.from(byPhase.entries()).map(([phase, items]) => (
        <section key={phase} className="mb-10">
          <h2 className="font-display text-2xl font-bold mb-4">{PHASE_LABELS[phase]}</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {items.map((p) => (
              <MatchCard
                key={p.id}
                match={p.matches}
                userId={profile.id}
                userPrediction={p}
              />
            ))}
          </div>
        </section>
      ))}

      {/* Semifinalistas */}
      <section className="mb-10">
        <h2 className="font-display text-2xl font-bold mb-4">Semifinalistas</h2>
        {semis && semis.length > 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {semis.map((s) => (
              <Card key={s.id} className="!p-4">
                <div className="text-xs text-text-muted mb-1">#{s.position}</div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">{teamFlag(s.team)}</span>
                  <span className="font-display font-semibold">{teamES(s.team)}</span>
                </div>
                {s.is_correct === null && <Badge>Pendiente</Badge>}
                {s.is_correct === true && (
                  <Badge variant="accent">+{s.points_earned} acertado</Badge>
                )}
                {s.is_correct === false && <Badge variant="danger">Fallado</Badge>}
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <p className="text-sm text-text-muted text-center py-3">
              No has elegido tus semifinalistas todavía.{' '}
              <a href="/predicciones-especiales" className="text-accent hover:underline">
                Ir a predicciones especiales →
              </a>
            </p>
          </Card>
        )}
      </section>

      {/* Premios */}
      <section>
        <h2 className="font-display text-2xl font-bold mb-4">Premios individuales</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {Object.entries(AWARD_LABELS).map(([type, label]) => {
            const a = (awards ?? []).find((x) => x.award_type === type);
            return (
              <Card key={type} className="!p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-display font-semibold text-sm">{label}</span>
                  <Badge variant="gold">{SCORING_CONFIG.awards[type as keyof typeof SCORING_CONFIG.awards]} pts</Badge>
                </div>
                {a ? (
                  <div className="flex items-center justify-between">
                    <span className="text-text font-medium">{a.prediction}</span>
                    {a.is_correct === null && <Badge>Pendiente</Badge>}
                    {a.is_correct === true && <Badge variant="accent">+{a.points_earned} ¡acertado!</Badge>}
                    {a.is_correct === false && <Badge variant="danger">Fallado</Badge>}
                  </div>
                ) : (
                  <p className="text-xs text-text-muted italic">Sin predicción</p>
                )}
              </Card>
            );
          })}
        </div>
      </section>
    </AppShell>
  );
}

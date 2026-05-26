import { AppShell, requireApprovedUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Card, Badge } from '@/components/ui';
import { AWARD_LABELS, AWARD_DESCRIPTIONS, SCORING_CONFIG, type AwardType } from '@/config/scoring';
import { SpecialsClient } from './specials-client';
import type { AwardPrediction, SemifinalistPrediction } from '@/types';

export const dynamic = 'force-dynamic';

export default async function PrediccionesEspecialesPage() {
  const profile = await requireApprovedUser();
  const supabase = createClient();

  // 1) Equipos del torneo (sacados de matches de grupos)
  const { data: matches } = await supabase
    .from('matches')
    .select('team1, team2, phase')
    .eq('phase', 'grupos');

  const teamSet = new Set<string>();
  for (const m of matches ?? []) {
    if (m.team1) teamSet.add(m.team1);
    if (m.team2) teamSet.add(m.team2);
  }
  const teams = Array.from(teamSet).sort();

  // 2) Predicciones existentes del usuario
  const { data: myAwards } = await supabase
    .from('award_predictions')
    .select('*')
    .eq('user_id', profile.id);

  const { data: mySemis } = await supabase
    .from('semifinalist_predictions')
    .select('*')
    .eq('user_id', profile.id)
    .order('position', { ascending: true });

  // 3) Deadline
  const { data: settings } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'special_predictions_deadline')
    .maybeSingle();

  const deadline = typeof settings?.value === 'string' ? settings.value : null;
  const deadlineDate = deadline ? new Date(deadline) : null;
  const isOpen = deadlineDate ? Date.now() < deadlineDate.getTime() : true;

  const awardTypes = Object.keys(AWARD_LABELS) as AwardType[];

  return (
    <AppShell>
      <div className="mb-8">
        <h1 className="font-display text-4xl font-bold">Predicciones especiales</h1>
        <p className="text-text-muted text-sm mt-1">
          Premios individuales y semifinalistas. Se cierran al empezar el primer partido del Mundial.
        </p>
      </div>

      {/* Status del deadline */}
      <Card className={isOpen ? 'border-accent/40 bg-accent/5 mb-6' : 'border-danger/40 bg-danger/5 mb-6'}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant={isOpen ? 'open' : 'closed'}>
                {isOpen ? 'Abierto' : 'Cerrado'}
              </Badge>
              <span className="text-sm font-medium">
                {isOpen ? 'Puedes editar tus predicciones' : 'Predicciones bloqueadas'}
              </span>
            </div>
            {deadlineDate && (
              <div className="text-xs text-text-muted">
                Fecha límite:{' '}
                {new Intl.DateTimeFormat('es-ES', {
                  timeZone: 'Europe/Madrid',
                  dateStyle: 'full',
                  timeStyle: 'short',
                }).format(deadlineDate)}{' '}
                (hora Madrid)
              </div>
            )}
          </div>
        </div>
      </Card>

      <SpecialsClient
        teams={teams}
        awardTypes={awardTypes}
        awardLabels={AWARD_LABELS}
        awardDescriptions={AWARD_DESCRIPTIONS}
        awardPoints={SCORING_CONFIG.awards}
        semiCount={SCORING_CONFIG.semifinalists.count}
        semiPointsPerHit={SCORING_CONFIG.semifinalists.points_per_hit}
        initialAwards={(myAwards ?? []) as AwardPrediction[]}
        initialSemis={(mySemis ?? []) as SemifinalistPrediction[]}
        isOpen={isOpen}
      />
    </AppShell>
  );
}

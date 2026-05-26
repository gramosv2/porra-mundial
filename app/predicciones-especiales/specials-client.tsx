'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, Badge } from '@/components/ui';
import { Button } from '@/components/ui/button';
import { teamES, teamFlag } from '@/lib/utils';
import type { AwardType } from '@/config/scoring';
import type { AwardPrediction, SemifinalistPrediction } from '@/types';

interface Props {
  teams: string[];
  awardTypes: AwardType[];
  awardLabels: Record<AwardType, string>;
  awardDescriptions: Record<AwardType, string>;
  awardPoints: Record<AwardType, number>;
  semiCount: number;
  semiPointsPerHit: number;
  initialAwards: AwardPrediction[];
  initialSemis: SemifinalistPrediction[];
  isOpen: boolean;
}

const AWARD_ICON: Record<AwardType, string> = {
  balon_oro: '🏆',
  bota_oro: '👟',
  guante_oro: '🧤',
  mejor_joven: '⭐',
  fair_play: '🤝',
};

export function SpecialsClient({
  teams,
  awardTypes,
  awardLabels,
  awardDescriptions,
  awardPoints,
  semiCount,
  semiPointsPerHit,
  initialAwards,
  initialSemis,
  isOpen,
}: Props) {
  const supabase = createClient();
  const router = useRouter();
  const [, startTransition] = useTransition();

  // Estado local de awards: { balon_oro: 'Lamine Yamal', ... }
  const awardInitial: Partial<Record<AwardType, string>> = {};
  for (const a of initialAwards) awardInitial[a.award_type] = a.prediction;
  const [awards, setAwards] = useState<Partial<Record<AwardType, string>>>(awardInitial);
  const [busyAward, setBusyAward] = useState<AwardType | null>(null);

  // Estado local de semis: array de strings, longitud semiCount
  const semiInitial: string[] = Array(semiCount).fill('');
  for (const s of initialSemis) {
    if (s.position >= 1 && s.position <= semiCount) {
      semiInitial[s.position - 1] = s.team;
    }
  }
  const [semis, setSemis] = useState<string[]>(semiInitial);
  const [savingSemis, setSavingSemis] = useState(false);

  async function saveAward(type: AwardType) {
    if (!isOpen) return;
    const value = (awards[type] ?? '').trim();
    if (!value) {
      alert('Escribe un nombre antes de guardar.');
      return;
    }
    setBusyAward(type);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setBusyAward(null);
      return;
    }
    const { error } = await supabase
      .from('award_predictions')
      .upsert(
        {
          user_id: user.id,
          award_type: type,
          prediction: value,
        },
        { onConflict: 'user_id,award_type' }
      );
    setBusyAward(null);
    if (error) {
      alert('Error: ' + error.message);
      return;
    }
    startTransition(() => router.refresh());
  }

  async function saveSemis() {
    if (!isOpen) return;
    // Validar: 4 distintos, no vacíos
    const filled = semis.map((s) => s.trim()).filter(Boolean);
    if (filled.length !== semiCount) {
      alert(`Debes elegir ${semiCount} selecciones.`);
      return;
    }
    const lowerSet = new Set(filled.map((t) => t.toLowerCase()));
    if (lowerSet.size !== semiCount) {
      alert('No puedes repetir el mismo equipo.');
      return;
    }

    setSavingSemis(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSavingSemis(false);
      return;
    }

    // Estrategia simple: borrar las existentes del usuario e insertar las 4 nuevas
    const { error: delErr } = await supabase
      .from('semifinalist_predictions')
      .delete()
      .eq('user_id', user.id);
    if (delErr) {
      setSavingSemis(false);
      alert('Error: ' + delErr.message);
      return;
    }
    const { error: insErr } = await supabase.from('semifinalist_predictions').insert(
      filled.map((team, i) => ({
        user_id: user.id,
        team,
        position: i + 1,
      }))
    );
    setSavingSemis(false);
    if (insErr) {
      alert('Error: ' + insErr.message);
      return;
    }
    startTransition(() => router.refresh());
  }

  const lockedNotice = !isOpen && (
    <p className="text-xs text-danger">
      🔒 Predicciones cerradas. Ya no se pueden editar.
    </p>
  );

  return (
    <div className="space-y-10">
      {/* === SEMIFINALISTAS === */}
      <section>
        <div className="mb-4">
          <h2 className="font-display text-2xl font-semibold">
            🌐 Semifinalistas
          </h2>
          <p className="text-text-muted text-sm mt-1">
            Elige las {semiCount} selecciones que crees que llegarán a semifinales.{' '}
            <span className="text-accent font-medium">
              +{semiPointsPerHit} punto por cada acierto.
            </span>
          </p>
        </div>

        <Card>
          <div className="grid sm:grid-cols-2 gap-3">
            {semis.map((value, i) => (
              <div key={i}>
                <label className="text-xs uppercase tracking-widest text-text-muted block mb-1.5">
                  Semifinalista {i + 1}
                </label>
                <select
                  value={value}
                  onChange={(e) => {
                    const next = [...semis];
                    next[i] = e.target.value;
                    setSemis(next);
                  }}
                  disabled={!isOpen}
                  className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm focus:border-accent focus:outline-none disabled:opacity-60"
                >
                  <option value="">— Elige selección —</option>
                  {teams.map((t) => (
                    <option
                      key={t}
                      value={t}
                      disabled={semis.includes(t) && semis[i] !== t}
                    >
                      {teamFlag(t)} {teamES(t)}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between gap-4 flex-wrap">
            {initialSemis.length > 0 && initialSemis.every((s) => s.is_correct !== null) && (
              <div className="flex flex-wrap gap-2">
                {initialSemis.map((s) => (
                  <Badge
                    key={s.id}
                    variant={s.is_correct ? 'accent' : 'default'}
                  >
                    {teamFlag(s.team)} {teamES(s.team)}{' '}
                    {s.is_correct ? '✓' : '✗'}
                  </Badge>
                ))}
              </div>
            )}
            <div className="flex items-center gap-3 ml-auto">
              {lockedNotice}
              <Button onClick={saveSemis} disabled={!isOpen || savingSemis}>
                {savingSemis ? 'Guardando…' : 'Guardar semifinalistas'}
              </Button>
            </div>
          </div>
        </Card>
      </section>

      {/* === PREMIOS INDIVIDUALES === */}
      <section>
        <div className="mb-4">
          <h2 className="font-display text-2xl font-semibold">🥇 Premios individuales</h2>
          <p className="text-text-muted text-sm mt-1">
            5 premios del torneo. Los puntos se otorgan cuando el admin resuelve cada premio al final.
          </p>
        </div>

        <div className="grid gap-3">
          {awardTypes.map((type) => {
            const existing = initialAwards.find((a) => a.award_type === type);
            const resolved = existing?.is_correct !== null && existing?.is_correct !== undefined;
            const won = existing?.is_correct === true;

            return (
              <Card key={type}>
                <div className="flex items-start justify-between gap-4 flex-wrap mb-3">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{AWARD_ICON[type]}</span>
                    <div>
                      <div className="font-display font-semibold text-lg">{awardLabels[type]}</div>
                      <div className="text-xs text-text-muted">
                        {awardDescriptions[type]} · +{awardPoints[type]} puntos
                      </div>
                    </div>
                  </div>
                  {resolved && (
                    <Badge variant={won ? 'accent' : 'default'}>
                      {won ? '✓ Acertado' : '✗ Fallado'}
                    </Badge>
                  )}
                </div>

                <div className="flex gap-2 items-center flex-wrap">
                  <input
                    type="text"
                    value={awards[type] ?? ''}
                    onChange={(e) => setAwards((s) => ({ ...s, [type]: e.target.value }))}
                    placeholder={
                      type === 'fair_play'
                        ? 'Nombre del equipo…'
                        : 'Nombre del jugador…'
                    }
                    disabled={!isOpen || resolved}
                    className="flex-1 min-w-[180px] bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm focus:border-accent focus:outline-none disabled:opacity-60"
                  />
                  <Button
                    size="sm"
                    onClick={() => saveAward(type)}
                    disabled={!isOpen || resolved || busyAward === type}
                  >
                    {busyAward === type ? 'Guardando…' : existing ? 'Actualizar' : 'Guardar'}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>

        {!isOpen && <div className="mt-4">{lockedNotice}</div>}
      </section>
    </div>
  );
}

'use client';

import { useState, useTransition, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Badge, Input } from '@/components/ui';
import { Button } from '@/components/ui/button';
import { teamES, teamFlag } from '@/lib/utils';
import {
  AWARD_LABELS,
  AWARD_DESCRIPTIONS,
  SCORING_CONFIG,
  type AwardType,
} from '@/config/scoring';
import type { AwardPrediction, SemifinalistPrediction } from '@/types';

type AwardP = AwardPrediction & {
  profiles: { display_name: string; username: string } | null;
};
type SemiP = SemifinalistPrediction & {
  profiles: { display_name: string; username: string } | null;
};

interface Props {
  teams: string[];
  awardTypes: AwardType[];
  groupedAwards: Record<AwardType, AwardP[]>;
  semis: SemiP[];
  deadline: string | null;
}

export function EspecialesAdminClient({
  teams,
  awardTypes,
  groupedAwards,
  semis,
  deadline,
}: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  // ---- Deadline ----
  const initialLocal = useMemo(() => {
    if (!deadline) return '';
    const d = new Date(deadline);
    if (Number.isNaN(d.getTime())) return '';
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  }, [deadline]);
  const [deadlineLocal, setDeadlineLocal] = useState(initialLocal);
  const [savingDeadline, setSavingDeadline] = useState(false);

  async function saveDeadline() {
    if (!deadlineLocal) return;
    const iso = new Date(deadlineLocal).toISOString();
    setSavingDeadline(true);
    const res = await fetch('/api/admin/update-deadline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deadline: iso }),
    });
    setSavingDeadline(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert('Error: ' + (data.error ?? 'desconocido'));
      return;
    }
    startTransition(() => router.refresh());
  }

  // ---- Premios ----
  const [awardInputs, setAwardInputs] = useState<Record<AwardType, string>>({
    balon_oro: '',
    bota_oro: '',
    guante_oro: '',
    mejor_joven: '',
    fair_play: '',
  } as Record<AwardType, string>);
  const [busyAward, setBusyAward] = useState<AwardType | null>(null);

  async function applyAward(awardType: AwardType) {
    const winner = awardInputs[awardType]?.trim();
    if (!winner) {
      alert('Escribe el ganador real antes de aplicar.');
      return;
    }
    if (
      !confirm(
        `Aplicar "${winner}" como ganador de ${AWARD_LABELS[awardType]}? Otorgará ${SCORING_CONFIG.awards[awardType]} puntos a los acertantes.`
      )
    )
      return;
    setBusyAward(awardType);
    const res = await fetch('/api/admin/resolve-award', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ awardType, winner }),
    });
    setBusyAward(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert('Error: ' + (data.error ?? 'desconocido'));
      return;
    }
    startTransition(() => router.refresh());
  }

  // ---- Semifinalistas ----
  const [semiSlots, setSemiSlots] = useState<string[]>(['', '', '', '']);
  const [savingSemis, setSavingSemis] = useState(false);

  async function applySemis() {
    const filled = semiSlots.map((s) => s.trim()).filter(Boolean);
    if (filled.length !== 4) {
      alert('Elige las 4 selecciones semifinalistas reales.');
      return;
    }
    const lowerSet = new Set(filled.map((t) => t.toLowerCase()));
    if (lowerSet.size !== 4) {
      alert('No puedes repetir equipos.');
      return;
    }
    if (
      !confirm(
        `Aplicar [${filled.join(', ')}] como semifinalistas reales? Sumará ${SCORING_CONFIG.semifinalists.points_per_hit} pt por cada acierto a quienes los hayan elegido.`
      )
    )
      return;

    setSavingSemis(true);
    const res = await fetch('/api/admin/resolve-semifinalists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teams: filled }),
    });
    setSavingSemis(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert('Error: ' + (data.error ?? 'desconocido'));
      return;
    }
    startTransition(() => router.refresh());
  }

  // Agrupar semifinalistas por usuario para mostrar quién eligió qué
  const semisByUser = useMemo(() => {
    const map = new Map<string, SemiP[]>();
    for (const s of semis) {
      const arr = map.get(s.user_id) ?? [];
      arr.push(s);
      map.set(s.user_id, arr);
    }
    return Array.from(map.values());
  }, [semis]);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* === DEADLINE === */}
      <Card>
        <h2 className="font-display text-xl font-semibold mb-2">
          🕒 Deadline de predicciones especiales
        </h2>
        <p className="text-sm text-text-muted mb-4">
          Después de esta fecha y hora, los usuarios no podrán editar sus premios ni
          semifinalistas. Por defecto: inicio del primer partido del Mundial.
        </p>
        <div className="flex gap-2 items-center flex-wrap">
          <Input
            type="datetime-local"
            value={deadlineLocal}
            onChange={(e) => setDeadlineLocal(e.target.value)}
            className="flex-1 min-w-[240px]"
          />
          <Button onClick={saveDeadline} disabled={savingDeadline}>
            {savingDeadline ? 'Guardando…' : 'Guardar deadline'}
          </Button>
        </div>
      </Card>

      {/* === SEMIFINALISTAS === */}
      <section>
        <h2 className="font-display text-2xl font-semibold mb-1">
          🌐 Semifinalistas reales
        </h2>
        <p className="text-sm text-text-muted mb-4">
          Cuando se conozcan los 4 semifinalistas, introdúcelos aquí. Cada acierto da{' '}
          {SCORING_CONFIG.semifinalists.points_per_hit} punto a quienes lo hayan
          predicho.
        </p>

        <Card>
          <div className="grid sm:grid-cols-2 gap-3 mb-4">
            {semiSlots.map((value, i) => (
              <div key={i}>
                <label className="text-xs uppercase tracking-widest text-text-muted block mb-1.5">
                  Semifinalista {i + 1}
                </label>
                <select
                  value={value}
                  onChange={(e) => {
                    const next = [...semiSlots];
                    next[i] = e.target.value;
                    setSemiSlots(next);
                  }}
                  className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm focus:border-accent focus:outline-none"
                >
                  <option value="">— Elige selección —</option>
                  {teams.map((t) => (
                    <option
                      key={t}
                      value={t}
                      disabled={semiSlots.includes(t) && semiSlots[i] !== t}
                    >
                      {teamFlag(t)} {teamES(t)}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <div className="flex justify-end">
            <Button onClick={applySemis} disabled={savingSemis}>
              {savingSemis ? 'Aplicando…' : 'Aplicar semifinalistas'}
            </Button>
          </div>
        </Card>

        {semisByUser.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm uppercase tracking-widest text-text-muted mb-3">
              Predicciones de los usuarios
            </h3>
            <div className="grid gap-2">
              {semisByUser.map((userSemis, idx) => (
                <Card key={idx} className="!p-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <span className="text-sm font-medium">
                      {userSemis[0].profiles?.display_name ?? '?'}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {userSemis.map((s) => {
                        const resolved = s.is_correct !== null;
                        return (
                          <span
                            key={s.id}
                            className={
                              'text-xs px-2 py-1 rounded-full border ' +
                              (resolved && s.is_correct
                                ? 'border-accent/40 bg-accent/10 text-accent'
                                : resolved
                                  ? 'border-border bg-surface-2 text-text-muted'
                                  : 'border-border bg-surface-2')
                            }
                          >
                            {teamFlag(s.team)} {teamES(s.team)}
                            {resolved && (s.is_correct ? ' ✓' : ' ✗')}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* === PREMIOS === */}
      <section>
        <h2 className="font-display text-2xl font-semibold mb-1">
          🥇 Premios individuales
        </h2>
        <p className="text-sm text-text-muted mb-4">
          Cuando se anuncien los ganadores oficiales, introdúcelos aquí.
        </p>

        <div className="grid gap-3">
          {awardTypes.map((type) => {
            const preds = groupedAwards[type] ?? [];
            const tally = new Map<string, AwardP[]>();
            for (const p of preds) {
              const key = p.prediction.trim();
              const arr = tally.get(key) ?? [];
              arr.push(p);
              tally.set(key, arr);
            }
            const sorted = Array.from(tally.entries()).sort(
              (a, b) => b[1].length - a[1].length
            );

            return (
              <Card key={type}>
                <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
                  <div>
                    <div className="font-display text-lg font-semibold">
                      {AWARD_LABELS[type]}
                    </div>
                    <div className="text-xs text-text-muted">
                      {AWARD_DESCRIPTIONS[type]} · +
                      {SCORING_CONFIG.awards[type]} pts · {preds.length}{' '}
                      {preds.length === 1 ? 'predicción' : 'predicciones'}
                    </div>
                  </div>
                </div>

                {sorted.length > 0 && (
                  <div className="mb-4 flex flex-wrap gap-2">
                    {sorted.map(([prediction, items]) => {
                      const allResolved = items.every((i) => i.is_correct !== null);
                      const someCorrect = items.some((i) => i.is_correct === true);
                      return (
                        <span
                          key={prediction}
                          className={
                            'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm border ' +
                            (allResolved && someCorrect
                              ? 'border-accent/40 bg-accent/10 text-accent'
                              : 'border-border bg-surface-2 text-text')
                          }
                        >
                          <span className="font-medium">{prediction}</span>
                          <span className="text-xs text-text-muted">
                            ×{items.length}
                          </span>
                        </span>
                      );
                    })}
                  </div>
                )}

                <div className="flex gap-2 items-center flex-wrap">
                  <Input
                    placeholder="Nombre del ganador real…"
                    value={awardInputs[type]}
                    onChange={(e) =>
                      setAwardInputs((s) => ({ ...s, [type]: e.target.value }))
                    }
                    className="flex-1 min-w-[200px]"
                  />
                  <Button
                    onClick={() => applyAward(type)}
                    disabled={busyAward === type}
                  >
                    {busyAward === type ? 'Aplicando…' : 'Aplicar'}
                  </Button>
                </div>

                {preds.some((p) => p.is_correct === true) && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <div className="text-xs uppercase tracking-widest text-accent mb-2">
                      Ganadores del premio
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {preds
                        .filter((p) => p.is_correct === true)
                        .map((p) => (
                          <Badge key={p.id} variant="accent">
                            {p.profiles?.display_name ?? '?'}
                          </Badge>
                        ))}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}

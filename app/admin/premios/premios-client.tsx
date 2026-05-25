'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Badge, Input } from '@/components/ui';
import { Button } from '@/components/ui/button';
import { AWARD_LABELS, SCORING_CONFIG, type AwardType } from '@/config/scoring';
import type { AwardPrediction } from '@/types';

type Pred = AwardPrediction & {
  profiles: { display_name: string; username: string } | null;
};

interface Props {
  grouped: Record<AwardType, Pred[]>;
  awardTypes: AwardType[];
}

export function AwardsAdminClient({ grouped, awardTypes }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState<AwardType | null>(null);
  const [inputs, setInputs] = useState<Record<AwardType, string>>(
    {
      balon_oro: '',
      bota_oro: '',
      guante_oro: '',
      mejor_joven: '',
      fair_play: '',
    } as Record<AwardType, string>
  );

  async function apply(awardType: AwardType) {
    const winner = inputs[awardType]?.trim();
    if (!winner) {
      alert('Introduce el ganador real antes de aplicar.');
      return;
    }
    if (
      !confirm(
        `¿Aplicar "${winner}" como ganador de ${AWARD_LABELS[awardType]}? Esto otorgará ${SCORING_CONFIG.awards[awardType]} puntos a quienes hayan acertado y recalculará sus totales.`
      )
    ) {
      return;
    }

    setBusy(awardType);
    const res = await fetch('/api/admin/resolve-award', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ awardType, winner }),
    });
    setBusy(null);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert('Error: ' + (data.error ?? 'desconocido'));
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {awardTypes.map((type) => {
        const preds = grouped[type];
        // Agrupar por predicción (case-insensitive)
        const tally: Record<string, Pred[]> = {};
        for (const p of preds) {
          const key = p.prediction.trim();
          if (!tally[key]) tally[key] = [];
          tally[key].push(p);
        }
        const sorted = Object.entries(tally).sort((a, b) => b[1].length - a[1].length);

        return (
          <Card key={type}>
            <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
              <div>
                <div className="font-display text-xl font-semibold flex items-center gap-2">
                  🏆 {AWARD_LABELS[type]}
                </div>
                <div className="text-sm text-text-muted">
                  Recompensa: {SCORING_CONFIG.awards[type]} puntos · {preds.length}{' '}
                  {preds.length === 1 ? 'predicción' : 'predicciones'}
                </div>
              </div>
            </div>

            {preds.length > 0 && (
              <div className="mb-4">
                <div className="text-xs uppercase tracking-widest text-text-muted mb-2">
                  Predicciones recibidas
                </div>
                <div className="flex flex-wrap gap-2">
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
                            : allResolved
                              ? 'border-border bg-surface-2 text-text-muted'
                              : 'border-border bg-surface-2 text-text')
                        }
                      >
                        <span className="font-medium">{prediction}</span>
                        <span className="text-xs text-text-muted">×{items.length}</span>
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex gap-2 items-center flex-wrap">
              <Input
                placeholder="Nombre del ganador real…"
                value={inputs[type]}
                onChange={(e) => setInputs((s) => ({ ...s, [type]: e.target.value }))}
                className="flex-1 min-w-[200px]"
              />
              <Button onClick={() => apply(type)} disabled={busy === type}>
                {busy === type ? 'Aplicando…' : 'Aplicar'}
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
  );
}

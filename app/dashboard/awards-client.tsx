'use client';

import { useState, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';
import { SCORING_CONFIG, type AwardType } from '@/config/scoring';
import { Badge, Card, Input } from '@/components/ui';

interface Item {
  type: AwardType;
  label: string;
  prediction: string;
  is_correct: boolean | null;
  points_earned: number;
}

export function AwardsClient({ items: initial, userId }: { items: Item[]; userId: string }) {
  const [items, setItems] = useState(initial);
  const [pendingType, setPendingType] = useState<AwardType | null>(null);
  const [, startTransition] = useTransition();
  const supabase = createClient();

  const save = (type: AwardType, value: string) => {
    if (!value.trim()) return;
    setPendingType(type);
    startTransition(async () => {
      const { error } = await supabase.from('award_predictions').upsert(
        { user_id: userId, award_type: type, prediction: value.trim() },
        { onConflict: 'user_id,award_type' }
      );
      if (!error) {
        setItems((prev) =>
          prev.map((it) => (it.type === type ? { ...it, prediction: value.trim() } : it))
        );
      }
      setPendingType(null);
    });
  };

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-2xl font-bold">Premios individuales</h2>
        <Badge variant="gold">+{Object.values(SCORING_CONFIG.awards).reduce((a, b) => a + b, 0)} pts max</Badge>
      </div>
      <p className="text-xs text-text-muted mb-5">
        Predice quién ganará cada premio del Mundial. Se cierran cuando el admin lo determine. Una vez resuelto, no podrás editar.
      </p>

      <div className="grid sm:grid-cols-2 gap-3">
        {items.map((it) => {
          const locked = it.is_correct !== null;
          return (
            <div
              key={it.type}
              className="bg-surface-2 border border-border rounded-lg p-3 flex flex-col gap-2"
            >
              <div className="flex items-center justify-between">
                <span className="font-display font-semibold text-sm">{it.label}</span>
                <Badge variant="gold">{SCORING_CONFIG.awards[it.type]} pts</Badge>
              </div>
              {locked ? (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-text">{it.prediction}</span>
                  <Badge variant={it.is_correct ? 'accent' : 'danger'}>
                    {it.is_correct ? `+${it.points_earned} ¡ACIERTO!` : 'Fallado'}
                  </Badge>
                </div>
              ) : (
                <Input
                  defaultValue={it.prediction}
                  placeholder="Tu predicción..."
                  className="text-sm"
                  onBlur={(e) => save(it.type, e.target.value)}
                />
              )}
              {pendingType === it.type && <span className="text-[10px] text-text-muted">Guardando…</span>}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

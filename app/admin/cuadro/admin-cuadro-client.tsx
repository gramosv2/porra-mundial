'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Badge } from '@/components/ui';
import { Button } from '@/components/ui/button';
import { teamES, teamFlag, cn } from '@/lib/utils';
import {
  BRACKET_SLOTS,
  BRACKET_PHASE_ORDER,
  BRACKET_PHASE_LABELS,
} from '@/config/bracket';
import type { BracketSlot } from '@/types';

interface Matchup {
  team1: string | null;
  team2: string | null;
}

interface Props {
  slots: BracketSlot[];
  bracketLocked: boolean;
  predictionCounts: Record<string, number>;
  matchups: Record<string, Matchup>;
}

export function AdminCuadroClient({ slots, bracketLocked, predictionCounts, matchups }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [locked, setLocked] = useState(bracketLocked);
  const [togglingLock, setTogglingLock] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const slotsById = new Map(slots.map((s) => [s.id, s]));

  async function toggleLock() {
    const target = !locked;
    const confirmMsg = target
      ? '¿Cerrar TODAS las predicciones del cuadro para TODOS los usuarios? Esta acción afecta a todo el mundo de golpe, aunque no hayan terminado de rellenarlo.'
      : '¿Reabrir las predicciones del cuadro para todos los usuarios?';
    if (!confirm(confirmMsg)) return;

    setTogglingLock(true);
    const res = await fetch('/api/admin/bracket-toggle-lock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locked: target }),
    });
    setTogglingLock(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert('Error: ' + (data.error ?? 'desconocido'));
      return;
    }
    setLocked(target);
    startTransition(() => router.refresh());
  }

  async function recalculateAll() {
    if (!confirm('¿Recalcular todo el cuadro desde cero? Útil tras corregir un resultado.')) return;
    setRecalculating(true);
    setMsg(null);
    const res = await fetch('/api/admin/bracket-recalculate-all', { method: 'POST' });
    setRecalculating(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setMsg('✗ Error: ' + (data.error ?? 'desconocido'));
      return;
    }
    setMsg('✓ Recálculo completo.');
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <Card className="bg-accent/5 border-accent/30 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-display text-lg font-semibold mb-1">
            Cierre global del cuadro
          </h2>
          <p className="text-sm text-text-muted">
            {locked
              ? 'Las predicciones están CERRADAS para todos los usuarios.'
              : 'Los usuarios todavía pueden rellenar y editar su cuadro.'}
          </p>
        </div>
        <Button
          variant={locked ? 'secondary' : 'danger'}
          onClick={toggleLock}
          disabled={togglingLock}
        >
          {togglingLock ? '…' : locked ? '🔓 Reabrir cuadro' : '🔒 Cerrar todas las predicciones'}
        </Button>
      </Card>

      <Card className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-display text-lg font-semibold mb-1">Recalcular todo</h2>
          <p className="text-sm text-text-muted">
            Vuelve a aplicar puntos y ramas muertas desde cero (úsalo tras corregir un resultado).
          </p>
        </div>
        <Button onClick={recalculateAll} disabled={recalculating} variant="secondary">
          {recalculating ? 'Recalculando…' : 'Recalcular todo'}
        </Button>
      </Card>
      {msg && (
        <div
          className={cn(
            'rounded-card border px-4 py-3 text-sm',
            msg.startsWith('✓')
              ? 'border-accent/30 bg-accent/10 text-accent'
              : 'border-danger/30 bg-danger/10 text-danger'
          )}
        >
          {msg}
        </div>
      )}

      {BRACKET_PHASE_ORDER.map((phase) => {
        const defs = BRACKET_SLOTS.filter((s) => s.phase === phase);
        return (
          <section key={phase}>
            <h2 className="font-display text-2xl font-semibold mb-3">
              {BRACKET_PHASE_LABELS[phase]}
            </h2>
            <div className="grid gap-3">
              {defs.map((def) => (
                <SlotAdminRow
                  key={def.id}
                  slotId={def.id}
                  row={slotsById.get(def.id)}
                  matchup={matchups[def.id]}
                  predictionCount={predictionCounts[def.id] ?? 0}
                  onSaved={() => startTransition(() => router.refresh())}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function SlotAdminRow({
  slotId,
  row,
  matchup,
  predictionCount,
  onSaved,
}: {
  slotId: string;
  row?: BracketSlot;
  matchup?: Matchup;
  predictionCount: number;
  onSaved: () => void;
}) {
  const team1 = matchup?.team1 ?? null;
  const team2 = matchup?.team2 ?? null;
  const knownMatchup = !!team1 && !!team2;

  const [t1, setT1] = useState(row?.result_team1?.toString() ?? '');
  const [t2, setT2] = useState(row?.result_team2?.toString() ?? '');
  const [penaltyWinner, setPenaltyWinner] = useState<1 | 2 | null>(row?.real_penalty_winner ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isFinished = row?.status === 'finished';
  const n1 = t1 === '' ? null : parseInt(t1, 10);
  const n2 = t2 === '' ? null : parseInt(t2, 10);
  const hasBothScores = n1 != null && n2 != null && !Number.isNaN(n1) && !Number.isNaN(n2);
  const isTie = hasBothScores && n1 === n2;

  // El "avanzante" se deriva del marcador automáticamente cuando no hay
  // empate; cuando hay empate, lo decide el botón de penaltis.
  const advancer: string | null = !hasBothScores
    ? null
    : isTie
      ? penaltyWinner === 1
        ? team1
        : penaltyWinner === 2
          ? team2
          : null
      : n1! > n2!
        ? team1
        : team2;

  // Si el marcador deja de estar empatado, olvidamos la elección de penaltis
  // previa (evita guardar un penaltyWinner obsoleto de un empate anterior).
  useEffect(() => {
    if (!isTie && penaltyWinner != null) setPenaltyWinner(null);
  }, [isTie]); // eslint-disable-line react-hooks/exhaustive-deps

  async function submit() {
    setError(null);
    if (!hasBothScores || n1 == null || n2 == null || n1 < 0 || n2 < 0) {
      setError('Resultado inválido');
      return;
    }
    if (isTie && penaltyWinner == null) {
      setError('Empate: indica quién gana en los penaltis');
      return;
    }
    if (!advancer) {
      setError('Indica qué equipo avanzó realmente de ronda');
      return;
    }
    if (
      !confirm(
        `Guardar ${knownMatchup ? `${teamES(team1!)} ${n1}-${n2} ${teamES(team2!)}` : `${n1}-${n2}`} en ${slotId}? Avanza: ${teamES(advancer)}. Se recalcularán los puntos de todos.`
      )
    )
      return;

    setSaving(true);
    const res = await fetch('/api/admin/bracket-save-result', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slotId,
        resultTeam1: n1,
        resultTeam2: n2,
        penaltyWinner: isTie ? penaltyWinner : null,
        realAdvancer: advancer,
      }),
    });
    setSaving(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? 'Error al guardar');
      return;
    }
    onSaved();
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
        <div className="flex items-center gap-2">
          <Badge variant={isFinished ? 'finished' : 'open'}>
            {slotId} · {isFinished ? 'Finalizado' : 'Pendiente'}
          </Badge>
          {!knownMatchup && (
            <span className="text-xs text-text-muted italic">
              Esperando resultado de la ronda anterior
            </span>
          )}
        </div>
        <span className="text-xs text-text-muted">
          {predictionCount} {predictionCount === 1 ? 'predicción' : 'predicciones'}
        </span>
      </div>

      {knownMatchup && (
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 text-right font-medium">
            {teamFlag(team1!)} {teamES(team1!)}
          </div>
          <div className="text-text-muted text-sm">vs</div>
          <div className="flex-1 text-left font-medium">
            {teamES(team2!)} {teamFlag(team2!)}
          </div>
        </div>
      )}

      {!knownMatchup && (
        <div className="text-center text-sm text-text-muted py-4">
          No se puede cargar el resultado todavía: faltan por confirmarse los
          equipos de la ronda anterior.
        </div>
      )}

      {knownMatchup && (
        <>
          <div className="flex gap-2 items-center justify-center mb-3">
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={t1}
              onChange={(e) => setT1(e.target.value)}
              className="w-16 text-center text-lg font-display bg-surface-2 border border-border rounded-lg py-2"
              placeholder="0"
            />
            <span className="text-text-muted">-</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={t2}
              onChange={(e) => setT2(e.target.value)}
              className="w-16 text-center text-lg font-display bg-surface-2 border border-border rounded-lg py-2"
              placeholder="0"
            />
          </div>

          {isTie && (
            <div className="mb-3 text-center">
              <div className="text-xs text-text-muted mb-1.5">¿Quién gana en los penaltis?</div>
              <div className="flex gap-2 justify-center">
                <button
                  type="button"
                  onClick={() => setPenaltyWinner(1)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-medium border',
                    penaltyWinner === 1
                      ? 'bg-accent text-black border-accent'
                      : 'bg-surface-2 border-border text-text-muted'
                  )}
                >
                  {teamFlag(team1!)} {teamES(team1!)}
                </button>
                <button
                  type="button"
                  onClick={() => setPenaltyWinner(2)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-medium border',
                    penaltyWinner === 2
                      ? 'bg-accent text-black border-accent'
                      : 'bg-surface-2 border-border text-text-muted'
                  )}
                >
                  {teamFlag(team2!)} {teamES(team2!)}
                </button>
              </div>
            </div>
          )}

          {!isTie && hasBothScores && advancer && (
            <div className="mb-3 text-center text-xs text-text-muted">
              Avanza automáticamente:{' '}
              <span className="font-semibold text-text">{teamES(advancer)}</span>
            </div>
          )}

          {error && <div className="text-xs text-danger text-center mb-2">{error}</div>}

          <div className="flex justify-center">
            <Button size="sm" onClick={submit} disabled={saving}>
              {saving ? 'Guardando…' : isFinished ? 'Corregir resultado' : 'Guardar resultado real'}
            </Button>
          </div>
        </>
      )}

      {isFinished && row?.real_advancer && (
        <div className="mt-3 pt-3 border-t border-border text-center text-xs text-text-muted">
          Resultado guardado:{' '}
          <span className="font-display font-bold text-text">
            {row.result_team1}–{row.result_team2}
          </span>
          {' · '}Avanzó: <span className="text-accent font-semibold">{teamES(row.real_advancer)}</span>
        </div>
      )}
    </Card>
  );
}

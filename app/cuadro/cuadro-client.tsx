'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  BRACKET_SLOTS,
  BRACKET_SLOTS_BY_ID,
  BRACKET_PHASE_ORDER,
  BRACKET_PHASE_LABELS,
  T3_USES_LOSERS,
  type BracketPhase,
} from '@/config/bracket';
import { bracketPredictedWinner, SCORING_CONFIG } from '@/config/scoring';
import { teamES, teamFlag, cn } from '@/lib/utils';
import { Card, Badge } from '@/components/ui';
import { Button } from '@/components/ui/button';
import type { BracketSlot, BracketPrediction } from '@/types';

interface Props {
  slots: BracketSlot[];
  myPredictions: BracketPrediction[];
  bracketLocked: boolean;
  userId: string;
}

// Estado local de una casilla mientras el usuario edita (antes de guardar)
interface LocalPred {
  t1: string;
  t2: string;
  penaltyWinner: 1 | 2 | null;
}

// Lo que se muestra resuelto para una casilla: equipos + si ya hay ganador elegido
interface Resolved {
  team1: string | null;
  team2: string | null;
  advancer: string | null; // nombre del equipo que el usuario eligió que pasa
  isDead: boolean; // viene de BD: ya falló esta rama en el resultado real
}

export function CuadroClient({ slots, myPredictions, bracketLocked, userId }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const slotsById = useMemo(() => new Map(slots.map((s) => [s.id, s])), [slots]);
  const predsById = useMemo(() => new Map(myPredictions.map((p) => [p.slot_id, p])), [myPredictions]);

  // Estado editable: arranca con lo que ya había guardado el usuario.
  const [local, setLocal] = useState<Map<string, LocalPred>>(() => {
    const m = new Map<string, LocalPred>();
    for (const p of myPredictions) {
      m.set(p.slot_id, {
        t1: p.pred_team1?.toString() ?? '',
        t2: p.pred_team2?.toString() ?? '',
        penaltyWinner: p.pred_penalty_winner,
      });
    }
    return m;
  });

  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function setSlotLocal(slotId: string, patch: Partial<LocalPred>) {
    setLocal((prev) => {
      const next = new Map(prev);
      const current = next.get(slotId) ?? { t1: '', t2: '', penaltyWinner: null };
      next.set(slotId, { ...current, ...patch });
      return next;
    });
  }

  // ---------------------------------------------------------------------
  // Resolución en vivo: para cada slot, qué equipos le tocan según las
  // elecciones LOCALES (en edición) del usuario, y si ya eligió ganador.
  // ---------------------------------------------------------------------
  const resolved = useMemo(() => {
    const out = new Map<string, Resolved>();

    function getAdvancer(slotId: string): string | null {
      return out.get(slotId)?.advancer ?? null;
    }
    function getLoser(slotId: string): string | null {
      const r = out.get(slotId);
      if (!r || !r.advancer || !r.team1 || !r.team2) return null;
      return r.advancer === r.team1 ? r.team2 : r.team1;
    }

    for (const phase of BRACKET_PHASE_ORDER) {
      for (const def of BRACKET_SLOTS.filter((s) => s.phase === phase)) {
        const row = slotsById.get(def.id);
        let team1: string | null = null;
        let team2: string | null = null;

        if (!def.fromSlot1 || !def.fromSlot2) {
          team1 = row?.team1_real ?? null;
          team2 = row?.team2_real ?? null;
        } else if (def.id === 'T3' && T3_USES_LOSERS) {
          team1 = getLoser(def.fromSlot1);
          team2 = getLoser(def.fromSlot2);
        } else {
          team1 = getAdvancer(def.fromSlot1);
          team2 = getAdvancer(def.fromSlot2);
        }

        const editing = local.get(def.id);
        const savedPred = predsById.get(def.id);
        const isDead = savedPred?.is_dead ?? false;

        let advancer: string | null = null;
        if (editing && editing.t1 !== '' && editing.t2 !== '' && team1 && team2) {
          const a = parseInt(editing.t1, 10);
          const b = parseInt(editing.t2, 10);
          if (!Number.isNaN(a) && !Number.isNaN(b)) {
            const winnerSlot = bracketPredictedWinner(a, b, editing.penaltyWinner);
            advancer = winnerSlot === 1 ? team1 : team2;
          }
        }

        out.set(def.id, { team1, team2, advancer, isDead });
      }
    }

    return out;
  }, [local, slotsById, predsById]);

  // Ramas vivas/muertas reales (solo relevante una vez hay resultados reales en BD)
  const deadSlotIds = useMemo(() => {
    const s = new Set<string>();
    for (const p of myPredictions) {
      if (p.is_dead) s.add(p.slot_id);
    }
    return s;
  }, [myPredictions]);

  // ---------------------------------------------------------------------
  // Extras por predicción, en vivo: equipos distintos puestos en cada
  // casilla de cuartos/semis/final (según las elecciones actuales, guardadas
  // o no) + si el ganador de la Final coincide con el campeón real (si ya
  // se conoce). Estos puntos se ganan al guardar, no dependen de que la
  // rama siga viva.
  // ---------------------------------------------------------------------
  const extras = useMemo(() => {
    const qfTeams = new Set<string>();
    for (const def of BRACKET_SLOTS.filter((s) => s.phase === 'qf')) {
      const r = resolved.get(def.id);
      if (r?.team1) qfTeams.add(r.team1);
      if (r?.team2) qfTeams.add(r.team2);
    }
    const sfTeams = new Set<string>();
    for (const def of BRACKET_SLOTS.filter((s) => s.phase === 'sf')) {
      const r = resolved.get(def.id);
      if (r?.team1) sfTeams.add(r.team1);
      if (r?.team2) sfTeams.add(r.team2);
    }
    const fTeams = new Set<string>();
    const finalResolved = resolved.get('F');
    if (finalResolved?.team1) fTeams.add(finalResolved.team1);
    if (finalResolved?.team2) fTeams.add(finalResolved.team2);

    const userChampion = finalResolved?.advancer ?? null;
    const realChampion = slotsById.get('F')?.real_advancer ?? null;
    const championHit = !!userChampion && !!realChampion && userChampion === realChampion;
    const championKnown = !!realChampion;

    const points =
      qfTeams.size * SCORING_CONFIG.bracket_advance_bonus.qf +
      sfTeams.size * SCORING_CONFIG.bracket_advance_bonus.sf +
      fTeams.size * SCORING_CONFIG.bracket_advance_bonus.f +
      (championHit ? SCORING_CONFIG.bracket_champion_bonus : 0);

    return {
      qfCount: qfTeams.size,
      sfCount: sfTeams.size,
      fCount: fTeams.size,
      userChampion,
      championHit,
      championKnown,
      points,
    };
  }, [resolved, slotsById]);

  const totalSlots = BRACKET_SLOTS.length;
  const filledSlots = useMemo(() => {
    let count = 0;
    for (const def of BRACKET_SLOTS) {
      const r = resolved.get(def.id);
      const editing = local.get(def.id);
      if (r?.team1 && r?.team2 && editing && editing.t1 !== '' && editing.t2 !== '') count++;
    }
    return count;
  }, [resolved, local]);

  const canEdit = !bracketLocked;

  async function saveAll() {
    setError(null);
    setSaveMsg(null);

    const payload: Array<{
      slotId: string;
      predTeam1: number;
      predTeam2: number;
      predPenaltyWinner: 1 | 2 | null;
    }> = [];

    for (const def of BRACKET_SLOTS) {
      const editing = local.get(def.id);
      const r = resolved.get(def.id);
      if (!editing || editing.t1 === '' || editing.t2 === '') continue;
      if (!r?.team1 || !r?.team2) continue; // todavía no se sabe el rival, no se puede guardar
      const a = parseInt(editing.t1, 10);
      const b = parseInt(editing.t2, 10);
      if (Number.isNaN(a) || Number.isNaN(b)) continue;
      if (a === b && editing.penaltyWinner == null) {
        setError(
          `Falta elegir quién pasa en los penaltis en: ${teamES(r.team1)} vs ${teamES(r.team2)}`
        );
        return;
      }
      payload.push({
        slotId: def.id,
        predTeam1: a,
        predTeam2: b,
        predPenaltyWinner: a === b ? editing.penaltyWinner : null,
      });
    }

    if (payload.length === 0) {
      setError('No hay nada que guardar todavía.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/bracket-predictions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slots: payload }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'Error al guardar');
      } else {
        setSaveMsg(`✓ Guardadas ${data.saved} casillas`);
        startTransition(() => router.refresh());
      }
    } catch (e: any) {
      setError(e?.message ?? 'Error de red');
    }
    setSaving(false);
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Barra de progreso + guardar */}
      <Card className="flex items-center justify-between gap-4 flex-wrap sticky top-[72px] z-20 bg-surface/95 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="text-sm">
            <span className="font-display font-bold text-lg">{filledSlots}</span>
            <span className="text-text-muted"> / {totalSlots} casillas rellenas</span>
          </div>
          {bracketLocked && <Badge variant="closed">🔒 Cuadro cerrado</Badge>}
        </div>
        <div className="flex items-center gap-3">
          {error && <span className="text-xs text-danger max-w-xs">{error}</span>}
          {saveMsg && <span className="text-xs text-accent">{saveMsg}</span>}
          {canEdit && (
            <Button onClick={saveAll} disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar mi cuadro'}
            </Button>
          )}
        </div>
      </Card>

      {!canEdit && (
        <div className="rounded-card border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm flex items-center gap-2">
          <span className="text-lg">🔒</span>
          <span className="text-amber-200">
            El admin ha cerrado las predicciones del cuadro. Puedes seguir viendo tu
            bracket, pero ya no se puede editar.
          </span>
        </div>
      )}

      {/* Resumen de puntos extra por predicción */}
      <Card>
        <h2 className="font-display text-base font-semibold mb-3">
          Puntos extra por tu predicción
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <ExtraStat
            label="Equipos en cuartos"
            count={extras.qfCount}
            max={8}
            perTeam={SCORING_CONFIG.bracket_advance_bonus.qf}
            subtotal={extras.qfCount * SCORING_CONFIG.bracket_advance_bonus.qf}
          />
          <ExtraStat
            label="Equipos en semis"
            count={extras.sfCount}
            max={4}
            perTeam={SCORING_CONFIG.bracket_advance_bonus.sf}
            subtotal={extras.sfCount * SCORING_CONFIG.bracket_advance_bonus.sf}
          />
          <ExtraStat
            label="Equipos en la final"
            count={extras.fCount}
            max={2}
            perTeam={SCORING_CONFIG.bracket_advance_bonus.f}
            subtotal={extras.fCount * SCORING_CONFIG.bracket_advance_bonus.f}
          />
          <div className="rounded-lg border border-border bg-surface-2/40 px-3 py-2.5">
            <div className="text-[11px] text-text-muted mb-1">Campeón del Mundial</div>
            {extras.userChampion ? (
              <div className="text-sm font-semibold flex items-center gap-1">
                {teamFlag(extras.userChampion)} {teamES(extras.userChampion)}
              </div>
            ) : (
              <div className="text-sm text-text-muted italic">Sin definir</div>
            )}
            <div className="text-[11px] mt-1">
              {!extras.championKnown ? (
                <span className="text-text-muted">Aún no se sabe el campeón real</span>
              ) : extras.championHit ? (
                <span className="text-accent font-medium">
                  ✓ Acertado · +{SCORING_CONFIG.bracket_champion_bonus} pts
                </span>
              ) : (
                <span className="text-danger">✕ No coincide con el campeón real</span>
              )}
            </div>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-border text-sm text-text-muted">
          Total de extras por ahora:{' '}
          <span className="font-display font-bold text-text">+{extras.points} pts</span>
        </div>
      </Card>

      {/* Rondas */}
      {BRACKET_PHASE_ORDER.map((phase) => (
        <PhaseSection
          key={phase}
          phase={phase}
          slotDefs={BRACKET_SLOTS.filter((s) => s.phase === phase)}
          resolved={resolved}
          local={local}
          deadSlotIds={deadSlotIds}
          canEdit={canEdit}
          slotsById={slotsById}
          onChange={setSlotLocal}
        />
      ))}
    </div>
  );
}

function PhaseSection({
  phase,
  slotDefs,
  resolved,
  local,
  deadSlotIds,
  canEdit,
  slotsById,
  onChange,
}: {
  phase: BracketPhase;
  slotDefs: typeof BRACKET_SLOTS;
  resolved: Map<string, Resolved>;
  local: Map<string, LocalPred>;
  deadSlotIds: Set<string>;
  canEdit: boolean;
  slotsById: Map<string, BracketSlot>;
  onChange: (slotId: string, patch: Partial<LocalPred>) => void;
}) {
  const leftSlots = slotDefs.filter((s) => s.side === 'L');
  const rightSlots = slotDefs.filter((s) => s.side === 'R');
  const centerSlots = slotDefs.filter((s) => s.side === 'C');

  return (
    <section>
      <h2 className="font-display text-2xl font-semibold mb-3">
        {BRACKET_PHASE_LABELS[phase]}
      </h2>
      <div
        className={cn(
          'grid gap-4',
          centerSlots.length > 0 ? 'grid-cols-1 sm:grid-cols-2 max-w-2xl' : 'lg:grid-cols-2'
        )}
      >
        {centerSlots.length > 0 ? (
          centerSlots.map((def) => (
            <SlotCard
              key={def.id}
              def={def}
              resolvedSlot={resolved.get(def.id)}
              localPred={local.get(def.id)}
              isDead={deadSlotIds.has(def.id)}
              canEdit={canEdit}
              slotRow={slotsById.get(def.id)}
              onChange={onChange}
            />
          ))
        ) : (
          <>
            <div className="space-y-3">
              {leftSlots.map((def) => (
                <SlotCard
                  key={def.id}
                  def={def}
                  resolvedSlot={resolved.get(def.id)}
                  localPred={local.get(def.id)}
                  isDead={deadSlotIds.has(def.id)}
                  canEdit={canEdit}
                  slotRow={slotsById.get(def.id)}
                  onChange={onChange}
                />
              ))}
            </div>
            <div className="space-y-3">
              {rightSlots.map((def) => (
                <SlotCard
                  key={def.id}
                  def={def}
                  resolvedSlot={resolved.get(def.id)}
                  localPred={local.get(def.id)}
                  isDead={deadSlotIds.has(def.id)}
                  canEdit={canEdit}
                  slotRow={slotsById.get(def.id)}
                  onChange={onChange}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function SlotCard({
  def,
  resolvedSlot,
  localPred,
  isDead,
  canEdit,
  slotRow,
  onChange,
}: {
  def: (typeof BRACKET_SLOTS)[number];
  resolvedSlot?: Resolved;
  localPred?: LocalPred;
  isDead: boolean;
  canEdit: boolean;
  slotRow?: BracketSlot;
  onChange: (slotId: string, patch: Partial<LocalPred>) => void;
}) {
  const team1 = resolvedSlot?.team1 ?? null;
  const team2 = resolvedSlot?.team2 ?? null;
  const waiting = !team1 || !team2;

  const t1 = localPred?.t1 ?? '';
  const t2 = localPred?.t2 ?? '';
  const isTie = t1 !== '' && t2 !== '' && t1 === t2;
  const penaltyWinner = localPred?.penaltyWinner ?? null;

  const isFinished = slotRow?.status === 'finished';
  const realT1 = slotRow?.result_team1;
  const realT2 = slotRow?.result_team2;

  return (
    <Card
      className={cn(
        'relative overflow-hidden transition-colors',
        isDead && 'border-danger/40 bg-danger/10'
      )}
    >
      {waiting && (
        <div className="text-[11px] text-text-muted italic mb-2">
          Esperando resultado de la ronda anterior…
        </div>
      )}
      {isDead && (
        <Badge variant="danger" className="mb-2">
          ✕ Rama eliminada
        </Badge>
      )}

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className="text-right">
          {team1 ? (
            <>
              <div className="text-xl mb-0.5">{teamFlag(team1)}</div>
              <div className="font-semibold text-sm leading-tight">{teamES(team1)}</div>
            </>
          ) : (
            <div className="text-text-muted text-sm italic">?</div>
          )}
        </div>

        <div className="flex items-center gap-1 px-1">
          <input
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={2}
            value={t1}
            disabled={!canEdit || waiting}
            onChange={(e) =>
              onChange(def.id, { t1: e.target.value.replace(/\D/g, ''), penaltyWinner: null })
            }
            className={cn(
              'w-10 text-center text-lg font-display font-bold bg-surface-2 border border-border rounded-lg py-1',
              'focus:outline-none focus:border-accent',
              (!canEdit || waiting) && 'opacity-50 cursor-not-allowed'
            )}
          />
          <span className="text-text-muted text-xs">–</span>
          <input
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={2}
            value={t2}
            disabled={!canEdit || waiting}
            onChange={(e) =>
              onChange(def.id, { t2: e.target.value.replace(/\D/g, ''), penaltyWinner: null })
            }
            className={cn(
              'w-10 text-center text-lg font-display font-bold bg-surface-2 border border-border rounded-lg py-1',
              'focus:outline-none focus:border-accent',
              (!canEdit || waiting) && 'opacity-50 cursor-not-allowed'
            )}
          />
        </div>

        <div className="text-left">
          {team2 ? (
            <>
              <div className="text-xl mb-0.5">{teamFlag(team2)}</div>
              <div className="font-semibold text-sm leading-tight">{teamES(team2)}</div>
            </>
          ) : (
            <div className="text-text-muted text-sm italic">?</div>
          )}
        </div>
      </div>

      {/* Selector de penaltis si hay empate */}
      {isTie && team1 && team2 && (
        <div className="mt-3 pt-3 border-t border-border">
          <div className="text-[11px] text-text-muted mb-1.5 text-center">
            Empate — ¿quién pasa en los penaltis?
          </div>
          <div className="flex gap-2 justify-center">
            <button
              type="button"
              disabled={!canEdit}
              onClick={() => onChange(def.id, { penaltyWinner: 1 })}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                penaltyWinner === 1
                  ? 'bg-accent text-black border-accent'
                  : 'bg-surface-2 border-border text-text-muted hover:text-text'
              )}
            >
              {teamFlag(team1)} {teamES(team1)}
            </button>
            <button
              type="button"
              disabled={!canEdit}
              onClick={() => onChange(def.id, { penaltyWinner: 2 })}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                penaltyWinner === 2
                  ? 'bg-accent text-black border-accent'
                  : 'bg-surface-2 border-border text-text-muted hover:text-text'
              )}
            >
              {teamFlag(team2)} {teamES(team2)}
            </button>
          </div>
        </div>
      )}

      {/* Resultado real, si ya está finished */}
      {isFinished && realT1 != null && realT2 != null && (
        <div className="mt-3 pt-3 border-t border-border text-center text-xs text-text-muted">
          Resultado real:{' '}
          <span className="font-display font-bold text-text">
            {realT1}–{realT2}
          </span>
          {slotRow?.real_penalty_winner && (
            <span> (penaltis: equipo {slotRow.real_penalty_winner})</span>
          )}
        </div>
      )}
    </Card>
  );
}

function ExtraStat({
  label,
  count,
  max,
  perTeam,
  subtotal,
}: {
  label: string;
  count: number;
  max: number;
  perTeam: number;
  subtotal: number;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface-2/40 px-3 py-2.5">
      <div className="text-[11px] text-text-muted mb-1">{label}</div>
      <div className="text-sm font-semibold">
        {count} / {max}
      </div>
      <div className="text-[11px] text-text-muted mt-1">
        +{perTeam} pts c/u · <span className="text-text font-medium">+{subtotal} pts</span>
      </div>
    </div>
  );
}

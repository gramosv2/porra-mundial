'use client';

import { useState, useEffect, useMemo } from 'react';
import { Badge, Input } from '@/components/ui';
import { teamES, teamFlag, cn } from '@/lib/utils';
import {
  BRACKET_SLOTS,
  BRACKET_SLOTS_BY_ID,
  BRACKET_PHASE_ORDER,
  BRACKET_PHASE_LABELS,
  T3_USES_LOSERS,
} from '@/config/bracket';
import { bracketPredictedWinner } from '@/config/scoring';
import type { BracketSlot, BracketPrediction } from '@/types';

export interface ProfileLite {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  total_points: number;
  bracket_points: number;
}

// =======================================================================
// Resolución del bracket de UN usuario (cliente): mismo algoritmo que
// resolveUserBracket en src/lib/bracket-engine.ts, pero en el cliente y
// sin tocar el servidor — solo para PINTAR qué equipos le tocan a cada
// usuario en cada casilla según sus propias elecciones de ganador.
// =======================================================================
export interface ResolvedSlot {
  team1: string | null;
  team2: string | null;
  predictedAdvancer: string | null;
}

export function resolveUserBracketClient(
  slots: BracketSlot[],
  userPreds: Map<string, BracketPrediction>
): Map<string, ResolvedSlot> {
  const slotsById = new Map(slots.map((s) => [s.id, s]));
  const resolved = new Map<string, ResolvedSlot>();

  function resolve(slotId: string): ResolvedSlot {
    const cached = resolved.get(slotId);
    if (cached) return cached;

    const def = BRACKET_SLOTS_BY_ID[slotId];
    const row = slotsById.get(slotId);
    const pred = userPreds.get(slotId);

    let team1: string | null = null;
    let team2: string | null = null;

    if (!def.fromSlot1 || !def.fromSlot2) {
      team1 = row?.team1_real ?? null;
      team2 = row?.team2_real ?? null;
    } else if (slotId === 'T3' && T3_USES_LOSERS) {
      const p1 = resolve(def.fromSlot1);
      const p2 = resolve(def.fromSlot2);
      team1 = loserOf(p1);
      team2 = loserOf(p2);
    } else {
      const p1 = resolve(def.fromSlot1);
      const p2 = resolve(def.fromSlot2);
      team1 = p1.predictedAdvancer;
      team2 = p2.predictedAdvancer;
    }

    let predictedAdvancer: string | null = null;
    if (pred && pred.pred_team1 != null && pred.pred_team2 != null && team1 && team2) {
      const winnerSlot = bracketPredictedWinner(
        pred.pred_team1,
        pred.pred_team2,
        pred.pred_penalty_winner
      );
      predictedAdvancer = winnerSlot === 1 ? team1 : team2;
    }

    const out: ResolvedSlot = { team1, team2, predictedAdvancer };
    resolved.set(slotId, out);
    return out;
  }

  function loserOf(p: ResolvedSlot): string | null {
    if (!p.predictedAdvancer || !p.team1 || !p.team2) return null;
    return p.predictedAdvancer === p.team1 ? p.team2 : p.team1;
  }

  for (const s of BRACKET_SLOTS) resolve(s.id);
  return resolved;
}

// =======================================================================
// Editor del cuadro completo de UN usuario (todas las fases, 32 casillas)
// =======================================================================
export function UserBracketEditor({
  profile,
  slots,
  userPreds,
  bracketLocked,
  onSaved,
}: {
  profile: ProfileLite;
  slots: BracketSlot[];
  userPreds: BracketPrediction[];
  bracketLocked: boolean;
  onSaved: () => void;
}) {
  const predsById = useMemo(() => new Map(userPreds.map((p) => [p.slot_id, p])), [userPreds]);
  const resolved = useMemo(() => resolveUserBracketClient(slots, predsById), [slots, predsById]);

  return (
    <div className="space-y-6">
      {bracketLocked && (
        <div className="text-[11px] text-text-muted italic">
          El cuadro global está cerrado para los usuarios, pero como admin
          puedes seguir editando cualquier casilla.
        </div>
      )}
      {BRACKET_PHASE_ORDER.map((phase) => {
        const defs = BRACKET_SLOTS.filter((s) => s.phase === phase);
        return (
          <div key={phase}>
            <h3 className="font-display text-sm font-semibold text-text-muted uppercase tracking-wide mb-2">
              {BRACKET_PHASE_LABELS[phase]}
            </h3>
            <div className="grid sm:grid-cols-2 gap-2">
              {defs.map((def) => (
                <UserSlotEditor
                  key={def.id}
                  slotId={def.id}
                  profile={profile}
                  resolvedSlot={resolved.get(def.id)}
                  existing={predsById.get(def.id) ?? null}
                  onSaved={onSaved}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function UserSlotEditor({
  slotId,
  profile,
  resolvedSlot,
  existing,
  onSaved,
}: {
  slotId: string;
  profile: ProfileLite;
  resolvedSlot?: ResolvedSlot;
  existing: BracketPrediction | null;
  onSaved: () => void;
}) {
  const team1 = resolvedSlot?.team1 ?? null;
  const team2 = resolvedSlot?.team2 ?? null;
  const knownMatchup = !!team1 && !!team2;

  const [p1, setP1] = useState<string>(existing?.pred_team1?.toString() ?? '');
  const [p2, setP2] = useState<string>(existing?.pred_team2?.toString() ?? '');
  const [penaltyWinner, setPenaltyWinner] = useState<1 | 2 | null>(
    existing?.pred_penalty_winner ?? null
  );
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const n1 = p1 === '' ? null : parseInt(p1, 10);
  const n2 = p2 === '' ? null : parseInt(p2, 10);
  const hasBoth = n1 != null && n2 != null && !Number.isNaN(n1) && !Number.isNaN(n2);
  const isTie = hasBoth && n1 === n2;

  useEffect(() => {
    if (!isTie && penaltyWinner != null) setPenaltyWinner(null);
  }, [isTie]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty =
    (existing?.pred_team1?.toString() ?? '') !== p1 ||
    (existing?.pred_team2?.toString() ?? '') !== p2 ||
    (existing?.pred_penalty_winner ?? null) !== penaltyWinner;

  async function save() {
    setMsg(null);
    if (!hasBoth || n1! < 0 || n2! < 0) {
      setMsg('Pon ambos goles');
      return;
    }
    if (isTie && penaltyWinner == null) {
      setMsg('Empate: elige quién pasa en penaltis');
      return;
    }
    setBusy(true);
    const res = await fetch('/api/admin/edit-bracket-prediction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slotId,
        userId: profile.id,
        pred1: n1,
        pred2: n2,
        penaltyWinner: isTie ? penaltyWinner : null,
      }),
    });
    setBusy(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(data.error ?? 'Error');
      return;
    }
    setMsg(data.warning ? '⚠ ' + data.warning : '✓ Guardado');
    setTimeout(() => setMsg(null), 2500);
    onSaved();
  }

  async function remove() {
    if (!existing) return;
    if (!confirm(`¿Borrar la predicción de ${profile.display_name} en ${slotId}?`)) return;
    setBusy(true);
    setMsg(null);
    const res = await fetch('/api/admin/edit-bracket-prediction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slotId, userId: profile.id, delete: true }),
    });
    setBusy(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(data.error ?? 'Error');
      return;
    }
    setP1('');
    setP2('');
    setPenaltyWinner(null);
    setMsg('✓ Borrada');
    setTimeout(() => setMsg(null), 2500);
    onSaved();
  }

  return (
    <div
      className={cn(
        'rounded-lg border px-3 py-2.5 space-y-2',
        existing?.is_dead
          ? 'border-danger/40 bg-danger/10'
          : existing
            ? 'border-border bg-surface-2/40'
            : 'border-dashed border-border/60'
      )}
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-[10px] font-mono text-text-muted">{slotId}</span>
        {existing?.is_dead && <Badge variant="danger">✕ rama eliminada</Badge>}
        {existing && !existing.is_dead && existing.points_earned > 0 && (
          <Badge variant="accent">+{existing.points_earned} pts</Badge>
        )}
      </div>

      {knownMatchup ? (
        <div className="flex items-center justify-center gap-2 text-sm">
          <span className="flex items-center gap-1 flex-1 justify-end">
            {teamFlag(team1!)} {teamES(team1!)}
          </span>
          <Input
            inputMode="numeric"
            pattern="[0-9]*"
            value={p1}
            onChange={(e) => setP1(e.target.value.replace(/\D/g, ''))}
            className="w-10 text-center !px-0 font-display font-bold"
            maxLength={2}
          />
          <span className="text-text-muted">–</span>
          <Input
            inputMode="numeric"
            pattern="[0-9]*"
            value={p2}
            onChange={(e) => setP2(e.target.value.replace(/\D/g, ''))}
            className="w-10 text-center !px-0 font-display font-bold"
            maxLength={2}
          />
          <span className="flex items-center gap-1 flex-1">
            {teamES(team2!)} {teamFlag(team2!)}
          </span>
        </div>
      ) : (
        <div className="text-center text-xs text-text-muted italic py-1">
          Este usuario aún no tiene rival conocido en esta casilla (depende
          de su elección en la ronda anterior).
        </div>
      )}

      {isTie && knownMatchup && (
        <div className="flex gap-1.5 justify-center">
          <button
            type="button"
            onClick={() => setPenaltyWinner(1)}
            className={cn(
              'px-2 py-1 rounded-full text-[11px] font-medium border',
              penaltyWinner === 1
                ? 'bg-accent text-black border-accent'
                : 'bg-surface-2 border-border text-text-muted'
            )}
          >
            {teamES(team1!)}
          </button>
          <button
            type="button"
            onClick={() => setPenaltyWinner(2)}
            className={cn(
              'px-2 py-1 rounded-full text-[11px] font-medium border',
              penaltyWinner === 2
                ? 'bg-accent text-black border-accent'
                : 'bg-surface-2 border-border text-text-muted'
            )}
          >
            {teamES(team2!)}
          </button>
        </div>
      )}

      {knownMatchup && (
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-text-muted truncate">{msg}</span>
          <div className="flex gap-1.5 flex-shrink-0">
            <button
              type="button"
              onClick={save}
              disabled={busy || !dirty}
              className={cn(
                'px-2.5 py-1 rounded-full text-[11px] font-medium border',
                dirty && !busy
                  ? 'bg-accent text-black border-accent'
                  : 'bg-surface border-border text-text-muted cursor-not-allowed'
              )}
            >
              {busy ? '…' : existing ? 'Guardar' : 'Añadir'}
            </button>
            {existing && (
              <button
                type="button"
                onClick={remove}
                disabled={busy}
                className="px-2 py-1 rounded-full text-[11px] border border-border text-danger hover:bg-danger/10"
              >
                🗑
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Avatar, Badge, Card, Input } from '@/components/ui';
import { PHASE_LABELS, type Phase } from '@/config/scoring';
import { formatMadridDate, teamES, teamFlag, cn } from '@/lib/utils';
import type { Match } from '@/types';

interface PredRow {
  id: number;
  user_id: string;
  match_id: number;
  pred_team1: number;
  pred_team2: number;
  points_earned: number;
}

interface ProfileLite {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
}

interface Props {
  matches: Match[];
  predsByMatchEntries: Array<[number, PredRow[]]>;
  profiles: ProfileLite[];
}

const PHASES: Array<Phase | 'todas'> = [
  'todas', 'grupos', 'r32', 'r16', 'cuartos', 'semis', 'tercero', 'final',
];

export function EditPrediccionesClient({ matches, predsByMatchEntries, profiles }: Props) {
  const [phase, setPhase] = useState<Phase | 'todas'>('todas');
  const [query, setQuery] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const predsByMatch = useMemo(() => new Map(predsByMatchEntries), [predsByMatchEntries]);

  const filtered = useMemo(() => {
    return matches.filter((m) => {
      if (phase !== 'todas' && m.phase !== phase) return false;
      if (query.trim()) {
        const q = query.toLowerCase();
        const hay = `${m.team1} ${m.team2} ${teamES(m.team1)} ${teamES(m.team2)} ${m.venue ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [matches, phase, query]);

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h2 className="font-display text-2xl font-bold">✏️ Editar predicciones</h2>
        <p className="text-sm text-text-muted">
          Todos los partidos por fecha. Abre uno para editar las predicciones de
          cada participante o añadir las que falten (p.ej. alguien que se unió tarde).
          Si el partido ya tiene resultado, los puntos se recalculan solos.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          placeholder="Buscar por equipo o sede…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="sm:max-w-xs"
        />
        <div className="flex gap-2 overflow-x-auto pb-1">
          {PHASES.map((p) => (
            <button
              key={p}
              onClick={() => setPhase(p)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-colors',
                phase === p
                  ? 'bg-accent text-black border-accent'
                  : 'bg-surface text-text-muted border-border hover:text-text'
              )}
            >
              {p === 'todas' ? 'Todas' : PHASE_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      <div className="text-xs text-text-muted">
        {filtered.length} {filtered.length === 1 ? 'partido' : 'partidos'} · {profiles.length} participantes
      </div>

      <div className="space-y-2">
        {filtered.map((m) => {
          const preds = predsByMatch.get(m.id) ?? [];
          const expanded = expandedId === m.id;
          const isFinished = m.status === 'finished';

          return (
            <Card key={m.id} className="!p-0 overflow-hidden">
              <button
                type="button"
                onClick={() => setExpandedId(expanded ? null : m.id)}
                className="w-full text-left px-4 py-3 hover:bg-surface-2/50 transition-colors"
              >
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="font-mono text-xs text-text-muted w-32 flex-shrink-0">
                    {formatMadridDate(m.match_date)}
                  </div>
                  <div className="flex-1 min-w-[200px] flex items-center gap-2">
                    <span className="text-lg">{teamFlag(m.team1)}</span>
                    <span className="font-semibold text-sm">{teamES(m.team1)}</span>
                    {isFinished ? (
                      <span className="font-display font-bold text-sm tabular-nums px-1">
                        {m.result_team1}–{m.result_team2}
                      </span>
                    ) : (
                      <span className="text-text-muted text-xs px-1">vs</span>
                    )}
                    <span className="text-lg">{teamFlag(m.team2)}</span>
                    <span className="font-semibold text-sm">{teamES(m.team2)}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge variant="default">
                      {m.phase === 'grupos' && m.group_name
                        ? `G${m.group_name} · J${m.matchday}`
                        : PHASE_LABELS[m.phase as Phase]}
                    </Badge>
                    {isFinished && <Badge variant="finished">Finalizado</Badge>}
                    <Badge variant={preds.length === profiles.length ? 'accent' : 'gold'}>
                      {preds.length}/{profiles.length}
                    </Badge>
                    <span className={cn('text-text-muted text-xs transition-transform', expanded && 'rotate-180')}>▾</span>
                  </div>
                </div>
              </button>

              {expanded && (
                <MatchEditor
                  match={m}
                  preds={preds}
                  profiles={profiles}
                />
              )}
            </Card>
          );
        })}

        {filtered.length === 0 && (
          <Card>
            <p className="text-sm text-text-muted text-center py-6">
              No hay partidos que coincidan con el filtro.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}

function MatchEditor({
  match,
  preds,
  profiles,
}: {
  match: Match;
  preds: PredRow[];
  profiles: ProfileLite[];
}) {
  const predByUser = new Map(preds.map((p) => [p.user_id, p]));

  return (
    <div className="border-t border-border px-4 py-4 bg-background/40 space-y-1.5">
      {profiles.map((prof) => (
        <PlayerRow
          key={prof.id}
          match={match}
          profile={prof}
          existing={predByUser.get(prof.id) ?? null}
        />
      ))}
    </div>
  );
}

function PlayerRow({
  match,
  profile,
  existing,
}: {
  match: Match;
  profile: ProfileLite;
  existing: PredRow | null;
}) {
  const router = useRouter();
  const [p1, setP1] = useState<string>(existing ? String(existing.pred_team1) : '');
  const [p2, setP2] = useState<string>(existing ? String(existing.pred_team2) : '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const dirty =
    (existing ? String(existing.pred_team1) : '') !== p1 ||
    (existing ? String(existing.pred_team2) : '') !== p2;

  async function save() {
    if (p1 === '' || p2 === '') {
      setMsg('Pon ambos goles');
      return;
    }
    setBusy(true);
    setMsg(null);
    const res = await fetch('/api/admin/edit-prediction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        matchId: match.id,
        userId: profile.id,
        pred1: Number(p1),
        pred2: Number(p2),
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
    router.refresh();
  }

  async function remove() {
    if (!existing) return;
    if (!confirm(`¿Borrar la predicción de ${profile.display_name}?`)) return;
    setBusy(true);
    setMsg(null);
    const res = await fetch('/api/admin/edit-prediction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matchId: match.id, userId: profile.id, delete: true }),
    });
    setBusy(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(data.error ?? 'Error');
      return;
    }
    setP1('');
    setP2('');
    setMsg('✓ Borrada');
    setTimeout(() => setMsg(null), 2500);
    router.refresh();
  }

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2 border',
        existing ? 'border-border bg-surface-2/40' : 'border-dashed border-border/60 bg-transparent'
      )}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {profile.avatar_url ? (
          <img src={profile.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
        ) : (
          <Avatar name={profile.display_name} size={28} />
        )}
        <div className="min-w-0">
          <div className="text-sm font-medium truncate">{profile.display_name}</div>
          <div className="text-[10px] text-text-muted truncate">
            @{profile.username}
            {!existing && ' · sin predicción'}
            {existing && match.status === 'finished' && ` · +${existing.points_earned} pts`}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 flex-shrink-0">
        <Input
          inputMode="numeric"
          pattern="[0-9]*"
          value={p1}
          onChange={(e) => setP1(e.target.value.replace(/\D/g, ''))}
          className="w-11 text-center text-base font-display font-bold !px-0"
          maxLength={2}
          placeholder="–"
        />
        <span className="text-text-muted">–</span>
        <Input
          inputMode="numeric"
          pattern="[0-9]*"
          value={p2}
          onChange={(e) => setP2(e.target.value.replace(/\D/g, ''))}
          className="w-11 text-center text-base font-display font-bold !px-0"
          maxLength={2}
          placeholder="–"
        />
      </div>

      <div className="flex items-center gap-1.5 flex-shrink-0 w-[150px] justify-end">
        {msg && <span className="text-[10px] text-text-muted truncate">{msg}</span>}
        <button
          type="button"
          onClick={save}
          disabled={busy || !dirty}
          className={cn(
            'px-2.5 py-1.5 rounded-full text-xs font-medium border transition-colors',
            dirty && !busy
              ? 'bg-accent text-black border-accent hover:bg-accent/90'
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
            className="px-2 py-1.5 rounded-full text-xs border border-border text-danger hover:bg-danger/10"
            title="Borrar predicción"
          >
            🗑
          </button>
        )}
      </div>
    </div>
  );
}

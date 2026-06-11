'use client';

import { useMemo, useState } from 'react';
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
  locked: boolean;
  submitted_at: string;
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
  'todas',
  'grupos',
  'r32',
  'r16',
  'cuartos',
  'semis',
  'tercero',
  'final',
];

export function PrediccionesAdminClient({
  matches,
  predsByMatchEntries,
  profiles,
}: Props) {
  const [phase, setPhase] = useState<Phase | 'todas'>('todas');
  const [query, setQuery] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const predsByMatch = useMemo(
    () => new Map(predsByMatchEntries),
    [predsByMatchEntries]
  );
  const profileById = useMemo(
    () => new Map(profiles.map((p) => [p.id, p])),
    [profiles]
  );

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
        <h2 className="font-display text-2xl font-bold">🔮 Predicciones por partido</h2>
        <p className="text-sm text-text-muted">
          Todos los partidos ordenados por fecha. Haz clic en uno para ver qué ha
          predicho cada participante (visible para ti aunque el partido no haya terminado).
        </p>
      </div>

      {/* Filtros */}
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
        {filtered.length} {filtered.length === 1 ? 'partido' : 'partidos'} ·{' '}
        {profiles.length} participantes
      </div>

      {/* Lista de partidos */}
      <div className="space-y-2">
        {filtered.map((m) => {
          const preds = predsByMatch.get(m.id) ?? [];
          const expanded = expandedId === m.id;
          const isFinished = m.status === 'finished';

          return (
            <Card key={m.id} className="!p-0 overflow-hidden">
              {/* Fila resumen (clicable) */}
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
                    {m.status === 'open' && <Badge variant="open">Abierto</Badge>}
                    {m.status === 'closed' && <Badge variant="closed">Cerrado</Badge>}
                    {isFinished && <Badge variant="finished">Finalizado</Badge>}
                    <Badge variant={preds.length === profiles.length ? 'accent' : 'gold'}>
                      {preds.length}/{profiles.length} predicciones
                    </Badge>
                    <span
                      className={cn(
                        'text-text-muted text-xs transition-transform',
                        expanded && 'rotate-180'
                      )}
                    >
                      ▾
                    </span>
                  </div>
                </div>
              </button>

              {/* Detalle expandido */}
              {expanded && (
                <MatchPredictionsDetail
                  match={m}
                  preds={preds}
                  profiles={profiles}
                  profileById={profileById}
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

function MatchPredictionsDetail({
  match,
  preds,
  profiles,
  profileById,
}: {
  match: Match;
  preds: PredRow[];
  profiles: ProfileLite[];
  profileById: Map<string, ProfileLite>;
}) {
  const isFinished = match.status === 'finished';

  // Ordenar: si finalizado → por puntos desc; si no → por nombre
  const sorted = [...preds].sort((a, b) => {
    if (isFinished && b.points_earned !== a.points_earned) {
      return b.points_earned - a.points_earned;
    }
    const na = profileById.get(a.user_id)?.display_name ?? '';
    const nb = profileById.get(b.user_id)?.display_name ?? '';
    return na.localeCompare(nb);
  });

  // Participantes sin predicción
  const predictedIds = new Set(preds.map((p) => p.user_id));
  const missing = profiles.filter((p) => !predictedIds.has(p.id));

  function hitType(p: PredRow): 'exact' | 'result' | 'miss' | null {
    if (!isFinished || match.result_team1 == null || match.result_team2 == null) return null;
    if (p.pred_team1 === match.result_team1 && p.pred_team2 === match.result_team2) return 'exact';
    if (
      Math.sign(p.pred_team1 - p.pred_team2) ===
      Math.sign(match.result_team1 - match.result_team2)
    )
      return 'result';
    return 'miss';
  }

  return (
    <div className="border-t border-border px-4 py-4 bg-background/40">
      {sorted.length === 0 ? (
        <p className="text-sm text-text-muted italic text-center py-3">
          Nadie ha hecho predicción para este partido todavía.
        </p>
      ) : (
        <div className="space-y-1.5">
          {sorted.map((p) => {
            const prof = profileById.get(p.user_id);
            const hit = hitType(p);
            return (
              <div
                key={p.id}
                className={cn(
                  'flex items-center justify-between gap-3 rounded-lg px-3 py-2 border',
                  hit === 'exact'
                    ? 'border-accent/40 bg-accent/10'
                    : hit === 'result'
                      ? 'border-gold/40 bg-gold/10'
                      : 'border-border bg-surface-2/50'
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {prof?.avatar_url ? (
                    <img
                      src={prof.avatar_url}
                      alt=""
                      className="w-7 h-7 rounded-full object-cover flex-shrink-0"
                    />
                  ) : (
                    <Avatar name={prof?.display_name ?? '?'} size={28} />
                  )}
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">
                      {prof?.display_name ?? 'Desconocido'}
                    </div>
                    <div className="text-[10px] text-text-muted truncate">
                      @{prof?.username ?? '?'} ·{' '}
                      {new Intl.DateTimeFormat('es-ES', {
                        timeZone: 'Europe/Madrid',
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      }).format(new Date(p.submitted_at))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  {p.locked && (
                    <span className="text-[10px] text-accent" title="Predicción confirmada">
                      🔒
                    </span>
                  )}
                  <span className="font-display font-bold text-base tabular-nums">
                    {p.pred_team1}–{p.pred_team2}
                  </span>
                  {isFinished && (
                    <span
                      className={cn(
                        'text-xs font-bold w-12 text-right',
                        hit === 'exact'
                          ? 'text-accent'
                          : hit === 'result'
                            ? 'text-gold'
                            : 'text-text-muted'
                      )}
                    >
                      +{p.points_earned}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Quién falta por predecir */}
      {missing.length > 0 && (
        <div className="mt-4 pt-3 border-t border-border">
          <div className="text-[10px] uppercase tracking-widest text-text-muted mb-2">
            Sin predicción ({missing.length})
          </div>
          <div className="flex flex-wrap gap-1.5">
            {missing.map((p) => (
              <span
                key={p.id}
                className="inline-flex items-center gap-1.5 text-xs text-text-muted bg-surface-2 border border-border rounded-full px-2.5 py-1"
              >
                <Avatar name={p.display_name} size={16} />
                {p.display_name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import { Avatar } from './ui';
import { cn } from '@/lib/utils';
import type { Profile } from '@/types';

interface UserCardProps {
  profile: Profile;
  rank: number;
  totalPlayers: number;
  /** Para mostrar progreso: nº de partidos jugados (con predicción) */
  totalPredicted?: number;
  /** Hace la card un poco más compacta en grids densos */
  compact?: boolean;
}

/**
 * Tarjeta-cromo de usuario al estilo del mock HTML adjunto.
 * - Imagen ocupa el 60% superior con el avatar grande (o iniciales).
 * - Sobre la foto: brand pequeño arriba-izq, badge de rank arriba-dcha,
 *   nombre + bandera abajo-izq y nº de jugadores abajo-dcha.
 * - Mitad inferior: 3 KPIs (Puntos, Exactos, Acertados) + 2 barras de
 *   progreso (Exactos vs total, Resultados vs total) + bio.
 */
export function UserCard({
  profile,
  rank,
  totalPlayers,
  totalPredicted,
  compact = false,
}: UserCardProps) {
  const hasAvatar = !!profile.avatar_url;
  const exactPct =
    totalPredicted && totalPredicted > 0
      ? Math.min(100, (profile.exact_scores / totalPredicted) * 100)
      : 0;
  const correctPct =
    totalPredicted && totalPredicted > 0
      ? Math.min(100, (profile.correct_results / totalPredicted) * 100)
      : 0;

  // Color del marco del rank según podio
  const rankBorder =
    rank === 1
      ? 'from-yellow-400 via-amber-500 to-yellow-600'
      : rank === 2
        ? 'from-zinc-300 via-zinc-400 to-zinc-500'
        : rank === 3
          ? 'from-orange-600 via-orange-700 to-amber-800'
          : 'from-zinc-600 via-zinc-700 to-zinc-800';

  const rankText =
    rank === 1
      ? 'from-yellow-400 via-amber-400 to-yellow-600'
      : rank === 2
        ? 'from-zinc-200 via-zinc-300 to-zinc-400'
        : rank === 3
          ? 'from-orange-400 via-orange-500 to-amber-600'
          : 'from-zinc-300 via-zinc-400 to-zinc-500';

  return (
    <div
      className={cn(
        'relative w-full bg-surface rounded-3xl overflow-hidden text-text select-none shadow-2xl border border-border flex flex-col group transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_20px_40px_rgba(16,185,129,0.15)]',
        compact ? 'h-[480px]' : 'h-[560px]'
      )}
    >
      {/* Reflejo en hover */}
      <div className="absolute inset-0 bg-[linear-gradient(110deg,rgba(255,255,255,0.01)_0%,rgba(255,255,255,0.05)_20%,rgba(255,255,255,0)_40%)] opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none transform -translate-x-full group-hover:translate-x-full ease-out" />

      {/* === Mitad superior: foto + overlays === */}
      <div className="relative w-full h-[60%] overflow-hidden bg-background flex-shrink-0">
        {hasAvatar ? (
          <img
            src={profile.avatar_url!}
            alt={profile.display_name}
            className="w-full h-full object-cover object-top filter saturate-[0.9] brightness-[0.85] transition-all duration-700 group-hover:scale-105 group-hover:saturate-100"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-surface-2 to-background">
            <Avatar name={profile.display_name} size={140} />
          </div>
        )}

        {/* Gradientes oscurecedores */}
        <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/30 to-black/40" />
        <div className="absolute inset-0 bg-gradient-to-r from-surface/40 to-transparent" />

        {/* Brand arriba-izq */}
        <div className="absolute top-4 left-4 flex flex-col pointer-events-none drop-shadow-[0_2px_8px_rgba(0,0,0,1)]">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-extrabold tracking-wider uppercase text-text">
              Porra
            </span>
            <span className="text-[11px]">🇺🇸🇨🇦🇲🇽</span>
          </div>
          <div className="text-[13px] font-extrabold tracking-tight mt-0.5 text-text">
            FIFA World Cup 2026 <span className="inline-block">🌎🏆</span>
          </div>
          <div className="text-[9px] font-bold text-accent tracking-wide mt-0.5 flex items-center gap-1 uppercase">
            <span>Win it all</span>
            <span className="text-[10px] tracking-normal">💶💶</span>
          </div>
        </div>

        {/* Rank arriba-dcha */}
        <div
          className={cn(
            'absolute top-4 right-4 bg-gradient-to-br p-[1px] rounded-xl shadow-lg shadow-black/50 transform transition-transform duration-500 group-hover:scale-105',
            rankBorder
          )}
        >
          <div className="bg-surface/95 backdrop-blur-md px-2.5 py-1.5 rounded-[11px] text-center min-w-[50px]">
            <span className="block text-[7px] uppercase tracking-widest font-extrabold text-text-muted leading-none mb-0.5">
              RANK
            </span>
            <span
              className={cn(
                'block text-lg font-extrabold bg-gradient-to-r bg-clip-text text-transparent filter drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)] leading-none',
                rankText
              )}
            >
              #{rank}
            </span>
          </div>
        </div>

        {/* Nombre + bandera abajo-izq, contador abajo-dcha */}
        <div className="absolute bottom-4 left-4 right-4">
          <div className="flex items-end justify-between gap-2">
            <div className="min-w-0">
              <h2 className="text-2xl font-extrabold tracking-tight text-text m-0 drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)] truncate">
                {profile.display_name}
              </h2>
              <div className="inline-flex items-center gap-1.5 bg-black/40 backdrop-blur-sm px-2.5 py-0.5 rounded-full border border-white/5 mt-1.5">
                <span className="text-xs filter drop-shadow-sm">🇪🇸</span>
                <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
                  España
                </span>
              </div>
            </div>

            <span className="text-[10px] text-text-muted bg-surface/90 backdrop-blur-sm px-2.5 py-1 rounded-lg border border-border font-medium shadow-sm whitespace-nowrap">
              de {totalPlayers} {totalPlayers === 1 ? 'jugador' : 'jugadores'}
            </span>
          </div>
        </div>
      </div>

      {/* === Mitad inferior: stats + bio === */}
      <div className="p-5 flex-1 flex flex-col justify-between bg-gradient-to-b from-surface to-background gap-3">
        {/* KPIs */}
        <div className="grid grid-cols-3 gap-2">
          <KPI label="Puntos" value={profile.total_points} color="text-text" />
          <KPI label="Exactos" value={profile.exact_scores} color="text-accent" />
          <KPI label="Acertados" value={profile.correct_results} color="text-amber-400" />
        </div>

        {/* Barras de progreso */}
        <div className="space-y-2.5">
          <ProgressBar
            label="Exactos"
            dotClass="bg-accent"
            current={profile.exact_scores}
            total={totalPredicted ?? 0}
            barClass="from-emerald-600 to-emerald-400"
            pct={exactPct}
          />
          <ProgressBar
            label="Resultados"
            dotClass="bg-amber-500"
            current={profile.correct_results}
            total={totalPredicted ?? 0}
            barClass="from-amber-600 to-amber-400"
            pct={correctPct}
          />
        </div>

        {/* Bio */}
        <div className="pt-3 border-t border-border/50">
          {profile.bio ? (
            <p className="text-[13px] font-semibold text-text-muted text-center px-1 leading-snug tracking-wide group-hover:text-text transition-colors line-clamp-4 break-words">
              {profile.bio}
            </p>
          ) : (
            <p className="text-[12px] italic text-text-muted/60 text-center px-1 leading-snug">
              Sin biografía
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function KPI({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="bg-surface-2/40 border border-border/40 rounded-xl py-1.5 px-2 text-center transition-colors group-hover:border-accent/20">
      <span className="block text-[8px] text-text-muted uppercase tracking-widest font-extrabold mb-0.5">
        {label}
      </span>
      <span className={cn('block text-xl font-extrabold leading-none', color)}>
        {value}
      </span>
    </div>
  );
}

function ProgressBar({
  label,
  dotClass,
  current,
  total,
  barClass,
  pct,
}: {
  label: string;
  dotClass: string;
  current: number;
  total: number;
  barClass: string;
  pct: number;
}) {
  return (
    <div>
      <div className="flex justify-between text-[10px] font-medium mb-1 px-0.5">
        <span className="text-text-muted flex items-center gap-1.5">
          <span className={cn('w-1.5 h-1.5 rounded-full', dotClass)} />
          {label}
        </span>
        <span className="text-text-muted font-bold">
          {current}{' '}
          <span className="text-text-muted/60 font-normal">/ {total}</span>
        </span>
      </div>
      <div className="h-1.5 bg-background rounded-full overflow-hidden p-[1px] border border-border">
        <div
          className={cn('h-full rounded-full bg-gradient-to-r', barClass)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

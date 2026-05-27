import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { formatMadridDate, teamES, teamFlag } from '@/lib/utils';

const FEATURED = ['Spain', 'Portugal', 'Italy', 'Brazil', 'Argentina', 'England', 'France', 'Germany'];

export async function SpainBanner() {
  const supabase = createClient();

  // Próximo partido de España
  const { data: spainMatch } = await supabase
    .from('matches')
    .select('*')
    .or('team1.eq.Spain,team2.eq.Spain')
    .gte('match_date', new Date().toISOString())
    .order('match_date', { ascending: true })
    .limit(1)
    .maybeSingle();

  // Si no hay partido de España, buscar próximo de equipos destacados
  let match = spainMatch;
  if (!match) {
    const { data: featuredMatch } = await supabase
      .from('matches')
      .select('*')
      .or(FEATURED.map((t) => `team1.eq.${t}`).join(',') + ',' + FEATURED.map((t) => `team2.eq.${t}`).join(','))
      .gte('match_date', new Date().toISOString())
      .order('match_date', { ascending: true })
      .limit(1)
      .maybeSingle();
    match = featuredMatch;
  }

  if (!match) {
    return (
      <div className="rounded-card border border-border bg-surface p-4 h-full flex items-center justify-center text-center">
        <div>
          <div className="text-3xl mb-2">⚽</div>
          <p className="text-xs text-text-muted">
            Sin partidos próximos
          </p>
        </div>
      </div>
    );
  }

  // Buscar TODAS las quedadas vinculadas al partido (puede haber varias)
  const { data: matchEvents } = await supabase
    .from('watch_events')
    .select('id, location, watch_attendees(count)')
    .eq('match_id', match.id);

  const events = matchEvents ?? [];
  const totalAttendees = events.reduce(
    (sum, e: any) => sum + (e.watch_attendees?.[0]?.count ?? 0),
    0
  );
  const attendeeCount = totalAttendees;
  const eventsCount = events.length;
  const event = events[0] ?? null; // primera quedada solo para mostrar ubicación de ejemplo
  const isSpain = match.team1 === 'Spain' || match.team2 === 'Spain';

  return (
    <div
      className={`relative rounded-card p-4 sm:p-5 overflow-hidden animate-slide-up h-full flex flex-col ${
        isSpain ? 'gradient-spain' : 'bg-surface border border-border'
      }`}
    >
      <div className="text-[10px] uppercase tracking-widest text-text-muted mb-2">
        {isSpain ? '🇪🇸 Próximo de España' : '⚽ Próximo destacado'}
      </div>

      <div className="font-display text-base sm:text-lg font-bold leading-tight">
        <div className="flex items-center gap-1.5">
          <span className="text-xl">{teamFlag(match.team1)}</span>
          <span className="truncate">{teamES(match.team1)}</span>
        </div>
        <div className="text-text-muted text-xs my-0.5">vs</div>
        <div className="flex items-center gap-1.5">
          <span className="text-xl">{teamFlag(match.team2)}</span>
          <span className="truncate">{teamES(match.team2)}</span>
        </div>
      </div>

      <div className="text-[11px] text-text-muted mt-2 leading-snug">
        {formatMadridDate(match.match_date)}
        {match.venue && <div className="text-text-muted/70 truncate">{match.venue}</div>}
      </div>

      <div className="flex-1" />

      {eventsCount > 0 && (
        <div className="text-[11px] text-text-muted mt-3 mb-2">
          🍺 <span className="font-semibold text-text">{attendeeCount}</span> apuntad
          {attendeeCount === 1 ? 'o' : 'os'} · {eventsCount}{' '}
          {eventsCount === 1 ? 'quedada' : 'quedadas'}
        </div>
      )}

      <Link
        href="/quedadas"
        className="mt-2 bg-accent text-black font-semibold px-3 py-2 rounded-full text-xs text-center hover:bg-accent/90 hover:shadow-[0_0_24px_-4px_rgba(16,185,129,0.6)] whitespace-nowrap block"
      >
        {eventsCount > 0 ? 'Ver quedadas' : 'Organizar quedada'}
      </Link>
    </div>
  );
}

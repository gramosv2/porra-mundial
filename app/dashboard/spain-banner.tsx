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

  if (!match) return null;

  // Buscar watch_event vinculado
  const { data: event } = await supabase
    .from('watch_events')
    .select('id, location, watch_attendees(count)')
    .eq('match_id', match.id)
    .maybeSingle();

  const attendeeCount = (event as any)?.watch_attendees?.[0]?.count ?? 0;
  const isSpain = match.team1 === 'Spain' || match.team2 === 'Spain';

  return (
    <div className={`relative rounded-card p-5 sm:p-6 overflow-hidden animate-slide-up ${isSpain ? 'gradient-spain' : 'bg-surface border border-border'}`}>
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
        <div className="flex-1 min-w-0">
          <div className="text-[11px] uppercase tracking-widest text-text-muted mb-2">
            {isSpain ? '🇪🇸 Próximo partido de España' : '⚽ Próximo partido destacado'}
          </div>
          <div className="font-display text-xl sm:text-2xl font-bold leading-tight flex items-center gap-2 flex-wrap">
            <span>{teamFlag(match.team1)}</span>
            <span>{teamES(match.team1)}</span>
            <span className="text-text-muted">vs</span>
            <span>{teamFlag(match.team2)}</span>
            <span>{teamES(match.team2)}</span>
          </div>
          <div className="text-sm text-text-muted mt-1.5">
            {formatMadridDate(match.match_date)}
            {match.venue && <> · {match.venue}</>}
          </div>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {event ? (
            <div className="text-right">
              <div className="text-sm">🍺 {attendeeCount} apuntad{attendeeCount === 1 ? 'o' : 'os'}</div>
              <div className="text-xs text-text-muted">{event.location}</div>
            </div>
          ) : null}
          <Link
            href="/quedadas"
            className="bg-accent text-black font-semibold px-4 py-2.5 rounded-full text-sm hover:bg-accent/90 hover:shadow-[0_0_24px_-4px_rgba(16,185,129,0.6)] whitespace-nowrap"
          >
            {event ? '¡Únete!' : 'Organizar quedada'}
          </Link>
        </div>
      </div>
    </div>
  );
}

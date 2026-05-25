import type { Match } from '@/types';
import { teamES } from './utils';

function toUtcStamp(iso: string): string {
  const d = new Date(iso);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mi = String(d.getUTCMinutes()).padStart(2, '0');
  const ss = String(d.getUTCSeconds()).padStart(2, '0');
  return `${yyyy}${mm}${dd}T${hh}${mi}${ss}Z`;
}

function escapeIcs(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

const PHASE_LABEL: Record<string, string> = {
  grupos: 'Fase de Grupos',
  r32: 'Ronda de 32',
  r16: 'Octavos',
  cuartos: 'Cuartos',
  semis: 'Semifinales',
  tercero: '3er Puesto',
  final: 'Final',
};

export function generateWorldCupICS(matches: Match[]): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PorraMundial2026//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Mundial 2026',
    'X-WR-TIMEZONE:UTC',
    'X-WR-CALDESC:Calendario completo del Mundial FIFA 2026',
  ];

  const stamp = toUtcStamp(new Date().toISOString());

  for (const m of matches) {
    const start = new Date(m.match_date);
    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000); // 2h

    const phaseLabel = PHASE_LABEL[m.phase] ?? m.phase;
    const summary = `⚽ ${teamES(m.team1)} vs ${teamES(m.team2)} — Mundial 2026`;
    const descParts = [`Fase: ${phaseLabel}`];
    if (m.group_name) descParts.push(`Grupo ${m.group_name} · Jornada ${m.matchday ?? '-'}`);
    if (m.venue) descParts.push(`Sede: ${m.venue}`);

    lines.push(
      'BEGIN:VEVENT',
      `UID:match-${m.id}@porramundial2026`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${toUtcStamp(start.toISOString())}`,
      `DTEND:${toUtcStamp(end.toISOString())}`,
      `SUMMARY:${escapeIcs(summary)}`,
      `DESCRIPTION:${escapeIcs(descParts.join('\n'))}`,
      `LOCATION:${escapeIcs(m.venue ?? '')}`,
      'DURATION:PT2H',
      'END:VEVENT'
    );
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

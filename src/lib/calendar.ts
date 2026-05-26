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
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/**
 * RFC 5545 line folding: corta cada línea a max 75 octetos.
 * Importante para iOS Safari / Calendar.app que son estrictos.
 */
function foldLine(line: string): string {
  const encoder = new TextEncoder();
  const MAX = 75;
  if (encoder.encode(line).length <= MAX) return line;

  const chunks: string[] = [];
  let current = '';
  let currentBytes = 0;

  for (const ch of line) {
    const chBytes = encoder.encode(ch).length;
    if (currentBytes + chBytes > MAX) {
      chunks.push(current);
      current = ch;
      currentBytes = chBytes;
    } else {
      current += ch;
      currentBytes += chBytes;
    }
  }
  if (current) chunks.push(current);
  return chunks[0] + chunks.slice(1).map((c) => '\r\n ' + c).join('');
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
    'PRODID:-//Porra FIFA 2026//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Porra FIFA World Cup 2026',
    'X-WR-TIMEZONE:UTC',
    'X-WR-CALDESC:Calendario completo del Mundial FIFA 2026',
  ];

  const stamp = toUtcStamp(new Date().toISOString());

  for (const m of matches) {
    const start = new Date(m.match_date);
    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);

    const phaseLabel = PHASE_LABEL[m.phase] ?? m.phase;
    const summary = `${teamES(m.team1)} vs ${teamES(m.team2)} - Mundial 2026`;
    const descParts = [`Fase: ${phaseLabel}`];
    if (m.group_name) descParts.push(`Grupo ${m.group_name} - Jornada ${m.matchday ?? '-'}`);
    if (m.venue) descParts.push(`Sede: ${m.venue}`);

    lines.push(
      'BEGIN:VEVENT',
      `UID:match-${m.id}@porra-fifa-2026`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${toUtcStamp(start.toISOString())}`,
      `DTEND:${toUtcStamp(end.toISOString())}`,
      `SUMMARY:${escapeIcs(summary)}`,
      `DESCRIPTION:${escapeIcs(descParts.join('\n'))}`,
      `LOCATION:${escapeIcs(m.venue ?? '')}`,
      'STATUS:CONFIRMED',
      'TRANSP:OPAQUE',
      'END:VEVENT'
    );
  }

  lines.push('END:VCALENDAR');

  return lines.map(foldLine).join('\r\n') + '\r\n';
}

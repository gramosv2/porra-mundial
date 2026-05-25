// =====================================================================
// SEED: 72 partidos de fase de grupos del Mundial 2026
// Las horas se proporcionan en hora local de cada sede.
// Se convierten a UTC para almacenar en la BD.
// Ejecutar: npx tsx scripts/seed-matches.ts
// =====================================================================
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// Mapeo sede → zona horaria IANA
const VENUE_TZ: Record<string, string> = {
  'Estadio Azteca': 'America/Mexico_City',
  'Estadio Akron': 'America/Mexico_City',
  'Estadio BBVA': 'America/Monterrey',
  'Mercedes-Benz Stadium': 'America/New_York',
  'BMO Field': 'America/Toronto',
  "Levi's Stadium": 'America/Los_Angeles',
  'SoFi Stadium': 'America/Los_Angeles',
  'BC Place': 'America/Vancouver',
  'Lumen Field': 'America/Los_Angeles',
  'MetLife Stadium': 'America/New_York',
  'Gillette Stadium': 'America/New_York',
  'Lincoln Financial Field': 'America/New_York',
  'Hard Rock Stadium': 'America/New_York',
  'NRG Stadium': 'America/Chicago',
  'AT&T Stadium': 'America/Chicago',
  'Arrowhead Stadium': 'America/Chicago',
};

/**
 * Convierte una fecha+hora dada en una timezone IANA a UTC ISO string.
 */
function localToUtc(year: number, month: number, day: number, hour: number, minute: number, tz: string): string {
  // Estrategia: construimos una fecha como si fuera UTC y luego corregimos por el offset
  // que esa fecha real tiene en la timezone solicitada.
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  const parts = fmt.formatToParts(utcGuess);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const asTz = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour') === 24 ? 0 : get('hour'),
    get('minute')
  );
  const offset = asTz - utcGuess.getTime();
  return new Date(utcGuess.getTime() - offset).toISOString();
}

type SeedMatch = {
  group: string;
  matchday: number;
  date: string; // 'YYYY-MM-DD HH:MM' en hora local de la sede
  team1: string;
  team2: string;
  venue: string;
};

const GROUPS: SeedMatch[] = [
  // Grupo A
  { group: 'A', matchday: 1, date: '2026-06-11 21:00', team1: 'Mexico', team2: 'South Africa', venue: 'Estadio Azteca' },
  { group: 'A', matchday: 1, date: '2026-06-12 04:00', team1: 'South Korea', team2: 'Czech Republic', venue: 'Estadio Akron' },
  { group: 'A', matchday: 2, date: '2026-06-18 18:00', team1: 'Czech Republic', team2: 'South Africa', venue: 'Mercedes-Benz Stadium' },
  { group: 'A', matchday: 2, date: '2026-06-19 03:00', team1: 'Mexico', team2: 'South Korea', venue: 'Estadio Azteca' },
  { group: 'A', matchday: 3, date: '2026-06-25 03:00', team1: 'South Africa', team2: 'South Korea', venue: 'Estadio BBVA' },
  { group: 'A', matchday: 3, date: '2026-06-25 03:00', team1: 'Czech Republic', team2: 'Mexico', venue: 'Estadio Azteca' },

  // Grupo B
  { group: 'B', matchday: 1, date: '2026-06-12 21:00', team1: 'Canada', team2: 'Bosnia and Herzegovina', venue: 'BMO Field' },
  { group: 'B', matchday: 1, date: '2026-06-13 21:00', team1: 'Qatar', team2: 'Switzerland', venue: "Levi's Stadium" },
  { group: 'B', matchday: 2, date: '2026-06-18 21:00', team1: 'Switzerland', team2: 'Bosnia and Herzegovina', venue: 'SoFi Stadium' },
  { group: 'B', matchday: 2, date: '2026-06-19 00:00', team1: 'Canada', team2: 'Qatar', venue: 'BC Place' },
  { group: 'B', matchday: 3, date: '2026-06-24 21:00', team1: 'Switzerland', team2: 'Canada', venue: 'BC Place' },
  { group: 'B', matchday: 3, date: '2026-06-24 21:00', team1: 'Bosnia and Herzegovina', team2: 'Qatar', venue: 'Lumen Field' },

  // Grupo C
  { group: 'C', matchday: 1, date: '2026-06-14 00:00', team1: 'Brazil', team2: 'Morocco', venue: 'MetLife Stadium' },
  { group: 'C', matchday: 1, date: '2026-06-14 03:00', team1: 'Haiti', team2: 'Scotland', venue: 'Gillette Stadium' },
  { group: 'C', matchday: 2, date: '2026-06-20 00:00', team1: 'Scotland', team2: 'Morocco', venue: 'Gillette Stadium' },
  { group: 'C', matchday: 2, date: '2026-06-20 02:30', team1: 'Brazil', team2: 'Haiti', venue: 'Lincoln Financial Field' },
  { group: 'C', matchday: 3, date: '2026-06-25 00:00', team1: 'Scotland', team2: 'Brazil', venue: 'Hard Rock Stadium' },
  { group: 'C', matchday: 3, date: '2026-06-25 00:00', team1: 'Morocco', team2: 'Haiti', venue: 'Mercedes-Benz Stadium' },

  // Grupo D
  { group: 'D', matchday: 1, date: '2026-06-13 03:00', team1: 'United States', team2: 'Paraguay', venue: 'SoFi Stadium' },
  { group: 'D', matchday: 1, date: '2026-06-14 06:00', team1: 'Australia', team2: 'Turkey', venue: 'BC Place' },
  { group: 'D', matchday: 2, date: '2026-06-19 21:00', team1: 'United States', team2: 'Australia', venue: 'Lumen Field' },
  { group: 'D', matchday: 2, date: '2026-06-20 05:00', team1: 'Turkey', team2: 'Paraguay', venue: "Levi's Stadium" },
  { group: 'D', matchday: 3, date: '2026-06-26 04:00', team1: 'Paraguay', team2: 'Australia', venue: "Levi's Stadium" },
  { group: 'D', matchday: 3, date: '2026-06-26 04:00', team1: 'Turkey', team2: 'United States', venue: 'SoFi Stadium' },

  // Grupo E
  { group: 'E', matchday: 1, date: '2026-06-14 19:00', team1: 'Germany', team2: 'Curaçao', venue: 'NRG Stadium' },
  { group: 'E', matchday: 1, date: '2026-06-15 01:00', team1: 'Ivory Coast', team2: 'Ecuador', venue: 'Lincoln Financial Field' },
  { group: 'E', matchday: 2, date: '2026-06-20 22:00', team1: 'Germany', team2: 'Ivory Coast', venue: 'BMO Field' },
  { group: 'E', matchday: 2, date: '2026-06-21 02:00', team1: 'Ecuador', team2: 'Curaçao', venue: 'Arrowhead Stadium' },
  { group: 'E', matchday: 3, date: '2026-06-25 22:00', team1: 'Ecuador', team2: 'Germany', venue: 'MetLife Stadium' },
  { group: 'E', matchday: 3, date: '2026-06-25 22:00', team1: 'Curaçao', team2: 'Ivory Coast', venue: 'Lincoln Financial Field' },

  // Grupo F
  { group: 'F', matchday: 1, date: '2026-06-14 22:00', team1: 'Netherlands', team2: 'Japan', venue: 'AT&T Stadium' },
  { group: 'F', matchday: 1, date: '2026-06-15 04:00', team1: 'Sweden', team2: 'Tunisia', venue: 'Estadio BBVA' },
  { group: 'F', matchday: 2, date: '2026-06-20 19:00', team1: 'Netherlands', team2: 'Sweden', venue: 'NRG Stadium' },
  { group: 'F', matchday: 2, date: '2026-06-21 06:00', team1: 'Tunisia', team2: 'Japan', venue: 'Estadio BBVA' },
  { group: 'F', matchday: 3, date: '2026-06-26 01:00', team1: 'Tunisia', team2: 'Netherlands', venue: 'Arrowhead Stadium' },
  { group: 'F', matchday: 3, date: '2026-06-26 01:00', team1: 'Japan', team2: 'Sweden', venue: 'AT&T Stadium' },

  // Grupo G
  { group: 'G', matchday: 1, date: '2026-06-15 21:00', team1: 'Belgium', team2: 'Egypt', venue: 'Lumen Field' },
  { group: 'G', matchday: 1, date: '2026-06-16 03:00', team1: 'Iran', team2: 'New Zealand', venue: 'SoFi Stadium' },
  { group: 'G', matchday: 2, date: '2026-06-21 21:00', team1: 'Belgium', team2: 'Iran', venue: 'SoFi Stadium' },
  { group: 'G', matchday: 2, date: '2026-06-22 03:00', team1: 'New Zealand', team2: 'Egypt', venue: 'BC Place' },
  { group: 'G', matchday: 3, date: '2026-06-27 05:00', team1: 'New Zealand', team2: 'Belgium', venue: 'BC Place' },
  { group: 'G', matchday: 3, date: '2026-06-27 05:00', team1: 'Egypt', team2: 'Iran', venue: 'Lumen Field' },

  // Grupo H
  { group: 'H', matchday: 1, date: '2026-06-15 18:00', team1: 'Spain', team2: 'Cape Verde', venue: 'Mercedes-Benz Stadium' },
  { group: 'H', matchday: 1, date: '2026-06-16 00:00', team1: 'Saudi Arabia', team2: 'Uruguay', venue: 'Hard Rock Stadium' },
  { group: 'H', matchday: 2, date: '2026-06-21 18:00', team1: 'Spain', team2: 'Saudi Arabia', venue: 'Mercedes-Benz Stadium' },
  { group: 'H', matchday: 2, date: '2026-06-22 00:00', team1: 'Uruguay', team2: 'Cape Verde', venue: 'Hard Rock Stadium' },
  { group: 'H', matchday: 3, date: '2026-06-27 02:00', team1: 'Uruguay', team2: 'Spain', venue: 'Estadio Akron' },
  { group: 'H', matchday: 3, date: '2026-06-27 02:00', team1: 'Cape Verde', team2: 'Saudi Arabia', venue: 'NRG Stadium' },

  // Grupo I
  { group: 'I', matchday: 1, date: '2026-06-16 21:00', team1: 'France', team2: 'Senegal', venue: 'MetLife Stadium' },
  { group: 'I', matchday: 1, date: '2026-06-17 00:00', team1: 'Iraq', team2: 'Norway', venue: 'Gillette Stadium' },
  { group: 'I', matchday: 2, date: '2026-06-22 23:00', team1: 'France', team2: 'Iraq', venue: 'Lincoln Financial Field' },
  { group: 'I', matchday: 2, date: '2026-06-23 02:00', team1: 'Norway', team2: 'Senegal', venue: 'MetLife Stadium' },
  { group: 'I', matchday: 3, date: '2026-06-26 21:00', team1: 'Norway', team2: 'France', venue: 'Gillette Stadium' },
  { group: 'I', matchday: 3, date: '2026-06-26 21:00', team1: 'Senegal', team2: 'Iraq', venue: 'BMO Field' },

  // Grupo J
  { group: 'J', matchday: 1, date: '2026-06-17 03:00', team1: 'Argentina', team2: 'Algeria', venue: 'Arrowhead Stadium' },
  { group: 'J', matchday: 1, date: '2026-06-17 06:00', team1: 'Austria', team2: 'Jordan', venue: "Levi's Stadium" },
  { group: 'J', matchday: 2, date: '2026-06-22 19:00', team1: 'Argentina', team2: 'Austria', venue: 'AT&T Stadium' },
  { group: 'J', matchday: 2, date: '2026-06-23 05:00', team1: 'Jordan', team2: 'Algeria', venue: "Levi's Stadium" },
  { group: 'J', matchday: 3, date: '2026-06-28 04:00', team1: 'Jordan', team2: 'Argentina', venue: 'AT&T Stadium' },
  { group: 'J', matchday: 3, date: '2026-06-28 04:00', team1: 'Algeria', team2: 'Austria', venue: 'Arrowhead Stadium' },

  // Grupo K
  { group: 'K', matchday: 1, date: '2026-06-17 19:00', team1: 'Portugal', team2: 'DR Congo', venue: 'NRG Stadium' },
  { group: 'K', matchday: 1, date: '2026-06-18 04:00', team1: 'Uzbekistan', team2: 'Colombia', venue: 'Estadio Azteca' },
  { group: 'K', matchday: 2, date: '2026-06-23 19:00', team1: 'Portugal', team2: 'Uzbekistan', venue: 'NRG Stadium' },
  { group: 'K', matchday: 2, date: '2026-06-24 04:00', team1: 'Colombia', team2: 'DR Congo', venue: 'Estadio Akron' },
  { group: 'K', matchday: 3, date: '2026-06-28 01:30', team1: 'Colombia', team2: 'Portugal', venue: 'Hard Rock Stadium' },
  { group: 'K', matchday: 3, date: '2026-06-28 01:30', team1: 'DR Congo', team2: 'Uzbekistan', venue: 'Mercedes-Benz Stadium' },

  // Grupo L
  { group: 'L', matchday: 1, date: '2026-06-17 22:00', team1: 'England', team2: 'Croatia', venue: 'AT&T Stadium' },
  { group: 'L', matchday: 1, date: '2026-06-18 01:00', team1: 'Ghana', team2: 'Panama', venue: 'BMO Field' },
  { group: 'L', matchday: 2, date: '2026-06-23 22:00', team1: 'England', team2: 'Ghana', venue: 'Gillette Stadium' },
  { group: 'L', matchday: 2, date: '2026-06-24 01:00', team1: 'Panama', team2: 'Croatia', venue: 'BMO Field' },
  { group: 'L', matchday: 3, date: '2026-06-27 23:00', team1: 'Panama', team2: 'England', venue: 'MetLife Stadium' },
  { group: 'L', matchday: 3, date: '2026-06-27 23:00', team1: 'Croatia', team2: 'Ghana', venue: 'Lincoln Financial Field' },
];

function parseLocal(dateStr: string, venue: string): string {
  const [d, t] = dateStr.split(' ');
  const [y, mo, da] = d.split('-').map(Number);
  const [h, mi] = t.split(':').map(Number);
  const tz = VENUE_TZ[venue] ?? 'America/New_York';
  return localToUtc(y, mo, da, h, mi, tz);
}

async function seed() {
  console.log(`Sembrando ${GROUPS.length} partidos de fase de grupos...`);

  for (const m of GROUPS) {
    const matchDateUtc = parseLocal(m.date, m.venue);

    // Idempotente: comprobamos si ya existe por (phase, group, team1, team2, matchday)
    const { data: existing } = await supabase
      .from('matches')
      .select('id')
      .eq('phase', 'grupos')
      .eq('group_name', m.group)
      .eq('matchday', m.matchday)
      .eq('team1', m.team1)
      .eq('team2', m.team2)
      .maybeSingle();

    if (existing) {
      console.log(`= [${m.group} J${m.matchday}] ${m.team1} vs ${m.team2}  (ya existe, skip)`);
      continue;
    }

    const { error } = await supabase.from('matches').insert({
      phase: 'grupos',
      group_name: m.group,
      matchday: m.matchday,
      match_date: matchDateUtc,
      team1: m.team1,
      team2: m.team2,
      venue: m.venue,
      status: 'open',
    });

    if (error) {
      console.error(`✗ Error insertando ${m.team1} vs ${m.team2}:`, error.message);
    } else {
      console.log(`✓ [${m.group} J${m.matchday}] ${m.team1} vs ${m.team2} @ ${m.venue}`);
    }
  }

  // Seed de partidos de eliminatorias con "Por determinar"
  await seedKnockoutSkeleton();

  console.log('\n✅ Seed completado.');
}

async function seedKnockoutSkeleton() {
  console.log('\nSembrando esqueleto de fases eliminatorias...');

  const knockoutPhases: { phase: 'r32' | 'r16' | 'cuartos' | 'semis' | 'tercero' | 'final'; count: number; baseDate: string }[] = [
    { phase: 'r32', count: 16, baseDate: '2026-06-30T20:00:00Z' },
    { phase: 'r16', count: 8, baseDate: '2026-07-04T20:00:00Z' },
    { phase: 'cuartos', count: 4, baseDate: '2026-07-09T20:00:00Z' },
    { phase: 'semis', count: 2, baseDate: '2026-07-14T20:00:00Z' },
    { phase: 'tercero', count: 1, baseDate: '2026-07-18T20:00:00Z' },
    { phase: 'final', count: 1, baseDate: '2026-07-19T20:00:00Z' },
  ];

  for (const k of knockoutPhases) {
    const { count } = await supabase
      .from('matches')
      .select('id', { count: 'exact', head: true })
      .eq('phase', k.phase);

    if ((count ?? 0) >= k.count) {
      console.log(`= ${k.phase}: ya hay ${count} partidos, skip`);
      continue;
    }

    const toInsert = Array.from({ length: k.count - (count ?? 0) }, () => ({
      phase: k.phase,
      group_name: null,
      matchday: null,
      match_date: k.baseDate,
      team1: 'Por determinar',
      team2: 'Por determinar',
      venue: null,
      status: 'open',
    }));

    const { error } = await supabase.from('matches').insert(toInsert);
    if (error) console.error(`✗ Error sembrando ${k.phase}:`, error.message);
    else console.log(`✓ ${k.phase}: insertados ${toInsert.length} partidos`);
  }
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});

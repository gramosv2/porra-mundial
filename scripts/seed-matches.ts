// =====================================================================
// SEED: 72 partidos de fase de grupos del Mundial 2026
// Horarios oficiales FIFA (verificados contra fifa.com/es, horario España).
// Las horas se almacenan en UTC. Hora Madrid = UTC + 2 (CEST junio-julio).
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

type SeedMatch = {
  group: string;
  matchday: number;
  utc: string;        // ISO UTC string
  team1: string;
  team2: string;
  venue: string;
};

// =====================================================================
// CALENDARIO OFICIAL — todas las horas en UTC.
// Hora España = UTC + 2h (CEST en junio/julio).
// =====================================================================
const GROUPS: SeedMatch[] = [
  // === Grupo A ===
  { group: 'A', matchday: 1, utc: '2026-06-11T19:00:00Z', team1: 'Mexico',          team2: 'South Africa',      venue: 'Estadio Azteca' },
  { group: 'A', matchday: 1, utc: '2026-06-12T02:00:00Z', team1: 'South Korea',     team2: 'Czech Republic',    venue: 'Estadio Akron' },
  { group: 'A', matchday: 2, utc: '2026-06-18T16:00:00Z', team1: 'Czech Republic',  team2: 'South Africa',      venue: 'Mercedes-Benz Stadium' },
  { group: 'A', matchday: 2, utc: '2026-06-19T01:00:00Z', team1: 'Mexico',          team2: 'South Korea',       venue: 'Estadio Akron' },
  { group: 'A', matchday: 3, utc: '2026-06-25T01:00:00Z', team1: 'Czech Republic',  team2: 'Mexico',            venue: 'Estadio Azteca' },
  { group: 'A', matchday: 3, utc: '2026-06-25T01:00:00Z', team1: 'South Africa',    team2: 'South Korea',       venue: 'Estadio BBVA' },

  // === Grupo B ===
  { group: 'B', matchday: 1, utc: '2026-06-12T19:00:00Z', team1: 'Canada',          team2: 'Bosnia and Herzegovina', venue: 'BMO Field' },
  { group: 'B', matchday: 1, utc: '2026-06-13T19:00:00Z', team1: 'Qatar',           team2: 'Switzerland',       venue: "Levi's Stadium" },
  { group: 'B', matchday: 2, utc: '2026-06-18T19:00:00Z', team1: 'Switzerland',     team2: 'Bosnia and Herzegovina', venue: 'SoFi Stadium' },
  { group: 'B', matchday: 2, utc: '2026-06-18T22:00:00Z', team1: 'Canada',          team2: 'Qatar',             venue: 'BC Place' },
  { group: 'B', matchday: 3, utc: '2026-06-24T19:00:00Z', team1: 'Switzerland',     team2: 'Canada',            venue: 'BC Place' },
  { group: 'B', matchday: 3, utc: '2026-06-24T19:00:00Z', team1: 'Bosnia and Herzegovina', team2: 'Qatar',      venue: 'Lumen Field' },

  // === Grupo C ===
  { group: 'C', matchday: 1, utc: '2026-06-13T22:00:00Z', team1: 'Brazil',          team2: 'Morocco',           venue: 'MetLife Stadium' },
  { group: 'C', matchday: 1, utc: '2026-06-14T01:00:00Z', team1: 'Haiti',           team2: 'Scotland',          venue: 'Gillette Stadium' },
  { group: 'C', matchday: 2, utc: '2026-06-19T22:00:00Z', team1: 'Scotland',        team2: 'Morocco',           venue: 'Gillette Stadium' },
  { group: 'C', matchday: 2, utc: '2026-06-20T00:30:00Z', team1: 'Brazil',          team2: 'Haiti',             venue: 'Lincoln Financial Field' },
  { group: 'C', matchday: 3, utc: '2026-06-24T22:00:00Z', team1: 'Scotland',        team2: 'Brazil',            venue: 'Hard Rock Stadium' },
  { group: 'C', matchday: 3, utc: '2026-06-24T22:00:00Z', team1: 'Morocco',         team2: 'Haiti',             venue: 'Mercedes-Benz Stadium' },

  // === Grupo D ===
  { group: 'D', matchday: 1, utc: '2026-06-13T01:00:00Z', team1: 'United States',   team2: 'Paraguay',          venue: 'SoFi Stadium' },
  { group: 'D', matchday: 1, utc: '2026-06-14T04:00:00Z', team1: 'Australia',       team2: 'Turkey',            venue: 'BC Place' },
  { group: 'D', matchday: 2, utc: '2026-06-19T19:00:00Z', team1: 'United States',   team2: 'Australia',         venue: 'Lumen Field' },
  { group: 'D', matchday: 2, utc: '2026-06-20T03:00:00Z', team1: 'Turkey',          team2: 'Paraguay',          venue: "Levi's Stadium" },
  { group: 'D', matchday: 3, utc: '2026-06-26T02:00:00Z', team1: 'Turkey',          team2: 'United States',     venue: 'SoFi Stadium' },
  { group: 'D', matchday: 3, utc: '2026-06-26T02:00:00Z', team1: 'Paraguay',        team2: 'Australia',         venue: "Levi's Stadium" },

  // === Grupo E ===
  { group: 'E', matchday: 1, utc: '2026-06-14T17:00:00Z', team1: 'Germany',         team2: 'Curaçao',           venue: 'NRG Stadium' },
  { group: 'E', matchday: 1, utc: '2026-06-14T23:00:00Z', team1: 'Ivory Coast',     team2: 'Ecuador',           venue: 'Lincoln Financial Field' },
  { group: 'E', matchday: 2, utc: '2026-06-20T20:00:00Z', team1: 'Germany',         team2: 'Ivory Coast',       venue: 'BMO Field' },
  { group: 'E', matchday: 2, utc: '2026-06-21T00:00:00Z', team1: 'Ecuador',         team2: 'Curaçao',           venue: 'Arrowhead Stadium' },
  { group: 'E', matchday: 3, utc: '2026-06-25T20:00:00Z', team1: 'Curaçao',         team2: 'Ivory Coast',       venue: 'Lincoln Financial Field' },
  { group: 'E', matchday: 3, utc: '2026-06-25T20:00:00Z', team1: 'Ecuador',         team2: 'Germany',           venue: 'MetLife Stadium' },

  // === Grupo F ===
  { group: 'F', matchday: 1, utc: '2026-06-14T20:00:00Z', team1: 'Netherlands',     team2: 'Japan',             venue: 'AT&T Stadium' },
  { group: 'F', matchday: 1, utc: '2026-06-15T02:00:00Z', team1: 'Sweden',          team2: 'Tunisia',           venue: 'Estadio BBVA' },
  { group: 'F', matchday: 2, utc: '2026-06-20T17:00:00Z', team1: 'Netherlands',     team2: 'Sweden',            venue: 'NRG Stadium' },
  { group: 'F', matchday: 2, utc: '2026-06-21T04:00:00Z', team1: 'Tunisia',         team2: 'Japan',             venue: 'Estadio BBVA' },
  { group: 'F', matchday: 3, utc: '2026-06-25T23:00:00Z', team1: 'Japan',           team2: 'Sweden',            venue: 'AT&T Stadium' },
  { group: 'F', matchday: 3, utc: '2026-06-25T23:00:00Z', team1: 'Tunisia',         team2: 'Netherlands',       venue: 'Arrowhead Stadium' },

  // === Grupo G ===
  { group: 'G', matchday: 1, utc: '2026-06-15T19:00:00Z', team1: 'Belgium',         team2: 'Egypt',             venue: 'Lumen Field' },
  { group: 'G', matchday: 1, utc: '2026-06-16T01:00:00Z', team1: 'Iran',            team2: 'New Zealand',       venue: 'SoFi Stadium' },
  { group: 'G', matchday: 2, utc: '2026-06-21T19:00:00Z', team1: 'Belgium',         team2: 'Iran',              venue: 'SoFi Stadium' },
  { group: 'G', matchday: 2, utc: '2026-06-22T01:00:00Z', team1: 'New Zealand',     team2: 'Egypt',             venue: 'BC Place' },
  { group: 'G', matchday: 3, utc: '2026-06-27T03:00:00Z', team1: 'Egypt',           team2: 'Iran',              venue: 'Lumen Field' },
  { group: 'G', matchday: 3, utc: '2026-06-27T03:00:00Z', team1: 'New Zealand',     team2: 'Belgium',           venue: 'BC Place' },

  // === Grupo H (España) ===
  { group: 'H', matchday: 1, utc: '2026-06-15T16:00:00Z', team1: 'Spain',           team2: 'Cape Verde',        venue: 'Mercedes-Benz Stadium' },
  { group: 'H', matchday: 1, utc: '2026-06-15T22:00:00Z', team1: 'Saudi Arabia',    team2: 'Uruguay',           venue: 'Hard Rock Stadium' },
  { group: 'H', matchday: 2, utc: '2026-06-21T16:00:00Z', team1: 'Spain',           team2: 'Saudi Arabia',      venue: 'Mercedes-Benz Stadium' },
  { group: 'H', matchday: 2, utc: '2026-06-21T22:00:00Z', team1: 'Uruguay',         team2: 'Cape Verde',        venue: 'Hard Rock Stadium' },
  { group: 'H', matchday: 3, utc: '2026-06-27T00:00:00Z', team1: 'Cape Verde',      team2: 'Saudi Arabia',      venue: 'NRG Stadium' },
  { group: 'H', matchday: 3, utc: '2026-06-27T00:00:00Z', team1: 'Uruguay',         team2: 'Spain',             venue: 'Estadio Akron' },

  // === Grupo I ===
  { group: 'I', matchday: 1, utc: '2026-06-16T19:00:00Z', team1: 'France',          team2: 'Senegal',           venue: 'MetLife Stadium' },
  { group: 'I', matchday: 1, utc: '2026-06-16T22:00:00Z', team1: 'Iraq',            team2: 'Norway',            venue: 'Gillette Stadium' },
  { group: 'I', matchday: 2, utc: '2026-06-22T21:00:00Z', team1: 'France',          team2: 'Iraq',              venue: 'Lincoln Financial Field' },
  { group: 'I', matchday: 2, utc: '2026-06-23T00:00:00Z', team1: 'Norway',          team2: 'Senegal',           venue: 'MetLife Stadium' },
  { group: 'I', matchday: 3, utc: '2026-06-26T19:00:00Z', team1: 'Norway',          team2: 'France',            venue: 'Gillette Stadium' },
  { group: 'I', matchday: 3, utc: '2026-06-26T19:00:00Z', team1: 'Senegal',         team2: 'Iraq',              venue: 'BMO Field' },

  // === Grupo J ===
  { group: 'J', matchday: 1, utc: '2026-06-17T01:00:00Z', team1: 'Argentina',       team2: 'Algeria',           venue: 'Arrowhead Stadium' },
  { group: 'J', matchday: 1, utc: '2026-06-17T04:00:00Z', team1: 'Austria',         team2: 'Jordan',            venue: "Levi's Stadium" },
  { group: 'J', matchday: 2, utc: '2026-06-22T17:00:00Z', team1: 'Argentina',       team2: 'Austria',           venue: 'AT&T Stadium' },
  { group: 'J', matchday: 2, utc: '2026-06-23T03:00:00Z', team1: 'Jordan',          team2: 'Algeria',           venue: "Levi's Stadium" },
  { group: 'J', matchday: 3, utc: '2026-06-28T02:00:00Z', team1: 'Algeria',         team2: 'Austria',           venue: 'Arrowhead Stadium' },
  { group: 'J', matchday: 3, utc: '2026-06-28T02:00:00Z', team1: 'Jordan',          team2: 'Argentina',         venue: 'AT&T Stadium' },

  // === Grupo K ===
  { group: 'K', matchday: 1, utc: '2026-06-17T17:00:00Z', team1: 'Portugal',        team2: 'DR Congo',          venue: 'NRG Stadium' },
  { group: 'K', matchday: 1, utc: '2026-06-18T02:00:00Z', team1: 'Uzbekistan',      team2: 'Colombia',          venue: 'Estadio Azteca' },
  { group: 'K', matchday: 2, utc: '2026-06-23T17:00:00Z', team1: 'Portugal',        team2: 'Uzbekistan',        venue: 'NRG Stadium' },
  { group: 'K', matchday: 2, utc: '2026-06-24T02:00:00Z', team1: 'Colombia',        team2: 'DR Congo',          venue: 'Estadio Akron' },
  { group: 'K', matchday: 3, utc: '2026-06-27T23:30:00Z', team1: 'Colombia',        team2: 'Portugal',          venue: 'Hard Rock Stadium' },
  { group: 'K', matchday: 3, utc: '2026-06-27T23:30:00Z', team1: 'DR Congo',        team2: 'Uzbekistan',        venue: 'Mercedes-Benz Stadium' },

  // === Grupo L ===
  { group: 'L', matchday: 1, utc: '2026-06-17T20:00:00Z', team1: 'England',         team2: 'Croatia',           venue: 'AT&T Stadium' },
  { group: 'L', matchday: 1, utc: '2026-06-17T23:00:00Z', team1: 'Ghana',           team2: 'Panama',            venue: 'BMO Field' },
  { group: 'L', matchday: 2, utc: '2026-06-23T20:00:00Z', team1: 'England',         team2: 'Ghana',             venue: 'Gillette Stadium' },
  { group: 'L', matchday: 2, utc: '2026-06-23T23:00:00Z', team1: 'Panama',          team2: 'Croatia',           venue: 'BMO Field' },
  { group: 'L', matchday: 3, utc: '2026-06-27T21:00:00Z', team1: 'Panama',          team2: 'England',           venue: 'MetLife Stadium' },
  { group: 'L', matchday: 3, utc: '2026-06-27T21:00:00Z', team1: 'Croatia',         team2: 'Ghana',             venue: 'Lincoln Financial Field' },
];

async function seed() {
  console.log(`Sembrando ${GROUPS.length} partidos de fase de grupos (horarios oficiales FIFA)...`);

  for (const m of GROUPS) {
    // Idempotente: comprobamos por (phase, group, team1, team2, matchday)
    const { data: existing } = await supabase
      .from('matches')
      .select('id, match_date, venue')
      .eq('phase', 'grupos')
      .eq('group_name', m.group)
      .eq('matchday', m.matchday)
      .eq('team1', m.team1)
      .eq('team2', m.team2)
      .maybeSingle();

    if (existing) {
      // Si hora o sede difiere, ACTUALIZAMOS (no toca predicciones)
      if (existing.match_date !== m.utc || existing.venue !== m.venue) {
        const { error } = await supabase
          .from('matches')
          .update({ match_date: m.utc, venue: m.venue })
          .eq('id', existing.id);
        if (error) {
          console.error(`✗ Error actualizando ${m.team1} vs ${m.team2}:`, error.message);
        } else {
          console.log(`↻ [${m.group} J${m.matchday}] ${m.team1} vs ${m.team2}  (actualizado: ${m.utc})`);
        }
      } else {
        console.log(`= [${m.group} J${m.matchday}] ${m.team1} vs ${m.team2}  (sin cambios)`);
      }
      continue;
    }

    const { error } = await supabase.from('matches').insert({
      phase: 'grupos',
      group_name: m.group,
      matchday: m.matchday,
      match_date: m.utc,
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

  await seedKnockoutSkeleton();

  console.log('\n✅ Seed completado.');
}

async function seedKnockoutSkeleton() {
  console.log('\nSembrando esqueleto de fases eliminatorias...');

  const knockoutPhases: { phase: 'r32' | 'r16' | 'cuartos' | 'semis' | 'tercero' | 'final'; count: number; baseDate: string }[] = [
    { phase: 'r32',     count: 16, baseDate: '2026-06-30T20:00:00Z' },
    { phase: 'r16',     count: 8,  baseDate: '2026-07-04T20:00:00Z' },
    { phase: 'cuartos', count: 4,  baseDate: '2026-07-09T20:00:00Z' },
    { phase: 'semis',   count: 2,  baseDate: '2026-07-14T20:00:00Z' },
    { phase: 'tercero', count: 1,  baseDate: '2026-07-18T22:00:00Z' },
    { phase: 'final',   count: 1,  baseDate: '2026-07-19T20:00:00Z' },
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

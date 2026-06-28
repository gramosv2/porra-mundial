// =====================================================================
// ESTRUCTURA DEL CUADRO DE ELIMINATORIAS — Mundial 2026
// =====================================================================
// Fuente de verdad única del "árbol" del bracket: 32 casillas fijas
// (16 dieciseisavos + 8 octavos + 4 cuartos + 2 semis + 1 final + 1 tercero).
//
// Cada casilla (slot) sabe de qué dos casillas anteriores vienen sus
// equipos. Los slots de dieciseisavos no tienen "padres": sus equipos son
// fijos y reales (team1_real / team2_real, columnas de bracket_slots).
//
// IMPORTANTE: esto NO son los partidos reales del Mundial todavía (eso vive
// en bracket_slots, tabla admin). Esto es solo la FORMA del árbol, igual
// para todo el mundo. Lo que cambia entre usuarios son los equipos que
// avanzan en cada rama, según lo que cada uno predijo.
// =====================================================================

export type BracketPhase = 'r16' | 'r8' | 'qf' | 'sf' | 'f' | 't3';

export interface BracketSlotDef {
  id: string;
  phase: BracketPhase;
  /** Orden de visualización dentro de su fase (1-indexado) */
  order: number;
  /** Lado del cuadro, solo informativo para el layout visual */
  side: 'L' | 'R' | 'C';
  /** IDs de los slots de los que provienen team1 y team2. null en r16 (equipos fijos). */
  fromSlot1: string | null;
  fromSlot2: string | null;
}

// ---------------------------------------------------------------------
// DIECISEISAVOS (16 slots) — equipos reales, fijos, sin padres.
// Numeración según el cuadro oficial pasado por el admin.
// ---------------------------------------------------------------------
const R16_SLOTS: BracketSlotDef[] = [
  { id: 'R16_1', phase: 'r16', order: 1, side: 'L', fromSlot1: null, fromSlot2: null }, // ALE vs PAR
  { id: 'R16_2', phase: 'r16', order: 2, side: 'L', fromSlot1: null, fromSlot2: null }, // FRA vs SUE
  { id: 'R16_3', phase: 'r16', order: 3, side: 'L', fromSlot1: null, fromSlot2: null }, // RSA vs CAN
  { id: 'R16_4', phase: 'r16', order: 4, side: 'L', fromSlot1: null, fromSlot2: null }, // PBA vs MAR
  { id: 'R16_5', phase: 'r16', order: 5, side: 'L', fromSlot1: null, fromSlot2: null }, // POR vs CRO
  { id: 'R16_6', phase: 'r16', order: 6, side: 'L', fromSlot1: null, fromSlot2: null }, // ESP vs AUT
  { id: 'R16_7', phase: 'r16', order: 7, side: 'L', fromSlot1: null, fromSlot2: null }, // EEUU vs BIH
  { id: 'R16_8', phase: 'r16', order: 8, side: 'L', fromSlot1: null, fromSlot2: null }, // BEL vs SEN
  { id: 'R16_9', phase: 'r16', order: 9, side: 'R', fromSlot1: null, fromSlot2: null }, // BRA vs JPN
  { id: 'R16_10', phase: 'r16', order: 10, side: 'R', fromSlot1: null, fromSlot2: null }, // CMA vs NOR
  { id: 'R16_11', phase: 'r16', order: 11, side: 'R', fromSlot1: null, fromSlot2: null }, // MEX vs ECU
  { id: 'R16_12', phase: 'r16', order: 12, side: 'R', fromSlot1: null, fromSlot2: null }, // ING vs RDC
  { id: 'R16_13', phase: 'r16', order: 13, side: 'R', fromSlot1: null, fromSlot2: null }, // ARG vs CAV
  { id: 'R16_14', phase: 'r16', order: 14, side: 'R', fromSlot1: null, fromSlot2: null }, // AUS vs EGI
  { id: 'R16_15', phase: 'r16', order: 15, side: 'R', fromSlot1: null, fromSlot2: null }, // SUI vs AGL
  { id: 'R16_16', phase: 'r16', order: 16, side: 'R', fromSlot1: null, fromSlot2: null }, // COL vs GHA
];

// ---------------------------------------------------------------------
// OCTAVOS (8 slots) — equipos dependen del ganador de 2 dieciseisavos.
// ---------------------------------------------------------------------
const R8_SLOTS: BracketSlotDef[] = [
  { id: 'R8_1', phase: 'r8', order: 1, side: 'L', fromSlot1: 'R16_1', fromSlot2: 'R16_2' },
  { id: 'R8_2', phase: 'r8', order: 2, side: 'L', fromSlot1: 'R16_3', fromSlot2: 'R16_4' },
  { id: 'R8_3', phase: 'r8', order: 3, side: 'L', fromSlot1: 'R16_5', fromSlot2: 'R16_6' },
  { id: 'R8_4', phase: 'r8', order: 4, side: 'L', fromSlot1: 'R16_7', fromSlot2: 'R16_8' },
  { id: 'R8_5', phase: 'r8', order: 5, side: 'R', fromSlot1: 'R16_9', fromSlot2: 'R16_10' },
  { id: 'R8_6', phase: 'r8', order: 6, side: 'R', fromSlot1: 'R16_11', fromSlot2: 'R16_12' },
  { id: 'R8_7', phase: 'r8', order: 7, side: 'R', fromSlot1: 'R16_13', fromSlot2: 'R16_14' },
  { id: 'R8_8', phase: 'r8', order: 8, side: 'R', fromSlot1: 'R16_15', fromSlot2: 'R16_16' },
];

// ---------------------------------------------------------------------
// CUARTOS (4 slots)
// ---------------------------------------------------------------------
const QF_SLOTS: BracketSlotDef[] = [
  { id: 'QF_1', phase: 'qf', order: 1, side: 'L', fromSlot1: 'R8_1', fromSlot2: 'R8_2' },
  { id: 'QF_2', phase: 'qf', order: 2, side: 'L', fromSlot1: 'R8_3', fromSlot2: 'R8_4' },
  { id: 'QF_3', phase: 'qf', order: 3, side: 'R', fromSlot1: 'R8_5', fromSlot2: 'R8_6' },
  { id: 'QF_4', phase: 'qf', order: 4, side: 'R', fromSlot1: 'R8_7', fromSlot2: 'R8_8' },
];

// ---------------------------------------------------------------------
// SEMIS (2 slots)
// ---------------------------------------------------------------------
const SF_SLOTS: BracketSlotDef[] = [
  { id: 'SF_1', phase: 'sf', order: 1, side: 'L', fromSlot1: 'QF_1', fromSlot2: 'QF_2' },
  { id: 'SF_2', phase: 'sf', order: 2, side: 'R', fromSlot1: 'QF_3', fromSlot2: 'QF_4' },
];

// ---------------------------------------------------------------------
// FINAL Y TERCER PUESTO
// El tercer puesto enfrenta a los PERDEDORES de las semis (no a los
// ganadores) — se resuelve con el flag `usesLosers` por separado.
// ---------------------------------------------------------------------
const FINAL_SLOTS: BracketSlotDef[] = [
  { id: 'T3', phase: 't3', order: 1, side: 'C', fromSlot1: 'SF_1', fromSlot2: 'SF_2' },
  { id: 'F', phase: 'f', order: 1, side: 'C', fromSlot1: 'SF_1', fromSlot2: 'SF_2' },
];

export const BRACKET_SLOTS: BracketSlotDef[] = [
  ...R16_SLOTS,
  ...R8_SLOTS,
  ...QF_SLOTS,
  ...SF_SLOTS,
  ...FINAL_SLOTS,
];

export const BRACKET_SLOTS_BY_ID: Record<string, BracketSlotDef> = Object.fromEntries(
  BRACKET_SLOTS.map((s) => [s.id, s])
);

// El slot T3 es especial: usa los PERDEDORES de SF_1/SF_2, no los ganadores.
export const T3_USES_LOSERS = true;

export const BRACKET_PHASE_ORDER: BracketPhase[] = ['r16', 'r8', 'qf', 'sf', 'f', 't3'];

export const BRACKET_PHASE_LABELS: Record<BracketPhase, string> = {
  r16: 'Dieciseisavos',
  r8: 'Octavos',
  qf: 'Cuartos',
  sf: 'Semifinales',
  f: 'Final',
  t3: '3er Puesto',
};

/** Slots descendientes directos e indirectos de un slot dado (toda su rama hacia la final). */
export function getDescendantSlots(slotId: string): string[] {
  const out: string[] = [];
  const queue = [slotId];
  while (queue.length) {
    const current = queue.shift()!;
    for (const s of BRACKET_SLOTS) {
      if (s.fromSlot1 === current || s.fromSlot2 === current) {
        out.push(s.id);
        queue.push(s.id);
      }
    }
  }
  return out;
}

/** Devuelve los IDs de los dos slots padres de un slot, o null si es r16. */
export function getParentSlots(slotId: string): [string, string] | null {
  const def = BRACKET_SLOTS_BY_ID[slotId];
  if (!def || !def.fromSlot1 || !def.fromSlot2) return null;
  return [def.fromSlot1, def.fromSlot2];
}

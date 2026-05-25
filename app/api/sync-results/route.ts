import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { recalculateMatchPoints } from '@/lib/scoring-engine';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const FOOTBALL_DATA_URL = 'https://api.football-data.org/v4/competitions/WC/matches';

/**
 * Verifica autorización por:
 *  - Authorization: Bearer <SYNC_SECRET>  (uso manual desde admin)
 *  - Cron de Vercel envía cabecera `Authorization: Bearer <CRON_SECRET>` por defecto.
 *    Aceptamos SYNC_SECRET en ambos casos para simplificar.
 */
function isAuthorized(req: NextRequest): boolean {
  const auth = req.headers.get('authorization') ?? '';
  const syncSecret = process.env.SYNC_SECRET;
  const cronSecret = process.env.CRON_SECRET; // Inyectado por Vercel cuando ejecuta cron
  if (syncSecret && auth === `Bearer ${syncSecret}`) return true;
  if (cronSecret && auth === `Bearer ${cronSecret}`) return true;
  return false;
}

async function runSync() {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  if (!apiKey) {
    return { ok: false, error: 'FOOTBALL_DATA_API_KEY no configurada', updated: 0 };
  }

  const supabase = createAdminClient();

  const res = await fetch(FOOTBALL_DATA_URL, {
    headers: { 'X-Auth-Token': apiKey },
    // No cachear: necesitamos datos frescos
    cache: 'no-store',
  });

  if (!res.ok) {
    return {
      ok: false,
      error: `football-data.org devolvió ${res.status}`,
      updated: 0,
    };
  }

  const payload = (await res.json()) as {
    matches?: Array<{
      id: number;
      status: string;
      homeTeam: { name: string };
      awayTeam: { name: string };
      score?: {
        fullTime?: { home: number | null; away: number | null };
      };
    }>;
  };

  let updated = 0;
  const updatedMatchIds: number[] = [];

  for (const apiMatch of payload.matches ?? []) {
    if (apiMatch.status !== 'FINISHED') continue;
    const home = apiMatch.score?.fullTime?.home;
    const away = apiMatch.score?.fullTime?.away;
    if (home == null || away == null) continue;

    // Buscar nuestro partido por api_match_id
    const { data: localMatch } = await supabase
      .from('matches')
      .select('*')
      .eq('api_match_id', String(apiMatch.id))
      .maybeSingle();

    if (!localMatch) continue;
    // Solo procesar si todavía no estaba finalizado o si cambia el resultado
    if (
      localMatch.status === 'finished' &&
      localMatch.result_team1 === home &&
      localMatch.result_team2 === away
    ) {
      continue;
    }

    const { error: updErr } = await supabase
      .from('matches')
      .update({
        result_team1: home,
        result_team2: away,
        status: 'finished',
      })
      .eq('id', localMatch.id);

    if (updErr) continue;

    try {
      await recalculateMatchPoints(supabase, localMatch.id);
      updated += 1;
      updatedMatchIds.push(localMatch.id);
    } catch (e) {
      // Continuar con el resto
    }
  }

  return { ok: true, updated, updatedMatchIds };
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  const result = await runSync();
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  const result = await runSync();
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateWorldCupICS } from '@/lib/calendar';
import type { Match } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = createClient();

  const { data: matches, error } = await supabase
    .from('matches')
    .select('*')
    .order('match_date', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const ics = generateWorldCupICS((matches ?? []) as Match[]);

  return new NextResponse(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="mundial2026.ics"',
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}

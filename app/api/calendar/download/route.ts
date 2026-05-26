import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { generateWorldCupICS } from '@/lib/calendar';
import type { Match } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const supabase = createAdminClient();

  const { data: matches, error } = await supabase
    .from('matches')
    .select('*')
    .order('match_date', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const ics = generateWorldCupICS((matches ?? []) as Match[]);

  const wantDownload = req.nextUrl.searchParams.get('download') === '1';
  const disposition = wantDownload
    ? 'attachment; filename="mundial2026.ics"'
    : 'inline; filename="mundial2026.ics"';

  return new NextResponse(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': disposition,
      'Cache-Control': 'no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

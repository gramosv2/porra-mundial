import { AppShell, requireApprovedUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { CuadroClient } from './cuadro-client';
import type { BracketSlot, BracketPrediction } from '@/types';

export const dynamic = 'force-dynamic';

export default async function CuadroPage() {
  const profile = await requireApprovedUser();
  const supabase = createClient();

  const { data: slots } = await supabase
    .from('bracket_slots')
    .select('*')
    .order('phase', { ascending: true })
    .order('order_num', { ascending: true });

  const { data: myPreds } = await supabase
    .from('bracket_predictions')
    .select('*')
    .eq('user_id', profile.id);

  const { data: lockSetting } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'bracket_locked')
    .maybeSingle();

  const bracketLocked = lockSetting?.value === true;

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="font-display text-4xl font-bold">Cuadro de Eliminatorias</h1>
        <p className="text-text-muted text-sm mt-1">
          Rellena tu camino completo hasta la final. Si fallas un cruce, esa rama
          se marca en rojo y deja de puntuar — pero puedes seguir viéndola.
        </p>
      </div>

      <CuadroClient
        slots={(slots ?? []) as BracketSlot[]}
        myPredictions={(myPreds ?? []) as BracketPrediction[]}
        bracketLocked={bracketLocked}
        userId={profile.id}
      />
    </AppShell>
  );
}

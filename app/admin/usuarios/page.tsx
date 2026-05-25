import { createClient } from '@/lib/supabase/server';
import { UsersClient } from './users-client';
import type { Profile } from '@/types';

export const dynamic = 'force-dynamic';

export default async function AdminUsersPage() {
  const supabase = createClient();

  const { data: profiles } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });

  const all = (profiles ?? []) as Profile[];
  const pending = all.filter((p) => !p.approved);
  const approved = all.filter((p) => p.approved);

  return <UsersClient pending={pending} approved={approved} />;
}

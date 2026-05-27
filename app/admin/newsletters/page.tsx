import { createClient } from '@/lib/supabase/server';
import { NewslettersAdminClient } from './newsletters-client';
import type { Newsletter } from '@/types';

export const dynamic = 'force-dynamic';

export default async function AdminNewslettersPage() {
  const supabase = createClient();
  const { data: newsletters } = await supabase
    .from('newsletters')
    .select('*')
    .order('published_at', { ascending: false });

  return <NewslettersAdminClient initial={(newsletters ?? []) as Newsletter[]} />;
}

import { AppShell, requireApprovedUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { NewsletterCard } from '@/components/newsletter-card';
import { Card } from '@/components/ui';
import type { Newsletter } from '@/types';

export const dynamic = 'force-dynamic';

export default async function NewsletterPage() {
  await requireApprovedUser();
  const supabase = createClient();

  const { data: newsletters } = await supabase
    .from('newsletters')
    .select('*')
    .order('published_at', { ascending: false });

  const list = (newsletters ?? []) as Newsletter[];

  return (
    <AppShell>
      <div className="mb-8">
        <h1 className="font-display text-4xl font-bold">📰 Newsletter</h1>
        <p className="text-text-muted text-sm mt-1">
          Notas, recordatorios y mensajes del admin del grupo.
        </p>
      </div>

      {list.length === 0 ? (
        <Card>
          <p className="text-text-muted text-sm text-center py-8">
            Aún no hay newsletters publicadas. Tu admin no ha escrito ninguna todavía.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {list.map((n) => (
            <NewsletterCard key={n.id} newsletter={n} />
          ))}
        </div>
      )}
    </AppShell>
  );
}

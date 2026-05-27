import { Card } from './ui';
import { formatMadridDate } from '@/lib/utils';
import type { Newsletter } from '@/types';

interface Props {
  newsletter: Newsletter;
  /** Versión compacta (para dashboard). Por defecto false (vista completa). */
  compact?: boolean;
}

/**
 * Render de una newsletter con preservación de saltos de línea (texto plano).
 * `whitespace-pre-line` respeta los \n del body sin necesidad de markdown.
 */
export function NewsletterCard({ newsletter, compact = false }: Props) {
  return (
    <Card
      className={
        'bg-gradient-to-br from-accent/5 via-surface to-surface border-accent/20 hover:border-accent/40 transition-colors h-full flex flex-col'
      }
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-accent">
          📰 Newsletter
        </span>
        <span className="text-[10px] text-text-muted">
          {formatMadridDate(newsletter.published_at)}
        </span>
      </div>

      <h3
        className={
          compact
            ? 'font-display text-xl font-bold leading-tight mb-2'
            : 'font-display text-2xl sm:text-3xl font-bold leading-tight mb-3'
        }
      >
        {newsletter.title}
      </h3>

      <div
        className={
          'text-sm text-text-muted leading-relaxed whitespace-pre-line break-words ' +
          (compact ? 'line-clamp-6 flex-1' : '')
        }
      >
        {newsletter.body}
      </div>
    </Card>
  );
}

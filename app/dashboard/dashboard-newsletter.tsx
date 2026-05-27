import Link from 'next/link';
import { formatMadridDate } from '@/lib/utils';
import type { Newsletter } from '@/types';

interface Props {
  newsletter: Newsletter | null;
}

/**
 * Bloque de newsletter para el dashboard, junto al banner de España.
 * - Si hay newsletter: muestra título + cuerpo (recortado) y enlace a verla entera.
 * - Si no hay: placeholder con CTA visible solo para informar.
 */
export function DashboardNewsletter({ newsletter }: Props) {
  if (!newsletter) {
    return (
      <div className="h-full rounded-card border border-border bg-surface p-5 flex items-center justify-center">
        <div className="text-center">
          <div className="text-3xl mb-2">📰</div>
          <p className="text-sm font-medium text-text-muted">
            Aún no hay newsletter publicada
          </p>
          <p className="text-xs text-text-muted/70 mt-1">
            El admin avisará por aquí de cada jornada.
          </p>
        </div>
      </div>
    );
  }

  return (
    <Link
      href="/newsletter"
      className="block h-full rounded-card border border-accent/20 bg-gradient-to-br from-accent/5 via-surface to-surface p-5 hover:border-accent/40 hover:shadow-[0_0_24px_-12px_rgba(16,185,129,0.4)] transition-all"
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-accent">
          📰 Newsletter
        </span>
        <span className="text-[10px] text-text-muted">
          {formatMadridDate(newsletter.published_at)}
        </span>
      </div>

      <h3 className="font-display text-lg sm:text-xl font-bold leading-tight mb-2 line-clamp-2">
        {newsletter.title}
      </h3>

      <p className="text-sm text-text-muted leading-relaxed whitespace-pre-line break-words line-clamp-4">
        {newsletter.body}
      </p>

      <div className="mt-3 text-accent text-xs font-semibold">
        Leer más →
      </div>
    </Link>
  );
}

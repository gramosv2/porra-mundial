'use client';

import { useState } from 'react';

export function CalendarDownloadButton() {
  const [copied, setCopied] = useState(false);

  const subscribeUrl =
    typeof window !== 'undefined'
      ? `webcal://${window.location.host}/api/calendar/download`
      : '';

  const downloadUrl = '/api/calendar/download?download=1';

  async function copyUrl() {
    const fullUrl =
      typeof window !== 'undefined'
        ? `${window.location.protocol}//${window.location.host}/api/calendar/download`
        : '';
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap gap-2 justify-end">
        
          <a
              href={subscribeUrl}
              className="inline-flex items-center gap-2 bg-accent text-black font-semibold px-5 py-3 rounded-full hover:bg-accent/90 hover:shadow-[0_0_24px_-4px_rgba(16,185,129,0.6)] transition-all"
          >
          <span>📅</span> Añadir a calendario
        </a>
          <a
              href={downloadUrl}
              download="mundial2026.ics"
              className="inline-flex items-center gap-2 bg-surface border border-border text-text font-medium px-4 py-3 rounded-full hover:border-accent text-sm"
          >
          Descargar .ics
        </a>
      </div>
      <button
        type="button"
        onClick={copyUrl}
        className="text-xs text-text-muted hover:text-text underline-offset-4 hover:underline"
      >
        {copied ? '✓ Enlace copiado' : 'O copia el enlace de suscripción'}
      </button>
    </div>
  );
}

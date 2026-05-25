// Utilidades varias (fechas, banderas, formato)

const TIMEZONE = 'Europe/Madrid';

export function formatMadridDate(iso: string, opts?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('es-ES', {
    timeZone: TIMEZONE,
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    ...opts,
  }).format(new Date(iso));
}

export function formatMadridTime(iso: string): string {
  return new Intl.DateTimeFormat('es-ES', {
    timeZone: TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

export function formatMadridShortDate(iso: string): string {
  return new Intl.DateTimeFormat('es-ES', {
    timeZone: TIMEZONE,
    day: '2-digit',
    month: '2-digit',
  }).format(new Date(iso));
}

export function timeUntil(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff < 0) return 'Cerrado';
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  if (days >= 1) return `Cierra en ${days}d ${hours % 24}h`;
  if (hours >= 1) return `Cierra en ${hours}h`;
  const minutes = Math.floor(diff / (1000 * 60));
  return `Cierra en ${minutes}min`;
}

// Bandera emoji a partir del nombre de equipo
const FLAGS: Record<string, string> = {
  Mexico: '🇲🇽',
  'South Africa': '🇿🇦',
  'South Korea': '🇰🇷',
  'Czech Republic': '🇨🇿',
  Canada: '🇨🇦',
  'Bosnia and Herzegovina': '🇧🇦',
  Qatar: '🇶🇦',
  Switzerland: '🇨🇭',
  Brazil: '🇧🇷',
  Morocco: '🇲🇦',
  Haiti: '🇭🇹',
  Scotland: '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
  'United States': '🇺🇸',
  Paraguay: '🇵🇾',
  Australia: '🇦🇺',
  Turkey: '🇹🇷',
  Germany: '🇩🇪',
  'Curaçao': '🇨🇼',
  Curacao: '🇨🇼',
  'Ivory Coast': '🇨🇮',
  Ecuador: '🇪🇨',
  Netherlands: '🇳🇱',
  Japan: '🇯🇵',
  Sweden: '🇸🇪',
  Tunisia: '🇹🇳',
  Belgium: '🇧🇪',
  Egypt: '🇪🇬',
  Iran: '🇮🇷',
  'New Zealand': '🇳🇿',
  Spain: '🇪🇸',
  'Cape Verde': '🇨🇻',
  'Saudi Arabia': '🇸🇦',
  Uruguay: '🇺🇾',
  France: '🇫🇷',
  Senegal: '🇸🇳',
  Iraq: '🇮🇶',
  Norway: '🇳🇴',
  Argentina: '🇦🇷',
  Algeria: '🇩🇿',
  Austria: '🇦🇹',
  Jordan: '🇯🇴',
  Portugal: '🇵🇹',
  'DR Congo': '🇨🇩',
  Uzbekistan: '🇺🇿',
  Colombia: '🇨🇴',
  England: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  Croatia: '🇭🇷',
  Ghana: '🇬🇭',
  Panama: '🇵🇦',
  Italy: '🇮🇹',
  Italia: '🇮🇹',
  'Por determinar': '🏳️',
};

export function teamFlag(name: string): string {
  return FLAGS[name] ?? '🏳️';
}

// Traduce nombres de equipos al español para la UI
const TEAM_ES: Record<string, string> = {
  'South Africa': 'Sudáfrica',
  'South Korea': 'Corea del Sur',
  'Czech Republic': 'República Checa',
  'Bosnia and Herzegovina': 'Bosnia y Herzegovina',
  Switzerland: 'Suiza',
  Brazil: 'Brasil',
  Morocco: 'Marruecos',
  Haiti: 'Haití',
  Scotland: 'Escocia',
  'United States': 'Estados Unidos',
  Australia: 'Australia',
  Turkey: 'Turquía',
  Germany: 'Alemania',
  'Ivory Coast': 'Costa de Marfil',
  Netherlands: 'Países Bajos',
  Japan: 'Japón',
  Sweden: 'Suecia',
  Tunisia: 'Túnez',
  Belgium: 'Bélgica',
  Egypt: 'Egipto',
  Iran: 'Irán',
  'New Zealand': 'Nueva Zelanda',
  Spain: 'España',
  'Cape Verde': 'Cabo Verde',
  'Saudi Arabia': 'Arabia Saudí',
  France: 'Francia',
  Norway: 'Noruega',
  Algeria: 'Argelia',
  Austria: 'Austria',
  Jordan: 'Jordania',
  'DR Congo': 'RD Congo',
  Uzbekistan: 'Uzbekistán',
  England: 'Inglaterra',
  Croatia: 'Croacia',
  Panama: 'Panamá',
  Italy: 'Italia',
};

export function teamES(name: string): string {
  return TEAM_ES[name] ?? name;
}

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

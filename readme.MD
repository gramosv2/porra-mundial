# ⚽ PorraMundial 2026

Aplicación web privada para una porra de amigos del **Mundial FIFA 2026** (Estados Unidos, Canadá y México). Diseño oscuro premium, sistema de puntuación configurable, panel de administración completo y sincronización automática de resultados.

---

## Stack

- **Next.js 14** (App Router, TypeScript estricto)
- **Supabase** (PostgreSQL + Auth con email/contraseña + Row Level Security)
- **Tailwind CSS v3**
- **football-data.org** (tier gratuito) para sincronizar resultados reales
- **Vercel** para deploy (incluye `cron` cada 2 h para sincronización automática)
- Fuentes: **Syne** (display) + **DM Sans** (cuerpo)

---

## Configuración paso a paso

### 1. Crear proyecto en Supabase

1. Crea un nuevo proyecto en https://supabase.com (gratuito basta).
2. Cuando esté listo, ve a **SQL Editor**.
3. Copia y ejecuta el contenido de `supabase/migrations/0001_initial_schema.sql`. Esto crea todas las tablas, políticas RLS y el trigger `handle_new_user` que crea el perfil al registrarse.
4. (Opcional) En **Authentication → Providers**, asegúrate de que el proveedor **Email** está habilitado. Si quieres acelerar pruebas, en **Authentication → Settings** desactiva "Confirm email".

### 2. Conseguir API key de football-data.org

1. Regístrate gratis en https://www.football-data.org/client/register
2. Te enviarán un token. Guárdalo.

### 3. Variables de entorno

Copia `.env.local.example` a `.env.local` y rellena:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...     # Project Settings → API → anon public
SUPABASE_SERVICE_ROLE_KEY=eyJ...         # Project Settings → API → service_role (¡secreto!)

FOOTBALL_DATA_API_KEY=tu_token_aqui
SYNC_SECRET=algo_aleatorio_largo         # ej. `openssl rand -hex 32`

NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### 4. Instalar dependencias y sembrar partidos

```bash
npm install
npm run seed
```

El seed inserta los **72 partidos de fase de grupos** + un esqueleto de 32 partidos eliminatorios con `team1/team2 = "Por determinar"`. Es idempotente — ejecutarlo varias veces no duplica nada.

Las horas de los partidos están en hora local de cada sede (Estados Unidos, Canadá y México), se convierten a UTC automáticamente al guardar.

### 5. Promover el primer usuario a admin

Regístrate en la app con tu cuenta. Por defecto cualquier registro queda con `approved=false`. Para hacerte admin desde la SQL Editor de Supabase:

```sql
UPDATE profiles
SET role = 'admin', approved = true
WHERE username = 'tu_username';
```

A partir de ahí podrás aprobar al resto desde `/admin/usuarios`.

### 6. Ejecutar en local

```bash
npm run dev
```

Abrir http://localhost:3000.

---

## Deploy en Vercel

1. Sube el repo a GitHub.
2. Importa el proyecto en Vercel.
3. En **Settings → Environment Variables**, añade todas las variables del `.env.local` (recuerda actualizar `NEXT_PUBLIC_SITE_URL` al dominio real).
4. (Opcional) En **Settings → Cron Jobs** verás el cron `0 */2 * * *` apuntando a `/api/sync-results`. Vercel manda automáticamente la cabecera `Authorization: Bearer ${CRON_SECRET}`, así que añade `CRON_SECRET` como variable de entorno con el mismo valor que `SYNC_SECRET` (o uno distinto — el endpoint acepta los dos).
5. En la URL de Supabase, **Authentication → URL Configuration**, añade tu dominio Vercel a "Site URL" y "Additional Redirect URLs".
6. Deploy.

---

## Estructura del proyecto

```
porra-mundial-2026/
├── app/
│   ├── auth/                # login, register, pending
│   ├── dashboard/           # hero, stats, banner España, premios
│   ├── partidos/            # navegación por fases, predicciones
│   ├── clasificacion/       # podio + tabla con tu fila siempre visible
│   ├── mis-predicciones/    # estadísticas personales
│   ├── calendario/          # listado por día + descarga .ics
│   ├── quedadas/            # "Ver partidos juntos" — bares + asistentes
│   ├── admin/
│   │   ├── usuarios/        # aprobar/bloquear, cambiar rol
│   │   ├── partidos/        # cerrar predicciones, cargar resultados, sync
│   │   ├── eliminatorias/   # actualizar equipos cuando se confirmen
│   │   └── premios/         # marcar ganadores de Balón Oro, Bota Oro, etc.
│   └── api/
│       ├── sync-results/    # cron + manual: importa de football-data.org
│       ├── calendar/download/  # devuelve el .ics
│       └── admin/           # endpoints privilegiados (recálculo de puntos)
├── src/
│   ├── config/scoring.ts    # ← ÚNICA FUENTE DE VERDAD de las reglas de puntos
│   ├── lib/
│   │   ├── supabase/        # client (browser) y server (cookies + admin)
│   │   ├── calendar.ts      # generador .ics RFC 5545
│   │   ├── scoring-engine.ts # recálculo de puntos
│   │   ├── auth.tsx         # requireApprovedUser / requireAdmin
│   │   └── utils.ts         # fechas Madrid TZ, banderas, nombres ES
│   ├── components/
│   │   ├── ui/              # Button, Card, Badge, Input, Avatar, PulseDot
│   │   ├── navbar.tsx
│   │   └── match-card.tsx
│   └── types/index.ts
├── scripts/seed-matches.ts  # idempotente, ejecutar con `npm run seed`
└── supabase/migrations/
    └── 0001_initial_schema.sql
```

---

## Sistema de puntuación

Todo se controla desde `src/config/scoring.ts`. Para ajustar las reglas no toques ningún otro archivo.

```ts
group_stage:        { exact_score: 3, correct_result: 1, wrong: 0 }
phase_multipliers:  { r32: 1.5, r16: 2, cuartos: 3, semis: 4, tercero: 3, final: 5 }
awards:             { balon_oro: 5, bota_oro: 4, guante_oro: 3, mejor_joven: 2, fair_play: 1 }
```

Los puntos se calculan así:

- **Marcador exacto** (ej. predices 2-1 y queda 2-1): `exact_score × multiplicador_de_fase`.
- **Solo ganador o empate** (predices 2-1 y queda 3-0): `correct_result × multiplicador_de_fase`.
- **Fallo**: 0.

Cuando el admin guarda un resultado real, `scoring-engine.ts` recalcula automáticamente:
1. `predictions.points_earned` de cada usuario para ese partido.
2. `profiles.total_points`, `exact_scores`, `correct_results` agregados.

---

## Visibilidad de predicciones ajenas

Las predicciones de los demás participantes son **invisibles** hasta que el partido pasa a `status='finished'`. Esto se garantiza por **políticas RLS en Postgres**, no solo en el cliente. Concretamente:

```sql
CREATE POLICY "Ver predicciones ajenas solo si match finalizado"
  ON predictions FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM matches
      WHERE matches.id = predictions.match_id
      AND matches.status = 'finished'
    )
  );
```

---

## Sincronización con football-data.org

- El cron de Vercel llama a `/api/sync-results` cada 2 horas con la cabecera `Authorization: Bearer ${CRON_SECRET}`.
- El admin puede dispararlo manualmente desde `/admin/partidos` con el botón "Sincronizar ahora" (pide el `SYNC_SECRET`).
- El endpoint busca partidos finalizados en la API, los cruza por `api_match_id`, actualiza resultado y status, y dispara el recálculo.

> **Nota:** football-data.org usa sus propios IDs de partido. Cuando se confirme el calendario oficial, hay que rellenar el campo `api_match_id` en cada fila de `matches` (puedes hacerlo desde Supabase Studio o creando una migración). El cron sigue funcionando aunque no esté rellenado — simplemente no actualizará nada hasta que lo esté.

---

## Calendario .ics

`/calendario` muestra todos los partidos del Mundial agrupados por día (hora Madrid).

El botón **"Descargar todos los partidos"** llama a `/api/calendar/download` y devuelve un archivo `mundial2026.ics` con un evento por partido (formato RFC 5545, duración 2 h, hora UTC). Compatible con iOS, Android, Google Calendar, Outlook y Apple Calendar.

---

## Sección "Ver partidos juntos" (`/quedadas`)

Tabla `watch_events` + `watch_attendees`. Cualquier usuario aprobado puede:

- Apuntarse / desapuntarse de una quedada existente (toggle optimista).
- Crear una quedada para un partido destacado o cualquier otro partido del calendario.
- Crear un evento sin partido vinculado (ej. "vemos la jornada del sábado completa").

Solo el creador o un admin pueden eliminar un evento.

El dashboard también muestra un **banner con el próximo partido de España** (o un equipo destacado si España ya está eliminada) con el contador de asistentes a la quedada vinculada.

---

## Comandos disponibles

```bash
npm run dev        # desarrollo
npm run build      # build de producción
npm run start      # ejecutar build
npm run lint       # linter
npm run typecheck  # verificar tipos sin emitir
npm run seed       # cargar 72 partidos grupos + esqueleto eliminatorias
```

---

## Notas finales

- Idioma de la UI: **español**.
- Hora mostrada al usuario: **Europe/Madrid**.
- Hora almacenada en BD: **UTC** siempre.
- Nombres de equipos en BD: **inglés** (necesario para cruzar con football-data.org). El UI traduce con `teamES()` en `src/lib/utils.ts`.
- Cierre de predicciones: **manual** por el admin (no automático).
- Si quieres ajustar las reglas de puntos: **`src/config/scoring.ts`** es el único archivo que tienes que tocar.

¡A disfrutar del Mundial! 🏆

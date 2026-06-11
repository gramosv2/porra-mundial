# Fix: cerrar predicciones exactamente a la hora del partido

## El problema

El `status` de un partido sólo pasa de `open` a `closed`/`finished` cuando el
cron `/api/sync-results` se ejecuta (cada 2h) y trae un resultado. Las policies
de RLS sólo miraban `status='open'`, así que entre el kickoff y la siguiente
ejecución del cron, se podía seguir prediciendo un partido YA EMPEZADO.

## La solución (2 partes)

### PARTE 1 — Base de datos (la importante): cierre real al kickoff

Ejecuta en el SQL Editor de Supabase:
`supabase/migrations/0009_close_predictions_at_kickoff.sql`

Esto rehace las policies de INSERT/UPDATE/DELETE de `predictions` para que,
además de las condiciones que ya tenían (aprobado, status='open', ronda
abierta), exijan que `match_date > now()`. Es decir: en cuanto llega la hora
del partido, la BD deja de aceptar predicciones, sin depender de ningún cron.

Es idempotente y seguro de reejecutar.

NOTA: tu cron `/api/sync-results` puede seguir funcionando igual; ahora es solo
para traer resultados y marcar `finished`, ya no es lo que "cierra a tiempo".


### PARTE 2 — Interfaz: que la tarjeta se muestre cerrada al pasar la hora

Sin este cambio, la BD ya rechaza la predicción tardía, pero el usuario seguiría
viendo los inputs abiertos hasta que el cron marque el partido como `closed`
(y al intentar guardar, le daría error). Este cambio hace que la tarjeta trate
el partido como cerrado en cuanto pasa su hora.

Edita `src/components/match-card.tsx`. Busca estas líneas (al principio del
componente MatchCard):

```tsx
  const supabase = createClient();
  const isOpen = match.status === 'open';
  const isClosed = match.status === 'closed';
  const isFinished = match.status === 'finished';
```

y sustitúyelas por:

```tsx
  const supabase = createClient();
  // Un partido se considera cerrado para predecir si su hora ya llegó,
  // aunque el cron todavía no haya actualizado su status en la BD.
  const kickoffPassed = new Date(match.match_date).getTime() <= Date.now();
  const isFinished = match.status === 'finished';
  const isOpen = match.status === 'open' && !kickoffPassed;
  const isClosed = match.status === 'closed' || (match.status === 'open' && kickoffPassed);
```

Con esto:
- Antes del kickoff → input abierto (isOpen = true), igual que ahora.
- Pasada la hora → la tarjeta muestra "Cerrado" y oculta los inputs, aunque la
  BD aún tenga status='open'.
- Cuando el cron marque 'finished', se muestra el resultado como siempre.

(Si tienes otras pantallas que pinten inputs de predicción mirando solo
`status === 'open'` — por ejemplo algún listado propio —, aplica la misma idea:
`status === 'open' && new Date(match.match_date) > new Date()`.)


## Resumen

- PARTE 1 es obligatoria y es la que de verdad cierra las apuestas a tiempo
  (a nivel de base de datos, a prueba de manipulación).
- PARTE 2 es cosmética pero recomendable, para que la web no muestre inputs
  abiertos en partidos que ya empezaron.
- No hace falta tocar el cron ni añadir pg_cron.

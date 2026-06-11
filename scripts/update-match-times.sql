-- =====================================================================
-- Corrección de horarios — Mundial 2026 (datos oficiales FIFA)
-- Fuente: fifa.com/es (calendario oficial, horarios verificados en hora España)
-- =====================================================================
-- Las horas se guardan en UTC. Hora Madrid = UTC + 2h (CEST en junio/julio).
--
-- Pega y ejecuta este SQL en el SQL Editor de Supabase.
-- Es idempotente: solo actualiza match_date y venue, NO toca predicciones.
-- =====================================================================

-- === Grupo A ===
UPDATE public.matches SET match_date='2026-06-11T19:00:00Z', venue='Estadio Azteca'           WHERE phase='grupos' AND group_name='A' AND matchday=1 AND team1='Mexico'         AND team2='South Africa';
UPDATE public.matches SET match_date='2026-06-12T02:00:00Z', venue='Estadio Akron'            WHERE phase='grupos' AND group_name='A' AND matchday=1 AND team1='South Korea'    AND team2='Czech Republic';
UPDATE public.matches SET match_date='2026-06-18T16:00:00Z', venue='Mercedes-Benz Stadium'    WHERE phase='grupos' AND group_name='A' AND matchday=2 AND team1='Czech Republic' AND team2='South Africa';
UPDATE public.matches SET match_date='2026-06-19T01:00:00Z', venue='Estadio Akron'            WHERE phase='grupos' AND group_name='A' AND matchday=2 AND team1='Mexico'         AND team2='South Korea';
UPDATE public.matches SET match_date='2026-06-25T01:00:00Z', venue='Estadio Azteca'           WHERE phase='grupos' AND group_name='A' AND matchday=3 AND team1='Czech Republic' AND team2='Mexico';
UPDATE public.matches SET match_date='2026-06-25T01:00:00Z', venue='Estadio BBVA'             WHERE phase='grupos' AND group_name='A' AND matchday=3 AND team1='South Africa'   AND team2='South Korea';

-- === Grupo B ===
UPDATE public.matches SET match_date='2026-06-12T19:00:00Z', venue='BMO Field'                WHERE phase='grupos' AND group_name='B' AND matchday=1 AND team1='Canada'         AND team2='Bosnia and Herzegovina';
UPDATE public.matches SET match_date='2026-06-13T19:00:00Z', venue='Levi''s Stadium'          WHERE phase='grupos' AND group_name='B' AND matchday=1 AND team1='Qatar'          AND team2='Switzerland';
UPDATE public.matches SET match_date='2026-06-18T19:00:00Z', venue='SoFi Stadium'             WHERE phase='grupos' AND group_name='B' AND matchday=2 AND team1='Switzerland'    AND team2='Bosnia and Herzegovina';
UPDATE public.matches SET match_date='2026-06-18T22:00:00Z', venue='BC Place'                 WHERE phase='grupos' AND group_name='B' AND matchday=2 AND team1='Canada'         AND team2='Qatar';
UPDATE public.matches SET match_date='2026-06-24T19:00:00Z', venue='BC Place'                 WHERE phase='grupos' AND group_name='B' AND matchday=3 AND team1='Switzerland'    AND team2='Canada';
UPDATE public.matches SET match_date='2026-06-24T19:00:00Z', venue='Lumen Field'              WHERE phase='grupos' AND group_name='B' AND matchday=3 AND team1='Bosnia and Herzegovina' AND team2='Qatar';

-- === Grupo C ===
UPDATE public.matches SET match_date='2026-06-13T22:00:00Z', venue='MetLife Stadium'          WHERE phase='grupos' AND group_name='C' AND matchday=1 AND team1='Brazil'         AND team2='Morocco';
UPDATE public.matches SET match_date='2026-06-14T01:00:00Z', venue='Gillette Stadium'         WHERE phase='grupos' AND group_name='C' AND matchday=1 AND team1='Haiti'          AND team2='Scotland';
UPDATE public.matches SET match_date='2026-06-19T22:00:00Z', venue='Gillette Stadium'         WHERE phase='grupos' AND group_name='C' AND matchday=2 AND team1='Scotland'       AND team2='Morocco';
UPDATE public.matches SET match_date='2026-06-20T00:30:00Z', venue='Lincoln Financial Field'  WHERE phase='grupos' AND group_name='C' AND matchday=2 AND team1='Brazil'         AND team2='Haiti';
UPDATE public.matches SET match_date='2026-06-24T22:00:00Z', venue='Hard Rock Stadium'        WHERE phase='grupos' AND group_name='C' AND matchday=3 AND team1='Scotland'       AND team2='Brazil';
UPDATE public.matches SET match_date='2026-06-24T22:00:00Z', venue='Mercedes-Benz Stadium'    WHERE phase='grupos' AND group_name='C' AND matchday=3 AND team1='Morocco'        AND team2='Haiti';

-- === Grupo D ===
UPDATE public.matches SET match_date='2026-06-13T01:00:00Z', venue='SoFi Stadium'             WHERE phase='grupos' AND group_name='D' AND matchday=1 AND team1='United States'  AND team2='Paraguay';
UPDATE public.matches SET match_date='2026-06-14T04:00:00Z', venue='BC Place'                 WHERE phase='grupos' AND group_name='D' AND matchday=1 AND team1='Australia'      AND team2='Turkey';
UPDATE public.matches SET match_date='2026-06-19T19:00:00Z', venue='Lumen Field'              WHERE phase='grupos' AND group_name='D' AND matchday=2 AND team1='United States'  AND team2='Australia';
UPDATE public.matches SET match_date='2026-06-20T03:00:00Z', venue='Levi''s Stadium'          WHERE phase='grupos' AND group_name='D' AND matchday=2 AND team1='Turkey'         AND team2='Paraguay';
UPDATE public.matches SET match_date='2026-06-26T02:00:00Z', venue='SoFi Stadium'             WHERE phase='grupos' AND group_name='D' AND matchday=3 AND team1='Turkey'         AND team2='United States';
UPDATE public.matches SET match_date='2026-06-26T02:00:00Z', venue='Levi''s Stadium'          WHERE phase='grupos' AND group_name='D' AND matchday=3 AND team1='Paraguay'       AND team2='Australia';

-- === Grupo E ===
UPDATE public.matches SET match_date='2026-06-14T17:00:00Z', venue='NRG Stadium'              WHERE phase='grupos' AND group_name='E' AND matchday=1 AND team1='Germany'        AND team2='Curaçao';
UPDATE public.matches SET match_date='2026-06-14T23:00:00Z', venue='Lincoln Financial Field'  WHERE phase='grupos' AND group_name='E' AND matchday=1 AND team1='Ivory Coast'    AND team2='Ecuador';
UPDATE public.matches SET match_date='2026-06-20T20:00:00Z', venue='BMO Field'                WHERE phase='grupos' AND group_name='E' AND matchday=2 AND team1='Germany'        AND team2='Ivory Coast';
UPDATE public.matches SET match_date='2026-06-21T00:00:00Z', venue='Arrowhead Stadium'        WHERE phase='grupos' AND group_name='E' AND matchday=2 AND team1='Ecuador'        AND team2='Curaçao';
UPDATE public.matches SET match_date='2026-06-25T20:00:00Z', venue='Lincoln Financial Field'  WHERE phase='grupos' AND group_name='E' AND matchday=3 AND team1='Curaçao'        AND team2='Ivory Coast';
UPDATE public.matches SET match_date='2026-06-25T20:00:00Z', venue='MetLife Stadium'          WHERE phase='grupos' AND group_name='E' AND matchday=3 AND team1='Ecuador'        AND team2='Germany';

-- === Grupo F ===
UPDATE public.matches SET match_date='2026-06-14T20:00:00Z', venue='AT&T Stadium'             WHERE phase='grupos' AND group_name='F' AND matchday=1 AND team1='Netherlands'    AND team2='Japan';
UPDATE public.matches SET match_date='2026-06-15T02:00:00Z', venue='Estadio BBVA'             WHERE phase='grupos' AND group_name='F' AND matchday=1 AND team1='Sweden'         AND team2='Tunisia';
UPDATE public.matches SET match_date='2026-06-20T17:00:00Z', venue='NRG Stadium'              WHERE phase='grupos' AND group_name='F' AND matchday=2 AND team1='Netherlands'    AND team2='Sweden';
UPDATE public.matches SET match_date='2026-06-21T04:00:00Z', venue='Estadio BBVA'             WHERE phase='grupos' AND group_name='F' AND matchday=2 AND team1='Tunisia'        AND team2='Japan';
UPDATE public.matches SET match_date='2026-06-25T23:00:00Z', venue='AT&T Stadium'             WHERE phase='grupos' AND group_name='F' AND matchday=3 AND team1='Japan'          AND team2='Sweden';
UPDATE public.matches SET match_date='2026-06-25T23:00:00Z', venue='Arrowhead Stadium'        WHERE phase='grupos' AND group_name='F' AND matchday=3 AND team1='Tunisia'        AND team2='Netherlands';

-- === Grupo G ===
UPDATE public.matches SET match_date='2026-06-15T19:00:00Z', venue='Lumen Field'              WHERE phase='grupos' AND group_name='G' AND matchday=1 AND team1='Belgium'        AND team2='Egypt';
UPDATE public.matches SET match_date='2026-06-16T01:00:00Z', venue='SoFi Stadium'             WHERE phase='grupos' AND group_name='G' AND matchday=1 AND team1='Iran'           AND team2='New Zealand';
UPDATE public.matches SET match_date='2026-06-21T19:00:00Z', venue='SoFi Stadium'             WHERE phase='grupos' AND group_name='G' AND matchday=2 AND team1='Belgium'        AND team2='Iran';
UPDATE public.matches SET match_date='2026-06-22T01:00:00Z', venue='BC Place'                 WHERE phase='grupos' AND group_name='G' AND matchday=2 AND team1='New Zealand'    AND team2='Egypt';
UPDATE public.matches SET match_date='2026-06-27T03:00:00Z', venue='Lumen Field'              WHERE phase='grupos' AND group_name='G' AND matchday=3 AND team1='Egypt'          AND team2='Iran';
UPDATE public.matches SET match_date='2026-06-27T03:00:00Z', venue='BC Place'                 WHERE phase='grupos' AND group_name='G' AND matchday=3 AND team1='New Zealand'    AND team2='Belgium';

-- === Grupo H (España) ===
UPDATE public.matches SET match_date='2026-06-15T16:00:00Z', venue='Mercedes-Benz Stadium'    WHERE phase='grupos' AND group_name='H' AND matchday=1 AND team1='Spain'          AND team2='Cape Verde';
UPDATE public.matches SET match_date='2026-06-15T22:00:00Z', venue='Hard Rock Stadium'        WHERE phase='grupos' AND group_name='H' AND matchday=1 AND team1='Saudi Arabia'   AND team2='Uruguay';
UPDATE public.matches SET match_date='2026-06-21T16:00:00Z', venue='Mercedes-Benz Stadium'    WHERE phase='grupos' AND group_name='H' AND matchday=2 AND team1='Spain'          AND team2='Saudi Arabia';
UPDATE public.matches SET match_date='2026-06-21T22:00:00Z', venue='Hard Rock Stadium'        WHERE phase='grupos' AND group_name='H' AND matchday=2 AND team1='Uruguay'        AND team2='Cape Verde';
UPDATE public.matches SET match_date='2026-06-27T00:00:00Z', venue='NRG Stadium'              WHERE phase='grupos' AND group_name='H' AND matchday=3 AND team1='Cape Verde'     AND team2='Saudi Arabia';
UPDATE public.matches SET match_date='2026-06-27T00:00:00Z', venue='Estadio Akron'            WHERE phase='grupos' AND group_name='H' AND matchday=3 AND team1='Uruguay'        AND team2='Spain';

-- === Grupo I ===
UPDATE public.matches SET match_date='2026-06-16T19:00:00Z', venue='MetLife Stadium'          WHERE phase='grupos' AND group_name='I' AND matchday=1 AND team1='France'         AND team2='Senegal';
UPDATE public.matches SET match_date='2026-06-16T22:00:00Z', venue='Gillette Stadium'         WHERE phase='grupos' AND group_name='I' AND matchday=1 AND team1='Iraq'           AND team2='Norway';
UPDATE public.matches SET match_date='2026-06-22T21:00:00Z', venue='Lincoln Financial Field'  WHERE phase='grupos' AND group_name='I' AND matchday=2 AND team1='France'         AND team2='Iraq';
UPDATE public.matches SET match_date='2026-06-23T00:00:00Z', venue='MetLife Stadium'          WHERE phase='grupos' AND group_name='I' AND matchday=2 AND team1='Norway'         AND team2='Senegal';
UPDATE public.matches SET match_date='2026-06-26T19:00:00Z', venue='Gillette Stadium'         WHERE phase='grupos' AND group_name='I' AND matchday=3 AND team1='Norway'         AND team2='France';
UPDATE public.matches SET match_date='2026-06-26T19:00:00Z', venue='BMO Field'                WHERE phase='grupos' AND group_name='I' AND matchday=3 AND team1='Senegal'        AND team2='Iraq';

-- === Grupo J ===
UPDATE public.matches SET match_date='2026-06-17T01:00:00Z', venue='Arrowhead Stadium'        WHERE phase='grupos' AND group_name='J' AND matchday=1 AND team1='Argentina'      AND team2='Algeria';
UPDATE public.matches SET match_date='2026-06-17T04:00:00Z', venue='Levi''s Stadium'          WHERE phase='grupos' AND group_name='J' AND matchday=1 AND team1='Austria'        AND team2='Jordan';
UPDATE public.matches SET match_date='2026-06-22T17:00:00Z', venue='AT&T Stadium'             WHERE phase='grupos' AND group_name='J' AND matchday=2 AND team1='Argentina'      AND team2='Austria';
UPDATE public.matches SET match_date='2026-06-23T03:00:00Z', venue='Levi''s Stadium'          WHERE phase='grupos' AND group_name='J' AND matchday=2 AND team1='Jordan'         AND team2='Algeria';
UPDATE public.matches SET match_date='2026-06-28T02:00:00Z', venue='Arrowhead Stadium'        WHERE phase='grupos' AND group_name='J' AND matchday=3 AND team1='Algeria'        AND team2='Austria';
UPDATE public.matches SET match_date='2026-06-28T02:00:00Z', venue='AT&T Stadium'             WHERE phase='grupos' AND group_name='J' AND matchday=3 AND team1='Jordan'         AND team2='Argentina';

-- === Grupo K ===
UPDATE public.matches SET match_date='2026-06-17T17:00:00Z', venue='NRG Stadium'              WHERE phase='grupos' AND group_name='K' AND matchday=1 AND team1='Portugal'       AND team2='DR Congo';
UPDATE public.matches SET match_date='2026-06-18T02:00:00Z', venue='Estadio Azteca'           WHERE phase='grupos' AND group_name='K' AND matchday=1 AND team1='Uzbekistan'     AND team2='Colombia';
UPDATE public.matches SET match_date='2026-06-23T17:00:00Z', venue='NRG Stadium'              WHERE phase='grupos' AND group_name='K' AND matchday=2 AND team1='Portugal'       AND team2='Uzbekistan';
UPDATE public.matches SET match_date='2026-06-24T02:00:00Z', venue='Estadio Akron'            WHERE phase='grupos' AND group_name='K' AND matchday=2 AND team1='Colombia'       AND team2='DR Congo';
UPDATE public.matches SET match_date='2026-06-27T23:30:00Z', venue='Hard Rock Stadium'        WHERE phase='grupos' AND group_name='K' AND matchday=3 AND team1='Colombia'       AND team2='Portugal';
UPDATE public.matches SET match_date='2026-06-27T23:30:00Z', venue='Mercedes-Benz Stadium'    WHERE phase='grupos' AND group_name='K' AND matchday=3 AND team1='DR Congo'       AND team2='Uzbekistan';

-- === Grupo L ===
UPDATE public.matches SET match_date='2026-06-17T20:00:00Z', venue='AT&T Stadium'             WHERE phase='grupos' AND group_name='L' AND matchday=1 AND team1='England'        AND team2='Croatia';
UPDATE public.matches SET match_date='2026-06-17T23:00:00Z', venue='BMO Field'                WHERE phase='grupos' AND group_name='L' AND matchday=1 AND team1='Ghana'          AND team2='Panama';
UPDATE public.matches SET match_date='2026-06-23T20:00:00Z', venue='Gillette Stadium'         WHERE phase='grupos' AND group_name='L' AND matchday=2 AND team1='England'        AND team2='Ghana';
UPDATE public.matches SET match_date='2026-06-23T23:00:00Z', venue='BMO Field'                WHERE phase='grupos' AND group_name='L' AND matchday=2 AND team1='Panama'         AND team2='Croatia';
UPDATE public.matches SET match_date='2026-06-27T21:00:00Z', venue='MetLife Stadium'          WHERE phase='grupos' AND group_name='L' AND matchday=3 AND team1='Panama'         AND team2='England';
UPDATE public.matches SET match_date='2026-06-27T21:00:00Z', venue='Lincoln Financial Field'  WHERE phase='grupos' AND group_name='L' AND matchday=3 AND team1='Croatia'        AND team2='Ghana';


-- =====================================================================
-- VERIFICACIÓN: partidos de España en hora Madrid. Debe salir:
--   • Spain vs Cape Verde    → 15/06/2026 18:00 Madrid
--   • Spain vs Saudi Arabia  → 21/06/2026 18:00 Madrid
--   • Uruguay vs Spain       → 27/06/2026 02:00 Madrid (madrugada)
-- =====================================================================
SELECT
  group_name AS grupo,
  matchday AS jornada,
  team1 || ' vs ' || team2 AS partido,
  match_date AS hora_utc,
  to_char(match_date AT TIME ZONE 'Europe/Madrid', 'DD/MM/YYYY HH24:MI') AS hora_madrid,
  venue AS sede
FROM public.matches
WHERE 'Spain' IN (team1, team2)
ORDER BY match_date;

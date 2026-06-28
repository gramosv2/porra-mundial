import type { Phase, AwardType } from '@/config/scoring';

export type MatchStatus = 'open' | 'closed' | 'finished';

export interface Profile {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  role: 'user' | 'admin';
  approved: boolean;
  total_points: number;
  exact_scores: number;
  correct_results: number;
  bracket_points: number;
  created_at: string;
}

export interface Newsletter {
  id: number;
  title: string;
  body: string;
  published_at: string;
  created_by: string | null;
  updated_at: string;
}

export interface Match {
  id: number;
  phase: Phase;
  group_name: string | null;
  matchday: number | null;
  match_date: string;
  team1: string;
  team2: string;
  venue: string | null;
  result_team1: number | null;
  result_team2: number | null;
  status: MatchStatus;
  api_match_id: string | null;
  created_at: string;
}

export interface Prediction {
  id: number;
  user_id: string;
  match_id: number;
  pred_team1: number;
  pred_team2: number;
  points_earned: number;
  submitted_at: string;
  locked: boolean;
  locked_at: string | null;
}

export interface AwardPrediction {
  id: number;
  user_id: string;
  award_type: AwardType;
  prediction: string;
  is_correct: boolean | null;
  points_earned: number;
  locked: boolean;
  locked_at: string | null;
}

export interface SemifinalistPrediction {
  id: number;
  user_id: string;
  team: string;
  position: number;
  is_correct: boolean | null;
  points_earned: number;
  created_at: string;
  locked: boolean;
  locked_at: string | null;
}

export interface WatchEvent {
  id: number;
  match_id: number | null;
  custom_title: string | null;
  custom_date: string | null;
  location: string;
  location_url: string | null;
  notes: string | null;
  attendee_limit: number | null;
  created_by: string;
  created_at: string;
}

export interface WatchAttendee {
  id: number;
  event_id: number;
  user_id: string;
  joined_at: string;
}

export interface LeaderboardRow {
  rank: number;
  profile: Profile;
}

// =====================================================================
// CUADRO DE ELIMINATORIAS DINÁMICO (dieciseisavos en adelante)
// =====================================================================
import type { BracketPhase } from '@/config/bracket';

export type BracketSlotStatus = 'pending' | 'finished';

/** Fila de la tabla admin `bracket_slots`: el árbol + resultados reales. */
export interface BracketSlot {
  id: string;
  phase: BracketPhase;
  order_num: number;
  side: 'L' | 'R' | 'C';
  from_slot1: string | null;
  from_slot2: string | null;
  team1_real: string | null; // solo r16: nombre fijo del equipo
  team2_real: string | null; // solo r16: nombre fijo del equipo
  result_team1: number | null;
  result_team2: number | null;
  real_penalty_winner: 1 | 2 | null;
  real_advancer: string | null; // nombre REAL del equipo que pasó de ronda (lo fija el admin)
  real_loser: string | null; // nombre REAL del equipo perdedor (alimenta T3)
  status: BracketSlotStatus;
  match_date: string | null;
  venue: string | null;
  updated_at: string;
}

/** Fila de la tabla `bracket_predictions`: la elección de UN usuario para UNA casilla. */
export interface BracketPrediction {
  id: number;
  user_id: string;
  slot_id: string;
  pred_team1: number | null;
  pred_team2: number | null;
  pred_penalty_winner: 1 | 2 | null;
  is_dead: boolean;
  points_earned: number;
  locked: boolean;
  updated_at: string;
}

/** Estado global del bracket en app_settings (key='bracket_locked'). */
export interface BracketGlobalLock {
  locked: boolean;
  locked_at: string | null;
}


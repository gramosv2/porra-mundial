import type { Phase, AwardType } from '@/config/scoring';

export type MatchStatus = 'open' | 'closed' | 'finished';

export interface Profile {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  role: 'user' | 'admin';
  approved: boolean;
  total_points: number;
  exact_scores: number;
  correct_results: number;
  created_at: string;
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

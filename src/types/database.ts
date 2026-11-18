// ChoreQuest — database types (Task 0)
// Hand-written interfaces mirroring the Supabase schema in supabase/schema.sql.
// Nullable columns are typed `| null`; enum-like text columns use string unions.

export type MemberRole = 'admin' | 'member';

export type RoomIconType =
  | 'kitchen'
  | 'bathroom'
  | 'bedroom'
  | 'living'
  | 'trash'
  | 'other';

export type ChoreScheduleType = 'interval_days' | 'on_demand';

export interface Profile {
  id: string;
  display_name: string;
  avatar_emoji: string;
  expo_push_token: string | null;
  created_at: string;
}

export interface Apartment {
  id: string;
  name: string;
  invite_code: string;
  apartment_streak: number;
  created_by: string | null;
  created_at: string;
}

export interface ApartmentMember {
  id: string;
  apartment_id: string;
  user_id: string;
  role: MemberRole;
  weekly_xp: number;
  total_xp: number;
  personal_streak: number;
  joined_at: string;
}

export interface Room {
  id: string;
  apartment_id: string;
  name: string;
  icon_type: RoomIconType;
  room_streak: number;
  created_at: string;
}

export interface RoomMember {
  id: string;
  room_id: string;
  user_id: string;
  rotation_position: number;
}

export interface Chore {
  id: string;
  room_id: string;
  title: string;
  xp_reward: number;
  schedule_type: ChoreScheduleType;
  frequency_days: number | null;
  current_assignee_id: string | null;
  next_due_at: string | null;
  last_nudge_at: string | null;
  created_at: string;
}

export interface ChoreLog {
  id: string;
  chore_id: string;
  room_id: string;
  completed_by: string | null;
  xp_earned: number;
  completed_at: string;
}

// ---------------------------------------------------------------------------
// RPC
// ---------------------------------------------------------------------------

export interface CompleteChoreArgs {
  p_chore_id: string;
}

// complete_chore returns the next assignee's user_id (null if the room has no
// members), so the client can trigger a turn-handoff push notification.
export type CompleteChoreResult = string | null;

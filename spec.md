# spec.md — ChoreQuest Product & Technical Specification

## 1. Core Concept
A gamified, Duolingo-style chore management mobile app for shared apartments. Apartments are modular: an admin creates an empty flat, invites roommates via a 6-character code, creates custom rooms, and assigns specific subsets of roommates to each room. Chores rotate automatically among each room's assigned members with push notifications.

## 2. Database Schema (Supabase PostgreSQL)

### `profiles`
- `id` (uuid, PK, references `auth.users.id` on delete cascade)
- `display_name` (text, not null)
- `avatar_emoji` (text, default `'🧼'`)
- `expo_push_token` (text, nullable)
- `created_at` (timestamptz, default `now()`)

### `apartments`
- `id` (uuid, PK, default `gen_random_uuid()`)
- `name` (text, not null)
- `invite_code` (text, unique, not null — 6 uppercase alphanumeric chars)
- `apartment_streak` (int, default `0`)
- `created_by` (uuid, references `profiles.id`)
- `created_at` (timestamptz, default `now()`)

### `apartment_members`
- `id` (uuid, PK, default `gen_random_uuid()`)
- `apartment_id` (uuid, references `apartments.id` on delete cascade)
- `user_id` (uuid, references `profiles.id` on delete cascade)
- `role` (text, check `role in ('admin', 'member')`, default `'member'`)
- `weekly_xp` (int, default `0`)
- `total_xp` (int, default `0`)
- `personal_streak` (int, default `0`)
- `joined_at` (timestamptz, default `now()`)
- Unique constraint on `(apartment_id, user_id)`

### `rooms`
- `id` (uuid, PK, default `gen_random_uuid()`)
- `apartment_id` (uuid, references `apartments.id` on delete cascade)
- `name` (text, not null — e.g., "Bathroom A", "Main Kitchen")
- `icon_type` (text, not null — `'kitchen' | 'bathroom' | 'bedroom' | 'living' | 'trash' | 'other'`)
- `room_streak` (int, default `0`)
- `created_at` (timestamptz, default `now()`)

### `room_members`
- `id` (uuid, PK, default `gen_random_uuid()`)
- `room_id` (uuid, references `rooms.id` on delete cascade)
- `user_id` (uuid, references `profiles.id` on delete cascade)
- `rotation_position` (int, not null — 0-indexed order for turn rotation)
- Unique constraint on `(room_id, user_id)`

### `chores`
- `id` (uuid, PK, default `gen_random_uuid()`)
- `room_id` (uuid, references `rooms.id` on delete cascade)
- `title` (text, not null)
- `xp_reward` (int, not null, default `20`)
- `schedule_type` (text, check `schedule_type in ('interval_days', 'on_demand')`, default `'interval_days'`)
- `frequency_days` (int, nullable — e.g., `7` for weekly; null if `on_demand`)
- `current_assignee_id` (uuid, references `profiles.id`, nullable)
- `next_due_at` (timestamptz, nullable)
- `last_nudge_at` (timestamptz, nullable)
- `created_at` (timestamptz, default `now()`)

### `chore_logs`
- `id` (uuid, PK, default `gen_random_uuid()`)
- `chore_id` (uuid, references `chores.id` on delete cascade)
- `room_id` (uuid, references `rooms.id` on delete cascade)
- `completed_by` (uuid, references `profiles.id`)
- `xp_earned` (int, not null)
- `completed_at` (timestamptz, default `now()`)

## 3. Core Mechanics & Logic

### Turn Rotation Algorithm (On Chore Completion)
1. Insert a record into `chore_logs`.
2. Add `chore.xp_reward` to the completing user's `weekly_xp` and `total_xp` in `apartment_members`.
3. Increment `personal_streak` (if completed on or before `next_due_at`, or if `on_demand`) and increment `rooms.room_streak`.
4. Fetch all `room_members` for `chore.room_id` ordered by `rotation_position ASC`.
5. Find the index of `chore.current_assignee_id` in that list and advance to `(index + 1) % room_members.length`.
6. Update `chores.current_assignee_id` to the next member's `user_id`.
7. If `schedule_type === 'interval_days'`, set `next_due_at = now() + (frequency_days * interval '1 day')`.

### Room Cleanliness Meter (UI Visual)
- **Sparkling (Green):** All interval chores in the room have `next_due_at` more than 24 hours away.
- **Due Soon (Amber):** At least one chore is due within the next 24 hours.
- **Needs Love (Red):** At least one chore has `next_due_at < now()`.

### Notifications
- Store device Expo Push Token in `profiles.expo_push_token` after login.
- Trigger push notifications via Supabase Edge Function calling `https://exp.host/--/api/v2/push/send`:
  1. **Turn Handoff:** Sent immediately when a chore rotates to the next `room_member`.
  2. **Friendly Nudge:** A roommate can tap "Nudge" on an overdue chore (rate-limited to once every 24 hours via `last_nudge_at`).
  3. **Scheduled Reminders:** Cron check for chores due in 24 hours or overdue.
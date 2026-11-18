# tasks.md — Build Roadmap

- [ ] **Task 0: Database Schema & RLS Setup**
  Generate complete Supabase SQL migration (`supabase/schema.sql`) with all tables from `spec.md`, Row-Level Security (RLS) policies, and a PostgreSQL RPC function `complete_chore(p_chore_id uuid)` for atomic rotation + XP updates. Generate `types/database.ts`.

- [x] **Task 1: Supabase Client & Authentication Flow**
  Configure `lib/supabase.ts` using `expo-secure-store`. Build Sign Up (with `display_name` + `avatar_emoji` picker), Sign In, and auto-redirect routing in `app/_layout.tsx`.

- [ ] **Task 2: Apartment Onboarding (Create or Join)**
  If a logged-in user has no row in `apartment_members`, route them to an onboarding screen to either **Create an Apartment** (auto-generating a unique 6-character `invite_code` and adding them as `admin`) or **Join an Apartment** via `invite_code`.

- [ ] **Task 3: Custom Room Builder & Member Assignment**
  Build the Home screen (`app/(tabs)/index.tsx`) showing apartment header, invite code copy button, and room cards. Create `components/AddRoomModal.tsx` allowing users to name a room, select `icon_type`, and multi-select which `apartment_members` belong to this room (assigning `rotation_position`).

- [ ] **Task 4: Room Detail, Chore Creation & 1-Tap Rotation**
  Build `app/room/[id].tsx` displaying assigned room members in rotation order, room cleanliness status, and the room's chore list. Build `components/AddChoreModal.tsx` and wire 1-tap chore completion to the `complete_chore` RPC with celebratory feedback.

- [ ] **Task 5: Duolingo Gamification (Leaderboard & Streaks)**
  Build `app/(tabs)/leaderboard.tsx` showing the apartment's weekly XP podium, total XP, and personal/room streak badges. Add a "Friendly Nudge" button on overdue chores.

- [ ] **Task 6: Push Notifications & Edge Function**
  Implement `lib/notifications.ts` to request permissions and save `expo_push_token` to `profiles`. Create a Supabase Edge Function (`supabase/functions/send-push/index.ts`) triggered on turn handoffs, nudges, and scheduled due-date reminders.
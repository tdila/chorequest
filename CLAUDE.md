# CLAUDE.md — Project Rules & Architecture

## Tech Stack
- **Framework:** React Native with Expo (TypeScript, strict mode)
- **Navigation:** Expo Router (`app/` directory, file-based routing)
- **Backend & Auth:** Supabase (`@supabase/supabase-js` with `expo-secure-store` for session persistence)
- **Icons:** `lucide-react-native`
- **Styling:** React Native `StyleSheet` with a vibrant, Duolingo-inspired playful UI (rounded cards, bold typography, clear progress bars, high-contrast status colors)

## Folder Structure
- `app/(auth)/` — Login and Sign-Up screens
- `app/(tabs)/` — Main authenticated screens (`index.tsx` Home/Rooms, `leaderboard.tsx`, `profile.tsx`)
- `app/room/[id].tsx` — Individual room detail and chore list
- `components/` — Reusable UI components (RoomCard, ChoreItem, StreakBadge, Modals)
- `lib/supabase.ts` — Supabase client configured with `expo-secure-store`
- `lib/notifications.ts` — Expo push token registration and local notification helpers
- `types/database.ts` — TypeScript interfaces matching Supabase tables

## Non-Negotiable Domain Rules
1. **Dynamic Rooms Only:** Never hardcode room names (e.g., "Kitchen", "Bathroom") or assume a fixed apartment layout. Users start with an empty apartment and add as many custom rooms as they want.
2. **Room-Scoped Rotation:** Never assign chores across the whole apartment by default. Every chore belongs to a `room_id`, and rotation cycles strictly through the users in `room_members` for that specific room (e.g., 2 tenants assigned to Bathroom A, 2 tenants assigned to Bathroom B, all 4 assigned to Kitchen).
3. **No Fake Data:** Wire every screen directly to Supabase queries. Do not leave hardcoded mock arrays in production components.
4. **Security:** Never use a Supabase `service_role` key in this repository. Rely on the public `anon` key and Supabase Row-Level Security (RLS).

## Workflow & Verification
- Before writing code for any task, read `spec.md` and `tasks.md`.
- Propose a brief implementation plan first before creating or editing multiple files.
- After every code change, run `npx tsc --noEmit` and fix all TypeScript errors before finishing.
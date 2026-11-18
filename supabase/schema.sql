-- ============================================================================
-- ChoreQuest — Supabase schema (Task 0)
-- Tables, constraints, indexes, handle_new_user trigger, strict apartment-scoped
-- RLS, and the atomic complete_chore(p_chore_id uuid) rotation RPC.
--
-- Security model: clients use ONLY the public anon key. Every table has RLS
-- enabled. Membership checks run through SECURITY DEFINER helper functions to
-- avoid the classic "policy on apartment_members selects apartment_members"
-- infinite-recursion trap. Privileged writes (XP, streaks, rotation, chore_logs
-- inserts) happen exclusively inside complete_chore, which is SECURITY DEFINER.
-- ============================================================================

create extension if not exists pgcrypto;  -- gen_random_uuid()

-- ----------------------------------------------------------------------------
-- Tables
-- ----------------------------------------------------------------------------

create table if not exists public.profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  display_name    text not null,
  avatar_emoji    text not null default '🧼',
  expo_push_token text,
  created_at      timestamptz not null default now()
);

create table if not exists public.apartments (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  invite_code      text not null unique check (invite_code ~ '^[A-Z0-9]{6}$'),
  apartment_streak int not null default 0,
  created_by       uuid references public.profiles (id),
  created_at       timestamptz not null default now()
);

create table if not exists public.apartment_members (
  id              uuid primary key default gen_random_uuid(),
  apartment_id    uuid not null references public.apartments (id) on delete cascade,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  role            text not null default 'member' check (role in ('admin', 'member')),
  weekly_xp       int not null default 0,
  total_xp        int not null default 0,
  personal_streak int not null default 0,
  joined_at       timestamptz not null default now(),
  unique (apartment_id, user_id)
);

create table if not exists public.rooms (
  id           uuid primary key default gen_random_uuid(),
  apartment_id uuid not null references public.apartments (id) on delete cascade,
  name         text not null,
  icon_type    text not null check (icon_type in ('kitchen', 'bathroom', 'bedroom', 'living', 'trash', 'other')),
  room_streak  int not null default 0,
  created_at   timestamptz not null default now()
);

create table if not exists public.room_members (
  id                uuid primary key default gen_random_uuid(),
  room_id           uuid not null references public.rooms (id) on delete cascade,
  user_id           uuid not null references public.profiles (id) on delete cascade,
  rotation_position int not null,
  unique (room_id, user_id)
);

create table if not exists public.chores (
  id                  uuid primary key default gen_random_uuid(),
  room_id             uuid not null references public.rooms (id) on delete cascade,
  title               text not null,
  xp_reward           int not null default 20,
  schedule_type       text not null default 'interval_days' check (schedule_type in ('interval_days', 'on_demand')),
  frequency_days      int,
  current_assignee_id uuid references public.profiles (id),
  next_due_at         timestamptz,
  last_nudge_at       timestamptz,
  created_at          timestamptz not null default now()
);

create table if not exists public.chore_logs (
  id           uuid primary key default gen_random_uuid(),
  chore_id     uuid not null references public.chores (id) on delete cascade,
  room_id      uuid not null references public.rooms (id) on delete cascade,
  completed_by uuid references public.profiles (id),
  xp_earned    int not null,
  completed_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Indexes (foreign keys + common lookup columns)
-- ----------------------------------------------------------------------------

create index if not exists idx_apartment_members_apartment on public.apartment_members (apartment_id);
create index if not exists idx_apartment_members_user      on public.apartment_members (user_id);
create index if not exists idx_rooms_apartment             on public.rooms (apartment_id);
create index if not exists idx_room_members_room           on public.room_members (room_id);
create index if not exists idx_room_members_user           on public.room_members (user_id);
create index if not exists idx_chores_room                 on public.chores (room_id);
create index if not exists idx_chores_assignee             on public.chores (current_assignee_id);
create index if not exists idx_chore_logs_room             on public.chore_logs (room_id);
create index if not exists idx_chore_logs_chore            on public.chore_logs (chore_id);
create index if not exists idx_chore_logs_completed_by     on public.chore_logs (completed_by);

-- ----------------------------------------------------------------------------
-- New-user trigger: create a profiles row whenever an auth.users row is created
-- ----------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, display_name, avatar_emoji)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      nullif(split_part(new.email, '@', 1), ''),
      'Roommate'
    ),
    coalesce(nullif(new.raw_user_meta_data ->> 'avatar_emoji', ''), '🧼')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- RLS helper functions (SECURITY DEFINER — bypass RLS to break recursion)
-- ----------------------------------------------------------------------------

create or replace function public.is_apartment_member(p_apartment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.apartment_members m
    where m.apartment_id = p_apartment_id
      and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_apartment_admin(p_apartment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.apartment_members m
    where m.apartment_id = p_apartment_id
      and m.user_id = auth.uid()
      and m.role = 'admin'
  );
$$;

-- Maps a room to its apartment id (used by room/room_members/chore/chore_logs
-- policies so they resolve membership through a single definer call).
create or replace function public.room_apartment_id(p_room_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select r.apartment_id from public.rooms r where r.id = p_room_id;
$$;

-- True when auth.uid() is a member of the apartment that owns the given room.
create or replace function public.is_room_apartment_member(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_apartment_member(public.room_apartment_id(p_room_id));
$$;

-- ----------------------------------------------------------------------------
-- Enable RLS on every table
-- ----------------------------------------------------------------------------

alter table public.profiles          enable row level security;
alter table public.apartments        enable row level security;
alter table public.apartment_members enable row level security;
alter table public.rooms             enable row level security;
alter table public.room_members      enable row level security;
alter table public.chores            enable row level security;
alter table public.chore_logs        enable row level security;

-- ----------------------------------------------------------------------------
-- Policies: profiles
--   Read own + anyone sharing an apartment (for leaderboard / display).
--   Update own only. No direct insert (trigger owns it). No delete (cascades).
-- ----------------------------------------------------------------------------

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1
      from public.apartment_members me
      join public.apartment_members them
        on them.apartment_id = me.apartment_id
      where me.user_id = auth.uid()
        and them.user_id = profiles.id
    )
  );

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ----------------------------------------------------------------------------
-- Policies: apartments
--   Read if member. Insert if you are the creator. Update/delete admin only.
-- ----------------------------------------------------------------------------

drop policy if exists apartments_select on public.apartments;
create policy apartments_select on public.apartments
  for select to authenticated
  using (public.is_apartment_member(id));

drop policy if exists apartments_insert on public.apartments;
create policy apartments_insert on public.apartments
  for insert to authenticated
  with check (created_by = auth.uid());

drop policy if exists apartments_update on public.apartments;
create policy apartments_update on public.apartments
  for update to authenticated
  using (public.is_apartment_admin(id))
  with check (public.is_apartment_admin(id));

drop policy if exists apartments_delete on public.apartments;
create policy apartments_delete on public.apartments
  for delete to authenticated
  using (public.is_apartment_admin(id));

-- ----------------------------------------------------------------------------
-- Policies: apartment_members
--   Read if member of that apartment. Insert own row (join flow) or by admin.
--   Update/delete own row or by admin. (XP/streak writes bypass RLS via RPC.)
-- ----------------------------------------------------------------------------

drop policy if exists apartment_members_select on public.apartment_members;
create policy apartment_members_select on public.apartment_members
  for select to authenticated
  using (public.is_apartment_member(apartment_id));

drop policy if exists apartment_members_insert on public.apartment_members;
create policy apartment_members_insert on public.apartment_members
  for insert to authenticated
  with check (
    user_id = auth.uid()
    or public.is_apartment_admin(apartment_id)
  );

drop policy if exists apartment_members_update on public.apartment_members;
create policy apartment_members_update on public.apartment_members
  for update to authenticated
  using (user_id = auth.uid() or public.is_apartment_admin(apartment_id))
  with check (user_id = auth.uid() or public.is_apartment_admin(apartment_id));

drop policy if exists apartment_members_delete on public.apartment_members;
create policy apartment_members_delete on public.apartment_members
  for delete to authenticated
  using (user_id = auth.uid() or public.is_apartment_admin(apartment_id));

-- ----------------------------------------------------------------------------
-- Policies: rooms (any apartment member may manage)
-- ----------------------------------------------------------------------------

drop policy if exists rooms_select on public.rooms;
create policy rooms_select on public.rooms
  for select to authenticated
  using (public.is_apartment_member(apartment_id));

drop policy if exists rooms_insert on public.rooms;
create policy rooms_insert on public.rooms
  for insert to authenticated
  with check (public.is_apartment_member(apartment_id));

drop policy if exists rooms_update on public.rooms;
create policy rooms_update on public.rooms
  for update to authenticated
  using (public.is_apartment_member(apartment_id))
  with check (public.is_apartment_member(apartment_id));

drop policy if exists rooms_delete on public.rooms;
create policy rooms_delete on public.rooms
  for delete to authenticated
  using (public.is_apartment_member(apartment_id));

-- ----------------------------------------------------------------------------
-- Policies: room_members (any apartment member may manage assignments)
-- ----------------------------------------------------------------------------

drop policy if exists room_members_select on public.room_members;
create policy room_members_select on public.room_members
  for select to authenticated
  using (public.is_room_apartment_member(room_id));

drop policy if exists room_members_insert on public.room_members;
create policy room_members_insert on public.room_members
  for insert to authenticated
  with check (public.is_room_apartment_member(room_id));

drop policy if exists room_members_update on public.room_members;
create policy room_members_update on public.room_members
  for update to authenticated
  using (public.is_room_apartment_member(room_id))
  with check (public.is_room_apartment_member(room_id));

drop policy if exists room_members_delete on public.room_members;
create policy room_members_delete on public.room_members
  for delete to authenticated
  using (public.is_room_apartment_member(room_id));

-- ----------------------------------------------------------------------------
-- Policies: chores (any apartment member may manage)
-- ----------------------------------------------------------------------------

drop policy if exists chores_select on public.chores;
create policy chores_select on public.chores
  for select to authenticated
  using (public.is_room_apartment_member(room_id));

drop policy if exists chores_insert on public.chores;
create policy chores_insert on public.chores
  for insert to authenticated
  with check (public.is_room_apartment_member(room_id));

drop policy if exists chores_update on public.chores;
create policy chores_update on public.chores
  for update to authenticated
  using (public.is_room_apartment_member(room_id))
  with check (public.is_room_apartment_member(room_id));

drop policy if exists chores_delete on public.chores;
create policy chores_delete on public.chores
  for delete to authenticated
  using (public.is_room_apartment_member(room_id));

-- ----------------------------------------------------------------------------
-- Policies: chore_logs
--   Read if apartment member. No direct insert policy — inserts happen only
--   inside complete_chore (SECURITY DEFINER) so XP cannot be forged.
-- ----------------------------------------------------------------------------

drop policy if exists chore_logs_select on public.chore_logs;
create policy chore_logs_select on public.chore_logs
  for select to authenticated
  using (public.is_room_apartment_member(room_id));

-- ----------------------------------------------------------------------------
-- complete_chore: atomic rotation + XP + streaks
--   Verifies the caller is a room member, logs the completion, awards XP,
--   updates streaks, advances the assignee by rotation_position, updates
--   next_due_at, and returns the next assignee's user_id (for the push).
-- ----------------------------------------------------------------------------

create or replace function public.complete_chore(p_chore_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid           uuid := auth.uid();
  v_chore         public.chores%rowtype;
  v_apartment_id  uuid;
  v_member_count  int;
  v_curr_pos      int;
  v_next_pos      int;
  v_next_assignee uuid;
  v_on_time       boolean;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  -- 1. Load the chore.
  select * into v_chore from public.chores where id = p_chore_id;
  if not found then
    raise exception 'Chore % not found', p_chore_id;
  end if;

  -- 2. Authz: caller must be a member of the chore's room.
  if not exists (
    select 1 from public.room_members rm
    where rm.room_id = v_chore.room_id and rm.user_id = v_uid
  ) then
    raise exception 'Not a member of this room';
  end if;

  select r.apartment_id into v_apartment_id
  from public.rooms r where r.id = v_chore.room_id;

  -- 3. Log the completion.
  insert into public.chore_logs (chore_id, room_id, completed_by, xp_earned)
  values (v_chore.id, v_chore.room_id, v_uid, v_chore.xp_reward);

  -- 4. Award XP to the caller within this apartment.
  update public.apartment_members
     set weekly_xp = weekly_xp + v_chore.xp_reward,
         total_xp  = total_xp + v_chore.xp_reward
   where apartment_id = v_apartment_id
     and user_id = v_uid;

  -- 5. Streaks. On-time when on_demand, no due date, or completed by due date.
  v_on_time := v_chore.schedule_type = 'on_demand'
               or v_chore.next_due_at is null
               or now() <= v_chore.next_due_at;

  update public.apartment_members
     set personal_streak = case when v_on_time then personal_streak + 1 else 1 end
   where apartment_id = v_apartment_id
     and user_id = v_uid;

  update public.rooms
     set room_streak = room_streak + 1
   where id = v_chore.room_id;

  -- 6. Rotation: advance to the next room member by rotation_position.
  select count(*) into v_member_count
  from public.room_members where room_id = v_chore.room_id;

  if v_member_count > 0 then
    -- Position of the current assignee, if any.
    select rotation_position into v_curr_pos
    from public.room_members
    where room_id = v_chore.room_id
      and user_id = v_chore.current_assignee_id;

    if v_curr_pos is null then
      -- No/invalid current assignee: start at the lowest rotation_position.
      select user_id into v_next_assignee
      from public.room_members
      where room_id = v_chore.room_id
      order by rotation_position asc
      limit 1;
    else
      -- Next member strictly after the current position, wrapping to the first.
      select user_id into v_next_assignee
      from public.room_members
      where room_id = v_chore.room_id
        and rotation_position > v_curr_pos
      order by rotation_position asc
      limit 1;

      if v_next_assignee is null then
        select user_id into v_next_assignee
        from public.room_members
        where room_id = v_chore.room_id
        order by rotation_position asc
        limit 1;
      end if;
    end if;
  end if;

  -- 7. Advance assignee and recompute next_due_at.
  update public.chores
     set current_assignee_id = v_next_assignee,
         next_due_at = case
           when v_chore.schedule_type = 'interval_days' and v_chore.frequency_days is not null
             then now() + (v_chore.frequency_days * interval '1 day')
           else null
         end
   where id = v_chore.id;

  -- 8. Return the next assignee so the client can fire a turn-handoff push.
  return v_next_assignee;
end;
$$;

revoke all on function public.complete_chore(uuid) from public;
grant execute on function public.complete_chore(uuid) to authenticated;

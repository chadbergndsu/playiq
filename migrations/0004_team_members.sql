-- Team staff roster (roles for Google/X sign-in matching).
-- Role is assigned by admin invite (email); user_id fills in on first login.

create table if not exists team_members (
  id text primary key,
  email text not null unique,
  role text not null check (role in ('admin', 'head_coach', 'coach', 'parent')),
  user_id text references "user" ("id") on delete set null,
  display_name text,
  invited_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists team_members_user_id_idx on team_members (user_id);
create index if not exists team_members_role_idx on team_members (role);

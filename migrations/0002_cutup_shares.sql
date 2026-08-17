-- Public cutup share snapshots (teach reels / install playlists).
-- Token is unguessable; payload is JSON text for portable export parity.

create table if not exists cutup_shares (
  token text primary key,
  title text not null,
  description text not null default '',
  payload text not null,
  created_at timestamptz not null default now()
);

create index if not exists cutup_shares_created_at_idx on cutup_shares (created_at desc);

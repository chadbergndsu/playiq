-- Share TTL + optional creator for authenticated publish.

alter table cutup_shares
  add column if not exists expires_at timestamptz;

alter table cutup_shares
  add column if not exists created_by text;

-- Backfill existing rows: 30-day window from created_at.
update cutup_shares
set expires_at = created_at + interval '30 days'
where expires_at is null;

create index if not exists cutup_shares_expires_at_idx on cutup_shares (expires_at);

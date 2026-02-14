-- Rate limiting table
create table rate_limits (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  timestamp timestamptz not null default now()
);

-- Index for fast lookups by key and time window
create index idx_rate_limits_key_timestamp on rate_limits (key, timestamp desc);

-- Auto-cleanup: delete entries older than 15 minutes
-- (longer than any rate limit window we use)
create or replace function cleanup_rate_limits()
returns trigger as $$
begin
  delete from rate_limits where timestamp < now() - interval '15 minutes';
  return new;
end;
$$ language plpgsql;

create trigger trigger_cleanup_rate_limits
  after insert on rate_limits
  for each statement
  execute function cleanup_rate_limits();

-- RLS: only the service role should access this table (via server-side API routes)
alter table rate_limits enable row level security;

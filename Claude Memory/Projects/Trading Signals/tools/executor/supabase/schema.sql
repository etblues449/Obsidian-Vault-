-- Trade Guard executor — Supabase schema (apply once in the SQL editor of the
-- existing project). Idempotent: safe to re-run.
--
-- Access model (single user, financial data):
--   * The Pi worker writes with the SERVICE-ROLE key (bypasses RLS).
--   * The dashboard NEVER uses the anon key in the browser. It reads and writes
--     through jarvis-carousel's bearer-gated /api/trade route, which holds the
--     service-role key server-side. So: RLS enabled everywhere, no anon
--     policies, nothing readable with the public key.
--   * Realtime is therefore not needed; the dashboard polls /api/trade.

create table if not exists public.signals (
  id          text primary key,              -- "<channel_id>:<msg_id>"
  ts          double precision,              -- epoch seconds (message time)
  channel     text,
  msg_id      bigint,
  text        text,
  parsed      jsonb,                         -- {side, entry, sl, tp} or null
  status      text,                          -- received | skipped | rejected | parsed
  reason      text,
  env         text,                          -- practice | live
  created_at  timestamptz not null default now()
);

create table if not exists public.trades (
  id            text primary key,            -- OANDA trade id
  signal_id     text references public.signals(id) on delete set null,
  instrument    text,
  side          smallint,                    -- +1 long, -1 short
  units         numeric,
  entry         numeric,
  sl            numeric,
  tp            numeric,
  open_time     double precision,
  close_time    double precision,
  close_price   numeric,
  realized_pl   numeric,                     -- account currency, broker-reported
  status        text,                        -- open | closed | unknown
  close_reason  text,
  note          text,
  signal_entry  numeric,
  risk_account  numeric,
  env           text,
  updated_at    timestamptz not null default now()
);

create table if not exists public.events (
  id          bigserial primary key,
  ts          double precision,
  kind        text,                          -- startup | order_filled | order_refused | trade_closed | live_start_check | …
  env         text,
  payload     jsonb,
  created_at  timestamptz not null default now()
);

create table if not exists public.settings (
  id             integer primary key default 1 check (id = 1),  -- single row
  kill_switch    boolean not null default false,
  live_check     boolean not null default false,   -- manual gate: signals arrive BEFORE the move
  broker_check   boolean not null default true,    -- manual gate: broker is FCA-authorised (OANDA Europe)
  worker_status  jsonb,                            -- heartbeat from the Pi (every 60 s)
  updated_at     timestamptz not null default now()
);
insert into public.settings (id) values (1) on conflict (id) do nothing;

create table if not exists public.push_subscriptions (
  id            bigserial primary key,
  endpoint      text unique not null,
  subscription  jsonb not null,             -- the PushSubscription JSON from the browser
  user_agent    text,
  created_at    timestamptz not null default now()
);

-- updated_at maintenance
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;
drop trigger if exists trades_touch on public.trades;
create trigger trades_touch before update on public.trades for each row execute function public.touch_updated_at();
drop trigger if exists settings_touch on public.settings;
create trigger settings_touch before update on public.settings for each row execute function public.touch_updated_at();

-- indexes for the dashboard's queries
create index if not exists trades_status_idx     on public.trades (status);
create index if not exists trades_open_time_idx  on public.trades (open_time desc);
create index if not exists trades_env_idx        on public.trades (env);
create index if not exists events_ts_idx         on public.events (ts desc);
create index if not exists signals_ts_idx        on public.signals (ts desc);

-- RLS on, no policies: only the service-role key can read or write.
alter table public.signals            enable row level security;
alter table public.trades             enable row level security;
alter table public.events             enable row level security;
alter table public.settings           enable row level security;
alter table public.push_subscriptions enable row level security;
revoke all on public.signals, public.trades, public.events, public.settings, public.push_subscriptions from anon, authenticated;

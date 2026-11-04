-- Benchmark e escada de degraus do Placar (docs/placar-benchmark.md). Idempotente.
-- Mesmo padrão de acesso de placar.sql: RLS ligado, sem policy, grant só ao service_role.

alter table public.placar_clients add column if not exists sector      text not null default '';
alter table public.placar_clients add column if not exists result_kind text not null default ''
  check (result_kind in ('', 'lead', 'conversa', 'venda'));
alter table public.placar_clients add column if not exists ads_meta    text not null default '';
alter table public.placar_clients add column if not exists ads_google  text not null default '';

alter table public.placar_entries add column if not exists spend  numeric null check (spend is null or spend >= 0);
alter table public.placar_entries add column if not exists detail jsonb   not null default '{}'::jsonb;
alter table public.placar_entries add column if not exists source text    not null default ''
  check (source in ('', 'auto', 'manual'));

alter table public.placar_rodada add column if not exists tier text not null default ''
  check (tier in ('', 'ouro', 'prata', 'bronze', 'abaixo'));

create table if not exists public.placar_benchmarks (
  id           text primary key,                 -- <sector>_<result_kind>_<platform>
  sector       text        not null,
  result_kind  text        not null check (result_kind in ('lead', 'conversa', 'venda')),
  platform     text        not null check (platform in ('meta', 'google')),
  metric       text        not null check (metric in ('custo', 'roas')),
  p25          numeric     null,
  p50          numeric     null,
  p75          numeric     null,
  p90          numeric     null,
  source       text        not null default '',  -- de onde veio, em texto, sem segredo
  captured_at  date        null,
  updated_at   timestamptz not null default now(),
  unique (sector, result_kind, platform)
);

alter table public.placar_benchmarks enable row level security;
revoke all on table public.placar_benchmarks from anon, authenticated;
grant select, insert, update, delete on table public.placar_benchmarks to service_role;

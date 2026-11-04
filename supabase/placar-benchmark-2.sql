-- Verba prevista e meta automática pela escada (docs/placar-benchmark.md). Idempotente.
alter table public.placar_clients add column if not exists budget    numeric null check (budget is null or budget >= 0);
alter table public.placar_clients add column if not exists meta_auto boolean not null default false;

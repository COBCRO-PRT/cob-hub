-- Placar de Clientes (cob-hub): tabelas e acesso.
--
-- Rodar uma vez no SQL Editor do projeto Supabase escolhido (ou com psql).
-- Idempotente: pode rodar de novo sem apagar nada.
--
-- Acesso: RLS ligado e SEM policy, então anon e authenticated não leem nem
-- gravam nada. Só o servidor do hub fala com estas tabelas, com a chave
-- service_role (PLACAR_SUPABASE_SERVICE_KEY), que ignora RLS mas ainda precisa
-- do GRANT de base do Postgres. Por isso o grant explícito no fim.

create table if not exists public.placar_clients (
  id           text primary key,
  name         text        not null,
  owner        text        not null default '',
  owner_ok     boolean     not null default false,
  fee          numeric     null check (fee is null or fee >= 0),
  delivers     text        not null default '',
  kind         text        not null default 'resultado' check (kind in ('resultado', 'projeto')),
  meta_value   numeric     null check (meta_value is null or meta_value > 0),
  meta_label   text        not null default '',
  meta_period  text        not null default 'mes' check (meta_period in ('dia', 'semana', 'mes')),
  meta_mode    text        not null default 'soma' check (meta_mode in ('soma', 'taxa', 'custo')),
  meta_note    text        not null default '',
  meta_review  boolean     not null default false,
  active       boolean     not null default true,
  updated_at   timestamptz not null default now()
);

create table if not exists public.placar_entries (
  id            text primary key,                       -- <client>_<week>
  client        text        not null references public.placar_clients (id) on update cascade on delete restrict,
  week          date        not null check (extract(isodow from week) = 1),  -- segunda-feira
  weeks         int         not null default 1 check (weeks in (1, 4)),      -- 4 = mês inteiro
  value         numeric     null,
  milestone     boolean     null,
  client_score  numeric     null check (client_score is null or (client_score >= 0 and client_score <= 10)),
  note          text        not null default '',
  updated_at    timestamptz not null default now(),
  unique (client, week)
);

create index if not exists placar_entries_week_idx on public.placar_entries (week);

alter table public.placar_clients enable row level security;
alter table public.placar_entries enable row level security;

revoke all on table public.placar_clients, public.placar_entries from anon, authenticated;
grant select, insert, update, delete on table public.placar_clients, public.placar_entries to service_role;

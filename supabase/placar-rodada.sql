-- Rodada da semana e tarefas dos vermelhos (cob-hub). Ver docs/placar-semana.md.
--
-- Rodar depois de placar.sql. Idempotente: pode rodar de novo sem apagar nada.
-- Mesmo acesso das outras tabelas do placar: RLS ligado e sem policy, só a
-- service_role do servidor do hub lê e grava.

-- Nota e pontos de cada cliente, congelados quando a rodada fecha.
create table if not exists public.placar_rodada (
  week       date        not null check (extract(isodow from week) = 1),  -- segunda-feira
  client     text        not null references public.placar_clients (id) on update cascade on delete restrict,
  owner      text        not null default '',
  tone       text        not null check (tone in ('good', 'warn', 'bad', 'none')),
  score      numeric     null,
  points     int         not null default 0,
  badges     text[]      not null default '{}',
  closed_at  timestamptz not null default now(),
  primary key (week, client)
);

-- Tarefa do ClickUp de cada cliente que ficou vermelho.
create table if not exists public.placar_tasks (
  id            text primary key,                        -- id da tarefa no ClickUp
  client        text        not null references public.placar_clients (id) on update cascade on delete restrict,
  week          date        not null,                    -- rodada em que ficou vermelho
  url           text        not null default '',
  status        text        not null default '',
  closed        boolean     not null default false,
  closed_at     timestamptz null,                        -- quando fechou no ClickUp (conquista "Plano em 72h")
  escalated_at  timestamptz null,
  created_at    timestamptz not null default now(),
  synced_at     timestamptz not null default now()
);

alter table public.placar_tasks add column if not exists closed_at timestamptz null;

create index if not exists placar_tasks_client_idx on public.placar_tasks (client);

alter table public.placar_rodada enable row level security;
alter table public.placar_tasks enable row level security;

revoke all on table public.placar_rodada, public.placar_tasks from anon, authenticated;
grant select, insert, update, delete on table public.placar_rodada, public.placar_tasks to service_role;

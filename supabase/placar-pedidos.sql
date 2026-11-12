-- Pedido do cliente: o resultado que ele quer no mês seguinte (cob-hub). Ver docs/placar-pedido-cliente.md.
--
-- Rodar depois de placar.sql. Idempotente. Mesmo acesso das outras tabelas do
-- placar: RLS ligado e sem policy, só a service_role do servidor do hub lê e grava.
-- Aplicar à mão pelo mesmo caminho das outras (nunca `supabase db push` no projeto do iHub).

create table if not exists public.placar_pedidos (
  id            text primary key,                        -- <client>_<AAAA-MM>
  client        text        not null references public.placar_clients (id) on update cascade on delete restrict,
  month         text        not null check (month ~ '^\d{4}-\d{2}$'),  -- mês pedido
  wanted_value  numeric     null,
  wanted_label  text        not null default '',
  score         numeric     null check (score is null or (score >= 0 and score <= 10)),
  note          text        not null default '',
  created_at    timestamptz not null default now(),
  answered_at   timestamptz null,
  answer        text        not null default '',
  accepted      boolean     not null default false
);

create index if not exists placar_pedidos_client_idx on public.placar_pedidos (client);

alter table public.placar_pedidos enable row level security;

-- ============================================================================
--  Sistema Reforma Tributária — configuração do banco de login (Supabase)
--  Rode este script UMA VEZ no Supabase: painel → SQL Editor → New query →
--  cole tudo → Run.
-- ============================================================================

-- 1) Tabela de perfis: 1 linha por usuário, guarda o "papel" (normal/master).
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  nome        text,
  papel       text not null default 'normal' check (papel in ('normal', 'master')),
  criado_em   timestamptz not null default now()
);

-- 2) Liga a segurança por linha (RLS).
alter table public.profiles enable row level security;

-- 3) Cada usuário pode LER o próprio perfil (o app usa isso para saber o papel).
--    Toda ESCRITA (criar/alterar papel) é feita só pelo servidor com a chave
--    service_role, que ignora o RLS — por isso não há policy de insert/update.
drop policy if exists "perfil_proprio_select" on public.profiles;
create policy "perfil_proprio_select"
  on public.profiles for select
  using (auth.uid() = id);

-- 4) Cria automaticamente o perfil quando um usuário novo é criado.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, nome)
  values (new.id, new.email, new.raw_user_meta_data ->> 'nome')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
--  MIGRAÇÃO v2 — Perfis Básico / Completo + Permissões configuráveis
--  Execute no Supabase SQL Editor após o bloco inicial acima.
-- ============================================================================

-- 1) Remove constraint antiga (sem ela, qualquer valor é aceito)
alter table public.profiles
  drop constraint if exists profiles_papel_check;

-- 2) Renomeia os dados enquanto não há constraint bloqueando
update public.profiles set papel = 'basico' where papel = 'normal';

-- 3) Adiciona a nova constraint (todos os dados já têm valor válido)
alter table public.profiles
  add constraint profiles_papel_check
  check (papel in ('basico', 'completo', 'master'));
alter table public.profiles alter column papel set default 'basico';

-- 3) Tabela de permissões por perfil (só basico/completo; master = sempre tudo)
create table if not exists public.profile_permissions (
  papel     text    not null check (papel in ('basico', 'completo')),
  modulo    text    not null check (modulo in ('tributos', 'markup', 'comparador', 'split_payment')),
  permitido boolean not null default true,
  primary key (papel, modulo)
);

-- 4) RLS — autenticados podem LER; escrita apenas via service_role
alter table public.profile_permissions enable row level security;
drop policy if exists "permissoes_select" on public.profile_permissions;
create policy "permissoes_select"
  on public.profile_permissions for select
  using (auth.role() = 'authenticated');

-- 5) Defaults: básico = só tributos; completo = tudo
insert into public.profile_permissions (papel, modulo, permitido) values
  ('basico',   'tributos',      true),
  ('basico',   'markup',        false),
  ('basico',   'comparador',    false),
  ('basico',   'split_payment', false),
  ('completo', 'tributos',      true),
  ('completo', 'markup',        true),
  ('completo', 'comparador',    true),
  ('completo', 'split_payment', true)
on conflict (papel, modulo) do nothing;

-- ============================================================================
--  BOOTSTRAP DO PRIMEIRO MASTER
--  Depois de criar o 1º usuário no painel (Authentication → Users → Add user),
--  rode a linha abaixo trocando o e-mail pelo do seu usuário:
-- ============================================================================
-- update public.profiles set papel = 'master'
-- where email = 'julio.silva@conflex.com.br';

-- ============================================================================
--  MIGRAÇÃO v3 — Tabelas de configuração de alíquotas (editor master)
--  Execute no Supabase SQL Editor após os blocos anteriores.
-- ============================================================================

-- Overrides do cronograma CBS/IBS por ano (2026-2033)
create table if not exists public.config_cronograma (
  ano                   int primary key,
  cbs_percentual        numeric,
  ibs_percentual        numeric,
  ibs_fator             numeric,
  icms_fator            numeric,
  iss_fator             numeric,
  pis_cofins_ativo      boolean,
  aliquotas_provisorias boolean,
  atualizado_em         timestamptz not null default now(),
  atualizado_por        uuid references auth.users
);

-- Overrides setoriais (reducao_aliquota, is_estimado, iss_padrao)
create table if not exists public.config_setores (
  setor_id           text primary key,
  reducao_aliquota   numeric,
  is_estimado        numeric,
  iss_padrao         numeric,
  atualizado_em      timestamptz not null default now(),
  atualizado_por     uuid references auth.users
);

-- Overrides de ICMS por UF (27 estados + DF)
create table if not exists public.config_estados (
  uf              char(2) primary key,
  icms_interno    numeric not null,
  atualizado_em   timestamptz not null default now(),
  atualizado_por  uuid references auth.users
);

-- RLS: leitura para todos autenticados; escrita somente via service_role (ignora RLS)
alter table public.config_cronograma enable row level security;
alter table public.config_setores    enable row level security;
alter table public.config_estados    enable row level security;

drop policy if exists "config_cronograma_select" on public.config_cronograma;
create policy "config_cronograma_select" on public.config_cronograma
  for select using (auth.role() = 'authenticated');

drop policy if exists "config_setores_select" on public.config_setores;
create policy "config_setores_select" on public.config_setores
  for select using (auth.role() = 'authenticated');

drop policy if exists "config_estados_select" on public.config_estados;
create policy "config_estados_select" on public.config_estados
  for select using (auth.role() = 'authenticated');

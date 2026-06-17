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
--  BOOTSTRAP DO PRIMEIRO MASTER
--  Depois de criar o 1º usuário no painel (Authentication → Users → Add user),
--  rode a linha abaixo trocando o e-mail pelo do seu usuário:
-- ============================================================================
-- update public.profiles set papel = 'master'
-- where email = 'julio.silva@conflex.com.br';

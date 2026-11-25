-- ============================================================================
--  MIGRAÇÃO: perfil "contador" + módulo "ferramentas"
--  Execute no Supabase SQL Editor (projeto → SQL Editor → New query)
-- ============================================================================

-- 1) Amplia a constraint de papel em profiles
alter table public.profiles
  drop constraint if exists profiles_papel_check;
alter table public.profiles
  add constraint profiles_papel_check
  check (papel in ('basico', 'completo', 'contador', 'master'));

-- 2) Amplia as constraints em profile_permissions
alter table public.profile_permissions
  drop constraint if exists profile_permissions_papel_check;
alter table public.profile_permissions
  add constraint profile_permissions_papel_check
  check (papel in ('basico', 'completo', 'contador'));

alter table public.profile_permissions
  drop constraint if exists profile_permissions_modulo_check;
alter table public.profile_permissions
  add constraint profile_permissions_modulo_check
  check (modulo in ('tributos', 'markup', 'comparador', 'split_payment', 'ferramentas'));

-- 3) Insere permissões padrão para o novo perfil e novo módulo
insert into public.profile_permissions (papel, modulo, permitido) values
  -- contador: acesso completo a tudo
  ('contador', 'tributos',      true),
  ('contador', 'markup',        true),
  ('contador', 'comparador',    true),
  ('contador', 'split_payment', true),
  ('contador', 'ferramentas',   true),
  -- módulo ferramentas para os perfis existentes
  ('basico',   'ferramentas',   false),
  ('completo', 'ferramentas',   true)
on conflict (papel, modulo) do nothing;

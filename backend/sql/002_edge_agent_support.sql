-- 002_edge_agent_support.sql
--
-- Complementos necessários para o Edge Agent (RAM buffer) + endpoints
-- /api/public/*. Assume que o schema principal (seção 3 da spec) já
-- existe. Rode isso depois de conferir que não conflita com o que já
-- está em produção.

-- ---------------------------------------------------------------------
-- 1) Policy para o heartbeat direto via REST (spec 6.2: "manter assim").
--    O script/agent manda `x-edge-token` como header; a PostgREST expõe
--    isso via current_setting('request.header.x-edge-token', true).
-- ---------------------------------------------------------------------
drop policy if exists edge_devices_heartbeat_update on public.edge_devices;

create policy edge_devices_heartbeat_update
on public.edge_devices
for update
to anon
using (
  edge_token::text = current_setting('request.header.x-edge-token', true)
)
with check (
  edge_token::text = current_setting('request.header.x-edge-token', true)
);

-- ---------------------------------------------------------------------
-- 2) Esconder edge_token de leituras anônimas/autenticadas comuns.
--    Nunca deve vir em SELECT * feito pelo painel admin sem necessidade.
-- ---------------------------------------------------------------------
create or replace view public.edge_devices_public as
select
  id, arena_id, name, hostname, local_ip, edge_version,
  status, last_seen, uptime_seconds, created_at
from public.edge_devices;

grant select on public.edge_devices_public to authenticated, anon;

-- ---------------------------------------------------------------------
-- 3) RPCs opcionais (alternativa "pura SQL" aos endpoints HTTP, seção 8).
--    Os endpoints TanStack em server-routes/ já cobrem os mesmos fluxos;
--    mantenha só um dos dois caminhos em produção para não duplicar
--    regra de negócio.
-- ---------------------------------------------------------------------

create or replace function public.fn_register_replay(
  p_edge_token uuid,
  p_quadra_id uuid,
  p_r2_key text,
  p_video_url text,
  p_duration_sec numeric,
  p_file_size_bytes bigint
)
returns public.replays
language plpgsql
security definer
set search_path = public
as $$
declare
  v_device public.edge_devices%rowtype;
  v_quadra public.quadras%rowtype;
  v_replay public.replays%rowtype;
begin
  select * into v_device from public.edge_devices where edge_token = p_edge_token;
  if not found then
    raise exception 'edge_token inválido' using errcode = '28000';
  end if;

  select * into v_quadra from public.quadras where id = p_quadra_id;
  if not found then
    raise exception 'quadra_id não encontrada';
  end if;

  if v_quadra.arena_id <> v_device.arena_id then
    raise exception 'quadra não pertence à arena deste edge device';
  end if;

  insert into public.replays (arena_id, quadra_id, edge_device_id, video_url, r2_key, duration_sec, file_size_bytes)
  values (v_quadra.arena_id, v_quadra.id, v_device.id, p_video_url, p_r2_key, p_duration_sec, p_file_size_bytes)
  returning * into v_replay;

  return v_replay;
end;
$$;

revoke all on function public.fn_register_replay(uuid, uuid, text, text, numeric, bigint) from public;
grant execute on function public.fn_register_replay(uuid, uuid, text, text, numeric, bigint) to anon, authenticated;


create or replace function public.fn_touch_edge_heartbeat(
  p_edge_token uuid,
  p_hostname text,
  p_local_ip text,
  p_version text,
  p_uptime_seconds int default null
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.edge_devices
  set status = 'online',
      last_seen = now(),
      hostname = coalesce(p_hostname, hostname),
      local_ip = coalesce(p_local_ip, local_ip),
      edge_version = coalesce(p_version, edge_version),
      uptime_seconds = coalesce(p_uptime_seconds, uptime_seconds)
  where edge_token = p_edge_token;
$$;

revoke all on function public.fn_touch_edge_heartbeat(uuid, text, text, text, int) from public;
grant execute on function public.fn_touch_edge_heartbeat(uuid, text, text, text, int) to anon, authenticated;


create or replace function public.fn_expire_replays()
returns table(replay_id uuid, r2_key text)
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Retorna os replays expirados; a exclusão real no R2 é feita pelo
  -- endpoint /api/public/cron/cleanup-replays (precisa das credenciais R2,
  -- que não existem dentro do Postgres). Esta função só identifica e loga
  -- a intenção; o endpoint confirma via r2_deletion_logs antes de apagar
  -- a linha de `replays`.
  return query
  select r.id, r.r2_key
  from public.replays r
  join public.arena_settings s on s.arena_id = r.arena_id
  where s.auto_cleanup_enabled
    and r.created_at < now() - (s.replay_retention_days || ' days')::interval;
end;
$$;

revoke all on function public.fn_expire_replays() from public;
grant execute on function public.fn_expire_replays() to service_role;

-- ---------------------------------------------------------------------
-- 4) Garantir Realtime habilitado nas 3 tabelas usadas pelo frontend
--    (idempotente -- ignora erro se já estiver na publication)
-- ---------------------------------------------------------------------
do $$
begin
  begin
    alter publication supabase_realtime add table public.replays;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.edge_devices;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.cameras;
  exception when duplicate_object then null;
  end;
end $$;

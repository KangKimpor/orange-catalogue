create or replace function public.check_admin_login_rate_limit(
  p_client_key text,
  p_result text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_limit public.admin_login_rate_limits%rowtype;
  request_time timestamptz := now();
  max_attempts constant integer := 5;
  window_duration constant interval := interval '15 minutes';
  retry_seconds integer := 0;
begin
  if p_client_key is null or length(p_client_key) < 32 then
    raise exception 'Invalid login rate-limit key';
  end if;

  if p_result not in ('check', 'failure', 'success') then
    raise exception 'Invalid login rate-limit result';
  end if;

  select *
    into current_limit
    from public.admin_login_rate_limits
   where client_key = p_client_key
   for update;

  if found and current_limit.blocked_until is not null and current_limit.blocked_until <= request_time then
    delete from public.admin_login_rate_limits where client_key = p_client_key;
    current_limit := null;
  elsif found and current_limit.window_started_at + window_duration <= request_time then
    delete from public.admin_login_rate_limits where client_key = p_client_key;
    current_limit := null;
  end if;

  if p_result = 'check' then
    if current_limit.blocked_until is not null and current_limit.blocked_until > request_time then
      retry_seconds := greatest(1, ceil(extract(epoch from current_limit.blocked_until - request_time))::integer);
      return jsonb_build_object('allowed', false, 'retry_after_seconds', retry_seconds);
    end if;
    return jsonb_build_object('allowed', true, 'retry_after_seconds', 0);
  end if;

  if p_result = 'success' then
    delete from public.admin_login_rate_limits where client_key = p_client_key;
    return jsonb_build_object('allowed', true, 'retry_after_seconds', 0);
  end if;

  if current_limit.client_key is null then
    insert into public.admin_login_rate_limits (client_key, window_started_at, failure_count, updated_at)
    values (p_client_key, request_time, 1, request_time)
    returning * into current_limit;
  else
    update public.admin_login_rate_limits
       set failure_count = failure_count + 1,
           updated_at = request_time,
           blocked_until = case
             when failure_count + 1 >= max_attempts then request_time + window_duration
             else blocked_until
           end
     where client_key = p_client_key
     returning * into current_limit;
  end if;

  if current_limit.blocked_until is not null and current_limit.blocked_until > request_time then
    retry_seconds := greatest(1, ceil(extract(epoch from current_limit.blocked_until - request_time))::integer);
    return jsonb_build_object('allowed', false, 'retry_after_seconds', retry_seconds);
  end if;

  return jsonb_build_object('allowed', true, 'retry_after_seconds', 0);
end;
$$;

create function public.guard_membership_update() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is not null then
  if new.room_id<>old.room_id or new.profile_id<>old.profile_id or new.status<>old.status or new.move_in_at is distinct from old.move_in_at or new.move_out_at is distinct from old.move_out_at then raise exception 'Membership identity is immutable'; end if;
  if new.onboarding_step>old.onboarding_step+1 or new.onboarding_step<old.onboarding_step then raise exception 'STEP_ORDER'; end if;
  if new.onboarding_step>=5 and exists(select 1 from content_blocks b where b.room_id=new.room_id and block_visible(b.id) and (b.published_snapshot->>'required_acknowledgement')::boolean and not exists(select 1 from acknowledgements a where a.membership_id=new.id and a.content_block_id=b.id and a.content_version=b.published_version)) then raise exception 'AGREEMENTS_REQUIRED'; end if;
  if new.onboarding_completed_at is not null and (new.onboarding_step<>7 or exists(select 1 from onboarding_tasks t where t.room_id=new.room_id and t.required and not exists(select 1 from onboarding_task_completions c where c.membership_id=new.id and c.onboarding_task_id=t.id))) then raise exception 'TASKS_REQUIRED'; end if;
 end if; return new;
end $$;
create trigger membership_guard before update on memberships for each row execute function guard_membership_update();
create function public.guard_repair_update() returns trigger language plpgsql set search_path=public as $$
begin
 if new.room_id<>old.room_id or new.membership_id<>old.membership_id then raise exception 'Repair ownership is immutable'; end if;
 if not room_staff(old.room_id,true) and (old.status<>'draft' or new.status<>'submitted' or (to_jsonb(new)-'status'-'updated_at') is distinct from (to_jsonb(old)-'status'-'updated_at')) then raise exception 'PERMISSION_DENIED'; end if;
 if new.status<>old.status and not ((old.status='draft' and new.status='submitted') or (old.status='submitted' and new.status='acknowledged') or (old.status='acknowledged' and new.status in ('scheduled','in_progress','resolved')) or (old.status='scheduled' and new.status in ('in_progress','resolved')) or (old.status='in_progress' and new.status='resolved') or (old.status='resolved' and new.status in ('closed','in_progress'))) then raise exception 'INVALID_TRANSITION'; end if;
 return new;
end $$;
create trigger repair_guard before update on maintenance_requests for each row execute function guard_repair_update();
create function public.resolve_invite(raw_token text) returns jsonb language plpgsql stable security definer set search_path=public,extensions as $$
declare answer jsonb;
begin
 if length(raw_token)<32 or length(raw_token)>200 then return null; end if;
 select jsonb_build_object('propertyName',p.name,'inviter',pr.display_name,'expiresAt',i.expires_at,'welcome','Everything you need to settle into your home, kept clear and current.') into answer from invites i join rooms r on r.id=i.room_id join properties p on p.id=r.property_id join profiles pr on pr.id=i.created_by where i.token_hash=encode(digest(raw_token,'sha256'),'hex') and i.claimed_at is null and i.revoked_at is null and i.expires_at>now();
 return answer;
end $$;
create function public.claim_invite(raw_token text) returns uuid language plpgsql security definer set search_path=public,extensions as $$
declare i invites; r rooms; result uuid;
begin
 if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
 select * into i from invites where token_hash=encode(digest(raw_token,'sha256'),'hex') for update;
 if i.id is null or i.claimed_at is not null or i.revoked_at is not null or i.expires_at<=now() then raise exception 'INVITE_UNAVAILABLE'; end if;
 if i.invitee_email is not null and lower(i.invitee_email)<>lower(coalesce(auth.jwt()->>'email','')) then raise exception 'EMAIL_MISMATCH'; end if;
 select * into r from rooms where id=i.room_id for update;
 if (select count(*) from memberships where room_id=r.id and status='active')>=r.capacity then raise exception 'HOME_FULL'; end if;
 if exists(select 1 from memberships where room_id=r.id and profile_id=auth.uid()) then raise exception 'MEMBERSHIP_EXISTS'; end if;
 insert into memberships(room_id,profile_id,status,move_in_at,onboarding_step) values(r.id,auth.uid(),'active',now(),2) returning id into result;
 update invites set claimed_at=now() where id=i.id;
 return result;
end $$;
-- One transaction for the domain's write set. Invoker privileges and RLS apply to every statement.
create function public.apply_roomly_changes(changes jsonb) returns void language plpgsql security invoker set search_path=public as $$
declare change jsonb; tab text; row_data jsonb; before_data jsonb; current_row jsonb; columns_sql text; values_sql text; update_sql text;
begin
 if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
 if jsonb_typeof(changes)<>'array' or jsonb_array_length(changes)>1000 then raise exception 'INVALID_CHANGESET'; end if;
 for change in select value from jsonb_array_elements(changes) loop
  tab=change->>'table'; row_data=change->'row'; before_data=change->'before';
  if not (tab=any(array['profiles','organisations','organisation_members','properties','rooms','memberships','invites','content_blocks','content_versions','translations','acknowledgements','onboarding_tasks','onboarding_task_completions','question_logs','ai_runs','ai_suggestions','maintenance_requests','maintenance_attachments','maintenance_events','manager_onboarding'])) then raise exception 'INVALID_TABLE'; end if;
  select string_agg(format('%I',column_name),',' order by ordinal_position), string_agg(format('r.%I',column_name),',' order by ordinal_position), string_agg(format('%I=r.%I',column_name,column_name),',' order by ordinal_position) into columns_sql,values_sql,update_sql from information_schema.columns where table_schema='public' and table_name=tab;
  if before_data is null or before_data='null'::jsonb then
   execute format('insert into public.%I (%s) select %s from jsonb_populate_record(null::public.%I,$1) r',tab,columns_sql,values_sql,tab) using row_data;
  else
   execute format('select to_jsonb(t) from public.%I t where id=$1 for update',tab) into current_row using (row_data->>'id')::uuid;
   if current_row is null then raise exception 'PERMISSION_DENIED'; end if;
   if tab='content_blocks' and current_row->>'version'<>before_data->>'version' then raise exception 'CONTENT_VERSION_CONFLICT'; end if;
   if tab='maintenance_requests' and current_row->>'status'<>before_data->>'status' then raise exception 'INVALID_TRANSITION'; end if;
   if tab='invites' and (current_row->>'claimed_at' is distinct from before_data->>'claimed_at' or current_row->>'revoked_at' is distinct from before_data->>'revoked_at') then raise exception 'INVITE_UNAVAILABLE'; end if;
   execute format('update public.%I t set %s from jsonb_populate_record(null::public.%I,$1) r where t.id=r.id',tab,update_sql,tab) using row_data;
  end if;
 end loop;
end $$;
create function public.new_profile() returns trigger language plpgsql security definer set search_path=public as $$ begin insert into profiles(id,display_name) values(new.id,coalesce(new.raw_user_meta_data->>'display_name','New resident'));return new;end $$;
create trigger auth_profile after insert on auth.users for each row execute function new_profile();
revoke all on function resolve_invite(text),claim_invite(text),resident_content(),search_home_content(uuid,text),apply_roomly_changes(jsonb) from public;
grant execute on function resolve_invite(text) to anon,authenticated;
grant execute on function claim_invite(text),resident_content(),search_home_content(uuid,text),apply_roomly_changes(jsonb) to authenticated;

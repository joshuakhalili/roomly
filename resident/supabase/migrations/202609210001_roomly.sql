-- Roomly schema: UUID tenancy records and separately published content snapshots.

create extension if not exists pgcrypto;

create table public.profiles (id uuid primary key references auth.users(id) on delete cascade, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), display_name text not null, preferred_name text, pronouns text, locale text not null default 'en-GB', notification_preference text not null default 'email' check(notification_preference in ('email','none')));

create table public.organisations (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), name text not null, slug text not null unique, created_by uuid not null references profiles(id));

create table public.organisation_members (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), organisation_id uuid not null references organisations(id), profile_id uuid not null references profiles(id), role text not null check(role in ('owner','manager','staff')), unique(organisation_id,profile_id));

create table public.properties (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), organisation_id uuid not null references organisations(id), name text not null, address_line_1 text not null, address_line_2 text not null default '', city text not null, postcode text not null, country_code text not null default 'GB', timezone text not null default 'Europe/London', property_type text not null check(property_type in ('shared_house','student_house','coliving','other')), published_at timestamptz);

create table public.rooms (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), property_id uuid not null references properties(id), name text not null, capacity integer not null check(capacity between 1 and 100), manager_contact_json jsonb not null, emergency_contact_json jsonb not null, default_locale text not null default 'en-GB', supported_locales text[] not null default '{en-GB}', languages_reviewed boolean not null default false);

create table public.memberships (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), room_id uuid not null references rooms(id), profile_id uuid not null references profiles(id), status text not null check(status in ('invited','active','ended')), move_in_at timestamptz, move_out_at timestamptz, onboarding_completed_at timestamptz, onboarding_step integer not null default 2 check(onboarding_step between 0 and 7), unique(room_id,profile_id));

create table public.invites (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), room_id uuid not null references rooms(id), created_by uuid not null references profiles(id), invitee_email text, token_hash text not null unique, expires_at timestamptz not null, claimed_at timestamptz, revoked_at timestamptz);

create table public.content_blocks (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), room_id uuid not null references rooms(id), kind text not null check(kind in ('welcome','essential','agreement','person','first_week','resource','faq','local_place','safety','access')), title text not null, body text not null, data jsonb not null default '{}', position integer not null, visibility text not null check(visibility in ('invitee','member','scheduled','manager_only')), visible_from timestamptz, required_acknowledgement boolean not null default false, status text not null check(status in ('draft','published','archived')), source_type text not null check(source_type in ('manual','imported','ai_draft','approved_answer')), source_excerpt text, owner_id uuid not null references profiles(id), verified_at timestamptz, published_at timestamptz, version integer not null default 1, published_version integer, published_snapshot jsonb, check(kind <> 'access' or visibility in ('member','scheduled')));

create table public.content_versions (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), content_block_id uuid not null references content_blocks(id), version integer not null, snapshot jsonb not null, changed_by uuid not null references profiles(id), change_reason text not null, unique(content_block_id,version));

create table public.translations (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), content_block_id uuid not null references content_blocks(id), locale text not null, title text not null, body text not null, data jsonb not null default '{}', status text not null check(status in ('draft','reviewed','published')), reviewed_by uuid references profiles(id), source_version integer not null, published_snapshot jsonb, unique(content_block_id,locale));

create table public.acknowledgements (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), membership_id uuid not null references memberships(id), content_block_id uuid not null references content_blocks(id), content_version integer not null, acknowledged_at timestamptz not null default now(), unique(membership_id,content_block_id,content_version));

create table public.onboarding_tasks (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), room_id uuid not null references rooms(id), title text not null, description text not null, position integer not null, required boolean not null default false, completion_kind text not null check(completion_kind in ('manual','acknowledgement','visit','manager_confirmed')));

create table public.onboarding_task_completions (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), membership_id uuid not null references memberships(id), onboarding_task_id uuid not null references onboarding_tasks(id), completed_at timestamptz not null default now(), unique(membership_id,onboarding_task_id));

create table public.question_logs (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), membership_id uuid not null references memberships(id), room_id uuid not null references rooms(id), question_redacted text not null, category text not null, outcome text not null check(outcome in ('answered','unknown','escalated','blocked')), cited_block_ids uuid[] not null default '{}', feedback text check(feedback in ('helpful','not_helpful')));

create table public.ai_runs (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), organisation_id uuid not null references organisations(id), room_id uuid not null references rooms(id), actor_id uuid not null references profiles(id), purpose text not null check(purpose in ('content_extract','rewrite','translate','answer','maintenance_triage')), provider text not null, model text not null, input_hash text not null, status text not null, latency_ms integer not null default 0, result_metadata jsonb not null default '{}', error_code text);

create table public.ai_suggestions (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), ai_run_id uuid not null references ai_runs(id), room_id uuid not null references rooms(id), kind text not null, proposed_data jsonb not null, source_excerpt text not null, status text not null check(status in ('pending','accepted','edited','rejected')), reviewed_by uuid references profiles(id), reviewed_at timestamptz);

create table public.maintenance_requests (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), room_id uuid not null references rooms(id), membership_id uuid not null references memberships(id), title text not null, description text not null, location text not null, category text not null check(category in ('plumbing','electrical','heating','appliance','access','safety','other')), priority text not null check(priority in ('low','normal','high','emergency')), status text not null check(status in ('draft','submitted','acknowledged','scheduled','in_progress','resolved','closed')), availability_json jsonb not null, assigned_to text);

create table public.maintenance_attachments (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), maintenance_request_id uuid not null references maintenance_requests(id), storage_path text not null, mime_type text not null check(mime_type in ('image/jpeg','image/png','application/pdf')), size_bytes integer not null check(size_bytes between 1 and 5242880), name text not null);

create table public.maintenance_events (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), maintenance_request_id uuid not null references maintenance_requests(id), actor_id uuid references profiles(id), event_type text not null, note text not null, resident_visible boolean not null default true);

create table public.manager_onboarding (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), profile_id uuid not null unique references profiles(id), step integer not null default 0, organisation_id uuid references organisations(id), property_id uuid references properties(id), room_id uuid references rooms(id), values jsonb not null default '{}', completed boolean not null default false);

create function public.touch_updated_at() returns trigger language plpgsql set search_path=public as $$ begin new.updated_at=now(); return new; end $$;

alter table public.profiles enable row level security;

create trigger profiles_updated before update on public.profiles for each row execute function public.touch_updated_at();

alter table public.organisations enable row level security;

create trigger organisations_updated before update on public.organisations for each row execute function public.touch_updated_at();

create index organisations_created_by_idx on public.organisations (created_by);

alter table public.organisation_members enable row level security;

create trigger organisation_members_updated before update on public.organisation_members for each row execute function public.touch_updated_at();

create index organisation_members_organisation_id_idx on public.organisation_members (organisation_id);

create index organisation_members_profile_id_idx on public.organisation_members (profile_id);

alter table public.properties enable row level security;

create trigger properties_updated before update on public.properties for each row execute function public.touch_updated_at();

create index properties_organisation_id_idx on public.properties (organisation_id);

alter table public.rooms enable row level security;

create trigger rooms_updated before update on public.rooms for each row execute function public.touch_updated_at();

create index rooms_property_id_idx on public.rooms (property_id);

alter table public.memberships enable row level security;

create trigger memberships_updated before update on public.memberships for each row execute function public.touch_updated_at();

create index memberships_room_id_idx on public.memberships (room_id);

create index memberships_profile_id_idx on public.memberships (profile_id);

alter table public.invites enable row level security;

create trigger invites_updated before update on public.invites for each row execute function public.touch_updated_at();

create index invites_room_id_idx on public.invites (room_id);

create index invites_created_by_idx on public.invites (created_by);

alter table public.content_blocks enable row level security;

create trigger content_blocks_updated before update on public.content_blocks for each row execute function public.touch_updated_at();

create index content_blocks_room_id_idx on public.content_blocks (room_id);

create index content_blocks_owner_id_idx on public.content_blocks (owner_id);

alter table public.content_versions enable row level security;

create trigger content_versions_updated before update on public.content_versions for each row execute function public.touch_updated_at();

create index content_versions_content_block_id_idx on public.content_versions (content_block_id);

create index content_versions_changed_by_idx on public.content_versions (changed_by);

alter table public.translations enable row level security;

create trigger translations_updated before update on public.translations for each row execute function public.touch_updated_at();

create index translations_content_block_id_idx on public.translations (content_block_id);

create index translations_reviewed_by_idx on public.translations (reviewed_by);

alter table public.acknowledgements enable row level security;

create trigger acknowledgements_updated before update on public.acknowledgements for each row execute function public.touch_updated_at();

create index acknowledgements_membership_id_idx on public.acknowledgements (membership_id);

create index acknowledgements_content_block_id_idx on public.acknowledgements (content_block_id);

alter table public.onboarding_tasks enable row level security;

create trigger onboarding_tasks_updated before update on public.onboarding_tasks for each row execute function public.touch_updated_at();

create index onboarding_tasks_room_id_idx on public.onboarding_tasks (room_id);

alter table public.onboarding_task_completions enable row level security;

create trigger onboarding_task_completions_updated before update on public.onboarding_task_completions for each row execute function public.touch_updated_at();

create index onboarding_task_completions_membership_id_idx on public.onboarding_task_completions (membership_id);

create index onboarding_task_completions_onboarding_task_id_idx on public.onboarding_task_completions (onboarding_task_id);

alter table public.question_logs enable row level security;

create trigger question_logs_updated before update on public.question_logs for each row execute function public.touch_updated_at();

create index question_logs_membership_id_idx on public.question_logs (membership_id);

create index question_logs_room_id_idx on public.question_logs (room_id);

alter table public.ai_runs enable row level security;

create trigger ai_runs_updated before update on public.ai_runs for each row execute function public.touch_updated_at();

create index ai_runs_organisation_id_idx on public.ai_runs (organisation_id);

create index ai_runs_room_id_idx on public.ai_runs (room_id);

create index ai_runs_actor_id_idx on public.ai_runs (actor_id);

alter table public.ai_suggestions enable row level security;

create trigger ai_suggestions_updated before update on public.ai_suggestions for each row execute function public.touch_updated_at();

create index ai_suggestions_ai_run_id_idx on public.ai_suggestions (ai_run_id);

create index ai_suggestions_room_id_idx on public.ai_suggestions (room_id);

create index ai_suggestions_reviewed_by_idx on public.ai_suggestions (reviewed_by);

alter table public.maintenance_requests enable row level security;

create trigger maintenance_requests_updated before update on public.maintenance_requests for each row execute function public.touch_updated_at();

create index maintenance_requests_room_id_idx on public.maintenance_requests (room_id);

create index maintenance_requests_membership_id_idx on public.maintenance_requests (membership_id);

alter table public.maintenance_attachments enable row level security;

create trigger maintenance_attachments_updated before update on public.maintenance_attachments for each row execute function public.touch_updated_at();

create index maintenance_attachments_maintenance_request_id_idx on public.maintenance_attachments (maintenance_request_id);

alter table public.maintenance_events enable row level security;

create trigger maintenance_events_updated before update on public.maintenance_events for each row execute function public.touch_updated_at();

create index maintenance_events_maintenance_request_id_idx on public.maintenance_events (maintenance_request_id);

create index maintenance_events_actor_id_idx on public.maintenance_events (actor_id);

alter table public.manager_onboarding enable row level security;

create trigger manager_onboarding_updated before update on public.manager_onboarding for each row execute function public.touch_updated_at();

create index manager_onboarding_organisation_id_idx on public.manager_onboarding (organisation_id);

create index manager_onboarding_property_id_idx on public.manager_onboarding (property_id);

create index manager_onboarding_room_id_idx on public.manager_onboarding (room_id);

create index memberships_active_profile on memberships(profile_id,room_id) where status='active';

create index content_published_room_position on content_blocks(room_id,position) where published_snapshot is not null;

create index content_search on content_blocks using gin (to_tsvector('simple',coalesce(published_snapshot->>'title','') || ' ' || coalesce(published_snapshot->>'body','')));

create index maintenance_open_room on maintenance_requests(room_id,status) where status not in ('resolved','closed');

create index questions_unanswered_room on question_logs(room_id) where outcome <> 'answered';

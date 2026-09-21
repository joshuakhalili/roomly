alter table rooms alter column unit_type set default 'room';

insert into unit_area_defaults (organization_id, unit_type, area_type_id, sort_order)
select organization_id, 'room', id, sort_order
from area_types
where name = 'Bedroom'
on conflict (organization_id, unit_type, area_type_id) do nothing;

create or replace function scaffold_checklist(p_checklist_id uuid, p_unit_type unit_type)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  checklist_organization_id uuid;
  d record;
  new_area_id uuid;
  i int := 0;
begin
  select organization_id into checklist_organization_id
  from inventory_checklists
  where id = p_checklist_id;

  if checklist_organization_id is null then
    raise exception 'Checklist does not exist or has no organisation'
      using errcode = '23503';
  end if;

  if coalesce(auth.role(), '') <> 'service_role'
     and not can_write_organization(checklist_organization_id) then
    raise exception 'Not permitted to scaffold this checklist'
      using errcode = '42501';
  end if;

  for d in
    select at.id as area_type_id, at.name, uad.sort_order
    from unit_area_defaults uad
    join area_types at on at.id = uad.area_type_id
    where uad.organization_id = checklist_organization_id
      and uad.unit_type = p_unit_type
    order by uad.sort_order
  loop
    i := i + 1;
    insert into checklist_areas
      (checklist_id, area_type_id, name, sort_order, organization_id)
    values
      (p_checklist_id, d.area_type_id, d.name, i, checklist_organization_id)
    returning id into new_area_id;

    insert into checklist_sections
      (checklist_area_id, section_template_id, section_name, sort_order, organization_id)
    select new_area_id, cst.id, cst.section_name, cst.sort_order,
           checklist_organization_id
    from checklist_section_templates cst
    where cst.organization_id = checklist_organization_id
      and cst.area_type_id = d.area_type_id
    order by cst.sort_order;
  end loop;
end;
$$;

revoke all on function scaffold_checklist(uuid, unit_type) from public, anon;
grant execute on function scaffold_checklist(uuid, unit_type) to authenticated;

create or replace function create_room_baseline()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_checklist_id uuid;
begin
  if new.is_lettable or new.is_common_area then
    insert into inventory_checklists (room_id, type, status, organization_id)
    values (new.id, 'baseline', 'draft', new.organization_id)
    returning id into new_checklist_id;

    perform scaffold_checklist(new_checklist_id, new.unit_type);
  end if;
  return new;
end;
$$;

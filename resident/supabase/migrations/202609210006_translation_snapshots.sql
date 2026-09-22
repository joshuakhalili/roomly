-- Residents receive only the released translation, never a working translation row.
create or replace function public.resident_content() returns setof jsonb language sql stable security definer set search_path=public as $$
 select released.doc || jsonb_build_object('id',b.id,'room_id',b.room_id,'created_at',b.created_at,'updated_at',b.updated_at,'published_snapshot',released.doc,'published_version',b.published_version)
 from content_blocks b
 left join profiles p on p.id=auth.uid()
 left join translations t on t.content_block_id=b.id and t.locale=p.locale and (t.published_snapshot->>'source_version')::integer=b.published_version
 cross join lateral (select b.published_snapshot || case when t.published_snapshot is not null then jsonb_build_object('title',t.published_snapshot->>'title','body',t.published_snapshot->>'body','data',t.published_snapshot->'data') else '{}'::jsonb end as doc) released
 where block_visible(b.id)
$$;

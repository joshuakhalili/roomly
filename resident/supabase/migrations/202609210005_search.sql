-- Rank only authorised published, locale-selected sources. All matching happens after visibility filtering.
drop function public.search_home_content(uuid,text);
create function public.search_home_content(room uuid,question text,requested_locale text default 'en-GB') returns setof jsonb language sql stable security definer set search_path=public as $$
 with documents as (
 select b.id, b.published_snapshot || case when t.id is not null then jsonb_build_object('title',t.published_snapshot->>'title','body',t.published_snapshot->>'body','data',t.published_snapshot->'data') else '{}'::jsonb end as doc
 from content_blocks b left join translations t on t.content_block_id=b.id and t.locale=requested_locale and t.published_snapshot is not null and (t.published_snapshot->>'source_version')::integer=b.published_version
 where b.room_id=room and block_visible(b.id)
 ), query as (select websearch_to_tsquery('english',regexp_replace(question,'\s+',' OR ','g')) as term)
 select doc||jsonb_build_object('id',id) from documents,query
 where to_tsvector('english',coalesce(doc->>'title','')||' '||coalesce(doc->>'body','')) @@ term
 order by ts_rank(setweight(to_tsvector('english',coalesce(doc->>'title','')),'A')||setweight(to_tsvector('english',coalesce(doc->>'body','')),'B'),term) desc limit 8
$$;
revoke all on function search_home_content(uuid,text,text) from public;
grant execute on function search_home_content(uuid,text,text) to authenticated;

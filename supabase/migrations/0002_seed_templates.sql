-- ═══════════════════════════════════════════════════════════════════════════
-- Inventory section templates
--
-- Section lists mirror a real professional Schedule of Condition report, so a
-- checklist built here covers the same ground a paid inventory clerk's would.
-- These are data, not code: adding a section to a room type is an INSERT.
-- ═══════════════════════════════════════════════════════════════════════════

insert into room_types (name, sort_order) values
  ('Studio',        1),
  ('Bedroom',       2),
  ('Kitchen',       3),
  ('Bathroom',      4),
  ('Living Room',   5),
  ('Entrance/Hallway', 6),
  ('Storeroom',     7),
  ('Common Area',   8);

-- Sections are inserted from an array per room type so the ordering column
-- doesn't have to be typed out by hand for every row.
do $$
declare
  rt_id uuid;
  spec  jsonb := '{
    "Studio": ["General Overview","Ceiling","Doors","Flooring","Heating","Lighting",
               "Switches/Sockets","Walls","Windows","Curtains/Blinds","Fixtures",
               "Furnishings","Kitchen Units","Worktops","Sink","Oven/Hob/Extractor Fan",
               "Fridge/Freezer","Bathroom Units","Bath/Shower","Toilet","Room Items"],
    "Bedroom": ["General Overview","Ceiling","Doors","Flooring","Heating","Lighting",
                "Switches/Sockets","Walls","Windows","Curtains/Blinds","Fixtures",
                "Furnishings","Bedroom Items"],
    "Kitchen": ["General Overview","Ceiling","Doors","Flooring","Kitchen Units","Lighting",
                "Oven/Hob/Extractor Fan","Switches/Sockets","Walls","Worktops",
                "Fridge/Freezer","Dishwasher","Washing Machine","Sink","Electricals",
                "Kitchen Items"],
    "Bathroom": ["General Overview","Bath/Shower","Bathroom Units","Ceiling","Doors",
                 "Flooring","Heating","Lighting","Sink","Toilet","Walls","Windows",
                 "Extractor Fan","Bathroom Items"],
    "Living Room": ["General Overview","Ceiling","Doors","Flooring","Heating","Lighting",
                    "Switches/Sockets","Walls","Windows","Curtains/Blinds","Fixtures",
                    "Furnishings","Table","TV"],
    "Entrance/Hallway": ["General Overview","Ceiling","Doors","Flooring","Heating",
                         "Lighting","Switches/Sockets","Walls","Furnishings"],
    "Storeroom": ["General Overview","Ceiling","Doors","Flooring","Furnishings",
                  "Tumble Dryer","Walls","Windows","Switches/Sockets"],
    "Common Area": ["General Overview","Ceiling","Doors","Flooring","Heating","Lighting",
                    "Switches/Sockets","Walls","Windows","Furnishings"]
  }'::jsonb;
  room_name text;
  sections  jsonb;
  i int;
begin
  for room_name, sections in select * from jsonb_each(spec) loop
    select id into rt_id from room_types where name = room_name;
    for i in 0 .. jsonb_array_length(sections) - 1 loop
      insert into checklist_section_templates (room_type_id, section_name, sort_order)
      values (rt_id, sections->>i, i + 1)
      on conflict (room_type_id, section_name) do nothing;
    end loop;
  end loop;
end $$;

-- ── Tenant message templates ───────────────────────────────────────────────
-- {{name}}, {{amount}}, {{date}}, {{room}} are replaced at send time.
-- Deliberately polite and non-accusatory: rent reminders only ever fire the
-- day AFTER the due date, so the tenant has had their full due day to pay.

insert into message_templates (template_key, language, body_text) values
  ('rent_reminder', 'en',
   'Hi {{name}}, this is a friendly reminder that rent of £{{amount}} for {{room}} was due on {{date}}. If you have already paid, please ignore this message. Thank you!'),
  ('rent_reminder', 'zh',
   '您好 {{name}}，温馨提醒：{{room}} 的租金 £{{amount}} 已于 {{date}} 到期。如您已付款，请忽略此消息。谢谢！'),

  ('rent_overdue', 'en',
   'Hi {{name}}, we have not yet received the rent of £{{amount}} for {{room}}, which was due on {{date}}. Could you let us know when you expect to make the payment? Thank you.'),
  ('rent_overdue', 'zh',
   '您好 {{name}}，我们尚未收到 {{room}} 于 {{date}} 到期的租金 £{{amount}}。请告知您预计的付款时间。谢谢。'),

  ('cleaning_reminder', 'en',
   'Hi {{name}}, as your tenancy at {{room}} ends on {{date}}, we will arrange a cleaning and inspection visit. Please make sure the room is cleared by then. Thank you!'),
  ('cleaning_reminder', 'zh',
   '您好 {{name}}，您在 {{room}} 的租约将于 {{date}} 结束，我们将安排清洁和检查。请在此之前清空房间。谢谢！'),

  ('move_in_welcome', 'en',
   'Hi {{name}}, welcome! Your tenancy at {{room}} begins on {{date}}. Please get in touch to arrange key collection and the check-in inventory.'),
  ('move_in_welcome', 'zh',
   '您好 {{name}}，欢迎！您在 {{room}} 的租约将于 {{date}} 开始。请联系我们安排领取钥匙和入住物品清点。'),

  ('move_out_reminder', 'en',
   'Hi {{name}}, your tenancy at {{room}} ends on {{date}}. We will carry out the check-out inventory then. Please ensure all belongings are removed and keys returned.'),
  ('move_out_reminder', 'zh',
   '您好 {{name}}，您在 {{room}} 的租约将于 {{date}} 结束。届时我们将进行退租物品清点。请确保带走所有物品并归还钥匙。');

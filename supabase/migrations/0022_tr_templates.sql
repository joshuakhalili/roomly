-- ═══════════════════════════════════════════════════════════════════════════
-- The tenant-facing messages, in Turkish
--
-- Separate from 0021 because that migration created the 'tr' enum value, and
-- Postgres will not let a new enum value be used in the transaction that
-- added it.
--
-- These are the five messages that actually reach a tenant — WhatsApp and
-- SMS, not interface text. pickTemplate falls back to English when a language
-- has no row, so without this a Turkish tenant would be greeted in Turkish by
-- the interface and then chased for rent in English.
--
-- Written to match the existing pairs in 0002: same placeholders, same tone,
-- addressed to the tenant rather than about them. The £ sign is left as-is
-- because these are UK lettings — a Turkish-speaking tenant in Sheffield is
-- still paying pounds.
--
-- NOTE: an AI-assisted first draft. Have a native speaker read these before
-- the first one is sent to a real tenant.
-- ═══════════════════════════════════════════════════════════════════════════

insert into message_templates (template_key, language, body_text) values
  ('rent_reminder', 'tr',
   'Merhaba {{name}}, {{room}} için £{{amount}} tutarındaki kiranın son ödeme tarihi {{date}} idi. Ödemeyi çoktan yaptıysanız bu mesajı dikkate almayın. Teşekkürler!'),

  ('rent_overdue', 'tr',
   'Merhaba {{name}}, {{room}} için son ödeme tarihi {{date}} olan £{{amount}} tutarındaki kirayı henüz almadık. Ödemeyi ne zaman yapabileceğinizi bize bildirir misiniz? Teşekkürler.'),

  ('cleaning_reminder', 'tr',
   'Merhaba {{name}}, {{room}} için kira sözleşmeniz {{date}} tarihinde sona erdiğinden temizlik ve kontrol için geleceğiz. Lütfen o tarihe kadar odayı boşaltmış olun. Teşekkürler!'),

  ('move_in_welcome', 'tr',
   'Merhaba {{name}}, hoş geldiniz! {{room}} için kira sözleşmeniz {{date}} tarihinde başlıyor. Anahtar teslimi ve giriş envanteri için lütfen bizimle iletişime geçin.'),

  ('move_out_reminder', 'tr',
   'Merhaba {{name}}, {{room}} için kira sözleşmeniz {{date}} tarihinde sona eriyor. O gün çıkış envanterini yapacağız. Lütfen tüm eşyalarınızı aldığınızdan ve anahtarları teslim ettiğinizden emin olun.')
on conflict (template_key, language) do nothing;

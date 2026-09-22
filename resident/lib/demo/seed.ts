import { createHash } from "node:crypto";
import { emptyState, type Block, type BlockContent } from "../model";
import { snapshot } from "../content";
export const ID = {
  manager: "00000000-0000-4000-8000-000000000001",
  resident: "00000000-0000-4000-8000-000000000002",
  newManager: "00000000-0000-4000-8000-000000000003",
  newResident: "00000000-0000-4000-8000-000000000004",
  org: "10000000-0000-4000-8000-000000000001",
  property: "20000000-0000-4000-8000-000000000001",
  room: "30000000-0000-4000-8000-000000000001",
  membership: "40000000-0000-4000-8000-000000000001",
};
export const hashToken = (t: string) =>
  createHash("sha256").update(t).digest("hex");
export function seed() {
  const s = emptyState();
  const now = new Date().toISOString();
  const base = (id: string) => ({ id, created_at: now, updated_at: now });
  s.profiles = Object.entries({
    [ID.manager]: "Elena",
    [ID.resident]: "Maya",
    [ID.newManager]: "New manager",
    [ID.newResident]: "New resident",
  }).map(([id, display_name]) => ({
    ...base(id),
    display_name,
    preferred_name: null,
    pronouns: null,
    locale: "en-GB",
    notification_preference: "email",
  }));
  s.organisations.push({
    ...base(ID.org),
    name: "Roomly Homes",
    slug: "roomly-homes",
    created_by: ID.manager,
  });
  s.organisation_members.push({
    ...base("11000000-0000-4000-8000-000000000001"),
    organisation_id: ID.org,
    profile_id: ID.manager,
    role: "owner",
  });
  s.properties.push({
    ...base(ID.property),
    organisation_id: ID.org,
    name: "Cambridge City House",
    address_line_1: "14 Willow Lane",
    address_line_2: "",
    city: "Cambridge",
    postcode: "CB1 1AB",
    country_code: "GB",
    timezone: "Europe/London",
    property_type: "shared_house",
    published_at: now,
  });
  s.rooms.push({
    ...base(ID.room),
    property_id: ID.property,
    name: "Room 3",
    capacity: 4,
    manager_contact_json: { name: "Elena", phone: "07700 900123" },
    emergency_contact_json: { phone: "07700 900124" },
    default_locale: "en-GB",
    supported_locales: ["en-GB", "zh-CN", "tr-TR"],
    languages_reviewed: true,
  });
  s.memberships.push({
    ...base(ID.membership),
    room_id: ID.room,
    profile_id: ID.resident,
    status: "active",
    move_in_at: now,
    move_out_at: null,
    onboarding_completed_at: now,
    onboarding_step: 7,
  });
  const rows: [BlockContent["kind"], string, string, string, string, string][] =
    [
      [
        "essential",
        "Your address",
        "14 Willow Lane, Cambridge, CB1 1AB",
        "address",
        "你的地址",
        "Adresiniz",
      ],
      [
        "essential",
        "Wi-Fi",
        "Network: Roomly-Guest. Ask Elena for the current password.",
        "wifi",
        "无线网络",
        "Wi-Fi",
      ],
      [
        "essential",
        "Your manager",
        "Elena · 07700 900123. Available Monday to Friday, 09:00–17:00.",
        "manager",
        "你的管理员",
        "Ev yöneticiniz",
      ],
      [
        "access",
        "Coming and going",
        "Elena will hand over your keys on your agreed move-in date. Do not share keys or entry details.",
        "access",
        "出入须知",
        "Giriş ve çıkış",
      ],
      [
        "safety",
        "Emergency support",
        "For immediate danger call 999 or 112. Home emergency contact: 07700 900124. For a suspected gas leak call 0800 111 999 from outside.",
        "emergency",
        "紧急援助",
        "Acil destek",
      ],
      [
        "resource",
        "Bins",
        "Put recycling in the blue bin and general waste in the black bin. Bins are collected on Tuesday; put them out on Monday evening.",
        "bins",
        "垃圾与回收",
        "Çöp ve geri dönüşüm",
      ],
      [
        "resource",
        "Repairs",
        "Report a repair in Roomly with a description, location and your availability. Elena will review it. For immediate danger, call 999.",
        "repairs",
        "维修",
        "Onarımlar",
      ],
      [
        "agreement",
        "Living well together",
        "Keep noise low between 22:00 and 08:00. Leave shared spaces ready for the next person. No smoking indoors.",
        "rules",
        "共同生活",
        "Birlikte yaşam",
      ],
      [
        "faq",
        "Guests",
        "Guests are welcome. Let your housemates know in advance and ask Elena before an overnight stay.",
        "guests",
        "访客",
        "Misafirler",
      ],
      [
        "local_place",
        "A little fresh air",
        "Parker’s Piece is a nearby green space. Ask Elena for walking directions.",
        "local",
        "附近的绿地",
        "Biraz temiz hava",
      ],
      [
        "local_place",
        "Your local essentials",
        "Mill Road has groceries and household essentials. Check opening hours before visiting.",
        "local",
        "附近的生活用品",
        "Yakındaki ihtiyaçlar",
      ],
      [
        "local_place",
        "Find a quiet corner",
        "Cambridge Central Library offers a place to read and study. Check current opening hours.",
        "local",
        "安静的角落",
        "Sessiz bir köşe",
      ],
      [
        "faq",
        "Post and deliveries",
        "Your post goes in the hallway tray. Please collect it regularly.",
        "post",
        "邮件与快递",
        "Posta ve teslimatlar",
      ],
      [
        "faq",
        "Shared kitchen",
        "Label your food and clean the hob and worktop after cooking.",
        "kitchen",
        "共用厨房",
        "Ortak mutfak",
      ],
      [
        "person",
        "People at home",
        "Elena is your home manager. Introduce yourself to your housemates when you feel ready.",
        "people",
        "家里的人",
        "Evdeki kişiler",
      ],
      [
        "resource",
        "Home documents",
        "Your checked house agreements are in this guide. Contact Elena for tenancy documents.",
        "documents",
        "家居文件",
        "Ev belgeleri",
      ],
    ];
  const zh = [
    "14 Willow Lane, Cambridge, CB1 1AB",
    "网络：Roomly-Guest。请向 Elena 索取当前密码。",
    "Elena · 07700 900123。周一至周五 09:00–17:00。",
    "Elena 会在约定的入住日交给你钥匙。请勿分享钥匙或门禁信息。",
    "如有紧急危险，请拨打 999 或 112。房屋紧急联系人：07700 900124。如怀疑燃气泄漏，请到室外拨打 0800 111 999。",
    "回收物放入蓝色垃圾桶，普通垃圾放入黑色垃圾桶。周二收垃圾，请在周一晚上放到外面。",
    "在 Roomly 报修时，请填写问题、位置和可联系时间。Elena 会查看。如有紧急危险，请拨打 999。",
    "22:00 至 08:00 请保持安静。使用后整理公共区域。室内禁止吸烟。",
    "欢迎访客。请提前告知室友，留宿前请先询问 Elena。",
    "Parker’s Piece 是附近的绿地。步行路线请询问 Elena。",
    "Mill Road 有食品和生活用品商店。前往之前请确认营业时间。",
    "Cambridge Central Library 提供阅读和学习空间。请确认当前开放时间。",
    "邮件放在走廊托盘中。请定期领取。",
    "请给食物贴上标签，做饭后清洁灶台和台面。",
    "Elena 是你的房屋管理员。准备好时，可以向室友介绍自己。",
    "已核实的房屋公约在本指南中。租赁文件请联系 Elena。",
  ];
  const tr = [
    "14 Willow Lane, Cambridge, CB1 1AB",
    "Ağ: Roomly-Guest. Güncel şifreyi Elena’dan isteyin.",
    "Elena · 07700 900123. Pazartesi–Cuma, 09:00–17:00.",
    "Elena anahtarları kararlaştırılan taşınma gününde teslim edecek. Anahtarları veya giriş bilgilerini paylaşmayın.",
    "Acil tehlikede 999 veya 112’yi arayın. Ev acil irtibatı: 07700 900124. Gaz kaçağı şüphesinde dışarıdan 0800 111 999’u arayın.",
    "Geri dönüşümü mavi, genel atıkları siyah kutuya koyun. Çöpler salı günü toplanır; pazartesi akşamı dışarı çıkarın.",
    "Roomly’de açıklama, konum ve uygun olduğunuz saatlerle onarım bildirin. Elena inceleyecek. Acil tehlikede 999’u arayın.",
    "22:00–08:00 arasında sessiz olun. Ortak alanları temiz bırakın. İçeride sigara içilmez.",
    "Misafirler kabul edilir. Ev arkadaşlarınıza önceden haber verin; gece kalmaları için Elena’ya danışın.",
    "Parker’s Piece yakın bir yeşil alandır. Yürüyüş yolu için Elena’ya danışın.",
    "Mill Road üzerinde marketler vardır. Gitmeden önce çalışma saatlerini kontrol edin.",
    "Cambridge Central Library okuma ve çalışma alanı sunar. Güncel saatleri kontrol edin.",
    "Postanız koridordaki tepsidedir. Düzenli olarak alın.",
    "Yiyeceklerinizi etiketleyin, yemek sonrası ocağı ve tezgâhı temizleyin.",
    "Elena ev yöneticinizdir. Hazır olduğunuzda ev arkadaşlarınıza kendinizi tanıtın.",
    "Onaylı ev kuralları bu rehberdedir. Kira belgeleri için Elena ile görüşün.",
  ];
  rows.forEach(([kind, title, body, key, zt, tt], i) => {
    const id = `50000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`;
    const b: Block = {
      ...base(id),
      room_id: ID.room,
      kind,
      title,
      body,
      data: { key, sensitive: ["wifi", "access"].includes(key) },
      position: i,
      visibility: "member",
      visible_from: null,
      required_acknowledgement: kind === "agreement",
      status: "published",
      source_type: "manual",
      source_excerpt: null,
      owner_id: ID.manager,
      verified_at: now,
      published_at: now,
      version: 1,
      published_version: 1,
      published_snapshot: null,
    };
    b.published_snapshot = snapshot(b);
    s.content_blocks.push(b);
    s.content_versions.push({
      ...base(`51000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`),
      content_block_id: id,
      version: 1,
      snapshot: snapshot(b),
      changed_by: ID.manager,
      change_reason: "Initial verified content",
    });
    for (const [j, locale, t, bdy] of [
      [1, "zh-CN", zt, zh[i]],
      [2, "tr-TR", tt, tr[i]],
    ] as const)
      s.translations.push({
        ...base(
          `52000000-0000-4000-800${j}-${String(i + 1).padStart(12, "0")}`,
        ),
        content_block_id: id,
        locale,
        title: t,
        body: bdy,
        data: b.data,
        status: "published",
        reviewed_by: ID.manager,
        source_version: 1,
        published_snapshot: {
          title: t,
          body: bdy,
          data: b.data,
          source_version: 1,
        },
      });
  });
  [
    "Save your address",
    "Introduce yourself",
    "Locate the bins",
    "Understand repair reporting",
  ].forEach((title, i) =>
    s.onboarding_tasks.push({
      ...base(`60000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`),
      room_id: ID.room,
      title,
      description: "A small step to help you settle in.",
      position: i,
      required: false,
      completion_kind: "manual",
    }),
  );
  const repairId = "70000000-0000-4000-8000-000000000001";
  s.maintenance_requests.push({
    ...base(repairId),
    room_id: ID.room,
    membership_id: ID.membership,
    title: "Kitchen tap dripping",
    description: "The kitchen tap drips after it is turned off.",
    location: "Shared kitchen",
    category: "plumbing",
    priority: "normal",
    status: "acknowledged",
    availability_json: { notes: "Weekdays after 16:00" },
    assigned_to: null,
  });
  s.maintenance_events.push({
    ...base("71000000-0000-4000-8000-000000000001"),
    maintenance_request_id: repairId,
    actor_id: ID.manager,
    event_type: "acknowledged",
    note: "Thanks Maya. I have received your report and am checking the next step.",
    resident_visible: true,
  });
  const runId = "80000000-0000-4000-8000-000000000001";
  s.ai_runs.push({
    ...base(runId),
    organisation_id: ID.org,
    room_id: ID.room,
    actor_id: ID.manager,
    purpose: "content_extract",
    provider: "demo",
    model: "deterministic-v1",
    input_hash: hashToken("demo-notes"),
    status: "success",
    latency_ms: 0,
    result_metadata: { count: 3 },
    error_code: null,
  });
  [
    "Keep the hallway clear for everyone.",
    "Guests should use the doorbell.",
    "Store bicycles in the rear yard.",
  ].forEach((body, i) =>
    s.ai_suggestions.push({
      ...base(`81000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`),
      room_id: ID.room,
      ai_run_id: runId,
      kind: "faq",
      proposed_data: {
        kind: "faq",
        title: ["Hallway", "Guest arrivals", "Bicycle storage"][i],
        body,
        data: {},
        visibility: "member",
        sourceExcerpt: body,
        warnings: [],
      },
      source_excerpt: body,
      status: "pending",
      reviewed_by: null,
      reviewed_at: null,
    }),
  );
  const agreement = s.content_blocks.find((b) => b.required_acknowledgement)!;
  s.acknowledgements.push({
    ...base("90000000-0000-4000-8000-000000000001"),
    membership_id: ID.membership,
    content_block_id: agreement.id,
    content_version: 1,
    acknowledged_at: now,
  });
  return s;
}

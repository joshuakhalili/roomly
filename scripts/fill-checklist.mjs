/**
 * Fills one baseline inventory checklist with the kind of content a real
 * inspection produces — ratings on every section, notes where a note is
 * warranted, two genuine defects, meter readings, keys, detectors and signed
 * declarations — so the screenshots show the system working rather than an
 * empty form.
 *
 * Deliberately not uniform. Everything "Excellent" is a form nobody filled in;
 * a real inspection has a couple of Fairs, one Poor, and notes only where
 * there is something to say.
 *
 * Run it after `seed-demo.ts`, which wipes the checklists along with everything
 * else. Safe to re-run: the ratings are overwritten and the meters, keys,
 * detectors and declarations are cleared first so they do not stack up.
 *
 *   node --env-file=.env.local scripts/fill-checklist.mjs
 */
import { createClient } from "@supabase/supabase-js";

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const CHECKLIST =
  process.env.CHECKLIST_ID ?? "83fb26c3-a512-4d84-a552-0e43e74aeafd"; // Marlow House, Room 1

// Keyed by "Area · Section", using the real template names. Keying on the
// section name alone put the same window note into three different rooms,
// which reads as a form filled in by a machine — which it was.
const NOTES = {
  "Bedroom · General Overview": ["good", "good", "Redecorated before this letting. Neutral throughout, no marks beyond light wear.", false],
  "Bedroom · Walls": ["fair", "good", "Two filled-and-painted patches behind the door. Colour match is close but visible in daylight.", false],
  "Bedroom · Windows": ["poor", "good", "Trickle vent on the left casement is painted shut and the handle does not engage the second catch. Reported for repair before move-in.", true],
  "Bedroom · Flooring": ["fair", "fair", "Engineered oak. Scuffing along the traffic line from door to window; consistent with normal use, not damage.", false],
  "Bedroom · Lighting": ["excellent", "excellent", "Ceiling pendant and one bedside wall light, both LED, both working.", false],
  "Bedroom · Switches/Sockets": ["good", "excellent", "Four double sockets, all tested.", false],
  "Bedroom · Heating": ["good", "good", "Thermostatic valve turns freely. Radiator bled at inspection.", false],
  "Bedroom · Bedroom Items": ["excellent", "excellent", "Double divan, mattress protector fitted and unopened. Bedside table and lamp.", false],

  "Kitchen · Oven/Hob/Extractor Fan": ["good", "good", "Professionally cleaned before the letting. Two shelves and one grill pan.", false],
  "Kitchen · Worktops": ["good", "excellent", null, false],
  "Kitchen · Sink": ["good", "good", "Slow drain at the plughole; cleared at inspection and running freely.", false],
  "Kitchen · Fridge/Freezer": ["excellent", "excellent", "Frost-free, cleaned and left running.", false],
  "Kitchen · Washing Machine": ["good", "good", "Filter checked and clear.", false],
  "Kitchen · Kitchen Units": ["good", "good", null, false],

  "Bathroom · Bath/Shower": ["fair", "fair", "Grout along the bottom row of tiles is discoloured. Cleaned but not restored; monitor at the next inspection.", false],
  "Bathroom · Extractor Fan": ["poor", "fair", "Runs, but slowly, and the cover is heavily dusted. Booked in with the electrician for 4 September.", true],
  "Bathroom · Sink": ["good", "excellent", "Sealant sound but discoloured at the tap end.", false],
  "Bathroom · Toilet": ["good", "good", null, false],

  "Living Room · Flooring": ["fair", "good", "Two shallow indentations near the window where furniture has stood. Noted so they are not charged at check-out.", false],
  "Living Room · Curtains/Blinds": ["poor", "good", "Left blind does not hold position and slips when raised. Replacement ordered.", true],
  "Living Room · TV": ["good", "good", "43\" wall-mounted. Remote and one HDMI lead supplied.", false],
  "Living Room · Furnishings": ["good", "good", "Two-seat sofa and armchair, both fire-label checked.", false],

  "Entrance/Hallway · Doors": ["good", "excellent", "Front door closes and latches cleanly. Two keys supplied and both tested.", false],
  "Entrance/Hallway · Lighting": ["excellent", "excellent", "Motion-sensor fitting, tested.", false],
};

const FALLBACK = ["good", "good", null, false];
const TODAY = new Date();
const iso = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const entryDate = iso(new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate() - 12));

const { data: areas, error: areaErr } = await db
  .from("checklist_areas")
  .select("id, name, checklist_sections(id, section_name)")
  .eq("checklist_id", CHECKLIST);
if (areaErr) throw new Error(areaErr.message);

let filled = 0;
let flagged = 0;
for (const area of areas) {
  for (const s of area.checklist_sections) {
    const key = `${area.name} · ${s.section_name}`;
    const [condition, cleanliness, description, flag] = NOTES[key] ?? FALLBACK;
    const { error } = await db
      .from("checklist_sections")
      .update({
        condition_rating: condition,
        cleanliness_rating: cleanliness,
        description,
        flagged_for_maintenance: flag,
        entry_date: entryDate,
      })
      .eq("id", s.id);
    if (error) throw new Error(`section ${s.section_name}: ${error.message}`);
    filled++;
    if (flag) flagged++;
  }
}
console.log(`  ${filled} sections rated across ${areas.length} areas, ${flagged} flagged for maintenance`);

// Wipe-and-set, so re-running does not stack duplicates.
for (const t of ["checklist_meters", "checklist_keys", "checklist_detectors", "checklist_declarations"]) {
  await db.from(t).delete().eq("checklist_id", CHECKLIST);
}

await db.from("checklist_meters").insert([
  { checklist_id: CHECKLIST, meter_type: "electricity", reading: "41827.6", reading_date: entryDate, location: "Hallway cupboard", serial_number: "K19-884213" },
  { checklist_id: CHECKLIST, meter_type: "gas", reading: "9042.1", reading_date: entryDate, location: "External box, front elevation", serial_number: "G4-1180773" },
  { checklist_id: CHECKLIST, meter_type: "water", reading: "00318", reading_date: entryDate, location: "Under kitchen sink", serial_number: "W-22K4471" },
]);

await db.from("checklist_keys").insert([
  { checklist_id: CHECKLIST, description: "Front door (communal)", quantity: 2, comments: "Both tested at handover." },
  { checklist_id: CHECKLIST, description: "Room door", quantity: 2, comments: null },
  { checklist_id: CHECKLIST, description: "Window restrictor key", quantity: 1, comments: "Kept in the kitchen drawer." },
  { checklist_id: CHECKLIST, description: "Post box", quantity: 1, comments: null },
]);

await db.from("checklist_detectors").insert([
  { checklist_id: CHECKLIST, detector_type: "smoke", location: "Hallway ceiling", tested: true, comments: "Test button pressed, alarm sounded." },
  { checklist_id: CHECKLIST, detector_type: "smoke", location: "Bedroom ceiling", tested: true, comments: null },
  { checklist_id: CHECKLIST, detector_type: "co", location: "Kitchen, 1.5m from the hob", tested: true, comments: "Sealed unit, expires 2031." },
]);

await db.from("checklist_declarations").insert([
  { checklist_id: CHECKLIST, role: "assessor", typed_name: "A. Whitfield", email: "inspections@example.com", signed_at: new Date(`${entryDate}T11:20:00.000Z`).toISOString() },
  { checklist_id: CHECKLIST, role: "tenant", typed_name: "Mei Lindqvist", email: "mei.lindqvist@example.com", signed_at: new Date(`${entryDate}T11:34:00.000Z`).toISOString() },
]);
console.log("  3 meter readings, 4 sets of keys, 3 detectors, 2 signed declarations");

const { error: doneErr } = await db
  .from("inventory_checklists")
  .update({ status: "completed", assessor_name: "A. Whitfield", completed_at: new Date(`${entryDate}T11:34:00.000Z`).toISOString() })
  .eq("id", CHECKLIST);
if (doneErr) throw new Error(doneErr.message);
console.log("  checklist marked completed");

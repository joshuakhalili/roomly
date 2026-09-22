import { randomBytes, randomUUID } from "node:crypto";
import { contracts, type Operation } from "./contracts";
import type { Actor, Block, BlockContent, State } from "./model";
import {
  DomainError,
  requireManager,
  ownMembership,
  membership,
  residentBlocks,
  visibleBlocks,
} from "./permissions";
import { hashToken } from "./demo/seed";
import { agreementsComplete, checkVersion, snapshot } from "./content";
import { readiness } from "./readiness";
import {
  type AIProvider,
  groundedAnswer,
  redact,
  suggestionSchema,
  validateTranslation,
  safeForAI,
} from "./ai/provider";
import { triage, validateTransition } from "./maintenance";
const now = () => new Date().toISOString();
export const base = () => ({
  id: randomUUID(),
  created_at: now(),
  updated_at: now(),
});
function found<T>(value: T | undefined): T {
  if (!value) throw new DomainError("NOT_FOUND", "This item is not available.");
  return value;
}
function addBlock(
  s: State,
  a: Actor,
  roomId: string,
  content: Partial<BlockContent> & {
    title: string;
    body: string;
    kind: BlockContent["kind"];
  },
) {
  const b: Block = {
    ...base(),
    room_id: roomId,
    kind: content.kind,
    title: content.title,
    body: content.body,
    data: content.data || {},
    position: s.content_blocks.filter((b) => b.room_id === roomId).length,
    visibility: content.visibility || "member",
    visible_from: content.visible_from || null,
    required_acknowledgement: content.required_acknowledgement || false,
    status: "draft",
    source_type: content.source_type || "manual",
    source_excerpt: content.source_excerpt || null,
    owner_id: a.id,
    verified_at: now(),
    published_at: null,
    version: 1,
    published_version: null,
    published_snapshot: null,
  };
  if (
    b.kind === "access" &&
    (b.visibility === "invitee" || b.visibility === "manager_only")
  )
    throw new DomainError(
      "UNSAFE_VISIBILITY",
      "Access guidance must be restricted to members or a scheduled release.",
    );
  s.content_blocks.push(b);
  recordVersion(s, a, b, "Created draft");
  return b;
}
function recordVersion(s: State, a: Actor, b: Block, reason: string) {
  s.content_versions.push({
    ...base(),
    content_block_id: b.id,
    version: b.version,
    snapshot: snapshot(b),
    changed_by: a.id,
    change_reason: reason,
  });
}
function revise(
  s: State,
  a: Actor,
  b: Block,
  changes: Partial<BlockContent>,
  reason: string,
) {
  Object.assign(b, changes, { version: b.version + 1, updated_at: now() });
  recordVersion(s, a, b, reason);
}
export function inviteValidity(invite: State["invites"][number] | undefined) {
  return (
    !!invite &&
    !invite.claimed_at &&
    !invite.revoked_at &&
    Date.parse(invite.expires_at) > Date.now()
  );
}
export function resolveInvite(s: State, rawToken: string) {
  const i = s.invites.find((i) => i.token_hash === hashToken(rawToken));
  if (!inviteValidity(i))
    throw new DomainError(
      "INVITE_UNAVAILABLE",
      "This invitation has expired, was revoked, or has already been claimed. Ask your manager for a new invitation.",
    );
  const room = found(s.rooms.find((r) => r.id === i!.room_id));
  const prop = found(s.properties.find((p) => p.id === room.property_id));
  return {
    propertyName: prop.name,
    inviter:
      s.profiles.find((p) => p.id === i!.created_by)?.display_name ||
      "Your manager",
    expiresAt: i!.expires_at,
    welcome:
      "Everything you need to settle into your home, kept clear and current.",
  };
}
function createInvite(
  s: State,
  a: Actor,
  roomId: string,
  email?: string,
  expiresInDays = 7,
) {
  requireManager(s, a, roomId);
  const token = randomBytes(32).toString("base64url");
  const i = {
    ...base(),
    room_id: roomId,
    created_by: a.id,
    invitee_email: email || null,
    token_hash: hashToken(token),
    expires_at: new Date(Date.now() + expiresInDays * 86400000).toISOString(),
    claimed_at: null,
    revoked_at: null,
  };
  s.invites.push(i);
  return { id: i.id, token, expiresAt: i.expires_at };
}
function publish(s: State, a: Actor, roomId: string) {
  requireManager(s, a, roomId);
  const room = found(s.rooms.find((r) => r.id === roomId));
  const blocks = s.content_blocks.filter((b) => b.room_id === roomId);
  const check = readiness(blocks, room);
  if (!check.canPublish)
    throw new DomainError(
      "READINESS_REQUIRED",
      `Before publishing: ${check.checks
        .filter((c) => c.required && !c.pass)
        .map((c) => c.name)
        .join(", ")}.`,
    );
  for (const b of blocks) {
    const changed = b.published_version !== b.version;
    if (changed) {
      b.status = b.status === "archived" ? "archived" : "published";
      b.published_at = now();
      b.published_snapshot = snapshot(b);
      b.published_version = b.version;
    }
  }
  for (const t of s.translations.filter(
    (t) =>
      blocks.some((b) => b.id === t.content_block_id) &&
      t.status === "reviewed",
  )) {
    t.status = "published";
    t.published_snapshot = {
      title: t.title,
      body: t.body,
      data: t.data,
      source_version: t.source_version,
    };
  }
  found(s.properties.find((p) => p.id === room.property_id)).published_at =
    now();
  return check;
}
async function audit<T>(
  s: State,
  a: Actor,
  roomId: string,
  purpose: State["ai_runs"][number]["purpose"],
  provider: AIProvider,
  input: string,
  fn: () => Promise<T>,
) {
  const room = found(s.rooms.find((r) => r.id === roomId));
  const prop = found(s.properties.find((p) => p.id === room.property_id));
  const start = Date.now();
  const run: State["ai_runs"][number] = {
    ...base(),
    organisation_id: prop.organisation_id,
    room_id: roomId,
    actor_id: a.id,
    purpose,
    provider: provider.name,
    model: provider.model,
    input_hash: hashToken(redact(input)),
    status: "running",
    latency_ms: 0,
    result_metadata: {},
    error_code: null,
  };
  s.ai_runs.push(run);
  try {
    const value = await fn();
    run.status = "success";
    run.latency_ms = Date.now() - start;
    return { value, run };
  } catch {
    run.status = "error";
    run.error_code = "PROVIDER_UNAVAILABLE";
    run.latency_ms = Date.now() - start;
    return { value: null, run };
  }
}
async function extraction(
  s: State,
  a: Actor,
  roomId: string,
  notes: string,
  provider: AIProvider,
) {
  requireManager(s, a, roomId);
  const result = await audit(
    s,
    a,
    roomId,
    "content_extract",
    provider,
    notes,
    () => provider.extract(redact(notes)),
  );
  if (!result.value) return { providerUnavailable: true };
  for (const raw of result.value) {
    const proposed = suggestionSchema.parse(raw);
    s.ai_suggestions.push({
      ...base(),
      room_id: roomId,
      ai_run_id: result.run.id,
      kind: proposed.kind,
      proposed_data: proposed,
      source_excerpt: proposed.sourceExcerpt,
      status: "pending",
      reviewed_by: null,
      reviewed_at: null,
    });
  }
  result.run.result_metadata = { count: result.value.length };
  return { count: result.value.length };
}
export async function execute(
  s: State,
  a: Actor,
  operation: Operation,
  input: unknown,
  provider: AIProvider,
  options: { retrievedIds?: string[] } = {},
): Promise<unknown> {
  const profile = found(s.profiles.find((p) => p.id === a.id));
  switch (operation) {
    case "createOrganisation": {
      const p = contracts.createOrganisation.parse(input);
      const org = {
        ...base(),
        name: p.name,
        slug:
          p.name.toLowerCase().replace(/[^a-z0-9]/g, "-") +
          "-" +
          randomBytes(4).toString("hex"),
        created_by: a.id,
      };
      s.organisations.push(org);
      s.organisation_members.push({
        ...base(),
        organisation_id: org.id,
        profile_id: a.id,
        role: "owner",
      });
      return org;
    }
    case "createProperty": {
      const p = contracts.createProperty.parse(input);
      if (
        !s.organisation_members.some(
          (m) =>
            m.organisation_id === p.organisationId &&
            m.profile_id === a.id &&
            m.role !== "staff",
        )
      )
        throw new DomainError(
          "PERMISSION_DENIED",
          "Organisation permission required.",
        );
      const prop = {
        ...base(),
        organisation_id: p.organisationId,
        name: p.name,
        address_line_1: p.address,
        address_line_2: "",
        city: p.city,
        postcode: p.postcode,
        country_code: "GB",
        timezone: p.timezone,
        property_type: p.type,
        published_at: null,
      };
      s.properties.push(prop);
      return prop;
    }
    case "createRoom": {
      const p = contracts.createRoom.parse(input);
      const prop = found(s.properties.find((x) => x.id === p.propertyId));
      if (
        !s.organisation_members.some(
          (m) =>
            m.organisation_id === prop.organisation_id &&
            m.profile_id === a.id &&
            m.role !== "staff",
        )
      )
        throw new DomainError(
          "PERMISSION_DENIED",
          "Organisation permission required.",
        );
      const room = {
        ...base(),
        property_id: p.propertyId,
        name: p.name,
        capacity: p.capacity,
        manager_contact_json: { name: p.managerName, phone: p.managerPhone },
        emergency_contact_json: { phone: p.emergencyPhone },
        default_locale: p.locales[0],
        supported_locales: p.locales,
        languages_reviewed: false,
      };
      s.rooms.push(room);
      return room;
    }
    case "saveManagerOnboardingStep": {
      const p = contracts.saveManagerOnboardingStep.parse(input);
      let progress = s.manager_onboarding.find((o) => o.profile_id === a.id);
      if (!progress) {
        progress = {
          ...base(),
          profile_id: a.id,
          step: 0,
          organisation_id: null,
          property_id: null,
          room_id: null,
          values: {},
          completed: false,
        };
        s.manager_onboarding.push(progress);
      }
      if (p.step > progress.step)
        throw new DomainError("STEP_ORDER", "Complete the current step first.");
      progress.values = { ...progress.values, ...p.values };
      progress.updated_at = now();
      if (!p.advance) return progress;
      const v = progress.values;
      const need = (key: string) => {
        if (!v[key]?.trim())
          throw new DomainError("VALIDATION_ERROR", `Please complete ${key}.`);
        return v[key].trim();
      };
      if (p.step === 1) {
        profile.display_name = need("managerName");
        if (!progress.organisation_id) {
          const org = (await execute(
            s,
            a,
            "createOrganisation",
            { name: need("organisationName") },
            provider,
          )) as { id: string };
          progress.organisation_id = org.id;
        } else
          found(
            s.organisations.find((o) => o.id === progress!.organisation_id),
          ).name = need("organisationName");
      }
      if (p.step === 2) {
        const data = contracts.createProperty.parse({
          organisationId: progress.organisation_id,
          name: need("propertyName"),
          address: need("address"),
          city: need("city"),
          postcode: need("postcode"),
          type: v.propertyType || "shared_house",
          timezone: v.timezone || "Europe/London",
        });
        if (!progress.property_id) {
          const prop = (await execute(
            s,
            a,
            "createProperty",
            data,
            provider,
          )) as { id: string };
          progress.property_id = prop.id;
        } else
          Object.assign(
            found(s.properties.find((x) => x.id === progress!.property_id)),
            {
              name: data.name,
              address_line_1: data.address,
              city: data.city,
              postcode: data.postcode,
              property_type: data.type,
              timezone: data.timezone,
            },
          );
      }
      if (p.step === 3) {
        if (!progress.room_id) {
          const room = (await execute(
            s,
            a,
            "createRoom",
            {
              propertyId: progress.property_id,
              name: need("roomName"),
              capacity: Number(v.capacity || 4),
              managerName: need("managerName"),
              managerPhone: need("managerPhone"),
              emergencyPhone: need("emergencyPhone"),
              locales: (v.locales || "en-GB").split(","),
            },
            provider,
          )) as { id: string };
          progress.room_id = room.id;
          const basics: [BlockContent["kind"], string, string, string][] = [
            [
              "essential",
              "Your address",
              `${v.address}, ${v.city}, ${v.postcode}`,
              "address",
            ],
            [
              "essential",
              "Your manager",
              `${v.managerName} · ${v.managerPhone}`,
              "manager",
            ],
            [
              "safety",
              "Emergency support",
              `Immediate danger: 999 or 112. Home emergency contact: ${v.emergencyPhone}. Suspected gas leak: leave and call 0800 111 999 from outside.`,
              "emergency",
            ],
            [
              "access",
              "Coming and going",
              "Contact your manager to agree a key handover. Entry details are shared directly with active residents.",
              "access",
            ],
            [
              "resource",
              "Repairs",
              "Report repairs in Roomly with a description, location and availability. Call 999 for immediate danger.",
              "repairs",
            ],
          ];
          for (const [kind, title, body, key] of basics)
            addBlock(s, a, room.id, {
              kind,
              title,
              body,
              data: { key, setup_template_hash: hashToken(body) },
            });
          for (const [i, title] of [
            "Save your address",
            "Introduce yourself",
            "Locate the bins",
            "Understand repair reporting",
          ].entries())
            s.onboarding_tasks.push({
              ...base(),
              room_id: room.id,
              title,
              description: "A useful first step in your new home.",
              position: i,
              required: false,
              completion_kind: "manual",
            });
        } else {
          const room = found(s.rooms.find((r) => r.id === progress!.room_id));
          const validated = contracts.createRoom.parse({
            propertyId: progress.property_id,
            name: need("roomName"),
            capacity: Number(v.capacity || 4),
            managerName: need("managerName"),
            managerPhone: need("managerPhone"),
            emergencyPhone: need("emergencyPhone"),
            locales: (v.locales || "en-GB").split(","),
          });
          Object.assign(room, {
            name: validated.name,
            capacity: validated.capacity,
            manager_contact_json: {
              name: validated.managerName,
              phone: validated.managerPhone,
            },
            emergency_contact_json: { phone: validated.emergencyPhone },
            supported_locales: validated.locales,
          });
        }
      }
      // Refresh only untouched setup-generated drafts. Manual edits and published content retain their wording.
      if (progress.room_id && (p.step === 2 || p.step === 3)) {
        const room = found(s.rooms.find((r) => r.id === progress!.room_id));
        const prop = found(
          s.properties.find((prop) => prop.id === room.property_id),
        );
        const templates: Record<string, string> = {
          address: `${prop.address_line_1}, ${prop.city}, ${prop.postcode}`,
          manager: `${room.manager_contact_json.name} · ${room.manager_contact_json.phone}`,
          emergency: `Immediate danger: 999 or 112. Home emergency contact: ${room.emergency_contact_json.phone}. Suspected gas leak: leave and call 0800 111 999 from outside.`,
        };
        for (const block of s.content_blocks.filter(
          (b) => b.room_id === room.id && !b.published_version,
        )) {
          const body = templates[String(block.data.key)];
          if (
            body &&
            body !== block.body &&
            block.data.setup_template_hash === hashToken(block.body)
          ) {
            revise(
              s,
              a,
              block,
              {
                body,
                data: { ...block.data, setup_template_hash: hashToken(body) },
              },
              "Updated setup details",
            );
          }
        }
      }
      if (p.step === 4) {
        const result = await extraction(
          s,
          a,
          found(progress.room_id || undefined),
          need("notes"),
          provider,
        );
        if ("providerUnavailable" in result) return result;
      }
      if (p.step === 6) {
        const room = found(progress.room_id || undefined);
        publish(s, a, room);
        const invite = createInvite(s, a, room);
        progress.completed = true;
        progress.step = 7;
        return { progress, invite };
      }
      progress.step = Math.max(progress.step, p.step + 1);
      return progress;
    }
    case "createInvite": {
      const p = contracts.createInvite.parse(input);
      return createInvite(s, a, p.roomId, p.email, p.expiresInDays);
    }
    case "revokeInvite": {
      const p = contracts.revokeInvite.parse(input);
      const i = found(s.invites.find((x) => x.id === p.inviteId));
      requireManager(s, a, i.room_id);
      if (i.claimed_at)
        throw new DomainError(
          "INVITE_CLAIMED",
          "A claimed invitation cannot be revoked.",
        );
      i.revoked_at = now();
      return { revoked: true };
    }
    case "resolveInvite":
      return resolveInvite(s, contracts.resolveInvite.parse(input).rawToken);
    case "claimInvite": {
      const p = contracts.claimInvite.parse(input);
      resolveInvite(s, p.rawToken);
      const i = found(
        s.invites.find((x) => x.token_hash === hashToken(p.rawToken)),
      );
      if (
        i.invitee_email &&
        i.invitee_email.toLowerCase() !== a.email?.toLowerCase()
      )
        throw new DomainError(
          "EMAIL_MISMATCH",
          "Sign in with the email address this invitation was sent to.",
        );
      const room = found(s.rooms.find((r) => r.id === i.room_id));
      if (
        s.memberships.filter(
          (m) => m.room_id === room.id && m.status === "active",
        ).length >= room.capacity
      )
        throw new DomainError(
          "HOME_FULL",
          "Your manager must increase the home capacity before you join.",
        );
      let m = s.memberships.find(
        (m) => m.room_id === i.room_id && m.profile_id === a.id,
      );
      if (m?.status === "active")
        throw new DomainError(
          "ALREADY_MEMBER",
          "You already belong to this home.",
        );
      if (!m) {
        m = {
          ...base(),
          room_id: i.room_id,
          profile_id: a.id,
          status: "active",
          move_in_at: now(),
          move_out_at: null,
          onboarding_completed_at: null,
          onboarding_step: 2,
        };
        s.memberships.push(m);
      } else
        Object.assign(m, {
          status: "active",
          move_out_at: null,
          onboarding_completed_at: null,
          onboarding_step: 2,
        });
      i.claimed_at = now();
      return { membershipId: m.id };
    }
    case "saveResidentPreferences": {
      const p = contracts.saveResidentPreferences.parse(input);
      const m = ownMembership(s, a, p.membershipId);
      Object.assign(profile, {
        preferred_name: p.preferredName,
        pronouns: p.pronouns || null,
        locale: p.locale,
        notification_preference: p.notification,
      });
      m.onboarding_step = Math.max(3, m.onboarding_step);
      return { saved: true };
    }
    case "advanceResident": {
      const p = contracts.advanceResident.parse(input);
      const m = ownMembership(s, a, p.membershipId);
      if (p.step > m.onboarding_step + 1)
        throw new DomainError("STEP_ORDER", "Complete the current step first.");
      const blocks = residentBlocks(s, a, m.room_id);
      if (p.step >= 5 && !agreementsComplete(s, m.id, blocks))
        throw new DomainError(
          "AGREEMENTS_REQUIRED",
          "Please acknowledge each required house agreement.",
        );
      if (p.step === 7) {
        if (
          !s.onboarding_tasks
            .filter((t) => t.room_id === m.room_id && t.required)
            .every((t) =>
              s.onboarding_task_completions.some(
                (c) =>
                  c.membership_id === m.id && c.onboarding_task_id === t.id,
              ),
            )
        )
          throw new DomainError(
            "TASKS_REQUIRED",
            "Complete the required first-week actions.",
          );
        m.onboarding_completed_at = now();
      }
      m.onboarding_step = Math.max(p.step, m.onboarding_step);
      return { step: m.onboarding_step };
    }
    case "acknowledgeBlock": {
      const p = contracts.acknowledgeBlock.parse(input);
      const m = ownMembership(s, a, p.membershipId);
      const b = found(
        residentBlocks(s, a, m.room_id).find((b) => b.id === p.blockId),
      );
      if (b.version !== p.version)
        throw new DomainError(
          "CONTENT_VERSION_CONFLICT",
          "The agreement changed. Read the current version first.",
        );
      if (!b.required_acknowledgement)
        throw new DomainError(
          "NOT_REQUIRED",
          "This guidance does not need acknowledgement.",
        );
      if (
        !s.acknowledgements.some(
          (x) =>
            x.membership_id === m.id &&
            x.content_block_id === b.id &&
            x.content_version === b.version,
        )
      )
        s.acknowledgements.push({
          ...base(),
          membership_id: m.id,
          content_block_id: b.id,
          content_version: b.version,
          acknowledged_at: now(),
        });
      return { acknowledged: true };
    }
    case "completeOnboardingTask": {
      const p = contracts.completeOnboardingTask.parse(input);
      const m = ownMembership(s, a, p.membershipId);
      const t = found(
        s.onboarding_tasks.find(
          (t) => t.id === p.taskId && t.room_id === m.room_id,
        ),
      );
      if (t.completion_kind === "manager_confirmed")
        throw new DomainError(
          "PERMISSION_DENIED",
          "Your manager must confirm this action.",
        );
      if (
        !s.onboarding_task_completions.some(
          (c) => c.membership_id === m.id && c.onboarding_task_id === t.id,
        )
      )
        s.onboarding_task_completions.push({
          ...base(),
          membership_id: m.id,
          onboarding_task_id: t.id,
          completed_at: now(),
        });
      return { completed: true };
    }
    case "createContentBlock": {
      const p = contracts.createContentBlock.parse(input);
      requireManager(s, a, p.roomId);
      return addBlock(s, a, p.roomId, p);
    }
    case "updateContentBlock": {
      const p = contracts.updateContentBlock.parse(input);
      const b = found(
        s.content_blocks.find((b) => b.id === p.id && b.room_id === p.roomId),
      );
      requireManager(s, a, b.room_id);
      checkVersion(b, p.expectedVersion);
      if (
        p.kind === "access" &&
        !["member", "scheduled"].includes(p.visibility)
      )
        throw new DomainError(
          "UNSAFE_VISIBILITY",
          "Access information must be member-only or scheduled.",
        );
      revise(
        s,
        a,
        b,
        {
          title: p.title,
          body: p.body,
          kind: p.kind,
          visibility: p.visibility,
          visible_from: p.visible_from || null,
          required_acknowledgement: p.required_acknowledgement,
          data: p.data,
          verified_at: now(),
        },
        "Edited draft",
      );
      return b;
    }
    case "archiveBlock": {
      const p = contracts.archiveBlock.parse(input);
      const b = found(s.content_blocks.find((b) => b.id === p.blockId));
      requireManager(s, a, b.room_id);
      checkVersion(b, p.expectedVersion);
      revise(s, a, b, { status: "archived" }, "Archived draft");
      return { version: b.version };
    }
    case "undoArchive": {
      const p = contracts.undoArchive.parse(input);
      const b = found(s.content_blocks.find((b) => b.id === p.blockId));
      requireManager(s, a, b.room_id);
      checkVersion(b, p.expectedVersion);
      const prior = s.content_versions.find(
        (v) => v.content_block_id === b.id && v.version === b.version - 1,
      );
      if (b.status !== "archived" || !prior)
        throw new DomainError(
          "UNDO_UNAVAILABLE",
          "There is no archived version to restore.",
        );
      revise(s, a, b, { status: prior.snapshot.status }, "Restored archive");
      return b;
    }
    case "reorderContentBlocks": {
      const p = contracts.reorderContentBlocks.parse(input);
      requireManager(s, a, p.roomId);
      const blocks = s.content_blocks.filter(
        (b) => b.room_id === p.roomId && b.status !== "archived",
      );
      if (
        new Set(p.orderedIds).size !== blocks.length ||
        blocks.some((b) => !p.orderedIds.includes(b.id))
      )
        throw new DomainError(
          "INVALID_ORDER",
          "Include each current block exactly once.",
        );
      p.orderedIds.forEach((id, i) => {
        const b = found(blocks.find((b) => b.id === id));
        if (b.position !== i)
          revise(s, a, b, { position: i }, "Reordered draft");
      });
      return { reordered: true };
    }
    case "publishContentChanges":
      return publish(s, a, contracts.publishContentChanges.parse(input).roomId);
    case "runContentExtraction": {
      const p = contracts.runContentExtraction.parse(input);
      return extraction(s, a, p.roomId, p.notes, provider);
    }
    case "reviewAiSuggestion": {
      const p = contracts.reviewAiSuggestion.parse(input);
      const sug = found(s.ai_suggestions.find((x) => x.id === p.suggestionId));
      requireManager(s, a, sug.room_id);
      if (sug.status !== "pending")
        throw new DomainError(
          "ALREADY_REVIEWED",
          "This suggestion has already been reviewed.",
        );
      if (p.decision === "edited" && !p.editedData)
        throw new DomainError(
          "VALIDATION_ERROR",
          "Enter your edited suggestion.",
        );
      if (p.decision !== "rejected") {
        const proposal = suggestionSchema.parse({
          ...sug.proposed_data,
          ...(p.decision === "edited" ? p.editedData : {}),
        });
        addBlock(s, a, sug.room_id, {
          ...proposal,
          source_type: "ai_draft",
          source_excerpt: sug.source_excerpt,
          required_acknowledgement: proposal.kind === "agreement",
        });
      }
      Object.assign(sug, {
        status: p.decision,
        reviewed_by: a.id,
        reviewed_at: now(),
      });
      return { status: sug.status };
    }
    case "translateBlock": {
      const p = contracts.translateBlock.parse(input);
      const b = found(s.content_blocks.find((b) => b.id === p.blockId));
      requireManager(s, a, b.room_id);
      // Sensitive blocks use a manual draft; their facts never go to a provider.
      const result = safeForAI(b)
        ? await audit(s, a, b.room_id, "translate", provider, b.body, () =>
            provider.translate({ ...b, body: redact(b.body) }, p.locale),
          )
        : { value: { title: b.title, body: b.body } };
      if (!result.value) return { providerUnavailable: true };
      validateTranslation(b, result.value);
      let t = s.translations.find(
        (t) => t.content_block_id === b.id && t.locale === p.locale,
      );
      if (t) {
        if (!t.published_snapshot && t.status === "published")
          t.published_snapshot = {
            title: t.title,
            body: t.body,
            data: t.data,
            source_version: t.source_version,
          };
        Object.assign(t, {
          ...result.value,
          status: "draft",
          reviewed_by: null,
          source_version: b.version,
        });
      } else {
        t = {
          ...base(),
          content_block_id: b.id,
          locale: p.locale,
          ...result.value,
          data: b.data,
          status: "draft",
          reviewed_by: null,
          source_version: b.version,
          published_snapshot: null,
        };
        s.translations.push(t);
      }
      return t;
    }
    case "reviewTranslation": {
      const p = contracts.reviewTranslation.parse(input);
      const t = found(s.translations.find((t) => t.id === p.translationId));
      const b = found(
        s.content_blocks.find((b) => b.id === t.content_block_id),
      );
      requireManager(s, a, b.room_id);
      if (t.source_version !== b.version)
        throw new DomainError(
          "CONTENT_VERSION_CONFLICT",
          "The source changed; create a fresh translation draft.",
        );
      validateTranslation(b, p);
      Object.assign(t, {
        title: p.title,
        body: p.body,
        status: "reviewed",
        reviewed_by: a.id,
      });
      return t;
    }
    case "askRoomly": {
      const p = contracts.askRoomly.parse(input);
      const m = membership(s, a, p.roomId);
      const authorised = residentBlocks(s, a, p.roomId, profile.locale);
      const sources = options.retrievedIds
        ? options.retrievedIds.flatMap((id) =>
            authorised.filter((b) => b.id === id),
          )
        : authorised;
      const result = await audit(
        s,
        a,
        p.roomId,
        "answer",
        provider,
        p.question,
        () => groundedAnswer(provider, p.question, sources),
      );
      const answer = result.value;
      const log = {
        ...base(),
        membership_id: m.id,
        room_id: p.roomId,
        question_redacted: redact(p.question),
        category: answer?.category || "provider_unavailable",
        outcome:
          answer?.status === "answered"
            ? ("answered" as const)
            : answer?.status === "emergency"
              ? ("escalated" as const)
              : ("unknown" as const),
        cited_block_ids: answer?.sourceIds || [],
        feedback: null,
      };
      s.question_logs.push(log);
      result.run.result_metadata = { cited_ids: log.cited_block_ids };
      return {
        answer,
        providerUnavailable: !answer,
        questionLogId: log.id,
        sources: sources
          .filter((b) => answer?.sourceIds.includes(b.id))
          .map((b) => ({
            id: b.id,
            title: b.title,
            verified_at: b.verified_at,
          })),
      };
    }
    case "submitQuestionFeedback": {
      const p = contracts.submitQuestionFeedback.parse(input);
      const q = found(s.question_logs.find((q) => q.id === p.questionLogId));
      ownMembership(s, a, q.membership_id);
      q.feedback = p.feedback;
      return { saved: true };
    }
    case "questionToFaq": {
      const p = contracts.questionToFaq.parse(input);
      const q = found(s.question_logs.find((q) => q.id === p.questionId));
      requireManager(s, a, q.room_id);
      const b = addBlock(s, a, q.room_id, {
        kind: "faq",
        title: q.question_redacted.slice(0, 160),
        body: p.answer,
        source_type: "approved_answer",
      });
      return b;
    }
    case "createMaintenanceDraft": {
      const p = contracts.createMaintenanceDraft.parse(input);
      const m = membership(s, a, p.roomId);
      const suggestion = triage(p.description);
      const repair = {
        ...base(),
        room_id: p.roomId,
        membership_id: m.id,
        title: p.title,
        description: p.description,
        location: p.location,
        ...suggestion,
        status: "draft" as const,
        availability_json: { notes: p.availability },
        assigned_to: null,
      };
      const { missingQuestions, ...row } = repair;
      s.maintenance_requests.push(row);
      return { request: row, missingQuestions };
    }
    case "submitMaintenanceRequest": {
      const p = contracts.submitMaintenanceRequest.parse(input);
      const r = found(s.maintenance_requests.find((r) => r.id === p.requestId));
      ownMembership(s, a, r.membership_id);
      validateTransition(r.status, "submitted");
      r.status = "submitted";
      s.maintenance_events.push({
        ...base(),
        maintenance_request_id: r.id,
        actor_id: a.id,
        event_type: "submitted",
        note: "Your report has been submitted for manager review.",
        resident_visible: true,
      });
      return r;
    }
    case "appendMaintenanceEvent": {
      const p = contracts.appendMaintenanceEvent.parse(input);
      const r = found(s.maintenance_requests.find((r) => r.id === p.requestId));
      requireManager(s, a, r.room_id);
      validateTransition(r.status, p.status);
      r.status = p.status;
      r.updated_at = now();
      s.maintenance_events.push({
        ...base(),
        maintenance_request_id: r.id,
        actor_id: a.id,
        event_type: p.status,
        note: p.note,
        resident_visible: p.residentVisible,
      });
      return r;
    }
    case "saveSettings": {
      const p = contracts.saveSettings.parse(input);
      requireManager(s, a, p.roomId);
      const r = found(s.rooms.find((r) => r.id === p.roomId));
      Object.assign(r, {
        name: p.name,
        manager_contact_json: {
          ...r.manager_contact_json,
          phone: p.managerPhone,
        },
        emergency_contact_json: { phone: p.emergencyPhone },
        languages_reviewed: p.languagesReviewed,
      });
      return { saved: true };
    }
  }
}
export function viewState(s: State, a: Actor, roomId?: string) {
  const profile = found(s.profiles.find((p) => p.id === a.id));
  const orgIds = s.organisation_members
    .filter((m) => m.profile_id === a.id)
    .map((m) => m.organisation_id);
  const properties = s.properties.filter((p) =>
    orgIds.includes(p.organisation_id),
  );
  const managedRooms = s.rooms.filter((r) =>
    properties.some((p) => p.id === r.property_id),
  );
  const memberships = s.memberships.filter(
    (m) => m.profile_id === a.id && m.status === "active",
  );
  const m = memberships.find((m) => m.room_id === roomId) || memberships[0];
  const room = roomId
    ? s.rooms.find((r) => r.id === roomId)
    : managedRooms[0] || s.rooms.find((r) => r.id === m?.room_id);
  if (
    roomId &&
    !managedRooms.some((r) => r.id === roomId) &&
    !memberships.some((m) => m.room_id === roomId)
  )
    throw new DomainError("PERMISSION_DENIED", "You cannot view this home.");
  const manager = !!room && managedRooms.some((r) => r.id === room.id);
  const member = memberships.find((m) => m.room_id === room?.id);
  const blocks = room
    ? manager
      ? s.content_blocks
          .filter((b) => b.room_id === room.id)
          .sort((a, b) => a.position - b.position)
      : residentBlocks(s, a, room.id, profile.locale)
    : [];
  const repairs = s.maintenance_requests.filter(
    (r) =>
      r.room_id === room?.id && (manager || r.membership_id === member?.id),
  );
  return {
    serverTime: Date.now(),
    profile,
    properties,
    managedRooms,
    memberships: memberships.map((m) => ({
      ...m,
      homeName:
        s.properties.find(
          (p) => p.id === s.rooms.find((r) => r.id === m.room_id)?.property_id,
        )?.name || "Home",
    })),
    room: room || null,
    property: s.properties.find((p) => p.id === room?.property_id) || null,
    member: member || null,
    manager,
    blocks,
    preview: manager && room ? visibleBlocks(s, room.id, profile.locale) : [],
    versions: manager
      ? s.content_versions.filter((v) =>
          blocks.some((b) => b.id === v.content_block_id),
        )
      : [],
    translations: manager
      ? s.translations.filter((t) =>
          blocks.some((b) => b.id === t.content_block_id),
        )
      : [],
    suggestions: manager
      ? s.ai_suggestions.filter((x) => x.room_id === room?.id)
      : [],
    invites: manager
      ? s.invites
          .filter((i) => i.room_id === room?.id)
          .map(({ token_hash, ...i }) => {
            void token_hash;
            return i;
          })
      : [],
    questions: manager
      ? s.question_logs.filter(
          (q) => q.room_id === room?.id && q.outcome !== "answered",
        )
      : [],
    repairs,
    events: s.maintenance_events.filter(
      (e) =>
        repairs.some((r) => r.id === e.maintenance_request_id) &&
        (manager || e.resident_visible),
    ),
    attachments: s.maintenance_attachments.filter((f) =>
      repairs.some((r) => r.id === f.maintenance_request_id),
    ),
    tasks: s.onboarding_tasks.filter((t) => t.room_id === room?.id),
    completions: s.onboarding_task_completions.filter(
      (c) => c.membership_id === member?.id,
    ),
    acknowledgements: s.acknowledgements.filter(
      (c) => c.membership_id === member?.id,
    ),
    progress: s.manager_onboarding.find((p) => p.profile_id === a.id) || null,
    readiness: room
      ? readiness(manager ? blocks : visibleBlocks(s, room.id), room)
      : null,
  };
}
export type View = ReturnType<typeof viewState>;

import type { Block, BlockContent, State } from "../model";
import { DomainError } from "../permissions";
export function snapshot(b: Block): BlockContent {
  const {
    kind,
    title,
    body,
    data,
    position,
    visibility,
    visible_from,
    required_acknowledgement,
    status,
    source_type,
    source_excerpt,
    owner_id,
    verified_at,
    published_at,
    version,
  } = b;
  return {
    kind,
    title,
    body,
    data,
    position,
    visibility,
    visible_from,
    required_acknowledgement,
    status,
    source_type,
    source_excerpt,
    owner_id,
    verified_at,
    published_at,
    version,
  };
}
export function checkVersion(b: Block, expected: number) {
  if (b.version !== expected)
    throw new DomainError(
      "CONTENT_VERSION_CONFLICT",
      "Someone changed this block. Your text is preserved here; reload the saved version and compare before applying.",
    );
}
export function agreementsComplete(
  s: State,
  membershipId: string,
  blocks: Block[],
) {
  return blocks
    .filter((b) => b.required_acknowledgement)
    .every((b) =>
      s.acknowledgements.some(
        (a) =>
          a.membership_id === membershipId &&
          a.content_block_id === b.id &&
          a.content_version === b.version,
      ),
    );
}

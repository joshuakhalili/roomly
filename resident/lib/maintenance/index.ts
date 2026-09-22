import type { RepairStatus } from "../model";
import { DomainError } from "../permissions";
export const EMERGENCY_GUIDANCE =
  "If there is immediate danger, leave the area if safe and call 999 or 112. For a suspected gas leak, avoid flames and electrical switches, leave the building, and call the National Gas Emergency Service on 0800 111 999 from outside. For major flooding or insecure access, move to safety and contact your emergency manager. Roomly does not dispatch help.";
export function emergency(text: string) {
  return /\b(fire|smoke filling|gas (smell|leak)|smell (of )?gas|immediate danger|uncontrolled flood(ing)?|major flood(ing)?|cannot secure|can't secure|loss of secure access|door (won't|will not) lock)\b|火灾|煤气|yangın|gaz kokusu/i.test(
    text,
  );
}
export function triage(text: string) {
  return {
    category: emergency(text)
      ? ("safety" as const)
      : /leak|tap|sink|water/i.test(text)
        ? ("plumbing" as const)
        : /heat|boiler/i.test(text)
          ? ("heating" as const)
          : /socket|electric/i.test(text)
            ? ("electrical" as const)
            : ("other" as const),
    priority: emergency(text) ? ("emergency" as const) : ("normal" as const),
    missingQuestions: /kitchen|bedroom|bathroom|hall/i.test(text)
      ? []
      : ["Where in your home is the problem?"],
  };
}
const NEXT: Record<RepairStatus, RepairStatus[]> = {
  draft: ["submitted"],
  submitted: ["acknowledged"],
  acknowledged: ["scheduled", "in_progress", "resolved"],
  scheduled: ["in_progress", "resolved"],
  in_progress: ["resolved"],
  resolved: ["closed", "in_progress"],
  closed: [],
};
export function validateTransition(from: RepairStatus, to: RepairStatus) {
  if (!NEXT[from].includes(to))
    throw new DomainError(
      "INVALID_TRANSITION",
      `Cannot change ${from} to ${to}.`,
    );
}
export { NEXT as repairTransitions };

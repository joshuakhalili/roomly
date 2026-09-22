# Prompt to paste into the Astra task

Read `AGENTS.md` and then read `ASTRA_IMPLEMENTATION_HANDOVER.md` completely. Execute that handover from top to bottom as the decision-complete source of truth for Roomly.

Do not stop for product, visual, architecture, or sequencing preferences; those decisions are already locked in the handover. Inspect and preserve the current work, keep a visible progress checklist, implement the complete application, verify every acceptance criterion, fix failures, review the final diff, create coherent commits, and push to the configured remote if credentials permit.

Use the required demo adapters whenever external credentials are absent so the entire product remains runnable and testable in one pass. Only ask me to intervene if a secret, account permission, payment, or external approval is genuinely required and no safe demo path exists. At the end, report shipped flows, test results, demo access, production environment requirements, commit hash, push status, and any unmet criterion.


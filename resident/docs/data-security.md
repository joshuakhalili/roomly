# Data security

- Demo identities are available only in local demo mode. Public Vercel demo deployment is rejected.
- Production identity comes from Supabase `auth.getUser`, not user-supplied IDs. `proxy.ts` refreshes the session and performs only coarse redirects; every operation checks ownership or membership again.
- Every public table has RLS. Owners/managers may write their own organisation's records; staff have read access. Residents require an active membership and may operate only on their own membership, questions, acknowledgements, completions and repairs.
- Residents cannot select working `content_blocks` rows. `resident_content` exposes only frozen, visible published snapshots. Scheduled content must have a reached release date. Preview uses the same permission function and renderer.
- Invite tokens have 256 bits of randomness. Only SHA-256 hashes persist. Safe resolution returns property name, inviter, expiry and welcome copy. Claim checks expiry, revocation, email binding and capacity under database locks. A claimed token cannot be used again.
- POST endpoints validate Origin against the request host. For privacy-preserving browsers that omit Origin, a `Sec-Fetch-Site: same-origin` signal is required. Cross-origin submissions are rejected.
- Private repair files are limited to JPG, PNG or PDF, 5 MB, with signature checks. Storage paths contain generated identifiers. Reads verify the repair owner or organisation manager before serving a demo BLOB or issuing a short-lived signed URL. Downloads use attachment disposition.
- Service-role keys are not required or used. OpenAI keys are imported only in server modules. No credentials belong in Git.
- Question analytics copies redact email addresses, phone-like values, street addresses, postcodes, labelled secrets and token-shaped strings. AI audit records contain purpose, provider, model, latency, status, hash and cited IDs, never raw prompts.
- Supabase policies, functions and domain permission tests cover cross-room and cross-organisation denial. The test database uses explicit authenticated roles; it does not disable RLS to obtain passing results.

Production operational requirements: HTTPS, restricted Supabase dashboard access, database backups, organisation-specific data retention, auth email configuration, and platform access logs that avoid recording invitation URLs. Apply real account policies before onboarding customer data. The checked-in seed contains fictional local-review data only.

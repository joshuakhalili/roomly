# AI safety and review

Roomly AI extracts, translates and answers from approved information. It cannot publish, decide tenancy matters, move money, dispatch vendors, promise appointments or send external messages.

`AIProvider` has deterministic demo and OpenAI implementations. OpenAI requests use structured output parsing, `store: false`, bounded timeouts and one retry. Pasted material is explicitly treated as untrusted data. Outputs are parsed with strict Zod schemas and an allowlist of structured data keys.

Manager suggestions remain separate from content. Accept original, apply edited version and skip each persist a different decision with reviewer and time. Acceptance creates a working draft. Publishing remains a separate action with readiness checks.

Resident answers pass through identity, membership, publication, schedule and locale filters before retrieval. Production uses the `search_home_content` SQL function; demo uses intent-sensitive deterministic fixtures. At most eight sources are sent. Access secrets, payment information and unrelated profile data are excluded. Returned IDs must belong to the retrieved source set. Any answered response lacking valid citations becomes unknown with a manager handoff. Source labels and verification dates come from stored records.

Fire, gas smell/leak, immediate danger, major uncontrolled flooding and insecure access use deterministic UK guidance before the model. The UI shows this guidance immediately. Maintenance creates a draft and still requires resident confirmation. Emergency contacts are never inferred by AI.

Sensitive access, legal, payment and tenancy questions are refused unless the question exactly matches an approved, sensitive source title; that exact source is returned without sending it to a model. This intentionally favours refusal over a plausible unsupported answer.

Translations stay draft until a manager checks the wording. Sensitive blocks create a manual translation draft without a provider call. A separate released translation snapshot keeps earlier published wording available during editing. Published translations must match the source version. Numeric/URL/postcode locks are validated; the manager also reviews proper nouns, address wording and glossary terms. The deterministic translation adapter may retain English text for a new arbitrary block, visibly labelled draft; it never presents an untranslated new draft as reviewed. The seeded Chinese and Turkish guide has reviewed demo translations.

Default tests contain 53 independent fixtures across answerable, missing, ambiguous, emergency, sensitive, multilingual and injection scenarios. Provider errors remain retryable and create a failure audit record. Live provider tests are opt-in and were not run without credentials.

UK reference points: [GOV.UK emergency calls](https://www.gov.uk/contact-police) and [National Gas emergency guidance](https://www.nationalgas.com/en/node/256). Review safety copy and contacts with the property operator before production publication.

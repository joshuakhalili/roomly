# Roomly UI follow-up

The same bone/paper/ink/violet system now carries through onboarding, resident pages and the manager workspace. Existing authorization, draft/publication separation and emergency gates remain enforced by the application.

| Screen | Changes |
| --- | --- |
| Shared navigation | Home/room context, active Overview state and accessible account action on mobile |
| Sign-in and invitations | Clear continuation from an invite and explanation of the next steps |
| Resident onboarding | Consistent guidance and saved-progress context |
| Resident Home | Better-aligned repair updates and shared navigation |
| Guide | Search, topic filters, no-results recovery and cited-section disclosure |
| Ask | Dedicated question area, source explanation and direct manager contact |
| Repair list/detail | Status filters, readable statuses and clear report stages |
| Repair intake | Describe/review/confirm path, contextual help and attachment success/retry feedback |
| Manager overview | Operational heading and explicit next actions |
| Content | Workflow jump links, compact expandable sections, preserved autosave and keyboard controls |
| Invites | Create/share/join explanation, copy feedback, history and private sharing guidance |
| Questions | Review context and a link from a created FAQ draft to Content |
| Settings | Grouped home details, contacts and translation review, with publication guidance |

The browser checks wait for actual page content rather than Next.js's streaming loading screen. The editor disclosure is exercised with the keyboard. Search/no-results/topics, source-link disclosure, status filtering and clipboard copying have dedicated E2E assertions. All manager pages are also scanned at 320px width with horizontal-overflow assertions.

## Review screenshots

- [Guide](screenshots/ui-guide.png)
- [Ask](screenshots/ui-ask.png)
- [Repair intake](screenshots/ui-new.png)
- [Manager overview](screenshots/ui-overview.png)
- [Content editor](screenshots/ui-content.png)
- [Invitations](screenshots/ui-invites.png)
- [Settings](screenshots/ui-settings.png)
- [Mobile content editor](screenshots/mobile-content.png)
- [Mobile invitations](screenshots/mobile-invites.png)
- [Mobile settings](screenshots/mobile-settings.png)

Screenshots contain fictional demo data. Full feature scope and outstanding production configuration are documented in `FEATURES_AND_REMAINING_WORK.md`.

## Desktop completion

The dedicated desktop pass covers every public, resident and manager route at 1024 × 640, 1440 × 900 and 1920 × 1080. The full onboarding journeys continue to run in the desktop browser suite. Additional checks exercise a 900 × 500 short window, expanded guide/editor/maintenance forms, preview keyboard focus, long names, and the 720 × 450 CSS viewport produced by a 1440 × 900 desktop at 200% browser zoom.

Changes:

- Scrollable desktop side navigation keeps Settings and Account reachable in short windows and with long names.
- Header, content and footer align on wide monitors; short pages keep the footer at the bottom.
- Desktop headings and the resident welcome region use less vertical space while preserving readable text.
- The content editor shows guide sections immediately. Roomly Assist expands on demand, including via its workflow link, and keeps unfinished notes mounted when closed.
- The editor gives the working column more space and moves readiness below it on narrow laptops. Short windows use normal-flow guidance so tall sticky panels do not trap their lower content offscreen.
- Overview counts link directly to Content, Questions and Maintenance.
- Contact fields sit side by side where space allows and stack at narrower widths.
- Onboarding progress stays visible beside long steps on taller desktop screens.

Desktop viewport captures:

- [Resident Home](screenshots/desktop-resident-home.png)
- [Guide](screenshots/desktop-resident-guide.png)
- [Ask](screenshots/desktop-resident-ask.png)
- [Repair intake](screenshots/desktop-resident-new.png)
- [Manager overview](screenshots/desktop-manager-overview.png)
- [Content editor](screenshots/desktop-manager-content.png)
- [Invitations](screenshots/desktop-manager-invites.png)
- [Questions](screenshots/desktop-manager-questions.png)
- [Maintenance](screenshots/desktop-manager-maintenance.png)
- [Settings](screenshots/desktop-manager-settings.png)
- [Manager onboarding](screenshots/desktop-setup-manager.png)

These are Chromium captures with fictional demo data. Safari/Firefox and live production services were not verified by this pass.

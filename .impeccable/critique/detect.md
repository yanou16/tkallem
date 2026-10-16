# Detector results (`impeccable detect`)

Telemetry: `"telemetry": false` in `.impeccable/config.json` and `IMPECCABLE_NO_TELEMETRY=1` on every run. (`npx impeccable telemetry off` is not a command in 4.5.2: the CLI lists detect, ignores, help, install, link, update and check.)

## Source: `impeccable detect --json src/` (apps/web)
1 finding:
- `side-tab` (warning, slop): `border-l-4` on the correction card of the landing demo mock, `features/landing/PlatformPages.tsx:114`. It reproduces the real correction card of docs/DESIGN.md. Accepted, not changed.

## Live URL (https://tkallem.vercel.app)
| Page | Findings | Detail |
|---|---|---|
| /welcome | 32 | 21 `low-contrast` (20 are the demo's dimmed regions at opacity .3, intentional and transient; 1 is real: `#6b6f7e` on `#fff1d6` 4.48:1), 9 `nested-cards` (inside the demo mock frame), 1 `gray-on-color` (same real contrast case), 1 `tiny-text` (11px mock content) |
| /plan | 0 | clean |
| /practice | 0 | clean |

Pages behind sign-in (Home, Progress, Profile) cannot be scanned by URL as a guest; they were scanned from source and by the scripted audit (audit.md).

## Follow-up
The real contrast case is fixed in the same PR as item (7). Nested cards in the landing mock are flattened with item (5).

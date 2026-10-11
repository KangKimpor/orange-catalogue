# Responsive UI verification

## 2026-10-11 — daily analytics and protected import history

This follow-up starts from `main` at
`a24de9b81be1d3953a6bef440162e11e20813f80`. Browser checks use the locally
built working tree with intercepted localhost service requests. They do not
establish correspondence with a newly deployed production build or prove live
service writes. No production import was restored, deleted, or applied.

| Check | Result |
| --- | --- |
| `pnpm test` | 151 passed; five live-service assertions explicitly skipped |
| `pnpm check` | Passed for application and browser-test TypeScript |
| `pnpm build` | Passed; committed `api/index.js` regenerated |
| `git diff --check` | Passed |
| `pnpm audit --prod` | No known vulnerabilities |
| Full browser suite | 118 passed across Chromium 156 and WebKit 27.2 |
| Final focused browser rerun | All 22 import-history/analytics cases passed after the migration-readiness and focus refinements |

The 22 focused cases are part of the 118-case suite, not additional distinct
coverage. The full suite ran before the final readiness/focus refinements;
the final rerun and unit/type/build checks validate those refinements.

The new browser cases verify the black active-category bar, footer wording and
Admin link decoration; PIN confirmations at 320, 390, 820, and 1440px widths;
incorrect/empty PIN, cancel/focus return, pending locks, failed actions/retry,
current-import markers, and unavailable-migration feedback. Analytics cases
cover dated daily counts, retry, and unconfigured reporting without a false zero.
The existing route/viewport and business-interaction coverage below remains in
the full suite. These are browser-engine checks, not physical iPhone/iPad Safari
or VoiceOver validation.

Eleven new isolated PostgreSQL tests run the actual migration/functions in
PGlite. They verify historical backfill, backward/forward restoration, immutable
variant/photo associations, staff metadata, post-restore imports, current/missing
state rejection, chronological deletion, timestamps, atomic rollback, and
server-only execution grants. Fifteen server authorization tests verify signed
access, the current stored admin credential, persistent PIN throttling, history
pagination, and migration-readiness enforcement. Eight analytics tests verify
UTC date boundaries, API filtering, zero counts, caching/day rollover, concurrent
requests, and sanitized errors. The only added package is the pinned development
SQL test engine; no browser or production dependency was added for these features.

Production activation is blocked by connected-account access. The available
Supabase account cannot access catalogue project `ccaavswuaeqdkgvetlai`; the
available Vercel account cannot access the `kimpor` team. The new migration has
not been applied live and the analytics server token has not been configured.
The application blocks restore/delete until the migration is installed and
reports analytics as unconfigured until connected. See `OPERATIONS.md` for the
exact activation steps. Live transaction tests require isolated authorized data;
physical Safari, native keyboard/safe areas, assistive technology, and field
performance checks remain as described below.

## 2026-10-10 — original responsive implementation

The implementation starts from `main` at
`50e1add4dc66716e5300dc48d797ac2068c7873f`. The validated runtime is the locally
built working tree, not an assumption that an older deployed alias matches new
source. The original read-only audit verified that the immutable Vercel preview
matched that base commit. No live saves, uploads, imports, deletes, or password
changes were submitted during implementation validation.

## Completed checks

| Check                            | Result                                                                                                |
| -------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `pnpm test`                      | 116 passed; five live-service assertions explicitly skipped                                           |
| `pnpm check`                     | Passed, including browser-test TypeScript                                                             |
| `pnpm build`                     | Passed; committed `api/index.js` regenerated                                                          |
| `git diff --check`               | Passed                                                                                                |
| `pnpm audit --prod`              | No known vulnerabilities                                                                              |
| Main browser suite               | 90 passed across Chromium 156 and WebKit 27.2                                                         |
| Post-fix import checks           | 10 passed across both engines; four new apply-state checks plus six focused regressions               |
| Production error-boundary checks | Two additional checks passed, one per engine                                                          |
| Real-data/font review            | Nine local page/viewport combinations passed overflow checks with DM Sans and Playfair Display loaded |

The package-manager pin now matches the declared pnpm 10.34.5 tool and honors the
existing Wouter patch/workspace configuration. Compatible fixes for proxy-addr
2.0.8, qs 6.16.0, and ip-address 10.7.1 address the seven production advisories
reported before patching. SheetJS stays at its existing official 0.20.3 tarball,
with an integrity hash added. The browser suite is a development-only dependency.

## Route and viewport coverage

Both engines inspected `/`, `/product/fixture-piece`, `/admin`, `/admin/items`,
`/admin/photos`, `/admin/import`, `/admin/review-queue`, `/admin/security`, `/404`,
and an unknown route. All staff aliases also rendered the login state. Photos
and review-queue remain aliases of Catalogue and Imports, respectively.

The route matrix uses 76 representative CSS viewport entries per route/engine;
it is not a claim that every dimension corresponds to a particular device.

- Phones: 320×780, 360×780, 375×812, 390×844, 393×852, 402×874, 414×896,
  420×912, 430×932, 440×956; short usable heights 393×659, 402×714, 440×796.
- Landscape phones: 780×360, 844×390, 956×440, and 734×343.
- iPad/panes: 500×800, 600×900, 720×1024, 744×1133, 768×1024, 810×1080,
  820×1180, 834×1194, 834×1210, 1024×1366, 1032×1376, plus the reversed
  iPad orientations. Narrow 375px panes are covered by the phone matrix.
- Desktop: 1280×800, 1366×768, 1440×900, 1536×960, 1920×1080, 2560×1440;
  short-height 1440×500.
- Threshold neighbours: 359/360/361, 539/540/541, 639/640/641, 719/720/721,
  819/820/821, 849/850/851, 959/960/961, 1023/1024/1025, 1049/1050/1051,
  1119/1120/1121, 1199/1200/1201 at 900px height.
- Continuous sweeps: Catalogue editor and Product detail from 320–2000px in
  23px increments; actual workspace/editor widths determine nested column checks.
- Resilience: 150% text, 200% phone text, 200% CSS layout zoom, 320px width,
  keyboard focus, reduced motion, and 390×400/820×500 access forms.

These ranges cover the requested iPhone 15/16/17/18 layout families without
inventing future/unverified model specifications. Unverified iPhone 18 base/Plus
variants remain provisional. Real device/browser chrome, split-view behavior,
and keyboard appearance still require hardware validation.

## State and interaction coverage

Local fixtures exercise 0/1/80/320 catalogue items, full/long names and identifiers,
missing website names, price ranges, 12 color choices including long/Khmer labels,
unavailable colors/sizes, an explicit first-size default, no sizes, one/multiple/
missing/failed photographs, and exact/shared media selection. Gallery buttons,
pips, keyboard arrows, horizontal/vertical pointer drags, cancellation, and phone
emulated taps are checked. Messenger's exact destination and selected POS code,
color, size, price, and availability are checked after selections. Category
normalization, Just In membership, and exact saved catalogue return position are
retained and checked.

Staff fixtures cover selected items, many/one/no search results, counts, bounded
result scrolling, selected editor focus, responsive shell/navigation, sign-out,
website-name save feedback, invalid photo MIME, file-input focus, selected photo,
progress, upload success and color/variant association. Import fixtures cover
file/read/compare/confirm/apply feedback, pending/complete/failed application, full-width stages, long history/source values,
expanded change groups, price/quantity comparisons, invalid row reasons, disabled
apply, persistent removal success, and retention of the newly applied import during history refresh. Login and security errors/success/pending
states retain associated labels, help, announcements, and the owner-approved
password minimum. Loading, request failures/retry, empty/missing products, and
production error-boundary recovery are covered.

Every tRPC/upload action in the automated browser suite is intercepted on
localhost. Fixtures prove client rendering and interactions; they do not prove
live Supabase/Cloudinary writes. Three gallery URLs reuse one real catalogue
photograph to exercise indexing; real cropping/font review uses actual catalogue
data and photographs separately. Hidden batch matching/archive reuse stay hidden;
their existing helper/security tests remain rather than claiming live UI testing.

Historical assertions that merely found old CSS rules/comments were replaced by
computed bounds, column counts, clipping, touch sizes, contrast, focus, disclosure,
and interaction checks. Non-layout business/source contracts were retained.

## Captured visual evidence

Public images below use the audited public catalogue data with fonts loaded.
Staff images use local authenticated-state fixtures and deliberately exercise
font fallbacks; they are not live staff-account screenshots.

| Evidence                                                            | Viewport / state                                        |
| ------------------------------------------------------------------- | ------------------------------------------------------- |
| [Real catalogue](docs/ui-evidence/catalogue-real-390.png)           | 390×844, Tops                                           |
| [Real product phone](docs/ui-evidence/product-real-390.png)         | 390×844, WJ 0048                                        |
| [Real product desktop](docs/ui-evidence/product-real-1440.png)      | 1440×900, WJ 0048; order-action bottom at 640.8px       |
| [Staff phone](docs/ui-evidence/staff-webkit-390.png)                | WebKit, 390×844, labelled navigation/search             |
| [Selected editor phone](docs/ui-evidence/editor-webkit-390.png)     | WebKit, 390×844, item selected/revealed                 |
| [Staff iPad](docs/ui-evidence/staff-webkit-820.png)                 | WebKit, 820×1180                                        |
| [Staff desktop](docs/ui-evidence/staff-webkit-1440.png)             | WebKit, 1440×900, picker/editor + details/photos        |
| [Real measurements](docs/ui-evidence/real-public-measurements.json) | Nine combinations; no horizontal overflow; fonts loaded |

No page-level overflow or clipped essential control text was found in the recorded
matrix. Actual selected/focus/error states supplement color, and the controls
checked for touch use meet the 44px minimum. Muted text and essential borders,
selected indicators, focus, and destructive hover passed their contrast targets.
This is measured coverage, not an assertion that all possible data combinations
or assistive technologies have been exercised.

## Remaining service and physical-device checks

- Physical iPhone/iPad Safari: notches/safe-area values, expanded/collapsed browser
  toolbars, virtual keyboard, pinch/browser zoom, touch pan cancellation, iPad
  split-view, and short-height scrolling. Chromium/WebKit emulation does not prove
  physical Safari behavior; CSS layout zoom does not replace native zoom checks.
- VoiceOver and other screen-reader announcement/focus review. Keyboard operation
  and ARIA/label contracts passed browser checks; a full assistive-tech review is
  still required on hardware.
- Live authenticated staff workflow: no authorized staff session/service secrets
  were available. Use an isolated test catalogue for uploads, import preview/apply,
  deletion, and password changes; production read-only inspection cannot validate
  those writes. Five strict integration assertions require `ORANGE_LIVE_TESTS=1`
  and configured test-service credentials. They remain explicitly skipped here.
- Field LCP/CLS and touch-scroll performance require post-release measurements.
  Responsive media, lazy loading, priority images, reserved geometry,
  content-visibility, approved photography/logo, and reduced motion remain.

## Reproduce

Use the package-manager version in `package.json` (for example `corepack pnpm`).

```sh
pnpm install --frozen-lockfile
pnpm exec playwright install --with-deps chromium webkit
pnpm test
pnpm check
pnpm build
pnpm test:ui
pnpm audit --prod
git diff --check
```

`pnpm test:ui` serves the existing build on localhost and writes ignored screenshots,
traces, and an HTML report under `test-results/` and `playwright-report/`. In this
unprivileged audit environment, verified Debian libraries were extracted locally
for WebKit; the actual engine then ran successfully. The host's library-cache
preflight required a local override, not an application or test-assertion bypass.
Standard CI/hardware should install browser system dependencies normally.

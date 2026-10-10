# Orange Catalogue release notes

## 2026-10-10 — cohesive responsive catalogue and staff workspace

- Consolidated the historical CSS override stack into one white/pink palette,
  reusable spacing roles, readable typography, and component-specific rules.
- Responsive catalogue columns, continuous white navigation, full-width return
  controls, two-line card names, clear selection/focus, and recoverable loading,
  empty, request-error, missing-product, and image-failure states.
- Product photography uses full-image framing in detail. Gallery controls align
  with the image; touch-sized pips, keyboard operation, scroll-safe horizontal
  drags, explicit default sizes, and unavailable choices preserve Messenger orders.
- Unified staff editor uses workspace/editor container queries, labelled mobile
  navigation, readable identifiers, bounded result/history scrolling, and a
  focused selected editor. Forms and progress/error/success feedback are accessible.
- Import stages span the workbench; values and source details wrap; invalid source
  rows are explained; removal success remains visible after selection clears.
- Public cards retain one remaining photo when the original primary is removed.
- Chromium/WebKit regression tests exercise local fixtures without live mutations.
  Business/source tests are retained; historical CSS-string geometry assertions
  have moved to rendered bounds, contrast, state, and interaction checks.
- Compatible transitive fixes for proxy-addr, qs, and ip-address address the
  production dependency audit. The pnpm pin matches the declared tool version;
  the existing SheetJS tarball now has a reproducible integrity hash.

The public categories are Just In, Tops, Jeans, and Legwear. `/admin/photos` uses
the Catalogue editor; `/admin/review-queue` uses POS imports. Orders remain
Messenger-only through `m.me/OfficiallyDavit`; no stock counts appear publicly.

See `DESIGN_SYSTEM.md` and `UI_VERIFICATION.md` for behavior, coverage, evidence,
and remaining physical-device/service checks. Vercel publication follows the
repository's linked GitHub workflow; application admin authentication remains
required while customer routes stay public. Historical Management UI publication
instructions are superseded by the repository/Vercel operations guide.

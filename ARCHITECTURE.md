# Orange Catalogue Architecture

Orange Catalogue is a **photo-first women’s-clothing catalogue**, not a checkout store. Customers browse public catalogue pages and complete orders only through Messenger. Staff manage POS imports, customer-facing item names, Attribute-derived colours, and Cloudinary photos through the authenticated unified admin workspace.

## Fast orientation

| Concern | Source of truth | Read when changing |
|---|---|---|
| Route map and global UI | `client/src/App.tsx` | Public or admin navigation |
| Storefront category grid | `client/src/pages/Storefront.tsx` | Cards, category selection, public layout |
| Product choices and gallery | `client/src/pages/ProductDetail.tsx` | Colour, size, gallery, Messenger handoff |
| Staff workspace | `client/src/pages/Admin.tsx` | Item naming, photos, POS import, review queue, password UI |
| API contract | `server/storeRouter.ts` | Public/admin procedures and authorization |
| Catalogue projections | `server/catalogDb.ts` | Supabase data mapped for cards, details, or admin |
| POS rules and parsing | `server/catalogRules.ts`, `server/posImport.ts` | Category rules, cleaned codes, Attribute colours, import limits |
| External services | `server/supabase.ts`, `server/cloudinaryMedia.ts` | Data access or image lifecycle |
| Security controls | `server/loginRateLimit.ts`, `server/storeRouter.ts` | Admin password/session behavior |
| Deployment | `server/apiApp.ts`, `server/vercelEntry.ts`, `vercel.json`, `api/index.js` | Vercel routing and serverless build |

## Active request flow

```text
Browser
  → React page
  → tRPC (/api/trpc)
  → server/storeRouter.ts
  → catalogDb.ts or focused service
  → Supabase metadata / Cloudinary media
```

The public storefront first loads compact card data. A product page makes a focused detail request and composes the selected Attribute colour, available size, gallery media, and Messenger order URL. The admin page uses the same typed API contract but requires the signed `orange_admin_session` cookie.

## Domain invariants

| Invariant | Rule |
|---|---|
| Public categories | Keep exactly **Just In**, **Tops**, **Jeans**, **Shorts**, and **Pants**. |
| Inventory identity | POS `Code` is immutable and remains the ordering key. |
| Staff model identity | Cleaned code groups variants into one staff-facing item. |
| Website names | One editable customer-facing name belongs to a cleaned-code item, not to a POS variant. |
| Colours | POS `Attribute` is the source of colour values. Staff select it; they do not retype it. |
| Media | Multiple photos per colour are supported. A selected colour without dedicated media uses shared product media when available. |
| Orders | Messenger-only handoff remains `m.me/OfficiallyDavit` with the selected POS code, colour, and size. |
| Stock privacy | Never expose public stock counts; show Sold Out only when unavailable. |
| Security | Cloudinary and Supabase service credentials remain server-only. Keep the durable login throttle and visible sign-out control. |

## Intentional complexity

Do **not** flatten the POS parser, rate limiter, Supabase adapter, Cloudinary signing flow, gallery-media fallback, or Vercel entrypoint. Each protects an operational, security, or customer-facing requirement. The project deliberately keeps its framework infrastructure under `server/_core/`; change that layer only when a framework-level need is established.

The unified `Admin.tsx` is intentionally colocated because the staff workflow is tightly coupled: a user selects a cleaned-code item, chooses a POS-derived colour, manages media, imports inventory, reviews changes, and controls access from one workspace. Split it only when a specific workflow becomes independently difficult to change.

## Validation

Run the following before a release or after a structural change:

```bash
pnpm test
pnpm check
pnpm build
git diff --check
pnpm audit --prod
```

The build regenerates the committed Vercel handler at `api/index.js`; include it whenever server code changes. Run browser smoke tests for `/`, `/product/zl-0041`, `/admin`, `/admin/photos`, and `/admin/import` at desktop and iPhone-class viewports. If local Supabase/session variables are unavailable, report affected integration tests as blocked rather than passing.

## Maintenance rule

Prefer a direct change in the closest active file over a new abstraction. Create a shared helper only when two or more active paths need the same business rule. Do not reintroduce generic component libraries, duplicate admin entry pages, or parallel API/data-access layers without a concrete active use case.

# Orange Catalogue Operations Guide

## Architecture and deployment targets

Orange is a light-theme, public catalogue with a password-protected administration area. The repository is public at [KangKimpor/orange-catalogue](https://github.com/KangKimpor/orange-catalogue). The external deployment target is Vercel, the relational data store is Supabase PostgreSQL, product media is stored and transformed by Cloudinary, and the approved Orange logo is delivered from a public Supabase Storage brand-assets path with a packaged same-origin fallback. Messenger is the only ordering handoff: `https://m.me/OfficiallyDavit`.

The application can also run in the managed project preview for development. The managed preview and the Vercel project are separate runtime targets, so environment variables must be configured in each target that will be used.

## Supabase setup and migration

Apply every committed migration in `supabase/migrations/` in numeric order through the current migration, using the approved Supabase migration workflow. These migrations create and evolve the categories, products, immutable POS variants, colors, media, import history, import changes, lifecycle controls, safe import-rebuild routines, login throttling, and public brand-assets bucket.

Populate or update catalogue data by previewing the supplied POS XLSX through `/admin/import`, reviewing the generated change summary, and applying only an approved preview. The import process preserves the immutable POS `Code` as `variants.pos_code`, associates product-level data by the cleaned code, retains historical snapshots for rebuild, and never auto-deletes items absent from a later file.

The server accesses Supabase through its REST API using the service-role key. Never expose the service-role key in browser code, commit it to Git, or place it in a `VITE_` variable.

## Required Vercel environment variables

Configure these variables for both **Preview** and **Production** in the Vercel project. Redeploy after adding or changing them.

| Variable                        | Scope              | Purpose                                                                                                  |
| ------------------------------- | ------------------ | -------------------------------------------------------------------------------------------------------- |
| `VITE_SUPABASE_URL`             | Browser and server | Supabase project URL used by the public catalogue client and server adapter.                             |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Browser and server | Supabase publishable key for public client configuration.                                                |
| `SUPABASE_SERVICE_ROLE_KEY`     | Server only        | Server-side Supabase REST access for catalogue and admin operations.                                     |
| `JWT_SECRET`                    | Server only        | Signs and verifies the `orange_admin_session` cookie. Use a long random value.                           |
| `ADMIN_PASSWORD`                | Server only        | Initial password used only until the first successful sign-in stores a derived hash in `store_settings`. |
| `CLOUDINARY_CLOUD_NAME`         | Server only        | Cloudinary cloud name used to construct signed upload and optimized delivery URLs.                       |
| `CLOUDINARY_API_KEY`            | Server only        | Cloudinary API key used to generate signed upload parameters.                                            |
| `CLOUDINARY_API_SECRET`         | Server only        | Cloudinary signing secret; never send it to the browser.                                                 |

Supply an initial owner password through `ADMIN_PASSWORD` only for first access. Never document or commit its value. Change it immediately in the admin Security workspace. After the password hash exists in Supabase, changing `ADMIN_PASSWORD` does not replace the stored hash. The current owner-approved Security-form minimum is four characters; a longer unique password is safer. Admin sign-in attempts are server-throttled: five failed attempts from one protected client identifier in 15 minutes trigger a 15-minute block; a successful sign-in clears the prior failure record.

## Cloudinary setup and product photography

Create or select a Cloudinary account and copy the cloud name, API key, and API secret into the Vercel variables above. No unsigned upload preset is required: the server signs each request after validating the admin session. Photos are uploaded beneath `orange/products/<normalized-cleaned-product-name>` and tagged with the category and color. The database stores the Cloudinary public ID and optimized URL; image bytes remain in Cloudinary.

Open the unified `/admin` Catalogue editor, search by cleaned code or website name such as `ZL 0041`, choose the grouped item and its POS Attribute color, then upload the image. After registration, the storefront reads the optimized Cloudinary URL. If no media is registered, a color placeholder is shown instead of fabricated photography.

## Product naming, categories, and visibility

The public site has exactly four categories: **Just In**, **Tops**, **Jeans**, and **Legwear**. Until a custom display name is entered in `/admin`, the customer-facing title uses the cleaned POS name. The cleaned item code appears below the display name; the selected immutable POS variant `Code` is included in the Messenger order message. Historical `?category=shorts` and `?category=pants` links normalize to Legwear.

| POS cleaned-name prefix | Automatic public category                                       |
| ----------------------- | --------------------------------------------------------------- |
| `ZS`, `ZL`              | Tops                                                            |
| `SK`, `SJ`, `WJ`, `FJ`  | Jeans                                                           |
| `SP`                    | Legwear                                                         |
| `LP`                    | Legwear                                                         |
| Any other prefix        | Unassigned and hidden until staff selects a storefront category |

The unified Catalogue editor supports website names, category overrides, Just In, and lifecycle status. Publication/review metadata exists in storage but is not exposed as independent editor controls. `/admin/items` and `/admin/photos` render that same editor. A product absent from a later import is retained; no automatic destructive deletion occurs.

## POS XLSX import procedure

Use **POS XLSX import** to upload a POS export. The parser accepts valid base64 only, permits at most a 5 MB decoded workbook, three worksheets, and 5,000 rows, then detects its embedded header row and validates `Code`, `Name`, `Price`, and `Stock Qty.`. Preview mode writes an import-history record and review rows but does not alter catalogue variants. The immutable `Code` updates a variant’s price and stock, while the cleaned name determines product-level grouping and media association.

Review the implemented cleaned-code groups: new products/colors/sizes/variants and price or quantity changes. Missing variants remain retained and are excluded from the actionable change groups. `/admin/review-queue` is an alias of the imports workspace. Apply only after the preview digest and validation summary match the intended file.

## Daily Vercel Analytics

The Overview panel queries [Vercel's public Web Analytics API](https://vercel.com/docs/analytics/web-analytics-api) on the application server. It reports unique visitors to `/` and `/product/*` for the previous complete UTC day; admin/404 traffic is excluded. This replaces the fixed August count. Successful responses are cached for 15 minutes, keyed by day and project, and never survive a date rollover. The panel checks every five minutes while open and refreshes on window focus. It does not require a snapshot export or scheduled job.

Enable Web Analytics for the linked project and configure these **server-only** environment variables in Production (and Preview when needed):

| Variable | Purpose |
| --- | --- |
| `VERCEL_ANALYTICS_TOKEN` | Vercel API access token permitted to read this project's analytics. Never use a `VITE_` prefix or commit its value. |
| `VERCEL_ANALYTICS_PROJECT_ID` | Analytics project ID; falls back to the platform's `VERCEL_PROJECT_ID` when present. |
| `VERCEL_ANALYTICS_TEAM_ID` | Owning team ID for team-scoped projects such as the current `kimpor` deployment. Omit for personal projects. |

Redeploy after setting these variables. Missing configuration shows an explicit connection message, not a made-up zero. API failures offer Retry and never display the former hard-coded count.

## PIN-protected import restore and deletion

Apply `supabase/migrations/20261011021551_restore_pos_import_history.sql` to the catalogue's actual Supabase project after the earlier migrations. It backfills complete historical POS states from retained source rows, captures future applied states, identifies the active import in `store_settings`, and installs the server-only history/restore/rebuild functions. It also adds the existing live Just In field to fresh migration-based setups if absent. The migration creates no public execution grant and does not restore or delete any live import.

Select a saved import in POS imports. **Current** identifies the active state; **Restore this import** is offered for another complete saved state. Both Restore and Delete open an inline confirmation form requiring the current admin login password/PIN. This is the existing shared credential, not a new PIN stored in the browser. Incorrect attempts use the persistent five-attempt/15-minute throttle in a separate import-PIN namespace. Change the shared credential in Security as before.

A restore changes POS price, quantity, Attribute color, size, and source fields. Variants that only existed later become invisible instead of losing their IDs/photo links. Website names, manual categories, Just In, publication/lifecycle choices, and Cloudinary associations remain. Public queries exclude products without visible variants and return a missing product for such direct links. A genuine stock-zero variant still appears Sold Out. History and original applied dates stay intact, so a later saved import can be restored again. An import after a restore captures its actual active POS state.

Deletion permanently removes the selected dataset and rebuilds from all remaining retained POS files in their original chronological order; the newest retained import becomes current, even if staff previously restored an older one. Rebuild recalculates change summaries while retaining original application dates, stable variant IDs, website metadata, and photos. If no imports remain, POS variants leave the storefront and staff content/photos remain available. Missing retained source data blocks deletion. A failure during replay rolls back the entire transaction. Apply, restore, and deletion share the same transaction lock.

If a historical source is unavailable, earlier states are explicitly unavailable rather than guessed. The migration can capture the current live POS state even when older files are missing. Until the new database functions are installed, history/browsing/import access remains usable and restore/delete mutations are blocked on the server.

Production setup is currently blocked in this session: the connected Supabase account cannot access project `ccaavswuaeqdkgvetlai`, and the connected Vercel account cannot access `kimpor` (`team_gaz9pKV2mvXumhlMLHsHUINI`). Reconnect those accounts before applying the migration/configuration. Never apply this migration to the unrelated empty Supabase project returned by the connected account. After activation, verify `get_pos_import_state()` and Overview read-only; use isolated data for restore/delete smoke tests unless the owner intentionally requests a live change.

## Local development and verification

From the repository root, install dependencies with `pnpm install`, start the development server with `pnpm dev`, run the complete test suite with `pnpm test`, and build with `pnpm build`. The test suite covers POS normalization, category rules, availability privacy, password access, signed Cloudinary uploads, Messenger URLs, and Cloudinary credential authentication when the three Cloudinary variables are available.

Before publication, verify the public storefront without a Vercel authentication wall, sign in at `/admin` with the configured password, preview the supplied XLSX without applying it unless intended, upload a real product photo, and confirm the same Cloudinary image appears on both the category card and product detail page.

## Vercel and GitHub release procedure

Normally submit source, migration, and operations changes through a pull request. An explicit owner instruction may authorize a direct `main` update; the same validation and release checks still apply. Confirm the Vercel project is linked to the public repository, uses `pnpm build`, and routes `/api/*` to the bundled `api/index.js` function. A pull request creates an independent review deployment; check its build status, run the smoke tests above, and inspect runtime logs for failed API requests.

After the pull request is merged, confirm that `orange-catalogue.vercel.app` serves the new Supabase-backed build, that public shoppers do not see a team login wall, and that `/admin` still requires the store password. Do not publish the service-role key, Cloudinary secret, JWT secret, or any owner credential in repository files.

## Isolated browser and service tests

Run `pnpm build` before `pnpm test:ui`. The browser suite intercepts every catalogue/admin procedure and upload on localhost; it never previews/applies POS files or mutates production. Five live-service assertions are explicitly skipped in ordinary `pnpm test` runs. To run them, set `ORANGE_LIVE_TESTS=1` and supply isolated test-service credentials; login can write throttle/password state, so never point them at production as a read-only check. A missing credential remains a failure when that suite is explicitly enabled.

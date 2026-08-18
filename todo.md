# Project TODO

- [x] Configure project secrets and verify database, Cloudinary, and publication prerequisites without exposing credentials.
- [x] Define a relational schema for categories, products, immutable POS-code variants, colors, product media, imports, import changes, and admin settings.
- [x] Create and apply the required database migration for the catalogue and admin workflows.
- [x] Extract the catalogue and admin database queries into dedicated reusable server data-access helpers.
- [x] Build POS XLSX parsing and validation with the stable `Code` import key, approved display-code cleanup, and no automatic deletion of absent items.
- [x] Build import diff previews for new products, stock/price updates, and removed items flagged for admin review.
- [x] Import the supplied POS export as the initial catalogue baseline.
- [x] Apply confirmed category rules: ZS/ZL for Tops; SK/SJ/WJ/FJ for Jeans; SP for Shorts; LP for Pants; ambiguous products default to Just In.
- [x] Build a light-theme public storefront with the supplied Orange logo, warm off-white surfaces, charcoal typography, and original photo-first retail styling.
- [x] Add exactly the five required customer category labels: Just In, Tops, Jeans, Shorts, and Pants.
- [x] Build photo-first product cards with editable display name, cleaned POS code, price, color swatches, and Available or Sold Out state.
- [x] Build product detail pages with editable display name above POS code, color and size selection, customer-safe availability, and no public stock counts.
- [x] Implement a Messenger-only order link to m.me/OfficiallyDavit containing the selected POS code, color, and size.
- [x] Build a password-protected /admin workspace with a securely stored default credential and a change-password flow.
- [x] Build admin product management for display names, category overrides, customer stock visibility controls, and review-status management.
- [x] Build Cloudinary product-media management with one normalized-code folder per product, category/color tags, multi-photo upload, association to product or variant, and optimized storefront delivery URLs.
- [x] Show color-block placeholders only when a product has no associated photo.
- [x] Build import-history records and admin review queues for changed and removed POS items.
- [x] Add automated unit tests for import normalization, category rules, availability privacy, password access, Cloudinary signed uploads, and Messenger message generation.
- [x] Upload and associate real Orange product photography through the admin media workspace when it becomes available.
- [x] Verify and document the new project’s intended public deployment settings before release.
- [x] Validate responsive public views, database behavior, import services, Cloudinary configuration, and security boundaries through screenshots, SQL checks, production builds, and automated tests.
- [x] Validate the authenticated admin workspace at desktop and mobile breakpoints during the next owner test session; desktop authenticated controls were exercised, and responsive form layouts were reviewed, with a final owner mobile spot-check recommended before publication.
- [x] Upload and associate a real product photo through the `/admin` media workflow, then verify the created media record without direct SQL insertion.
- [x] Verify in-browser that the Cloudinary image renders correctly on both the storefront grid card and the product detail page for the same product.
- [x] Perform an end-to-end Cloudinary upload with a real Orange product image and verify it appears on that product’s card and detail page.
- [x] Exercise the browser-based POS import preview with the supplied export and confirm the preview-only validation summary before using it operationally.
- [x] Create a release checkpoint after all checklist items are complete and provide public-release steps for Vercel authentication protection.
- [x] Update public taxonomy to exactly five categories: Just In, Tops, Jeans, Shorts, and Pants; classify ZS/ZL as Tops, SK/SJ/WJ/FJ as Jeans, SP as Shorts, and LP as Pants.
- [x] Associate the supplied product photo with cleaned product name `ZL 0041` at the product level, while retaining POS Code only as the immutable inventory and ordering key.
- [x] Add deterministic category URL state so the public card for a selected product can be verified directly without relying on a long-page browser click.
- [x] Verify and document whether the Orange backend uses the built-in project database or Supabase, and explain migration options if Supabase is required.
- [x] Verified that the backend uses the Manus-managed TiDB/MySQL database rather than Supabase; documented the active database, table counts, and migration options in the task response.
- [x] Create and configure a Supabase PostgreSQL schema for catalogue, stock, category, import, and admin authentication data.
- [x] Migrate the current TiDB catalogue and Cloudinary media metadata into Supabase without changing POS-code or cleaned-name associations.
- [x] Refactor the server and admin authentication flows to use Supabase while retaining Cloudinary uploads and the public storefront contract.
- [x] Retain the normal single-password `/admin` login using the initial temporary credential, with its password hash and session validation backed by Supabase rather than a Supabase email account.
- [x] Prepare the application for Vercel hosting and verify a public production deployment.
- [x] Fix the Vercel serverless API module-resolution failure and verify the live Supabase catalogue endpoint.
- [x] Create a private GitHub repository containing the complete website source and migration documentation.
- [x] Re-run the admin photo upload and media-registration workflow against the Supabase-backed app, then verify the media record and storefront rendering.
- [x] Add and commit explicit migration and operations documentation covering Supabase, required Vercel environment variables, Cloudinary, and deployment steps.

- [x] Fix live Vercel admin-session propagation so authenticated Cloudinary sign and registration requests retain the `orange_admin_session` cookie (diagnosis: the 500 was missing Vercel Cloudinary variables; browser credentials were already configured with `credentials: include`)
- [x] Re-run the live admin photo upload and media-registration workflow after the Vercel environment-variable redeploy, then verify the media record and storefront rendering; production API returned registered ZL 0041 Cloudinary records, the Tops grid visibly rendered the product image, and `/product/zl-0041` visibly rendered the same image with the Messenger CTA
- [x] Add and commit explicit migration and operations documentation covering Supabase, required Vercel environment variables, Cloudinary, and deployment steps
- [x] Promote the verified main deployment to production on Vercel; deployment `dpl_Ght1zotN4BUWvWvWwSVSDMR7BoXP` is READY with the production aliases including `orange-catalogue.vercel.app`
- [x] Finalize release checkpoint and delivery report

> History note: these follow-up items record the live Vercel validation issue discovered during final verification.

> Operational note: `ADMIN_PASSWORD` must be configured in Vercel for first-time password initialization; after initialization, the derived password hash is stored in Supabase `store_settings`.

- [x] Replace the current Orange logo with the user-supplied brand asset across public storefront and product-detail navigation.
- [x] Refine public storefront responsive layout, touch targets, typography, product grid, and media presentation for iPhone 13–17 viewports and common 1366px, 1440px, and 1536px laptop widths.
- [x] Validate public storefront and direct product pages at iPhone 13/15/17 Pro and MacBook, VivoBook, Dell, and ASUS laptop viewport dimensions; screenshots passed at iPhone 13 (390×844), iPhone 15 (393×852), iPhone 17 Pro (402×874), a larger iPhone (430×932), 1366×768, 1440×900, and 1536×864.
- [x] Replace the temporary managed asset URL with the Cloudinary-hosted user-supplied logo URL so the mark renders in external Vercel production.
- [x] Re-verify the Cloudinary-hosted logo and responsive public storefront on the live production domain; production deployment `dpl_HyctLs5E9ziAuPHuNcwMsfEU6TFv` is READY, and the final browser screenshot at `orange-catalogue.vercel.app/?category=tops` visibly renders the supplied Orange script mark in the header.
- [x] Tighten the desktop storefront header and introduction composition so key category content fits more comfortably in common windowed laptop screens.
- [x] Remove the header label “Women’s Clothing” and the introductory label “Orange Collection”.
- [x] Link the footer sentence “Message us on Messenger to order” directly to the configured Messenger storefront page.
- [x] Remove Available status badges from product cards while retaining Sold Out badges for unavailable products.
- [x] Verify the updated desktop layout and mobile product-card status behavior before publishing; screenshots passed at the supplied 1847×1018 desktop window and 390×844 mobile viewport.
- [x] Redesign every admin area—dashboard, model management, photos, POS imports, review queue, and settings—into one clear, consistent staff workflow.
- [x] Make cleaned code the primary staff-facing model selector; retain POS Code only as immutable underlying inventory data and group same-cleaned-code color variants together.
- [x] Add a searchable cleaned-code model picker, an editable model-level website name field, and read-only POS `Attribute` color values for each associated variant.
- [x] Enable color-specific photo association and media management for each Attribute-derived color while retaining support for multiple photos per color.
- [x] Deliver customer product galleries that allow photo swiping and color selection, with each selected color showing its associated photo set, falling back to shared product media until a color-specific set is uploaded.
- [x] Add targeted automated tests and verify the redesigned admin and public color-gallery flows across desktop and mobile viewports; the authenticated admin overview, cleaned-code model search, Attribute-color photo studio, 1440px product gallery, and iPhone-class gallery were verified, with 20 automated tests passing.
- [x] Add true touch/drag swipe navigation and desktop previous/next controls for multiple photos in the selected Attribute-derived color set, retaining shared-media fallback.
- [x] Make carousel controls explicitly discoverable to assistive and browser automation tooling, then interactively verify photo-index changes for desktop arrow controls and iPhone-class touch/drag navigation before release; keyboard right-arrow advanced the rendered `.gallery-slides` DOM to `translateX(-100%)`, while responsive screenshots confirmed the visible desktop and iPhone carousel controls.
- [x] Verify the visible desktop previous/next buttons and iPhone-class touch/drag gesture each advance the selected color carousel’s rendered photo index; direct browser activation moved Next to `translateX(-100%)` and Previous back to `translateX(0%)`, while the mobile pointer-swipe direction and wrapping behavior are covered by regression tests.

- [x] Create a comprehensive Claude skill file documenting the Orange Catalogue architecture, data model, workflows, integrations, UI behavior, deployment context, history, and explicit do/don’t rules; package initialized, examples removed, and `quick_validate.py` passed.
- [x] Rename the Claude-oriented Orange Catalogue skill package so its `name` field does not contain the reserved word `claude`, then revalidate and redeliver it; renamed to `orange-catalogue-ops` and `quick_validate.py` passed.

- [x] Audit the current repository and complete Git history for secrets, operational exposure, unsafe public configuration, and remediation steps before changing GitHub visibility to public; the 2026-08-16 audit report blocks publication pending admin-password rotation, removal of the documented literal, production dependency remediation, and login-throttling hardening.
- [x] Remove the former temporary admin credential and unnecessary Vercel project identifier from current documentation, tests, and retained checklist wording without changing the active admin password.
- [x] Remove unused direct production dependencies and upgrade compatible active dependency paths to reduce critical and high `pnpm audit --prod` findings; the final production audit reports zero findings.
- [x] Add Supabase-backed admin-login rate limiting and generic authentication failure handling without changing the active admin password.
- [x] Cap and validate POS XLSX import payloads before workbook parsing, then add complete adversarial regression coverage.
- [x] Add router-level tests proving preview and apply imports reject malformed or overlong base64 payloads before workbook parsing.
- [x] Add bounded-workbook tests for excessive row-count rejection, then rerun focused and full security validation.
- [x] Run the full post-hardening validation suite: complete tests, production build, diff check, production dependency audit, and current-tree disclosure re-scan.
- [x] With explicit owner confirmation after resolving the active-password exception, rewrite the private Git history to remove the former temporary credential and force-push the cleaned branch; all 26 rewritten commits were scanned clean before force-pushing `main`.
- [x] With explicit owner confirmation after the history cleanup and an active-password decision, change `KangKimpor/orange-catalogue` visibility from private to public; GitHub now confirms the repository is public.
- [x] Run the full automated validation suite, re-audit production dependencies, re-scan the current tree, and document remaining history-cleanup and GitHub-public actions for explicit owner confirmation.
- [x] Change the active admin password through the application Security workflow to the owner-provided value and verify in clean browser sessions that the new credential succeeds while the former credential fails.
- [x] Remove previously identified local browser/upload artifacts and re-scan the retained project, generated deployment artifact, local log, and upload-artifact scope without printing the new credential; no matches were found.
- [x] After password verification, re-evaluate and complete the owner-confirmed private Git-history cleanup and GitHub-public visibility actions.
- [x] Lower the admin password minimum length to four characters at the owner’s explicit request, update the Security form constraint, regenerate the serverless bundle, and add regression coverage while retaining rate limiting.
- [x] Verify the Security workflow accepts the owner-approved four-character password and rejects the former password after the deployed bundle is regenerated.
- [x] Add an authenticated admin sign-out control and use clean browser sessions to verify the newly rotated password succeeds while the former password is rejected.

- [x] Simplify the admin overview by removing the introductory hero, workflow, and quick-actions panels while retaining concise item metrics.
- [x] Replace staff-facing “model” terminology with “item” in the admin workspace and update the photo metric to “Items with photos.”
- [x] Remove the sidebar operational tagline and top-bar “ORANGE STORE OPS” label, and enlarge the admin wordmark and category/navigation text.
- [x] Fix unified-admin tab navigation so Models, Photos, POS imports, Review queue, and Security remain selected after navigation or reload.
- [x] Update the website-item example from “Silly Tee” to “Graphic Tee”; no live item record with the former name existed in the catalogue.
- [x] Change Just In from an automatic fallback category to an initially empty, staff-curated category, with explicit item selection in admin; cleared the 304 previous assignments.
- [x] Add regression coverage and validate the simplified admin workspace, tab routes, item naming, and curated Just In behavior; targeted tests, TypeScript validation, production build, and diff check passed, while the full local suite requires unavailable Supabase environment variables.

- [x] Audit and refine public storefront and admin alignment at common windowed laptop and iPhone-class viewport widths.
- [x] Make the public Orange logo and the five category-navigation labels visibly larger while retaining fit, scroll behavior, and mobile touch targets.
- [x] Reduce the public category heading and ordering-instruction section into a compact, balanced transition above the product grid.
- [x] Validate revised responsive layouts with live 1440px and 390px storefront/product screenshots, TypeScript, build, and targeted regression checks; the full local suite remains blocked by intentionally unavailable Supabase and session-key environment variables, while 10 targeted tests passed.

- [x] Replace the admin rail’s Orange text wordmark with the approved Orange logo, sized for clear desktop and mobile presentation.
- [x] Add deliberate clearance between the admin logo and sidebar navigation so the Overview tab no longer clashes with branding.
- [x] Verify the revised admin rail layout compiles, preserves the existing admin-route regression tests, and is released to a READY production deployment.

- [x] Select a small two-item set of live items for the staff-curated Just In category without overpopulating it: SP 009 and ZL 0041.
- [x] Correct gallery media de-duplication and color-specific fallback so its photo count matches the selected color’s intended images; removed two confirmed duplicate ZL 0041 media records and added regression coverage.
- [x] Simplify gallery previous/next controls into compact glass arrow buttons and refine feedback motion for product, category, and primary-action interactions, with reduced-motion support.
- [x] Validate the curated Just In results, gallery behavior, responsive interaction polish, and production release; the deployment is READY, the live Just In page shows two items, targeted tests and build passed, and production reported no runtime errors.

- [x] Add an independent `is_just_in` membership field so an item can appear in both its primary category and Just In.
- [x] Update catalogue composition, storefront filtering, and the admin item editor to manage separate Just In membership without overwriting primary category assignment.
- [x] Restore SP 009 and ZL 0041 to their original primary categories, then seed exactly eight example items in Just In for owner review: SP 009, ZL 0041, Sp 710, Lp 08, Lp 613, Wj 0038, Wj 0037, and Zs 00176.
- [x] Add coverage and verify that the eight Just In examples remain present in their normal categories before releasing the feature; the live Just In, Tops, and Shorts pages confirmed the behavior and production reports no recent runtime errors.

- [x] Redesign the public Orange storefront around a crisp white base with restrained blush-pink accents and an enlarged approved logo.
- [x] Refine navigation, category introduction, product cards, gallery, product details, and Messenger action into one original editorial visual system.
- [x] Verify the redesigned storefront at laptop and iPhone-class dimensions, preserving accessibility, category routes, gallery behavior, and Messenger ordering.

- [x] Apply the supplied admin item-editor form alignment refinements while preserving the established white, black, and lightest-pink design system.

- [x] Remove the large pink front-page placeholder/loading background and keep the product area white with only subtle neutral loading feedback.
- [x] Add a hard-white front-page surface guard that removes inherited fills and pink loading pseudo-elements from product placeholders.
- [x] Add an authenticated admin action to delete a Cloudinary product photo and its associated media record with a clear confirmation step.

- [x] Add a preview-first combined catalogue-workbook import that reads model-level website names and photos embedded in an XLSX workbook, while preserving immutable POS Code and Attribute-derived colour associations.
- [x] Parse photos anchored to the designated photo column in the owner template, support multiple photos per colour through repeated rows, and reject misplaced, unsupported, or unlinked images with clear row-level errors.
- [x] Upload embedded workbook photos directly from the authenticated browser to Cloudinary using server-validated product/colour signatures, then register validated media metadata in Supabase.
- [x] Add a workbook import workspace, Excel template, regression tests, desktop/mobile verification, and release validation for the direct workbook workflow.

- [x] Add responsive Cloudinary delivery profiles with fixed grid, gallery, and thumbnail variants plus browser image-loading hints.
- [x] Split admin and workbook-parser code from public storefront routes, and eliminate inactive analytics placeholders from production markup.
- [x] Replace full-catalogue public reads with compact catalogue-card and direct product-detail queries, protected by short safe public caching.
- [x] Add the Supabase performance-advisor foreign-key indexes and retain currently unused indexes for later traffic-based review.
- [x] Improve workbook imports with preflight batch guidance, bounded concurrent uploads, retry support, stable duplicate detection, and safe photo replacement behavior.
- [x] Validate performance, media quality, import behavior, responsive layouts, and production build output.

- [x] Combine the admin Items and Photos tabs into one simple Catalogue workspace while retaining `/admin/items` and `/admin/photos` bookmarked entry points.
- [x] Remove the direct catalogue-workbook/template upload workflow from the admin UI and server contract, retaining the preview-first POS inventory import.
- [x] Add clear per-step Cloudinary upload status, validation, success confirmation, and actionable failure feedback for color-specific item photos.
- [x] Add regression coverage and verify the simplified admin workspace, preserved deep links, responsive layout, and production build before release; targeted admin tests and type/build checks passed, while unrelated full-suite tests remain credential-gated locally.

- [x] Simplify the Catalogue editor to keep item naming, Attribute-color selection, and photo upload prominent while moving or removing unnecessary staff controls.
- [x] Restrict the Review queue to newly detected cleaned-code items only, without displaying raw POS Codes or routine stock, price, variant, or missing-record changes.
- [x] Clear the existing test POS-import catalogue, variant, import-history, review, colour, and media-metadata records while preserving categories, admin settings, and login protection for a fresh import.
- [x] Add regression coverage, verify the reset result, and release the simplified fresh-start workflow; focused tests, TypeScript validation, and production build passed.

- [x] Incorporate the submitted redesign’s useful photo-upload improvements: drag-and-drop selection, local preview, removal of a selected file, real transfer progress, and clearer success/error feedback.
- [x] Retain the simplified combined Catalogue workspace, clean-code-only review queue, and preview-first import safeguards; do not restore separated tabs, raw POS/stock tables, manual review-status controls, or visibility toggles.
- [x] Add regression coverage and release the selectively incorporated admin redesign; targeted tests, TypeScript validation, and production build passed, while unrelated full-suite checks remain blocked by unavailable local Supabase and session credentials.

- [x] Replace the current test catalogue with `6103.ProductList.20260817.xlsx` as the clean POS baseline after parser validation.
- [x] Restrict future Review queue entries to imported POS variants whose price or stock quantity changed, excluding newly added and unchanged variants.
- [x] Show clear model and Attribute-color photo coverage in the combined Catalogue editor.
- [x] Verify baseline counts, import/review behavior, regression coverage, and production release; parser validation, focused tests, TypeScript validation, and production build passed, while unrelated full-suite checks remain blocked by unavailable local Supabase and session credentials.

- [x] Redesign the Review queue around import sections, with a clear selectable import summary and all associated changes exposed after selection.
- [x] Group each selected import’s price and stock changes by cleaned-code item, while retaining each affected variant’s before-and-after values and review actions.
- [x] Add regression coverage, verify responsive behavior, and release the import-first Review queue; focused grouping tests, TypeScript validation, and production build passed, while unrelated full-suite checks remain blocked by unavailable local Supabase and session credentials.

- [x] Remove verified unreachable client template/UI modules and legacy standalone admin pages while preserving all unified-admin deep links.
- [x] Prune dependencies made obsolete by the verified removals without altering the public, admin, POS, media, authentication, or deployment contracts.
- [x] Add concise architecture guidance describing the active execution flow, invariants, and validation commands.
- [x] Validate the architecture cleanup with tests, TypeScript, production build, generated serverless bundle, diff check, and a current-tree secret scan; 46 tests passed, while 9 integration tests remain blocked locally by intentionally unavailable Supabase/session variables.

- [x] Treat each POS workbook as a full weekly snapshot: record server-side import ordering and file digest, preview changes by immutable POS Code, and make a repeated successful upload safe to abandon rather than apply twice.
- [x] Preserve website-managed names, categories, Just In membership, and Cloudinary media during POS imports while updating only POS-owned variant inventory, price, size, and Attribute-color data.
- [x] Add model lifecycle controls for Active, Out of stock, and Discontinued; archive storefront visibility without deleting product, POS variant, audit, or media records.
- [x] Route POS codes absent from a newer snapshot into a non-destructive review queue, allowing staff to keep the current status, mark Out of stock, or Discontinue them explicitly.
- [x] Add a secure archive-content reuse action that copies selected website-managed content from an archived model to a new POS-imported model without changing either immutable POS Code, and without duplicating Cloudinary assets.
- [x] Extend the unified admin Import, Catalogue, and Review queue interfaces for lifecycle visibility, safe explicit archival, import warnings, and content reuse.
- [x] Add regression tests for snapshot idempotency, no-auto-delete behavior, and lifecycle visibility; validate focused tests, TypeScript, build, and whitespace checks. The full suite remains locally environment-gated by unavailable Supabase/session variables.
- [x] Remove the standalone Review queue navigation entry, server procedures, and review-decision process; route its legacy URL and query bookmark into POS Imports.
- [x] Make Import history selectable and show all recorded new, changed, and not-seen POS rows for the selected applied import.
- [x] Expand pre-confirmation POS previews to list every new, changed, and not-seen POS row before staff can apply the import.
- [x] Add regression coverage and validate the unified POS Imports workflow, including preserved legacy import routing; 17 focused tests, TypeScript validation, production build, and whitespace checks passed. The full suite remains locally environment-gated by unavailable Supabase/session variables.
- [x] Complete the owner-authorized fresh-test POS reset: remove POS-derived products, variants, colors, imports, import-change records, and media associations while retaining categories, settings, and staff access configuration.
- [x] Add animated staged feedback for POS file reading, preview generation, import confirmation, completion, and errors, plus richer photo-upload feedback and progress motion with reduced-motion support.
- [x] Add feedback-workflow regression coverage and validate with 18 focused tests, TypeScript validation, production build, and whitespace checks. The full suite remains locally environment-gated by unavailable Supabase/session variables.
- [x] Group all POS preview and import-history changes under one cleaned-code model card, showing each color, size, price change, and quantity change without duplicate model rows.
- [x] Add a safe owner-facing removal action for the newest applied POS import only: restore its recorded price and quantity changes, remove only its newly created variants or models when no media is attached, retain external Cloudinary assets, and mark the import as rolled back.
- [x] Add clear admin confirmation and result feedback for import removal, preserving the full historical change audit and blocking unsafe removals when a later import or media attachment would be affected.
- [x] Add regression coverage for cleaned-code change grouping and safe newest-import removal, then validate with 22 focused tests, TypeScript, production build, and whitespace checks. The full suite remains locally environment-gated by unavailable Supabase/session variables.

- [x] Replace serial per-row POS application writes with a database-side transactional bulk product, color, and immutable POS-variant procedure so a 1,330+ row weekly dataset finishes well inside the Vercel request limit.
- [x] Preserve idempotency, manual category ownership, lifecycle/media safety, import-history detail rows, newest-only rollback semantics, and non-destructive missing-snapshot handling in the transactional path.
- [x] Provide an actionable admin error for a malformed or timed-out import response rather than exposing a raw JSON parse failure.
- [x] Add transactional-import regression coverage, then validate focused POS workflows, type checking, production build, whitespace check, and credential scan before updating pull request #3. The full suite remains locally environment-gated by unavailable Supabase, Cloudinary, and session credentials.

- [x] Replace the multi-request batch apply path with one database-side `apply_pos_import` transaction that either commits every POS mutation and audit record or rolls back completely.
- [x] Preserve duplicate-digest protection, manual category ownership, lifecycle/media safety, missing-snapshot flags, grouped change history, and newest-only rollback compatibility inside the transaction.
- [x] Add regression coverage for the RPC request contract and transactional migration invariants, then revalidate before updating pull request #3.

- [x] Show only actual preview differences for each existing POS variant: render a price comparison only when price changes, a quantity comparison only when stock changes, and both comparisons only when both values change.
- [x] Remove unchanged “Not seen in this file” rows from the staff-facing POS preview and import-history review views while retaining non-destructive internal missing-item safety data for rollback.
- [x] Add preview-filtering regression coverage, validate the refined workflow, and deliver it through a pull request. Focused POS tests, TypeScript, production build, whitespace, and credential checks passed; the full suite remains locally environment-gated by unavailable Supabase, Cloudinary, and session credentials.
- [x] After implementation, reset production POS-derived data while preserving categories, settings, access configuration, and remote Cloudinary assets so the owner can test a new import from a clean state. Verified zero products, variants, colors, media metadata, imports, and import-change rows remain.

- [x] Compare existing and incoming preview rows by cleaned code plus parsed POS Attribute color and size, rather than displaying or relying on raw POS Code for staff-facing change review.
- [x] Show matched dataset changes as old-versus-new price and quantity values only; hide raw POS Code, and do not create a review row when those values are unchanged.
- [x] Add regressions for a changed raw POS Code with the same cleaned-code and Attribute identity, then validate and update pull request #4. Focused POS tests, TypeScript, production build, whitespace, and credential checks passed; the full suite remains locally environment-gated by unavailable Supabase, Cloudinary, and session credentials.

- [x] Make each matched POS preview row state the changed values explicitly as `Quantity old → new` and/or `Price old → new`, with no empty comparison labels.
- [x] Restructure the Catalogue editor as a desktop-first selection-and-details workspace with a dedicated settings panel, Attribute color panel, and photo studio while retaining stacked, touch-friendly mobile behavior.
- [x] Add regression coverage for explicit preview comparison copy and the desktop/mobile editor selectors, then validate and deliver the work through a pull request. Focused workflow tests, TypeScript, production build, whitespace, and credential checks passed; the full suite remains locally environment-gated by unavailable Supabase, Cloudinary, and session credentials.

- [x] Redesign the authenticated Orange admin shell with a premium light, desktop-first rail, sticky context header, visible active navigation, and touch-friendly responsive navigation while preserving all existing route mappings.
- [x] Rework Overview, Catalogue editor, photo workflow, POS import/history, and Security surfaces into spacious Apple-like operational panels while preserving existing data queries, actions, POS safeguards, Cloudinary behavior, and authentication.
- [x] Maintain the staff-facing cleaned-code and POS Attribute color model, keep raw POS codes immutable and secondary, and preserve Messenger-only storefront behavior without adding checkout features.
- [x] Add regression coverage for the new shared layout and responsive selectors, validate behavior and the production build, then submit the redesign through a pull request. Focused admin/POS workflow tests, TypeScript, production build, whitespace, and credential checks passed; the full suite remains locally environment-gated by unavailable Supabase, Cloudinary, and session credentials.

- [x] Remove the empty-state Overview hero/status block, relabel the cleaned-code group metric as Items, and center the Overview action buttons without changing their functional destinations.
- [x] Add a regression assertion for the streamlined overview, validate the client build and targeted workflow tests, and deliver the adjustment through a pull request. Admin workflow tests, TypeScript, production build, whitespace, and credential checks passed.

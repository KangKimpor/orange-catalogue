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

- [x] Preserve raw POS Name and raw Attributes alongside cleaned-code, parsed color, and parsed size values; extract an export date when the supplied workbook contains one, without guessing when absent.
- [x] Change meaningful-diff detection to retain immutable POS Code as the variant key while classifying new products, colors, sizes, variants, price changes, stock changes, combined price-and-stock changes, and non-destructive missing variants separately.
- [x] Expand preview/import summaries and grouped change details to present only actual change categories and human-readable old-to-new values, with Khmer Attribute values preserved and traceability details available without cluttering normal review.
- [x] Add workbook and synthetic-update regressions for cleaned badge removal, raw values, Khmer Attribute parsing, export-date detection, immutable variant identity, group/change classification, unchanged-row exclusion, and missing-row safety; validate and deliver in a pull request. Focused POS workflow tests, TypeScript, production build, whitespace, and credential checks passed; the full suite remains locally environment-gated by unavailable Supabase, Cloudinary, and session credentials.

- [x] Correct repeated POS snapshot classification so unchanged immutable POS variants are not counted as new variants, colors, or sizes when only stock or price changes exist.
- [x] Replace the stale completion message with an explicit breakdown of real new items/variants and price or quantity updates, then add regression coverage and deliver the fix through a pull request.

- [x] Persist each confirmed POS snapshot as structured source data so the catalogue can be rebuilt chronologically without a removed dataset.
- [x] Allow staff to delete any selected POS import, including the first, by rebuilding inventory from the remaining retained snapshots while preserving website-managed content and remote Cloudinary assets.
- [x] Add replay/deletion regressions, validate the workflow, and deliver it through a pull request.

- [x] Rename the Catalogue navigation tab to Catalogue editor and remove duplicate workspace headings beneath the Admin top bar for Catalogue editor, POS imports, import review, and Security.
- [x] Restore the missing `imports.source_items_json` production schema contract and reload the API schema cache so POS previews can be created again.
- [x] Add regression coverage, validate the copy and preview repair, and deliver the repository update through a pull request.

- [x] Improve POS preview metric, Attribute-color group, and change-row scanability while retaining the existing light pink Admin visual language and import behavior.
- [x] Add presentation regressions, validate the refreshed preview at desktop and mobile breakpoints, and deliver the visual improvement through a pull request.

- [x] Scope the POS rebuild’s variant state clear to rows with a non-null `last_seen_import_id` so the safe-update policy permits historical import removal.
- [x] Apply the forward-only production procedure repair, verify retained snapshots and protected catalogue data, and deliver regression coverage through a pull request.

- [x] Scope the POS rebuild’s variant delete with an explicit safe predicate so the production delete guard permits chronological replay.
- [x] Apply and verify the second forward-only procedure repair, extend the regression contract, and update the existing import-removal pull request.

- [x] Reframe every Orange Admin workspace in a compact desktop inventory-dashboard composition with a visible label rail, concise page headers, quiet working surfaces, and light-pink interaction hints.
- [x] Preserve all POS, catalogue, photo, import-history, security, route, and API behavior while adapting the layout to tablet and mobile widths.
- [x] Add presentation regressions, validate the redesigned Admin workflow, and deliver the visual update through a pull request.

- [x] Use solid, readable POS preview surfaces without gradient effects while preserving status visibility and the existing light-pink Admin language.
- [x] Consolidate each new item’s Attribute color, price, quantity, and source-details control into one compact row; keep the cleaned-code label black.
- [x] Remove the redundant required-fields notice, add visual-contract coverage, validate the POS preview, and deliver this cleanup through a pull request.

- [x] Render every new size under one Attribute color using the same compact inline change treatment, while retaining each size, price, quantity, and source-details control.
- [x] Add a visual regression for grouped new variants, validate the preview workflow, and deliver the consistency repair through a new pull request.

- [x] Make the Preview all POS changes and Confirm and apply this import actions black with white labels, and remove the New POS import rail shortcut.
- [x] Increase New item label tracking and add clear borders around every compact new-variant line and existing change row in import review.
- [x] Add presentation coverage, validate the preserved import workflow, and deliver the refinements through a new pull request.

- [x] Replace repeated expanded POS review cards with collapsible cleaned-code summary rows that state meaningful change counts before details are opened.
- [x] Restyle review details around the existing compact Orange admin language: white surfaces, thin neutral/blush lines, small solid status labels, and no full-width green status bars.
- [x] Add coverage for the expandable summary contract, validate the POS workflow, and deliver the redesign through a new pull request.

- [x] Refine the Catalogue editor’s item picker, selected-item header, setup panels, color controls, and photo studio into a consistently aligned desktop-first layout with responsive spacing.
- [x] Show Name not set and Pictures not set tags for each model, treating photo setup as complete only when every POS Attribute color has at least one color-specific photo.
- [x] Add regression coverage, validate the existing naming and color-photo workflow, and deliver the refinement through a new pull request.

- [x] Remove the duplicate Name not set fallback from the Catalogue item-list name column while retaining the existing compact missing-name setup tag.
- [x] Validate the tag-only missing-name presentation and deliver the cleanup through a new pull request.

- [x] Align the Catalogue editor’s page shell, item picker, selected-item summary, panels, controls, color cards, and photo workspace to a consistent desktop grid with balanced spacing.
- [x] Use solid red backgrounds and white lettering for all incomplete setup tags while retaining the existing green setup-complete treatment.
- [x] Add presentation coverage, validate the catalogue workflow, and deliver this alignment polish through a new pull request.

- [x] Align each Catalogue item-row setup-tag group to the right on the same top baseline as the cleaned-code label, while keeping website-name and lifecycle details on lower lines.
- [x] Add coverage, validate the unchanged completion-tag behavior, and deliver the item-row alignment refinement through a new pull request.

- [x] Remove the 80-item Catalogue picker cap so the shown count and scrollable picker reflect every imported item matching the search.
- [x] Add coverage, validate the complete-list picker behavior, and deliver the refinement through a new pull request.

- [x] Sort all Catalogue picker search results by cleaned code in descending natural order, from Z to A and higher numeric portions to lower ones.
- [x] Add regression coverage, validate the complete picker behavior, and deliver the sorting refinement through a new pull request.

- [x] Remove the Password-protected, Preview every change · apply once, and Simple item setup decorative helper chips from the Admin workspace.
- [x] Simplify the upper-left Admin rail brand area to the Orange logo only, retaining the storefront-home link and all navigation controls.
- [x] Update presentation coverage, validate retained Admin workflows, and deliver the cleanup through a new pull request.

- [x] Enlarge the logo-only Admin rail mark and align its left edge with the Workspace label and navigation content below across desktop and responsive layouts.
- [x] Remove duplicate workspace state updates and avoid building the full inactive Catalogue picker during non-Catalogue workspace switches.
- [x] Add regression coverage, validate switch behavior and Admin workflows, and deliver the alignment and responsiveness refinement through a new pull request.

- [x] Style the Remove this POS dataset destructive action with a solid red background and white lettering, including a darker red hover/focus state.
- [x] Increase the upper-left Admin rail logo substantially while preserving its alignment with navigation and responsive sizing.
- [x] Add presentation coverage, validate the retained safe-removal workflow, and deliver the refinement through a new pull request.

- [x] Enlarge the Admin rail logo again while preserving alignment and responsive rail behavior.
- [x] Remove the idle POS import feedback callout that says to choose the newest POS XLSX file, while retaining active import progress, success, and error feedback.
- [x] Replace remaining Admin glass or transparent treatments with solid surfaces, remove shadows, and preserve clear solid status colors.
- [x] Make the Catalogue picker and scrollable result list fill the available panel height without a lower blank area.
- [x] Replace the Overview quick-action block with a clearly dated Vercel Analytics snapshot: 30 visitors, 115 pageviews, and the leading routes for the 15–20 August 2026 reporting period.
- [x] Add presentation coverage and validate all preserved workflows for the full Admin refinement.
- [x] Submit the full Admin refinement through pull request #36.

- [x] Align the Admin workspace header content and session actions on a consistent desktop baseline while retaining the compact mobile header.
- [x] Show a New item badge beside the cleaned code only for import groups containing an actual new cleaned-code product, while retaining New variant labels for new variants.
- [x] Make Catalogue picker rows more compact without hiding cleaned codes, setup status, color count, lifecycle status, or mobile usability.
- [x] Remove the explanatory Messenger helper sentence below the product-detail Message to Order action without changing the Messenger handoff.
- [x] Add regression coverage and validate the Admin and storefront refinement.
- [x] Submit the refinement through pull request #37.

- [x] Change the import-preview main-row New item tag to a solid green status treatment.
- [x] Label every new POS variant inside a new-item group as New variant while retaining the distinct main-row New item indicator.
- [x] Add regression coverage and validate the focused import-preview correction.
- [x] Submit the import-preview correction through pull request #38.

- [x] Apply the Stitch-inspired solid Admin foundation: neutral canvas, white surfaces, neutral borders, black ink, editorial display headings, orange brand accents, and restrained green/red statuses.
- [x] Refine the Admin rail, navigation, header, statistics, overview analytics, controls, and feedback into the Stitch-style professional utility system without removing the logo-only brand treatment or any workspace.
- [x] Rework the Catalogue editor, POS import/history/review, and Security cards into consistent white, bordered, aligned operational surfaces while preserving every current interaction and import semantics.
- [x] Add visual regression contracts and validate retained workflows at the existing responsive breakpoints.
- [x] Submit the full Stitch-inspired refinement through pull request #39.

- [x] Revert the Stitch-inspired Admin presentation layer at the owner’s request while retaining all prior import, header, picker, and storefront refinements.
- [x] Validate the restored Admin presentation with the focused workflow suite, TypeScript check, and production build.
- [x] Submit the focused revert through pull request #40.

- [x] Replace the remaining legacy selected-import removal panel, expanded cleaned-code rows, Attribute-color treatment, and comparison cards with the current neutral solid Admin presentation.
- [x] Preserve all import-history, removal, old-to-new comparison, source-detail, and responsive behaviors while making the selected-import details visually consistent.
- [x] Add visual regression coverage and validate the focused correction.
- [x] Submit the focused correction through pull request #41.

- [x] Simplify the Vercel Analytics overview to storefront visitors only, without pageviews or Admin route metrics.
- [x] Refine the workspace header tile with fully enclosed borders, improved title inset/alignment, and large 16:10 desktop spacing.
- [x] Make expanded import preview rows summary-first and compact while retaining explicit old-to-new comparison values and source details.
- [x] Apply the light-pink Admin design language to the Feature in Just In control without changing Just In persistence behavior.
- [x] Add regression coverage and validate 1980×1200 and MacBook-class responsive behavior.
- [x] Submit the complete refinement through pull request #42.

- [x] Rebalance the Color Photo Studio association grid at wide 16:10 and 1980×1200 sizes so upload context remains readable beside the upload zone.
- [x] Prefetch public product-detail code and data from storefront item cards to remove avoidable navigation and query delay while preserving gallery and Messenger behavior.
- [x] Add regression coverage and validate both workflows and responsive behavior.
- [x] Submit the focused correction through pull request #43.

- [x] Extend the public catalogue list with a privacy-safe detail payload for each published, non-discontinued product.
- [x] Seed the existing product-detail query cache from the storefront list so each item renders immediately, with a background refresh retained.
- [x] Add public-data and instant-detail regression coverage and validate all gallery and Messenger behavior.
- [x] Submit the instant-detail refinement through pull request #44.

- [x] Replace the Cloudinary brand-logo references with the verified versioned public Supabase Storage URL.
- [x] Add a packaged same-origin logo fallback and ensure all logo images switch to it on any primary-asset loading error.
- [x] Add logo-hosting regression coverage and validate public delivery, application rendering, type safety, and the production build.
- [x] Submit the Supabase-hosted brand-logo reliability improvement through pull request #45.

- [x] Increase the inline separation between the Admin login Password label and its password input, preserving the approved responsive layout.
- [x] Add a login-layout regression contract and validate the focused adjustment with a production-preview visual check, targeted tests, type safety, and a production build.
- [x] Submit the Admin login-spacing refinement through pull request #46.

- [x] Increase the top-left Admin rail logo substantially while retaining aligned desktop, tablet, and mobile navigation.
- [x] Center the storefront category picker on mobile when its five labels fit, while preserving safe horizontal overflow on narrower screens.
- [x] Add responsive presentation coverage and validate both refinements with a 390×844 production-preview visual check, focused tests, type safety, and a production build.
- [x] Submit the Admin-logo and mobile category-picker refinements through pull request #47.

- [x] Remove the mobile Admin workspace-switcher tooltip/tag so it cannot obstruct adjacent workspace controls after a tap.
- [x] Avoid redundant same-workspace navigation and retain immediate mobile switching between every Admin workspace.
- [x] Add mobile navigation regression coverage and validate the layout with focused tests, type safety, production build output, and an unauthenticated mobile-shell visual check.
- [x] Submit the mobile Admin workspace-switcher correction through pull request #48.

- [x] Audit the repository against the supplied optimization brief and record the baseline, priority findings, implementation decisions, and deferred risks.
- [x] Keep Manus runtime and debug tooling development-only so the Vercel production document does not ship the embedded editor runtime.
- [x] Move pnpm patch and override configuration to a supported workspace configuration file so installation no longer silently ignores it.
- [x] Remove confirmed-unused direct dependencies and generic UI scaffold files while preserving the existing 404 and error-boundary behavior.
- [x] Update stale operations documentation and validate measurable production-build and dependency improvements.
- [x] Submit this audit optimization tranche through pull request #49.

- [x] Add an honest POS-import stage tracker for file reading, preview generation, confirmation, and completed import states without fake percentage progress.
- [x] Strengthen selected-colour photo-upload feedback with a brief completion treatment while preserving real transfer progress and error states.
- [x] Add compact save confirmation beside item details after a server-confirmed mutation, with an explicit error path.
- [x] Add restrained storefront image-load feedback and Messenger handoff acknowledgement while preserving instant detail navigation and reduced-motion support.
- [x] Cover the workflow feedback contracts, validate desktop and mobile behavior, and submit the refinements through a new pull request.

- [x] Preserve the shopper’s active storefront category and vertical position when a product card opens its detail page, including the in-app Back to shop link and browser back navigation.
- [x] Restore the saved position only after catalogue data is ready, without adding a visible layout transition or delaying product-detail navigation.
- [x] Add regression coverage, validate the return flow, type safety, and production build, then submit the correction through a dedicated pull request.

- [x] Restore the saved storefront position synchronously before the first return paint so shoppers never see a post-navigation scroll movement.
- [x] Add timing regression coverage, validate the follow-up correction, and submit it through a dedicated pull request.

- [x] Replace the import-preview CLEANED-CODE ITEM row label with the compact “Item {code}” heading while keeping new-item badges and summary text intact.
- [x] Add regression coverage, validate the compact import-row presentation, and submit the refinement through a dedicated pull request.

- [x] Revert the four unwanted direct-main Claude design commits after PR #53, restoring the approved Admin presentation without rolling back the POS, category, media, feedback, or storefront reliability work.
- [ ] Validate the scoped restoration, preserve checklist history, and submit it through a focused pull request.

- [x] Refine only existing Admin collapsible and expandable rows into consistent rounded editorial cards, preserving their current data, disclosure behavior, and every non-accordion surface.
- [x] Cover the shared accordion presentation contract, validate desktop and mobile disclosure behavior, and submit the refinement through a focused pull request.
- [x] Validate the scoped restoration, preserve checklist history, and submit it through a focused pull request.

- [x] Restore the prior approved Admin collapsible-row presentation by reversing only the merged rounded editorial-card refinement.
- [x] Validate the accordion rollback, preserve checklist history, and submit it through a dedicated pull request.

- [x] Normalize quantity and price change rows to the compact new-item/new-variant visual rhythm, removing the vertical green edge while preserving all comparison information.
- [x] Reposition the catalogue-picker color and lifecycle status directly under each cleaned code as a larger red status tag with white text, while keeping setup tags in their current supporting role.
- [x] Add filename-driven batch photo intake that recognizes a cleaned code, optional website name, Attribute-derived color, and sequence number, previews every match, and uploads only confirmed valid matches through existing secure media contracts.
- [x] Add an explicit confirmed item-deletion action that removes the selected model, its registered Cloudinary media, and associated metadata safely while preserving import-history snapshots and explaining future POS reintroduction behavior.
- [x] Add regression coverage, validate the full Admin workflow update, and submit it through a dedicated pull request.

- [x] Repair the Catalogue Editor picker’s responsive row grid so cleaned codes, lifecycle status, website names, and setup tags remain fully visible and aligned at phone and laptop widths.
- [x] Match Quantity changed tags to the established green New item tag and make the Item code visibly bold in POS-import preview summaries.
- [x] Add regression coverage, validate practical desktop and phone breakpoints, and update the active pull request with the correction.

- [x] Reverse the Catalogue Editor picker hierarchy so missing-name and missing-photo setup tags use the red-and-white treatment, while the color count and lifecycle appear as plain supporting text below the cleaned code.
- [x] Extend category resolution without changing established prefix mappings: route `JJ` to Jeans, preserve `SP` as Shorts, route `HD` and otherwise alphanumeric cleaned-code patterns to Tops, and retain manual category choices.
- [x] Add regression coverage and an idempotent category backfill migration for existing rule-managed and unassigned catalogue items, then validate and submit through a pull request.

- [x] Consolidate the selected-item Catalogue Editor into one responsive bordered workflow: item details and POS Attribute color choice at the top, single-photo upload below, and the confirmed delete action at the bottom.
- [x] Remove explanatory copy from the selected-item editor and temporarily hide the batch photo intake interface while preserving its underlying filename-matching capability.
- [x] Add responsive editor regression coverage, validate desktop and phone layout behavior, and submit the simplification through a pull request.

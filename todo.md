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
- [x] Retain the normal single-password `/admin` login using the initial password `REDACTED_SETUP_PASSWORD`, with its password hash and session validation backed by Supabase rather than a Supabase email account.
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

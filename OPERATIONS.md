# Orange Catalogue Operations Guide

## Architecture and deployment targets

Orange is a light-theme, public catalogue with a password-protected administration area. The repository is hosted privately at [KangKimpor/orange-catalogue](https://github.com/KangKimpor/orange-catalogue). The external deployment target is Vercel, the relational data store is Supabase PostgreSQL, and product media is stored and transformed by Cloudinary. Messenger is the only ordering handoff: `https://m.me/OfficiallyDavit`.

The application can also run in the managed project preview for development. The managed preview and the Vercel project are separate runtime targets, so environment variables must be configured in each target that will be used.

## Supabase setup and migration

Create or select the Supabase project, then apply `supabase/migrations/0001_orange_catalogue.sql` using the Supabase SQL editor or migration tooling. The migration creates the category, product, variant, color, media, import, import-change, and store-settings tables with the constraints used by the application.

Populate the baseline catalogue by previewing the supplied POS XLSX through `/admin/import`, reviewing the generated change summary, and applying only an approved preview. The import process preserves the immutable POS `Code` as `variants.pos_code`, associates product-level data by the cleaned POS name, and flags missing rows for review rather than deleting them. The current baseline contains **534 products** and **1,385 variants**.

The server accesses Supabase through its REST API using the service-role key. Never expose the service-role key in browser code, commit it to Git, or place it in a `VITE_` variable.

## Required Vercel environment variables

Configure these variables for both **Preview** and **Production** in the Vercel project. Redeploy after adding or changing them.

| Variable | Scope | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL` | Browser and server | Supabase project URL used by the public catalogue client and server adapter. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Browser and server | Supabase publishable key for public client configuration. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Server-side Supabase REST access for catalogue and admin operations. |
| `JWT_SECRET` | Server only | Signs and verifies the `orange_admin_session` cookie. Use a long random value. |
| `ADMIN_PASSWORD` | Server only | Initial password used only until the first successful sign-in stores a derived hash in `store_settings`. |
| `CLOUDINARY_CLOUD_NAME` | Server only | Cloudinary cloud name used to construct signed upload and optimized delivery URLs. |
| `CLOUDINARY_API_KEY` | Server only | Cloudinary API key used to generate signed upload parameters. |
| `CLOUDINARY_API_SECRET` | Server only | Cloudinary signing secret; never send it to the browser. |

The initial owner password is `REDACTED_SETUP_PASSWORD` only for first access. Change it immediately in the admin Security workspace. After the password hash exists in Supabase, changing `ADMIN_PASSWORD` does not replace the stored hash.

## Cloudinary setup and product photography

Create or select a Cloudinary account and copy the cloud name, API key, and API secret into the Vercel variables above. No unsigned upload preset is required: the server signs each request after validating the admin session. Photos are uploaded beneath `orange/products/<normalized-cleaned-product-name>` and tagged with the category and color. The database stores the Cloudinary public ID and optimized URL; image bytes remain in Cloudinary.

Open `/admin/photos`, search by cleaned product name such as `ZL 0041`, choose the whole product or a specific variant, select a color tag, and upload the image. After registration, the storefront reads the optimized Cloudinary URL. If no media is registered, a color placeholder is shown instead of fabricated photography.

## Product naming, categories, and visibility

The public site has exactly five categories: **Just In**, **Tops**, **Jeans**, **Shorts**, and **Pants**. Until a custom display name is entered in `/admin`, the customer-facing title uses the cleaned POS name. The immutable POS variant `Code` remains below the display name and is included in the Messenger order message.

| POS cleaned-name prefix | Automatic public category |
|---|---|
| `ZS`, `ZL` | Tops |
| `SK`, `SJ`, `WJ`, `FJ` | Jeans |
| `SP` | Shorts |
| `LP` | Pants |
| Any other prefix | Just In and flagged for review |

The Products workspace supports display names, category overrides, published state, and review status. A product absent from a later import is retained and marked for review; there is no automatic destructive deletion.

## POS XLSX import procedure

Use **POS XLSX import** to upload a POS export. The parser detects its embedded header row and validates `Code`, `Name`, `Price`, and `Stock Qty.`. Preview mode writes an import-history record and review rows but does not alter catalogue variants. The immutable `Code` updates a variant’s price and stock, while the cleaned name determines product-level grouping and media association.

Review new products, new variants, stock or price changes, and missing variants. Apply only after the preview digest and validation summary match the intended file. Items absent from an import are retained and surfaced for review so an owner can archive or hide them deliberately.

## Local development and verification

From the repository root, install dependencies with `pnpm install`, start the development server with `pnpm dev`, run the complete test suite with `pnpm test`, and build with `pnpm build`. The test suite covers POS normalization, category rules, availability privacy, password access, signed Cloudinary uploads, Messenger URLs, and Cloudinary credential authentication when the three Cloudinary variables are available.

Before publication, verify the public storefront without a Vercel authentication wall, sign in at `/admin` with the configured password, preview the supplied XLSX without applying it unless intended, upload a real product photo, and confirm the same Cloudinary image appears on both the category card and product detail page.

## Vercel and GitHub release procedure

Commit source, migration, and operations changes to the private GitHub repository and push the production branch. Confirm the Vercel project is linked to that repository, uses `pnpm build`, and routes `/api/*` to the bundled `api/index.js` function. A new push creates a preview deployment. Check its build status, run the smoke tests above, and inspect runtime logs for failed API requests.

After the preview is verified, promote that deployment to Production in Vercel, or deploy the production branch using the linked project. Confirm that `orange-catalogue.vercel.app` serves the new Supabase-backed build, that public shoppers do not see a team login wall, and that `/admin` still requires the store password. Do not publish the service-role key, Cloudinary secret, or JWT secret in repository files.

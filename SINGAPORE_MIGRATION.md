# Singapore migration — 21 October 2026

- Live site: https://orange-catalogue.vercel.app/
- Production deployment: `dpl_8JwKbFFw8AoBaPC2bKawMziUJ1DR` (READY).
- Vercel Functions: Singapore (`sin1`), configured in `vercel.json` and project settings.
- Active Supabase project: `mxgfdoogvvpwdzvxcaku`, Singapore (`ap-southeast-1`), in the existing Orange's Database organization.
- Previous Supabase project: `ccaavswuaeqdkgvetlai`, Seoul. Retained intact for recovery; not paused or deleted.
- All 11 application tables copied and compared using complete row-content fingerprints: 382 products, 960 variants, 16 imports, 1,038 import changes, 9 photo associations, and the existing settings and rate-limit records.
- Both original logo files copied to Singapore Storage and the current logo verified byte-for-byte.
- Vercel's Supabase URL, publishable key and private server key updated for production and preview. No credentials saved in this repository.
- Search/filtering/sorting, device favorites, restock requests, and the private admin request queue are deployed.
- Verified production catalogue/product responses and a restock write to Singapore; anonymous queue access returns 401. Temporary test requests removed.
- Favorites verified on production after switching from Jeans: the saved list opens across all categories.
- Local verification: type checks, production build, 172 passing unit/database tests (5 skipped), and 12 feature browser checks across Chromium and WebKit. The existing 51 Chromium responsive checks passed before the final route-key correction.
- No runtime errors found in the final deployment's immediate post-release log check. This was a local-source deployment; repository changes remain uncommitted.

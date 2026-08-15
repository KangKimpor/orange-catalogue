# Orange Catalogue Release Notes

The intended public deployment is a **publicly accessible storefront** with no team-member authentication wall in front of customer routes. The `/admin`, `/admin/photos`, and `/admin/import` workspaces remain password-protected by the application-level admin session. Customer ordering remains Messenger-only through `m.me/OfficiallyDavit`.

The release candidate was validated with the supplied POS export, Cloudinary media workflow, public Tops card, ZL 0041 detail page, automated tests, and production build. The Management UI **Publish** action remains intentionally owner-operated; publication should be performed only after confirming the visibility setting is public and the final domain is correct.

The authenticated compact admin workspaces were reviewed at desktop width and use responsive form layouts. The owner should perform one final mobile-width review in the Management UI before publication, especially `/admin/photos` and `/admin/import`.

## Verified Vercel settings

The existing Vercel project `orange-catalogue` in team `Kimpor` was inspected directly. The verified deployment-protection state is: **Vercel Authentication disabled**, **password protection disabled**, and **Trusted IP protection disabled**. The project ID is `prj_xfhj13Lvn5vd1d23ZK64gsZzefua`. No customer-facing team-member login wall remains configured.

## Publication procedure

1. Open the latest Orange Catalogue checkpoint in the Management UI.
2. Review the preview, confirm the site visibility is public, and confirm the intended domain.
3. Click **Publish** in the Management UI. Do not enable Vercel Authentication or password protection for the public storefront.
4. Open the published storefront in an incognito window and verify the five category labels, the ZL 0041 Tops card, `/product/zl-0041`, and the Messenger order CTA.
5. Keep `/admin` protected by the application admin password and change the initial password `REDACTED_SETUP_PASSWORD` before operational use.

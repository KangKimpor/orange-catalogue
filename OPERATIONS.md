# Orange Catalogue Operations Guide

## Customer storefront

The public site has five categories: **Just In**, **Tops**, **Jeans**, **Shorts**, and **Pants**. Customers can browse products, choose a color and size where available, see only an **Available** or **Sold Out** state, and open a Messenger order handoff. Exact inventory quantities are intentionally never included in the public catalogue response.

Until you enter a custom display name in `/admin`, the customer-facing title uses the cleaned POS name. The immutable POS variant `Code` remains visible below the display name and is included in the Messenger order message.

## Admin access

Open `/admin` and sign in with the initial password configured for the project. Change it immediately through **Security** after first use. The changed password is stored as a one-way hash and replaces the initial configuration for later sign-ins.

## Product naming, categories, and visibility

The **Products** section lets you enter a custom display name, assign one of the five public categories, control each product’s published state, and maintain its review status. A hidden product remains in admin while being removed from the public storefront. Do not change a POS variant code: it is the stable identifier used for every import reconciliation.

| POS cleaned-name prefix | Automatic public category |
|---|---|
| `ZS`, `ZL` | Tops |
| `SK`, `SJ`, `WJ`, `FJ` | Jeans |
| `SP` | Shorts |
| `LP` | Pants |
| Any other prefix | Just In and flagged for review |

## POS XLSX imports

Use **POS XLSX import** to upload an export. The system detects its embedded header row, validates `Code`, `Name`, `Price`, and `Stock Qty.`, and uses the immutable `Code` to update a variant’s price and inventory. The preview separates new products, new variants, changed stock or price, and missing variants.

> Items absent from an import are **never deleted automatically**. They are retained and surfaced for review so that you can decide whether to archive or hide them.

The initial import loaded **534 products**, **1,385 variants**, and aggregate stock of **15,600** from the supplied POS export.

## Product photography

In **Photos**, select the product, optionally select one variant, choose a color tag, and upload an image. The application requests a short-lived signed Cloudinary upload for a folder structured as `orange/products/<normalized-product-code>`. Images are registered with optimized Cloudinary delivery URLs for use in the storefront.

Before product photography is uploaded, the storefront intentionally displays a color placeholder. Uploading and associating real photography is the remaining owner action before the catalogue becomes genuinely photo-led.

## Publication

The project is prepared for managed publication after a final review. Publishing from the project UI will make the current managed deployment publicly reachable. If you choose to deploy the code separately to Vercel, configure the same database and Cloudinary secrets there and verify that Vercel Authentication is disabled; the managed runtime and external Vercel runtime are separate deployment targets.

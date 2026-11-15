# DigiSource

DigiSource is a community library for free digital products, research, and documented AI datasets.

## Live website

- Website: https://digisource.yg771085.workers.dev
- Products: https://digisource.yg771085.workers.dev/products
- Product contribution: https://digisource.yg771085.workers.dev/upload-product
- Research: https://digisource.yg771085.workers.dev/research
- AI Data Library: https://digisource.yg771085.workers.dev/ai
- Dataset contribution: https://digisource.yg771085.workers.dev/upload-dataset
- Admin review: https://digisource.yg771085.workers.dev/admin

## Architecture

- Main website Worker: `digisource` (source: `worker.js`)
- API Worker: `digisource-api` (source: `api-worker.js`)
- D1 database: `digisource-db` (binding: `DB`)
- API origin: https://digisource-api.yg771085.workers.dev

Public libraries only show records with a published status. All community submissions start in pending review. Admin approval is required before publication.

## Product file uploads

The product form includes an optional file picker. Supported extensions are PDF, ZIP, DOCX, XLSX, PPTX, CSV, TXT, PNG, JPG, and JPEG. The application limit is 20 MB per file.

The upload API is prepared to use a private Cloudflare R2 bucket through the API Worker binding named `PRODUCT_FILES`. Files are stored as private objects and are not served from a public bucket. Published product downloads are streamed through the API after checking that the product is published. Pending files can be downloaded only from the authenticated admin review API.

**Important:** R2 is not activated or bound to this Worker yet. Until that account setup is completed, the form allows metadata-only submissions and clearly tells contributors that selected files remain on their device. The API returns a not-ready response rather than pretending that a file was uploaded.

### Enable storage (account owner / parent or guardian)

1. In the Cloudflare dashboard, open **Storage & databases → R2 → Overview**.
2. Review the R2 subscription and current pricing before completing any checkout or billing step. R2 includes monthly free usage allowances, but usage is billed; it is not a guaranteed free-forever service.
3. Create a bucket named `digisource-product-files` and keep it private. Do not enable public bucket access.
4. Open the `digisource-api` Worker settings and add an R2 bucket binding:
   - Variable name: `PRODUCT_FILES`
   - Bucket: `digisource-product-files`
5. Redeploy the API Worker after adding the binding.
6. Verify `/api/storage/status` reports `enabled: true`, then test with a non-sensitive sample file before announcing uploads as available.

## Admin review

The admin dashboard is at `/admin`. The API requires a Cloudflare Worker secret named `ADMIN_TOKEN`.

The account owner should configure it in the `digisource-api` Worker under **Settings → Variables and Secrets**. Store it as a secret, not a plain variable. Never commit it to GitHub or enter it in the public website source. The admin page keeps the token only in page memory and does not save it in browser storage.

## Security notes

- Uploads are limited to an allowlist of file extensions and a 20 MB size limit.
- Product files are stored privately when R2 is configured.
- Public download endpoints check that the associated product is published.
- Admin review endpoints require the `ADMIN_TOKEN` secret.
- Do not publish files containing private, confidential, or sensitive personal information.
- Public access to a dataset does not automatically grant permission to use it for AI model training.
- Review Cloudflare pricing and usage limits before enabling account services.

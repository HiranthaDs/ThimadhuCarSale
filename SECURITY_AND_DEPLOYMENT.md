# Security and deployment changes

## Applied to this workspace and configured database

- Browser authentication now uses HttpOnly cookies. Sessions are stored in PostgreSQL, revoked on logout, password changes, and deactivation. Password changes also invalidate pending reset challenges. Mutating cookie requests and login require an explicitly allowed Origin.
- Login, OTP, password changes, and general API traffic have atomic database rate limits shared across workers. OTP guesses are limited per random challenge, so exhausting one challenge does not exhaust another. SMTP runs after the challenge transaction commits. Public reset requests return a generic response before email delivery.
- Report files use random immutable object keys. Editing is restricted to the creator or owner; checked reports remain locked. Changes to reviewed client profiles restart accountant and owner review. Report mutations write audit records in the same transaction.
- New uploads are limited to validated JPEG, PNG, WebP, and PDF files. Images are decoded and re-encoded; active PDF actions and embedded files are rejected. Individual files are limited to 10 MiB and actual request streams to 30 MiB, including chunked bodies.
- Existing attachments must belong to the record being edited. Client inspection-report selections must correspond to database report records. Bucket-wide file listing is removed. New and legacy R2 references are returned as signed links; `/uploads` is no longer publicly mounted.
- The configured database migration was applied. Shared session/rate-limit tables, RLS, restricted public-role grants, indexes, and legacy copy-label migration are present. Existing objects and PDF contents were preserved. New copies are named `Inspection Report 2`.
- Database TLS now verifies the hostname and certificate against the official Supabase CA in `Backend/certs/prod-ca-2021.crt`. Its source is [Supabase's public dashboard configuration](https://github.com/supabase/supabase/blob/master/apps/studio/hooks/custom-content/custom-content.json).
- The local API uses the new `thimadhu_api` database role. It has application-table access, no administrative role flags, no DDL privileges, and cannot update/delete audit history. The previous administrator connection is preserved in ignored `Backend/.env.migration`; it is excluded from Docker builds. The local JWT signing secret was regenerated and automatic default-owner bootstrap disabled. The existing owner was checked and does not use the known bootstrap password.

## Still requires provider/hosting access

1. Rotate the database administrator password, R2 keys, and Brevo SMTP key previously shared in chat. Update `.env.migration` after changing the database administrator password; update `.env` and deployed secret stores for R2/SMTP. Update the deployed JWT secret to the newly generated local value, or generate another strong value consistently across all API instances. Revoke old keys. The Supabase anonymous key is public by design; RLS and database grants now protect the application tables.
2. Disable **Public Development URL** and any public custom domains on both R2 buckets. Signing new links alone cannot revoke old public URLs. The available storage credentials do not provide bucket-management access; both CORS inspection attempts returned `AccessDenied`. See [Cloudflare public bucket controls](https://developers.cloudflare.com/r2/buckets/public-buckets/).
3. Configure R2 CORS for the exact frontend origins. Allow `GET` and `HEAD`, expose `Content-Type` and `ETag`, and allow the `Range` header if needed. This is required for browser canvas/PDF rendering of saved photos. Do not add wildcard credentialed origins. See [Cloudflare CORS](https://developers.cloudflare.com/r2/buckets/cors/) and [signed URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/). Signed links expire after 15 minutes by default; reopen a record to refresh links before exporting a long-open form.
4. Deploy the changed backend and frontend together. Copy the restricted runtime `DATABASE_URL` and CA certificate into the deployed backend; keep the administrator connection out of runtime secrets. Apply production origins/hosts and HTTPS settings below. Code changes have not been deployed to Render by this task.

## Run locally

Use `localhost` for both frontend and API so cookies remain on the same site. Local `.env` has `APP_ENV=development`, `COOKIE_SECURE=false`, `COOKIE_SAMESITE=lax`, and explicit localhost origins/hosts. Database TLS remains verified.

```powershell
cd Backend
venv/Scripts/python.exe -m pip install -r requirements.txt
venv/Scripts/python.exe migrate.py
venv/Scripts/python.exe -m uvicorn main:app --host localhost --port 8000
```

In another terminal:

```powershell
cd Frontend
npm ci
npm run dev
```

The migration command loads `.env.migration` only for administration. `AUTO_MIGRATE=false` prevents each worker from trying to change the schema. Run migrations once before starting updated workers. Back up the database before future schema changes. To provision another environment, run `migrate.py`, then `provision_runtime.py`; the latter creates the restricted role and separates the credentials. It refuses to overwrite an existing role or migration credential file.

## Load-balanced deployment

`compose.yaml` provides two API containers, two workers per container, and an Nginx frontend using least-connections balancing and passive upstream failure handling. The API containers have no published host ports. The frontend is bound to `127.0.0.1:8080` for a trusted HTTPS ingress on the same host. It also serves compressed frontend assets, long-lived hashed-asset caching, and a Content Security Policy. PDF generation and role panels load on demand.

Set these values for the production environment:

```dotenv
APP_ENV=production
COOKIE_SECURE=true
COOKIE_SAMESITE=lax
ALLOWED_HOSTS=localhost,127.0.0.1,your-public-host.example
CORS_ORIGINS=https://your-public-host.example
DATABASE_SSLMODE=verify-full
DATABASE_SSLROOTCERT=certs/prod-ca-2021.crt
AUTO_MIGRATE=false
```

The bundled frontend is built with `VITE_API_URL=/api`; Compose sets `API_ROOT_PATH=/api`. Keep the browser and API under this same HTTPS origin. If you use separate hosts, use same-site custom domains where possible; cross-site `SameSite=None` cookies can be blocked by browser third-party-cookie settings.

Configure the external HTTPS ingress to overwrite `X-Forwarded-For` with the real client address and `X-Forwarded-Proto` with `https`. Strip incoming client-supplied forwarding headers. Keep port 8080 private, redirect public HTTP to HTTPS, and set HSTS at that ingress. Uvicorn trusts only the configured Nginx container IP. The hard-coded Docker subnet can be changed if it conflicts with the host network; update `FORWARDED_ALLOW_IPS` with it. See [Uvicorn deployment settings](https://www.uvicorn.org/deployment/).

```sh
docker compose build
docker compose up -d
```

Pool limits are per process: `2 containers × 2 workers × (3 pool + 2 overflow) = 20` maximum database connections. The API role permits 30 connections. Check the Supabase plan's pool capacity before increasing replicas or pools. Each worker has 8 blocking-operation threads and a 64-request concurrency cap. Nginx buffers incoming uploads and does not retry non-idempotent requests once sent upstream. Shared sessions/rate limits require no sticky sessions. Monitor latency, 429/503 counts, database connection use, memory, and SMTP failures before adjusting capacity. Large lists use bounded pages and stable ordering; searches are debounced and stale responses ignored.

Docker/Nginx are not installed in the current workspace environment, so the container deployment has not been started or load-tested here. Choose resources and perform staging traffic tests before production rollout; no production throughput claim is made.

## File retention and operations

Deleting a record removes it from the application. Automatic R2 deletion is disabled because reports, copies, and clients can share objects; deleting a shared file would corrupt other records. Retain these immutable objects until a maintenance job can check **all** live references and backups during a controlled maintenance window. Do not add a bucket lifecycle rule that deletes referenced objects indiscriminately. Define an appropriate retention period and access policy for identity documents.

Signed URLs grant temporary bearer access and may work until expiry after logout. They should not be put in logs or shared unintentionally. Backend responses use `Cache-Control: no-store` and `Referrer-Policy: no-referrer`. Existing legacy local reports need their private `uploads` volume retained on a single instance or migrated to R2 before scaling; the new Docker image deliberately excludes these local files. New uploads already use R2.

Background email delivery logs sanitized failures. Provider credentials, sender verification, SMTP connectivity, storage privacy/CORS, and external credential rotation remain deployment responsibilities. Requests interrupted by a worker restart may need an OTP resend.

## Verification

```powershell
cd Backend
venv/Scripts/python.exe -B -m unittest discover -s tests -v
venv/Scripts/python.exe -m pip check
cd ../Frontend
npm run build
npm run lint
npm audit
```

The 44 regression tests use an isolated SQLite database and mocked mail/storage; the PDF regression fixture was generated with the frontend's jsPDF dependency. The real PostgreSQL role/TLS/RLS configuration was checked separately. A concurrent database rate-limit probe allowed exactly 5 of 20 requests and rejected the other 15. No customer records were changed by that probe. Dependency checks reported no published Python advisories for the 39 packages checked and zero npm vulnerabilities; these checks are not proof of absence of undiscovered vulnerabilities.

# ClauseGuard

Understand contract risk, one clause at a time. Upload a PDF or DOCX, review flagged terms with supporting reference context, and return to past analyses in a private workspace.

ClauseGuard provides informational analysis, not legal advice. Risk labels describe signals in the contract language and reference library; they do not establish enforceability, suitability, or legal compliance.

## Features

- Clerk sign-in and owner-scoped analysis history.
- PDF and DOCX uploads with extension, content, archive, and size validation.
- Clause segmentation across eight contract categories, with a source-preserving fallback.
- Retrieval against 128 curated baseline clauses: 16 per category, comprising six Safe, five Caution, and five Risky examples.
- Normalized 768-dimensional Gemini embeddings, pgvector cosine search, and configurable hybrid scoring.
- Grounded explanations and suggested wording for Caution and Risky clauses.
- Background processing with live stages and a completed-clause counter, responsive report filters, and accessible risk badges.
- Clause reviews run concurrently up to `GEMINI_CONCURRENCY` (default 2), sharing the global upstream request limit. Report clauses retain document order; actual speed depends on Gemini latency and quota.
- Per-user concurrency and daily quotas, bounded queues, retry/backoff, and startup recovery.

## Architecture

```mermaid
flowchart LR
  Browser[Next.js client on Vercel] --> Clerk[Clerk session]
  Browser -->|Bearer token and multipart upload| API[Express API on Render]
  API --> Queue[Bounded in-process queue]
  Queue --> Extract[PDF or DOCX extraction]
  Extract --> Segment[Clause segmentation]
  Segment --> Embeddings[Gemini embeddings]
  Embeddings --> Search[Category-scoped cosine search]
  Search --> Score[Semantic vote and deterministic rules]
  Score --> Explain[Grounded Gemini explanations]
  Explain -->|Atomic report write| DB[(PostgreSQL 16 with pgvector)]
  Search --> DB
  Browser -->|Poll report and load history| API
  API --> DB
```

The frontend calls the separate Express API directly from client components. Next.js handles pages and authentication middleware; it contains no API route handlers or server actions. PostgreSQL stores analyses and clauses. Original uploaded files are processed in memory and are not retained on disk.

## Stack

Next.js 15 App Router, React 19, TypeScript, CSS modules, Clerk, Node.js 20, Express, PostgreSQL 16, pgvector, `pg`, `@google/genai`, `pdf-parse`, `mammoth`, `multer`, Zod, Pino, Jest, Supertest, and React Testing Library.

## Local setup

Requires Node.js 20.19 or later, npm, Docker, a Clerk application, and a Gemini API key with access to `gemini-embedding-001` and `gemini-2.5-flash`.

```sh
npm ci
npm --prefix server ci
npm --prefix client ci
```

Copy `server/.env.example` to `server/.env` and `client/.env.example` to `client/.env.local`. Fill in the Gemini and Clerk credentials. Both applications must use keys for the same Clerk instance. Keep the client origin exactly `http://localhost:3000` when using the default settings.

```sh
docker compose up -d db
npm --prefix server run migrate
npm --prefix server run seed
```

Start the applications in separate terminals:

```sh
npm --prefix server run dev
npm --prefix client run dev
```

Open [localhost:3000](http://localhost:3000). Alternatively, after configuring both environment files, run `docker compose up --build` to run all three services. The client environment file is read by Compose and passed to its dev server. Start the seed once from the host after the database is ready; the server applies migrations automatically on startup.

The public landing page can render before credentials are configured. Sign-in remains unavailable and protected pages redirect to sign-in. The API intentionally fails fast if required settings are missing; there is no development authentication bypass or synthetic report mode.

Try `samples/nda.pdf`, `samples/freelance-agreement.pdf`, and `samples/one-sided-service-agreement.pdf`. Editable text sources sit alongside them. These are fictional demonstrations, not legal templates. The last agreement intentionally contains one-sided provisions. Model outputs and risk scores may vary; the samples have no hardcoded reports.

### Baseline seeding

`npm --prefix server run seed` runs migrations, skips existing `(category, text)` pairs before requesting embeddings, and inserts batches of 16. It uses `gemini-embedding-001`, `RETRIEVAL_DOCUMENT`, and `outputDimensionality: 768`, then normalizes each vector. Rate limits and transient upstream failures retry with exponential backoff and jitter. Re-running a partial seed is safe and resumes missing clauses. The seed makes real Gemini requests and consumes quota.

Analysis embeddings use the same model and dimensionality with `RETRIEVAL_QUERY`. Do not change the embedding model without re-embedding the entire reference library. The API rejects analyses when the baseline library has not been seeded.

After configuring credentials and seeding the database, run `npm --prefix server run verify:live`. This sends the included one-sided sample to the real Gemini services, checks source-preserving segmentation, query embeddings, pgvector retrieval, and flagged-clause explanation generation without creating an analysis record. It intentionally fails if segmentation falls back, so a failed upstream connection cannot look like a successful live check. To use another PDF or DOCX, pass its path after `--`. The default sample path is intended for running from the repository; inside a container, supply a mounted sample path. Browser sign-in and an authenticated sample upload still need separate verification.

## Environment variables

`GEMINI_GENERATION_MODEL` selects the text-generation model, defaulting to the originally specified `gemini-2.5-flash`. Google may reject that model for new accounts. Set `GEMINI_GENERATION_MODEL=gemini-3.8-flash` when that occurs; the Render blueprint uses this replacement. Embeddings remain `gemini-embedding-001`, so the existing reference library does not need to be regenerated. Rate-limit retries respect Gemini's structured retry delay; throttled seeds resume missing rows when rerun.

### Server: `server/.env`

| Variable                | Required   | Default / purpose                                                                        |
| ----------------------- | ---------- | ---------------------------------------------------------------------------------------- |
| `GEMINI_API_KEY`        | Yes        | Gemini API credential; server only                                                       |
| `DATABASE_URL`          | Yes        | PostgreSQL connection URL; use a direct, non-transaction-pooled URL for the worker lease |
| `CLERK_SECRET_KEY`      | Yes        | Clerk secret key; never expose to the browser                                            |
| `CLERK_PUBLISHABLE_KEY` | Yes        | Publishable key for the same Clerk instance                                              |
| `CLIENT_URL`            | Yes        | Exact frontend origin, without a trailing slash; CORS and token authorized party         |
| `PORT`                  | No         | `4000`                                                                                   |
| `NODE_ENV`              | No         | `development`; set `production` when deployed                                            |
| `DAILY_ANALYSIS_LIMIT`  | No         | `10` accepted analyses per user per UTC day                                              |
| `USER_CONCURRENCY`      | No         | `2` pending or processing analyses per user                                              |
| `QUEUE_CONCURRENCY`     | No         | `2` simultaneous jobs in the single worker                                               |
| `QUEUE_CAPACITY`        | No         | `20` total reserved/running/waiting jobs; Render blueprint uses `10` to bound memory     |
| `GEMINI_CONCURRENCY`    | No         | `2` simultaneous upstream calls                                                          |
| `UNKNOWN_THRESHOLD`     | No         | `0.60` minimum best similarity for a conclusive semantic vote                            |
| `MAX_CLAUSES`           | No         | `300` per document                                                                       |
| `MAX_TEXT_CHARACTERS`   | No         | `250000` extracted characters                                                            |
| `LOG_LEVEL`             | No         | `info`; also `debug`, `warn`, `error`, `fatal`, or `silent`                              |
| `TEST_DATABASE_URL`     | Tests only | Dedicated database ending in `_test`; never use the application database                 |

Files are limited to 10 MB; PDFs are limited to 200 pages. DOCX archives are limited to 30 MB uncompressed and 2,000 entries. These safety limits live in the processing services. Other scoring thresholds, top-k, and escalation counts live in `server/src/config/risk.js`. Extend the rule catalog in `server/src/config/rules.json` with accompanying positive and negative tests.

### Client: `client/.env.local`

| Variable                            | Required for sign-in / analysis | Value                                                                             |
| ----------------------------------- | ------------------------------- | --------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Yes                             | Clerk publishable key                                                             |
| `CLERK_SECRET_KEY`                  | Yes                             | Same instance secret key; server-side middleware only                             |
| `NEXT_PUBLIC_API_URL`               | Yes                             | Express origin, for example `http://localhost:4000`; local default is that origin |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL`     | Yes                             | `/sign-in`                                                                        |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL`     | Yes                             | `/sign-up`                                                                        |

`NEXT_PUBLIC_*` settings are compiled into the client bundle. Rebuild the frontend after changing them. Never prefix a secret key with `NEXT_PUBLIC_`.

## API reference

All `/api/*` routes require `Authorization: Bearer <Clerk session token>`. The API verifies the session with Clerk and scopes every analysis read, write, and deletion to that user. Global baseline reads and startup recovery are system operations.

| Method   | Path                            | Result                                                                     |
| -------- | ------------------------------- | -------------------------------------------------------------------------- |
| `GET`    | `/health`                       | Public liveness check: `200 {"status":"ok"}`                               |
| `POST`   | `/api/analyses`                 | Multipart field `file`; `202 {"id":"...","status":"pending"}`              |
| `GET`    | `/api/analyses?page=1&limit=10` | `{analyses, page, limit, total}`; limit is 1-50                            |
| `GET`    | `/api/analyses/:id`             | Analysis and clauses ordered by position; 404 for missing or non-owned IDs |
| `DELETE` | `/api/analyses/:id`             | 204; active analyses return 409                                            |

Errors use `{ "error": { "code": "...", "message": "...", "request_id": "..." } }`; the rate limiter also returns the common `code` and `message` fields. Expected statuses include 400 validation, 401 authentication, 404 ownership-safe missing record, 409 active deletion, 413 JSON body size, 429 request/user quota, and 503 queue capacity.

```sh
curl https://your-api.onrender.com/health
curl -H "Authorization: Bearer $CLERK_SESSION_TOKEN" \
  -F "file=@samples/nda.pdf" https://your-api.onrender.com/api/analyses
```

Poll the returned ID every two seconds until `completed` or `failed`. The detail response includes `overall_risk`, summary counts, `semantic_signal`, similarities, reference IDs, rule flags, explanations, and suggested wording. Similarity is a cosine comparison, not a probability or legal confidence score.

## Scoring and processing

The segmenter requests schema-constrained JSON and validates it with Zod. It verifies that all supplied text appears in order, retries malformed or altered output once, and falls back to numbered-section splitting if both attempts fail. Long documents use overlapping chunks; source positions reconcile overlap while preserving deliberate repetitions. Very long provisions are split into bounded passages. A fallback indicator appears in the report.

Search returns up to five baselines in the same category; `Other` searches the whole library. Similarities weight a vote across baseline risk labels, with ties resolved toward greater risk. Below `UNKNOWN_THRESHOLD`, the semantic result is `inconclusive` and the clause defaults to Caution. One high-severity rule forces at least Caution, two high-severity rules force Risky, and medium-severity flags also force at least Caution. Rules never lower a semantic Risky result.

Only flagged clauses request explanations. Their prompt contains the clause, retrieved reference text and rationales, and deterministic flags. Contract text is treated as untrusted data. Explanations are constrained to the supplied context, include a not-legal-advice note, and suggest safer wording. Generation can still be imperfect: review all explanations against the original agreement.

All clause inserts and final report metadata are committed in one transaction. A failure rolls back the report and records a user-safe error. Accepted jobs consume the daily quota even if they fail, and deleting history does not refund quota. The quota resets at midnight UTC.

## Tests and checks

```sh
docker compose up -d db
docker compose exec db createdb -U clauseguard clauseguard_test
```

Set `TEST_DATABASE_URL=postgresql://clauseguard:localdev@localhost:5432/clauseguard_test` in the terminal running tests. In PowerShell use `$env:TEST_DATABASE_URL='postgresql://clauseguard:localdev@localhost:5432/clauseguard_test'`; in a POSIX shell use `export TEST_DATABASE_URL=...`.

```sh
npm test
npm run lint
npm run build
```

Unit tests run without external credentials. Database integration tests are skipped unless `TEST_DATABASE_URL` is set, and refuse database names that do not end in `_test`. They apply real migrations, seed test vectors, and exercise upload-to-report persistence with Gemini mocked at the service boundary. They also test actual Clerk rejection of unauthenticated requests, ownership isolation, quota races, deletion behavior, startup recovery, and transaction rollback. Successful verification of a real Clerk session and real Gemini output requires configured credentials.

Frontend tests cover file selection, drag/drop, size/type errors, API error states, risk badges, token attachment, transient retries, polling completion, and unmount cancellation. CI supplies PostgreSQL with pgvector and runs tests, lint, types, and both builds on Node.js 20.

## DEPLOY

### 1. Create the database

Create a **PostgreSQL 16** database on Neon or a Render PostgreSQL instance with pgvector support. Follow the provider's [pgvector setup](https://neon.com/docs/extensions/pgvector). Copy its TLS-enabled **direct connection URL** into the backend `DATABASE_URL`. The application's `pg` pool manages its connections; transaction-pooling proxies are unsuitable for the session-level worker lease. Use a database role allowed to create the `vector` extension for the first migration, or have an administrator enable it first.

The migration runner creates the extension, tables, HNSW index, ownership/history indexes, and persistent quota counters. It uses a transaction and advisory lock to prevent concurrent migration races.

### 2. Seed production once

In a trusted local terminal, set the server environment to production credentials, including the production `DATABASE_URL` and Gemini key. Keep credentials in an ignored `.env` file or environment settings, never in Git or command-line arguments.

```sh
npm --prefix server run migrate
npm --prefix server run seed
```

Verify that `baseline_clauses` contains 128 rows, with 16 in each category. Interrupted seeding may be rerun. Do not copy synthetic integration-test vectors into production.

### 3. Deploy the Express service to Render

Push the repository to your Git host and create a Render Blueprint from `render.yaml`, or create a Docker web service with repository root as the project, Docker context `./server`, and Dockerfile `./server/Dockerfile`. The blueprint follows [Render's service configuration](https://render.com/docs/blueprint-spec).

Fill every `sync: false` setting: `DATABASE_URL`, `GEMINI_API_KEY`, `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, and `CLIENT_URL`. Set `CLIENT_URL` to your final Vercel origin, without a trailing slash. Copy the resulting Render service origin for the frontend. The image runs as a non-root user, includes production dependencies only, applies migrations at startup, and exposes `/health` for health checks.

Run **one replica**. During an overlapping deployment, the replacement starts its HTTP server in standby and waits for the database worker lease. History and liveness remain available; uploads receive a clear 503 until the old worker finishes or exits and the replacement acquires the lease. Abandoned-job recovery runs only under that lease, so a replacement cannot fail the live worker's jobs. Shutdown waits for HTTP requests and queued work before releasing the lease and closing the database. The Render blueprint and Compose allow 60 seconds for shutdown; the process has a 55-second hard limit. Before horizontal scaling, replace the in-process queue with a durable distributed queue and per-worker recovery.

### 4. Deploy the frontend to Vercel

Import the same repository, select the Next.js preset, and set **Root Directory to `client`**. Use the default `npm ci` install and `npm run build` build commands. Set all client environment variables above, with `NEXT_PUBLIC_API_URL` equal to the Render HTTPS origin. There is no API rewrite or `vercel.json` requirement; requests go directly to Express. See [Next.js on Vercel](https://vercel.com/docs/frameworks/full-stack/nextjs).

Redeploy after environment changes. Update the Render `CLIENT_URL` if Vercel assigns a different production domain. Preview domains are intentionally not automatically allowed by backend CORS or Clerk authorized parties.

### 5. Configure Clerk production URLs

Use a production Clerk instance for the final site, following [Clerk's production checklist](https://clerk.com/docs/guides/development/deployment/production). Complete its required domain/DNS verification and any identity-provider credentials. Configure the application origin as the production frontend URL, `/sign-in` and `/sign-up` as the authentication paths, and `/dashboard` as the post-authentication destination. Allowlist the production redirect URLs/origin in Clerk's dashboard. Update both services to the same production keys.

The backend's `authorizedParties` is exactly `CLIENT_URL`. If a sign-in succeeds but API requests receive 401, confirm that the frontend token, Clerk instance keys, frontend origin, and `CLIENT_URL` agree. CORS permits the Authorization header for that exact origin.

### 6. Verify the live installation

1. Open `https://your-api.onrender.com/health` and confirm `{"status":"ok"}`.
2. Confirm an unauthenticated `/api/analyses` request returns 401.
3. Sign up at the deployed frontend and upload `samples/nda.pdf`.
4. Confirm pending/processing changes to completed, the report has clauses, and history persists after refresh.
5. Upload the one-sided sample and inspect explanations, flags, and filters.
6. Sign in as a second user and verify the first user's report URL returns 404 through the API.
7. Delete a finished analysis and verify it disappears from history.

Free-tier services may sleep. The first request can take up to a minute; the frontend displays a waking message and automatically retries transient reads. Uploads are not automatically replayed, preventing duplicate analyses. If an upload times out, check history before resubmitting. In-process jobs cannot survive a server restart or forced sleep: startup marks pending and processing records failed with an explanation, and users can upload again. Use an always-on service for dependable background processing of longer documents.

## Data and operational notes

Uploaded files remain in memory until their jobs finish. Extracted clause text, filenames, risk reports, and user IDs are persisted in PostgreSQL; document text is sent to Gemini for processing. Configure your database backups, retention, and provider access to suit your use case. Deleting a report cascades to its clauses, but does not remove provider logs or database backups. Logs avoid request bodies and authorization values.

`/health` is a liveness probe, not a readiness or credential-verification check. Startup validates settings and runs migrations, but a healthy response does not prove that Gemini quota, Clerk production configuration, or baseline seeding is correct. Verify the sample upload after every deployment.

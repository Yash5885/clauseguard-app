# Live deployment

- Website: https://clauseguard-yash5885.vercel.app
- Source: https://github.com/Yash5885/clauseguard-app
- API health: https://clauseguard-app-api.onrender.com/health

The frontend runs on Vercel (project `clauseguard-app`), the API on Render (service `clauseguard-app-api`, Oregon), and PostgreSQL 16 with pgvector on Neon (project `clauseguard-app`, AWS us-west-2).

The cloud database has all three migrations and 128 normalized reference embeddings. Only the reference library was copied; existing local user reports stay in the local database. Copying embeddings required no Gemini calls.

## Runtime configuration

Vercel stores the production Clerk keys, sign-in/up paths, and `NEXT_PUBLIC_API_URL=https://clauseguard-app-api.onrender.com`. Keep `CLERK_SECRET_KEY` sensitive. Never expose it with a `NEXT_PUBLIC_` prefix.

Render stores API configuration in a secret file named `.env`. `DOTENV_CONFIG_PATH=/etc/secrets/.env` selects that file, and `NODE_ENV=production` is set on the service. The secret file contains the Neon database connection, Gemini key/model, Clerk keys, and `CLIENT_URL=https://clauseguard-yash5885.vercel.app`. No credentials are committed to GitHub.

## Redeploy

Push code changes to the repository's `master` branch. GitHub Actions runs tests, lint, type checks, and builds. Trigger the Render API deploy from its dashboard. The initial frontend deployment was uploaded through the Vercel CLI; deploy the `client` directory to project `clauseguard-app` for frontend changes. Its production domain follows production deployments.

Rebuild Vercel after changing `NEXT_PUBLIC_*` values. Restart/redeploy Render after changing the secret file. Apply additional database migrations with the server migration runner against Neon.

## Verification and limits

Verified the public landing page, Clerk sign-in handshake, API health, allowed frontend origin, and rejection of unauthenticated report requests. A signed-in cloud upload was not performed, to preserve Gemini quota. Existing configured Clerk development keys are retained for this initial deployment; configure a Clerk production instance for a production launch.

Free Render services can sleep and take time to wake. Gemini's project-wide daily quota still applies, including to verification runs. Use mocked tests for routine verification; do not seed embeddings again when the library is already populated.

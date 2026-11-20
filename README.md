# ClauseGuard

Contract risk analysis with a Next.js client, an authenticated Express API, PostgreSQL with pgvector, and Gemini retrieval and generation.

## Development

Requires Node.js 20.19 or later and Docker Compose. Install dependencies with `npm install`, `npm --prefix server ci`, and `npm --prefix client ci`. Copy `server/.env.example` to `server/.env` and `client/.env.example` to `client/.env.local`, then configure your credentials. Start the database with `docker compose up -d db`, the API with `npm --prefix server run dev`, and the client with `npm --prefix client run dev`.

`GET http://localhost:4000/health` returns the API liveness status. Run `npm test`, `npm run build`, and `npm run lint` to validate both applications.

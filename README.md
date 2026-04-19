# Brief Buddy (VoiceBrief)

Brief Buddy is a voice-first executive assistant that turns daily work signals into concise, prioritized briefings.

## Architecture

- **Backend:** Node.js + Express API in `src/`
- **Frontend:** React + Vite app in `frontend/`
- **Data:** Postgres for app data, Redis for queueing/scheduling (BullMQ)
- **Delivery:** optional Twilio call delivery and ElevenLabs text-to-speech

## Features

- Email/password auth with email verification
- Google + Slack integration OAuth
- Briefing generation (morning/evening/weekly/alert)
- Task extraction and task management
- Scheduled jobs and queue workers
- Health endpoints: `GET /health`, `GET /ready`

## Local Development

1. Start dependencies: `docker-compose up -d`
2. Copy env template and set values: `cp .env.example .env`
3. Install dependencies and run backend:

```sh
npm install
npm run dev
```

1. In a second terminal, run frontend: `npm run frontend:dev`

Frontend runs on `http://localhost:8080` and proxies API calls to `http://localhost:3000`.

## Required Environment Variables

Use `.env.example` as the source of truth. Do not commit real credentials.

- `NODE_ENV`, `PORT`
- `DATABASE_URL`, `DATABASE_SSL_MODE`
- `REDIS_URL`
- `JWT_SECRET`
- `BASE_URL`, `FRONTEND_URL`
- `SMTP_*`, `EMAIL_FROM` (for verification emails)
- Provider credentials as needed: `GOOGLE_*`, `SLACK_*`, `TWILIO_*`, `ELEVENLABS_*`, `HUBSPOT_API_KEY`, `AWS_*`

### Production requirements

- `JWT_SECRET` must be strong (not `change-me`)
- `BASE_URL`, `FRONTEND_URL`, OAuth redirect URIs must be HTTPS
- `AUTH_DEV_RETURN_VERIFICATION_TOKEN=false`
- `AUTH_DEV_LOG_VERIFICATION_LINK=false`
- `AUTH_RATE_LIMIT_FAIL_OPEN=false` (recommended)

## Production Deployment

### Docker image

Build and run the app container:

```sh
docker build -t voicebrief:latest .
docker run --env-file .env -p 3000:3000 voicebrief:latest
```

The container serves both API and built frontend.

### CI

GitHub Actions workflow is defined in `.github/workflows/ci.yml` and runs:

- Backend typecheck + tests
- Frontend lint + tests + build

## Database migrations

- SQL migrations are stored in `src/db/migrations`.
- On startup, the app records applied migrations in `schema_migrations` and only runs new files.
- Keep migration filenames ordered with a numeric prefix (for example `002_add_index.sql`).

## Operations Runbook (minimum)

- **Liveness:** `GET /health`
- **Readiness:** `GET /ready` (checks Postgres + queue availability)
- **Logs:** backend uses `morgan` and app logs to stdout
- **Shutdown:** graceful `SIGINT`/`SIGTERM` handling is implemented
- **Detailed procedures:** `docs/operations-runbook.md`

## Security Notes

- Core API routes now require both authentication and verified email.
- Auth rate limits are Redis-backed and default to fail-closed if Redis is unavailable.
- Never store production secrets in repository files.

## Known production gaps

- Replace placeholder legal copy in frontend privacy/terms pages with final legal documents.

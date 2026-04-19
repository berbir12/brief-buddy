# Brief Buddy Frontend

React dashboard for Brief Buddy (auth, briefings, tasks, settings, integrations).

## Development

From the repository root:

1. Start backend dependencies: `docker-compose up -d`
1. Start backend API: `npm run dev`
1. Start frontend dev server: `npm run frontend:dev`

Frontend runs at `http://localhost:8080` and proxies `/api` to `http://localhost:3000`.

## Scripts

Run in `frontend/`:

- `npm run dev` - start Vite dev server
- `npm run build` - production build to `frontend/dist`
- `npm run lint` - ESLint checks
- `npm run test` - Vitest tests

## Auth behavior

- Registration creates an account but does not sign in automatically.
- Users verify email, then sign in.
- Protected product routes require a verified account on the backend.

## Production notes

- This app is served by the backend in production (`src/index.ts`).
- Keep `VITE_API_BASE` empty when frontend and API share origin.

## Legal content configuration

- Legal page text is rendered from:
  - `frontend/src/pages/PrivacyPage.tsx`
  - `frontend/src/pages/TermsPage.tsx`
- Shared business/legal identity values are centralized in:
  - `frontend/src/config/legal.ts`
- Before launch, update `LEGAL_CONFIG` (entity name, contact emails, address, effective dates) and have counsel review.

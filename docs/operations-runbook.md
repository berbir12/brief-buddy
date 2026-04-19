# Operations Runbook

This runbook defines the minimum operational checks for production.

## Health checks

- Liveness: `GET /health`
- Readiness: `GET /ready`
- Expected readiness dependencies: Postgres and Redis queue connectivity

## Daily checks

- Check app/container logs for repeated 5xx, auth failures, queue failures
- Check queue lag and failed jobs
- Check reliability alerts generated for users

## Backup policy (Postgres)

- Run daily automated logical backups (for example `pg_dump`) to encrypted object storage.
- Keep at least:
  - 7 daily backups
  - 4 weekly backups
  - 3 monthly backups
- Verify backup job completion and object integrity each day.

## Restore drill policy

- Run a restore drill at least once per month into an isolated environment.
- Validate:
  - schema is restored
  - key tables contain expected row counts
  - app can start and pass `/ready` against restored DB
- Record drill date, duration, and issues in an internal ops log.

## Incident response baseline

- Declare incident for sustained 5xx spikes, auth outages, or data corruption risk.
- Freeze deploys during active incident.
- Capture timeline:
  - start time
  - impacted components
  - mitigation applied
  - recovery time
- Publish post-incident notes with follow-up action items.

## Pre-release checklist

- CI green on main branch
- Backend typecheck/tests/build pass
- Frontend lint/tests/build pass
- Env vars validated in production target
- OAuth callbacks configured with HTTPS URLs
- SMTP verification email successfully tested
- Twilio webhook signature validation tested
- Privacy and Terms pages reviewed and approved by legal

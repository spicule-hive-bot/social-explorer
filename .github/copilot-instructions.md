# GitHub Copilot: Social Explorer

A social media research platform: a SvelteKit 2 / Svelte 5 web app and API (`ex-accell-ui/`,
TypeScript, Tailwind CSS 4, Vitest, Playwright), Python ETL (`etl/`), a radio ingestion service
(`wavepulse/`), a Jupyter image (`jupyter/`) and a VitePress docs site (`docs-site/`), around
PostgreSQL with the `pg_duckdb` extension. Public, Apache-2.0, pre-1.0.

Full map and rules: `AGENTS.md` at the repo root. The web app's own guide is
`ex-accell-ui/CLAUDE.md`.

## Deliverables and hard stops (full text in AGENTS.md)

- Every task ends in a pull request, a written finding or a `no_work_needed` verdict with
  evidence. If the work is blocked or out of scope, comment an evidenced finding (what you
  checked, what blocks it, what would unblock it, what you could not verify); do not stay silent
  or widen the scope.
- Never push to or merge into `main`, merge your own PR, run or edit `deploy.yml`, publish data
  over IPFS, or remove `hold`, `do-not-merge`, `needs-human` or `human-queue`. Stop and write a
  finding before an authentication, authorisation, secrets or supply-chain change, a new
  dependency or outbound destination, or a data-losing migration.
- Work labelled `issue-approved` (which requires acceptance criteria) is yours; skip issues
  labelled `human-queue`, `hold`, `do-not-merge`, `needs-human`, `blocked`, `wontfix` or
  `duplicate`.

## Conventions to match

- **Auth**: every `/api/*` route requires a session unless `src/lib/server/auth/guard.ts` lists it
  as public; endpoints that run code or manage users are admin-only. Add new sensitive routes to
  the guard's admin patterns and its tests.
- **SQL** is parameterised (`postgresPool` from `src/lib/services/postgres.ts`). No shell strings
  from user input: `execFile`/`spawn` with an argument array, identifiers checked with
  `assertSafeIdentifier` and `resolveWithin`.
- **API responses** use `{ success, data, error }`. Only a missing table (Postgres `42P01`)
  becomes an empty 200; any other failure is a generic 500 via `queryErrorResponse`.
- **Migrations** are `ex-accell-ui/db/migrations/NNNN_name.sql`; never edit an applied one.
- **Server-only code** goes under `src/lib/server/`. Tailwind utility classes only; no `<style>`
  blocks or inline styles. Use brand tokens (`ink`, `primary`, `signal`, `success`, `danger`).
- **Immutability**, small functions, files under about 800 lines, no `console.log` (use
  `createLogger`).
- **Tests first.** Vitest files sit beside the source; the coverage floor in `vitest.config.ts`
  only goes up.

## Things not to do

- Do not commit `.env*` (except `.env.example`), keys or tokens, and do not put real posts,
  handles, transcripts or user data in code, tests, fixtures or comments.
- Do not weaken the tests, the coverage floor or the `ci` check.
- `wavepulse/` files derived from WavePulse keep their copyright headers.

## Before you call a change done

```bash
cd ex-accell-ui && npm ci && npm run lint && npm run test:unit:coverage && npm run build
```

The check that matters is `ci`, the aggregate job in `.github/workflows/test.yml`.

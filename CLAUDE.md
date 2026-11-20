# CLAUDE.md

Guidance for Claude Code in this repository. [`AGENTS.md`](AGENTS.md) is the source of truth: the
repository shape, the commands, the invariants, the hard stops and the PR process. Read it first.
If this file and `AGENTS.md` disagree, `AGENTS.md` wins and this file is the bug.

Social Explorer is a public, pre-1.0 social media research platform: SvelteKit web app and API
(`ex-accell-ui/`), Python ETL (`etl/`), a radio ingestion service (`wavepulse/`), a Jupyter image
(`jupyter/`), a VitePress docs site (`docs-site/`), all around PostgreSQL with `pg_duckdb`.

## Where the detail lives

- `ex-accell-ui/CLAUDE.md`: the web app's stack, commands, layout, data-access rules, security
  rules and styling. Read it before touching `ex-accell-ui/`.
- `etl/CLAUDE.md` and `etl/DEVELOPER_GUIDE.md`: the ETL pipelines. Parts of `etl/CLAUDE.md` are
  stale (a personal virtual-environment path, PostgreSQL 18 where `docker-compose.yml` uses
  `pgduckdb/pgduckdb:17-main`); check a command against the code before relying on it.
- `CONTRIBUTING.md`: local setup, conventions, the pull request process.
- `SECURITY.md`: reporting and deployment hardening.

## Rules most often broken

- **No collected content in prompts, logs, tests or fixtures.** Posts, handles, transcripts and user
  data are personal. Tests use the synthetic demo generator.
- **No secrets.** Do not read `.env*` other than `.env.example`. `DEPLOY_SSH_KEY`, `SCW_*` and
  `ANTHROPIC_API_KEY` are repository secrets: never print or reference them.
- **Auth first.** Every `/api/*` route needs a session unless `guard.ts` lists it as public; code
  execution and user management are admin-only. SQL is parameterised; no shell from user input.
- **Do not touch deployment.** `deploy.yml` is manual and publishes to production. Never run it.
- **Never push to `main`.** Branch, open a pull request, wait for the `ci` check, and report what
  the commands in `AGENTS.md` printed before calling a change done.
- Tests first (red, green, refactor), `type: description` commits, Tailwind classes only, no
  `console.log` in production code.

`hold`, `do-not-merge`, `needs-human` and `human-queue` mean stop: do not remove them. Only
`issue-approved` issues (with acceptance criteria) are agent work.

Skills are in `.agents/skills/` (`.claude/skills` links to it): `social-explorer-check` runs the
repository's real pre-PR gate. The AI policy is `docs/security/SECURITY-AI.md`.

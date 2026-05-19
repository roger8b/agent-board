# Claude Code — agent-kanban

Working on the `agent-kanban` source tree. The canonical rules are in [`AGENTS.md`](AGENTS.md); this file adds Claude-Code-specific guidance.

## Read first

- [`AGENTS.md`](AGENTS.md) — architecture, conventions, paths, hard rules.
- [`README.md`](README.md) / [`README.pt-BR.md`](README.pt-BR.md) — user-facing surface (app, CLI, API, SSE).
- [`SPEC.md`](SPEC.md) — original spec. Note the explicit scope deviations (single-board UI, no priority/labels) — don't "fix" them.

## Claude-specific

### Verify in the browser, not just by reading code

UI/board changes must be checked live. Start `npm run dev`, open `http://localhost:3000/board`, exercise the path (add card, drag, panel, subtask, comment), and confirm SSE auto-refresh by mutating via the CLI in another shell. Type-checking is not feature-checking.

### Mutations flow through one place

Add a mutation: implement it in `src/lib/service.ts` (with `allocId` for new entities + an `emit(...)`), then expose it twice — a thin `"use server"` wrapper in `actions.ts` (with `revalidatePath("/board")`) for the UI, and a route handler under `src/app/api/**` (via `handle()`) for the CLI. Never call Prisma from a route/action directly. Add the new event type to the `TYPES` array in `BoardClient.tsx` or the board won't refresh on it.

### Database changes are destructive — ask

`npm run db:seed` and `db:push --force-reset` overwrite `~/.agent-kanban/data.db`. Prisma 7 hard-blocks `--force-reset` without `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION`. Always ask the user before any reset/reseed, and treat anything under `~/.agent-kanban/` as user state.

### The CLI stays dependency-free

`bin/kanban.mjs` is plain Node (global `fetch`, `node:readline`, `node:fs`). Don't add npm deps or a build step. New command → extend the `main()` switch + `HELP`. `kanban init` must short-circuit before any `api()` call (it's offline file ops).

### Prisma 7 gotchas (already solved — don't regress)

- Driver adapter is mandatory: `new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) })`.
- Config lives in `prisma.config.ts`; schema datasource has no `url`.
- `prisma db push` / `migrate` do **not** auto-run `generate` or `seed` — the npm scripts are explicit. Don't pass removed flags like `--skip-generate`.
- Generated client is `src/generated/prisma` (git-ignored); import `@/generated/prisma/client`.

### Use subagents/tools deliberately

Browser verification via the Playwright MCP; screenshots are git-ignored (`*.png`). Clean up test cards/boards you create (re-seed only with consent, or delete via the CLI).

### Do NOT

- Reintroduce `@default(cuid())` or non-allocated ids — Jira `{PREFIX}-NNN` via `allocId` is the contract.
- Bypass `service.ts` from routes/actions, or mutate without `emit(...)`.
- Restart/kill `next dev` as a workaround — find the root cause.
- Expand scope (multi-board UI, priority/labels, DB-backed Agents/Settings) without explicit user confirmation.
- Commit `src/generated/`, `.next/`, `node_modules/`, `.env`, `*.png`, or `~/.agent-kanban/` contents.

### Memory paths

User data: `~/.agent-kanban/data.db`. Installed app copy (via `install.sh`): `~/.agent-kanban-app`. Never delete or hand-edit either; the installer rsync deliberately excludes `node_modules`, `.next`, `src/generated`.

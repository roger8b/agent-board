# Agent guide — agent-kanban

Canonical instruction set for any AI coding agent (Claude Code, Codex, Gemini CLI, Cursor, etc.) working **on the agent-kanban source tree**. `CLAUDE.md` re-exports this file with Claude-Code-specific overrides.

> To make an agent *use* the board (not develop it), run `kanban init` in that agent's project — it installs the `agent-kanban` skill and writes a board section into the project's CLAUDE.md/AGENTS.md.

## What this project is

Local-first Kanban for delegating tasks to AI agents. Next.js 16 (App Router, React 19) + Prisma 7 over SQLite at `~/.agent-kanban/data.db`. Real-time via SSE. A `kanban` CLI (plain Node) drives the same HTTP API the UI uses.

```
prisma/
  schema.prisma        Board · Column · Task · SubTask · Comment (Jira-style string ids)
  seed.ts              deterministic PROJ-### seed; persists Board.counter
src/
  app/
    api/               REST route handlers + /api/events (SSE)
    board/page.tsx     server component → BoardClient
    agents/ settings/  client pages (localStorage placeholders — future DB phase)
  components/          Sidebar, BoardClient
  lib/
    db.ts              Prisma client (better-sqlite3 adapter), home-dir db path
    service.ts         pure DB ops + Jira id allocator + SSE emit  ← source of truth
    actions.ts         "use server" wrappers → service + revalidatePath
    events.ts          in-memory SSE pub/sub (globalThis singleton)
    data.ts            board read for the server page
    http.ts            ok/fail/handle helpers for route handlers
bin/kanban.mjs         the CLI (commands + `init`)
templates/skills/      agent-kanban skill copied by `kanban init`
install.sh             local-first installer
```

## Architecture rules

- **`service.ts` is the single source of truth for mutations.** Both server actions (`actions.ts`) and REST routes (`app/api/**`) must call `service.ts` — never hit Prisma directly from a route or action. The service is also the only place that emits SSE events; bypassing it means the UI won't update live.
- **IDs are allocated, never defaulted.** Board id = the sanitized **prefix** (`PROJ`). Tasks + subtasks share the per-project **issue counter** via `allocIssueId(boardId)` → `{PREFIX}-NNN` (atomic `Board.counter` increment; 1st task = `PROJ-001`). Columns use `allocColumnId(boardId)` → `{PREFIX}-C{n}` (atomic `Board.colCounter`). Comments are `COMMENT-<8hex>`. No `@default(cuid())` — schema ids are plain `String @id` and the creating service function supplies the id. Numbers are never reused.
- **Counter integrity.** Every task/subtask create goes through `allocIssueId`, every column through `allocColumnId`. The seed maintains its own `counter`/`colCounter` and writes both back to the Board so runtime allocation continues the sequence. `createBoard` also seeds the 5 default columns.
- **Real-time contract.** Mutations call `emit("<entity>:<verb>", {...})`. `BoardClient` subscribes via `EventSource` to `/api/events` and debounces a `router.refresh()`. New event types must be added to the `TYPES` list in `BoardClient.tsx`.
- **DB location is derived, not configured.** `~/.agent-kanban/data.db` via `os.homedir()` in `db.ts` and `prisma.config.ts`. Don't hard-code paths or assume the install dir is writable for data.

## Conventions

- TypeScript strict, ESM (`"type": "module"`). `@/*` → `src/*`.
- Node built-ins use the `node:` prefix.
- Server-only modules (`db.ts`, `service.ts`) must never be imported into client components. `actions.ts` (`"use server"`) is the client-safe boundary; the board page passes plain data to `BoardClient`.
- Route handlers: `export const dynamic = "force-dynamic"`, `params` is a `Promise` (Next 16) — `const { id } = await params`. Return via `handle()` from `lib/http.ts`.
- Prisma 7 specifics: driver adapter required (`@prisma/adapter-better-sqlite3`), config in `prisma.config.ts`, generator output `src/generated/prisma` (git-ignored), CLI does **not** auto-generate/seed — scripts are explicit (`db:generate`, `db:push`, `db:seed`).
- CSS: design tokens + ported prototype classes in `src/app/globals.css`. Match the prototype's Notion-like palette; don't introduce new color systems.
- The CLI (`bin/kanban.mjs`) is dependency-free plain Node (global `fetch`, `node:readline`). Keep it that way — no build step, no npm deps.

## CLI

`bin/kanban.mjs` talks to the HTTP API (`KANBAN_URL`, default `http://localhost:3000`). Output flags `--json` / `--table` / `--quiet`. Adding a command: extend the `switch (\`${resource} ${action}\`)` in `main()` and the `HELP` string. `kanban init` is special — it does local file ops only and must run **before** any `api()` call (no server needed).

## Scripts

`kanban start` is the transparent run path (idempotent: starts the server detached + opens the browser; `--no-open` for agents; `kanban status`/`kanban stop` manage it). `npm run dev` remains the direct dev path.

```bash
kanban start         # transparent: start (if down) + open browser
npm run dev          # next dev (http://localhost:3000) — direct
npm run db:generate  # prisma generate → src/generated/prisma
npm run db:push      # sync schema to ~/.agent-kanban/data.db
npm run db:seed      # tsx prisma/seed.ts  (OVERWRITES data)
npm run db:reset     # prisma migrate reset --force
npm run build        # next build
```

After editing `schema.prisma`: `npm run db:generate && npm run db:push` (and `db:seed` if you need fresh data). `db:push --force-reset` is destructive and Prisma 7 will block it without explicit user consent — ask first.

## Hard rules

- Never read or write `~/.agent-kanban/data.db` directly in app code or tooling — go through `service.ts` (app) or the CLI/API (external).
- Never bypass `service.ts` from a route handler or server action.
- Never reintroduce `@default(cuid())` or auto-generated ids — the Jira allocator is the contract.
- Never run `prisma db push --force-reset` / `db:reset` without explicit user confirmation (destroys local data).
- Never restart/kill the dev server as a workaround; diagnose the root cause.
- Keep `bin/kanban.mjs` dependency-free.
- Decisions held by explicit user choice: single-board UI (data layer is multi-board capable), card has no priority/labels, Agents & Settings pages are localStorage placeholders. Don't "complete" these without asking.

## Commits / PRs

- Conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`. Scope optional.
- AI-assisted commits include `Co-Authored-By: Claude <noreply@anthropic.com>`.
- Never commit `node_modules/`, `.next/`, `src/generated/`, `.env`, screenshots, or anything under `~/.agent-kanban/`.

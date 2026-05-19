# Agent Board

**English** · [Português](./README.pt-BR.md)

Local-first Kanban for delegating and tracking tasks given to AI agents. You interact through a visual board in the browser; agents interact through a CLI. Everything is stored locally in SQLite — no servers, no accounts.

> Built from `SPEC.md` and the visual prototype in `Prototype-·-5_18_2026/`.

## Stack

| Layer     | Tech                                            |
| --------- | ----------------------------------------------- |
| Frontend  | Next.js 16 (App Router, React 19)               |
| Backend   | Next.js Server Actions + REST Route Handlers    |
| Database  | SQLite via Prisma 7 (`@prisma/adapter-better-sqlite3`) |
| Real-time | Server-Sent Events (`/api/events`)              |
| CLI       | Node script over the HTTP API (`kanban`)        |

Data lives at `~/.agent-kanban/data.db`.

## Requirements

- Node.js **>= 20.19** (Node 18 not supported by Prisma 7)
- npm

## Install

```bash
# from the project directory
bash install.sh --local
```

The installer syncs the code to `~/.agent-kanban-app`, installs dependencies, generates the Prisma client, creates/syncs the database, seeds initial data **only if the DB is empty**, and links the `kanban` CLI globally.

Flags:

- `--local [src]` — install from a local checkout (default: current dir)
- `--seed` — force (re)seed even if data exists (**overwrites**)
- `--no-link` — skip the global `kanban` CLI link

### Manual setup

```bash
npm install
npm run db:generate     # prisma generate
npm run db:push         # create/sync schema at ~/.agent-kanban/data.db
npm run db:seed         # initial data (PROJ-001 …)
npm run dev             # http://localhost:3000
```

## Running

The transparent way — starts the server (if down) and opens the browser. Idempotent; works for a human **or** an AI agent:

```bash
kanban start            # start + open http://localhost:3000
kanban start --no-open  # start without opening a browser (agents)
kanban status           # exit 0 = up, 1 = down
kanban stop             # stop a server started by kanban start
```

Or run the dev server directly:

```bash
npm run dev   # http://localhost:3000
```

- **/** — launcher / overview
- **/board** — the Kanban board (DB-backed, real-time)
- **/agents** — agents management (local placeholder)
- **/settings** — columns & per-stage behavior (local placeholder)

## IDs (Jira style)

`PREFIX` is the project. Tasks and subtasks share a per-project **issue counter** — the first task is `PROJ-001`. Columns get their own readable ids; the board id is the prefix itself:

```
Board:   PROJ              (= prefix; the project)
Column:  PROJ-C1, PROJ-C2… (workflow columns)
Task:    PROJ-001          (1st issue), PROJ-002…
SubTask: PROJ-003          (subtasks share the issue counter)
Comment: COMMENT-a1b2c3d4
```

Counters never reuse a number. Card and detail panel show the id for quick identification.

## Projects (front-end)

The board top-bar has a **project selector** (dropdown) listing every project; switching navigates to `/board?b=<PREFIX>`. **Novo projeto** opens a modal (name + prefix) that creates the project with the 5 default columns and switches to it. Multiple projects are fully supported.

## CLI

With the dev server running:

```bash
kanban board list
kanban board create "Marketing" --prefix MKT

kanban column list
kanban task list
kanban task create <columnId> "Implement login" --agent coder --desc "OAuth flow"
kanban task move <taskId> <targetColumnId> [order]
kanban task update <taskId> --title "New title"
kanban task delete <taskId>

kanban subtask create <taskId> "Write schema" --status progress
kanban subtask toggle <subtaskId>

kanban comment create <taskId> "Working on it" agent
kanban comment list <taskId>

kanban --help
```

Output flags: `--json`, `--table` (default), `--quiet`. Server URL override: `KANBAN_URL` (default `http://localhost:3000`).

Any CLI mutation is pushed to open browsers in real time via SSE.

## Wire an AI agent to the board (`kanban init`)

To let an AI coding agent (Claude Code, Codex, Gemini CLI, Cursor, …) *operate* the board, run inside that project:

```bash
kanban init                 # interactive: scope, method, confirm
kanban init --yes           # non-interactive (local, symlink, detected agents)
kanban init --scope both --method copy --force --all
```

It detects installed agents, installs the **`agent-kanban` skill** into the agent's skills dir (symlink or copy), and writes a marker-delimited board section into the project's `CLAUDE.md` / `AGENTS.md` / `GEMINI.md` / Cursor rule (created or appended, idempotent — re-run with `--force` to refresh). A `.agent-kanban.json` manifest is written to the project root.

The skill ([`templates/skills/agent-kanban/SKILL.md`](templates/skills/agent-kanban/SKILL.md)) teaches the agent the workflow: find assigned tasks, move cards across columns, track subtasks, and report progress via comments (author `agent`) — all through the `kanban` CLI, never by touching the DB.

> `AGENTS.md` / `CLAUDE.md` at this repo root are the guide for agents working **on this codebase** (development), distinct from the board-usage section `kanban init` writes into *other* projects.

## REST API

Base: `http://localhost:3000/api`

| Method | Path                          | Purpose                  |
| ------ | ----------------------------- | ------------------------ |
| GET    | `/boards` · `/board`          | list / default board     |
| POST   | `/boards`                     | create board `{name,prefix?}` |
| GET    | `/boards/:id`                 | full board tree          |
| GET/POST | `/columns`                  | list / create column     |
| PATCH/DELETE | `/columns/:id`          | rename · reorder · delete |
| GET/POST | `/tasks`                    | list / create task       |
| GET/PATCH/DELETE | `/tasks/:id`        | read · update · delete   |
| POST   | `/tasks/:id/move`             | move task                |
| GET/POST | `/tasks/:id/subtasks`       | list / create subtask    |
| PATCH/DELETE | `/subtasks/:id`         | update · delete          |
| POST   | `/subtasks/:id/toggle`        | toggle done              |
| GET/POST | `/tasks/:id/comments`       | list / create comment    |
| DELETE | `/comments/:id`               | delete comment           |
| GET    | `/events`                     | SSE event stream         |

## Real-time (SSE)

`GET /api/events` is a `text/event-stream`. The board subscribes via `EventSource` and refreshes on `task:*`, `subtask:*`, `comment:*`, `column:*` events. Heartbeat every 30s.

## Project structure

```
prisma/            schema.prisma · seed.ts
src/
  app/
    api/           REST route handlers + /api/events (SSE)
    board/         server page (fetches board)
    agents/        client page (localStorage)
    settings/      client page (localStorage)
  components/      Sidebar, BoardClient
  lib/
    db.ts          Prisma client (better-sqlite3 adapter)
    service.ts     pure DB ops + Jira id allocator + event emit
    actions.ts     server actions (delegate to service + revalidate)
    events.ts      in-memory SSE pub/sub
bin/kanban.mjs     CLI
install.sh         installer
```

## Scope notes

Implemented: Foundation (Board/Column/Task/SubTask/Comment), DB-backed board UI, drag & drop, REST API, `kanban` CLI, SSE real-time, Jira-style IDs.

By explicit decision, **not** included: multi-board UI (data layer supports it; UI is single-board), card priority/labels. Agents & Settings pages are faithful prototype ports backed by `localStorage` pending a future DB phase.

## Troubleshooting

- **`kanban` not found** — add npm global bin to PATH: `export PATH="$(npm config get prefix)/bin:$PATH"`.
- **CLI can't connect** — run `kanban start` (or `npm run dev`; or set `KANBAN_URL`).
- **Reset data** — `npm run db:seed` (re-seeds, overwriting). Full reset: `npm run db:reset`.

---
name: agent-kanban
description: Use this skill when the user asks you to work from the Agent Board / Kanban, pick up the next task, check what's assigned to you, report progress on a task, move a card between columns, add subtasks, or answer/leave comments on a board task. The `kanban` CLI is the only supported interface to the board (a local SQLite-backed Kanban). Do NOT use this skill for unrelated coding work that was not delegated through the board.
---

# agent-kanban

The user runs **Agent Board** — a local Kanban for delegating tasks to AI agents. Tasks live in columns; you receive work, execute it, report progress through comments, and move the card across the workflow. The `kanban` CLI is the only interface — it talks to the running app's HTTP API. The UI updates in real time as you act.

## Prerequisite — start the app (you may do this)

The Agent Board app must be running for the CLI to work. Starting it is a
first-class, idempotent command — **you may run it yourself**:

```bash
kanban start --no-open     # starts the server if down; safe to call repeatedly
kanban status              # exit 0 = up, 1 = down
```

`kanban start` launches the server detached and returns; `--no-open` skips the
browser (use it — you don't need the UI). If `kanban status` is already up,
`start` is a no-op. Begin any board session with `kanban start --no-open`.

If `start` times out or `status` stays down after that, surface the problem and
the log path (`~/.agent-kanban/dev.log`) to the user — **do not** kill/restart
processes or edit the database to "fix" it.

## IDs

Every entity has a Jira-style id: `{PREFIX}-NNN` (board `PROJ-001`, column `PROJ-002`, task `PROJ-003`, subtask `PROJ-004`), comments `COMMENT-xxxxxxxx`. Always refer to tasks by id in your messages to the user.

## The workflow you follow

Columns model the lifecycle. Default: **Backlog → Refinement → Development → Review → Done**. When you take a task, move it forward as you progress and comment at each meaningful step so the human sees status in the board.

1. **Find work** — list the board, look for tasks assigned to your agent role (or that the user pointed you to).
2. **Claim it** — move the card to the active column (e.g. `Development`) and post a comment that you started.
3. **Break it down** (optional) — add subtasks for multi-step work; toggle them as you complete them.
4. **Report** — post comments on progress, questions, blockers. The human replies in the same thread.
5. **Hand off** — move to `Review` (or `Done`) when finished, with a summary comment of what you did.

## Reading the board

```bash
kanban board get <boardId> --json     # full tree: columns → tasks → subtasks/comments
kanban column list                    # column ids + names (the workflow)
kanban task list --json               # all tasks with columnId + agent
kanban task get <taskId> --json       # one task: subtasks + comments
```

Pick the task whose `agent` matches your role (`analyst`, `coder`, `reviewer`) or the one the user named. Use `--json` when you need to parse; default table output is for humans.

## Acting on a task

```bash
# move across the workflow (get target columnId from `kanban column list`)
kanban task move <taskId> <targetColumnId>

# progress + communication (this is how the human sees what you're doing)
kanban comment create <taskId> "Comecei: analisando os logs de produção." agent
kanban comment list <taskId>

# subtasks
kanban subtask create <taskId> "Mapear endpoints afetados" --status progress
kanban subtask toggle <subtaskId>          # mark done / undone
kanban subtask list <taskId>

# editing a task you own
kanban task update <taskId> --title "..." --desc "..."
```

Always pass `agent` as the comment author so the board shows it came from you (the agent), not the human.

## Hard rules

- **Never touch `~/.agent-kanban/data.db` directly** (no sqlite, no file edits). The CLI/API is the only writer — direct writes corrupt ordering and skip real-time events.
- **Starting is allowed via `kanban start` only** (idempotent, supported). Never manually `npm run dev`, kill, or restart Node processes to "fix" connectivity — if `kanban start` doesn't bring it up, surface the log and stop.
- **Communicate through comments, author `agent`.** The board is the shared surface — don't silently do work; narrate via comments so the human can follow and reply.
- **Move cards to reflect reality.** A task you're working on belongs in the active column; a finished one goes to Review/Done. Don't leave stale state.
- **Use ids verbatim.** Refer to tasks/columns by their `{PREFIX}-NNN` id when talking to the user.
- The CLI hits `http://localhost:3000` by default; override only via `KANBAN_URL` if the user set a different port.

## Quick recipes

```bash
# What's on my plate? (coder role)
kanban task list --json | <filter agent == "coder">

# Take PROJ-011 into Development and announce it
kanban column list                                  # find Development id
kanban task move PROJ-011 <devColumnId>
kanban comment create PROJ-011 "Iniciando OAuth backend. ETA: ~2h." agent

# Finish: summarize and hand to Review
kanban subtask toggle PROJ-0xx
kanban comment create PROJ-011 "Concluído: OAuth implementado, testes passando. Detalhes no PR." agent
kanban task move PROJ-011 <reviewColumnId>

# Start of session: ensure the app is up (idempotent), then check health
kanban start --no-open
kanban status            # exit 0 = up
```

#!/usr/bin/env node
// Agent Board CLI — talks to the running Next.js HTTP API.
// Base URL override: KANBAN_URL (default http://localhost:3000)

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const BASE = process.env.KANBAN_URL || "http://localhost:3000";

const argv = process.argv.slice(2);
const flags = { json: false, table: false, quiet: false, help: false };
const opts = {};
const pos = [];

for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--json") flags.json = true;
  else if (a === "--table") flags.table = true;
  else if (a === "--quiet") flags.quiet = true;
  else if (a === "--help" || a === "-h") flags.help = true;
  else if (a === "-y") opts.yes = true;
  else if (a.startsWith("--")) {
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) opts[key] = true;
    else {
      opts[key] = next;
      i++;
    }
  } else pos.push(a);
}

function die(msg, code = 1) {
  if (!flags.quiet) console.error(msg);
  process.exit(code);
}

async function api(method, path, body) {
  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    die(`Não foi possível conectar a ${BASE}. O servidor está rodando? (npm run dev)`);
  }
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) die(`Erro ${res.status}: ${(data && data.error) || text}`);
  return data;
}

function out(data, columns) {
  if (flags.quiet) return;
  if (flags.json || !columns) {
    console.log(JSON.stringify(data, null, 2));
    return;
  }
  const rows = Array.isArray(data) ? data : [data];
  if (rows.length === 0) {
    console.log("(vazio)");
    return;
  }
  const widths = columns.map((c) =>
    Math.max(c.label.length, ...rows.map((r) => String(pick(r, c.key) ?? "").length)),
  );
  const line = (cells) =>
    "│ " + cells.map((c, i) => String(c ?? "").padEnd(widths[i])).join(" │ ") + " │";
  const sep = (l, m, r) =>
    l + widths.map((w) => "─".repeat(w + 2)).join(m) + r;
  console.log(sep("┌", "┬", "┐"));
  console.log(line(columns.map((c) => c.label)));
  console.log(sep("├", "┼", "┤"));
  for (const r of rows) console.log(line(columns.map((c) => pick(r, c.key))));
  console.log(sep("└", "┴", "┘"));
}

function pick(obj, key) {
  return key.split(".").reduce((o, k) => (o == null ? o : o[k]), obj);
}

function msg(s) {
  if (!flags.quiet) console.log(s);
}

const HELP = `Agent Board CLI

Uso: kanban <recurso> <ação> [args] [flags]

Board:
  kanban board list
  kanban board get <boardId>
  kanban board create "<nome>" [--prefix PROJ]

Column:
  kanban column list [boardId]
  kanban column create [boardId] "<nome>" [--color #HEX]
  kanban column rename <columnId> "<nome>"
  kanban column delete <columnId>

Task:
  kanban task list [boardId]
  kanban task get <taskId>
  kanban task create <columnId> "<título>" [--desc "..."] [--agent analyst|coder|reviewer]
  kanban task move <taskId> <targetColumnId> [order]
  kanban task update <taskId> [--title "..."] [--desc "..."] [--agent "..."]
  kanban task delete <taskId>

SubTask:
  kanban subtask list <taskId>
  kanban subtask create <taskId> "<título>" [--desc "..."] [--status progress|done]
  kanban subtask update <subtaskId> [--title "..."] [--desc "..."] [--status "..."]
  kanban subtask toggle <subtaskId>
  kanban subtask delete <subtaskId>

Comment:
  kanban comment list <taskId>
  kanban comment create <taskId> "<texto>" [author]
  kanban comment delete <commentId>

Setup:
  kanban init [--yes] [--scope local|global|both] [--method symlink|copy] [--force] [--all]
              Wire an AI agent (Claude Code, Codex, …) to use the board:
              installs the agent-kanban skill and writes a board section
              into the project's CLAUDE.md / AGENTS.md. Interactive by default.

Flags: --json  --table  --quiet  --help
Env:   KANBAN_URL (default http://localhost:3000)`;

// ── init: wire an AI agent to use the board ──────────────────────────────
const HOME = os.homedir();
const MARK_START = "<!-- agent-kanban:start -->";
const MARK_END = "<!-- agent-kanban:end -->";

const AGENTS = {
  "claude-code": {
    label: "Claude Code", skillsDir: ".claude/skills",
    globalSkillsDir: path.join(process.env.CLAUDE_CONFIG_DIR || path.join(HOME, ".claude"), "skills"),
    ruleFile: "CLAUDE.md", ruleFormat: "boilerplate", appendOk: true,
    detect: () => fs.existsSync(process.env.CLAUDE_CONFIG_DIR || path.join(HOME, ".claude")),
  },
  codex: {
    label: "Codex", skillsDir: ".agents/skills",
    globalSkillsDir: path.join(process.env.CODEX_HOME || path.join(HOME, ".codex"), "skills"),
    ruleFile: "AGENTS.md", ruleFormat: "boilerplate", appendOk: true,
    detect: () => fs.existsSync(process.env.CODEX_HOME || path.join(HOME, ".codex")),
  },
  "gemini-cli": {
    label: "Gemini CLI", skillsDir: ".agents/skills",
    globalSkillsDir: path.join(HOME, ".gemini/skills"),
    ruleFile: "GEMINI.md", ruleFormat: "boilerplate", appendOk: true,
    detect: () => fs.existsSync(path.join(HOME, ".gemini")),
  },
  cursor: {
    label: "Cursor", skillsDir: ".agents/skills",
    globalSkillsDir: path.join(HOME, ".cursor/skills"),
    ruleFile: ".cursor/rules/agent-kanban.mdc", ruleFormat: "cursor", appendOk: false,
    detect: () => fs.existsSync(path.join(HOME, ".cursor")),
  },
  opencode: {
    label: "OpenCode", skillsDir: ".agents/skills",
    globalSkillsDir: path.join(process.env.XDG_CONFIG_HOME || path.join(HOME, ".config"), "opencode/skills"),
    ruleFile: "AGENTS.md", ruleFormat: "boilerplate", appendOk: true,
    detect: () => fs.existsSync(path.join(process.env.XDG_CONFIG_HOME || path.join(HOME, ".config"), "opencode")),
  },
  amp: {
    label: "Amp", skillsDir: ".agents/skills",
    globalSkillsDir: path.join(process.env.XDG_CONFIG_HOME || path.join(HOME, ".config"), "agents/skills"),
    ruleFile: "AGENTS.md", ruleFormat: "boilerplate", appendOk: true,
    detect: () => fs.existsSync(path.join(process.env.XDG_CONFIG_HOME || path.join(HOME, ".config"), "amp")),
  },
  agents: {
    label: "Generic (AGENTS.md)", skillsDir: ".agents/skills",
    globalSkillsDir: path.join(HOME, ".agents/skills"),
    ruleFile: "AGENTS.md", ruleFormat: "boilerplate", appendOk: true,
    detect: () => false,
  },
};

function boilerplate(def) {
  return `${MARK_START}
# Agent Board — task board

The user runs **Agent Board**, a local Kanban for delegating tasks to AI agents. Work is delegated through the board; you pick it up, execute, and report progress via comments. The \`kanban\` CLI is the only interface (it drives the running app's HTTP API at \`http://localhost:3000\`).

**Skill:** \`${def.skillsDir}/agent-kanban/SKILL.md\` (load it when board work is requested).

| To … | Use … |
|------|-------|
| See the board / your tasks | \`kanban task list --json\` · \`kanban board get <id> --json\` |
| See the workflow columns | \`kanban column list\` |
| Move a card forward | \`kanban task move <taskId> <columnId>\` |
| Report progress / answer | \`kanban comment create <taskId> "..." agent\` |
| Track steps | \`kanban subtask create <taskId> "..."\` · \`kanban subtask toggle <id>\` |
| Full help | \`kanban --help\` |

## Hard rules

- Never read/write \`~/.agent-kanban/data.db\` directly — the CLI/API is the only writer.
- Never start, restart, or kill the dev server unless explicitly asked. If the API is unreachable, tell the user to run \`npm run dev\` in \`~/.agent-kanban-app\`.
- Communicate through comments with author \`agent\` so the human sees status on the board.
- Move cards to reflect reality; refer to tasks by their \`{PREFIX}-NNN\` id.
${MARK_END}
`;
}

function cursorRule(def) {
  return `---
description: Agent Board — use the kanban CLI for delegated board tasks
alwaysApply: true
---

${MARK_START}
The user runs Agent Board (local Kanban). Delegated tasks come through the board; operate it with the \`kanban\` CLI (HTTP API at http://localhost:3000), never by editing \`~/.agent-kanban/data.db\`.

- Load the skill at \`${def.skillsDir}/agent-kanban/SKILL.md\` when board work is requested.
- Find work: \`kanban task list --json\`. Move: \`kanban task move <taskId> <columnId>\`. Report: \`kanban comment create <taskId> "..." agent\`.
- Never start/stop the dev server unasked; if unreachable, tell the user to run \`npm run dev\` in \`~/.agent-kanban-app\`.
${MARK_END}
`;
}

function templatesSkillsDir() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  for (const c of [
    path.join(here, "..", "templates", "skills"),
    path.join(here, "..", "..", "templates", "skills"),
  ]) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

function installSkill(destDir, srcDir, method, force) {
  fs.mkdirSync(destDir, { recursive: true });
  let n = 0;
  for (const e of fs.readdirSync(srcDir)) {
    if (!e.startsWith("agent-kanban")) continue;
    const from = path.join(srcDir, e);
    const to = path.join(destDir, e);
    let exists = false;
    try { fs.lstatSync(to); exists = true; } catch {}
    if (exists && !force) continue;
    if (exists) fs.rmSync(to, { recursive: true, force: true });
    if (method === "symlink") {
      try { fs.symlinkSync(from, to, "dir"); }
      catch { fs.cpSync(from, to, { recursive: true }); }
    } else {
      fs.cpSync(from, to, { recursive: true });
    }
    n++;
  }
  return n;
}

function writeRuleFile(file, content, appendOk, force) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, content);
    return "wrote";
  }
  const existing = fs.readFileSync(file, "utf8");
  if (existing.includes(MARK_START)) {
    if (!force) return "skipped";
    const re = new RegExp(`${MARK_START}[\\s\\S]*?${MARK_END}\\n?`, "m");
    fs.writeFileSync(file, existing.replace(re, content));
    return "wrote";
  }
  if (appendOk) {
    fs.appendFileSync(file, "\n" + content);
    return "appended";
  }
  if (force) {
    fs.writeFileSync(file, content);
    return "wrote";
  }
  return "skipped";
}

async function runInit() {
  const target = process.cwd();
  const validScope = ["local", "global", "both"];
  const validMethod = ["symlink", "copy"];

  if (opts.scope && !validScope.includes(opts.scope))
    return die(`--scope inválido: ${opts.scope} (local|global|both)`, 1), 1;
  if (opts.method && !validMethod.includes(opts.method))
    return die(`--method inválido: ${opts.method} (symlink|copy)`, 1), 1;

  const srcSkills = templatesSkillsDir();
  if (!srcSkills) return die("templates/skills não encontrado — reinstale o CLI (install.sh).", 1), 1;

  const detected = Object.entries(AGENTS)
    .filter(([, d]) => { try { return d.detect(); } catch { return false; } })
    .map(([id]) => id);

  let agentIds = opts.all
    ? Object.keys(AGENTS)
    : Array.from(new Set([...detected, "claude-code"]));

  const auto = !!opts.yes;
  const rl = auto ? null : readline.createInterface({ input, output });
  const ask = async (q, def) => {
    if (!rl) return def;
    const a = (await rl.question(q)).trim();
    return a || def;
  };

  console.log("");
  console.log("  Agent Board — init (configurar agente para usar o quadro)");
  console.log(`  projeto: ${target}`);
  console.log(`  agentes: ${agentIds.map((i) => AGENTS[i].label).join(", ")}${opts.all ? "" : detected.length ? "  (detectados: " + detected.map((i) => AGENTS[i].label).join(", ") + ")" : "  (nenhum detectado — usando Claude Code)"}`);
  console.log("");

  const scope = opts.scope || (await ask("  Instalar skill onde? [local]/global/both: ", "local"));
  if (!validScope.includes(scope)) { rl?.close(); return die(`scope inválido: ${scope}`, 1), 1; }

  const method = opts.method || (await ask("  Método? [symlink]/copy: ", "symlink"));
  if (!validMethod.includes(method)) { rl?.close(); return die(`method inválido: ${method}`, 1), 1; }

  const force = !!opts.force;

  if (!auto) {
    const yn = (await ask("  Confirmar? [Y/n]: ", "y")).toLowerCase();
    if (yn === "n" || yn === "no") { rl?.close(); console.log("  cancelado."); return 0; }
  }
  rl?.close();

  // dedupe skill destinations
  const dests = new Set();
  for (const id of agentIds) {
    const d = AGENTS[id];
    if (scope === "local" || scope === "both") dests.add(path.join(target, d.skillsDir));
    if (scope === "global" || scope === "both") dests.add(d.globalSkillsDir);
  }

  console.log("");
  for (const dest of dests) {
    const n = installSkill(dest, srcSkills, method, force);
    const rel = dest.startsWith(target) ? path.relative(target, dest) || "." : dest;
    if (n > 0) console.log(`  ✓ skill ${method === "symlink" ? "symlinked" : "copied"} → ${rel}`);
    else console.log(`  • skill já presente (use --force para sobrescrever) → ${rel}`);
  }

  // dedupe rule files (AGENTS.md shared across agents)
  const writtenRules = new Set();
  for (const id of agentIds) {
    const d = AGENTS[id];
    if (writtenRules.has(d.ruleFile)) continue;
    writtenRules.add(d.ruleFile);
    const file = path.join(target, d.ruleFile);
    const content = d.ruleFormat === "cursor" ? cursorRule(d) : boilerplate(d);
    const r = writeRuleFile(file, content, d.appendOk, force);
    if (r === "wrote") console.log(`  ✓ escreveu ${d.ruleFile}`);
    else if (r === "appended") console.log(`  ✚ anexou em ${d.ruleFile}`);
    else console.log(`  • ${d.ruleFile} já tem seção agent-kanban (use --force para atualizar)`);
  }

  fs.writeFileSync(
    path.join(target, ".agent-kanban.json"),
    JSON.stringify({ agents: agentIds, scope, method, version: 1, installed_at: new Date().toISOString() }, null, 2),
  );
  console.log("  ✓ escreveu .agent-kanban.json");

  console.log("");
  console.log("  Pronto. O agente agora sabe usar o quadro via `kanban`.");
  console.log("  Garanta que o app esteja rodando:  cd ~/.agent-kanban-app && npm run dev");
  console.log("");
  return 0;
}

async function main() {
  const [resource, action, ...rest] = pos;

  if (resource === "init" && !flags.help) {
    process.exit(await runInit());
  }

  if (flags.help || !resource) {
    if (!flags.quiet) console.log(HELP);
    process.exit(0);
  }

  switch (`${resource} ${action}`) {
    // ── Board ──
    case "board list":
      out(await api("GET", "/api/boards"), [
        { key: "id", label: "ID" },
        { key: "name", label: "Name" },
        { key: "createdAt", label: "Created" },
      ]);
      break;
    case "board get":
      out(await api("GET", `/api/boards/${rest[0]}`));
      break;
    case "board create": {
      const b = await api("POST", "/api/boards", { name: rest[0], prefix: opts.prefix });
      msg(`Board criado: ${b.id} "${b.name}" (prefixo ${b.prefix})`);
      break;
    }

    // ── Column ──
    case "column list": {
      const q = rest[0] ? `?boardId=${rest[0]}` : "";
      out(await api("GET", `/api/columns${q}`), [
        { key: "id", label: "ID" },
        { key: "name", label: "Name" },
        { key: "order", label: "Order" },
      ]);
      break;
    }
    case "column create": {
      // args: [boardId?] "<name>"
      const hasBoard = rest.length >= 2;
      const boardId = hasBoard ? rest[0] : undefined;
      const name = hasBoard ? rest[1] : rest[0];
      const c = await api("POST", "/api/columns", {
        boardId,
        name,
        color: opts.color,
      });
      msg(`Column criada: ${c.id} "${c.name}"`);
      break;
    }
    case "column rename": {
      const c = await api("PATCH", `/api/columns/${rest[0]}`, { name: rest[1] });
      msg(`Column ${c.id} renomeada para "${c.name}"`);
      break;
    }
    case "column delete":
      await api("DELETE", `/api/columns/${rest[0]}`);
      msg(`Column ${rest[0]} excluída`);
      break;

    // ── Task ──
    case "task list": {
      const q = rest[0] ? `?boardId=${rest[0]}` : "";
      out(await api("GET", `/api/tasks${q}`), [
        { key: "id", label: "ID" },
        { key: "title", label: "Title" },
        { key: "columnId", label: "Column" },
        { key: "agent", label: "Agent" },
      ]);
      break;
    }
    case "task get":
      out(await api("GET", `/api/tasks/${rest[0]}`));
      break;
    case "task create": {
      const t = await api("POST", "/api/tasks", {
        columnId: rest[0],
        title: rest[1],
        description: opts.desc,
        agent: opts.agent,
      });
      msg(`Task criada: ${t.id} "${t.title}"`);
      break;
    }
    case "task move": {
      const t = await api("POST", `/api/tasks/${rest[0]}/move`, {
        targetColumnId: rest[1],
        order: rest[2] !== undefined ? Number(rest[2]) : undefined,
      });
      msg(`Task ${t.id} movida para coluna ${t.columnId} (ordem ${t.order})`);
      break;
    }
    case "task update": {
      const patch = {};
      if (opts.title !== undefined) patch.title = opts.title;
      if (opts.desc !== undefined) patch.description = opts.desc;
      if (opts.agent !== undefined) patch.agent = opts.agent;
      const t = await api("PATCH", `/api/tasks/${rest[0]}`, patch);
      msg(`Task ${t.id} atualizada`);
      break;
    }
    case "task delete":
      await api("DELETE", `/api/tasks/${rest[0]}`);
      msg(`Task ${rest[0]} excluída`);
      break;

    // ── SubTask ──
    case "subtask list":
      out(await api("GET", `/api/tasks/${rest[0]}/subtasks`), [
        { key: "id", label: "ID" },
        { key: "title", label: "Title" },
        { key: "status", label: "Status" },
        { key: "done", label: "Done" },
      ]);
      break;
    case "subtask create": {
      const s = await api("POST", `/api/tasks/${rest[0]}/subtasks`, {
        title: rest[1],
        description: opts.desc,
        status: opts.status,
      });
      msg(`SubTask criada: ${s.id} "${s.title}"`);
      break;
    }
    case "subtask update": {
      const patch = {};
      if (opts.title !== undefined) patch.title = opts.title;
      if (opts.desc !== undefined) patch.description = opts.desc;
      if (opts.status !== undefined) patch.status = opts.status;
      const s = await api("PATCH", `/api/subtasks/${rest[0]}`, patch);
      msg(`SubTask ${s.id} atualizada`);
      break;
    }
    case "subtask toggle": {
      const s = await api("POST", `/api/subtasks/${rest[0]}/toggle`);
      msg(`SubTask ${s.id} -> ${s.done ? "concluída" : "pendente"}`);
      break;
    }
    case "subtask delete":
      await api("DELETE", `/api/subtasks/${rest[0]}`);
      msg(`SubTask ${rest[0]} excluída`);
      break;

    // ── Comment ──
    case "comment list":
      out(await api("GET", `/api/tasks/${rest[0]}/comments`), [
        { key: "id", label: "ID" },
        { key: "author", label: "Author" },
        { key: "text", label: "Content" },
        { key: "createdAt", label: "Created" },
      ]);
      break;
    case "comment create": {
      const c = await api("POST", `/api/tasks/${rest[0]}/comments`, {
        text: rest[1],
        author: rest[2] || "user",
      });
      msg(`Comment criado: ${c.id}`);
      break;
    }
    case "comment delete":
      await api("DELETE", `/api/comments/${rest[0]}`);
      msg(`Comment ${rest[0]} excluído`);
      break;

    default:
      die(`Comando desconhecido: ${resource} ${action ?? ""}\nUse --help`, 2);
  }
}

main();

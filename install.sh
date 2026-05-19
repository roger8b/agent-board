#!/usr/bin/env bash
set -euo pipefail

# Agent Board installer
# Usage: bash install.sh [--local [src]] [--seed] [--no-link] [--no-init]
#
#   --local [src]   Install from a local checkout (default: current dir).
#                   If 'src' given, syncs that path into ~/.agent-kanban-app/.
#   --seed          Force (re)seed the database even if it already has data.
#   --no-link       Skip `npm link` (don't expose the `kanban` CLI globally).
#   --no-init       Skip the optional "wire an AI agent" step at the end.

REPO_URL="https://github.com/roger8b/agent-board"
INSTALL_DIR="${HOME}/.agent-kanban-app"
DATA_DIR="${HOME}/.agent-kanban"
USE_LOCAL=false
LOCAL_SOURCE=""
FORCE_SEED=false
RUN_LINK=true
RUN_INIT=true

while [[ $# -gt 0 ]]; do
  case $1 in
    --local)    USE_LOCAL=true
                if [[ $# -gt 1 && "${2:0:2}" != "--" ]]; then
                  LOCAL_SOURCE="$2"; shift 2
                else
                  if [[ -f "$PWD/package.json" ]]; then
                    LOCAL_SOURCE="$PWD"
                  fi
                  shift
                fi ;;
    --seed)     FORCE_SEED=true; shift ;;
    --no-link)  RUN_LINK=false; shift ;;
    --no-init)  RUN_INIT=false; shift ;;
    --help|-h)  cat <<EOF
Usage: $0 [--local [src]] [--seed] [--no-link] [--no-init]

  --local [src]   Use local checkout instead of cloning. If 'src' given,
                  syncs from that path into ${INSTALL_DIR}/.
  --seed          Force (re)seed the database (overwrites existing data).
  --no-link       Skip the global 'kanban' CLI link.
  --no-init       Skip the optional "wire an AI agent" step at the end.
EOF
                exit 0 ;;
    *) echo "unknown option: $1"; exit 1 ;;
  esac
done

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; DIM='\033[2m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✓${NC} $*"; }
warn() { echo -e "${YELLOW}!${NC} $*"; }
err()  { echo -e "${RED}✗${NC} $*"; exit 1; }
dim()  { echo -e "${DIM}  $*${NC}"; }

echo ""
echo "  Agent Board installer"
echo ""

# prerequisites
command -v node >/dev/null 2>&1 || err "Node.js not found. Install from https://nodejs.org (>=20.19 required)."
command -v npm  >/dev/null 2>&1 || err "npm not found. Install from https://nodejs.org."

NODE_MAJOR=$(node -e "process.stdout.write(process.versions.node.split('.')[0])")
if [[ $NODE_MAJOR -lt 20 ]]; then
  err "Node.js >=20.19 required (found major $NODE_MAJOR)."
fi
ok "Node.js $(node --version)"

# install / sync
if $USE_LOCAL; then
  if [[ -n "$LOCAL_SOURCE" ]]; then
    [[ -d "$LOCAL_SOURCE" ]] || err "local source not found: $LOCAL_SOURCE"
    [[ -f "$LOCAL_SOURCE/package.json" ]] || err "no package.json at $LOCAL_SOURCE"
    dim "syncing $LOCAL_SOURCE → $INSTALL_DIR …"
    mkdir -p "$INSTALL_DIR"
    if command -v rsync >/dev/null 2>&1; then
      rsync -a --delete \
        --exclude node_modules --exclude .next --exclude src/generated --exclude .git \
        "$LOCAL_SOURCE/" "$INSTALL_DIR/"
    else
      (cd "$LOCAL_SOURCE" && tar --exclude=node_modules --exclude=.next --exclude=src/generated --exclude=.git -cf - .) | (cd "$INSTALL_DIR" && tar -xf -)
    fi
  else
    [[ -d "$INSTALL_DIR" ]] || err "no local install at $INSTALL_DIR. Run with --local <src> first."
    dim "using existing $INSTALL_DIR"
  fi
elif [[ -d "$INSTALL_DIR/.git" ]]; then
  warn "existing install at $INSTALL_DIR — pulling latest"
  git -C "$INSTALL_DIR" pull --quiet || warn "git pull failed — continuing"
elif [[ -d "$INSTALL_DIR" ]]; then
  warn "$INSTALL_DIR exists but not a git checkout — leaving as-is"
else
  dim "cloning to $INSTALL_DIR …"
  git clone --quiet "$REPO_URL" "$INSTALL_DIR"
fi

cd "$INSTALL_DIR"

dim "installing dependencies …"
npm install --silent

dim "generating Prisma client …"
npm run db:generate --silent

dim "syncing database schema (${DATA_DIR}/data.db) …"
npm run db:push --silent

# seed only when empty, unless --seed forces it
HAS_DATA=$(node -e "
try {
  const D = require('better-sqlite3');
  const p = require('node:path').join(require('node:os').homedir(), '.agent-kanban', 'data.db');
  const db = new D(p, { readonly: true });
  const r = db.prepare(\"SELECT count(*) c FROM Board\").get();
  process.stdout.write(String(r.c));
} catch { process.stdout.write('0'); }
" 2>/dev/null || echo 0)

if $FORCE_SEED || [[ "$HAS_DATA" == "0" ]]; then
  dim "seeding initial data …"
  npm run db:seed --silent
  ok "database seeded"
else
  ok "database already has data (${HAS_DATA} board(s)) — skipping seed (use --seed to force)"
fi

# expose the `kanban` CLI globally
if $RUN_LINK; then
  if ! npm link 2>&1 | tail -3; then
    warn "npm link failed — try: sudo npm link  (or check 'npm config get prefix' is in PATH)"
  fi
  if ! command -v kanban >/dev/null 2>&1; then
    NPM_PREFIX="$(npm config get prefix 2>/dev/null || echo '')"
    warn "kanban not on PATH"
    dim "add to your shell rc:  export PATH=\"${NPM_PREFIX}/bin:\$PATH\""
  else
    ok "kanban CLI installed ($(command -v kanban))"
  fi
fi

# optional: wire an AI agent in a project to use the board
if $RUN_INIT && command -v kanban >/dev/null 2>&1; then
  echo ""
  echo "  Wire an AI agent (Claude Code, Codex, …) to use the board?"
  echo "  This installs the agent-kanban skill + a board section into that"
  echo "  project's CLAUDE.md / AGENTS.md."
  if [[ -t 0 ]]; then
    printf "  Project path to wire (blank to skip): "
    read -r INIT_DIR || INIT_DIR=""
    if [[ -n "$INIT_DIR" ]]; then
      if [[ -d "$INIT_DIR" ]]; then
        ( cd "$INIT_DIR" && kanban init ) || warn "kanban init did not complete — run it manually later"
      else
        warn "directory not found: $INIT_DIR — skipping (run 'kanban init' there later)"
      fi
    else
      dim "skipped — run 'kanban init' inside any project later"
    fi
  else
    dim "non-interactive — run 'cd <your-project> && kanban init' later"
  fi
fi

echo ""
echo -e "${GREEN}All done.${NC}"
echo ""
echo "  Start the app (transparent — starts server + opens browser):"
echo "    kanban start"
echo "    kanban status        # is it up?     kanban stop  # stop it"
echo ""
echo "  Use the CLI (kanban start does this for you if needed):"
echo "    kanban board list"
echo "    kanban task create <columnId> \"My task\" --agent coder"
echo "    kanban --help"
echo ""
echo "  Wire an AI agent to use the board (run inside that project):"
echo "    cd <your-project> && kanban init"
echo ""

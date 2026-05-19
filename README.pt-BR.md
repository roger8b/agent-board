# Agent Board

[English](./README.md) · **Português**

Kanban local-first para delegar e acompanhar tarefas dadas a agentes de IA. Você interage por um quadro visual no navegador; os agentes interagem por uma CLI. Tudo é armazenado localmente em SQLite — sem servidores, sem contas.

> Construído a partir do `SPEC.md` e do protótipo visual em `Prototype-·-5_18_2026/`.

## Stack

| Camada     | Tecnologia                                      |
| ---------- | ----------------------------------------------- |
| Frontend   | Next.js 16 (App Router, React 19)               |
| Backend    | Next.js Server Actions + Route Handlers REST    |
| Banco      | SQLite via Prisma 7 (`@prisma/adapter-better-sqlite3`) |
| Tempo real | Server-Sent Events (`/api/events`)              |
| CLI        | Script Node sobre a API HTTP (`kanban`)         |

Os dados ficam em `~/.agent-kanban/data.db`.

## Requisitos

- Node.js **>= 20.19** (Node 18 não é suportado pelo Prisma 7)
- npm

## Instalação

```bash
# a partir do diretório do projeto
bash install.sh --local
```

O instalador sincroniza o código em `~/.agent-kanban-app`, instala dependências, gera o client do Prisma, cria/sincroniza o banco, popula dados iniciais **somente se o banco estiver vazio** e linka a CLI `kanban` globalmente.

Flags:

- `--local [src]` — instala de um checkout local (padrão: diretório atual)
- `--seed` — força (re)seed mesmo com dados existentes (**sobrescreve**)
- `--no-link` — pula o link global da CLI `kanban`

### Setup manual

```bash
npm install
npm run db:generate     # prisma generate
npm run db:push         # cria/sincroniza schema em ~/.agent-kanban/data.db
npm run db:seed         # dados iniciais (PROJ-001 …)
npm run dev             # http://localhost:3000
```

## Execução

Forma transparente — sobe o servidor (se estiver parado) e abre o navegador. Idempotente; funciona para um humano **ou** um agente de IA:

```bash
kanban start            # sobe + abre http://localhost:3000
kanban start --no-open  # sobe sem abrir navegador (agentes)
kanban status           # exit 0 = no ar, 1 = parado
kanban stop             # para um servidor iniciado pelo kanban start
```

Ou rode o dev server diretamente:

```bash
npm run dev   # http://localhost:3000
```

- **/** — launcher / visão geral
- **/board** — o quadro Kanban (no banco, tempo real)
- **/agents** — gestão de agentes (placeholder local)
- **/settings** — colunas & comportamento por etapa (placeholder local)

## IDs (estilo Jira)

`PREFIXO` é o projeto. Tarefas e subtarefas compartilham um **contador de issue** por projeto — a primeira tarefa é `PROJ-001`. Colunas têm id próprio; o id do board é o próprio prefixo:

```
Board:    PROJ              (= prefixo; o projeto)
Coluna:   PROJ-C1, PROJ-C2… (colunas do fluxo)
Task:     PROJ-001          (1ª issue), PROJ-002…
SubTask:  PROJ-003          (subtarefa consome o contador de issue)
Comment:  COMMENT-a1b2c3d4
```

Contadores nunca reutilizam número. O card e o painel exibem o id para identificação rápida.

## Projetos (front-end)

A barra superior do board tem um **seletor de projetos** (dropdown) com todos os projetos; trocar navega para `/board?b=<PREFIXO>`. **Novo projeto** abre um modal (nome + prefixo) que cria o projeto com as 5 colunas padrão e já alterna para ele. Múltiplos projetos são totalmente suportados.

## CLI

Com o servidor de desenvolvimento rodando:

```bash
kanban board list
kanban board create "Marketing" --prefix MKT

kanban column list
kanban task list
kanban task create <columnId> "Implementar login" --agent coder --desc "Fluxo OAuth"
kanban task move <taskId> <targetColumnId> [ordem]
kanban task update <taskId> --title "Novo título"
kanban task delete <taskId>

kanban subtask create <taskId> "Criar schema" --status progress
kanban subtask toggle <subtaskId>

kanban comment create <taskId> "Trabalhando nisso" agent
kanban comment list <taskId>

kanban --help
```

Flags de saída: `--json`, `--table` (padrão), `--quiet`. URL do servidor: `KANBAN_URL` (padrão `http://localhost:3000`).

Qualquer mutação via CLI é empurrada para os navegadores abertos em tempo real via SSE.

## Conectar um agente de IA ao quadro (`kanban init`)

Para um agente de IA (Claude Code, Codex, Gemini CLI, Cursor, …) *operar* o quadro, rode dentro do projeto dele:

```bash
kanban init                 # interativo: escopo, método, confirmação
kanban init --yes           # não-interativo (local, symlink, agentes detectados)
kanban init --scope both --method copy --force --all
```

Detecta agentes instalados, instala a **skill `agent-kanban`** no diretório de skills do agente (symlink ou cópia) e escreve uma seção delimitada por marcadores no `CLAUDE.md` / `AGENTS.md` / `GEMINI.md` / regra do Cursor do projeto (cria ou anexa, idempotente — rode com `--force` para atualizar). Um manifesto `.agent-kanban.json` é gravado na raiz do projeto.

A skill ([`templates/skills/agent-kanban/SKILL.md`](templates/skills/agent-kanban/SKILL.md)) ensina o fluxo ao agente: achar tarefas atribuídas, mover cards entre colunas, controlar subtarefas e reportar progresso via comentários (autor `agent`) — sempre pelo CLI `kanban`, nunca mexendo no banco.

> `AGENTS.md` / `CLAUDE.md` na raiz deste repo são o guia para agentes trabalhando **neste código** (desenvolvimento), diferente da seção de uso do quadro que o `kanban init` escreve em *outros* projetos.

## API REST

Base: `http://localhost:3000/api`

| Método | Caminho                       | Propósito                |
| ------ | ----------------------------- | ------------------------ |
| GET    | `/boards` · `/board`          | listar / board padrão    |
| POST   | `/boards`                     | criar board `{name,prefix?}` |
| GET    | `/boards/:id`                 | árvore completa do board |
| GET/POST | `/columns`                  | listar / criar coluna    |
| PATCH/DELETE | `/columns/:id`          | renomear · reordenar · excluir |
| GET/POST | `/tasks`                    | listar / criar task      |
| GET/PATCH/DELETE | `/tasks/:id`        | ler · atualizar · excluir |
| POST   | `/tasks/:id/move`             | mover task               |
| GET/POST | `/tasks/:id/subtasks`       | listar / criar subtask   |
| PATCH/DELETE | `/subtasks/:id`         | atualizar · excluir      |
| POST   | `/subtasks/:id/toggle`        | alternar concluído       |
| GET/POST | `/tasks/:id/comments`       | listar / criar comentário |
| DELETE | `/comments/:id`               | excluir comentário       |
| GET    | `/events`                     | stream de eventos SSE    |

## Tempo real (SSE)

`GET /api/events` é um `text/event-stream`. O quadro assina via `EventSource` e atualiza nos eventos `task:*`, `subtask:*`, `comment:*`, `column:*`. Heartbeat a cada 30s.

## Estrutura do projeto

```
prisma/            schema.prisma · seed.ts
src/
  app/
    api/           route handlers REST + /api/events (SSE)
    board/         página server (busca o board)
    agents/        página client (localStorage)
    settings/      página client (localStorage)
  components/      Sidebar, BoardClient
  lib/
    db.ts          client Prisma (adapter better-sqlite3)
    service.ts     ops de DB + allocator de id Jira + emit de eventos
    actions.ts     server actions (delegam ao service + revalidate)
    events.ts      pub/sub SSE em memória
bin/kanban.mjs     CLI
install.sh         instalador
```

## Notas de escopo

Implementado: Foundation (Board/Column/Task/SubTask/Comment), UI do quadro no banco, drag & drop, API REST, CLI `kanban`, SSE tempo real, IDs estilo Jira.

Por decisão explícita, **não** incluído: UI multi-board (a camada de dados suporta; a UI é board único), priority/labels no card. As páginas Agents & Settings são ports fiéis do protótipo com `localStorage`, aguardando uma fase futura no banco.

## Solução de problemas

- **`kanban` não encontrado** — adicione o bin global do npm ao PATH: `export PATH="$(npm config get prefix)/bin:$PATH"`.
- **CLI não conecta** — rode `kanban start` (ou `npm run dev`; ou defina `KANBAN_URL`).
- **Resetar dados** — `npm run db:seed` (re-popula, sobrescrevendo). Reset completo: `npm run db:reset`.

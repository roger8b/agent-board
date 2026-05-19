# Agent Kanban — Especificação Técnica

## 1. Visão Geral

**Nome**: Agent Kanban  
**Tipo**: Aplicação local full-stack  
**Stack**: Next.js (full-stack) + SQLite  
**Propósito**: Ferramenta para acompanhamento e delegação de tarefas para agentes de IA. Usuário interage via interface visual (frontend) enquanto agentes de IA interagem via CLI.

---

## 2. Arquitetura

### 2.1 Stack Tecnológico

| Camada | Tecnologia | Descrição |
|--------|------------|-----------|
| Frontend | Next.js (App Router) | Interface visual do Kanban |
| Backend | Next.js API Routes / Server Actions | Processamento de comandos e persistência |
| Database | SQLite | Arquivo em `~/.agent-kanban/data.db` |
| Real-time | SSE (Server-Sent Events) | Atualização em tempo real do frontend |
| CLI | Command-line interface | Interação do agente com o sistema |

### 2.2 Estrutura de Diretórios

```
~/.agent-kanban/
├── data.db           # SQLite database
├── logs/             # Application logs (optional)
└── config.json       # Configuration file (optional)
```

### 2.3 Fluxo de Dados

```
┌─────────────┐      SSE       ┌─────────────────┐
│   Frontend   │ ◄──────────── │   Next.js API   │
│  (Browser)   │               │  (Server Actions)│
└─────────────┘               └────────┬─────────┘
                                      │
                    CLI               │
┌─────────────┐ ──────────►          │          SQLite
│  Agent CLI  │  (Commands/          ▼          (Local)
└─────────────┘   JSON)      ┌─────────────────┐
                             │   data.db       │
                             └─────────────────┘
```

1. **Frontend → Backend**: Server Actions para mutações (criar task, mover card)
2. **Backend → Frontend**: SSE para broadcast de eventos em tempo real
3. **CLI → Backend**: HTTP requests (mesma API do frontend) com commands/JSON

---

## 3. Modelo de Dados

### 3.0 Sistema de IDs (Estilo Jira)

O sistema utiliza IDs no formato **`{PREFIX}-{NUMERO}`** inspirado no Jira, onde:
- **Prefix**: Identificador do board (ex: `PROJ`, `DEV`, `MARKET`)
- **Numero**: Inteiro sequential único por board, starting from `001`

#### Regras de Formatação

| Entidade | Prefixo | Exemplo |
|----------|---------|---------|
| Board | `{BOARD_PREFIX}-001` | `PROJ-001` |
| Column | `{BOARD_PREFIX}-XXX` | `PROJ-002` |
| Task | `{BOARD_PREFIX}-XXX` | `PROJ-003` |
| SubTask | `{BOARD_PREFIX}-XXX` | `PROJ-004` |
| Agent | `{BOARD_PREFIX}-XXX` | `PROJ-005` |
| Comment | `COMMENT-{UUID}` | `COMMENT-a1b2c3d4` |

#### Exemplo de Hierarquia

```
Board: PROJ-001 (prefix: PROJ)
├── Column: PROJ-002 (Backlog)
├── Column: PROJ-003 (In Progress)
├── Column: PROJ-004 (Done)
├── Task: PROJ-005 (Implementar login)
│   ├── SubTask: PROJ-006 (Criar schema)
│   └── SubTask: PROJ-007 (Implementar API)
├── Task: PROJ-008 (Bug fix)
│   └── Comment: COMMENT-abc123
└── Agent: PROJ-009 (Agent Alpha)
```

#### Geração de IDs

1. Ao criar um board, o usuário escolhe o prefixo (ex: `PROJ`, `DEV`)
2. O primeiro ID do board será `{PREFIX}-001`
3. Todas as entidades subsequentes herdam o prefixo do board
4. O contador é global por board, não por tipo de entidade
5. IDs são únicos e não são reutilizados após deleção

#### Considerações Importantes
- **Agents**: Podem ter IDs de boards diferentes. Ex: `PROJ-005` e `DEV-003`
- **Comments**: Usam UUID puro prefixed com `COMMENT-` para evitar conflicts entre boards

### 3.1 Entidades Principais

#### Board
```typescript
interface Board {
  id: string;           // Formato: BOARD-XXX (ex: PROJ-001)
  shortId: string;      // Parte numérica: 001
  name: string;         // Nome do board
  columns: Column[];    // Colunas ordenadas
  createdAt: Date;
  updatedAt: Date;
}
```

#### Column
```typescript
interface Column {
  id: string;           // Formato: BOARD-XXX (ex: PROJ-002)
  shortId: string;      // Parte numérica: 002
  boardId: string;      // FK para Board
  name: string;         // Nome (ex: "Backlog", "In Progress", "Done")
  order: number;        // Posição na ordem visual
  color?: string;       // Cor hex opcional (ex: #FF5733)
}
```

#### Task
```typescript
interface Task {
  id: string;           // Formato: BOARD-XXX (ex: PROJ-003)
  shortId: string;      // Parte numérica: 003
  boardId: string;      // FK para Board (deriva o prefixo do ID)
  columnId: string;     // FK para Column
  title: string;        // Título da task
  description?: string; // Descrição detalhada
  order: number;        // Posição dentro da coluna
  priority: 'low' | 'medium' | 'high';  // Prioridade
  assigneeId?: string;  // FK para Agent (opcional)
  labels: string[];     // Tags/labels
  createdAt: Date;
  updatedAt: Date;
}
```

#### SubTask
```typescript
interface SubTask {
  id: string;           // Formato: BOARD-XXX (ex: PROJ-004)
  shortId: string;      // Parte numérica: 004
  taskId: string;       // FK para Task (herda prefixo do board)
  title: string;        // Título da subtask
  description?: string; // Descrição
  completed: boolean;   // Status (feito/não feito)
  order: number;        // Posição
}
```

#### Agent
```typescript
interface Agent {
  id: string;           // UUID
  name: string;         // Nome do agente
  prompt: string;       // Prompt base/instruções
  type: 'human' | 'ai'; // Tipo (futuro uso)
  createdAt: Date;
}
```

#### Comment
```typescript
interface Comment {
  id: string;           // UUID
  taskId: string;       // FK para Task
  content: string;      // Texto do comentário
  authorId: string;     // FK para Agent (quem criou)
  createdAt: Date;
  updatedAt: Date;
}
```

### 3.2 Relacionamentos

```
Board 1 ──── N Column
Column 1 ──── N Task
Task 1 ──── N SubTask
Task 1 ──── N Comment
Task N ──── 1 Agent (assignee)
Comment N ──── 1 Agent (author)
```

---

## 4. API / Server Actions

### 4.1 Board Operations

| Ação | Server Action | Parâmetros |
|------|---------------|------------|
| Listar boards | `getBoards()` | - |
| Criar board | `createBoard(name)` | `{ name: string }` |
| Atualizar board | `updateBoard(id, data)` | `{ id, name? }` |
| Deletar board | `deleteBoard(id)` | `{ id }` |

### 4.2 Column Operations

| Ação | Server Action | Parâmetros |
|------|---------------|------------|
| Criar coluna | `createColumn(boardId, name)` | `{ boardId, name }` |
| Atualizar coluna | `updateColumn(id, data)` | `{ id, name?, color?, order? }` |
| Reordenar colunas | `reorderColumns(boardId, columnIds)` | `{ boardId, columnIds: string[] }` |
| Deletar coluna | `deleteColumn(id)` | `{ id }` |

### 4.3 Task Operations

| Ação | Server Action | Parâmetros |
|------|---------------|------------|
| Criar task | `createTask(columnId, data)` | `{ columnId, title, description?, priority, assigneeId?, labels? }` |
| Atualizar task | `updateTask(id, data)` | `{ id, title?, description?, priority?, assigneeId?, labels? }` |
| Mover task | `moveTask(taskId, targetColumnId, order)` | `{ taskId, targetColumnId, order }` |
| Deletar task | `deleteTask(id)` | `{ id }` |

### 4.4 SubTask Operations

| Ação | Server Action | Parâmetros |
|------|---------------|------------|
| Criar subtask | `createSubTask(taskId, data)` | `{ taskId, title, description? }` |
| Atualizar subtask | `updateSubTask(id, data)` | `{ id, title?, description?, completed? }` |
| Toggle completed | `toggleSubTask(id)` | `{ id }` |
| Deletar subtask | `deleteSubTask(id)` | `{ id }` |

### 4.5 Agent Operations

| Ação | Server Action | Parâmetros |
|------|---------------|------------|
| Listar agents | `getAgents()` | - |
| Criar agent | `createAgent(data)` | `{ name, prompt, type? }` |
| Atualizar agent | `updateAgent(id, data)` | `{ id, name?, prompt? }` |
| Deletar agent | `deleteAgent(id)` | `{ id }` |

### 4.6 Comment Operations

| Ação | Server Action | Parâmetros |
|------|---------------|------------|
| Listar comments | `getComments(taskId)` | `{ taskId }` |
| Criar comment | `createComment(taskId, content, authorId)` | `{ taskId, content, authorId }` |
| Deletar comment | `deleteComment(id)` | `{ id }` |

---

## 5. CLI — Interface de Linha de Comando

### 5.1 Comandos Principais

```bash
# Board
kanban board list
kanban board create "<nome>"
kanban board get <boardId>

# Columns
kanban column create <boardId> "<nome>"
kanban column list <boardId>
kanban column move <columnId> <newOrder>
kanban column delete <columnId>

# Tasks
kanban task create <columnId> "<título>" [options]
kanban task list <boardId>
kanban task get <taskId>
kanban task move <taskId> <targetColumnId> <order>
kanban task update <taskId> [options]
kanban task delete <taskId>

# SubTasks
kanban subtask create <taskId> "<título>"
kanban subtask list <taskId>
kanban subtask update <subtaskId> "<título>"
kanban subtask toggle <subtaskId>
kanban subtask delete <subtaskId>

# Agents
kanban agent list
kanban agent create "<nome>" "<prompt>"
kanban agent get <agentId>
kanban agent update <agentId> "<prompt>"
kanban agent delete <agentId>

# Comments
kanban comment list <taskId>
kanban comment create <taskId> "<texto>" <authorId>
kanban comment delete <commentId>

# Config
kanban config --show
kanban config --set <key> <value>
```

### 5.2 Opções Universais

| Flag | Descrição |
|------|-----------|
| `--json` | Saída em formato JSON |
| `--table` | Saída em formato tabela |
| `--quiet` | Sem output (exit code only) |
| `--help` | Ajuda do comando |

### 5.3 Exemplos de Uso Detalhados

```bash
# === BOARD ===

# Listar todos os boards
kanban board list
# Output:
# ┌──────────┬──────────────┬────────────┐
# │ ID       │ Name         │ Created    │
# ├──────────┼──────────────┼────────────┤
# │ PROJ-001 │ Development  │ 2024-01-15 │
# │ PROJ-002 │ Marketing    │ 2024-01-20 │
# └──────────┴──────────────┴────────────┘

# Criar novo board
kanban board create "Meu Projeto"
# Output: Board created: PROJ-003 "Meu Projeto"

# Ver detalhes de um board
kanban board get PROJ-001
# Output:
# {
#   "id": "PROJ-001",
#   "name": "Development",
#   "columns": [...],
#   "tasks": [...]
# }

# === COLUMNS ===

# Listar colunas de um board
kanban column list PROJ-001
# Output:
# ┌──────────┬───────────────┬───────┐
# │ ID       │ Name          │ Order │
# ├──────────┼───────────────┼───────┤
# │ PROJ-004 │ Backlog       │ 0     │
# │ PROJ-005 │ In Progress   │ 1     │
# │ PROJ-006 │ Review        │ 2     │
# │ PROJ-007 │ Done          │ 3     │
# └──────────┴───────────────┴───────┘

# Criar coluna
kanban column create PROJ-001 "To Test"
# Output: Column created: PROJ-008 "To Test"

# Mover coluna (reordenar)
kanban column move PROJ-008 2
# Output: Column PROJ-008 moved to position 2

# === TASKS ===

# Criar task
kanban task create PROJ-005 "Implementar login"
# Output: Task created: PROJ-009 "Implementar login"

# Criar task com opções
kanban task create PROJ-005 "Deploy Produção" \
  --priority high \
  --assignee "PROJ-010" \
  --labels "devops,deploy"
# Output: Task created: PROJ-011 "Deploy Produção"

# Listar tasks de um board
kanban task list PROJ-001
# Output:
# ┌──────────┬──────────────────┬────────┬─────────┬──────────┐
# │ ID       │ Title            │ Column │ Priority │ Assignee │
# ├──────────┼──────────────────┼────────┼─────────┼──────────┤
# │ PROJ-009 │ Implementar login│ PROJ-005│ medium  │ PROJ-010│
# │ PROJ-011 │ Deploy Produção  │ PROJ-005│ high    │ PROJ-012│
# └──────────┴──────────────────┴────────┴─────────┴──────────┘

# Ver detalhes de uma task
kanban task get PROJ-009
# Output:
# {
#   "id": "PROJ-009",
#   "title": "Implementar login",
#   "columnId": "PROJ-005",
#   "priority": "medium",
#   "assignee": {
#     "id": "PROJ-010",
#     "name": "Agent Alpha"
#   },
#   "labels": ["backend"],
#   "subtasks": [...],
#   "comments": [...]
# }

# Mover task entre colunas
kanban task move PROJ-009 PROJ-006 0
# Output: Task PROJ-009 moved to column PROJ-006 at position 0

# Mover task dentro da mesma coluna (reordenar)
kanban task move PROJ-009 PROJ-005 2
# Output: Task PROJ-009 reordered to position 2 in column PROJ-005

# Atualizar task
kanban task update PROJ-009 --title "Novo título" --priority high
# Output: Task PROJ-009 updated

# Deletar task
kanban task delete PROJ-009
# Output: Task PROJ-009 deleted

# === SUBTASKS ===

# Criar subtask
kanban subtask create PROJ-009 "Criar schema do banco"
# Output: SubTask created: PROJ-013 "Criar schema do banco"

# Listar subtasks de uma task
kanban subtask list PROJ-009
# Output:
# ┌──────────┬──────────────────────┬──────────┐
# │ ID       │ Title                │ Completed │
# ├──────────┼──────────────────────┼──────────┤
# │ PROJ-013 │ Criar schema do banco│ ☐        │
# │ PROJ-014 │ Implementar endpoint │ ☐        │
# └──────────┴──────────────────────┴──────────┘

# Toggle status da subtask (marcar como concluída)
kanban subtask toggle PROJ-013
# Output: SubTask PROJ-013 toggled to: completed

# Atualizar subtask
kanban subtask update PROJ-013 "Atualizar título da subtask"
# Output: SubTask PROJ-013 updated

# Deletar subtask
kanban subtask delete PROJ-014
# Output: SubTask PROJ-014 deleted

# === AGENTS ===

# Listar agents
kanban agent list
# Output:
# ┌──────────┬───────────────┬────────┐
# │ ID       │ Name          │ Type   │
# ├──────────┼───────────────┼────────┤
# │ PROJ-010 │ Agent Alpha   │ ai     │
# │ PROJ-012 │ Agent Beta    │ ai     │
# │ PROJ-015 │ Roger Silva   │ human  │
# └──────────┴───────────────┴────────┘

# Criar agent
kanban agent create "Agent Gamma" "You are a coding assistant."
# Output: Agent created: PROJ-016 "Agent Gamma" (type: ai)

# Ver detalhes de um agent
kanban agent get PROJ-016
# Output:
# {
#   "id": "PROJ-016",
#   "name": "Agent Gamma",
#   "prompt": "You are a coding assistant.",
#   "type": "ai",
#   "tasksAssigned": 3,
#   "createdAt": "2024-01-15T10:30:00Z"
# }

# Atualizar prompt do agent
kanban agent update PROJ-016 "You are a senior developer with expertise in TypeScript."
# Output: Agent PROJ-016 prompt updated

# Deletar agent
kanban agent delete PROJ-016
# Output: Agent PROJ-016 deleted

# === COMMENTS ===

# Listar comentários de uma task
kanban comment list PROJ-009
# Output:
# ┌──────────┬────────────────────┬───────────────────┬─────────────┐
# │ ID       │ Author             │ Content           │ Created     │
# ├──────────┼────────────────────┼───────────────────┼─────────────┤
# │ COMMENT-001 │ Agent Alpha      │ Starting work...  │ 2h ago      │
# │ COMMENT-002 │ Roger Silva      │ Need more details │ 1h ago      │
# └──────────┴────────────────────┴───────────────────┴─────────────┘

# Ler comentário completo (com mais detalhes)
kanban comment read COMMENT-001
# Output:
# {
#   "id": "COMMENT-001",
#   "taskId": "PROJ-009",
#   "author": {
#     "id": "PROJ-010",
#     "name": "Agent Alpha"
#   },
#   "content": "Starting work on the authentication module. Will need to review the existing user model first.",
#   "createdAt": "2024-01-15T14:30:00Z",
#   "updatedAt": "2024-01-15T14:30:00Z"
# }

# Criar comentário
kanban comment create PROJ-009 "Task completed!" PROJ-016
# Output: Comment created: COMMENT-003

# Deletar comentário
kanban comment delete COMMENT-003
# Output: Comment COMMENT-003 deleted

# === JSON INPUT ===

# Para payloads complexos, usar JSON via stdin
cat << 'EOF' | kanban task create PROJ-005 --json
{
  "title": "Implementar cache Redis",
  "description": "Adicionar camada de cache usando Redis para melhorar performance",
  "priority": "high",
  "assigneeId": "PROJ-010",
  "labels": ["performance", "redis"]
}
EOF
# Output: Task created: PROJ-017 "Implementar cache Redis"

# === OUTPUT FORMATOS ===

# Saída JSON (para integração com outros tools)
kanban task list PROJ-001 --json
# Output: {"tasks": [...], "total": 2}

# Saída tabela (default)
kanban task list PROJ-001 --table

# Quiet mode (só exit code)
kanban task delete PROJ-009 --quiet
# Exit code: 0 (sucesso) ou 1 (erro)
```

---

## 6. SSE — Server-Sent Events

### 6.1 Endpoint

```
GET /api/events
```

### 6.2 Formato dos Eventos

```typescript
// Event types
type EventType = 
  | 'task:created'
  | 'task:updated'
  | 'task:moved'
  | 'task:deleted'
  | 'subtask:created'
  | 'subtask:updated'
  | 'subtask:deleted'
  | 'column:created'
  | 'column:updated'
  | 'column:deleted'
  | 'board:updated'
  | 'comment:created'
  | 'comment:deleted';

// Event payload
interface SSEEvent {
  type: EventType;
  data: {
    id: string;
    [key: string]: any;  // Entidade específica
  };
  timestamp: string;     // ISO 8601
}
```

### 6.3 Exemplo de Stream

```
event: task:created
data: {"id":"abc123","title":"Nova task","columnId":"col-1","priority":"high"}
id: 1704067200001

event: task:moved
data: {"id":"abc123","fromColumnId":"col-1","toColumnId":"col-2","order":0}
id: 1704067200002
```

---

## 7. Frontend — Interface Visual

### 7.1 Layout Principal

```
┌─────────────────────────────────────────────────────────────┐
│  Agent Kanban                    [+ New Board]  [Settings]   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│  │ Backlog │  │  To Do  │  │In Progr.│  │  Done   │        │
│  ├─────────┤  ├─────────┤  ├─────────┤  ├─────────┤        │
│  │ [Card]  │  │ [Card]  │  │ [Card]  │  │ [Card]  │        │
│  │ [Card]  │  │         │  │ [Card]  │  │         │        │
│  │         │  │         │  │         │  │         │        │
│  │ + Add   │  │ + Add   │  │ + Add   │  │ + Add   │        │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 7.2 Card de Task

```
┌─────────────────────────┐
│ 📌 Task Title Here       │
│                         │
│ Descrição curta da      │
│ task que pode ter até   │
│ 2 linhas...             │
│                         │
│ 🔖 label  🔖 label      │
│                         │
│ 👤 Agent Name    ⭐⭐⭐  │
│                         │
│ ☑️☑️ 2/3 subtasks       │
│                         │
│ 💬 3 comments    [···]  │
└─────────────────────────┘
```

### 7.3 Funcionalidades de UI

| Feature | Descrição |
|---------|-----------|
| Drag & Drop | Arrastar cards entre colunas com feedback visual |
| Criação rápida | Inline creation de tasks no footer da coluna |
| Modal de edição | Click no card abre modal completo com todos os campos |
| Filtros | Filtrar por assignee, label, prioridade |
| Busca | Busca por título/descrição de tasks |
| Real-time | Cards atualizam automaticamente via SSE |

### 7.4 Modal de Task

```
┌─────────────────────────────────────────────────────┐
│  Editar Task                                    [X] │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Título                                             │
│  ┌─────────────────────────────────────────────────┐│
│  │ Task title here                                 ││
│  └─────────────────────────────────────────────────┘│
│                                                     │
│  Descrição                                          │
│  ┌─────────────────────────────────────────────────┐│
│  │ Multi-line description...                        ││
│  │                                                 ││
│  └─────────────────────────────────────────────────┘│
│                                                     │
│  ┌──────────────┐  ┌────────────────┐             │
│  │ Priority ▼   │  │ Assignee ▼     │             │
│  └──────────────┘  └────────────────┘             │
│                                                     │
│  Labels: [+] 🔖 auth  🔖 backend  🔖 urgent       │
│                                                     │
│  ── SubTasks ───────────────────────────────────── │
│  ☑ Subtask 1                                       │
│  ☐ Subtask 2                                       │
│  ☐ Subtask 3                                       │
│  + Adicionar subtask                               │
│                                                     │
│  ── Comments ───────────────────────────────────── │
│  Agent: Comentário aqui...           2h atrás [🗑]│
│  Human: Resposta...                 1h atrás [🗑]│
│  + Adicionar comentário                          │
│                                                     │
│              [Cancel]              [Save]          │
└─────────────────────────────────────────────────────┘
```

---

## 8. Configurações

### 8.1 Config.json (Opcional)

```json
{
  "port": 3000,
  "host": "localhost",
  "database": {
    "path": "~/.agent-kanban/data.db"
  },
  "sse": {
    "reconnectDelay": 2000,
    "heartbeatInterval": 30000
  },
  "agents": {
    "defaultPrompt": "You are a helpful AI assistant..."
  }
}
```

---

## 9. Requisitos Não-Funcionais

### 9.1 Performance
- Frontend deve carregar em < 2s
- Drag & drop deve ser responsivo (60fps)
- SSE reconexão automática em < 3s

### 9.2 Persistência
- SQLite file em `~/.agent-kanban/`
- Backup automático (opcional)
- Migrateis para evolução do schema

### 9.3 Segurança
- Sem autenticação (local only)
- Sanitização de inputs
- Validação de dados no backend

---

## 10. Roadmap Inicial (MVP)

### Fase 1: Foundation
- [ ] Setup Next.js project
- [ ] SQLite database schema
- [ ] CRUD de Board, Column, Task
- [ ] Interface Kanban básica (render boards, columns, tasks)

### Fase 2: Core Features
- [ ] Drag & Drop de tasks
- [ ] CRUD de SubTasks
- [ ] CRUD de Agents
- [ ] CRUD de Comments

### Fase 3: Real-time
- [ ] SSE endpoint
- [ ] Frontend SSE subscription
- [ ] Broadcast de eventos

### Fase 4: CLI
- [ ] CLI base com comandos
- [ ] Comandos CRUD completos
- [ ] Suporte JSON input
- [ ] Output format options

### Fase 5: Polish
- [ ] Filtros e busca
- [ ] Modal de edição completo
- [ ] Responsividade mobile
- [ ] Testes

---

## 11. Decisões Arquiteturais

| Decisão | Justificativa |
|---------|----------------|
| Next.js full-stack | Simples, mesma base de código, fácil deploy |
| SQLite local | Zero infraestrutura, arquivo único, portável |
| SSE sobre WebSocket | Unidirecional suficiente, HTTP nativo, retry automático |
| Sem autenticação | Aplicação local, foco em funcionalidade |
| CLI com HTTP | Reutiliza API do frontend, consistent interface |

## 13. Protótipo de Design

O projeto inclui um protótipo de design exportado (formato Figma/HTML) que serve como referência visual para implementação.

### Localização
```
agent-kanban/
└── Prototype-·-5_18_2026/
    ├── index.html          # Tela principal / launcher
    ├── board.html          # Quadro Kanban (board view)
    ├── board-2.html        # Quadro alternate/complementar
    ├── agents.html         # Gerenciamento de agentes
    ├── agent-board-ref.html # Referência de agente no board
    ├── settings.html       # Configurações
    ├── DESIGN-HANDOFF.md   # Instruções de implementação
    └── DESIGN-MANIFEST.json # Manifesto de design (máquina-legível)
```

### Telas do Protótipo

| Arquivo | Descrição | Propósito |
|---------|-----------|----------|
| **index.html** | Tela principal/launcher | Ponto de entrada do app, lista de boards |
| **board.html** | Quadro Kanban completo | View principal do board com colunas e cards |
| **board-2.html** | Quadro alternate | Variação/complemento do board view |
| **agents.html** | Gerenciamento de agentes | CRUD de agentes (criar, editar, ver) |
| **agent-board-ref.html** | Referência de agente no board | Comportamento de agente dentro do board |
| **settings.html** | Configurações do sistema | Preferências, tema, notificações |

### Contract de Implementação

Do `DESIGN-HANDOFF.md`:

1. **Fidelidade ao design**: Usar `index.html` como ponto de partida; preservar sistema visual, comportamento responsivo e interações
2. **Tokens extraídos**: Background, surface, foreground, muted text, border, accent, radius, shadow, spacing, type scale, motion duration/easing
3. **Responsividade**: Validar nos breakpoints: 360×800, 390×844, 430×932, 600×960, 820×1180, 1024×768, 1366×768, 1440×900, 1920×1080
4. **Layout geometry**: Preservar max-widths, gutters, grid columns, card proportions, sticky/fixed elements
5. **Estados interativos**: Hover, focus, pressed, disabled, loading, validation
6. **Acessibilidade**: Heading hierarchy, semantic controls (buttons/links/inputs)

### Assets do Protótipo

```
mpbyyjmz-image.png  # Imagem de referência
mpbyzifh-image.png  # Imagem de referência
mpc1fx6w-image.png  # Imagem de referência
```

### Próximos Passos

1. Extrair tokens de cores, tipografia, espaçamento do `index.html`
2. Mapear componentes reutilizáveis antes de codar
3. Implementar cada tela como sua própria rota Next.js
4. Testar responsividade em todos os breakpoints
5. Comparar resultado visual com o protótipo exportado

---

## 14. Referências da Wiki

Documentos e decisões relevantes encontrados na wiki que informam esta especificação:

### Conceitos

| Documento | Descrição | Link |
|-----------|-----------|------|
| **Server-Sent Events (SSE) — Real-time Communication** | Conceito fundamental de SSE como protocolo de comunicação unidirecional server→client | `wiki/concepts/server-sent-events-sse-real-time-communication.md` |
| **Event Sourcing Pattern** | Padrão de arquitetura onde mudanças são representadas como eventos | `wiki/concepts/event-sourcing-pattern.md` |
| **Decider Pattern** | Padrão dentro do Event Sourcing que separa lógica de decisão | `wiki/concepts/decider-pattern.md` |
| **Auto-Transition Pattern** | Padrão para transições automáticas de estado com broadcast SSE | `wiki/concepts/auto-transition-pattern-scheduled-state-transitions.md` |

### Decisões

| Documento | Descrição | Link |
|-----------|-----------|------|
| **SSE over WebSocket para Real-time Updates** | Decisão de usar SSE em vez de WebSocket para updates em tempo real | `wiki/decisions/sse-over-websocket-para-real-time-updates.md` |

### Fontes / POC

| Documento | Descrição | Link |
|-----------|-----------|------|
| **Event Sourcing POC v2 — Kanban Event-Driven (2026-05-16)** | POC completa com Bun + React + SSE demonstrando arquitetura de eventos | `wiki/sources/event-sourcing-poc-v2-kanban-event-driven-2026-05-16.md` |
| **Code Examples: Event Sourcing POC v2** | Exemplos de código de todas as camadas (domain, event store, task service, SSE) | `wiki/sources/code-examples-event-sourcing-poc-v2-2026-05-16.md` |
| **SSE + Event Sourcing — Session Synthesis (2026-05-16)** | Síntese da sessão de implementação de SSE + Event Sourcing | `wiki/synthesis/sse-event-sourcing-session-synthesis-2026-05-16.md` |
| **POC Event Sourcing - Decisões de Escopo** | Decisões de escopo para a POC de Event Sourcing | `wiki/decisions/poc-event-sourcing-decisoes-de-escopo.md` |

### Lições Aprendidas

| Documento | Descrição | Link |
|-----------|-----------|------|
| **Broker Socket Debugging** | Técnicas e lições aprendidas ao debugar broker Unix socket | `wiki/concepts/broker-socket-debugging.md` |
| **Debug Report: Broker Socket query tasks Timeout** | Report de debug sobre problemas no TaskService | `wiki/sources/debug-report-broker-socket-query-tasks-timeout.md` |

### Conceitos Relacionados

| Documento | Descrição | Link |
|-----------|-----------|------|
| **pi-teammate** | Pacote de colaboração peer-to-peer entre sessões Pi | `wiki/concepts/pi-teammate.md` |
| **Pi Intercom** | Comunicação local entre agentes via IPC | `wiki/concepts/pi-intercom.md` |
| **stitch-prototyping** | Skill para geração de protótipos via Google Stitch MCP | `wiki/concepts/stitch-prototyping.md` |

---

## 15. Glossário

| Termo | Definição |
|-------|-----------|
| Board | Quadro Kanban principal |
| Column | Coluna do board (Backlog, To Do, etc.) |
| Task | Cartão/tarefa individual |
| SubTask | Sub-tarefa dentro de uma task |
| Agent | Entidade (humano ou IA) que pode ser assignada |
| SSE | Server-Sent Events (comunicação server → client) |
| Drag & Drop | Arrastar e soltar cards entre colunas |

---

## 16. Perguntas em Aberto

- [ ] Necessidade de múltiplos boards simultâneos?
- [ ] Histórico de alterações (audit log)?
- [ ] Export/import de board?
- [ ] Templates de board pré-configurados?
- [ ] Notificações desktop?
- [ ] Tema dark/light mode?
# CLAUDE.md — RyzeSystems Dashboard

Sistema interno de gestão da agência RyzeSystems. Usado por Isaac e Vinícius para controlar clientes, projetos, contratos, financeiro, reuniões e hospedagens — sem planilhas.

---

## Stack

- **Next.js 14** (App Router, `'use client'` em todas as páginas do dashboard)
- **TypeScript 5** strict mode
- **Tailwind CSS 3** + `darkMode: 'class'`
- **Supabase** (PostgreSQL + Auth + Storage + RLS)
- **Recharts** — gráficos em Financeiro e Meta Ads
- **lucide-react** — ícones (nunca emoji em UI)
- **Framer Motion** — animações quando necessário

## Rodar localmente

```bash
npm run dev      # dev em http://localhost:3000
npm run build    # build de produção
npm run lint     # ESLint
```

Variáveis obrigatórias em `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=    # só para Server Actions (invite-user)
```

---

## Arquitetura

### Supabase client

Dois clientes distintos — nunca misturar:

```ts
// Browser (páginas 'use client')
import { createClient } from '@/lib/supabase'
const db = useMemo(() => createClient(), [])

// Server (Route Handlers, Server Actions)
import { createServerSupabaseClient } from '@/lib/supabase-server'
const db = await createServerSupabaseClient()
```

### Padrão Repository

Todos os acessos ao banco passam por repositórios em `src/lib/repositories/`. Cada repositório recebe `db` como argumento (não cria o client internamente).

```ts
const db = useMemo(() => createClient(), [])
const clientRepo = useMemo(() => clientRepository(db), [db])
// ...
const data = await clientRepo.findAll()
```

Repositórios disponíveis: `clientRepository`, `projectRepository`, `contractRepository`, `transactionRepository`, `leadRepository` — todos exportados via `src/lib/repositories/index.ts`.

### Contextos globais

Todos os contextos vivem no `DashboardShell` e estão disponíveis em qualquer rota `/dashboard/*`:

- `useDateFilter()` — filtro de período global (5 presets + range customizado)
- `useMobileNav()` — estado do menu mobile
- `useTheme()` — tema dark/light (persiste em `localStorage`)

### Hook useToast

```ts
const { toast, showToast } = useToast()
showToast('Mensagem de sucesso!')
// Auto-dismiss em 3500ms
```

---

## Estrutura de pastas

```
src/
├── app/dashboard/
│   ├── page.tsx          # Dashboard: KPIs, metas, Meta Ads, prazos urgentes
│   ├── clientes/         # Lista + detalhe de cliente
│   ├── projetos/         # Kanban de projetos (6 status, drag-and-drop)
│   ├── contratos/        # Contratos com parcelas (RYZE-YYYY-NNN)
│   ├── financeiro/       # Transações + gráficos Recharts
│   ├── reunioes/         # Lista de reuniões com abas por tipo
│   ├── agenda/           # Calendário semanal (time-grid 08h–22h)
│   ├── leads/            # Pipeline de leads
│   ├── hospedagem/       # Controle de hospedagens por domínio
│   ├── modificacoes/     # Fila de modificações com prioridade
│   ├── meta/             # Campanhas Meta Ads (CRUD manual)
│   ├── metas/            # Metas mensais de faturamento
│   └── configuracoes/    # Gestão de equipe (RBAC) e perfil
├── components/
│   ├── layout/           # DashboardShell, Header, Sidebar, ThemeProvider
│   └── ui/               # Badge, Button, Card, Modal
├── contexts/             # DateFilterContext
├── hooks/                # useToast
├── lib/
│   ├── supabase.ts       # Browser client
│   ├── supabase-server.ts# Server client
│   ├── format.ts         # formatCurrency, formatDate, formatDateShort
│   ├── deadline.ts       # daysUntil, deadlineLabel, isDeadlineWarning, isOverdue
│   ├── domain-config.ts  # Configs de status/labels/cores por entidade
│   ├── utils.ts          # cn() + re-exports de format/deadline/domain-config
│   └── repositories/     # Acesso ao banco (ver acima)
└── types/index.ts        # Todas as entidades TypeScript
```

---

## Banco de dados (Supabase)

Schema completo em `supabase/schema.sql`.

### Tabelas principais

| Tabela | Entidade |
|---|---|
| `clients` | Clientes da agência |
| `projects` | Projetos vinculados a clientes |
| `contracts` | Contratos com `project_id?` e `client_id` |
| `contract_installments` | Parcelas dos contratos (pendente/pago/atrasado) |
| `transactions` | Lançamentos financeiros (entrada/saída) |
| `leads` | Pipeline comercial |
| `meetings` | Reuniões (reuniao/fechamento/pos_call) |
| `hosting` | Hospedagens por domínio |
| `modifications` | Fila de modificações de projetos |
| `meta_campaigns` | Campanhas Meta Ads (manual) |
| `profiles` | Usuários com role (admin/gerente/visualizador) |
| `settings` | Configurações globais (metas mensais) |

### Triggers automáticos

- `on_installment_paid` — quando parcela muda para `status = 'pago'`, cria automaticamente uma `Transaction` do tipo `entrada`
- `on_auth_user_created` — cria automaticamente um `profile` no signup

### RLS

Transações: restritas a `admin`. Demais tabelas: leitura pública, escrita para `admin` ou `gerente`. RBAC via função SQL `get_user_role()`.

### Nomeclatura de contratos

Auto-gerada pelo `contractRepository.generateNumber()`: `RYZE-{ANO}-{NNN}` (sequencial por ano, zero-padded a 3 dígitos).

### Storage

Contratos PDF em Supabase Storage: bucket `clientes`, path `contratos/{timestamp}-{filename}`.

---

## Armadilhas conhecidas (leia antes de mexer)

### Supabase schema cache

Colunas novas adicionadas via `ALTER TABLE` **não são reconhecidas imediatamente** pelo PostgREST. O cache leva ~5 min para atualizar sozinho ou precisa de restart do projeto.

**Padrão obrigatório para colunas novas** (ver `clientes/page.tsx` e `reunioes/page.tsx`):

```ts
try {
  saveData = await trySave(fullPayload)
} catch (e: unknown) {
  const msg = e instanceof Error ? e.message
    : typeof e === 'object' && e !== null && 'message' in e
    ? String((e as { message: unknown }).message) : String(e)
  if (msg.includes('nome_da_coluna_nova')) {
    const { nome_da_coluna_nova: _, ...without } = fullPayload
    void _
    saveData = await trySave(without)
  } else throw e
}
```

**Por quê:** o objeto de erro do Supabase **não é** uma instância de `Error`. Usar `String(err)` retorna `[object Object]`. Sempre extrair `.message` com o guard acima.

### Async functions em strict mode

`async function` declarations dentro de blocos (`try {}`, `if {}`) são inválidas em TypeScript strict mode. Usar arrow functions:

```ts
// ❌ Inválido
async function trySave(p) { ... }

// ✅ Correto
const trySave = (p: Payload) => db.from('tabela').insert([p]).select().single()
```

### Joins Supabase e TypeScript

O tipo inferido de um join (`client:clients(name)`) pode ser `{ name: string }[]` (array) mesmo que você espere um objeto único. Cast com `as any` e use `Array.isArray()` para lidar com ambos:

```ts
client_name: (Array.isArray(p.client) ? p.client[0]?.name : p.client?.name) as string | undefined
```

### Contratos e projetos

`contracts.project_id` é **opcional** — a maioria dos contratos existentes não tem `project_id` preenchido. Para vincular pendências financeiras a projetos, usar `client_id` (que ambos sempre têm).

---

## Padrões de código obrigatórios

### Performance

```ts
// Memoizar o client e repositórios
const db = useMemo(() => createClient(), [])
const repo = useMemo(() => clientRepository(db), [db])

// Memoizar listas filtradas
const filtered = useMemo(() => items.filter(...), [items, filter])

// Componentes pesados com memo
const MyCard = memo(function MyCard({ ... }) { ... })
```

### Combinar iterações (não fazer múltiplos .filter())

```ts
// ❌ 4 passes separados
const a = list.filter(x => x.status === 'a')
const b = list.filter(x => x.status === 'b')

// ✅ 1 loop
let countA = 0, countB = 0
for (const x of list) {
  if (x.status === 'a') countA++
  if (x.status === 'b') countB++
}
```

### Estado derivado sem useEffect

```ts
// ❌ useEffect + setState (causa re-render extra)
useEffect(() => { setGreeting(calcGreeting()) }, [])

// ✅ lazy useState init
const [greeting] = useState(() => calcGreeting())
```

### Carregamento paralelo

```ts
const [data1, data2] = await Promise.all([repo1.findAll(), repo2.findAll()])
```

---

## Design System

Documentado em `DESIGN.md`. Resumo:

- **Paleta dark:** fundo `#0A0A0B`, surface `#111114`, border `#181819`
- **Paleta light:** fundo `#F5F7F5`, surface `#FFFFFF`, border `#E8EDE8`
- **Acento:** `#00FF41` (Agency Pulse) — único verde saturado, usado com moderação
- **Tipografia:** Plus Jakarta Sans (texto), JetBrains Mono (números e valores financeiros)
- **Elevação:** flat por padrão em dark mode — sem `box-shadow` genérico
- **Proibido:** gradiente de texto, glassmorphism decorativo, hero-metric template

Classes globais úteis: `.card-light`, `.stat-card`, `.input-field`, `.data-table`

---

## Responsáveis

- **Isaac** — dev principal, admin
- **Vinicius** — sócio, usa o sistema como gerente

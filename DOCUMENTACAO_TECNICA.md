# Compensa+ — Sistema Integrado de Gestão de Folgas Compensatórias
## Documentação Técnica Completa — v1.0

> **Órgão:** Secretaria de Estado da Administração Penitenciária do Maranhão (SEAP-MA)  
> **Objetivo:** Gestão digital do ciclo de vida das folgas compensatórias de servidores penitenciários — desde o registro de plantões trabalhados até a geração da folha de pagamento.

---

## 1. Stack Tecnológica

| Camada | Tecnologia | Versão | Finalidade |
|---|---|---|---|
| **Frontend Framework** | React | 19.x | Interface de usuário (SPA) |
| **Linguagem** | TypeScript | 6.x | Tipagem estática |
| **Build Tool** | Vite | 8.x | Servidor de dev + bundler de produção |
| **Roteamento** | React Router DOM | 7.x | SPA routing com layouts aninhados |
| **Backend / BaaS** | Supabase | 2.x | Auth, banco Postgres, RLS, Realtime |
| **Banco de Dados** | PostgreSQL | 15+ (via Supabase) | Persistência de dados |
| **Gráficos** | Recharts | 3.x | Gráficos no dashboard (pizza, barra, linha) |
| **Ícones** | Lucide React | 1.x | Ícones SVG tipados |
| **Exportação XLSX** | xlsx (SheetJS) | 0.18.x | Geração de planilhas Excel no browser |
| **Exportação PDF** | jsPDF + jspdf-autotable | latest | Geração de PDF com tabelas formatadas |
| **Estilização** | Vanilla CSS | — | index.css com design system de tokens |
| **Linter** | oxlint | 1.x | Análise estática rápida |

---

## 2. Arquitetura Geral

```
Sistema - Folga Compensatória/
├── database/               # Scripts SQL de migração (aplicados manualmente no Supabase)
│   ├── 00_init_schema.sql
│   ├── 01_rls_functions_triggers.sql
│   ├── 02_rpc_clone.sql
│   ├── 03_import_planilha.sql
│   ├── 04_saldo_plantoes.sql
│   ├── 05_limite_financeiro.sql
│   ├── 06_saldo_minutos.sql
│   ├── 07_shifts_minutos_residuais.sql
│   ├── 08_plantao_plus.sql
│   └── 09_unique_shift_employee_cycle.sql
├── frontend/               # Aplicação React + Vite
│   ├── src/
│   │   ├── lib/supabase.ts         # Cliente Supabase singleton
│   │   ├── contexts/AuthContext.tsx # Auth global (User + Profile)
│   │   ├── App.tsx                 # Rotas e guards de perfil
│   │   ├── layouts/
│   │   │   ├── AdminLayout.tsx     # Sidebar ADMIN/GESTAO
│   │   │   └── EstabelecimentoLayout.tsx
│   │   ├── pages/
│   │   │   ├── Login.tsx
│   │   │   ├── AdminDashboard.tsx
│   │   │   ├── admin/
│   │   │   │   ├── Ciclos.tsx
│   │   │   │   ├── Configuracoes.tsx
│   │   │   │   ├── Estabelecimentos.tsx
│   │   │   │   └── Relatorios.tsx
│   │   │   └── estabelecimento/
│   │   │       ├── Dashboard.tsx
│   │   │       ├── Folgas.tsx
│   │   │       ├── Servidores.tsx
│   │   │       ├── Solicitacoes.tsx
│   │   │       └── Simulador.tsx
│   │   └── components/
│   │       └── CycleCard.tsx
│   └── package.json
└── data_import/            # Planilhas modelo e dados para importação
```

---

## 3. Banco de Dados — Modelagem Relacional

### 3.1 Diagrama Entidade-Relacionamento (Resumo)

```
establishments (unidades penais)
    |
    |-- profiles (usuários do sistema)
    |-- employees (servidores/funcionários)
    |-- cycle_establishments (orçamento por unidade/ciclo)
            |
            └-- planning_limits (cotas por cargo por unidade)

cycles (ciclos mensais)
    |
    |-- cycle_establishments
    |-- shifts (plantões trabalhados por servidor)
    |-- compensatory_days (direitos à folga gerados)
    └-- purchase_requests (solicitações de compra de folga / plantão plus)

employees
    |-- shifts → compensatory_days
    └-- purchase_requests

positions (cargos: INSP, APT, ASP)
    └-- position_values (histórico de valores por cargo)
        └-- purchase_requests.valor_historico_id
```

### 3.2 Tabelas — Descrição Completa

#### `establishments`
Representa cada Unidade Penal do Estado.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | UUID PK | Identificador único |
| `nome` | VARCHAR(255) | Nome da unidade |
| `localizacao` | VARCHAR(100) | Região/cidade |
| `complexidade` | VARCHAR(100) | Classificação de complexidade |
| `ativo` | BOOLEAN | Controla visibilidade nos filtros |

#### `profiles`
Usuários do sistema, vinculados ao Supabase Auth (mesmo `id` do Auth).

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | UUID PK | Mesmo ID do `auth.users` |
| `nome` | VARCHAR | Nome do usuário |
| `email` | VARCHAR | E-mail de login |
| `perfil` | ENUM | `ADMIN`, `ESTABELECIMENTO`, ou `GESTAO` |
| `establishment_id` | UUID FK | Nulo para ADMIN/GESTAO; obrigatório para ESTABELECIMENTO |
| `ativo` | BOOLEAN | Permite desativar sem excluir |

#### `cycles`
Ciclo mensal de apuração (ex: "Julho/2025").

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | UUID PK | Identificador |
| `nome` | VARCHAR(50) | Ex: "Julho/2025" |
| `mes`, `ano` | INTEGER | Para filtros e ordenação |
| `data_inicio`, `data_fim` | DATE | Período do ciclo |
| `status` | ENUM | `RASCUNHO`, `ABERTO`, `EM_ANALISE`, `FECHADO`, `REABERTO` |
| `opened_at/by`, `closed_at/by`, `reopened_*` | TIMESTAMPTZ/UUID | Auditoria de transições de status |

#### `cycle_establishments`
Orçamento liberado para cada unidade em cada ciclo (N:M entre cycles e establishments).

| Coluna | Tipo | Descrição |
|---|---|---|
| `cycle_id` | UUID FK | Ciclo |
| `establishment_id` | UUID FK | Unidade penal |
| `total_orcado` | DECIMAL(12,2) | Verba liberada para o ciclo nesta unidade |
| UNIQUE | — | `(cycle_id, establishment_id)` |

#### `positions`
Cargos dos servidores. Fixos no sistema: INSP (Inspetor), APT (Agente Temporário), ASP (Auxiliar).

#### `position_values`
Histórico de valores por cargo com vigência. Registra o valor exato pago em cada solicitação.

#### `employees`
Servidores penitenciários.

| Coluna | Tipo | Descrição |
|---|---|---|
| `establishment_id` | UUID FK | **Custódia atual** — unidade onde está lotado hoje. Móvel: muda numa transferência. |
| `matricula` | VARCHAR | Identificador funcional **único globalmente** desde a migração 19 (antes era único só por unidade) |
| `position_id` | UUID FK | Cargo do servidor |
| `saldo_plantoes` | INTEGER | Legado — saldo acumulado de plantões (trigger) |
| `saldo_minutos` | INTEGER | Ativo — minutos residuais do ciclo anterior (carry-over), segue o servidor na transferência |

> **IMPORTANTE sobre `saldo_minutos`:** Campo crítico para o cálculo correto de plantões.
> Representa os minutos que "sobraram" da divisão da carga horária do ciclo anterior.
> São somados à carga horária nova antes de calcular os plantões do ciclo atual.

> **IMPORTANTE sobre transferência de servidor (migrações 17-20, produção desde 2026-08-12):**
> `employees.establishment_id` é só a lotação **atual**. `shifts.establishment_id` e
> `compensatory_days.establishment_id` são colunas **fixas**, gravadas no momento em que o
> plantão/folga aconteceu e nunca alteradas depois — é a fonte correta de "em qual unidade isso
> aconteceu" para relatórios históricos, não `employees.establishment_id`. Ver seção 5.6.
>
> **Gap conhecido:** a RLS de `employees` ainda filtra pela lotação atual, não pelo histórico.
> Relatórios do lado ESTABELECIMENTO que juntam `employees!inner(...)` a `shifts`/
> `compensatory_days` podem perder linhas de servidores já transferidos para outra unidade. Não
> corrigido até o momento desta documentação.

#### `shifts`
Registro de plantões trabalhados por servidor em um ciclo.

| Coluna | Tipo | Descrição |
|---|---|---|
| `employee_id` | UUID FK | Servidor |
| `cycle_id` | UUID FK | Ciclo |
| `establishment_id` | UUID FK | Unidade onde o plantão aconteceu — **fixo**, não segue transferência (migração 17/18) |
| `quantidade_plantoes` | INTEGER | Plantões importados |
| `minutos_residuais` | INTEGER | Minutos residuais gerados neste ciclo (usado para rollback em reimportação) |
| UNIQUE | — | `uq_shifts_employee_cycle (employee_id, cycle_id)` — migração 09 |

#### `compensatory_days`
Direitos de folga gerados automaticamente a cada 21 plantões.

| Coluna | Tipo | Descrição |
|---|---|---|
| `employee_id` | UUID FK | Servidor |
| `cycle_id` | UUID FK | Ciclo em que foi gerado |
| `establishment_id` | UUID FK | Unidade onde a folga foi gerada — **fixo**, não segue transferência (migração 17/18) |
| `quantidade_plantoes` | INTEGER | Sempre 1 — cada registro representa 1 direito à folga |
| `status` | ENUM | `GERADA`, `INDENIZACAO_SOLICITADA`, `USUFRUIDA`, `INDENIZADA`, `CANCELADA` (renomeado na migração 15; nomes antigos: `AGUARDANDO_DECISAO`→`INDENIZACAO_SOLICITADA`, `COMPRADA`→`INDENIZADA`, `UTILIZADA`→`USUFRUIDA`) |
| `used_at` | DATE | Data em que o servidor de fato gozou a folga (fluxo de Usufruto, migração 15) |
| `usage_registered_by` | UUID FK | Quem registrou o gozo |
| `decided_by`, `decided_at` | UUID/TIMESTAMPTZ | Quem aprovou/rejeitou a indenização e quando |

#### `purchase_requests`
Solicitações de compra de folga (indenização) ou Plantão Plus.

| Coluna | Tipo | Descrição |
|---|---|---|
| `tipo_solicitacao` | VARCHAR | `FOLGA_COMPENSATORIA` ou `PLANTAO_PLUS` |
| `compensatory_day_id` | UUID FK | Vinculado ao direito de folga (null para Plantão Plus) |
| `establishment_id` | UUID FK | Unidade solicitante |
| `employee_id` | UUID FK | Servidor |
| `position_id` | UUID FK | Cargo |
| `data_plantao` | DATE | Data do plantão comprado; usada para bloquear duplicidade por servidor+data |
| `valor` | DECIMAL | Valor calculado no momento da solicitação — validado no banco contra `position_values` desde a migração 21 (não confia só no que o navegador envia) |
| `valor_historico_id` | UUID FK | Referência ao valor vigente no momento (position_values) |
| `status` | ENUM | `SOLICITADA`, `APROVADA`, `REJEITADA`, `CANCELADA` |
| `justificativa` | TEXT | Obrigatório, mínimo 50 e máximo **1000** caracteres (reduzido de 2000 na migração 23) |
| `requested_by` | UUID FK | Quem lançou a solicitação |
| `analyzed_by`, `analyzed_at` | UUID/TIMESTAMPTZ | Quem aprovou/rejeitou e quando |
| `rejection_reason` | TEXT | Motivo da rejeição (coletado via modal padrão do sistema, não mais `window.prompt`) |
| `cancelled_by`, `cancelled_at`, `cancellation_reason` | UUID/TIMESTAMPTZ/TEXT | Auditoria do cancelamento pela própria unidade |

> **Trava de orçamento (trigger `validar_solicitacao_compra`, `database/01_rls_functions_triggers.sql`,
> ajustado pela migração 21):** ao inserir/atualizar uma linha, o banco recalcula o valor esperado a
> partir de `valor_historico_id` (não confia no `valor` enviado) e rejeita se
> `SUM(valor) WHERE status IN ('SOLICITADA','APROVADA') AND id != NEW.id` somado ao novo valor
> ultrapassar `cycle_establishments.total_orcado` (linha travada com `FOR UPDATE`). Esta é a
> **fonte da verdade** — o frontend replica o mesmo cálculo (orçado − aprovado − pendente) só para
> UX (bloquear antes de gastar uma chamada ao banco), em `Folgas.tsx`, `Solicitacoes.tsx` e
> `Simulador.tsx`.

---

## 4. Autenticação e Controle de Acesso

### Fluxo de Login
1. Usuário insere e-mail e senha em `Login.tsx`
2. `supabase.auth.signInWithPassword()` autentica contra Supabase Auth
3. `AuthContext.tsx` captura a sessão via `onAuthStateChange`
4. Busca o registro em `profiles` com o mesmo UUID do Auth
5. Guarda o `profile` (nome, perfil, establishment_id) no contexto global React

### Guard de Rotas (`ProtectedRoute`)
```tsx
// App.tsx
<ProtectedRoute allowedRoles={['ADMIN', 'GESTAO']}>
  <AdminLayout />
</ProtectedRoute>
```
- Se não autenticado → redirect para `/login`
- Se perfil não autorizado → redirect para `/`
- `HomeSwitcher` redireciona ADMIN/GESTAO para `/admin` e ESTABELECIMENTO para `/estabelecimento`

### Perfis de Acesso

| Perfil | Acesso | Escopo |
|---|---|---|
| `ADMIN` | Total | Todos os módulos, incluindo Configurações (CRUD de usuários e cargos, importação) |
| `GESTAO` | Parcial | Dashboard, Ciclos, Estabelecimentos, Relatórios (sem acesso a Configurações) |
| `ESTABELECIMENTO` | Restrito | Apenas módulos da própria unidade penal |

---

## 5. Lógica de Negócio — Cálculo de Plantões e Folgas

### 5.1 Regra dos 21 Plantões

> **Cada 21 plantões trabalhados = 1 direito de folga compensatória.**

### 5.2 Cálculo por Importação de Planilha (Configuracoes.tsx)

Para cada servidor encontrado na planilha Excel:

```
1. minutosNovos  = horas_trabalhadas × 60
                   (convertido da coluna "HORAS TRABALHADAS" da planilha)

2. totalMinutos  = minutosNovos + employee.saldo_minutos
                   (saldo_minutos = resíduo do ciclo anterior — carry-over)

3. plantoes      = Math.floor(totalMinutos / 720)
                   (720 min = 12h = 1 plantão)

4. novoSaldo     = totalMinutos % 720
                   (minutos que "sobraram" → carry-over para o próximo ciclo)

5. Salva:
   - shifts.quantidade_plantoes   = plantoes
   - shifts.minutos_residuais     = novoSaldo
   - employees.saldo_minutos      = novoSaldo
```

**Exemplo:**
- Servidor com `saldo_minutos = 139` do mês anterior
- Planilha: 140h trabalhadas → 8.400 min
- `totalMinutos = 8.400 + 139 = 8.539`
- `plantoes = floor(8.539 / 720) = 11`
- `novoSaldo = 8.539 % 720 = 739 - 720 = 19`... aguarda próximo ciclo

### 5.3 Anti-Duplicação de Plantões na Reimportação (migração 09)

**Problema original:** Uma reimportação para o mesmo ciclo gerava registros duplicados em `shifts` porque o código usava `.maybeSingle()` para buscar o shift existente. Quando havia mais de 1 registro (duplicata), `.maybeSingle()` retornava `null` silenciosamente, e o rollback era ignorado.

**Solução implementada:**

1. **Banco:** Adicionada `UNIQUE(employee_id, cycle_id)` na tabela `shifts`
2. **Frontend (Configuracoes.tsx):**
   ```
   a. Busca TODOS os shifts: SELECT * WHERE employee_id = X AND cycle_id = Y
   b. Soma todos os minutos_residuais antigos
   c. Subtrai do saldo_minutos do servidor (rollback)
   d. Deleta todos os shifts antigos com .in('id', oldIds)
   e. Insere o novo registro com os valores recalculados
   ```

### 5.4 Trigger de Banco — `trg_recalculate_shift_balance` (migração 04)

Trigger legado em PostgreSQL que recalcula `saldo_plantoes` e gera registros em `compensatory_days` automaticamente.

> ⚠️ A lógica atual de importação em lote usa o frontend com controle granular.
> O trigger coexiste mas a geração de folgas é controlada pelo código frontend durante a importação.

### 5.5 Fluxo Completo de uma Folga

```
1. ADMIN importa planilha Excel no ciclo aberto
2. Sistema calcula plantões por servidor e salva em shifts
3. Compensatory_days são gerados (status: GERADA)
4. GESTAO do Estabelecimento lança solicitação de compra (indenização) da folga
5. compensatory_day.status → INDENIZACAO_SOLICITADA
6. purchase_request criada com status: SOLICITADA
7. ADMIN/GESTAO aprova ou rejeita a solicitação
8a. Se aprovada: purchase_request.status → APROVADA, compensatory_day.status → INDENIZADA
8b. Se rejeitada: purchase_request.status → REJEITADA, compensatory_day.status volta a GERADA
9. Folga indenizada aparece na Folha de Pagamento (Relatorios.tsx - Tab 3)

Alternativa ao passo 4: em vez de solicitar compra, a unidade pode "Registrar Gozo"
(Usufruto) — compensatory_day.status → USUFRUIDA, used_at = data do descanso, sem
gerar nenhuma purchase_request (não movimenta orçamento).
```

### 5.6 Transferência de Servidor Entre Unidades (migrações 17-20, produção desde 2026-08-12)

**Problema original:** `employees` usava `UNIQUE(establishment_id, matricula)`. Quando um servidor
era transferido de uma unidade para outra, a importação mensal não reconhecia que era a mesma
pessoa — criava um `employee_id` novo, zerava `saldo_minutos` e fragmentava o histórico entre dois
registros diferentes.

**Solução em 3 camadas:**
1. `employees.matricula` passou a ser `UNIQUE` sozinha — identidade global do servidor.
   `employees.establishment_id`/`saldo_minutos` continuam móveis (seguem a custódia atual).
2. `shifts.establishment_id` e `compensatory_days.establishment_id` são colunas novas, fixas para
   sempre na unidade onde o plantão/folga aconteceu de fato — preenchidas no insert e propagadas
   pelo trigger `trg_recalculate_shift_balance`.
3. RLS de `shifts`/`compensatory_days` (`Est_shifts`/`Est_compensatory_days`) passou a filtrar por
   essa coluna fixa, em vez de fazer join na lotação atual do servidor — sem isso, a unidade de
   origem perderia acesso ao próprio histórico assim que o servidor fosse transferido.

`Configuracoes.tsx` (importação) busca o servidor por matrícula global e detecta a transferência
automaticamente — não existe tela manual de "transferir servidor".

**Gap residual conhecido, fora do escopo desta feature:** a RLS de `employees` continua filtrando
pela lotação **atual** (`get_user_establishment()`), não foi estendida para cobrir servidores com
histórico na unidade. Relatórios do lado ESTABELECIMENTO que usam `employees!inner(...)` para
juntar nome/matrícula (ex.: `estabelecimento/Relatorios.tsx`) podem perder linhas de `shifts`/
`compensatory_days` de servidores já transferidos, mesmo com `establishment_id` fixo correto nessas
tabelas — o PostgREST descarta a linha pai inteira se o join `!inner` falhar a RLS de `employees`.
Sem incidente real registrado até o momento.

---

## 6. Módulos do Sistema

### 6.1 Dashboard Administrador (`AdminDashboard.tsx`)

Visão consolidada do Estado inteiro.

**Filtros:**
- **Visualizar Ciclo** — auto-seleciona o ciclo ABERTO/REABERTO. Lista todos os ciclos históricos.
- **Estabelecimento Penal** — multisseleção com checkbox + "Selecionar Todas"
- **Localização** — filtro por região (multisseleção)
- Ordem dos filtros no layout: Visualizar Ciclo → Estabelecimento Penal → Localização

**Dados exibidos:**
- KPI Cards: Total Orçado, Total Gasto, Saldo Disponível, Pendentes de Aprovação, Total de Servidores, Total de Folgas
- Gráfico de pizza: distribuição do orçamento por estado
- Gráfico de barras: Orçado vs. Gasto por unidade
- Tabelas: Solicitações pendentes + Folgas geradas recentes
- Badge no header: status do ciclo selecionado + período de vigência

---

### 6.2 Ciclos (`admin/Ciclos.tsx`)

CRUD de ciclos mensais com controle de status.

**Filtros:**
- Mês: gerado dinamicamente (`[...new Set(cycles.map(c => c.mes))]`)
- Ano: gerado dinamicamente
- Ordenação: `ano ASC, mes ASC` (julho antes de agosto)

**Estados de um Ciclo e Transições:**
```
RASCUNHO → [Abrir] → ABERTO → [Fechar] → FECHADO → [Reabrir] → REABERTO
```

**Edição de Datas:** Só permitida antes de abrir o ciclo (status RASCUNHO) ou via modal de edição. O botão "Abrir" fica disponível ao clicar para editar as datas.

---

### 6.3 Configurações (`admin/Configuracoes.tsx`)

Exclusivo para `ADMIN`.

**Aba Importação — fluxo detalhado:**
1. Usuário seleciona `.xlsx` → `xlsx.read()` no browser
2. Pré-processamento: mapeia colunas, valida matrícula e cargo
3. Exibe preview com status por linha (novo, atualização, erro)
4. Ao confirmar: loop assíncrono por servidor com barra de progresso
5. Para cada servidor:
   - Busca shift existente → rollback do saldo_minutos
   - Deleta shifts antigos → insere novo
   - Atualiza employees.saldo_minutos

**Coluna esperadas na planilha:**
`MATRICULA` | `NOME` | `CARGO` | `DATA ADMISSAO` | `ESTABELECIMENTO` | `HORAS TRABALHADAS`

---

### 6.4 Estabelecimentos (`admin/Estabelecimentos.tsx`)

Gerenciamento de Unidades Penais.

- CRUD de estabelecimentos
- Por ciclo: define `total_orcado` e cotas por cargo (`planning_limits`)
- Clone de ciclo anterior via RPC Supabase `clone_cycle_establishments`

---

### 6.5 Relatórios (`admin/Relatorios.tsx`)

Geração de relatórios da folha de pagamento.

**Tab 1 — Orçado vs. Gasto:**
- `cycle_establishments` JOIN `establishments` + `purchase_requests` por ciclo
- Agrupa por `establishment_id`, calcula gasto (APROVADAS) e reservado (SOLICITADAS)
- Barra de progresso visual de execução orçamentária

**Tab 2 — Detalhamento por Estabelecimento:**
- `purchase_requests` APROVADAS, agrupadas por `establishment_id + position_id`
- Separa `FOLGA_COMPENSATORIA` de `PLANTAO_PLUS`

**Tab 3 — Folha por Servidor:**
- Query 1: `shifts` — plantões trabalhados no ciclo por servidor
- Query 2: `compensatory_days` — folgas geradas e compradas por servidor
- Query 3: `purchase_requests` APROVADAS — valores financeiros por servidor
- Cruzamento no frontend: `empMap (employee_id → FolhaServidorRow)`
- Filtro local por nome/matrícula com `useMemo`

**Exportação PDF (lazy import):**
```typescript
const { jsPDF } = await import('jspdf');
const { default: autoTable } = await import('jspdf-autotable');
// Carregado sob demanda para não aumentar o bundle inicial
```

**Exportação XLSX:**
```typescript
const wb = XLSX.utils.book_new();
const ws = XLSX.utils.json_to_sheet(rows);
XLSX.utils.book_append_sheet(wb, ws, 'NomeDaAba');
XLSX.writeFile(wb, 'arquivo.xlsx');
```

---

### 6.6 Dashboard do Estabelecimento (`estabelecimento/Dashboard.tsx`)

Painel específico de cada Unidade Penal, filtrado por `profile.establishment_id`.

**Filtro de Ciclo:**
- Carrega todos os ciclos (`order by ano DESC, mes DESC`)
- Auto-seleciona o ABERTO/REABERTO, ou o primeiro da lista
- Ao mudar: chama `fetchDashboardData(newCycleId)` e recarrega tudo

**Dados dinâmicos por ciclo:**
- `cycle_establishments`: orçamento da unidade naquele ciclo
- `planning_limits`: cotas por cargo para aquele ciclo
- `purchase_requests`: solicitações da unidade no ciclo
- `compensatory_days`: folgas dos servidores da unidade no ciclo
- Tudo filtrado por `establishment_id = profile.establishment_id`

---

### 6.6b Lançamento de Plantões (`estabelecimento/Folgas.tsx`)

Tela onde a unidade lança o Plantão Plus (compra direta de plantão, sem passar por
`compensatory_days`).

- Card "Disponível p/ Lançamento" = `orçado − aprovado − pendente` do ciclo ativo, recalculado a
  cada carregamento via `fetchOrcamento`.
- **Bloqueio no lançamento (2026-08-15):** antes desta mudança, o valor usado na checagem de
  orçamento no submit podia estar desatualizado (state React de uma busca anterior), permitindo
  lançar acima do disponível mesmo sabendo que a aprovação seria barrada depois. `fetchOrcamento`
  agora retorna o valor recém-calculado (`Promise<number>`) e `handleSavePlus` **aguarda uma nova
  busca imediatamente antes do submit**, comparando contra esse valor fresco, não contra o state
  potencialmente obsoleto. Ver commit `9a9b9ec`.
- A trava definitiva continua sendo o trigger de banco (`validar_solicitacao_compra`, seção 3.2) —
  esta mudança é só de UX, para não deixar o operador criar uma solicitação que sabe de antemão
  que será barrada na aprovação.

### 6.7 Simulador Orçamentário (`estabelecimento/Simulador.tsx`)

Ferramenta de planejamento sem persistência (não grava nada no banco).

- Inputs: quantidade de folgas desejada por cargo.
- Calcula custo simulado a partir dos valores vigentes de `position_values`.
- **Saldo usado na simulação (corrigido em 2026-08-15, commit `81e586e`):** até então o
  "Orçamento Disponível" do simulador era só o teto planejado (`planning_limits.quantidade_planejada
  × valor_do_cargo`), sem descontar o que a unidade já tinha `APROVADA` ou `SOLICITADA` no ciclo —
  ou seja, simulava sempre contra o orçamento cheio, mesmo que boa parte já estivesse gasta/
  reservada. Agora busca `purchase_requests` do ciclo (status `SOLICITADA`+`APROVADA`), soma em
  `totalComprometido`, e usa `disponivelReal = totalOrcado − totalComprometido` em todos os
  cálculos (card, saldo restante, botão "MÁX", % comprometido, poder de compra por cargo). O card
  também mostra "de R$ X orçado · R$ Y já comprometido" para deixar a diferença visível.

### 6.8 Solicitar Compra (`estabelecimento/Solicitacoes.tsx`)

Tela principal de fluxo financeiro do lado ESTABELECIMENTO: comprar folgas geradas, registrar
Usufruto, acompanhar/cancelar solicitações do ciclo e aprovar/rejeitar (quando o perfil tiver
permissão).

- **Trava de orçamento na criação:** `disponivelParaLancamento` desconta Aprovado + Aguardando
  Aprovação antes de permitir uma nova solicitação (individual ou em lote) — mesma filosofia da
  seção 6.6b.
- **Padrão de modal do sistema:** a tela usa dois estados de UI compartilhados em vez de
  `alert()`/`window.confirm()`/`window.prompt()` nativos do navegador:
  - `infoModal` — avisos/erros de leitura única (substitui `alert()`).
  - `confirmAction` — confirmação com Cancelar/Confirmar (substitui `window.confirm()`); suporta um
    campo opcional `reason` (label/placeholder/minLength/maxLength) que renderiza um `<textarea>`
    dentro do próprio modal e desabilita o botão de confirmar até o mínimo de caracteres — usado no
    fluxo de rejeição (`handleRejectRequest`/`executeRejectRequest`), que **até 2026-08-15** usava
    `window.prompt()` para coletar o motivo (commit `383b381`). Ver seção 7 para o padrão completo.
- Este é o mesmo padrão de modal usado no restante do sistema; **não** é o mesmo componente do
  refactor Kombai (`components/ui/ConfirmDialog`/`AlertDialog`), que existe só no worktree
  `sdd/solicitar-compra-lancamento-refactor` (ainda não mesclado — ver seção 12).

---

## 7. Design System (`index.css`)

### Tokens de Cor
```css
--color-text         /* Texto principal (#1e293b) */
--color-text-muted   /* Texto secundário (#64748b) */
--color-surface      /* Background de cards (#ffffff) */
--color-divider      /* Bordas (#e2e8f0) */
--color-bg           /* Background da página (#f8fafc) */
--color-accent-*     /* Variações do azul primário */
--color-danger       /* Vermelho de erro */
```

### Componentes CSS Principais

| Classe | Uso |
|---|---|
| `.modern-dashboard` | Wrapper com `display: flex; flex-direction: column; gap: 24px` |
| `.modern-header` | Cabeçalho com `display: flex; justify-content: space-between` |
| `.modern-card` | Card com `border-radius: 12px; box-shadow` |
| `.grid-2` | `display: grid; grid-template-columns: 1fr 1fr; gap: 24px` |
| `.grid-4` | `display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px` |
| `.badge-{green/yellow/red/blue/gray}` | Badges coloridos por status |
| `.progress-bar-bg + .progress-bar-fill` | Barras de progresso animadas |
| `.input` | Campo de input/select padronizado |
| `.btn`, `.btn-primary`, `.btn-secondary` | Botões com variantes |
| `.blueprint .card` | Tema retro-tech com bordas decorativas |

### Padrão de Modal (substitui diálogos nativos do navegador)

O sistema **não usa** `alert()`, `window.confirm()` ou `window.prompt()` — todos foram substituídos
por dois estados de componente, replicados em cada tela que precisa deles (não é um componente
compartilhado; ver ressalva sobre o refactor Kombai na seção 12):

```tsx
const [infoModal, setInfoModal] = useState<{
  title: string; message: string; type?: 'error' | 'warning';
} | null>(null);

const [confirmAction, setConfirmAction] = useState<{
  title: string; message: string; onConfirm: (reason: string) => void; confirmText?: string;
  reason?: { label: string; placeholder?: string; minLength?: number; maxLength?: number };
} | null>(null);
```

`infoModal` renderiza um overlay `.blueprint card elev-md` com um botão "Entendi". `confirmAction`
renderiza Cancelar/Confirmar; quando `reason` está preenchido, mostra um `<textarea>` e desabilita o
botão de confirmar até atingir `minLength`. Usado para qualquer coleta de motivo (ex.: rejeição de
solicitação) no lugar de `window.prompt()`.

### Responsividade
- Media query `@media (max-width: 768px)` para mobile
- Sidebars com `.mobile-hidden` e hamburger menu
- `.mobile-header-bar` aparece apenas em telas pequenas
- Grids colapsam para 1 coluna em mobile

---

## 8. Variáveis de Ambiente

Arquivo: `frontend/.env` (não versionado no git)

```env
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 9. Migrations do Banco de Dados

Aplicadas manualmente no painel Supabase → SQL Editor, em ordem numérica.

| Arquivo | O que faz |
|---|---|
| `00_init_schema.sql` | Cria todos os ENUMs, tabelas e índices |
| `01_rls_functions_triggers.sql` | Row Level Security por perfil de acesso |
| `02_rpc_clone.sql` | RPC `clone_cycle_establishments` para clonar orçamentos entre ciclos |
| `03_import_planilha.sql` | Função auxiliar legada para importação via banco |
| `04_saldo_plantoes.sql` | Adiciona `saldo_plantoes` + trigger de geração automática de folgas |
| `05_limite_financeiro.sql` | Trava financeira por orçamento disponível na unidade |
| `06_saldo_minutos.sql` | Adiciona `saldo_minutos` (carry-over de minutos entre ciclos) |
| `07_shifts_minutos_residuais.sql` | Adiciona `minutos_residuais` em shifts (para rollback em reimportação) |
| `08_plantao_plus.sql` | Adiciona `tipo_solicitacao` e `data_plantao` em purchase_requests |
| `09_unique_shift_employee_cycle.sql` | Constraint UNIQUE em shifts para evitar duplicatas por servidor/ciclo |
| `10_trigger_calculo_orcamento.sql` | Trigger `recalcular_orcamento_unidade`: recalcula `cycle_establishments.total_orcado` = Σ(quantidade planejada × valor do cargo) sempre que `planning_limits` muda |
| `11_tutorials.sql` | Cria tabela `tutorials` (módulo de vídeos tutoriais) |
| `12_fix_profiles_fkeys.sql` | Corrige chaves estrangeiras de `profiles` para `ON DELETE SET NULL` permitindo deleção de usuários |
| `13_add_missing_audits.sql` | Adiciona triggers de auditoria (`log_audit_event`) nas tabelas que ainda não tinham: profiles, employees, shifts, planning_limits, position_values, cycle_establishments, establishments, positions |
| `14_must_change_password.sql` | Adiciona `profiles.must_change_password` + RPC `mark_password_changed`, para forçar troca de senha no primeiro acesso |
| `15_refactor_folga_status.sql` | Renomeia o enum de status de `compensatory_days` (`AGUARDANDO_DECISAO`→`INDENIZACAO_SOLICITADA`, `COMPRADA`→`INDENIZADA`, `UTILIZADA`→`USUFRUIDA`) e adiciona `used_at`/`usage_registered_by` para o fluxo de Usufruto |
| `16_update_valor_cargo_temporario.sql` | Reajuste pontual do valor do cargo "Agente Penitenciário Temporário" para R$ 316,21, propagado para `position_values`, `purchase_requests` já existentes e recálculo do `total_orcado` |
| `17_transferencia_servidor_colunas.sql` | Transferência de servidor 1/4: adiciona `establishment_id` fixo (nullable) em `shifts`/`compensatory_days`, com backfill pela lotação atual |
| `18_transferencia_servidor_trigger.sql` | Transferência de servidor 2/4: `trg_recalculate_shift_balance` passa a propagar `establishment_id` do shift para a folga gerada |
| `19_transferencia_servidor_constraint.sql` | Transferência de servidor 3/4: `employees.matricula` vira `UNIQUE` globalmente (era único só por unidade) |
| `20_transferencia_servidor_rls.sql` | Transferência de servidor 4/4: RLS de `shifts`/`compensatory_days` passa a usar a coluna `establishment_id` fixa (não mais join na lotação atual); coluna vira `NOT NULL` |
| `21_valida_valor_solicitacao.sql` | Trigger `validar_solicitacao_compra` passa a **recalcular** o valor esperado a partir de `position_values` (via `valor_historico_id`), em vez de confiar no `valor` enviado pelo cliente — corrige falha de segurança onde um cliente ESTABELECIMENTO podia forjar um valor artificialmente baixo |
| `22_recalculo_orcamento_preco_cargo.sql` | Corrige `total_orcado` que ficava dessincronizado quando o preço de um cargo mudava em `position_values` sem passar por `planning_limits` |
| `23_justificativa_max_1000.sql` | Reduz o limite máximo da `justificativa` de `purchase_requests` de 2000 para 1000 caracteres (mínimo continua 50) |
| `24_auto_reject_pending_on_cycle_close.sql` | Ao fechar um ciclo, rejeita automaticamente `purchase_requests` ainda `SOLICITADA` e abre exceção pontual em `check_cycle_status()` para permitir esse UPDATE mesmo com o ciclo já FECHADO |
| `25_permite_update_compensatory_days_ciclo_fechado.sql` | `check_cycle_status()` deixa de bloquear UPDATE em `compensatory_days` por ciclo fechado (o `cycle_id` da folga é só histórico, não uma janela de edição) — corrige compra de folgas de backlog que ficavam presas em `GERADA` |
| `26_escalas_modalidade_compra.sql` | Cria `schedule_types`/`schedule_type_aliases` + `employees.schedule_type_id`; `trg_recalculate_shift_balance` para de acumular saldo para servidores em escala com `permite_carga_horaria = false` |
| `27_corrige_retroatividade_escala_desabilitada.sql` | Corrige retroatividade indevida da migração 26: adiciona `shifts.conta_para_saldo` (decidido uma vez, na inserção, via trigger `BEFORE INSERT` novo) para que religar uma escala não volte a contar plantões lançados enquanto ela estava desabilitada |
| `28_restaura_establishment_id_perdido_na_27.sql` | Corrige regressão das migrações 26/27: restaura a propagação de `establishment_id` para `compensatory_days` (introduzida pela migração 18) que tinha sido perdida ao reescrever `trg_recalculate_shift_balance` a partir do corpo original — quebrava a geração automática de folga a cada 21 plantões |

---

## 10. Como Rodar Localmente

```bash
# 1. Clone o repositório
git clone <url-do-repositorio>

# 2. Instale as dependências do frontend
cd "Sistema - Folga Compensatória/frontend"
npm install

# 3. Configure as variáveis de ambiente
# Crie o arquivo frontend/.env com as chaves do Supabase:
# VITE_SUPABASE_URL=...
# VITE_SUPABASE_ANON_KEY=...

# 4. Inicie o servidor de desenvolvimento
npm run dev
# Disponível em: http://localhost:5173

# 5. Para build de produção
npm run build
```

---

## 11. Histórico de Mudanças — Sprint Atual

### Commit atual inclui:

**feat: Tela de Relatórios reescrita (Relatorios.tsx)**
- 3 abas: Orçado vs. Gasto | Detalhamento por Estabelecimento | Folha por Servidor
- Filtros: Ciclo, Estabelecimento, Cargo, Nome/Matrícula do Servidor
- KPI Cards dinâmicos por aba ativa
- Exportação PDF via jsPDF + jspdf-autotable (lazy import, cabeçalho SEAP, totalizadores)
- Exportação XLSX via SheetJS com BOM UTF-8

**feat: Filtro de Ciclo no Dashboard do Estabelecimento (estabelecimento/Dashboard.tsx)**
- Visualização de ciclos históricos e atual
- Recarregamento completo de métricas, orçamento, folgas e solicitações ao trocar o ciclo
- Tratamento visual para ciclos encerrados

**feat: Reorganização de filtros no Dashboard Admin (AdminDashboard.tsx)**
- Filtro "Visualizar Ciclo" movido para barra de filtros principal
- Ordem: Visualizar Ciclo → Estabelecimento Penal → Localização
- Badge de status do ciclo selecionado permanece no header superior direito

**feat: Redesign da tela de Ciclos (admin/Ciclos.tsx)**
- Filtros de Mês e Ano gerados dinamicamente dos dados do banco
- Ordenação cronológica ascendente (Julho → Agosto)
- Correção de bug visual: gap dos cards corrigido de `var(--space-5)` para `24px`

**fix: Anti-duplicação de plantões na importação (admin/Configuracoes.tsx)**
- Substituiu `.maybeSingle()` por `.select()` completo para buscar todos os shifts
- Rollback correto do saldo_minutos somando todos os minutos_residuais antigos
- Deleção em lote com `.in('id', oldIds)` antes da nova inserção

**feat: Migração de banco — constraint UNIQUE em shifts**
- `database/09_unique_shift_employee_cycle.sql`
- `UNIQUE(employee_id, cycle_id)` garante integridade a nível de banco
- Script inclui limpeza de duplicatas pré-existentes

**feat: Tela Global de Servidores (Admin)**
- Criação da página `admin/Servidores.tsx` acessível via menu lateral
- Tabela com paginação via banco (range do Supabase) para suportar grandes volumes de dados
- Filtros implementados: Termo de busca (nome/matrícula), Estabelecimento Penal e Cargo
- Adicionado painel superior dinâmico de estatísticas (Total e Quantidade por Cargo) que reage aos filtros aplicados

**feat: Redirecionamento Inteligente de Detalhamento no Dashboard**
- Refatorado o botão de visualização (olho) na tabela do Admin Dashboard
- O botão não abre mais uma rota dedicada de unidade (Modal antigo), mas redireciona para a nova tela Global de Servidores (`/admin/servidores`) passando o ID do estabelecimento via Query Params (`?est_id=...`)
- A tela Global intercepta a Query Param e aplica automaticamente o filtro do estabelecimento
- O botão de "Gerar Relatório" individual da ação do Dashboard foi removido por redundância.

**fix: Deleção de Usuários Bloqueada por Chave Estrangeira**
- Criado script `database/12_fix_profiles_fkeys.sql` para alterar o comportamento de foreign keys.
- Modificado comportamento de deleção (ON DELETE) nas tabelas `cycles`, `shifts`, `compensatory_days`, `purchase_requests` e `audit_logs` que referenciam a tabela `profiles` para `SET NULL` ao invés de barrar a exclusão.

---

## 12. Status Atual e Pendências (atualizado em 2026-08-15)

Esta seção existe para retomar o trabalho numa sessão futura sem precisar reconstruir contexto do
zero. As seções 1-11 acima foram revisadas e atualizadas nesta data; o que segue é o que ficou
pendente ou precisa de uma decisão do usuário.

### 12.1 Refactor Kombai (Solicitar Compra + Lançamento) — implementado, NÃO mesclado

O usuário usou a extensão Kombai para começar um refactor de arquitetura das telas Solicitar
Compra e Lançamento de Plantões (hooks de dados + componentes de UI reutilizáveis:
`components/ui/{Modal,ConfirmDialog,AlertDialog,ToastProvider,Callout,Pagination,SortableTh,
TableToolbar,States}.tsx`, `hooks/useTableControls.ts`, `pages/estabelecimento/solicitacoes/
useSolicitacoesData.ts`, `pages/estabelecimento/useFolgasData.ts`) e ficou sem créditos no meio,
deixando os componentes criados mas não conectados a nenhuma tela.

Esse trabalho foi **terminado** em 2026-08-15 (via `subagent-driven-development`, 12 tasks + 1
rodada de correção pós-revisão), mas vive isolado num worktree que **ainda não foi mesclado nem
enviado ao GitHub**: `.worktrees/solicitar-compra-lancamento-refactor`, branch
`sdd/solicitar-compra-lancamento-refactor`, criado a partir de `main@c65ca85`. Ver o STATUS no topo
de `docs/superpowers/plans/2026-08-14-solicitar-compra-lancamento-refactor.md` (dentro do worktree)
para a lista completa de bugs corrigidos durante a execução.

**Importante:** as 3 correções feitas em `main` em 2026-08-15 (seções 6.6b, 6.7, 6.8 acima —
recarregar orçamento antes do submit, saldo real no Simulador, modais padronizados em Solicitar
Compra) foram aplicadas **só no `main`**, não no worktree do refactor. Se/quando o refactor for
mesclado, essas 3 correções precisam ser conferidas/replicadas em `useFolgasData.ts`/
`useSolicitacoesData.ts`, ou serão perdidas.

**Decisão pendente do usuário:** mesclar localmente / abrir PR / manter como está. Não decidido até
o momento desta documentação — perguntar de novo antes de agir, não assumir.

### 12.2 Lacunas conhecidas, não corrigidas (ver memória `gaps-logica-ciclos`)

1. Orçamento/cotas (`cycle_establishments.total_orcado`, `planning_limits`) não têm trava de
   "ciclo fechado" no banco — só proteção de UI.
2. O trigger de "ciclo fechado" cobre INSERT/UPDATE, não DELETE, em `shifts`/`compensatory_days`/
   `purchase_requests`.
3. O modal "Encerrar Ciclo" (`admin/Ciclos.tsx`) promete rejeitar automaticamente solicitações
   pendentes, mas isso não está implementado — ficam presas em `SOLICITADA`.
4. Status `EM_ANALISE` do enum de ciclo é morto (nunca usado no código).
5. RLS de `employees` não cobre servidores transferidos (detalhado na seção 5.6 acima).

### 12.3 Changelog de 2026-08-15 (sessão atual)

- **Investigação de card de orçamento negativo em Folgas.tsx:** 2 `purchase_requests` de teste
  com valor acima do orçamento foram apagadas; mecanismo exato de como burlaram a trava do banco
  ficou sem causa raiz confirmada (trigger testado e comprovado robusto em testes concorrentes).
  Como mitigação, `Folgas.tsx` passou a reconferir o orçamento com uma busca fresca imediatamente
  antes do submit (commit `9a9b9ec`).
- **Diálogos nativos → modal padrão em `Solicitacoes.tsx`** (commit `383b381`): os 16 pontos que
  usavam `alert()`/`window.prompt()` foram convertidos para `infoModal`/`confirmAction`; o fluxo de
  rejeição ganhou um campo de motivo dentro do próprio modal.
- **Simulador usa saldo real** (commit `81e586e`): passou a descontar `APROVADA`+`SOLICITADA` do
  teto planejado, em vez de simular sempre contra o orçamento cheio.
- **Limpeza de dados de teste:** as 40 `purchase_requests` (todas `CANCELADA`) da unidade
  "Unidade Teste" (`establishment_id 7f44a19e-798f-4fb7-8404-51ab4409adf5`) foram apagadas do
  banco, a pedido do usuário, após confirmação do escopo. Nenhuma outra unidade foi afetada.
- Os 10 commits pendentes (incluindo os 3 acima) foram enviados ao GitHub (`origin/main`,
  `bbd428e..81e586e`).
- Esta seção 12 e as seções 3.2, 5.6, 6.6b, 6.7, 6.8, 7 e 9 foram escritas/atualizadas nesta sessão
  para cobrir o que estava desatualizado desde antes dela (documentação parava na migração 12).

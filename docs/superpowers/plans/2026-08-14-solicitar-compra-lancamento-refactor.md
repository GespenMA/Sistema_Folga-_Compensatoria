# Finalizar Refactor Kombai (Solicitar Compra + Lançamento de Plantões) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate `Solicitacoes.tsx` and `Folgas.tsx` (estabelecimento module) to the hook-of-data + shared-`components/ui/` architecture the Kombai extension started, preserving 100% of current behavior.

**Architecture:** Each screen keeps a data/mutation hook (`useSolicitacoesData`, `useFolgasData`) that owns every Supabase call and never throws/alerts — mutations return `ActionResult`. The page component renders hook state and shared UI primitives (`Modal`, `ConfirmDialog`, `AlertDialog`, `useToast`, `Callout`, `Pagination`, `SortableTh`, `TableToolbar`, `useTableControls`) and decides when to block an action (comparing `budget.disponivelParaLancamento`/`disponivelParaAprovacao` against a value before enabling submit).

**Tech Stack:** React 18 + TypeScript, Vite, Supabase JS, no test framework in this project — verification is `npm run build` (tsc + vite) plus manual browser testing against the running dev server, per established project convention.

**Spec:** `docs/superpowers/specs/2026-08-14-solicitar-compra-lancamento-refactor-design.md`

## Global Constraints

- Behavior must match the current app 1:1 — this is an architecture migration, not a UX redesign (spec: "Objetivo").
- `budget`/orçamento numbers always come from the `total_orçado` value stored in `cycle_establishments`, never recomputed from current `position_values` prices (spec: "Comportamento que precisa sobreviver 1:1", item 1-2; this rule was the actual bug fixed earlier this session).
- Justificativa: 50–1000 characters everywhere it's collected (spec item 3).
- `admin/Solicitacoes.tsx` and the rest of the admin module are out of scope — do not touch them (spec: "Fora de escopo").
- No automated tests are being introduced as part of this refactor (spec: "Fora de escopo"). Every task's manual verification section replaces a test suite.
- Run `npm run build` after every task before moving on. If it fails, fix before continuing — never leave a task on a broken build.
- One deliberate behavior improvement is called out explicitly where it happens (Task 4): reuse the already-fetched cargo price at Plantão Plus submit time instead of re-fetching it, matching how `Solicitacoes.tsx`/`useSolicitacoesData` already do it. This removes a latent (today, harmless) inconsistency where the previewed price and the submitted price could theoretically differ if a price changed between opening the modal and submitting.

---

### Task 1: Mount ToastProvider for the Estabelecimento module

**Files:**
- Modify: `frontend/src/layouts/EstabelecimentoLayout.tsx`

**Interfaces:**
- Consumes: `ToastProvider` from `frontend/src/components/ui/ToastProvider.tsx` (already exists, exports `ToastProvider` and `useToast`).
- Produces: `useToast()` becomes callable from any component rendered under `EstabelecimentoLayout` (i.e., every `/estabelecimento/*` route, including `Folgas.tsx` and `Solicitacoes.tsx` in later tasks).

- [ ] **Step 1: Read the current layout to find the exact wrapping point**

Run: read `frontend/src/layouts/EstabelecimentoLayout.tsx` and locate the element that wraps `<Outlet />` (or equivalent routed-content placeholder). Note its exact surrounding JSX so the edit below matches verbatim.

- [ ] **Step 2: Add the import**

At the top of `frontend/src/layouts/EstabelecimentoLayout.tsx`, add:

```tsx
import { ToastProvider } from '../components/ui/ToastProvider';
```

- [ ] **Step 3: Wrap the routed content**

Find the element that renders `<Outlet />` (React Router's placeholder for the active child route — this is what renders `Folgas`/`Solicitacoes`/etc.). Wrap only that `<Outlet />` (not the whole layout, not the sidebar/nav) with `<ToastProvider>`:

```tsx
<ToastProvider>
  <Outlet />
</ToastProvider>
```

If the codebase renders children via `{children}` instead of `<Outlet />`, wrap that instead — same principle: only the routed page content, not the persistent chrome (sidebar, header).

- [ ] **Step 4: Verify the build**

Run: `cd "c:/Projetos/SEAP/Sistema - Folga Compensatória/frontend" && npm run build`
Expected: succeeds with no new TypeScript errors.

- [ ] **Step 5: Manual verification**

With the dev server running, open any `/estabelecimento/*` page (e.g., `/estabelecimento/folgas`) in the browser. Expected: page renders exactly as before — `ToastProvider` renders nothing visible until a toast is triggered (no toast exists yet at this point in the plan, since nothing calls `useToast()` yet).

- [ ] **Step 6: Commit**

```bash
cd "c:/Projetos/SEAP/Sistema - Folga Compensatória"
git add frontend/src/layouts/EstabelecimentoLayout.tsx
git commit -m "feat: monta ToastProvider no layout do estabelecimento"
```

---

### Task 2: Create the Folgas.tsx data layer (types.ts + useFolgasData.ts)

**Files:**
- Create: `frontend/src/pages/estabelecimento/folgas/types.ts`
- Create: `frontend/src/pages/estabelecimento/folgas/useFolgasData.ts`

**Interfaces:**
- Consumes: `supabase` from `../../../lib/supabase`, `formatBRL`/nothing else needed here from `../../../utils/format`.
- Produces (used by Task 3 and Task 4):
  - `type Employee`, `type ActiveCycle`, `type Budget`, `type ActionResult`, `type EmployeeDetails` (from `types.ts`)
  - `useFolgasData(establishmentId?: string, userId?: string): FolgasData` where `FolgasData` exposes: `loading`, `error`, `reload()`, `activeCycle`, `employees`, `plusPendentes`, `budget`, `fetchValorCargo(positionId)`, `fetchEmployeeDetails(employeeId)`, `lancarPlantaoPlus(input)`.

- [ ] **Step 1: Write `types.ts`**

Create `frontend/src/pages/estabelecimento/folgas/types.ts`:

```ts
export type CycleStatus = 'RASCUNHO' | 'ABERTO' | 'FECHADO' | 'REABERTO';

export type Position = {
  nome: string;
  codigo: string;
};

export type Employee = {
  id: string;
  nome: string;
  matricula: string;
  saldo_plantoes: number;
  saldo_minutos?: number;
  position_id: string;
  positions?: Position;
  compensatory_days?: { id: string; status: string }[];
  folgasDisponiveis?: number;
};

export type ActiveCycle = {
  id: string;
  nome: string;
  data_inicio: string;
  data_fim: string;
  status: CycleStatus;
};

export type Budget = {
  orcado: number;
  aprovado: number;
  pendente: number;
  /** orçado − aprovado − pendente: the ceiling for LAUNCHING a new Plantão Plus. */
  disponivelParaLancamento: number;
};

export type ActionResult =
  | { ok: true }
  | { ok: false; message: string };

export type ShiftDetail = {
  id: string;
  periodo_inicio: string;
  periodo_fim: string;
  quantidade_plantoes: number;
  observacao: string | null;
  created_at: string;
  minutos_residuais: number | null;
  cycles: { nome: string } | null;
};

export type FolgaDetail = {
  id: string;
  status: string;
  periodo_inicio: string;
  periodo_fim: string;
  quantidade_plantoes: number;
  generated_at: string;
  used_at: string | null;
  cycles: { nome: string } | null;
  purchase_requests: { data_plantao: string | null } | { data_plantao: string | null }[] | null;
};

export type PlusRequestDetail = {
  id: string;
  tipo_solicitacao: string;
  data_plantao: string | null;
  valor: number;
  status: string;
  justificativa: string;
  requested_at: string;
};

export type EmployeeDetails = {
  shifts: ShiftDetail[];
  folgas: FolgaDetail[];
  plusRequests: PlusRequestDetail[];
};
```

- [ ] **Step 2: Write `useFolgasData.ts`**

Create `frontend/src/pages/estabelecimento/folgas/useFolgasData.ts`:

```ts
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import type {
  ActionResult,
  ActiveCycle,
  Budget,
  Employee,
  EmployeeDetails,
} from './types';

const EMPLOYEE_SELECT =
  'id, nome, matricula, saldo_plantoes, saldo_minutos, position_id, positions(nome, codigo), compensatory_days(id, status)';

/** Supabase rejects with plain objects, not Error instances — handle both. */
const errorMessageOf = (error: unknown): string => {
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: unknown }).message ?? '');
  }
  return '';
};

const readableError = (error: unknown, fallback: string): string => {
  const message = errorMessageOf(error);
  if (message.includes('financeiro insuficiente')) {
    return 'Orçamento insuficiente para lançar este Plantão Plus.';
  }
  if (message.includes('Limite quantitativo')) {
    return 'O limite planejado de plantões extras/folgas para este cargo já foi atingido.';
  }
  return message || fallback;
};

export type FolgasData = {
  loading: boolean;
  error: string | null;
  reload: () => void;
  activeCycle: ActiveCycle | null;
  employees: Employee[];
  /** employee_id → count of SOLICITADA Plantão Plus requests, for the card badge. */
  plusPendentes: Record<string, number>;
  budget: Budget;
  fetchValorCargo: (positionId: string) => Promise<{ id: string; valor: number } | null>;
  fetchEmployeeDetails: (employeeId: string) => Promise<EmployeeDetails>;
  lancarPlantaoPlus: (input: {
    employeeId: string;
    dataPlantao: string;
    justificativa: string;
    valorUnitario: number;
    valorHistoricoId: string;
  }) => Promise<ActionResult>;
};

/**
 * All Supabase access for the "Lançamento de Plantões" screen. The page stays a
 * view: it renders state and forwards intent, and the mutation answers with an
 * ActionResult instead of throwing or calling alert()/toast() itself.
 */
export const useFolgasData = (establishmentId?: string, userId?: string): FolgasData => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCycle, setActiveCycle] = useState<ActiveCycle | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [plusPendentes, setPlusPendentes] = useState<Record<string, number>>({});
  const [orcado, setOrcado] = useState(0);
  const [aprovado, setAprovado] = useState(0);
  const [pendente, setPendente] = useState(0);

  const requestIdRef = useRef(0);

  const fetchAll = useCallback(
    async (showLoading: boolean) => {
      if (!establishmentId) return;
      requestIdRef.current += 1;
      const requestId = requestIdRef.current;
      const isCurrent = () => requestId === requestIdRef.current;

      if (showLoading) setLoading(true);
      setError(null);

      try {
        const { data: cycleData, error: cycleError } = await supabase
          .from('cycles')
          .select('id, nome, data_inicio, data_fim, status')
          .in('status', ['ABERTO', 'REABERTO'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (cycleError) throw cycleError;
        if (!isCurrent()) return;

        if (!cycleData) {
          setActiveCycle(null);
          setEmployees([]);
          setPlusPendentes({});
          setOrcado(0);
          setAprovado(0);
          setPendente(0);
          return;
        }

        const cycle = cycleData as ActiveCycle;
        setActiveCycle(cycle);

        const [empRes, plusRes, ceRes, comprometidosRes] = await Promise.all([
          supabase
            .from('employees')
            .select(EMPLOYEE_SELECT)
            .eq('establishment_id', establishmentId)
            .eq('ativo', true)
            .order('nome'),
          supabase
            .from('purchase_requests')
            .select('employee_id')
            .eq('establishment_id', establishmentId)
            .eq('tipo_solicitacao', 'PLANTAO_PLUS')
            .eq('status', 'SOLICITADA'),
          supabase
            .from('cycle_establishments')
            .select('total_orcado')
            .eq('cycle_id', cycle.id)
            .eq('establishment_id', establishmentId)
            .maybeSingle(),
          supabase
            .from('purchase_requests')
            .select('valor, status')
            .eq('cycle_id', cycle.id)
            .eq('establishment_id', establishmentId)
            .in('status', ['SOLICITADA', 'APROVADA']),
        ]);

        const firstError = empRes.error ?? plusRes.error ?? ceRes.error ?? comprometidosRes.error;
        if (firstError) throw firstError;
        if (!isCurrent()) return;

        const parsedEmployees = (empRes.data ?? []).map((emp: any) => ({
          ...emp,
          folgasDisponiveis:
            emp.compensatory_days?.filter((f: any) => f.status === 'GERADA').length ?? 0,
        }));
        setEmployees(parsedEmployees as Employee[]);

        const counts: Record<string, number> = {};
        (plusRes.data ?? []).forEach((row: any) => {
          counts[row.employee_id] = (counts[row.employee_id] ?? 0) + 1;
        });
        setPlusPendentes(counts);

        setOrcado(Number(ceRes.data?.total_orcado ?? 0));
        const comprometidos = comprometidosRes.data ?? [];
        setAprovado(
          comprometidos
            .filter((r: any) => r.status === 'APROVADA')
            .reduce((total: number, r: any) => total + Number(r.valor), 0),
        );
        setPendente(
          comprometidos
            .filter((r: any) => r.status === 'SOLICITADA')
            .reduce((total: number, r: any) => total + Number(r.valor), 0),
        );
      } catch (err) {
        if (!isCurrent()) return;
        setError(readableError(err, 'Falha de comunicação com o servidor. Verifique sua conexão.'));
      } finally {
        if (isCurrent()) setLoading(false);
      }
    },
    [establishmentId],
  );

  useEffect(() => {
    if (!establishmentId) return;
    void fetchAll(true);
  }, [establishmentId, fetchAll]);

  const reload = useCallback(() => {
    void fetchAll(true);
  }, [fetchAll]);

  const refreshQuietly = useCallback(() => fetchAll(false), [fetchAll]);

  const budget = useMemo<Budget>(
    () => ({
      orcado,
      aprovado,
      pendente,
      disponivelParaLancamento: orcado - aprovado - pendente,
    }),
    [orcado, aprovado, pendente],
  );

  const fetchValorCargo = useCallback(async (positionId: string) => {
    const { data, error: valorError } = await supabase
      .from('position_values')
      .select('id, valor')
      .eq('position_id', positionId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (valorError || !data) return null;
    return { id: data.id as string, valor: Number(data.valor) };
  }, []);

  const fetchEmployeeDetails = useCallback(async (employeeId: string): Promise<EmployeeDetails> => {
    const [shiftsRes, folgasRes, plusRes] = await Promise.all([
      supabase
        .from('shifts')
        .select(
          'id, periodo_inicio, periodo_fim, quantidade_plantoes, observacao, created_at, minutos_residuais, cycles(nome)',
        )
        .eq('employee_id', employeeId)
        .order('created_at', { ascending: false }),
      supabase
        .from('compensatory_days')
        .select(
          'id, status, periodo_inicio, periodo_fim, quantidade_plantoes, generated_at, used_at, cycles(nome), purchase_requests(data_plantao)',
        )
        .eq('employee_id', employeeId)
        .order('generated_at', { ascending: false }),
      supabase
        .from('purchase_requests')
        .select('id, tipo_solicitacao, data_plantao, valor, status, justificativa, requested_at')
        .eq('employee_id', employeeId)
        .eq('tipo_solicitacao', 'PLANTAO_PLUS')
        .order('requested_at', { ascending: false }),
    ]);

    return {
      shifts: (shiftsRes.data ?? []) as EmployeeDetails['shifts'],
      folgas: (folgasRes.data ?? []) as EmployeeDetails['folgas'],
      plusRequests: (plusRes.data ?? []) as EmployeeDetails['plusRequests'],
    };
  }, []);

  const hasConflictingRequest = useCallback(async (employeeId: string, dataPlantao: string) => {
    const { data } = await supabase
      .from('purchase_requests')
      .select('id')
      .eq('employee_id', employeeId)
      .eq('data_plantao', dataPlantao)
      .neq('status', 'REJEITADA')
      .neq('status', 'CANCELADA')
      .limit(1);

    return Boolean(data && data.length > 0);
  }, []);

  const lancarPlantaoPlus = useCallback<FolgasData['lancarPlantaoPlus']>(
    async ({ employeeId, dataPlantao, justificativa, valorUnitario, valorHistoricoId }) => {
      if (!activeCycle || !establishmentId || !userId) {
        return { ok: false, message: 'Sessão inválida. Recarregue a página e tente novamente.' };
      }

      try {
        if (await hasConflictingRequest(employeeId, dataPlantao)) {
          return {
            ok: false,
            message: 'Este servidor já possui uma solicitação de plantão para esta mesma data.',
          };
        }

        const { error: insertError } = await supabase.from('purchase_requests').insert([
          {
            tipo_solicitacao: 'PLANTAO_PLUS',
            data_plantao: dataPlantao,
            establishment_id: establishmentId,
            cycle_id: activeCycle.id,
            employee_id: employeeId,
            position_id: employees.find((e) => e.id === employeeId)?.position_id,
            valor: valorUnitario,
            valor_historico_id: valorHistoricoId,
            justificativa,
            requested_by: userId,
          },
        ]);
        if (insertError) throw insertError;

        await refreshQuietly();
        return { ok: true };
      } catch (err) {
        return { ok: false, message: readableError(err, 'Erro ao registrar Plantão Plus.') };
      }
    },
    [activeCycle, establishmentId, userId, employees, hasConflictingRequest, refreshQuietly],
  );

  return {
    loading,
    error,
    reload,
    activeCycle,
    employees,
    plusPendentes,
    budget,
    fetchValorCargo,
    fetchEmployeeDetails,
    lancarPlantaoPlus,
  };
};
```

- [ ] **Step 3: Verify the build**

Run: `cd "c:/Projetos/SEAP/Sistema - Folga Compensatória/frontend" && npm run build`
Expected: succeeds. These two files are not imported anywhere yet, so this only checks they compile in isolation.

- [ ] **Step 4: Commit**

```bash
cd "c:/Projetos/SEAP/Sistema - Folga Compensatória"
git add frontend/src/pages/estabelecimento/folgas/types.ts frontend/src/pages/estabelecimento/folgas/useFolgasData.ts
git commit -m "feat: cria hook de dados useFolgasData para Lancamento de Plantoes"
```

---

### Task 3: Wire useFolgasData + useToast into Folgas.tsx (data/mutation layer)

**Files:**
- Modify: `frontend/src/pages/estabelecimento/Folgas.tsx`

**Interfaces:**
- Consumes: `useFolgasData` from `./folgas/useFolgasData` (Task 2), `useToast` from `../../components/ui/ToastProvider` (already exists; Task 1 mounted the provider).
- Produces: `activeCycle`, `employees`, `plusPendentes`, `loading` keep their current names/shapes for the JSX in Task 4 to consume unchanged. `orcamentoDisponivel` keeps its current name (now aliased from `budget.disponivelParaLancamento`) so every existing JSX reference to `orcamentoDisponivel` in this file keeps working without further edits.

This task only touches the top portion of the file (imports through `handleSavePlus`, roughly lines 1–335 of the current file) plus the `openDetailsModal` function and the toast JSX block at the bottom. The card grid, KPI cards, pagination controls, and both modals' JSX are untouched here — those move to shared components in Task 4.

- [ ] **Step 1: Replace the imports**

Old:
```tsx
import React, { useEffect, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

type Employee = {
  id: string;
  nome: string;
  matricula: string;
  saldo_plantoes: number;
  saldo_minutos?: number;
  position_id: string;
  positions?: { nome: string; codigo: string };
  compensatory_days?: { id: string; status: string }[];
  folgasDisponiveis?: number;
};

export const Folgas: React.FC = () => {
```

New:
```tsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../components/ui/ToastProvider';
import { useFolgasData } from './folgas/useFolgasData';
import type { Employee, EmployeeDetails } from './folgas/types';

export const Folgas: React.FC = () => {
```

(The local `Employee` type is now imported from `./folgas/types` instead of declared inline — it is structurally identical to the one already in this file, so no other reference in the component needs to change. `supabase` stays imported — Task 4's `openDetailsModal` rewrite still needs it removed once nothing in this file calls Supabase directly. Leave the import for now; Step 6 below removes the last direct Supabase usage in this task, but the details-drawer fetch — `fetchEmployeeDetails` — already goes through the hook. After this task, `supabase` is unused in this file; delete that import in this same step's final check.)

- [ ] **Step 2: Replace the top-of-component state block**

Old (everything from `const { profile }` through the `plusValorPreview` useEffect, i.e. current lines 19–117):
```tsx
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [activeCycle, setActiveCycle] = useState<any>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal Detalhes Servidor
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [detailShifts, setDetailShifts] = useState<any[]>([]);
  const [detailFolgas, setDetailFolgas] = useState<any[]>([]);
  const [detailPlusRequests, setDetailPlusRequests] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [detailTab, setDetailTab] = useState<'folgas' | 'plantoes' | 'plus'>('folgas');

  // Modal Plantão Plus
  const [isPlusModalOpen, setIsPlusModalOpen] = useState(false);
  const [plusEmployeeId, setPlusEmployeeId] = useState('');
  const [plusSearchTerm, setPlusSearchTerm] = useState('');
  const [plusDataPlantao, setPlusDataPlantao] = useState('');
  const [plusJustificativa, setPlusJustificativa] = useState('');
  const [isSubmittingPlus, setIsSubmittingPlus] = useState(false);
  const [plusValorPreview, setPlusValorPreview] = useState<number | null>(null);

  // Orçamento da unidade (para bloquear o lançamento quando não houver orçamento
  // suficiente já considerando o que está Aprovado + Aguardando Aprovação — mesmo
  // cálculo que o banco usa para liberar a CRIAÇÃO de uma solicitação)
  const [totalOrcado, setTotalOrcado] = useState(0);
  const [totalAprovado, setTotalAprovado] = useState(0);
  const [totalPendente, setTotalPendente] = useState(0);
  const orcamentoDisponivel = totalOrcado - totalAprovado - totalPendente;

  // Filtros e busca
  const [busca, setBusca] = useState('');
  const [ordemSaldos, setOrdemSaldos] = useState('nome_asc');
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'com_folga' | 'acumulando'>('todos');
  const [filtroCargoId, setFiltroCargoId] = useState('');

  // Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 24;

  useEffect(() => {
    setCurrentPage(1);
  }, [busca, filtroCargoId, filtroStatus, ordemSaldos]);

  // Toast de notificação
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'warning' } | null>(null);
  const toastTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Plantões Plus pendentes por employee (para badge nos cards)
  const [plusPendentes, setPlusPendentes] = useState<Record<string, number>>({});



  const showToast = useCallback((msg: string, type: 'success' | 'error' | 'warning' = 'success') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ msg, type });
    toastTimerRef.current = setTimeout(() => setToast(null), 4000);
  }, []);

  // Fechar modais com ESC
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsDetailsModalOpen(false);
        setIsPlusModalOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (profile?.establishment_id) {
      fetchInitialData();
    }
  }, [profile?.establishment_id]);

  // Prévia do valor do lançamento assim que o servidor é escolhido no modal de Plantão Plus
  useEffect(() => {
    if (!plusEmployeeId) { setPlusValorPreview(null); return; }
    const emp = employees.find(e => e.id === plusEmployeeId);
    if (!emp || !emp.position_id) { setPlusValorPreview(null); return; }

    let cancelado = false;
    supabase
      .from('position_values')
      .select('valor')
      .eq('position_id', emp.position_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelado) setPlusValorPreview(data ? Number(data.valor) : null);
      });

    return () => { cancelado = true; };
  }, [plusEmployeeId, employees]);
```

New:
```tsx
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { showToast: showToastRaw, success, error: toastErrorFn } = useToast();
  const {
    loading,
    activeCycle,
    employees,
    plusPendentes,
    budget,
    fetchValorCargo,
    fetchEmployeeDetails,
    lancarPlantaoPlus,
  } = useFolgasData(profile?.establishment_id, profile?.id);
  const orcamentoDisponivel = budget.disponivelParaLancamento;

  // Modal Detalhes Servidor
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [employeeDetails, setEmployeeDetails] = useState<EmployeeDetails>({ shifts: [], folgas: [], plusRequests: [] });
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [detailTab, setDetailTab] = useState<'folgas' | 'plantoes' | 'plus'>('folgas');

  // Modal Plantão Plus
  const [isPlusModalOpen, setIsPlusModalOpen] = useState(false);
  const [plusEmployeeId, setPlusEmployeeId] = useState('');
  const [plusSearchTerm, setPlusSearchTerm] = useState('');
  const [plusDataPlantao, setPlusDataPlantao] = useState('');
  const [plusJustificativa, setPlusJustificativa] = useState('');
  const [isSubmittingPlus, setIsSubmittingPlus] = useState(false);
  const [plusValorPreview, setPlusValorPreview] = useState<{ id: string; valor: number } | null>(null);

  // Filtros e busca
  const [busca, setBusca] = useState('');
  const [ordemSaldos, setOrdemSaldos] = useState('nome_asc');
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'com_folga' | 'acumulando'>('todos');
  const [filtroCargoId, setFiltroCargoId] = useState('');

  // Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 24;

  useEffect(() => {
    setCurrentPage(1);
  }, [busca, filtroCargoId, filtroStatus, ordemSaldos]);

  const showToast = (msg: string, type: 'success' | 'error' | 'warning' = 'success') => {
    if (type === 'success') return success(msg);
    if (type === 'error') return toastErrorFn(msg);
    return showToastRaw({ tone: 'warning', message: msg });
  };

  // Fechar modais com ESC
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsDetailsModalOpen(false);
        setIsPlusModalOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Prévia do valor do lançamento assim que o servidor é escolhido no modal de Plantão Plus
  useEffect(() => {
    if (!plusEmployeeId) { setPlusValorPreview(null); return; }
    const emp = employees.find(e => e.id === plusEmployeeId);
    if (!emp || !emp.position_id) { setPlusValorPreview(null); return; }

    let cancelado = false;
    fetchValorCargo(emp.position_id).then((posVal) => {
      if (!cancelado) setPlusValorPreview(posVal);
    });

    return () => { cancelado = true; };
  }, [plusEmployeeId, employees, fetchValorCargo]);
```

Note: `plusValorPreview` changes shape from `number | null` to `{ id: string; valor: number } | null` — this is required so `handleSavePlus` (Step 4 below) can submit the exact `valor_historico_id` that was already fetched for the preview, instead of re-querying `position_values` a second time at submit (see the Global Constraints note on this deliberate improvement). Every JSX reference to `plusValorPreview` as a number (the budget comparison banner in Task 4) becomes `plusValorPreview.valor`.

- [ ] **Step 3: Delete `fetchInitialData`, `fetchOrcamento`, `fetchEmployees`**

Delete these three function definitions in full (current lines 119–204):
```tsx
  const fetchInitialData = async () => { ... };
  const fetchOrcamento = async (cycleId: string) => { ... };
  const fetchEmployees = async () => { ... };
```
They are fully replaced by `useFolgasData`.

- [ ] **Step 4: Rewrite `openDetailsModal`**

Old:
```tsx
  const openDetailsModal = async (emp: Employee) => {
    setSelectedEmployee(emp);
    setDetailTab('plantoes');
    setDetailShifts([]);
    setDetailFolgas([]);
    setDetailPlusRequests([]);
    setIsDetailsModalOpen(true);
    setLoadingHistory(true);
    try {
      // Busca plantões do servidor (todas as entradas de saldo)
      const { data: shiftsData } = await supabase
        .from('shifts')
        .select('id, periodo_inicio, periodo_fim, quantidade_plantoes, observacao, created_at, minutos_residuais, cycles(nome)')
        .eq('employee_id', emp.id)
        .order('created_at', { ascending: false });
      if (shiftsData) setDetailShifts(shiftsData);

      // Busca folgas geradas
      const { data: folgasData } = await supabase
        .from('compensatory_days')
        .select('id, status, periodo_inicio, periodo_fim, quantidade_plantoes, generated_at, used_at, cycles(nome), purchase_requests(data_plantao)')
        .eq('employee_id', emp.id)
        .order('generated_at', { ascending: false });
      if (folgasData) setDetailFolgas(folgasData);

      // Busca Plantão Plus
      const { data: plusData } = await supabase
        .from('purchase_requests')
        .select('id, tipo_solicitacao, data_plantao, valor, status, justificativa, requested_at')
        .eq('employee_id', emp.id)
        .eq('tipo_solicitacao', 'PLANTAO_PLUS')
        .order('requested_at', { ascending: false });
      if (plusData) setDetailPlusRequests(plusData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingHistory(false);
    }
  };
```

New:
```tsx
  const openDetailsModal = async (emp: Employee) => {
    setSelectedEmployee(emp);
    setDetailTab('plantoes');
    setEmployeeDetails({ shifts: [], folgas: [], plusRequests: [] });
    setIsDetailsModalOpen(true);
    setLoadingHistory(true);
    try {
      const details = await fetchEmployeeDetails(emp.id);
      setEmployeeDetails(details);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingHistory(false);
    }
  };
```

Every JSX reference to `detailShifts`/`detailFolgas`/`detailPlusRequests` (in the details-drawer JSX, untouched by this task — it lives further down the file) becomes `employeeDetails.shifts`/`employeeDetails.folgas`/`employeeDetails.plusRequests`. Do this replacement now even though the surrounding JSX isn't otherwise touched until Task 4 — search the file for `detailShifts`, `detailFolgas`, `detailPlusRequests` and rename each occurrence to the `employeeDetails.*` equivalent (there are 3 map-callsites and a few `.length` checks; all three are in the "Modal Detalhes Servidor" drawer JSX, in the `plantoes`/`folgas`/`plus` tab bodies).

- [ ] **Step 5: Rewrite `handleSavePlus`**

Old:
```tsx
  const handleSavePlus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.establishment_id || !activeCycle) return;

    if (plusDataPlantao > activeCycle.data_fim) {
      showToast(`A data do plantão não pode ultrapassar o encerramento do ciclo atual.`, 'warning');
      return;
    }
    if (plusJustificativa.length < 50) {
      showToast('A justificativa precisa ter pelo menos 50 caracteres.', 'warning');
      return;
    }
    if (plusValorPreview !== null && plusValorPreview > orcamentoDisponivel) {
      showToast(`Orçamento insuficiente — faltam R$ ${(plusValorPreview - orcamentoDisponivel).toFixed(2)}.`, 'error');
      return;
    }

    setIsSubmittingPlus(true);

    try {
      const emp = employees.find(e => e.id === plusEmployeeId);
      if (!emp || !emp.position_id) throw new Error("Cargo do servidor não encontrado.");

      const { data: posVal } = await supabase
        .from('position_values')
        .select('id, valor')
        .eq('position_id', emp.position_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
        
      if (!posVal) throw new Error("Não há valor financeiro configurado para o cargo deste servidor.");

      // VERIFICAÇÃO DE DATA DUPLICADA: Impede compra na mesma data
      const { data: existingPlus } = await supabase
        .from('purchase_requests')
        .select('id')
        .eq('employee_id', emp.id)
        .eq('data_plantao', plusDataPlantao)
        .neq('status', 'REJEITADA')
        .neq('status', 'CANCELADA')
        .limit(1);

      if (existingPlus && existingPlus.length > 0) {
        showToast('Este servidor já possui uma solicitação de plantão para esta mesma data.', 'warning');
        setIsSubmittingPlus(false);
        return;
      }

      const { error } = await supabase.from('purchase_requests')
        .insert([{
          tipo_solicitacao: 'PLANTAO_PLUS',
          data_plantao: plusDataPlantao,
          establishment_id: profile.establishment_id,
          cycle_id: activeCycle.id,
          employee_id: emp.id,
          position_id: emp.position_id,
          valor: posVal.valor,
          valor_historico_id: posVal.id,
          justificativa: plusJustificativa,
          requested_by: profile.id
        }]);
      
      if (error) {
         if (error.message.includes('financeiro insuficiente')) {
             showToast('Orçamento insuficiente para lançar este Plantão Plus.', 'error');
         } else if (error.message.includes('Limite quantitativo')) {
             showToast('O limite planejado de plantões extras/folgas para este cargo já foi atingido.', 'error');
         } else {
             throw error;
         }
         return;
      }

      setIsPlusModalOpen(false);
      showToast('Plantão Plus registrado e enviado para aprovação!', 'success');
      await fetchEmployees(); // Refetch para atualizar badges e dados
    } catch (err: any) {
      showToast(err.message || 'Erro ao registrar Plantão Plus.', 'error');
    } finally {
      setIsSubmittingPlus(false);
    }
  };
```

New:
```tsx
  const handleSavePlus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.establishment_id || !activeCycle) return;

    if (plusDataPlantao > activeCycle.data_fim) {
      showToast(`A data do plantão não pode ultrapassar o encerramento do ciclo atual.`, 'warning');
      return;
    }
    if (plusJustificativa.length < 50) {
      showToast('A justificativa precisa ter pelo menos 50 caracteres.', 'warning');
      return;
    }
    if (plusValorPreview !== null && plusValorPreview.valor > orcamentoDisponivel) {
      showToast(`Orçamento insuficiente — faltam R$ ${(plusValorPreview.valor - orcamentoDisponivel).toFixed(2)}.`, 'error');
      return;
    }
    if (!plusValorPreview) {
      showToast('Não há valor financeiro configurado para o cargo deste servidor.', 'error');
      return;
    }

    setIsSubmittingPlus(true);
    const result = await lancarPlantaoPlus({
      employeeId: plusEmployeeId,
      dataPlantao: plusDataPlantao,
      justificativa: plusJustificativa,
      valorUnitario: plusValorPreview.valor,
      valorHistoricoId: plusValorPreview.id,
    });
    setIsSubmittingPlus(false);

    if (!result.ok) {
      showToast(result.message, 'error');
      return;
    }

    setIsPlusModalOpen(false);
    showToast('Plantão Plus registrado e enviado para aprovação!', 'success');
  };
```

- [ ] **Step 6: Remove the now-unused `supabase` import and the hand-rolled toast JSX block**

Confirm no remaining reference to `supabase.` exists in the file (Steps 3–5 removed the last three); if none remain, delete the line `import { supabase } from '../../lib/supabase';`.

Find the toast JSX block (currently right after the opening `<div style={{ position: 'relative' }}>` in the return statement):
```tsx
      {/* ─── Toast de Notificação ──────────────────────── */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: '28px', right: '28px', zIndex: 9999,
          padding: '14px 20px', borderRadius: '10px', maxWidth: '380px',
          display: 'flex', alignItems: 'center', gap: '10px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
          animation: 'slideInRight 0.25s ease',
          background: toast.type === 'success' ? '#10b981' : toast.type === 'error' ? '#ef4444' : '#eab308',
          color: 'white',
        }}>
          <span style={{ fontSize: '18px', flexShrink: 0 }}>
            {toast.type === 'success' ? '✅' : toast.type === 'error' ? '❌' : '⚠️'}
          </span>
          <span style={{ fontSize: '13px', fontWeight: 600, lineHeight: 1.4 }}>{toast.msg}</span>
          <button
            onClick={() => setToast(null)}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '16px', opacity: 0.8, flexShrink: 0 }}
          >×</button>
        </div>
      )}

      <style>{`
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(40px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
```

Replace with just the keyframes `<style>` block (the toast markup itself is now rendered by `ToastProvider`, mounted in Task 1; `fadeInUp` is still used by the card grid animation further down, so keep it):
```tsx
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
```

- [ ] **Step 7: Verify the build**

Run: `cd "c:/Projetos/SEAP/Sistema - Folga Compensatória/frontend" && npm run build`
Expected: succeeds. If TypeScript complains about `detailShifts`/`detailFolgas`/`detailPlusRequests` still being referenced somewhere, that reference was missed in Step 4 — find it and rename to `employeeDetails.*`.

- [ ] **Step 8: Manual verification**

With the dev server running, open `/estabelecimento/folgas`:
- Page loads, KPI cards show real numbers (unchanged from before this task).
- Click a servidor card → details drawer opens, all three tabs (Plantões, Folgas, Plantão Plus) show data.
- Click "+ Plantão Plus", pick a servidor → the price preview line appears (still using the old inline styling — Task 4 restyles it).
- Submit a valid Plantão Plus → toast now renders via the shared `ToastProvider` (bottom-right, same visual language as before) and the request is created — confirm in Supabase or by reopening the servidor's details drawer.
- Try to submit with justificativa under 50 characters, or a servidor whose cost exceeds `orcamentoDisponivel` → toast shows the correct warning/error, submission is blocked.

- [ ] **Step 9: Commit**

```bash
cd "c:/Projetos/SEAP/Sistema - Folga Compensatória"
git add frontend/src/pages/estabelecimento/Folgas.tsx
git commit -m "refactor: Folgas.tsx passa a usar useFolgasData e ToastProvider"
```

---

### Task 4: Add blueprint corner-bracket support to the shared Modal

**Why:** every modal in this app today uses a `blueprint` CSS class plus four decorative corner `<i class="corner tl|tr|bl|br">` elements — confirmed in `frontend/src/index.css:97-119`, where `.blueprint { position: relative; ... }` and `.blueprint > .corner` position four hairline brackets at the element's corners (must be **direct children** of the `.blueprint`-classed element for the CSS selector to match). Kombai's `Modal` component doesn't have this, which would make every migrated modal look visually different from the modals we're not touching (admin module) and from the confirm/alert-style dialogs already built this session. Rather than lose that or leave modals unmigrated, add an opt-in `blueprint` prop.

**Files:**
- Modify: `frontend/src/components/ui/Modal.tsx`

**Interfaces:**
- Produces: `ModalProps` gains an optional `blueprint?: boolean` (default `false`). When `true`, the dialog element gets the `blueprint` class and renders the four corner `<i>` elements as direct children, matching this app's existing modal look everywhere else. `ConfirmDialog` and `AlertDialog` (both wrap `Modal`) are NOT changed in this task — Task 7 and Task 11 pass `blueprint` through where needed.

- [ ] **Step 1: Add the prop and render the corners**

Old (`ModalProps` type, current lines 8–20):
```tsx
export type ModalProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  actions?: ReactNode;
  /** Icon rendered to the left of the title (already sized by the caller). */
  icon?: ReactNode;
  tone?: ModalTone;
  size?: ModalSize;
  /** Set false for destructive flows where an accidental click must not discard input. */
  closeOnBackdrop?: boolean;
};
```

New:
```tsx
export type ModalProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  actions?: ReactNode;
  /** Icon rendered to the left of the title (already sized by the caller). */
  icon?: ReactNode;
  tone?: ModalTone;
  size?: ModalSize;
  /** Set false for destructive flows where an accidental click must not discard input. */
  closeOnBackdrop?: boolean;
  /** Renders this app's blueprint corner-bracket decoration (index.css:97-119) around the dialog. */
  blueprint?: boolean;
};
```

Old (component signature, current lines 47–57):
```tsx
export const Modal = ({
  open,
  title,
  onClose,
  children,
  actions,
  icon,
  tone = 'default',
  size = 'md',
  closeOnBackdrop = true,
}: ModalProps) => {
```

New:
```tsx
export const Modal = ({
  open,
  title,
  onClose,
  children,
  actions,
  icon,
  tone = 'default',
  size = 'md',
  closeOnBackdrop = true,
  blueprint = false,
}: ModalProps) => {
```

Old (the dialog `<div>` and what follows it, current lines 122–137):
```tsx
      <div
        ref={dialogRef}
        className={`ui-modal ui-modal--${size}${tone === 'default' ? '' : ` ui-modal--${tone}`}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        <header className="ui-modal__header">
          {icon && <span className="ui-modal__icon" aria-hidden="true">{icon}</span>}
          <h2 className="ui-modal__title" id={titleId}>{title}</h2>
          <button type="button" className="ui-modal__close" onClick={onClose} aria-label="Fechar">
            <X size={18} strokeWidth={2} aria-hidden="true" />
          </button>
        </header>
```

New:
```tsx
      <div
        ref={dialogRef}
        className={`ui-modal ui-modal--${size}${tone === 'default' ? '' : ` ui-modal--${tone}`}${blueprint ? ' blueprint' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        {blueprint && (
          <>
            <i className="corner tl" aria-hidden="true"></i>
            <i className="corner tr" aria-hidden="true"></i>
            <i className="corner bl" aria-hidden="true"></i>
            <i className="corner br" aria-hidden="true"></i>
          </>
        )}
        <header className="ui-modal__header">
          {icon && <span className="ui-modal__icon" aria-hidden="true">{icon}</span>}
          <h2 className="ui-modal__title" id={titleId}>{title}</h2>
          <button type="button" className="ui-modal__close" onClick={onClose} aria-label="Fechar">
            <X size={18} strokeWidth={2} aria-hidden="true" />
          </button>
        </header>
```

(The four `<i>` corners land as direct children of the `ref={dialogRef}` div, satisfying the `.blueprint > .corner` CSS selector. `.ui-modal` already has no conflicting `position` rule that would override `.blueprint`'s `position: relative`, since Kombai's CSS never sets `position` on `.ui-modal` itself — confirmed by reading `frontend/src/index.css` around the `.ui-modal` block added in this session's earlier work.)

- [ ] **Step 2: Verify the build**

Run: `cd "c:/Projetos/SEAP/Sistema - Folga Compensatória/frontend" && npm run build`
Expected: succeeds. `Modal` is still unused anywhere in the app at this point, so this only checks the component compiles.

- [ ] **Step 3: Commit**

```bash
cd "c:/Projetos/SEAP/Sistema - Folga Compensatória"
git add frontend/src/components/ui/Modal.tsx
git commit -m "feat: adiciona suporte a cantos blueprint no Modal compartilhado"
```

---

### Task 5: Folgas.tsx — swap Plantão Plus modal, banners, and loading/empty states to shared components

**Scope decision (documented, not silent):** the servidor-details slide-in drawer (`isDetailsModalOpen`) is a full-height right-side panel, not a centered dialog — it does not fit `Modal`'s centered layout, so it stays exactly as-is. The numbered pagination at the bottom of the servidor grid (page-number buttons with "…" ellipsis) is more capable than the shared `Pagination` component (Anterior/Próxima + count only, no page-number jump) — replacing it would remove a feature, so it also stays exactly as-is. Only the Plantão Plus form modal (a plain centered dialog) and the two purely-presentational pieces (loading spinner, empty-grid message) move to shared components in this task.

**Files:**
- Modify: `frontend/src/pages/estabelecimento/Folgas.tsx`

**Interfaces:**
- Consumes: `Modal` (Task 4's `blueprint` prop), `Callout` from `../../components/ui/Callout`, `LoadingState`/`EmptyState` from `../../components/ui/States`, `Search` icon from `lucide-react`.

- [ ] **Step 1: Add imports**

Add to the top of the file, after the existing `useFolgasData`/`useToast` imports added in Task 3:
```tsx
import { Search } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { Callout } from '../../components/ui/Callout';
import { LoadingState, EmptyState } from '../../components/ui/States';
```

- [ ] **Step 2: Replace the top-level loading return**

Old:
```tsx
  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', gap: '16px', color: 'var(--color-text-muted)' }}>
      <div style={{ width: '36px', height: '36px', border: '3px solid var(--color-divider)', borderTopColor: 'var(--color-primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <span style={{ fontSize: '14px' }}>Carregando dados da unidade...</span>
    </div>
  );
```

New:
```tsx
  if (loading) return <LoadingState label="Carregando dados da unidade..." />;
```

- [ ] **Step 3: Replace the empty-grid message**

Old:
```tsx
          {paginatedFiltered.length === 0 ? (
            <div className="blueprint card" style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>🔍</div>
              <p style={{ margin: 0 }}>Nenhum servidor encontrado com os filtros aplicados.</p>
            </div>
          ) : (
```

New:
```tsx
          {paginatedFiltered.length === 0 ? (
            <EmptyState icon={<Search size={28} strokeWidth={1.6} />}>
              Nenhum servidor encontrado com os filtros aplicados.
            </EmptyState>
          ) : (
```

- [ ] **Step 4: Replace the Plantão Plus modal**

Old (the entire `{isPlusModalOpen && (...)}` block):
```tsx
      {isPlusModalOpen && (
        <div
          onClick={() => { setIsPlusModalOpen(false); openPlusModal(); /* limpa o form */ }}
          style={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
            background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
          }}
        >
          <div
            className="blueprint card elev-md"
            onClick={e => e.stopPropagation()}
            style={{ width: '500px', padding: 'var(--space-6)', background: 'var(--color-surface)' }}
          >
            <i className="corner tl"></i><i className="corner tr"></i><i className="corner bl"></i><i className="corner br"></i>
            <h3 style={{ marginTop: 0, marginBottom: 'var(--space-4)' }}>
              Lançar Plantão Plus (Indenização)
            </h3>

            <div style={{ marginBottom: '20px', padding: '12px 16px', background: 'rgba(239,68,68,0.05)', borderRadius: '8px', borderLeft: '4px solid var(--color-danger)', fontSize: '13px', color: 'var(--color-text)', lineHeight: 1.5, textAlign: 'justify' }}>
              <strong>⚠️ ATENÇÃO:</strong> O lançamento de <strong>Plantão Plus</strong> é passível de rigorosa auditoria pelos órgãos de controle. Ao registrar este plantão, a direção do estabelecimento penal está atestando e se responsabilizando integralmente de que o servidor realmente prestou o serviço suplementar nas datas e condições informadas.
            </div>
            
            <form onSubmit={handleSavePlus}>
              <div className="field" style={{ marginBottom: 'var(--space-3)' }}>
                <label>Servidor *</label>
                <input 
                  type="text" 
                  className="input" 
                  placeholder="Pesquisar por nome ou matrícula..." 
                  value={plusSearchTerm}
                  onChange={(e) => setPlusSearchTerm(e.target.value)}
                  style={{ marginBottom: '8px' }}
                />
                <select 
                  className="input" 
                  value={plusEmployeeId} 
                  onChange={(e) => setPlusEmployeeId(e.target.value)}
                  required
                >
                  <option value="">Selecione o servidor...</option>
                  {employees
                    .filter(emp => (emp.nome + emp.matricula).toLowerCase().includes(plusSearchTerm.toLowerCase()))
                    .map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.nome} - Mat: {emp.matricula}
                    </option>
                  ))}
                </select>
              </div>

              {plusValorPreview !== null && (
                plusValorPreview > orcamentoDisponivel ? (
                  <div style={{
                    marginBottom: 'var(--space-3)', padding: '10px 14px', borderRadius: '8px', fontSize: '13px',
                    background: 'rgba(239,68,68,0.08)', borderLeft: '4px solid var(--color-danger)', color: 'var(--color-danger)'
                  }}>
                    <div style={{ fontWeight: 700 }}>
                      🚫 Orçamento insuficiente — faltam R$ {(plusValorPreview - orcamentoDisponivel).toFixed(2)}
                    </div>
                    <div style={{ marginTop: '4px' }}>
                      Este lançamento (R$ {plusValorPreview.toFixed(2)}) não cabe no disponível (R$ {orcamentoDisponivel.toFixed(2)}).
                    </div>
                    <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: '1px dashed rgba(239,68,68,0.25)' }}>
                      💡 Aprove ou rejeite solicitações pendentes em "Solicitar Compra" para liberar orçamento.
                    </div>
                  </div>
                ) : (
                  <div style={{
                    marginBottom: 'var(--space-3)', padding: '10px 14px', borderRadius: '8px', fontSize: '13px',
                    background: 'rgba(16,185,129,0.08)', borderLeft: '4px solid #10b981', color: '#0d7a56'
                  }}>
                    Valor deste lançamento: <strong>R$ {plusValorPreview.toFixed(2)}</strong> — Disponível p/ lançamento: <strong>R$ {orcamentoDisponivel.toFixed(2)}</strong>
                  </div>
                )
              )}

              <div className="field" style={{ marginBottom: 'var(--space-3)' }}>
                <label>Data do Plantão Extraordinário *</label>
                <input 
                  className="input" 
                  type="date" 
                  value={plusDataPlantao} 
                  max={activeCycle?.data_fim}
                  onChange={(e) => setPlusDataPlantao(e.target.value)} 
                  required 
                />
              </div>

              <div className="field" style={{ marginBottom: 'var(--space-4)' }}>
                <label>Justificativa (Mín. 50 caracteres) *</label>
                <textarea 
                  className="input" 
                  value={plusJustificativa} 
                  onChange={(e) => setPlusJustificativa(e.target.value)} 
                  rows={4}
                  required
                  placeholder="Justifique detalhadamente o motivo do plantão extraordinário..."
                  minLength={50}
                  maxLength={1000}
                />
                <div style={{ fontSize: '11px', color: plusJustificativa.length < 50 ? 'var(--color-danger)' : 'var(--color-primary)', marginTop: '4px', textAlign: 'right' }}>
                  {plusJustificativa.length}/1000 caracteres (mínimo 50)
                </div>
              </div>

              <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setIsPlusModalOpen(false)}>Cancelar</button>
                <button
                  type="submit"
                  className="btn btn-primary blueprint"
                  disabled={isSubmittingPlus || (plusValorPreview !== null && plusValorPreview > orcamentoDisponivel)}
                >
                  <i className="corner tl"></i><i className="corner tr"></i><i className="corner bl"></i><i className="corner br"></i>
                  {isSubmittingPlus ? 'Enviando...' : 'Solicitar Pagamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
```

New:
```tsx
      <Modal
        open={isPlusModalOpen}
        title="Lançar Plantão Plus (Indenização)"
        onClose={() => { setIsPlusModalOpen(false); openPlusModal(); /* limpa o form */ }}
        size="md"
        blueprint
      >
        <Callout tone="danger" title="Atenção">
          O lançamento de <strong>Plantão Plus</strong> é passível de rigorosa auditoria pelos órgãos de controle. Ao registrar este plantão, a direção do estabelecimento penal está atestando e se responsabilizando integralmente de que o servidor realmente prestou o serviço suplementar nas datas e condições informadas.
        </Callout>

        <form onSubmit={handleSavePlus} style={{ marginTop: 'var(--space-4)' }}>
          <div className="field" style={{ marginBottom: 'var(--space-3)' }}>
            <label>Servidor *</label>
            <input
              type="text"
              className="input"
              placeholder="Pesquisar por nome ou matrícula..."
              value={plusSearchTerm}
              onChange={(e) => setPlusSearchTerm(e.target.value)}
              style={{ marginBottom: '8px' }}
            />
            <select
              className="input"
              value={plusEmployeeId}
              onChange={(e) => setPlusEmployeeId(e.target.value)}
              required
            >
              <option value="">Selecione o servidor...</option>
              {employees
                .filter(emp => (emp.nome + emp.matricula).toLowerCase().includes(plusSearchTerm.toLowerCase()))
                .map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.nome} - Mat: {emp.matricula}
                </option>
              ))}
            </select>
          </div>

          {plusValorPreview !== null && (
            plusValorPreview.valor > orcamentoDisponivel ? (
              <Callout
                tone="danger"
                title={`Orçamento insuficiente — faltam R$ ${(plusValorPreview.valor - orcamentoDisponivel).toFixed(2)}`}
                hint='Aprove ou rejeite solicitações pendentes em "Solicitar Compra" para liberar orçamento.'
              >
                Este lançamento (R$ {plusValorPreview.valor.toFixed(2)}) não cabe no disponível (R$ {orcamentoDisponivel.toFixed(2)}).
              </Callout>
            ) : (
              <Callout tone="success">
                Valor deste lançamento: <strong>R$ {plusValorPreview.valor.toFixed(2)}</strong> — Disponível p/ lançamento: <strong>R$ {orcamentoDisponivel.toFixed(2)}</strong>
              </Callout>
            )
          )}

          <div className="field" style={{ marginTop: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
            <label>Data do Plantão Extraordinário *</label>
            <input
              className="input"
              type="date"
              value={plusDataPlantao}
              max={activeCycle?.data_fim}
              onChange={(e) => setPlusDataPlantao(e.target.value)}
              required
            />
          </div>

          <div className="field" style={{ marginBottom: 'var(--space-4)' }}>
            <label>Justificativa (Mín. 50 caracteres) *</label>
            <textarea
              className="input"
              value={plusJustificativa}
              onChange={(e) => setPlusJustificativa(e.target.value)}
              rows={4}
              required
              placeholder="Justifique detalhadamente o motivo do plantão extraordinário..."
              minLength={50}
              maxLength={1000}
            />
            <div className={`ui-field-counter${plusJustificativa.length < 50 ? ' ui-field-counter--invalid' : ''}`}>
              {plusJustificativa.length}/1000 caracteres (mínimo 50)
            </div>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsPlusModalOpen(false)}>Cancelar</button>
            <button
              type="submit"
              className="btn btn-primary blueprint"
              disabled={isSubmittingPlus || (plusValorPreview !== null && plusValorPreview.valor > orcamentoDisponivel)}
            >
              <i className="corner tl"></i><i className="corner tr"></i><i className="corner bl"></i><i className="corner br"></i>
              {isSubmittingPlus ? 'Enviando...' : 'Solicitar Pagamento'}
            </button>
          </div>
        </form>
      </Modal>
```

(The submit button keeps its own `blueprint` treatment directly — `Modal`'s new `blueprint` prop decorates the dialog frame, not nested buttons, so the button's own corner `<i>` tags stay exactly as they were. `btn btn-ghost` becomes `btn btn-secondary` for the Cancel button to match the class name `ConfirmDialog`/`AlertDialog` already use in Task 4's sibling components — confirm `btn-secondary` exists in `index.css` by grepping for it before this step; if it doesn't, keep `btn btn-ghost` instead and skip this rename.)

- [ ] **Step 5: Verify the build**

Run: `cd "c:/Projetos/SEAP/Sistema - Folga Compensatória/frontend" && npm run build`
Expected: succeeds.

- [ ] **Step 6: Manual verification**

With the dev server running, open `/estabelecimento/folgas`:
- Loading spinner on first load looks the same as before (centered, same label).
- Filter to zero results (e.g., search for a nonsense string) → empty state shows the same message with a search icon.
- Open "+ Plantão Plus" → modal now has the blueprint corner brackets on its frame, ESC closes it, clicking the backdrop closes it, Tab cycles focus without leaving the dialog. The two budget banners (danger/success) render via `Callout` with the same information as before.
- Submit flow (valid, over-budget, short justificativa) behaves identically to Task 3's verification.

- [ ] **Step 7: Commit**

```bash
cd "c:/Projetos/SEAP/Sistema - Folga Compensatória"
git add frontend/src/pages/estabelecimento/Folgas.tsx
git commit -m "refactor: Folgas.tsx usa Modal/Callout/States compartilhados no formulario de Plantao Plus"
```

---

### Task 6: Wire useSolicitacoesData into Solicitacoes.tsx — Folgas Disponíveis + criação de solicitações

**Files:**
- Modify: `frontend/src/pages/estabelecimento/solicitacoes/types.ts` (one field fix, see Step 1)
- Modify: `frontend/src/pages/estabelecimento/Solicitacoes.tsx`

**Interfaces:**
- Consumes: `useSolicitacoesData` (already exists from Kombai).
- Produces: this task and Task 7 together replace the file's entire top block (imports through the last handler) with the hook wired in. `totalOrcado`/`totalGasto`/`totalEmpenhado`/`orcamentoDisponivel`/`disponivelParaLancamento` keep their current names (aliased from `budget.*`) so nothing in the ~800 lines of JSX below needs to change on account of this task. `supabase` import stays in the file after this task — Task 7's handlers still call it directly until that task converts them too.

- [ ] **Step 1: Fix `TipoSolicitacao` in the existing `solicitacoes/types.ts`**

Kombai's type says `'FOLGA'`, but the real database value (checked in `database/00_init_schema.sql`) is `'FOLGA_COMPENSATORIA'` — `purchase_requests.tipo_solicitacao` has `CHECK (tipo_solicitacao IN ('FOLGA_COMPENSATORIA', 'PLANTAO_PLUS'))`. Nothing in the current app compares against the wrong string today (the JSX only ever checks `=== 'PLANTAO_PLUS'` and treats everything else as the folga case), so this hasn't caused a bug yet — but it's a landmine for the next person who writes a literal comparison against `'FOLGA_COMPENSATORIA'` and gets no type error for the typo. Fix it now while touching this file.

Old (in `frontend/src/pages/estabelecimento/solicitacoes/types.ts`):
```ts
export type TipoSolicitacao = 'FOLGA' | 'PLANTAO_PLUS';
```

New:
```ts
export type TipoSolicitacao = 'FOLGA_COMPENSATORIA' | 'PLANTAO_PLUS';
```

- [ ] **Step 2: Replace imports and remove the inline type declarations**

Old (current lines 1–42):
```tsx
import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';

type SortColumnSol = 'servidor' | 'tipo' | 'data_plantao' | 'valor' | 'status';
type SortColumnUsufruida = 'servidor' | 'data_usufruto';
type SortDirection = 'asc' | 'desc';

type FolgaDisponivel = {
  id: string;
  periodo_inicio: string;
  periodo_fim: string;
  quantidade_plantoes: number;
  status: string;
  employees: {
    id: string;
    nome: string;
    matricula: string;
    positions: { id: string; nome: string; codigo: string };
  };
};

type Solicitacao = {
  id: string;
  valor: number;
  status: string;
  justificativa: string;
  requested_at: string;
  tipo_solicitacao: string;
  data_plantao?: string;
  compensatory_days?: {
    periodo_inicio: string;
    periodo_fim: string;
    quantidade_plantoes: number;
  };
  employees: {
    nome: string;
    matricula: string;
    positions: { nome: string; codigo: string };
  };
};

export const Solicitacoes: React.FC = () => {
```

New:
```tsx
import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { useSolicitacoesData } from './solicitacoes/useSolicitacoesData';
import type { FolgaDisponivel, Solicitacao } from './solicitacoes/types';

type SortColumnSol = 'servidor' | 'tipo' | 'data_plantao' | 'valor' | 'status';
type SortColumnUsufruida = 'servidor' | 'data_usufruto';
type SortDirection = 'asc' | 'desc';

export const Solicitacoes: React.FC = () => {
```

- [ ] **Step 3: Replace the top-of-component state block**

Old (current lines 45–116, from `const { profile }` through the sort-state declarations, up to but not including the `useEffect` for pagination reset):
```tsx
  const { profile } = useAuth();
  const [activeCycle, setActiveCycle] = useState<any>(null);
  const [folgasDisponiveis, setFolgasDisponiveis] = useState<FolgaDisponivel[]>([]);
  const [folgasUsufruidas, setFolgasUsufruidas] = useState<any[]>([]);
  const [activeRightTab, setActiveRightTab] = useState<'FINANCEIRO' | 'USUFRUIDAS'>('FINANCEIRO');
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  // const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isUsufrutoModalOpen, setIsUsufrutoModalOpen] = useState(false);
  const [selectedFolga, setSelectedFolga] = useState<any>(null);
  const [dataPlantao, setDataPlantao] = useState('');
  const [justificativa, setJustificativa] = useState('');
  const [dataUsufruto, setDataUsufruto] = useState('');
  const [valorUnitario, setValorUnitario] = useState(0);
  const [valorHistoricoId, setValorHistoricoId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filtros para Folgas
  const [buscaFolga, setBuscaFolga] = useState('');
  const [filtroCargoFolga, setFiltroCargoFolga] = useState('');

  // Filtros para Solicitações do Ciclo
  const [buscaSolicitacoes, setBuscaSolicitacoes] = useState('');
  const [filtroCargoSolicitacoes, setFiltroCargoSolicitacoes] = useState('');

  // Filtros para Folgas Usufruídas
  const [buscaUsufruidas, setBuscaUsufruidas] = useState('');
  const [filtroCargoUsufruidas, setFiltroCargoUsufruidas] = useState('');

  // Modal de Confirmação Genérico
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
  } | null>(null);

  // Modal de Aviso/Erro Genérico (substitui alert() nativo)
  const [infoModal, setInfoModal] = useState<{
    title: string;
    message: string;
    type?: 'error' | 'warning';
  } | null>(null);

  // Status de Limite
  const [totalOrcado, setTotalOrcado] = useState(0);
  const [totalGasto, setTotalGasto] = useState(0);
  const [totalEmpenhado, setTotalEmpenhado] = useState(0);
  const [orcamentoDisponivel, setOrcamentoDisponivel] = useState(0);

  // Valores dos Cargos (para mostrar no card antes do modal)
  const [positionValues, setPositionValues] = useState<Record<string, number>>({});

  // Aprovação em lote (Lado Direito)
  const [selectedRequests, setSelectedRequests] = useState<string[]>([]);
  
  // Solicitação em lote (Lado Esquerdo)
  const [selectedFolgas, setSelectedFolgas] = useState<string[]>([]);

  // Paginação
  const [currentPageFolgas, setCurrentPageFolgas] = useState(1);
  const [currentPageSolicitacoes, setCurrentPageSolicitacoes] = useState(1);
  const ITEMS_PER_PAGE = 24;

  const [sortColumnSol, setSortColumnSol] = useState<SortColumnSol | null>(null);
  const [sortDirectionSol, setSortDirectionSol] = useState<SortDirection>('asc');
  
  const [sortColumnUsufruida, setSortColumnUsufruida] = useState<SortColumnUsufruida | null>(null);
  const [sortDirectionUsufruida, setSortDirectionUsufruida] = useState<SortDirection>('asc');
```

New:
```tsx
  const { profile } = useAuth();
  const {
    loading,
    activeCycle,
    folgasDisponiveis,
    folgasUsufruidas,
    solicitacoes,
    positionValues,
    budget,
    fetchValorCargo,
    solicitarCompra,
    solicitarCompraEmLote,
    registrarGozo,
    desfazerGozo,
    aprovar,
    aprovarEmLote,
    rejeitar,
    cancelar,
  } = useSolicitacoesData(profile?.establishment_id, profile?.id);

  const totalOrcado = budget.orcado;
  const totalGasto = budget.aprovado;
  const totalEmpenhado = budget.empenhado;
  const orcamentoDisponivel = budget.disponivelParaAprovacao;
  const disponivelParaLancamento = budget.disponivelParaLancamento;

  const [activeRightTab, setActiveRightTab] = useState<'FINANCEIRO' | 'USUFRUIDAS'>('FINANCEIRO');

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUsufrutoModalOpen, setIsUsufrutoModalOpen] = useState(false);
  const [selectedFolga, setSelectedFolga] = useState<any>(null);
  const [dataPlantao, setDataPlantao] = useState('');
  const [justificativa, setJustificativa] = useState('');
  const [dataUsufruto, setDataUsufruto] = useState('');
  const [valorUnitario, setValorUnitario] = useState(0);
  const [valorHistoricoId, setValorHistoricoId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filtros para Folgas
  const [buscaFolga, setBuscaFolga] = useState('');
  const [filtroCargoFolga, setFiltroCargoFolga] = useState('');

  // Filtros para Solicitações do Ciclo
  const [buscaSolicitacoes, setBuscaSolicitacoes] = useState('');
  const [filtroCargoSolicitacoes, setFiltroCargoSolicitacoes] = useState('');

  // Filtros para Folgas Usufruídas
  const [buscaUsufruidas, setBuscaUsufruidas] = useState('');
  const [filtroCargoUsufruidas, setFiltroCargoUsufruidas] = useState('');

  // Modal de Confirmação Genérico
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
  } | null>(null);

  // Modal de Aviso/Erro Genérico (substitui alert() nativo)
  const [infoModal, setInfoModal] = useState<{
    title: string;
    message: string;
    type?: 'error' | 'warning';
  } | null>(null);

  // Aprovação em lote (Lado Direito)
  const [selectedRequests, setSelectedRequests] = useState<string[]>([]);

  // Solicitação em lote (Lado Esquerdo)
  const [selectedFolgas, setSelectedFolgas] = useState<string[]>([]);

  // Paginação
  const [currentPageFolgas, setCurrentPageFolgas] = useState(1);
  const [currentPageSolicitacoes, setCurrentPageSolicitacoes] = useState(1);
  const ITEMS_PER_PAGE = 24;

  const [sortColumnSol, setSortColumnSol] = useState<SortColumnSol | null>(null);
  const [sortDirectionSol, setSortDirectionSol] = useState<SortDirection>('asc');

  const [sortColumnUsufruida, setSortColumnUsufruida] = useState<SortColumnUsufruida | null>(null);
  const [sortDirectionUsufruida, setSortDirectionUsufruida] = useState<SortDirection>('asc');
```

- [ ] **Step 4: Delete `fetchData`**

Delete the whole function (current lines 132–242, from `const fetchData = async (showLoading = true) => {` through its closing `};`) plus the `useEffect` that called it on mount (current lines 126–130):
```tsx
  useEffect(() => {
    if (profile?.establishment_id) {
      fetchData(true);
    }
  }, [profile?.establishment_id]);

  const fetchData = async (showLoading = true) => {
    ... (entire body) ...
  };
```
Both are fully replaced by `useSolicitacoesData`. The two pagination-reset `useEffect`s (`setCurrentPageFolgas(1)` / `setCurrentPageSolicitacoes(1)`) stay — they're unrelated to data fetching.

- [ ] **Step 5: Rewrite `openCompraModal`**

Old:
```tsx
  const openCompraModal = async (folga: FolgaDisponivel | any) => {
    try {
      setSelectedFolga(folga);
      setJustificativa('');
      setDataPlantao('');
      
      // Buscar o valor atual do cargo para calcular
      const positionId = folga.employees?.positions?.id;
      if (!positionId) {
        alert("Erro: O cargo deste servidor não foi encontrado.");
        return;
      }

      const { data: posVal, error } = await supabase
        .from('position_values')
        .select('id, valor')
        .eq('position_id', positionId)
        .order('vigencia_inicio', { ascending: false })
        .limit(1)
        .maybeSingle();
        
      if (error) {
        alert("Erro no banco de dados: " + error.message);
        return;
      }

      if (posVal) {
        setValorUnitario(posVal.valor);
        setValorHistoricoId(posVal.id);
      } else {
        alert("Erro: O cargo deste servidor não possui valor configurado. Entre em contato com o gestor.");
        return;
      }

      setIsModalOpen(true);
    } catch (err: any) {
      alert("Erro inesperado: " + err.message);
    }
  };
```

New:
```tsx
  const openCompraModal = async (folga: FolgaDisponivel | any) => {
    setSelectedFolga(folga);
    setJustificativa('');
    setDataPlantao('');

    const positionId = folga.employees?.positions?.id;
    if (!positionId) {
      setInfoModal({ title: 'Erro', message: 'O cargo deste servidor não foi encontrado.', type: 'error' });
      return;
    }

    const posVal = await fetchValorCargo(positionId);
    if (!posVal) {
      setInfoModal({ title: 'Erro', message: 'O cargo deste servidor não possui valor configurado. Entre em contato com o gestor.', type: 'error' });
      return;
    }

    setValorUnitario(posVal.valor);
    setValorHistoricoId(posVal.id);
    setIsModalOpen(true);
  };
```

(`fetchValorCargo` in `useSolicitacoesData.ts` orders by `vigencia_inicio` descending, same as the original inline query — behavior unchanged.)

- [ ] **Step 6: Rewrite `handleComprar`**

Old:
```tsx
  const handleComprar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFolga || !profile || !activeCycle) return;

    const valorTotal = valorUnitario * selectedFolga.quantidade_plantoes;

    // Trava de orçamento na criação: considera Aprovado + Aguardando Aprovação, não só
    // Aprovado — evita criar pedidos que, somados ao que já está na fila, não vão caber
    // no orçamento quando chegar a hora de aprovar.
    if (valorTotal > disponivelParaLancamento) {
      setInfoModal({
        title: '🚫 Orçamento Insuficiente',
        message: `Faltam R$ ${(valorTotal - disponivelParaLancamento).toFixed(2)} para solicitar esta compra.\n\nEsta solicitação: R$ ${valorTotal.toFixed(2)}\nDisponível p/ novo lançamento: R$ ${disponivelParaLancamento.toFixed(2)}\n\nAprove ou rejeite as solicitações pendentes para liberar orçamento.`,
        type: 'error'
      });
      return;
    }

    if (dataPlantao > activeCycle.data_fim) {
      alert(`A data do plantão não pode ultrapassar o encerramento do ciclo atual.`);
      return;
    }

    setIsSubmitting(true);
    try {
      // Verificar duplicidade de data
      const { data: existingPlus } = await supabase
        .from('purchase_requests')
        .select('id')
        .eq('employee_id', selectedFolga.employees.id)
        .eq('data_plantao', dataPlantao)
        .neq('status', 'REJEITADA')
        .neq('status', 'CANCELADA')
        .limit(1);

      if (existingPlus && existingPlus.length > 0) {
        alert('Este servidor já possui uma solicitação ou compra de plantão para esta mesma data.');
        setIsSubmitting(false);
        return;
      }

      // 1. Criar ou Atualizar purchase_request (evita erro 409 de unique constraint)
      const { error: reqError } = await supabase
        .from('purchase_requests')
        .upsert([{
          compensatory_day_id: selectedFolga.id,
          establishment_id: profile.establishment_id,
          cycle_id: activeCycle.id,
          employee_id: selectedFolga.employees.id,
          position_id: selectedFolga.employees.positions.id,
          valor: valorTotal,
          valor_historico_id: valorHistoricoId,
          justificativa: justificativa,
          data_plantao: dataPlantao,
          status: 'SOLICITADA',
          requested_by: profile.id,
          analyzed_by: null,
          analyzed_at: null,
          rejection_reason: null,
          cancelled_by: null,
          cancelled_at: null,
          cancellation_reason: null
        }], { onConflict: 'compensatory_day_id' });

      if (reqError) throw reqError;

      // 2. Atualizar folga para INDENIZACAO_SOLICITADA
      const { error: updError } = await supabase
        .from('compensatory_days')
        .update({ status: 'INDENIZACAO_SOLICITADA' })
        .eq('id', selectedFolga.id);

      if (updError) throw updError;

      setIsModalOpen(false);
      fetchData(false); // Recarrega tudo para atualizar saldos e tabelas, sem loading na tela toda
    } catch (err: any) {
      alert(err.message || "Erro ao solicitar compra da folga.");
    } finally {
      setIsSubmitting(false);
    }
  };
```

New:
```tsx
  const handleComprar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFolga || !profile || !activeCycle) return;

    const valorTotal = valorUnitario * selectedFolga.quantidade_plantoes;

    // Trava de orçamento na criação: considera Aprovado + Aguardando Aprovação, não só
    // Aprovado — evita criar pedidos que, somados ao que já está na fila, não vão caber
    // no orçamento quando chegar a hora de aprovar.
    if (valorTotal > disponivelParaLancamento) {
      setInfoModal({
        title: '🚫 Orçamento Insuficiente',
        message: `Faltam R$ ${(valorTotal - disponivelParaLancamento).toFixed(2)} para solicitar esta compra.\n\nEsta solicitação: R$ ${valorTotal.toFixed(2)}\nDisponível p/ novo lançamento: R$ ${disponivelParaLancamento.toFixed(2)}\n\nAprove ou rejeite as solicitações pendentes para liberar orçamento.`,
        type: 'error'
      });
      return;
    }

    if (dataPlantao > activeCycle.data_fim) {
      setInfoModal({ title: 'Data inválida', message: 'A data do plantão não pode ultrapassar o encerramento do ciclo atual.', type: 'error' });
      return;
    }

    setIsSubmitting(true);
    const result = await solicitarCompra({
      folga: selectedFolga,
      dataPlantao,
      justificativa,
      valorUnitario,
      valorHistoricoId,
    });
    setIsSubmitting(false);

    if (!result.ok) {
      setInfoModal({ title: 'Erro', message: result.message, type: 'error' });
      return;
    }

    setIsModalOpen(false);
  };
```

- [ ] **Step 7: Rewrite `handleBulkComprarForm`**

Old:
```tsx
  const handleBulkComprarForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedFolgas.length === 0 || !profile || !activeCycle || !dataPlantao) return;
    
    if (dataPlantao > activeCycle.data_fim) {
      alert(`A data do plantão não pode ultrapassar o encerramento do ciclo atual.`);
      return;
    }

    if (justificativa.length < 50) {
      alert("A justificativa precisa ter pelo menos 50 caracteres.");
      return;
    }

    const folgasToBuy = folgasDisponiveis.filter(f => selectedFolgas.includes(f.id));

    // Trava de orçamento no lote inteiro, antes de gravar qualquer uma — soma o valor de
    // TODAS as folgas selecionadas contra o disponível (Aprovado + Aguardando Aprovação já
    // descontados). Checar uma por uma durante o loop deixaria parte solicitada e parte não.
    const valorTotalLote = folgasToBuy.reduce((acc, f) => {
      const preco = positionValues[f.employees?.positions?.id] || 0;
      return acc + preco * f.quantidade_plantoes;
    }, 0);

    if (valorTotalLote > disponivelParaLancamento) {
      setInfoModal({
        title: '🚫 Orçamento Insuficiente para o Lote',
        message: `Faltam R$ ${(valorTotalLote - disponivelParaLancamento).toFixed(2)} para solicitar este lote.\n\nTotal das ${folgasToBuy.length} folgas selecionadas: R$ ${valorTotalLote.toFixed(2)}\nDisponível p/ novo lançamento: R$ ${disponivelParaLancamento.toFixed(2)}\n\nDesmarque algumas folgas, ou aprove/rejeite pendências para liberar orçamento.`,
        type: 'error'
      });
      return;
    }

    setIsSubmitting(true);
    let erroredCount = 0;

    for (const folga of folgasToBuy) {
      try {
        const positionId = folga.employees.positions.id;

        // Verificação de duplicidade da data
        const { data: existingPlus } = await supabase
          .from('purchase_requests')
          .select('id')
          .eq('employee_id', folga.employees.id)
          .eq('data_plantao', dataPlantao)
          .neq('status', 'REJEITADA')
          .neq('status', 'CANCELADA')
          .limit(1);

        if (existingPlus && existingPlus.length > 0) {
           console.error(`Servidor ${folga.employees.nome} já possui compra para o dia ${dataPlantao}.`);
           erroredCount++;
           continue;
        }

        const { data: posVal } = await supabase
          .from('position_values')
          .select('id, valor')
          .eq('position_id', positionId)
          .order('vigencia_inicio', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!posVal) throw new Error("Cargo sem valor configurado");

        const valorUnitario = posVal.valor;
        const valorTotalFolga = valorUnitario * folga.quantidade_plantoes;

        const { error: reqError } = await supabase
          .from('purchase_requests')
          .upsert([{
            compensatory_day_id: folga.id,
            establishment_id: profile.establishment_id,
            cycle_id: activeCycle.id,
            employee_id: folga.employees.id,
            position_id: folga.employees.positions.id,
            valor: valorTotalFolga,
            valor_historico_id: posVal.id,
            justificativa: justificativa,
            data_plantao: dataPlantao,
            status: 'SOLICITADA',
            requested_by: profile.id
          }], { onConflict: 'compensatory_day_id' });

        if (reqError) throw reqError;

        const { error: updError } = await supabase
          .from('compensatory_days')
          .update({ status: 'INDENIZACAO_SOLICITADA' })
          .eq('id', folga.id);

        if (updError) throw updError;
      } catch (err) {
        console.error(err);
        erroredCount++;
      }
    }

    setIsSubmitting(false);
    setIsModalOpen(false);
    setSelectedFolgas([]);
    if (erroredCount > 0) {
      alert(`Ocorreu um erro ou bloqueio de duplicidade em ${erroredCount} folga(s). As demais foram solicitadas com sucesso.`);
    }
    fetchData(false);
  };
```

New:
```tsx
  const handleBulkComprarForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedFolgas.length === 0 || !profile || !activeCycle || !dataPlantao) return;

    if (dataPlantao > activeCycle.data_fim) {
      setInfoModal({ title: 'Data inválida', message: 'A data do plantão não pode ultrapassar o encerramento do ciclo atual.', type: 'error' });
      return;
    }

    if (justificativa.length < 50) {
      setInfoModal({ title: 'Justificativa curta', message: 'A justificativa precisa ter pelo menos 50 caracteres.', type: 'error' });
      return;
    }

    const folgasToBuy = folgasDisponiveis.filter(f => selectedFolgas.includes(f.id));

    // Trava de orçamento no lote inteiro, antes de gravar qualquer uma — soma o valor de
    // TODAS as folgas selecionadas contra o disponível (Aprovado + Aguardando Aprovação já
    // descontados). Checar uma por uma durante o loop deixaria parte solicitada e parte não.
    const valorTotalLote = folgasToBuy.reduce((acc, f) => {
      const preco = positionValues[f.employees?.positions?.id] || 0;
      return acc + preco * f.quantidade_plantoes;
    }, 0);

    if (valorTotalLote > disponivelParaLancamento) {
      setInfoModal({
        title: '🚫 Orçamento Insuficiente para o Lote',
        message: `Faltam R$ ${(valorTotalLote - disponivelParaLancamento).toFixed(2)} para solicitar este lote.\n\nTotal das ${folgasToBuy.length} folgas selecionadas: R$ ${valorTotalLote.toFixed(2)}\nDisponível p/ novo lançamento: R$ ${disponivelParaLancamento.toFixed(2)}\n\nDesmarque algumas folgas, ou aprove/rejeite pendências para liberar orçamento.`,
        type: 'error'
      });
      return;
    }

    setIsSubmitting(true);
    const result = await solicitarCompraEmLote({ folgas: folgasToBuy, dataPlantao, justificativa });
    setIsSubmitting(false);
    setIsModalOpen(false);
    setSelectedFolgas([]);

    if (!result.ok) {
      setInfoModal({
        title: result.details ? 'Algumas folgas não foram solicitadas' : 'Erro',
        message: result.details ? `${result.message}\n\n${result.details.join('\n')}` : result.message,
        type: 'error'
      });
    }
  };
```

- [ ] **Step 8: Verify the build**

Run: `cd "c:/Projetos/SEAP/Sistema - Folga Compensatória/frontend" && npm run build`
Expected: fails with TypeScript errors about `fetchData` and `setActiveCycle`/`setFolgasDisponiveis`/etc. being referenced in code this task hasn't reached yet (Task 7's handlers still call `fetchData(false)`, and `openUsufrutoModal`/`handleDesfazerUsufruto`/approve/reject/cancel are untouched). This is expected — Task 7 finishes the job. Confirm the errors are ONLY in those not-yet-converted handlers, not in anything Step 2–7 touched.

- [ ] **Step 9: Commit**

```bash
cd "c:/Projetos/SEAP/Sistema - Folga Compensatória"
git add frontend/src/pages/estabelecimento/solicitacoes/types.ts frontend/src/pages/estabelecimento/Solicitacoes.tsx
git commit -m "refactor: Solicitacoes.tsx usa useSolicitacoesData para folgas disponiveis e criacao de pedidos (build ainda quebrado, Task 7 termina)"
```

Note: this is the one commit in this plan expected to leave the build red — Solicitacoes.tsx is split across Tasks 6 and 7 because the state block and imports are shared by both halves and can't be wired in twice. Task 7 fixes the build in its own Step 8.

---

### Task 7: Wire useSolicitacoesData into Solicitacoes.tsx — gozo, cancelamento e aprovação

**Files:**
- Modify: `frontend/src/pages/estabelecimento/Solicitacoes.tsx`

**Interfaces:**
- Consumes: the same `useSolicitacoesData` destructure from Task 6 (`registrarGozo`, `desfazerGozo`, `cancelar`, `aprovar`, `aprovarEmLote`, `rejeitar`).
- Produces: the file compiles clean again — this task's Step 8 is the first green build since Task 5.

`openUsufrutoModal`, `handleDesfazerUsufruto`, `openBulkCompraModal`, `handleCancelRequest`, `handleBulkApprove`, and `handleApproveRequest` need **no changes** in this task — none of them call Supabase or `fetchData` directly, only the six functions below do.

- [ ] **Step 1: Rewrite `handleRegistrarUsufruto`**

Old:
```tsx
  const handleRegistrarUsufruto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFolga || !dataUsufruto) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('compensatory_days')
        .update({
          status: 'USUFRUIDA',
          used_at: dataUsufruto,
          usage_registered_by: profile?.id
        })
        .eq('id', selectedFolga.id);

      if (error) throw error;

      setIsUsufrutoModalOpen(false);
      fetchData(false);
    } catch (err: any) {
      alert(err.message || "Erro ao registrar usufruto.");
    } finally {
      setIsSubmitting(false);
    }
  };
```

New:
```tsx
  const handleRegistrarUsufruto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFolga || !dataUsufruto) return;

    setIsSubmitting(true);
    const result = await registrarGozo(selectedFolga.id, dataUsufruto);
    setIsSubmitting(false);

    if (!result.ok) {
      setInfoModal({ title: 'Erro', message: result.message, type: 'error' });
      return;
    }

    setIsUsufrutoModalOpen(false);
  };
```

- [ ] **Step 2: Rewrite `executeDesfazerUsufruto`**

Old:
```tsx
  const executeDesfazerUsufruto = async (folga: any) => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('compensatory_days')
        .update({
          status: 'GERADA',
          used_at: null,
          usage_registered_by: null
        })
        .eq('id', folga.id);

      if (error) throw error;

      fetchData(false);
    } catch (err: any) {
      alert(err.message || "Erro ao excluir o registro de gozo.");
    } finally {
      setIsSubmitting(false);
    }
  };
```

New:
```tsx
  const executeDesfazerUsufruto = async (folga: any) => {
    setIsSubmitting(true);
    const result = await desfazerGozo(folga.id);
    setIsSubmitting(false);

    if (!result.ok) {
      setInfoModal({ title: 'Erro', message: result.message, type: 'error' });
    }
  };
```

- [ ] **Step 3: Rewrite `executeCancelRequest`**

Old:
```tsx
  const executeCancelRequest = async (solicitacao: Solicitacao) => {
    try {
      // 1. Atualizar a solicitação para CANCELADA
      const { error: reqError } = await supabase
        .from('purchase_requests')
        .update({ 
          status: 'CANCELADA',
          cancelled_by: profile?.id,
          cancelled_at: new Date().toISOString(),
          cancellation_reason: 'Cancelado pela unidade'
        })
        .eq('id', solicitacao.id);

      if (reqError) throw reqError;

      // 2. Voltar a folga compensatória para GERADA
      // Precisamos do compensatory_day_id. Como a query original não trouxe o ID, vamos buscar.
      const { data: reqData } = await supabase.from('purchase_requests').select('compensatory_day_id').eq('id', solicitacao.id).single();
      
      if (reqData && reqData.compensatory_day_id) {
        const { error: updError } = await supabase
          .from('compensatory_days')
          .update({ status: 'GERADA' })
          .eq('id', reqData.compensatory_day_id);
          
        if (updError) throw updError;
      }

      fetchData(false); // Recarrega tudo
    } catch (err: any) {
      alert(err.message || "Erro ao cancelar solicitação.");
    }
  };
```

New:
```tsx
  const executeCancelRequest = async (solicitacao: Solicitacao) => {
    const result = await cancelar(solicitacao);
    if (!result.ok) {
      setInfoModal({ title: 'Erro', message: result.message, type: 'error' });
    }
  };
```

(`useSolicitacoesData`'s `SOLICITACAO_SELECT` already fetches `compensatory_day_id` on every request, so `cancelar` doesn't need the extra round-trip lookup the old code did — same end result, one less query.)

- [ ] **Step 4: Rewrite `executeBulkApprove`**

Old:
```tsx
  const executeBulkApprove = async () => {
    setIsSubmitting(true);
    let errorCount = 0;
    
    for (const id of selectedRequests) {
      try {
        const { error: reqError } = await supabase
          .from('purchase_requests')
          .update({ 
            status: 'APROVADA',
            analyzed_by: profile?.id,
            analyzed_at: new Date().toISOString()
          })
          .eq('id', id);
  
        if (reqError) throw reqError;
  
        const { data: reqData } = await supabase.from('purchase_requests').select('compensatory_day_id').eq('id', id).single();
        if (reqData && reqData.compensatory_day_id) {
          const { error: updError } = await supabase
            .from('compensatory_days')
            .update({ status: 'INDENIZADA', decided_by: profile?.id, decided_at: new Date().toISOString() })
            .eq('id', reqData.compensatory_day_id);
          if (updError) throw updError;
        }
      } catch (err: any) {
        if (err.message?.includes('ORCAMENTO_EXCEDIDO')) {
          setInfoModal({
            title: '🚫 Bloqueio do Sistema (Orçamento Excedido)',
            message: err.message.replace('ORCAMENTO_EXCEDIDO: ', '') + '\n\n(A aprovação em lote foi interrompida nas demais solicitações)',
            type: 'error'
          });
          break; // Stop bulk processing if budget exceeded
        } else {
          console.error(err);
          errorCount++;
        }
      }
    }

    if (errorCount > 0) {
      setInfoModal({
        title: 'Erro ao Aprovar',
        message: `Houve erro ao aprovar ${errorCount} solicitação(ões). As demais foram processadas.`,
        type: 'error'
      });
    }

    setSelectedRequests([]);
    setIsSubmitting(false);
    fetchData(false);
  };
```

New:
```tsx
  const executeBulkApprove = async () => {
    setIsSubmitting(true);
    const selecionadas = solicitacoes.filter(s => selectedRequests.includes(s.id));
    const result = await aprovarEmLote(selecionadas);
    setIsSubmitting(false);
    setSelectedRequests([]);

    if (!result.ok) {
      setInfoModal({
        title: 'Erro ao Aprovar em Lote',
        message: result.details ? `${result.message}\n\n${result.details.join('\n')}` : result.message,
        type: 'error'
      });
    }
  };
```

- [ ] **Step 5: Rewrite `executeApproveRequest`**

Old:
```tsx
  const executeApproveRequest = async (solicitacao: Solicitacao) => {
    try {
      const { error: reqError } = await supabase
        .from('purchase_requests')
        .update({ 
          status: 'APROVADA',
          analyzed_by: profile?.id,
          analyzed_at: new Date().toISOString()
        })
        .eq('id', solicitacao.id);

      if (reqError) throw reqError;

      const { data: reqData } = await supabase.from('purchase_requests').select('compensatory_day_id').eq('id', solicitacao.id).single();
      if (reqData && reqData.compensatory_day_id) {
        const { error: updError } = await supabase
          .from('compensatory_days')
          .update({ status: 'INDENIZADA', decided_by: profile?.id, decided_at: new Date().toISOString() })
          .eq('id', reqData.compensatory_day_id);
        if (updError) throw updError;
      }
      fetchData(false);
    } catch (err: any) {
      if (err.message?.includes('ORCAMENTO_EXCEDIDO')) {
        setInfoModal({
          title: '🚫 Bloqueio do Sistema',
          message: err.message.replace('ORCAMENTO_EXCEDIDO: ', ''),
          type: 'error'
        });
      } else {
        setInfoModal({
          title: 'Erro ao Aprovar',
          message: err.message || 'Erro ao aprovar.',
          type: 'error'
        });
      }
    }
  };
```

New:
```tsx
  const executeApproveRequest = async (solicitacao: Solicitacao) => {
    const result = await aprovar(solicitacao);
    if (!result.ok) {
      setInfoModal({ title: 'Erro ao Aprovar', message: result.message, type: 'error' });
    }
  };
```

- [ ] **Step 6: Rewrite `handleRejectRequest`**

This keeps `window.prompt` for now — Task 8 replaces it with `ConfirmDialog`'s reason field alongside the rest of the dialog swap.

Old:
```tsx
  const handleRejectRequest = async (solicitacao: Solicitacao) => {
    const reason = window.prompt('Qual o motivo da rejeição? (O orçamento será devolvido e a folga voltará a ficar disponível)');
    if (!reason) return; // cancelou o prompt

    try {
      const { error: reqError } = await supabase
        .from('purchase_requests')
        .update({ 
          status: 'REJEITADA',
          analyzed_by: profile?.id,
          analyzed_at: new Date().toISOString(),
          rejection_reason: reason
        })
        .eq('id', solicitacao.id);

      if (reqError) throw reqError;

      const { data: reqData } = await supabase.from('purchase_requests').select('compensatory_day_id').eq('id', solicitacao.id).single();
      if (reqData && reqData.compensatory_day_id) {
        const { error: updError } = await supabase
          .from('compensatory_days')
          .update({ status: 'GERADA', decided_by: profile?.id, decided_at: new Date().toISOString() })
          .eq('id', reqData.compensatory_day_id);
        if (updError) throw updError;
      }
      fetchData(false);
    } catch (err: any) {
      alert(err.message || "Erro ao rejeitar.");
    }
  };
```

New:
```tsx
  const handleRejectRequest = async (solicitacao: Solicitacao) => {
    const reason = window.prompt('Qual o motivo da rejeição? (O orçamento será devolvido e a folga voltará a ficar disponível)');
    if (!reason) return; // cancelou o prompt

    const result = await rejeitar(solicitacao, reason);
    if (!result.ok) {
      setInfoModal({ title: 'Erro', message: result.message, type: 'error' });
    }
  };
```

- [ ] **Step 7: Remove the now-unused `supabase` import**

Confirm no reference to `supabase.` remains anywhere in `Solicitacoes.tsx` (Steps 1–6 above removed the last ones, together with Task 6's Steps 5–7). If none remain, delete:
```tsx
import { supabase } from '../../lib/supabase';
```

- [ ] **Step 8: Verify the build**

Run: `cd "c:/Projetos/SEAP/Sistema - Folga Compensatória/frontend" && npm run build`
Expected: succeeds — this is the first green build since Task 5, now that both halves of the handler rewiring are done.

- [ ] **Step 9: Manual verification**

With the dev server running, open `/estabelecimento/solicitacoes` and exercise every action end to end:
- Comprar uma folga individual (dentro e fora do orçamento) — mesmo comportamento de bloqueio/mensagem de antes.
- Solicitar em lote (dentro e fora do orçamento).
- Registrar gozo de uma folga, editar o gozo, excluir o registro de gozo (volta pra "Folgas Disponíveis").
- Aprovar uma solicitação individual, rejeitar uma (o prompt nativo ainda aparece — Task 8 troca isso), cancelar uma solicitação/compra.
- Aprovar em lote (dentro e fora do orçamento, inclusive um lote que estoura no meio do processamento).
- Confirm every one of these actually persists by checking the table after each action (status, valor, orçamento cards) — not just that no error appeared.

- [ ] **Step 10: Commit**

```bash
cd "c:/Projetos/SEAP/Sistema - Folga Compensatória"
git add frontend/src/pages/estabelecimento/Solicitacoes.tsx
git commit -m "refactor: Solicitacoes.tsx termina de migrar para useSolicitacoesData (gozo, cancelamento, aprovacao)"
```

---

### Task 8: Solicitacoes.tsx — swap confirmAction/infoModal/window.prompt for ConfirmDialog/AlertDialog

**Note on scope:** `Solicitacoes.tsx` has no toast today (unlike `Folgas.tsx`) — every action's failure already shows a blocking `infoModal`, and every success just closes the modal and lets the table refresh with no message. This task preserves that exactly: no `useToast()` calls are introduced here, only the two existing bespoke dialogs (`confirmAction`, `infoModal`) become `ConfirmDialog`/`AlertDialog`, and the one remaining native dialog (`handleRejectRequest`'s `window.prompt`) becomes `ConfirmDialog`'s built-in `reason` field.

**Files:**
- Modify: `frontend/src/pages/estabelecimento/Solicitacoes.tsx`

**Interfaces:**
- Consumes: `ConfirmDialog`, `AlertDialog` from `../../components/ui/{ConfirmDialog,AlertDialog}` (Task 4's `Modal` already supports `blueprint`; `ConfirmDialog`/`AlertDialog` both forward props to `Modal` but don't yet expose a `blueprint` prop themselves — passed through in Step 1 below).

- [ ] **Step 1: Pass `blueprint` through ConfirmDialog and AlertDialog**

Both components currently render `<Modal ... >` without forwarding a `blueprint` option. Add it the same way `tone`/`size` already work.

Old (`frontend/src/components/ui/ConfirmDialog.tsx`, `ConfirmDialogProps` type):
```tsx
export type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  tone?: Extract<ModalTone, 'default' | 'danger' | 'warning'>;
  busy?: boolean;
  /** When set, a required free-text reason is collected and passed to onConfirm. */
  reason?: {
    label: string;
    placeholder?: string;
    minLength?: number;
    maxLength?: number;
  };
  onConfirm: (reason: string) => void;
  onCancel: () => void;
};
```

New (add one field):
```tsx
export type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  tone?: Extract<ModalTone, 'default' | 'danger' | 'warning'>;
  busy?: boolean;
  blueprint?: boolean;
  /** When set, a required free-text reason is collected and passed to onConfirm. */
  reason?: {
    label: string;
    placeholder?: string;
    minLength?: number;
    maxLength?: number;
  };
  onConfirm: (reason: string) => void;
  onCancel: () => void;
};
```

Old (component signature and the `<Modal` call, current lines 28–59):
```tsx
export const ConfirmDialog = ({
  open,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  tone = 'default',
  busy = false,
  reason,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) => {
  const [value, setValue] = useState('');
  const minLength = reason?.minLength ?? 0;
  const maxLength = reason?.maxLength ?? 500;
  const tooShort = Boolean(reason) && value.trim().length < minLength;

  useEffect(() => {
    if (open) setValue('');
  }, [open]);

  const confirmClass =
    tone === 'danger' ? 'btn btn-danger' : tone === 'warning' ? 'btn btn-primary' : 'btn btn-primary';

  return (
    <Modal
      open={open}
      title={title}
      onClose={onCancel}
      size="sm"
      tone={tone}
      closeOnBackdrop={!reason}
```

New:
```tsx
export const ConfirmDialog = ({
  open,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  tone = 'default',
  busy = false,
  blueprint = false,
  reason,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) => {
  const [value, setValue] = useState('');
  const minLength = reason?.minLength ?? 0;
  const maxLength = reason?.maxLength ?? 500;
  const tooShort = Boolean(reason) && value.trim().length < minLength;

  useEffect(() => {
    if (open) setValue('');
  }, [open]);

  const confirmClass =
    tone === 'danger' ? 'btn btn-danger' : tone === 'warning' ? 'btn btn-primary' : 'btn btn-primary';

  return (
    <Modal
      open={open}
      title={title}
      onClose={onCancel}
      size="sm"
      tone={tone}
      blueprint={blueprint}
      closeOnBackdrop={!reason}
```

Apply the identical pattern to `frontend/src/components/ui/AlertDialog.tsx`: add `blueprint?: boolean;` to `AlertDialogProps`, add `blueprint = false` to the destructured props, and add `blueprint={blueprint}` to its `<Modal ...>` call (which currently reads `tone={tone === 'info' ? 'default' : tone}` — add the new prop right after that line).

- [ ] **Step 2: Import the two dialogs in Solicitacoes.tsx**

Add near the top of `frontend/src/pages/estabelecimento/Solicitacoes.tsx`:
```tsx
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { AlertDialog } from '../../components/ui/AlertDialog';
```

- [ ] **Step 3: Extend the `confirmAction` state type with an optional `reason` field**

Old:
```tsx
  // Modal de Confirmação Genérico
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
  } | null>(null);
```

New:
```tsx
  // Modal de Confirmação Genérico
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    message: string;
    onConfirm: (reason: string) => void;
    confirmText?: string;
    reason?: { label: string; placeholder?: string; minLength?: number; maxLength?: number };
  } | null>(null);
```

(Existing call sites that assign `onConfirm: () => { ... }` with no parameter stay valid as-is — TypeScript allows assigning a callback that takes fewer parameters than the declared type.)

- [ ] **Step 4: Fix the one remaining native `alert()` in `handleCancelRequest`**

Old:
```tsx
  const handleCancelRequest = (solicitacao: Solicitacao) => {
    if (solicitacao.status !== 'SOLICITADA' && solicitacao.status !== 'APROVADA') {
      alert('Apenas solicitações aguardando aprovação ou aprovadas podem ser canceladas.');
      return;
    }
    
    setConfirmAction({
```

New:
```tsx
  const handleCancelRequest = (solicitacao: Solicitacao) => {
    if (solicitacao.status !== 'SOLICITADA' && solicitacao.status !== 'APROVADA') {
      setInfoModal({ title: 'Ação não permitida', message: 'Apenas solicitações aguardando aprovação ou aprovadas podem ser canceladas.', type: 'warning' });
      return;
    }

    setConfirmAction({
```

- [ ] **Step 5: Replace `handleRejectRequest` with a ConfirmDialog-driven flow**

Old (from Task 7, Step 6):
```tsx
  const handleRejectRequest = async (solicitacao: Solicitacao) => {
    const reason = window.prompt('Qual o motivo da rejeição? (O orçamento será devolvido e a folga voltará a ficar disponível)');
    if (!reason) return; // cancelou o prompt

    const result = await rejeitar(solicitacao, reason);
    if (!result.ok) {
      setInfoModal({ title: 'Erro', message: result.message, type: 'error' });
    }
  };
```

New:
```tsx
  const handleRejectRequest = (solicitacao: Solicitacao) => {
    setConfirmAction({
      title: 'Rejeitar Solicitação',
      message: 'O orçamento será devolvido e a folga voltará a ficar disponível.',
      confirmText: 'Rejeitar',
      reason: { label: 'Motivo da rejeição *', placeholder: 'Explique o motivo da rejeição...', minLength: 1, maxLength: 500 },
      onConfirm: (reason) => {
        setConfirmAction(null);
        executeRejectRequest(solicitacao, reason);
      }
    });
  };

  const executeRejectRequest = async (solicitacao: Solicitacao, reason: string) => {
    const result = await rejeitar(solicitacao, reason);
    if (!result.ok) {
      setInfoModal({ title: 'Erro', message: result.message, type: 'error' });
    }
  };
```

- [ ] **Step 6: Replace the confirmAction and infoModal JSX blocks**

Old (both blocks, current — find them near the end of the JSX, right after the "Modal de Compra" block):
```tsx
      {/* Modal de Confirmação Genérico */}
      {confirmAction && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="blueprint card elev-md" style={{ width: '400px', padding: 'var(--space-6)', background: 'var(--color-surface)' }}>
            <h3 style={{ marginTop: 0, marginBottom: 'var(--space-4)' }}>{confirmAction.title}</h3>
            <p style={{ color: 'var(--color-text)', marginBottom: 'var(--space-5)', lineHeight: 1.5 }}>
              {confirmAction.message}
            </p>
            <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setConfirmAction(null)}>Cancelar</button>
              <button 
                className="btn btn-primary blueprint" 
                onClick={confirmAction.onConfirm}
              >
                <i className="corner tl"></i><i className="corner tr"></i><i className="corner bl"></i><i className="corner br"></i>
                {confirmAction.confirmText || 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Aviso/Erro Genérico */}
      {infoModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="blueprint card elev-md" style={{ width: '420px', padding: 'var(--space-6)', background: 'var(--color-surface)' }}>
            <h3 style={{
              marginTop: 0, marginBottom: 'var(--space-4)',
              color: infoModal.type === 'warning' ? '#b45309' : '#b91c1c'
            }}>
              {infoModal.title}
            </h3>
            <p style={{ color: 'var(--color-text)', marginBottom: 'var(--space-5)', lineHeight: 1.5, whiteSpace: 'pre-line' }}>
              {infoModal.message}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-primary blueprint"
                onClick={() => setInfoModal(null)}
              >
                <i className="corner tl"></i><i className="corner tr"></i><i className="corner bl"></i><i className="corner br"></i>
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}
```

New:
```tsx
      <ConfirmDialog
        open={!!confirmAction}
        title={confirmAction?.title ?? ''}
        message={confirmAction?.message ?? ''}
        confirmText={confirmAction?.confirmText}
        reason={confirmAction?.reason}
        blueprint
        onConfirm={(reason) => confirmAction?.onConfirm(reason)}
        onCancel={() => setConfirmAction(null)}
      />

      <AlertDialog
        open={!!infoModal}
        title={infoModal?.title ?? ''}
        message={infoModal?.message ?? ''}
        tone={infoModal?.type === 'warning' ? 'warning' : 'danger'}
        blueprint
        onClose={() => setInfoModal(null)}
      />
```

- [ ] **Step 7: Verify the build**

Run: `cd "c:/Projetos/SEAP/Sistema - Folga Compensatória/frontend" && npm run build`
Expected: succeeds.

- [ ] **Step 8: Manual verification**

With the dev server running, open `/estabelecimento/solicitacoes`:
- Trigger every confirm flow (excluir gozo, cancelar solicitação, aprovar individual, aprovar em lote) → dialog has blueprint corners, ESC/backdrop-click cancel, Tab stays trapped inside.
- Reject a solicitação → dialog now asks for the motivo inline (no browser `window.prompt`), the confirm button is disabled until you type something, submitting calls through to the same rejection flow as before (status → REJEITADA, compensatory day → GERADA, orçamento reflects the return).
- Trigger an error path (e.g., insufficient budget on approve) → `AlertDialog` shows the same multi-line message as before (confirm the `\n\n` breakdown still renders as separate lines, not squished into one paragraph).
- Try to cancel a REJEITADA/CANCELADA request from the UI (should be impossible via the button, but if reachable, confirm the "Ação não permitida" dialog now shows instead of a browser alert).

- [ ] **Step 9: Commit**

```bash
cd "c:/Projetos/SEAP/Sistema - Folga Compensatória"
git add frontend/src/components/ui/ConfirmDialog.tsx frontend/src/components/ui/AlertDialog.tsx frontend/src/pages/estabelecimento/Solicitacoes.tsx
git commit -m "refactor: Solicitacoes.tsx troca confirmAction/infoModal/window.prompt por ConfirmDialog/AlertDialog"
```

---

### Task 9: Solicitacoes.tsx — Folgas Disponíveis usa useTableControls + TableToolbar + Pagination

**Small behavior note (disclosed):** the current cargo filter for this specific list compares `f.employees.positions.id` — the other two lists in this file (Solicitações do Ciclo, Folgas Usufruídas) compare `.codigo` instead. `useTableControls` standardizes on `.codigo`. Since `codigo` is a unique short code per cargo (already relied on elsewhere in this file and across the app), switching this list to match is behaviorally equivalent and makes all three lists consistent with each other — not a functional change a user would notice.

**Files:**
- Modify: `frontend/src/pages/estabelecimento/Solicitacoes.tsx`

**Interfaces:**
- Consumes: `useTableControls` from `../../hooks/useTableControls`, `TableToolbar` from `../../components/ui/TableToolbar`, `Pagination` from `../../components/ui/Pagination`, `EmptyState` from `../../components/ui/States`.

- [ ] **Step 1: Add imports**

```tsx
import { useTableControls } from '../../hooks/useTableControls';
import { TableToolbar } from '../../components/ui/TableToolbar';
import { Pagination } from '../../components/ui/Pagination';
import { EmptyState } from '../../components/ui/States';
```

- [ ] **Step 2: Remove the Folgas Disponíveis filter/pagination state and its reset effect**

Old (part of Task 6's state block):
```tsx
  // Filtros para Folgas
  const [buscaFolga, setBuscaFolga] = useState('');
  const [filtroCargoFolga, setFiltroCargoFolga] = useState('');
```
and, further down:
```tsx
  // Paginação
  const [currentPageFolgas, setCurrentPageFolgas] = useState(1);
  const [currentPageSolicitacoes, setCurrentPageSolicitacoes] = useState(1);
  const ITEMS_PER_PAGE = 24;
```
and the effect:
```tsx
  useEffect(() => {
    setCurrentPageFolgas(1);
  }, [buscaFolga, filtroCargoFolga]);
```

New — delete the "Filtros para Folgas" block and the `setCurrentPageFolgas` effect entirely; keep `currentPageSolicitacoes`/`ITEMS_PER_PAGE` (still used by the other two lists until Tasks 10–11 convert them too):
```tsx
  // Paginação
  const [currentPageSolicitacoes, setCurrentPageSolicitacoes] = useState(1);
  const ITEMS_PER_PAGE = 24;
```

- [ ] **Step 3: Add the `folgasControls` hook call**

Add this near the top of the component body, after the `useSolicitacoesData` destructure (order doesn't matter functionally, but keeping it close to where `folgasDisponiveis` comes from keeps the file readable):
```tsx
  const folgasControls = useTableControls<FolgaDisponivel>({
    items: folgasDisponiveis,
    searchable: (f) => [f.employees?.nome, f.employees?.matricula],
    cargoOf: (f) => (f.employees?.positions ? { codigo: f.employees.positions.codigo, nome: f.employees.positions.nome } : null),
    comparators: { nome: (a, b) => (a.employees?.nome || '').localeCompare(b.employees?.nome || '', 'pt-BR') },
    defaultSortKey: 'nome',
    pageSize: ITEMS_PER_PAGE,
  });
```

- [ ] **Step 4: Replace the Folgas Disponíveis rendering block**

Old (the whole `{(() => { ... })()}` IIFE, current lines ~970–1098):
```tsx
          {(() => {
            const cargosFolga = Array.from(
              new Map(folgasDisponiveis.map(f => [f.employees.positions.id, f.employees.positions])).values()
            ).sort((a, b) => a.nome.localeCompare(b.nome));

            const folgasFiltradas = folgasDisponiveis
              .filter(f => 
                ((f.employees.nome || '').toLowerCase().includes(buscaFolga.toLowerCase()) ||
                (f.employees.matricula || '').includes(buscaFolga)) &&
                (filtroCargoFolga === '' || f.employees.positions.id === filtroCargoFolga)
              )
              .sort((a, b) => (a.employees.nome || '').localeCompare(b.employees.nome || ''));

            const totalPagesFolgas = Math.ceil(folgasFiltradas.length / ITEMS_PER_PAGE);
            const paginatedFolgas = folgasFiltradas.slice((currentPageFolgas - 1) * ITEMS_PER_PAGE, currentPageFolgas * ITEMS_PER_PAGE);

            return (
              <>
                {folgasDisponiveis.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '16px', alignItems: 'center' }}>
                    <div style={{ marginRight: '8px', display: 'flex', alignItems: 'center' }}>
                      <input 
                        type="checkbox"
                        checked={paginatedFolgas.length > 0 && selectedFolgas.length >= paginatedFolgas.length && paginatedFolgas.every(f => selectedFolgas.includes(f.id))}
                        onChange={(e) => {
                          if (e.target.checked) {
                            const newSelection = [...selectedFolgas];
                            paginatedFolgas.forEach(f => {
                              if (!newSelection.includes(f.id)) newSelection.push(f.id);
                            });
                            setSelectedFolgas(newSelection);
                          } else {
                            setSelectedFolgas(selectedFolgas.filter(id => !paginatedFolgas.some(f => f.id === id)));
                          }
                        }}
                        title="Selecionar folgas desta página"
                      />
                    </div>
                    <input
                      type="text"
                      className="input"
                      placeholder="🔍 Buscar por nome ou matrícula..."
                      value={buscaFolga}
                      onChange={e => setBuscaFolga(e.target.value)}
                      style={{ flex: 1 }}
                    />
                    <select
                      className="input"
                      style={{ flex: '1 1 150px', minWidth: '150px' }}
                      value={filtroCargoFolga}
                      onChange={e => setFiltroCargoFolga(e.target.value)}
                    >
                      <option value="">Todos os cargos</option>
                      {cargosFolga.map(c => (
                        <option key={c.id} value={c.id}>{c.nome}</option>
                      ))}
                    </select>
                  </div>
                )}

                {folgasDisponiveis.length === 0 ? (
                  <div className="blueprint card" style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                    Nenhuma folga nova gerada neste ciclo. Vá na tela de "Banco de Folgas" para lançar os plantões.
                  </div>
                ) : folgasFiltradas.length === 0 ? (
                  <div className="blueprint card" style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                    Nenhuma folga encontrada para os filtros aplicados.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                    {paginatedFolgas.map(f => (
                  <div key={f.id} className="blueprint card" style={{ padding: 'var(--space-3)', border: selectedFolgas.includes(f.id) ? '1px solid var(--color-primary)' : '' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <input 
                          type="checkbox" 
                          checked={selectedFolgas.includes(f.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedFolgas(prev => [...prev, f.id]);
                            } else {
                              setSelectedFolgas(prev => prev.filter(id => id !== f.id));
                            }
                          }}
                        />
                        <div>
                          <strong>{f.employees.nome} ({f.employees.matricula})</strong>
                          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                            {f.employees.positions.nome} | {f.quantidade_plantoes} plantões
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                        <strong style={{ color: 'var(--color-text)', fontSize: '15px' }}>
                          R$ {((positionValues[f.employees.positions.id] || 0) * f.quantidade_plantoes).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </strong>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button className="btn btn-primary" style={{ padding: '4px 12px', fontSize: '12px' }} onClick={() => openCompraModal(f)}>
                            Comprar Folga
                          </button>
                          <button className="btn" style={{ padding: '4px 12px', fontSize: '12px', background: 'var(--color-surface)', border: '1px solid var(--color-divider)' }} onClick={() => openUsufrutoModal(f)}>
                            Registrar Gozo
                          </button>
                        </div>
                      </div>
                    </div>
                 </div>
                    ))}

                    {totalPagesFolgas > 1 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-3) 0', borderTop: '1px solid var(--color-divider)' }}>
                        <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                          Mostrando {(currentPageFolgas - 1) * ITEMS_PER_PAGE + 1} até {Math.min(currentPageFolgas * ITEMS_PER_PAGE, folgasFiltradas.length)} de {folgasFiltradas.length} folgas
                        </span>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: '12px' }} disabled={currentPageFolgas === 1} onClick={() => setCurrentPageFolgas(p => p - 1)}>
                            Anterior
                          </button>
                          <button className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: '12px' }} disabled={currentPageFolgas === totalPagesFolgas} onClick={() => setCurrentPageFolgas(p => p + 1)}>
                            Próxima
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            );
          })()}
```

New:
```tsx
          {(() => {
            const { filtered: folgasFiltradas, pageItems: paginatedFolgas, page, setPage, totalPages: totalPagesFolgas, rangeStart, rangeEnd, total, search, setSearch, cargo, setCargo, cargoOptions } = folgasControls;

            return (
              <>
                {folgasDisponiveis.length > 0 && (
                  <TableToolbar
                    id="folgas-disponiveis"
                    search={search}
                    onSearchChange={setSearch}
                    cargo={cargo}
                    onCargoChange={setCargo}
                    cargoOptions={cargoOptions}
                  >
                    <div style={{ marginRight: '8px', display: 'flex', alignItems: 'center' }}>
                      <input
                        type="checkbox"
                        className="ui-checkbox"
                        checked={paginatedFolgas.length > 0 && selectedFolgas.length >= paginatedFolgas.length && paginatedFolgas.every(f => selectedFolgas.includes(f.id))}
                        onChange={(e) => {
                          if (e.target.checked) {
                            const newSelection = [...selectedFolgas];
                            paginatedFolgas.forEach(f => {
                              if (!newSelection.includes(f.id)) newSelection.push(f.id);
                            });
                            setSelectedFolgas(newSelection);
                          } else {
                            setSelectedFolgas(selectedFolgas.filter(id => !paginatedFolgas.some(f => f.id === id)));
                          }
                        }}
                        title="Selecionar folgas desta página"
                      />
                    </div>
                  </TableToolbar>
                )}

                {folgasDisponiveis.length === 0 ? (
                  <EmptyState>
                    Nenhuma folga nova gerada neste ciclo. Vá na tela de "Banco de Folgas" para lançar os plantões.
                  </EmptyState>
                ) : folgasFiltradas.length === 0 ? (
                  <EmptyState>Nenhuma folga encontrada para os filtros aplicados.</EmptyState>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                    {paginatedFolgas.map(f => (
                  <div key={f.id} className="blueprint card" style={{ padding: 'var(--space-3)', border: selectedFolgas.includes(f.id) ? '1px solid var(--color-primary)' : '' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <input 
                          type="checkbox" 
                          checked={selectedFolgas.includes(f.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedFolgas(prev => [...prev, f.id]);
                            } else {
                              setSelectedFolgas(prev => prev.filter(id => id !== f.id));
                            }
                          }}
                        />
                        <div>
                          <strong>{f.employees.nome} ({f.employees.matricula})</strong>
                          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                            {f.employees.positions.nome} | {f.quantidade_plantoes} plantões
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                        <strong style={{ color: 'var(--color-text)', fontSize: '15px' }}>
                          R$ {((positionValues[f.employees.positions.id] || 0) * f.quantidade_plantoes).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </strong>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button className="btn btn-primary" style={{ padding: '4px 12px', fontSize: '12px' }} onClick={() => openCompraModal(f)}>
                            Comprar Folga
                          </button>
                          <button className="btn" style={{ padding: '4px 12px', fontSize: '12px', background: 'var(--color-surface)', border: '1px solid var(--color-divider)' }} onClick={() => openUsufrutoModal(f)}>
                            Registrar Gozo
                          </button>
                        </div>
                      </div>
                    </div>
                 </div>
                    ))}

                    <Pagination
                      page={page}
                      totalPages={totalPagesFolgas}
                      rangeStart={rangeStart}
                      rangeEnd={rangeEnd}
                      total={total}
                      itemLabel="folgas"
                      onPageChange={setPage}
                    />
                  </div>
                )}
              </>
            );
          })()}
```

- [ ] **Step 5: Verify the build**

Run: `cd "c:/Projetos/SEAP/Sistema - Folga Compensatória/frontend" && npm run build`
Expected: succeeds.

- [ ] **Step 6: Manual verification**

With the dev server running, open `/estabelecimento/solicitacoes`:
- The "Folgas Disponíveis" list still shows a search box + cargo dropdown + select-all checkbox on the same line.
- Search by nome/matrícula, filter by cargo, select individual/all-on-page checkboxes, page through results (if there are more than 24) — all behave exactly as before.
- Click "Comprar Folga" and "Registrar Gozo" on a card — both still open their modals correctly.

- [ ] **Step 7: Commit**

```bash
cd "c:/Projetos/SEAP/Sistema - Folga Compensatória"
git add frontend/src/pages/estabelecimento/Solicitacoes.tsx
git commit -m "refactor: lista de Folgas Disponiveis usa useTableControls/TableToolbar/Pagination"
```

---

### Task 10: Solicitacoes.tsx — tabela "Solicitações do Ciclo" usa useTableControls + SortableTh + TableToolbar + Pagination

**Files:**
- Modify: `frontend/src/pages/estabelecimento/Solicitacoes.tsx`

**Interfaces:**
- Consumes: `SortableTh` from `../../components/ui/SortableTh` (already imported components from Task 9 cover the rest).

- [ ] **Step 1: Import `SortableTh`**

```tsx
import { SortableTh } from '../../components/ui/SortableTh';
```

- [ ] **Step 2: Remove the filter/sort/pagination state for this table and its reset effect**

Old:
```tsx
  // Filtros para Solicitações do Ciclo
  const [buscaSolicitacoes, setBuscaSolicitacoes] = useState('');
  const [filtroCargoSolicitacoes, setFiltroCargoSolicitacoes] = useState('');
```
and:
```tsx
  const [sortColumnSol, setSortColumnSol] = useState<SortColumnSol | null>(null);
  const [sortDirectionSol, setSortDirectionSol] = useState<SortDirection>('asc');
```
and:
```tsx
  useEffect(() => {
    setCurrentPageSolicitacoes(1);
  }, [buscaSolicitacoes, filtroCargoSolicitacoes]);
```

Delete all three. Also delete the now ONLY-here type `SortColumnSol` from the top-of-file type declarations (current line 6):
```tsx
type SortColumnSol = 'servidor' | 'tipo' | 'data_plantao' | 'valor' | 'status';
```
(`SortDirection` and `SortColumnUsufruida` stay — the Usufruídas table still uses them until Task 11.)

Also delete `currentPageSolicitacoes`'s own declaration (it's fully superseded by `useTableControls`'s internal `page`):
```tsx
  const [currentPageSolicitacoes, setCurrentPageSolicitacoes] = useState(1);
```
keeping only:
```tsx
  const ITEMS_PER_PAGE = 24;
```

- [ ] **Step 3: Add the `solicitacoesControls` hook call**

Add next to `folgasControls` (Task 9, Step 3):
```tsx
  const solicitacoesControls = useTableControls<Solicitacao>({
    items: solicitacoes,
    searchable: (s) => [s.employees?.nome, s.employees?.matricula],
    cargoOf: (s) => (s.employees?.positions ? { codigo: s.employees.positions.codigo, nome: s.employees.positions.nome } : null),
    comparators: {
      servidor: (a, b) => (a.employees?.nome || '').localeCompare(b.employees?.nome || '', 'pt-BR'),
      tipo: (a, b) => {
        const valA = a.tipo_solicitacao === 'PLANTAO_PLUS' ? 'Plantão Plus' : 'Folga';
        const valB = b.tipo_solicitacao === 'PLANTAO_PLUS' ? 'Plantão Plus' : 'Folga';
        return valA.localeCompare(valB, 'pt-BR');
      },
      data_plantao: (a, b) => (a.data_plantao || '').localeCompare(b.data_plantao || ''),
      valor: (a, b) => (a.valor || 0) - (b.valor || 0),
      status: (a, b) => (a.status || '').localeCompare(b.status || '', 'pt-BR'),
    },
    defaultSortKey: null,
    pageSize: ITEMS_PER_PAGE,
  });
```

- [ ] **Step 4: Delete the hand-rolled derived values and sort helpers**

Delete these five blocks in full — everything `useTableControls` now covers:
```tsx
  const cargosDisponiveisSolicitacoes = React.useMemo(() => Array.from(
    new Map(solicitacoes
      .filter(s => s.employees?.positions?.nome)
      .map(s => [s.employees.positions.codigo, s.employees.positions.nome])
    ).entries()
  ).sort((a, b) => a[1].localeCompare(b[1], 'pt-BR')), [solicitacoes]);

  const filteredSolicitacoes = React.useMemo(() => {
    return solicitacoes.filter(s => {
      const termo = buscaSolicitacoes.toLowerCase();
      const matchBusca = !termo ||
        (s.employees?.nome || '').toLowerCase().includes(termo) ||
        (s.employees?.matricula || '').toLowerCase().includes(termo);
      const matchCargo = !filtroCargoSolicitacoes || s.employees?.positions?.codigo === filtroCargoSolicitacoes;
      return matchBusca && matchCargo;
    });
  }, [solicitacoes, buscaSolicitacoes, filtroCargoSolicitacoes]);

  const sortedSolicitacoes = React.useMemo(() => {
    if (!sortColumnSol) return filteredSolicitacoes;
    const sorted = [...filteredSolicitacoes].sort((a, b) => {
      if (sortColumnSol === 'servidor') {
        return (a.employees?.nome || '').localeCompare(b.employees?.nome || '', 'pt-BR');
      }
      if (sortColumnSol === 'tipo') {
        const valA = a.tipo_solicitacao === 'PLANTAO_PLUS' ? 'Plantão Plus' : 'Folga';
        const valB = b.tipo_solicitacao === 'PLANTAO_PLUS' ? 'Plantão Plus' : 'Folga';
        return valA.localeCompare(valB, 'pt-BR');
      }
      if (sortColumnSol === 'data_plantao') {
        return (a.data_plantao || '').localeCompare(b.data_plantao || '');
      }
      if (sortColumnSol === 'valor') {
        return (a.valor || 0) - (b.valor || 0);
      }
      if (sortColumnSol === 'status') {
        return (a.status || '').localeCompare(b.status || '', 'pt-BR');
      }
      return 0;
    });
    return sortDirectionSol === 'asc' ? sorted : sorted.reverse();
  }, [filteredSolicitacoes, sortColumnSol, sortDirectionSol]);
```
```tsx
  const totalPagesSolicitacoes = Math.ceil(sortedSolicitacoes.length / ITEMS_PER_PAGE);
  const paginatedSolicitacoes = React.useMemo(() => {
    return sortedSolicitacoes.slice((currentPageSolicitacoes - 1) * ITEMS_PER_PAGE, currentPageSolicitacoes * ITEMS_PER_PAGE);
  }, [sortedSolicitacoes, currentPageSolicitacoes]);

  const handleSortSol = (column: SortColumnSol) => {
    if (sortColumnSol === column) {
      setSortDirectionSol(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumnSol(column);
      setSortDirectionSol('asc');
    }
  };

  const renderSortableHeaderSol = (column: SortColumnSol, label: string, align: 'left' | 'right' | 'center' = 'left') => {
    const isActive = sortColumnSol === column;
    const Icon = isActive ? (sortDirectionSol === 'asc' ? ChevronUp : ChevronDown) : ChevronsUpDown;
    return (
      <th
        style={{ padding: 'var(--space-3)', textAlign: align, cursor: 'pointer', userSelect: 'none' }}
        onClick={() => handleSortSol(column)}
        aria-sort={isActive ? (sortDirectionSol === 'asc' ? 'ascending' : 'descending') : 'none'}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', justifyContent: align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start' }}>
          {label}
          <Icon size={14} aria-hidden="true" style={{ opacity: isActive ? 1 : 0.35, flexShrink: 0 }} />
        </span>
      </th>
    );
  };
```

- [ ] **Step 5: Replace the search/cargo toolbar above the table**

Old:
```tsx
          <div style={{ display: 'flex', gap: '12px', marginBottom: 'var(--space-3)', flexWrap: 'wrap' }}>
            <input
              type="text"
              className="input"
              placeholder="🔍 Buscar por nome ou matrícula..."
              value={buscaSolicitacoes}
              onChange={e => setBuscaSolicitacoes(e.target.value)}
              style={{ flex: 1, minWidth: '180px' }}
            />
            <select
              className="input"
              style={{ width: '220px' }}
              value={filtroCargoSolicitacoes}
              onChange={e => setFiltroCargoSolicitacoes(e.target.value)}
            >
              <option value="">Todos os cargos</option>
              {cargosDisponiveisSolicitacoes.map(([codigo, nome]) => (
                <option key={codigo} value={codigo}>{nome}</option>
              ))}
            </select>
          </div>
```

New:
```tsx
          <TableToolbar
            id="solicitacoes-ciclo"
            search={solicitacoesControls.search}
            onSearchChange={solicitacoesControls.setSearch}
            cargo={solicitacoesControls.cargo}
            onCargoChange={solicitacoesControls.setCargo}
            cargoOptions={solicitacoesControls.cargoOptions}
          />
```

- [ ] **Step 6: Replace the table header cells**

Old:
```tsx
                  {renderSortableHeaderSol('servidor', 'Servidor', 'left')}
                  {renderSortableHeaderSol('tipo', 'Tipo / Qtd.', 'left')}
                  {renderSortableHeaderSol('data_plantao', 'Data do Plantão', 'left')}
                  {renderSortableHeaderSol('valor', 'Valor Solicitado', 'left')}
                  {renderSortableHeaderSol('status', 'Status', 'left')}
```

New:
```tsx
                  <SortableTh columnKey="servidor" label="Servidor" activeKey={solicitacoesControls.sortKey} direction={solicitacoesControls.sortDirection} onSort={solicitacoesControls.toggleSort} />
                  <SortableTh columnKey="tipo" label="Tipo / Qtd." activeKey={solicitacoesControls.sortKey} direction={solicitacoesControls.sortDirection} onSort={solicitacoesControls.toggleSort} />
                  <SortableTh columnKey="data_plantao" label="Data do Plantão" activeKey={solicitacoesControls.sortKey} direction={solicitacoesControls.sortDirection} onSort={solicitacoesControls.toggleSort} />
                  <SortableTh columnKey="valor" label="Valor Solicitado" activeKey={solicitacoesControls.sortKey} direction={solicitacoesControls.sortDirection} onSort={solicitacoesControls.toggleSort} />
                  <SortableTh columnKey="status" label="Status" activeKey={solicitacoesControls.sortKey} direction={solicitacoesControls.sortDirection} onSort={solicitacoesControls.toggleSort} />
```

- [ ] **Step 7: Replace the empty-state rows and the row source**

Old:
```tsx
                {solicitacoes.length === 0 ? (
                  <tr>
                    <td colSpan={7} data-label="" style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                      Nenhuma solicitação de compra feita neste ciclo.
                    </td>
                  </tr>
                ) : filteredSolicitacoes.length === 0 ? (
                  <tr>
                    <td colSpan={7} data-label="" style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                      Nenhuma solicitação encontrada com esse filtro.
                    </td>
                  </tr>
                ) : paginatedSolicitacoes.map(sol => (
```

New:
```tsx
                {solicitacoes.length === 0 ? (
                  <tr>
                    <td colSpan={7} data-label="">
                      <EmptyState variant="plain">Nenhuma solicitação de compra feita neste ciclo.</EmptyState>
                    </td>
                  </tr>
                ) : solicitacoesControls.filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} data-label="">
                      <EmptyState variant="plain">Nenhuma solicitação encontrada com esse filtro.</EmptyState>
                    </td>
                  </tr>
                ) : solicitacoesControls.pageItems.map(sol => (
```

(The `<tr>` body for each `sol` — the servidor/tipo/data/valor/status/ações cells — is unchanged; only its source array changed from `paginatedSolicitacoes` to `solicitacoesControls.pageItems`.)

- [ ] **Step 8: Replace the pagination footer**

Old:
```tsx
            {totalPagesSolicitacoes > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-3) var(--space-4)', borderTop: '1px solid var(--color-divider)' }}>
                <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                  Mostrando {(currentPageSolicitacoes - 1) * ITEMS_PER_PAGE + 1} até {Math.min(currentPageSolicitacoes * ITEMS_PER_PAGE, filteredSolicitacoes.length)} de {filteredSolicitacoes.length} solicitações
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: '12px' }} disabled={currentPageSolicitacoes === 1} onClick={() => setCurrentPageSolicitacoes(p => p - 1)}>
                    Anterior
                  </button>
                  <button className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: '12px' }} disabled={currentPageSolicitacoes === totalPagesSolicitacoes} onClick={() => setCurrentPageSolicitacoes(p => p + 1)}>
                    Próxima
                  </button>
                </div>
              </div>
            )}
```

New:
```tsx
            <Pagination
              page={solicitacoesControls.page}
              totalPages={solicitacoesControls.totalPages}
              rangeStart={solicitacoesControls.rangeStart}
              rangeEnd={solicitacoesControls.rangeEnd}
              total={solicitacoesControls.total}
              itemLabel="solicitações"
              onPageChange={solicitacoesControls.setPage}
            />
```

- [ ] **Step 9: Check for now-unused imports**

`ChevronUp, ChevronDown, ChevronsUpDown` from `lucide-react` were only used by `renderSortableHeaderSol` (deleted in Step 4) and `renderSortableHeaderUsufruida` (still present, converted in Task 11). Leave the import as-is for now — Task 11 removes it once the last usage is gone.

- [ ] **Step 10: Verify the build**

Run: `cd "c:/Projetos/SEAP/Sistema - Folga Compensatória/frontend" && npm run build`
Expected: succeeds.

- [ ] **Step 11: Manual verification**

With the dev server running, open `/estabelecimento/solicitacoes`, "Solicitações do Ciclo" tab:
- Search by nome/matrícula, filter by cargo — same results as before.
- Click each column header (Servidor, Tipo/Qtd., Data do Plantão, Valor Solicitado, Status) — sorts ascending, click again — descending, arrow icon reflects state, exactly like before.
- Page through results if there are more than 24 — same Anterior/Próxima behavior.
- Empty states (zero solicitações in the cycle vs. zero matching a filter) show the right message in each case.

- [ ] **Step 12: Commit**

```bash
cd "c:/Projetos/SEAP/Sistema - Folga Compensatória"
git add frontend/src/pages/estabelecimento/Solicitacoes.tsx
git commit -m "refactor: tabela Solicitacoes do Ciclo usa useTableControls/SortableTh/TableToolbar/Pagination"
```

---

### Task 11: Solicitacoes.tsx — tabela "Folgas Usufruídas" usa useTableControls + SortableTh + TableToolbar

**Behavior note:** this table has never had pagination (confirmed — the original renders `sortedFolgasUsufruidas.map(...)` directly, no slicing). This task keeps it that way: it reads `usufruidasControls.filtered` for rendering, not `.pageItems`, and does not render a `Pagination` component.

**Files:**
- Modify: `frontend/src/pages/estabelecimento/Solicitacoes.tsx`

- [ ] **Step 1: Remove the filter/sort state for this table**

Old:
```tsx
  // Filtros para Folgas Usufruídas
  const [buscaUsufruidas, setBuscaUsufruidas] = useState('');
  const [filtroCargoUsufruidas, setFiltroCargoUsufruidas] = useState('');
```
and:
```tsx
  const [sortColumnUsufruida, setSortColumnUsufruida] = useState<SortColumnUsufruida | null>(null);
  const [sortDirectionUsufruida, setSortDirectionUsufruida] = useState<SortDirection>('asc');
```

Delete both. Also delete the now-unused types at the top of the file:
```tsx
type SortColumnUsufruida = 'servidor' | 'data_usufruto';
type SortDirection = 'asc' | 'desc';
```
and the now-unused icon import:
```tsx
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
```
(Confirm with a search across the file that nothing else references `ChevronUp`, `ChevronDown`, `ChevronsUpDown`, `SortColumnUsufruida`, or `SortDirection` before deleting — Tasks 9/10 already removed every other usage.)

- [ ] **Step 2: Add the `usufruidasControls` hook call**

Add next to `solicitacoesControls`:
```tsx
  const usufruidasControls = useTableControls<any>({
    items: folgasUsufruidas,
    searchable: (f) => [f.employees?.nome, f.employees?.matricula],
    cargoOf: (f) => (f.employees?.positions ? { codigo: f.employees.positions.codigo, nome: f.employees.positions.nome } : null),
    comparators: {
      servidor: (a, b) => (a.employees?.nome || '').localeCompare(b.employees?.nome || '', 'pt-BR'),
      data_usufruto: (a, b) => (a.used_at || '').localeCompare(b.used_at || ''),
    },
    defaultSortKey: null,
    pageSize: ITEMS_PER_PAGE,
  });
```

- [ ] **Step 3: Delete the hand-rolled derived values and sort helpers**

Delete in full:
```tsx
  const cargosDisponiveisUsufruidas = React.useMemo(() => Array.from(
    new Map(folgasUsufruidas
      .filter(f => f.employees?.positions?.nome)
      .map(f => [f.employees.positions.codigo, f.employees.positions.nome])
    ).entries()
  ).sort((a, b) => a[1].localeCompare(b[1], 'pt-BR')), [folgasUsufruidas]);

  const filteredFolgasUsufruidas = React.useMemo(() => {
    return folgasUsufruidas.filter(f => {
      const termo = buscaUsufruidas.toLowerCase();
      const matchBusca = !termo ||
        (f.employees?.nome || '').toLowerCase().includes(termo) ||
        (f.employees?.matricula || '').toLowerCase().includes(termo);
      const matchCargo = !filtroCargoUsufruidas || f.employees?.positions?.codigo === filtroCargoUsufruidas;
      return matchBusca && matchCargo;
    });
  }, [folgasUsufruidas, buscaUsufruidas, filtroCargoUsufruidas]);

  const sortedFolgasUsufruidas = React.useMemo(() => {
    if (!sortColumnUsufruida) return filteredFolgasUsufruidas;
    const sorted = [...filteredFolgasUsufruidas].sort((a, b) => {
      if (sortColumnUsufruida === 'servidor') {
        return (a.employees?.nome || '').localeCompare(b.employees?.nome || '', 'pt-BR');
      }
      if (sortColumnUsufruida === 'data_usufruto') {
        return (a.used_at || '').localeCompare(b.used_at || '');
      }
      return 0;
    });
    return sortDirectionUsufruida === 'asc' ? sorted : sorted.reverse();
  }, [filteredFolgasUsufruidas, sortColumnUsufruida, sortDirectionUsufruida]);

  const handleSortUsufruida = (column: SortColumnUsufruida) => {
    if (sortColumnUsufruida === column) {
      setSortDirectionUsufruida(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumnUsufruida(column);
      setSortDirectionUsufruida('asc');
    }
  };

  const renderSortableHeaderUsufruida = (column: SortColumnUsufruida, label: string, align: 'left' | 'right' | 'center' = 'left') => {
    const isActive = sortColumnUsufruida === column;
    const Icon = isActive ? (sortDirectionUsufruida === 'asc' ? ChevronUp : ChevronDown) : ChevronsUpDown;
    return (
      <th
        style={{ padding: 'var(--space-3)', textAlign: align, cursor: 'pointer', userSelect: 'none' }}
        onClick={() => handleSortUsufruida(column)}
        aria-sort={isActive ? (sortDirectionUsufruida === 'asc' ? 'ascending' : 'descending') : 'none'}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', justifyContent: align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start' }}>
          {label}
          <Icon size={14} aria-hidden="true" style={{ opacity: isActive ? 1 : 0.35, flexShrink: 0 }} />
        </span>
      </th>
    );
  };
```

- [ ] **Step 4: Replace the search/cargo toolbar above the table**

Old:
```tsx
              <div style={{ display: 'flex', gap: '12px', marginBottom: 'var(--space-3)', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  className="input"
                  placeholder="🔍 Buscar por nome ou matrícula..."
                  value={buscaUsufruidas}
                  onChange={e => setBuscaUsufruidas(e.target.value)}
                  style={{ flex: 1, minWidth: '180px' }}
                />
                <select
                  className="input"
                  style={{ width: '220px' }}
                  value={filtroCargoUsufruidas}
                  onChange={e => setFiltroCargoUsufruidas(e.target.value)}
                >
                  <option value="">Todos os cargos</option>
                  {cargosDisponiveisUsufruidas.map(([codigo, nome]) => (
                    <option key={codigo} value={codigo}>{nome}</option>
                  ))}
                </select>
              </div>
```

New:
```tsx
              <TableToolbar
                id="folgas-usufruidas"
                search={usufruidasControls.search}
                onSearchChange={usufruidasControls.setSearch}
                cargo={usufruidasControls.cargo}
                onCargoChange={usufruidasControls.setCargo}
                cargoOptions={usufruidasControls.cargoOptions}
              />
```

- [ ] **Step 5: Replace the table header cells**

Old:
```tsx
                    {renderSortableHeaderUsufruida('servidor', 'Servidor', 'left')}
                    {renderSortableHeaderUsufruida('data_usufruto', 'Data de Usufruto', 'left')}
```

New:
```tsx
                    <SortableTh columnKey="servidor" label="Servidor" activeKey={usufruidasControls.sortKey} direction={usufruidasControls.sortDirection} onSort={usufruidasControls.toggleSort} />
                    <SortableTh columnKey="data_usufruto" label="Data de Usufruto" activeKey={usufruidasControls.sortKey} direction={usufruidasControls.sortDirection} onSort={usufruidasControls.toggleSort} />
```

- [ ] **Step 6: Replace the empty-state rows and the row source**

Old:
```tsx
                  {folgasUsufruidas.length === 0 ? (
                    <tr>
                      <td colSpan={3} style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                        Nenhuma folga usufruída registrada neste ciclo.
                      </td>
                    </tr>
                  ) : sortedFolgasUsufruidas.length === 0 ? (
                    <tr>
                      <td colSpan={3} style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                        Nenhuma folga usufruída encontrada com esse filtro.
                      </td>
                    </tr>
                  ) : sortedFolgasUsufruidas.map(f => (
```

New:
```tsx
                  {folgasUsufruidas.length === 0 ? (
                    <tr>
                      <td colSpan={3}>
                        <EmptyState variant="plain">Nenhuma folga usufruída registrada neste ciclo.</EmptyState>
                      </td>
                    </tr>
                  ) : usufruidasControls.filtered.length === 0 ? (
                    <tr>
                      <td colSpan={3}>
                        <EmptyState variant="plain">Nenhuma folga usufruída encontrada com esse filtro.</EmptyState>
                      </td>
                    </tr>
                  ) : usufruidasControls.filtered.map(f => (
```

(The row body for each `f` is unchanged; only the source array changed. This table stays unpaginated, per the behavior note above — `.filtered`, not `.pageItems`.)

- [ ] **Step 7: Verify the build**

Run: `cd "c:/Projetos/SEAP/Sistema - Folga Compensatória/frontend" && npm run build`
Expected: succeeds.

- [ ] **Step 8: Manual verification**

With the dev server running, open `/estabelecimento/solicitacoes`, "Folgas Usufruídas" tab:
- Search by nome/matrícula, filter by cargo — same results as before.
- Click "Servidor" / "Data de Usufruto" headers — sorts both directions, same as before.
- Confirm there's still no pagination control on this table (matches current behavior).
- Empty states show correctly for both "no data" and "no filter match".

- [ ] **Step 9: Commit**

```bash
cd "c:/Projetos/SEAP/Sistema - Folga Compensatória"
git add frontend/src/pages/estabelecimento/Solicitacoes.tsx
git commit -m "refactor: tabela Folgas Usufruidas usa useTableControls/SortableTh/TableToolbar"
```

---

### Task 12: Solicitacoes.tsx — Comprar Folga modal e Usufruto modal usam Modal blueprint + Callout

This is the last task — after this one, `Solicitacoes.tsx` has no remaining hand-rolled modal backdrop/frame markup, only the two shared `Modal`-based ones plus `ConfirmDialog`/`AlertDialog` from Task 8.

**Files:**
- Modify: `frontend/src/pages/estabelecimento/Solicitacoes.tsx`

- [ ] **Step 1: Replace the "Modal de Compra" wrapper**

Old (current — everything from `{/* Modal de Compra */}` through its closing `)}`, wrapping the `selectedFolga`/bulk info card, the budget-preview IIFE, and the `<form>`):
```tsx
      {/* Modal de Compra */}
      {isModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="blueprint card elev-md" style={{ width: '500px', padding: 'var(--space-6)', background: 'var(--color-surface)' }}>
            <h3 style={{ marginTop: 0, marginBottom: 'var(--space-4)' }}>Solicitar Compra de Folga</h3>
            
            {selectedFolga ? (
```

New:
```tsx
      <Modal
        open={isModalOpen}
        title="Solicitar Compra de Folga"
        onClose={() => setIsModalOpen(false)}
        size="md"
        blueprint
      >
            {selectedFolga ? (
```

(Keep everything from here down — the `selectedFolga ? (...) : (...)` info card, unchanged.)

- [ ] **Step 2: Update the budget-preview Callout inside the same modal**

Old:
```tsx
            {(() => {
              const valorPreviewModal = selectedFolga
                ? valorUnitario * selectedFolga.quantidade_plantoes
                : folgasDisponiveis.filter(f => selectedFolgas.includes(f.id)).reduce((acc, f) => acc + (positionValues[f.employees?.positions?.id] || 0) * f.quantidade_plantoes, 0);
              const estoura = valorPreviewModal > disponivelParaLancamento;

              if (estoura) {
                return (
                  <div style={{
                    marginBottom: 'var(--space-4)', padding: '10px 14px', borderRadius: '8px', fontSize: '13px',
                    background: 'rgba(239,68,68,0.08)', borderLeft: '4px solid var(--color-danger)', color: 'var(--color-danger)'
                  }}>
                    <div style={{ fontWeight: 700 }}>
                      🚫 Orçamento insuficiente — faltam R$ {(valorPreviewModal - disponivelParaLancamento).toFixed(2)}
                    </div>
                    <div style={{ marginTop: '4px' }}>
                      {selectedFolga ? 'Esta solicitação' : 'Este lote'} (R$ {valorPreviewModal.toFixed(2)}) não cabe no disponível (R$ {disponivelParaLancamento.toFixed(2)}).
                    </div>
                    <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: '1px dashed rgba(239,68,68,0.25)' }}>
                      💡 Aprove ou rejeite as solicitações pendentes na tabela ao lado para liberar orçamento.
                    </div>
                  </div>
                );
              }

              return (
                <div style={{
                  marginBottom: 'var(--space-4)', padding: '10px 14px', borderRadius: '8px', fontSize: '13px',
                  background: 'rgba(16,185,129,0.08)', borderLeft: '4px solid #10b981', color: '#0d7a56'
                }}>
                  Disponível p/ novo lançamento: <strong>R$ {disponivelParaLancamento.toFixed(2)}</strong>
                </div>
              );
            })()}
```

New:
```tsx
            {(() => {
              const valorPreviewModal = selectedFolga
                ? valorUnitario * selectedFolga.quantidade_plantoes
                : folgasDisponiveis.filter(f => selectedFolgas.includes(f.id)).reduce((acc, f) => acc + (positionValues[f.employees?.positions?.id] || 0) * f.quantidade_plantoes, 0);
              const estoura = valorPreviewModal > disponivelParaLancamento;

              if (estoura) {
                return (
                  <Callout
                    tone="danger"
                    title={`Orçamento insuficiente — faltam R$ ${(valorPreviewModal - disponivelParaLancamento).toFixed(2)}`}
                    hint="Aprove ou rejeite as solicitações pendentes na tabela ao lado para liberar orçamento."
                  >
                    {selectedFolga ? 'Esta solicitação' : 'Este lote'} (R$ {valorPreviewModal.toFixed(2)}) não cabe no disponível (R$ {disponivelParaLancamento.toFixed(2)}).
                  </Callout>
                );
              }

              return (
                <Callout tone="success">
                  Disponível p/ novo lançamento: <strong>R$ {disponivelParaLancamento.toFixed(2)}</strong>
                </Callout>
              );
            })()}
```

- [ ] **Step 3: Update the form's button row and close the modal correctly**

Old (the bottom of the same modal — the button row and the two closing wrapper `</div>`s):
```tsx
              <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                <button
                  type="submit"
                  className="btn btn-primary blueprint"
                  disabled={
                    isSubmitting ||
                    justificativa.length < 50 ||
                    (selectedFolga
                      ? valorUnitario * selectedFolga.quantidade_plantoes
                      : folgasDisponiveis.filter(f => selectedFolgas.includes(f.id)).reduce((acc, f) => acc + (positionValues[f.employees?.positions?.id] || 0) * f.quantidade_plantoes, 0)
                    ) > disponivelParaLancamento
                  }
                >
                  <i className="corner tl"></i><i className="corner tr"></i><i className="corner bl"></i><i className="corner br"></i>
                  {isSubmitting ? 'Enviando...' : 'Confirmar Solicitação'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
```

New:
```tsx
              <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                <button
                  type="submit"
                  className="btn btn-primary blueprint"
                  disabled={
                    isSubmitting ||
                    justificativa.length < 50 ||
                    (selectedFolga
                      ? valorUnitario * selectedFolga.quantidade_plantoes
                      : folgasDisponiveis.filter(f => selectedFolgas.includes(f.id)).reduce((acc, f) => acc + (positionValues[f.employees?.positions?.id] || 0) * f.quantidade_plantoes, 0)
                    ) > disponivelParaLancamento
                  }
                >
                  <i className="corner tl"></i><i className="corner tr"></i><i className="corner bl"></i><i className="corner br"></i>
                  {isSubmitting ? 'Enviando...' : 'Confirmar Solicitação'}
                </button>
              </div>
            </form>
      </Modal>
```

(The justificativa field's counter `<div style={{fontSize:'11px',...}}>{justificativa.length} / 1000</div>` in between Steps 2 and 3 is untouched — leave it exactly as it is today.)

- [ ] **Step 4: Replace the "Modal de Usufruto" wrapper**

Old (current — everything from `{/* Modal de Usufruto */}` to its closing `)}`):
```tsx
      {/* Modal de Usufruto */}
      {isUsufrutoModalOpen && selectedFolga && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="blueprint card elev-md" style={{ width: '400px', padding: 'var(--space-6)', background: 'var(--color-surface)' }}>
            <h3 style={{ marginTop: 0, marginBottom: 'var(--space-4)' }}>{selectedFolga.status === 'USUFRUIDA' ? 'Editar Gozo' : 'Registrar Gozo'}</h3>
            
            <div style={{ background: 'var(--color-bg)', padding: 'var(--space-3)', borderRadius: '4px', marginBottom: 'var(--space-4)' }}>
              <div><strong>Servidor:</strong> {selectedFolga.employees?.nome}</div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                O registro de gozo baixa a folga do sistema sem gerar solicitação financeira.
              </div>
            </div>

            <div style={{ marginBottom: 'var(--space-4)', padding: '12px', background: '#fffbeb', borderLeft: '4px solid #f59e0b', borderRadius: '4px', color: '#92400e', fontSize: '12px' }}>
              <strong>⚠️ Responsabilidade da Direção</strong><br/>
              Ao confirmar o gozo, a direção atesta e garante que esta mesma folga foi ou será devidamente registrada no <strong>Sistema de Ponto Eletrônico</strong> do servidor.
            </div>

            <form onSubmit={handleRegistrarUsufruto}>
              <div className="field" style={{ marginBottom: 'var(--space-4)' }}>
                <label>Data de Descanso do Servidor *</label>
                <input 
                  type="date"
                  className="input"
                  required
                  value={dataUsufruto}
                  onChange={e => setDataUsufruto(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setIsUsufrutoModalOpen(false)} disabled={isSubmitting}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Salvando...' : (selectedFolga.status === 'USUFRUIDA' ? 'Salvar Alteração' : 'Confirmar Gozo')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
```

New:
```tsx
      <Modal
        open={isUsufrutoModalOpen && !!selectedFolga}
        title={selectedFolga?.status === 'USUFRUIDA' ? 'Editar Gozo' : 'Registrar Gozo'}
        onClose={() => setIsUsufrutoModalOpen(false)}
        size="sm"
        blueprint
      >
        {selectedFolga && (
          <>
            <div style={{ background: 'var(--color-bg)', padding: 'var(--space-3)', borderRadius: '4px', marginBottom: 'var(--space-4)' }}>
              <div><strong>Servidor:</strong> {selectedFolga.employees?.nome}</div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                O registro de gozo baixa a folga do sistema sem gerar solicitação financeira.
              </div>
            </div>

            <Callout tone="warning" title="Responsabilidade da Direção">
              Ao confirmar o gozo, a direção atesta e garante que esta mesma folga foi ou será devidamente registrada no <strong>Sistema de Ponto Eletrônico</strong> do servidor.
            </Callout>

            <form onSubmit={handleRegistrarUsufruto} style={{ marginTop: 'var(--space-4)' }}>
              <div className="field" style={{ marginBottom: 'var(--space-4)' }}>
                <label>Data de Descanso do Servidor *</label>
                <input
                  type="date"
                  className="input"
                  required
                  value={dataUsufruto}
                  onChange={e => setDataUsufruto(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsUsufrutoModalOpen(false)} disabled={isSubmitting}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Salvando...' : (selectedFolga.status === 'USUFRUIDA' ? 'Salvar Alteração' : 'Confirmar Gozo')}
                </button>
              </div>
            </form>
          </>
        )}
      </Modal>
```

- [ ] **Step 5: Import `Modal` and `Callout`**

Add near the other `components/ui` imports:
```tsx
import { Modal } from '../../components/ui/Modal';
import { Callout } from '../../components/ui/Callout';
```

- [ ] **Step 6: Verify the build**

Run: `cd "c:/Projetos/SEAP/Sistema - Folga Compensatória/frontend" && npm run build`
Expected: succeeds. This is the final task touching this file — if the build is clean here, the whole migration is done.

- [ ] **Step 7: Manual verification — full pass over both screens**

This is the last checkpoint before the plan is complete. Re-run the full checklist from the spec's "Comportamento que precisa sobreviver 1:1" section, on both `/estabelecimento/folgas` and `/estabelecimento/solicitacoes`:
1. Bloqueio de orçamento ao lançar (Plantão Plus e Comprar Folga, individual e lote) — botão desabilitado, mensagem "faltam R$X" + sugestão de ação.
2. Bloqueio de orçamento ao aprovar (individual e lote) — lote pré-soma e bloqueia tudo de uma vez.
3. Justificativa 50–1000 caracteres nos dois formulários.
4. Busca por nome/matrícula + filtro de cargo em todas as 4 listas (Folgas Disponíveis, Solicitações do Ciclo, Folgas Usufruídas, grid de servidores em Lançamento de Plantões).
5. Aviso "Atenção aos Pagamentos", aba Folgas Usufruídas com contagem, editar/excluir gozo, cancelar solicitação, aprovar/rejeitar com motivo obrigatório (agora via `ConfirmDialog`, não `window.prompt`).
6. Duplicidade de data por servidor continua bloqueando antes de gravar.
7. Toda solicitação criada ainda grava `valor_historico_id`/`position_id` corretamente — confirme abrindo uma solicitação recém-criada e conferindo que ela não é rejeitada pelo trigger de validação de valor (migration 21) nem pelo bloqueio de orçamento (migration 22).

- [ ] **Step 8: Commit**

```bash
cd "c:/Projetos/SEAP/Sistema - Folga Compensatória"
git add frontend/src/pages/estabelecimento/Solicitacoes.tsx
git commit -m "refactor: modais de Comprar Folga e Usufruto usam Modal/Callout compartilhados"
```

This is the last task in the plan.

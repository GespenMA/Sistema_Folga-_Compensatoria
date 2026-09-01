# Elegibilidade de Escala para Modalidade de Compra — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deixar o admin geral escolher, por escala de trabalho (coluna "Horário" do import mensal), se os servidores daquela escala têm acesso às duas modalidades de compra de plantão (carga horária + Plantão Plus) ou só a Plantão Plus — sem quebrar nada do comportamento atual.

**Architecture:** Duas tabelas novas (`schedule_types` canônica + `schedule_type_aliases` de-para) resolvidas no import a partir da coluna "Horário", com normalização heurística de sufixos de turma. Um gate no início do trigger `trg_recalculate_shift_balance` decide se um `shift` alimenta o acúmulo. Duas telas de frontend (Configurações → import + nova aba "Escalas de Trabalho"; Lançamento de Plantões → esconde saldo acumulado) leem o mesmo flag `schedule_types.permite_carga_horaria`.

**Tech Stack:** React 19 + TypeScript (Vite), Supabase (Postgres/PostgREST/RLS), sem suíte de testes automatizada — verificação por `npm run build`, GitNexus `impact()`/`detect_changes()`, e scripts Node ad-hoc com a service-role key para checagem viva no banco.

**Spec:** [docs/superpowers/specs/2026-09-01-escalas-modalidade-compra-design.md](../specs/2026-09-01-escalas-modalidade-compra-design.md)

## Global Constraints

- Este projeto não tem suíte de testes automatizada. Todo "Step: escreva o teste / rode o teste" deste plano é substituído por **verificação manual concreta** (build, query viva no banco via script Node com `SUPABASE_SERVICE_ROLE_KEY`, ou conferência visual) — é o padrão já usado nesta sessão inteira.
- **Migrações SQL não podem ser executadas diretamente por esta sessão** (sem acesso a `DATABASE_URL`/RPC genérico de SQL). Cada task com mudança de banco termina com um passo explícito: "peça para o usuário rodar `database/XX_*.sql` no SQL Editor do Supabase, aguarde confirmação antes de seguir".
- **NÃO rodar `git push`** em nenhuma task deste plano — o usuário pediu para testar localmente antes. Commits locais (`git commit`) são esperados ao fim de cada task, igual ao padrão já usado nesta sessão.
- **MUST rodar `impact()` do GitNexus antes de editar** `trg_recalculate_shift_balance` (Task 1) e as queries `fetchEmployees`/`handleConfirmImport` (Tasks 2 e 5) — são funções compartilhadas, conforme `CLAUDE.md`. Reportar o raio de impacto ao usuário se vier HIGH/CRITICAL.
- Migração numerada como `database/26_escalas_modalidade_compra.sql` (a última existente é `25_permite_update_compensatory_days_ciclo_fechado.sql`).
- Todo texto de interface é em português, seguindo o tom já usado no resto do sistema.

---

### Task 1: Migração de banco — tabelas, RLS e gate no trigger de saldo

**Files:**
- Create: `database/26_escalas_modalidade_compra.sql`
- Test: script Node ad-hoc em `<scratchpad>/verify-migration-26.mjs` (apagado ao final da task)

**Interfaces:**
- Produces: tabela `schedule_types(id, nome, permite_carga_horaria, created_at, updated_at)`; tabela `schedule_type_aliases(id, texto_bruto, schedule_type_id, created_at)`; coluna `employees.schedule_type_id` (nullable); RLS igual ao padrão de `positions` (admin ALL, todos SELECT); `trg_recalculate_shift_balance()` com gate novo no início (mesmo corpo de negócio de antes, só retorna cedo se a escala do servidor tiver `permite_carga_horaria = false`).

- [ ] **Step 1: Escrever a migração**

Criar `database/26_escalas_modalidade_compra.sql`:

```sql
-- =====================================================================================
-- Elegibilidade de escala (regime de trabalho) para modalidade de compra de plantão.
-- Ver spec: docs/superpowers/specs/2026-09-01-escalas-modalidade-compra-design.md
--
-- Cria o conceito de "escala" (regime de trabalho, ex: "24 H X 72H"), lido da coluna
-- "Horário" da planilha de importação mensal. Cada escala tem um interruptor
-- permite_carga_horaria: quando desligado, o servidor só tem acesso a Plantão Plus —
-- não acumula carga horária compensatória (não gera compensatory_days, não mostra
-- saldo acumulado na tela). Todas as escalas nascem HABILITADAS — nada muda no
-- comportamento atual até o admin geral desabilitar manualmente alguma.
-- =====================================================================================

-- 1. Tabelas novas
CREATE TABLE schedule_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(255) NOT NULL UNIQUE,
    permite_carga_horaria BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE schedule_type_aliases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    texto_bruto VARCHAR(255) NOT NULL UNIQUE,
    schedule_type_id UUID NOT NULL REFERENCES schedule_types(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE employees ADD COLUMN schedule_type_id UUID REFERENCES schedule_types(id);

-- 2. RLS — mesmo padrão de positions/position_values (referência global, admin
-- escreve, todo mundo lê — necessário pra Folgas.tsx/Solicitacoes.tsx conseguirem
-- checar o flag mesmo logados como ESTABELECIMENTO/GESTOR).
ALTER TABLE schedule_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_type_aliases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem tudo em schedule_types" ON schedule_types FOR ALL USING (is_admin());
CREATE POLICY "Todos podem ver schedule_types" ON schedule_types FOR SELECT USING (true);
CREATE POLICY "Admins podem tudo em schedule_type_aliases" ON schedule_type_aliases FOR ALL USING (is_admin());
CREATE POLICY "Todos podem ver schedule_type_aliases" ON schedule_type_aliases FOR SELECT USING (true);

-- 3. Gate no trigger de saldo: servidor em escala só-Plus não acumula carga horária.
-- Mesmo corpo de database/04_saldo_plantoes.sql:16-91, só acrescenta o gate no
-- início. COALESCE(..., TRUE) cobre schedule_type_id IS NULL (servidor sem escala
-- definida) — comportamento atual preservado.
CREATE OR REPLACE FUNCTION trg_recalculate_shift_balance()
RETURNS TRIGGER AS $$
DECLARE
    v_emp_id UUID;
    v_permite_carga_horaria BOOLEAN;
    v_total_shifts INTEGER;
    v_total_folgas INTEGER;
    v_current_balance INTEGER;
    v_folgas_to_generate INTEGER;
    v_cycle_id UUID;
    v_per_inicio DATE;
    v_per_fim DATE;
    v_user UUID;
    v_i INTEGER;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_emp_id := OLD.employee_id;
    ELSE
        v_emp_id := NEW.employee_id;
    END IF;

    SELECT COALESCE(st.permite_carga_horaria, TRUE) INTO v_permite_carga_horaria
    FROM employees e
    LEFT JOIN schedule_types st ON st.id = e.schedule_type_id
    WHERE e.id = v_emp_id;

    IF NOT v_permite_carga_horaria THEN
        -- Escala só-Plus: este shift não altera saldo_plantoes nem gera
        -- compensatory_days. Saldo anterior (se houver, de antes da escala ser
        -- desabilitada) fica congelado — não é zerado nem recalculado.
        RETURN NULL;
    END IF;

    SELECT COALESCE(SUM(quantidade_plantoes), 0) INTO v_total_shifts FROM shifts WHERE employee_id = v_emp_id;
    SELECT COUNT(*) INTO v_total_folgas FROM compensatory_days WHERE employee_id = v_emp_id;
    v_current_balance := v_total_shifts - (v_total_folgas * 21);

    WHILE v_current_balance < 0 LOOP
        DELETE FROM compensatory_days
        WHERE id = (
            SELECT id FROM compensatory_days
            WHERE employee_id = v_emp_id AND status = 'GERADA'
            ORDER BY generated_at DESC LIMIT 1
        );

        IF FOUND THEN
            v_total_folgas := v_total_folgas - 1;
            v_current_balance := v_current_balance + 21;
        ELSE
            RAISE EXCEPTION 'Ação negada: O servidor possui folgas ativas que dependem destes plantões. Exclua a folga primeiro.';
        END IF;
    END LOOP;

    v_folgas_to_generate := v_current_balance / 21;

    IF v_folgas_to_generate > 0 THEN
        SELECT cycle_id, periodo_inicio, periodo_fim, created_by
        INTO v_cycle_id, v_per_inicio, v_per_fim, v_user
        FROM shifts WHERE employee_id = v_emp_id ORDER BY created_at DESC LIMIT 1;

        FOR v_i IN 1..v_folgas_to_generate LOOP
            INSERT INTO compensatory_days (employee_id, cycle_id, shift_id, periodo_inicio, periodo_fim, quantidade_plantoes, status, generated_by)
            VALUES (v_emp_id, v_cycle_id, NULL, v_per_inicio, v_per_fim, 1, 'GERADA', v_user);
        END LOOP;

        v_current_balance := v_current_balance - (v_folgas_to_generate * 21);
    END IF;

    UPDATE employees SET saldo_plantoes = v_current_balance WHERE id = v_emp_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;
```

- [ ] **Step 2: Rodar `impact()` do GitNexus em `trg_recalculate_shift_balance` antes de aplicar**

Reportar ao usuário o raio de impacto (chamadores/fluxos afetados) antes de pedir para ele rodar a migração. Se vier HIGH/CRITICAL, avisar explicitamente e só prosseguir com confirmação.

- [ ] **Step 3: Pedir para o usuário aplicar a migração**

Mostrar o caminho do arquivo e pedir para colar o conteúdo no SQL Editor do projeto Supabase do Compensa+ (não o projeto de rondas/patrulhamento que às vezes aparece por engano). **Aguardar confirmação do usuário de que rodou sem erro antes de seguir para o Step 4.**

- [ ] **Step 4: Verificar a migração com um script Node**

Criar `<scratchpad>/verify-migration-26.mjs`:

```js
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// 1. Tabelas existem e aceitam INSERT/SELECT
const { data: st, error: stErr } = await supabase
  .from('schedule_types')
  .insert({ nome: '__TESTE_MIGRACAO_26__', permite_carga_horaria: false })
  .select('id, permite_carga_horaria')
  .single();
if (stErr) throw stErr;
console.log('schedule_types OK:', st);

// 2. Pega um employee real qualquer pra testar o gate do trigger sem afetar produção —
// usamos um employee de teste dedicado (criar um establishment/employee de teste se
// não houver nenhum "unidade de teste" — ver memória gaps_logica_ciclos sobre a
// unidade de teste já usada nesta sessão para esse fim).
const { data: emp } = await supabase.from('employees').select('id, saldo_plantoes, establishment_id').eq('ativo', true).limit(1).single();
await supabase.from('employees').update({ schedule_type_id: st.id }).eq('id', emp.id);

const { data: cycle } = await supabase.from('cycles').select('id, data_inicio, data_fim').in('status', ['ABERTO','REABERTO']).limit(1).single();
const saldoAntes = emp.saldo_plantoes;

const { error: shiftErr } = await supabase.from('shifts').insert({
  employee_id: emp.id, cycle_id: cycle.id, establishment_id: emp.establishment_id,
  periodo_inicio: cycle.data_inicio, periodo_fim: cycle.data_fim, quantidade_plantoes: 5,
});
if (shiftErr) throw shiftErr;

const { data: empDepois } = await supabase.from('employees').select('saldo_plantoes').eq('id', emp.id).single();
console.log('Saldo antes:', saldoAntes, '| Saldo depois (deve ser IGUAL, gate bloqueou):', empDepois.saldo_plantoes);
if (empDepois.saldo_plantoes !== saldoAntes) throw new Error('FALHOU: saldo mudou mesmo com escala só-Plus');

// 3. Limpeza
await supabase.from('shifts').delete().eq('employee_id', emp.id).eq('cycle_id', cycle.id).eq('quantidade_plantoes', 5);
await supabase.from('employees').update({ schedule_type_id: null }).eq('id', emp.id);
await supabase.from('schedule_types').delete().eq('id', st.id);
console.log('✅ Migração 26 verificada e dados de teste limpos.');
```

Rodar: `node <scratchpad>/verify-migration-26.mjs` (usando `frontend/.env.local` como fonte das variáveis, ou exportá-las antes). Esperado: log final `✅ Migração 26 verificada...` sem exceções.

- [ ] **Step 5: Commit**

```bash
git add database/26_escalas_modalidade_compra.sql
git commit -m "feat(db): adiciona schedule_types e gate de acumulo no trigger de saldo

Cria schedule_types/schedule_type_aliases + employees.schedule_type_id.
trg_recalculate_shift_balance para de acumular saldo/gerar compensatory_days
para servidores em escala com permite_carga_horaria = false. Todas as
escalas nascem habilitadas -- nao muda comportamento ate o admin desabilitar
alguma manualmente.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Import — ler a coluna "Horário" e resolver a escala de cada servidor

**Files:**
- Modify: `frontend/src/pages/admin/Configuracoes.tsx:74-75` (types `PreviewRow`/`ImportResult`)
- Modify: `frontend/src/pages/admin/Configuracoes.tsx:95-106` (useEffect de fetch por aba)
- Modify: `frontend/src/pages/admin/Configuracoes.tsx:192-205` (perto de `parseHorasMinutos`, adicionar `normalizarEscala`)
- Modify: `frontend/src/pages/admin/Configuracoes.tsx:467-527` (`handleFileChange`)
- Modify: `frontend/src/pages/admin/Configuracoes.tsx:529-705` (`handleConfirmImport`)

**Interfaces:**
- Consumes: tabelas `schedule_types`/`schedule_type_aliases` (Task 1).
- Produces: `normalizarEscala(textoBruto: string): string`; `PreviewRow.escalaTexto: string`, `PreviewRow.escalaNova: boolean`; `ImportResult.escalasNovas: number`; `employees.schedule_type_id` preenchido corretamente em toda importação daqui em diante (consumido pelas Tasks 4 e 5).

- [ ] **Step 1: Rodar `impact()` em `handleConfirmImport`**

Reportar o raio de impacto ao usuário antes de editar (função grande, mexe em `employees`/`shifts`).

- [ ] **Step 2: Atualizar os types**

Em `Configuracoes.tsx:74-75`, trocar:
```ts
  type PreviewRow = { matricula: string; nome: string; cargo: string; dataAdmissao: string; estabelecimento: string; trabalhadas: string; minutosNovos: number; plantoes: number; minutosResiduo: number; erros: string[] };
  type ImportResult = { importados: number; atualizados: number; transferidos: number; shiftsInseridos: number; transferenciasDetalhe: string[]; erros: string[] };
```
por:
```ts
  type PreviewRow = { matricula: string; nome: string; cargo: string; dataAdmissao: string; estabelecimento: string; trabalhadas: string; minutosNovos: number; plantoes: number; minutosResiduo: number; escalaTexto: string; escalaNova: boolean; erros: string[] };
  type ImportResult = { importados: number; atualizados: number; transferidos: number; shiftsInseridos: number; escalasNovas: number; transferenciasDetalhe: string[]; erros: string[] };
```

- [ ] **Step 3: Adicionar estado + fetch dos aliases já conhecidos**

Logo após `const fileInputRef = useRef<HTMLInputElement>(null);` (linha 84), adicionar:
```ts
  const [knownEscalaTextos, setKnownEscalaTextos] = useState<Set<string>>(new Set());
```

Em `Configuracoes.tsx:101-102`, no `useEffect` de troca de aba, trocar:
```ts
    } else if (activeTab === 'importacao') {
      fetchActiveCycleForImport();
```
por:
```ts
    } else if (activeTab === 'importacao') {
      fetchActiveCycleForImport();
      fetchKnownEscalaTextos();
```

Adicionar a função `fetchKnownEscalaTextos`, logo após `fetchActiveCycleForImport` (depois da linha 122):
```ts
  const fetchKnownEscalaTextos = async () => {
    const { data } = await supabase.from('schedule_type_aliases').select('texto_bruto');
    setKnownEscalaTextos(new Set((data || []).map((a: any) => a.texto_bruto)));
  };
```

- [ ] **Step 4: Adicionar `normalizarEscala`**

Logo depois de `parseHorasMinutos` (após a linha 205), adicionar:
```ts
  // Agrupa variações de texto da coluna "Horário" que são o mesmo regime de trabalho —
  // sufixos como "- 002" (turma/grupo) ou "NOTURNO 2" não mudam a regra de acúmulo.
  // Heurística: corta um sufixo numérico (com ou sem "- " na frente) só se ele estiver
  // no FINAL da string — não mexe em números no meio (ex: "3 DIAS DE FOLGA" continua
  // intacto em "04 D X 10 H - 3 DIAS DE FOLGA - 1" → "04 D X 10 H - 3 DIAS DE FOLGA").
  const normalizarEscala = (textoBruto: string): string => {
    return textoBruto
      .trim()
      .replace(/\s*-\s*\d+\s*$/, '')
      .replace(/\s+\d+\s*$/, '')
      .trim();
  };
```

- [ ] **Step 5: Verificar a heurística com os 7 valores reais da spec**

Rodar num REPL Node local (`node -e "..."` ou `<scratchpad>/test-normalizar-escala.mjs`) colando a função acima e conferindo contra a tabela da seção 3.2 da spec:
```js
const casos = [
  ['24 H X 72H', '24 H X 72H'],
  ['24 H X 72H - 002', '24 H X 72H'],
  ['12HX36H - NOTURNO', '12HX36H - NOTURNO'],
  ['12HX36H - NOTURNO 2', '12HX36H - NOTURNO'],
  ['12HX36H - DIURNO', '12HX36H - DIURNO'],
  ['08H AS 17H 1H ALMOÇO', '08H AS 17H 1H ALMOÇO'],
  ['04 D X 10 H - 3 DIAS DE FOLGA - 1', '04 D X 10 H - 3 DIAS DE FOLGA'],
];
for (const [entrada, esperado] of casos) {
  const resultado = normalizarEscala(entrada);
  console.log(resultado === esperado ? 'OK' : 'FALHOU', entrada, '->', resultado);
}
```
Esperado: todas as linhas `OK`. Se alguma falhar, ajustar o regex antes de seguir.

- [ ] **Step 6: Ler a coluna "Horário" no preview (`handleFileChange`)**

Em `Configuracoes.tsx:484-522`, dentro do `.map(r => {...})`, adicionar a leitura de `r[5]` e o cálculo de `escalaNova` (usa o `knownEscalaTextos` do Step 3), e incluir os dois campos novos no objeto retornado:
```ts
        const escalaTexto = String(r[5] || '').trim();
        const escalaNova = escalaTexto !== '' && !knownEscalaTextos.has(escalaTexto);
```
(inserir logo depois da linha `const rawTrabalhadas = ...` e antes do `return {`), e no `return { ... }` final da função de preview, adicionar `escalaTexto, escalaNova,` junto dos outros campos.

- [ ] **Step 7: Resolver `schedule_type_id` por linha em `handleConfirmImport`**

Em `Configuracoes.tsx:561-571`, junto da busca de `ests`/`positions`, adicionar a pré-carga de escalas conhecidas:
```ts
      const { data: ests } = await supabase.from('establishments').select('id, nome');
      const { data: positions } = await supabase.from('positions').select('id, nome, codigo');
      const { data: aliases } = await supabase.from('schedule_type_aliases').select('texto_bruto, schedule_type_id');
      const { data: scheduleTypes } = await supabase.from('schedule_types').select('id, nome');

      const estMap = new Map<string, string>();
      ests?.forEach(e => estMap.set(normalizeStr(e.nome), e.id));

      const estIdToNome = new Map<string, string>();
      ests?.forEach(e => estIdToNome.set(e.id, e.nome));

      const posMap = new Map<string, string>();
      positions?.forEach(p => posMap.set(normalizeStr(p.nome), p.id));

      const aliasMap = new Map<string, string>(); // texto_bruto exato -> schedule_type_id
      aliases?.forEach(a => aliasMap.set(a.texto_bruto, a.schedule_type_id));

      const scheduleTypeByNome = new Map<string, string>(); // nome normalizado -> id
      scheduleTypes?.forEach(st => scheduleTypeByNome.set(normalizeStr(st.nome), st.id));

      let escalasNovas = 0;
```

A linha existente `let importados = 0, atualizados = 0, transferidos = 0, shiftsInseridos = 0;` (`Configuracoes.tsx:574`) não muda — `escalasNovas` já foi declarado acima, fora do loop, junto dos Maps.

Logo antes do bloco `// Busca por matrícula globalmente...` (linha 594-601), dentro do loop `for`, adicionar a resolução da escala:
```ts
        let scheduleTypeId: string | null = null;
        if (row.escalaTexto) {
          scheduleTypeId = aliasMap.get(row.escalaTexto) || null;
          if (!scheduleTypeId) {
            const nomeCanonico = normalizarEscala(row.escalaTexto);
            const nomeCanonicoNorm = normalizeStr(nomeCanonico);
            scheduleTypeId = scheduleTypeByNome.get(nomeCanonicoNorm) || null;
            if (!scheduleTypeId) {
              const { data: newSt, error: stError } = await supabase
                .from('schedule_types')
                .insert({ nome: nomeCanonico, permite_carga_horaria: true })
                .select('id')
                .single();
              if (stError || !newSt) {
                erros.push(`Erro ao criar escala "${nomeCanonico}" (${row.nome}): ${stError?.message}`);
              } else {
                scheduleTypeId = newSt.id;
                scheduleTypeByNome.set(nomeCanonicoNorm, scheduleTypeId);
              }
            }
            if (scheduleTypeId) {
              const { error: aliasError } = await supabase
                .from('schedule_type_aliases')
                .insert({ texto_bruto: row.escalaTexto, schedule_type_id: scheduleTypeId });
              if (!aliasError) {
                aliasMap.set(row.escalaTexto, scheduleTypeId);
                escalasNovas++;
              }
            }
          }
        }
```

Em `Configuracoes.tsx:644-651` e `:658-666` (os dois payloads de `employees`, update e insert), adicionar `schedule_type_id: scheduleTypeId` em ambos os objetos.

Em `Configuracoes.tsx:699`, trocar:
```ts
      setImportResult({ importados, atualizados, transferidos, shiftsInseridos, transferenciasDetalhe, erros });
```
por:
```ts
      setImportResult({ importados, atualizados, transferidos, shiftsInseridos, escalasNovas, transferenciasDetalhe, erros });
```

- [ ] **Step 8: Verificar com build**

Rodar: `npm run build` (dentro de `frontend/`)
Esperado: build limpo, sem erro de TypeScript (os dois novos campos dos types precisam bater com todo lugar que constrói `PreviewRow`/`ImportResult`).

- [ ] **Step 9: Commit**

```bash
git add frontend/src/pages/admin/Configuracoes.tsx
git commit -m "feat(import): le a coluna Horario e resolve a escala de cada servidor

Preview e confirmacao de importacao passam a ler r[5] (coluna Horario),
normalizar variacoes de turma/grupo (normalizarEscala) e resolver/criar
schedule_types + schedule_type_aliases, gravando employees.schedule_type_id.
Celula vazia fica sem escala definida, sem bloquear a linha.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Import — mostrar a escala no preview e o resumo pós-importação

**Files:**
- Modify: `frontend/src/pages/admin/Configuracoes.tsx:988-1020` (tabela de preview)
- Modify: `frontend/src/pages/admin/Configuracoes.tsx:1061-1082` (resultado da importação)

**Interfaces:**
- Consumes: `PreviewRow.escalaTexto/escalaNova` e `ImportResult.escalasNovas` (Task 2).

- [ ] **Step 1: Coluna "Escala" no preview**

Em `Configuracoes.tsx:992`, trocar o array de cabeçalhos:
```tsx
                            {['Matrícula','Nome','Cargo','Estabelecimento','Trabalhadas','Plantões','Saldo Residual'].map(h => (
```
por:
```tsx
                            {['Matrícula','Nome','Cargo','Estabelecimento','Escala','Trabalhadas','Plantões','Saldo Residual'].map(h => (
```

Em `Configuracoes.tsx:1003`, logo após a `<td>` de Estabelecimento, adicionar uma nova `<td>`. Mostra o **nome canônico** (pós-`normalizarEscala`, é o que efetivamente vira a escala) como texto principal, com o texto bruto original como subtexto pra o admin conferir se o agrupamento fez sentido:
```tsx
                              <td style={{ padding: '7px 12px', fontSize: '11px' }}>
                                {row.escalaTexto ? (
                                  <>
                                    <div>{normalizarEscala(row.escalaTexto)}</div>
                                    {normalizarEscala(row.escalaTexto) !== row.escalaTexto && (
                                      <div style={{ fontSize: '9px', color: 'var(--color-text-muted)' }}>de: {row.escalaTexto}</div>
                                    )}
                                  </>
                                ) : (
                                  <span style={{ color: 'var(--color-text-muted)' }}>— sem escala</span>
                                )}
                                {row.escalaNova && (
                                  <span className="tag" style={{ marginLeft: '6px', fontSize: '9px', padding: '1px 6px', background: '#fef3c7', color: '#92400e' }}>🆕 nova</span>
                                )}
                              </td>
```

- [ ] **Step 2: Resumo pós-importação**

Em `Configuracoes.tsx:1064-1082`, depois do grid de 4 cards (`importados`/`atualizados`/`transferidos`/`shiftsInseridos`) e antes do bloco `{importResult.transferenciasDetalhe.length > 0 && (...)}`, adicionar:
```tsx
                    {importResult.escalasNovas > 0 && (
                      <div style={{ padding: '12px 16px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', marginBottom: '16px', fontSize: '13px', color: '#1e40af' }}>
                        🕒 <strong>{importResult.escalasNovas}</strong> variação(ões) de "Horário" nunca vista(s) antes viraram escala nova nesta importação. Se você esperava um número bem menor de regimes reais, revise o agrupamento em <strong>Configurações → Escalas de Trabalho</strong> antes de desabilitar qualquer escala.
                      </div>
                    )}
```

- [ ] **Step 3: Verificar visualmente**

Rodar `npm run dev`, importar uma planilha de teste com pelo menos duas variações de "Horário" (ex.: `"24 H X 72H"` e `"24 H X 72H - 002"` para servidores diferentes) e conferir: (a) a coluna "Escala" aparece no preview com o texto bruto e a marca 🆕 na primeira ocorrência de cada valor novo; (b) o banner de resumo mostra a contagem correta de escalas novas após confirmar.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/admin/Configuracoes.tsx
git commit -m "feat(import): exibe coluna Escala no preview e resumo pos-importacao

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Nova aba "Escalas de Trabalho" em Configurações

**Files:**
- Modify: `frontend/src/pages/admin/Configuracoes.tsx:23` (`activeTab` type)
- Modify: `frontend/src/pages/admin/Configuracoes.tsx:46-55` (estados, adicionar bloco de escalas)
- Modify: `frontend/src/pages/admin/Configuracoes.tsx:95-106` (useEffect)
- Modify: `frontend/src/pages/admin/Configuracoes.tsx:733-741` (barra de abas)
- Modify: `frontend/src/pages/admin/Configuracoes.tsx:916-917` (inserir novo bloco de conteúdo de aba, logo após o bloco `cargos`)

**Interfaces:**
- Consumes: tabelas `schedule_types`/`schedule_type_aliases` (Task 1).
- Produces: `fetchScheduleTypes()`, `handleToggleScheduleType(id, novoValor)`, `handleReassignAlias(aliasId, novoScheduleTypeId)` — nenhuma outra task consome essas funções diretamente, mas o efeito (toggle de `permite_carga_horaria`) é o que a Task 5 lê.

- [ ] **Step 1: Tipo da aba e estados**

Em `Configuracoes.tsx:23`, trocar:
```ts
  const [activeTab, setActiveTab] = useState<'usuarios' | 'cargos' | 'importacao' | 'tutoriais'>('usuarios');
```
por:
```ts
  const [activeTab, setActiveTab] = useState<'usuarios' | 'cargos' | 'escalas' | 'importacao' | 'tutoriais'>('usuarios');
```

Depois do bloco de estados de Cargos (linha 55), adicionar:
```ts
  // Estados para Escalas de Trabalho
  type ScheduleType = { id: string; nome: string; permite_carga_horaria: boolean; qtdServidores: number };
  type ScheduleAlias = { id: string; texto_bruto: string; schedule_type_id: string };
  const [scheduleTypes, setScheduleTypes] = useState<ScheduleType[]>([]);
  const [scheduleAliases, setScheduleAliases] = useState<ScheduleAlias[]>([]);
  const [loadingEscalas, setLoadingEscalas] = useState(true);
```

- [ ] **Step 2: Fetch e handlers**

Em `Configuracoes.tsx:95-106`, adicionar o branch de fetch:
```ts
    } else if (activeTab === 'escalas') {
      fetchScheduleTypes();
```
(entre o branch de `'cargos'` e o de `'importacao'`).

Adicionar as funções, próximo de `fetchCargos` (após a linha 224 em diante — colar depois do fechamento de `fetchCargos`):
```ts
  const fetchScheduleTypes = async () => {
    setLoadingEscalas(true);
    try {
      const [{ data: types }, { data: aliases }, { data: emps }] = await Promise.all([
        supabase.from('schedule_types').select('id, nome, permite_carga_horaria').order('nome'),
        supabase.from('schedule_type_aliases').select('id, texto_bruto, schedule_type_id').order('texto_bruto'),
        supabase.from('employees').select('schedule_type_id').eq('ativo', true),
      ]);
      const contagem = new Map<string, number>();
      (emps || []).forEach((e: any) => {
        if (e.schedule_type_id) contagem.set(e.schedule_type_id, (contagem.get(e.schedule_type_id) || 0) + 1);
      });
      setScheduleTypes((types || []).map((t: any) => ({ ...t, qtdServidores: contagem.get(t.id) || 0 })));
      setScheduleAliases(aliases || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingEscalas(false);
    }
  };

  const handleToggleScheduleType = async (id: string, novoValor: boolean) => {
    const { error } = await supabase.from('schedule_types').update({ permite_carga_horaria: novoValor }).eq('id', id);
    if (error) { alert(error.message || 'Erro ao atualizar escala.'); return; }
    fetchScheduleTypes();
  };

  const handleReassignAlias = async (aliasId: string, novoScheduleTypeId: string) => {
    const { error } = await supabase.from('schedule_type_aliases').update({ schedule_type_id: novoScheduleTypeId }).eq('id', aliasId);
    if (error) { alert(error.message || 'Erro ao reatribuir variação.'); return; }
    fetchScheduleTypes();
  };
```

- [ ] **Step 3: Botão da aba**

Em `Configuracoes.tsx:733-741`, logo depois do `<label>` de "Cargos e Valores" e antes do de "📥 Importação Mensal", adicionar:
```tsx
        <label className="seg-opt" style={{ padding: 'var(--space-2) var(--space-4)' }}>
          <input type="radio" name="config-tab" checked={activeTab === 'escalas'} onChange={() => setActiveTab('escalas')} />
          🕒 Escalas de Trabalho
        </label>
```

- [ ] **Step 4: Conteúdo da aba**

Logo depois do `)}` que fecha o bloco `{activeTab === 'cargos' && (...)}`  (linha 916), adicionar:
```tsx
      {activeTab === 'escalas' && (
        <div className="blueprint card elev-sm" style={{ overflow: 'hidden' }}>
          <i className="corner tl"></i><i className="corner tr"></i><i className="corner bl"></i><i className="corner br"></i>

          <div style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--color-divider)' }}>
            <div style={{ fontWeight: 600 }}>Escalas de Trabalho</div>
            <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
              Controle quais escalas (regime de trabalho, coluna "Horário" da planilha) têm acesso às duas modalidades de compra — carga horária acumulada + Plantão Plus. Escalas desabilitadas só têm acesso a Plantão Plus.
            </div>
          </div>

          {loadingEscalas ? (
            <div style={{ padding: 'var(--space-4)' }}>Carregando...</div>
          ) : scheduleTypes.length === 0 ? (
            <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
              Nenhuma escala cadastrada ainda — elas são criadas automaticamente durante a importação mensal, a partir da coluna "Horário".
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-divider)' }}>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text-muted)' }}>Escala</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text-muted)' }}>Servidores ativos</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text-muted)' }}>Modalidade</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text-muted)', textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {scheduleTypes.map(st => (
                  <tr key={st.id} style={{ borderBottom: '1px solid var(--color-divider)' }}>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 500 }}>{st.nome}</td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)' }}>{st.qtdServidores}</td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                      {st.permite_carga_horaria
                        ? <span className="tag" style={{ background: 'var(--color-accent-500)', color: 'white' }}>Carga Horária + Plus</span>
                        : <span className="tag tag-outline">Só Plantão Plus</span>}
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right' }}>
                      <button
                        className="btn btn-ghost"
                        style={{ padding: '4px 10px', fontSize: '12px' }}
                        onClick={() => handleToggleScheduleType(st.id, !st.permite_carga_horaria)}
                      >
                        {st.permite_carga_horaria ? 'Restringir a Só Plus' : 'Habilitar Carga Horária'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {scheduleAliases.length > 0 && (
            <div style={{ padding: 'var(--space-4)', borderTop: '1px solid var(--color-divider)' }}>
              <div style={{ fontWeight: 600, marginBottom: '8px' }}>Mapa de variações</div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '12px' }}>
                Cada texto exato encontrado na coluna "Horário" das planilhas e a escala a que foi atribuído. Se o agrupamento automático errou algum caso, reatribua aqui.
              </div>
              <div style={{ maxHeight: '260px', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead style={{ background: '#f8fafc', position: 'sticky', top: 0 }}>
                    <tr>
                      <th style={{ padding: '6px 12px', textAlign: 'left', color: 'var(--color-text-muted)' }}>Texto bruto (planilha)</th>
                      <th style={{ padding: '6px 12px', textAlign: 'left', color: 'var(--color-text-muted)' }}>Escala atribuída</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scheduleAliases.map(al => (
                      <tr key={al.id} style={{ borderBottom: '1px solid var(--color-divider)' }}>
                        <td style={{ padding: '6px 12px' }}>{al.texto_bruto}</td>
                        <td style={{ padding: '6px 12px' }}>
                          <select
                            value={al.schedule_type_id}
                            onChange={e => handleReassignAlias(al.id, e.target.value)}
                            style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--color-border)' }}
                          >
                            {scheduleTypes.map(st => (
                              <option key={st.id} value={st.id}>{st.nome}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
```

- [ ] **Step 5: Verificar com build e visualmente**

Rodar: `npm run build` — esperado limpo. Depois `npm run dev`, abrir Configurações → Escalas de Trabalho, confirmar que a lista aparece com a contagem certa de servidores, o toggle muda o texto do botão e a tag, e o mapa de variações reatribui corretamente (testar com as duas escalas de teste criadas na Task 3).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/admin/Configuracoes.tsx
git commit -m "feat(configuracoes): nova aba Escalas de Trabalho

Lista as escalas com contagem de servidores e toggle de habilitacao
(Carga Horaria + Plus vs So Plus), mais um mapa de variacoes editavel
para corrigir agrupamentos que a normalizacao automatica errar.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Lançamento de Plantões — esconder carga horária acumulada para escala só-Plus

**Files:**
- Modify: `frontend/src/pages/estabelecimento/Folgas.tsx:7-17` (type `Employee`)
- Modify: `frontend/src/pages/estabelecimento/Folgas.tsx:253` (query `fetchEmployees`)
- Modify: `frontend/src/pages/estabelecimento/Folgas.tsx:424-427` (KPI "próximos")
- Modify: `frontend/src/pages/estabelecimento/Folgas.tsx:759-866` (card do servidor)
- Modify: `frontend/src/pages/estabelecimento/Folgas.tsx:1053-1109` (cabeçalho do modal de detalhe)
- Modify: `frontend/src/pages/estabelecimento/Folgas.tsx:1140-1144` (aba Folgas, texto do banner)
- Modify: `frontend/src/pages/estabelecimento/Folgas.tsx:1212-1366` (aba Plantões)

**Interfaces:**
- Consumes: `employees.schedule_type_id` + `schedule_types.permite_carga_horaria` (Task 1/2).

- [ ] **Step 1: Rodar `impact()` em `fetchEmployees`**

Reportar o raio de impacto ao usuário antes de editar.

- [ ] **Step 2: Type e query**

Em `Folgas.tsx:7-17`, adicionar ao type `Employee`:
```ts
  schedule_type_id?: string | null;
  schedule_types?: { permite_carga_horaria: boolean } | null;
```

Em `Folgas.tsx:253`, trocar:
```ts
          .select('id, nome, matricula, saldo_plantoes, saldo_minutos, position_id, positions(nome, codigo), compensatory_days(id, status)')
```
por:
```ts
          .select('id, nome, matricula, saldo_plantoes, saldo_minutos, position_id, positions(nome, codigo), compensatory_days(id, status), schedule_types(permite_carga_horaria)')
```

- [ ] **Step 3: KPI "próximos da folga"**

Em `Folgas.tsx:424-427`, trocar:
```ts
  const proximos = employees.filter(e => {
    const min = (e.saldo_plantoes * 720) + (e.saldo_minutos || 0);
    return min >= (120 * 60) && (e.folgasDisponiveis || 0) === 0; // >= 120h
  }).length;
```
por:
```ts
  const proximos = employees.filter(e => {
    if (e.schedule_types?.permite_carga_horaria === false) return false;
    const min = (e.saldo_plantoes * 720) + (e.saldo_minutos || 0);
    return min >= (120 * 60) && (e.folgasDisponiveis || 0) === 0; // >= 120h
  }).length;
```

- [ ] **Step 4: Card do servidor**

Em `Folgas.tsx:759-761`, dentro do `.map((emp, idx) => {`, logo antes de `const temFolga = ...`, adicionar:
```ts
                const permiteCarga = emp.schedule_types?.permite_carga_horaria !== false;
```

Trocar (linha 765):
```ts
                const proximo = !temFolga && horas >= 120;
```
por:
```ts
                const proximo = permiteCarga && !temFolga && horas >= 120;
```

Envolver o bloco "Saldo + Barra" (linhas 811-830) numa condicional — trocar:
```tsx
                    {/* Saldo + Barra */}
                    <div style={{ marginBottom: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Saldo para próxima folga</span>
                        <span style={{ fontWeight: 800, fontSize: '16px', color: temFolga ? '#10b981' : 'var(--color-text)' }}>
                          {horas}h {minutosStr}m<span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--color-text-muted)' }}>/252h</span>
                        </span>
                      </div>
                      <div style={{ height: '8px', background: 'var(--color-divider)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', borderRadius: '4px', transition: 'width 0.4s ease',
                          width: `${pct}%`,
                          background: temFolga
                            ? 'linear-gradient(90deg, #10b981, #34d399)'
                            : proximo
                              ? 'linear-gradient(90deg, #eab308, #f59e0b)'
                              : 'linear-gradient(90deg, #3b82f6, #60a5fa)'
                        }} />
                      </div>
                    </div>
```
por:
```tsx
                    {/* Saldo + Barra — só pra quem tem escala habilitada pra carga horária */}
                    {permiteCarga ? (
                      <div style={{ marginBottom: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
                          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Saldo para próxima folga</span>
                          <span style={{ fontWeight: 800, fontSize: '16px', color: temFolga ? '#10b981' : 'var(--color-text)' }}>
                            {horas}h {minutosStr}m<span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--color-text-muted)' }}>/252h</span>
                          </span>
                        </div>
                        <div style={{ height: '8px', background: 'var(--color-divider)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{
                            height: '100%', borderRadius: '4px', transition: 'width 0.4s ease',
                            width: `${pct}%`,
                            background: temFolga
                              ? 'linear-gradient(90deg, #10b981, #34d399)'
                              : proximo
                                ? 'linear-gradient(90deg, #eab308, #f59e0b)'
                                : 'linear-gradient(90deg, #3b82f6, #60a5fa)'
                          }} />
                        </div>
                      </div>
                    ) : (
                      <div style={{ marginBottom: '10px', padding: '8px 10px', background: 'var(--color-bg)', borderRadius: '6px', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                        ⚡ Escala só Plantão Plus — não acumula carga horária
                      </div>
                    )}
```

Na fileira de badges (linhas 841-856), envolver os badges `proximo` e `Acumulando` também em `permiteCarga` (o badge `temFolga` continua sempre visível — folga já gerada é grandfathered):
```tsx
                      {permiteCarga && proximo && (
                        <span style={{
                          fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '12px',
                          background: 'rgba(234,179,8,0.12)', color: '#eab308', border: '1px solid rgba(234,179,8,0.25)'
                        }}>
                          ⏳ Próximo da folga
                        </span>
                      )}
                      {permiteCarga && !temFolga && !proximo && (
                        <span style={{
                          fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '12px',
                          background: 'var(--color-bg)', color: 'var(--color-text-muted)', border: '1px solid var(--color-divider)'
                        }}>
                          Acumulando
                        </span>
                      )}
```
(substituindo as duas condicionais `{proximo && (...)}` e `{!temFolga && !proximo && (...)}` originais — as demais condições da fileira, `temFolga` e `plusPendente`, ficam exatamente como estão).

- [ ] **Step 5: Cabeçalho do modal de detalhe**

Logo após a abertura `{isDetailsModalOpen && selectedEmployee && (` (linha 1053), antes do `<div onClick={...}>` de overlay, não dá pra declarar uma const solta fora de JSX — em vez disso, declarar `permiteCargaHorariaDetail` como uma variável normal **antes** do `return (` do componente não funciona (está dentro do JSX condicional). Solução: calcular inline no ponto de uso, ou declarar logo no corpo do componente (fora do JSX) como um `const` derivado de `selectedEmployee`:

Perto de outras variáveis derivadas do componente (ex.: logo após a declaração de `totalServidores`/`folgasProntas`/`proximos`/`totalFolgas`, por volta da linha 428), adicionar:
```ts
  const permiteCargaHorariaDetail = selectedEmployee?.schedule_types?.permite_carga_horaria !== false;
```

Em `Folgas.tsx:1086-1097` (card "Saldo" do resumo), trocar:
```tsx
                <div style={{ background: 'var(--color-bg)', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                  <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 600, marginBottom: '4px' }}>Saldo</div>
                  <div style={{ fontSize: '20px', fontWeight: 800 }}>
                    {Math.floor(((selectedEmployee.saldo_plantoes * 720) + (selectedEmployee.saldo_minutos || 0)) / 60)}h 
                    <span style={{ fontSize: '14px', marginLeft: '2px' }}>
                      {String(((selectedEmployee.saldo_plantoes * 720) + (selectedEmployee.saldo_minutos || 0)) % 60).padStart(2, '0')}m
                    </span>
                  </div>
                  <div style={{ height: '4px', background: 'var(--color-divider)', borderRadius: '2px', marginTop: '6px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: 'var(--color-primary)', width: `${Math.min((((selectedEmployee.saldo_plantoes * 720) + (selectedEmployee.saldo_minutos || 0)) / 15120) * 100, 100)}%` }}></div>
                  </div>
                </div>
```
por:
```tsx
                <div style={{ background: 'var(--color-bg)', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                  <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 600, marginBottom: '4px' }}>Saldo</div>
                  {permiteCargaHorariaDetail ? (
                    <>
                      <div style={{ fontSize: '20px', fontWeight: 800 }}>
                        {Math.floor(((selectedEmployee.saldo_plantoes * 720) + (selectedEmployee.saldo_minutos || 0)) / 60)}h 
                        <span style={{ fontSize: '14px', marginLeft: '2px' }}>
                          {String(((selectedEmployee.saldo_plantoes * 720) + (selectedEmployee.saldo_minutos || 0)) % 60).padStart(2, '0')}m
                        </span>
                      </div>
                      <div style={{ height: '4px', background: 'var(--color-divider)', borderRadius: '2px', marginTop: '6px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', background: 'var(--color-primary)', width: `${Math.min((((selectedEmployee.saldo_plantoes * 720) + (selectedEmployee.saldo_minutos || 0)) / 15120) * 100, 100)}%` }}></div>
                      </div>
                    </>
                  ) : (
                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-muted)', marginTop: '10px' }}>⚡ Só Plus</div>
                  )}
                </div>
```

- [ ] **Step 6: Aba Folgas — texto do banner**

Em `Folgas.tsx:1142-1144`, trocar o texto fixo do banner por uma condicional (mantém a lista de folgas abaixo intacta — folgas já geradas continuam grandfathered e visíveis/acionáveis):
```tsx
                      <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(59,130,246,0.05)', borderRadius: '8px', border: '1px solid rgba(59,130,246,0.1)', fontSize: '12px', color: 'var(--color-text)', lineHeight: 1.5, textAlign: 'justify' }}>
                        {permiteCargaHorariaDetail
                          ? 'Aqui estão listadas todas as folgas adquiridas pelo servidor. O sistema gera uma nova folga automaticamente a cada ciclo concluído, ou seja, sempre que o saldo acumulado atinge a marca de 21 plantões inteiros (252 horas)'
                          : 'Este servidor está em escala só-Plantão Plus e não acumula carga horária nova. As folgas listadas abaixo (se houver) foram geradas antes dessa configuração e continuam válidas normalmente.'}
                      </div>
```

- [ ] **Step 7: Aba Plantões — substituir por nota**

Em `Folgas.tsx:1212`, trocar a abertura:
```tsx
                  {detailTab === 'plantoes' && (
                    <div>
```
por:
```tsx
                  {detailTab === 'plantoes' && (
                    !permiteCargaHorariaDetail ? (
                      <div style={{ textAlign: 'center', padding: '32px', color: 'var(--color-text-muted)' }}>
                        ⚡ Este servidor está em escala só-Plantão Plus — não acumula carga horária compensatória.
                      </div>
                    ) : (
                    <div>
```

E no fechamento do bloco, em `Folgas.tsx:1365-1366`, trocar:
```tsx
                    </div>
                  )}
```
(o par que fecha especificamente a aba `plantoes`, logo antes do comentário `{/* ABA: Plantão Plus */}`) por:
```tsx
                    </div>
                    )
                  )}
```

- [ ] **Step 8: Verificar com build e visualmente**

Rodar `npm run build`. Depois `npm run dev`: usando o servidor de teste com `schedule_type_id` apontando pra uma escala com `permite_carga_horaria = false` (criar uma via a aba nova, Task 4), abrir Lançamento de Plantões e confirmar: (a) card mostra "⚡ Escala só Plantão Plus — não acumula carga horária" em vez da barra de saldo; (b) botão "⚡ Lançar Plus" continua funcionando normalmente; (c) modal de detalhe mostra "Só Plus" no resumo e a aba Plantões mostra só a nota, sem a linha do tempo de reconstrução.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/pages/estabelecimento/Folgas.tsx
git commit -m "feat(folgas): esconde carga horaria acumulada para escala so-Plus

Card, resumo do modal e aba Plantoes passam a checar
schedule_types.permite_carga_horaria antes de mostrar saldo/progresso.
Plantao Plus continua disponivel pra todo mundo, sem excecao. Folgas ja
geradas antes de uma escala virar so-Plus continuam visiveis (grandfather).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Verificação final e documentação

**Files:**
- Modify: `DOCUMENTACAO_TECNICA.md:627-652` (tabela de migrations — está desatualizada desde a 24, esta task já acrescenta 24/25/26)

**Interfaces:**
- Consumes: nada novo — task de fechamento.

- [ ] **Step 1: Atualizar a tabela de migrations**

Em `DOCUMENTACAO_TECNICA.md`, logo após a linha de `23_justificativa_max_1000.sql` (linha 652), adicionar 3 linhas (a doc está parada na 23 — 24 e 25 também nunca foram documentadas):
```md
| `24_auto_reject_pending_on_cycle_close.sql` | Ao fechar um ciclo, rejeita automaticamente `purchase_requests` ainda `SOLICITADA` e abre exceção pontual em `check_cycle_status()` para permitir esse UPDATE mesmo com o ciclo já FECHADO |
| `25_permite_update_compensatory_days_ciclo_fechado.sql` | `check_cycle_status()` deixa de bloquear UPDATE em `compensatory_days` por ciclo fechado (o `cycle_id` da folga é só histórico, não uma janela de edição) — corrige compra de folgas de backlog que ficavam presas em `GERADA` |
| `26_escalas_modalidade_compra.sql` | Cria `schedule_types`/`schedule_type_aliases` + `employees.schedule_type_id`; `trg_recalculate_shift_balance` para de acumular saldo para servidores em escala com `permite_carga_horaria = false` |
```

- [ ] **Step 2: `impact()` e `detect_changes()` finais**

Rodar `detect_changes({scope: "compare", base_ref: "main"})` do GitNexus e conferir que só os símbolos esperados (`trg_recalculate_shift_balance`, `handleConfirmImport`, `handleFileChange`, `fetchEmployees`, e os novos handlers/fetches de Configuracoes.tsx) aparecem afetados — reportar ao usuário qualquer coisa fora do esperado antes de seguir.

- [ ] **Step 3: Teste ponta a ponta manual**

Seguir os 5 passos da seção "Verificação" da spec (já cobertos pelas tasks anteriores, exceto o passo de religar a escala): criar uma escala de teste, desabilitar, confirmar que Comprar Folga/Registrar Gozo em `Solicitacoes.tsx` continuam funcionando pra qualquer folga já existente (nenhuma mudança de código lá — é comportamento natural do trigger, ver spec seção 3.6), reabilitar a escala, importar um plantão novo e confirmar que o acúmulo volta a valer só a partir dali.

- [ ] **Step 4: Commit**

```bash
git add DOCUMENTACAO_TECNICA.md
git commit -m "docs: atualiza tabela de migrations (24, 25 e 26)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

**Lembrete final:** nenhuma task deste plano faz `git push`. Avisar o usuário que os commits estão só locais, prontos pra ele testar, e perguntar antes de subir para o GitHub.

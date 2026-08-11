# Transferência de Servidor Entre Estabelecimentos — Implementação

> **STATUS (2026-08-11):** Tasks 1-5 concluídas e verificadas nesta branch (`worktree-transferencia-servidor`). Migrations 17 e 18 já foram aplicadas no banco de produção real (colunas `establishment_id` criadas/backfilled em `shifts`/`compensatory_days`, trigger atualizado). Código das Tasks 3-5 commitado, `npm run build` limpo, `detect_changes` revisado (risco medium, só nos símbolos esperados) — mas **ainda não mergeado na `main` nem deployado no Vercel**. Tasks 6, 7 e 8 estão pausadas de propósito, por decisão do usuário: só retomar depois que ele confirmar que o deploy de produção com as Tasks 3-5 está no ar (é a pré-condição já documentada na própria Task 6 abaixo).

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Exceção deste plano:** as Tasks 1, 2, 6 e 7 alteram schema/trigger/RLS no Postgres do Supabase via DDL. Não há acesso de execução SQL direta disponível (só REST/PostgREST via service role key, que não executa DDL) — quem executar este plano **precisa pausar em cada uma dessas tasks e pedir ao usuário para colar o SQL no SQL Editor do Supabase e confirmar sucesso**, antes de seguir para a verificação e o próximo passo. Por isso `superpowers:executing-plans` (inline, com checkpoints) é a opção recomendada sobre subagent-driven para este plano específico.

**Goal:** Implementar a spec aprovada em [docs/superpowers/specs/2026-08-07-transferencia-servidor-design.md](../specs/2026-08-07-transferencia-servidor-design.md) — quando um servidor é transferido de estabelecimento, a transferência só é reconhecida na importação mensal seguinte (nunca no meio de um ciclo), o saldo de minutos acumulado segue o servidor para a nova unidade, e o histórico de plantões/folgas de ciclos anteriores permanece atribuído à unidade onde de fato aconteceu, tanto para RLS quanto para relatórios.

**Architecture:** Hoje `employees` é identificado por `UNIQUE(establishment_id, matricula)`, o que faz a importação criar um servidor duplicado a cada transferência. A correção usa 3 camadas: `employees.establishment_id`/`saldo_minutos` viram "custódia atual" (móvel, `matricula` passa a ser a chave única global); `shifts`/`compensatory_days` ganham coluna própria `establishment_id` ("onde aconteceu", fixa para sempre, preenchida no insert e propagada pelo trigger `trg_recalculate_shift_balance`); `purchase_requests` não muda (já usa `establishment_id` fixo no momento da solicitação).

**Tech Stack:** Postgres/Supabase (SQL aplicado manualmente no SQL Editor, convenção do projeto — ver `DOCUMENTACAO_TECNICA.md:497`), React + TypeScript + supabase-js no frontend, sem framework de testes automatizado no projeto.

## Global Constraints

- Matrícula é identificador único e global do servidor na SEAP — não se repete entre unidades (confirmado pelo usuário, e verificado por auditoria em 2026-08-11: 1000 employees, 1000 matrículas distintas, zero duplicatas entre estabelecimentos).
- A detecção de transferência é 100% automática, só ocorre durante a importação mensal — nunca há tela manual de "Transferir Servidor", nunca ocorre no meio de um ciclo aberto (reforçado pelo trigger `check_cycle_status()` em [database/01_rls_functions_triggers.sql:78-93](../../../database/01_rls_functions_triggers.sql#L78-L93), que já bloqueia inserts em `shifts`/`compensatory_days` de ciclos `FECHADO`).
- `saldo_minutos` sempre segue o servidor (custódia móvel); `shifts`/`compensatory_days` de um ciclo já ocorrido nunca mudam de estabelecimento depois.
- `purchase_requests` está fora de escopo — já correto hoje (`establishment_id` gravado no insert, nunca atualizado).
- Sem suíte de testes automatizada — verificação é: `npm run build` (type-check) para o frontend, e queries de leitura via service role key (script Node reaproveitando o padrão de `audit_matriculas.cjs`) para o banco.
- Migrations SQL deste projeto são numeradas sequencialmente em `database/` e aplicadas manualmente no SQL Editor do Supabase, em ordem (não há CLI de migration).
- Ordem de rollout não é opcional — está definida na spec (seção 4) especificamente para não quebrar produção: colunas novas → backfill → trigger → deploy frontend → deploy relatórios → migração de constraint → RLS. Migrar a constraint (Task 6) antes do frontend novo estar em produção (Task 3) quebra a importação atual, que depende da constraint composta existir.

---

## Mapa de arquivos

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `database/17_transferencia_servidor_colunas.sql` | Criar | Colunas `establishment_id` novas em `shifts`/`compensatory_days` + backfill |
| `database/18_transferencia_servidor_trigger.sql` | Criar | `trg_recalculate_shift_balance` propaga `establishment_id` ao gerar folga |
| `frontend/src/pages/admin/Configuracoes.tsx` | Modificar | Importação: busca por matrícula global, detecta transferência, grava `establishment_id` no shift |
| `frontend/src/pages/admin/Relatorios.tsx` | Modificar | "Folha por Servidor": filtra/exibe por `shifts.establishment_id`, não pela lotação atual |
| `frontend/src/pages/estabelecimento/Relatorios.tsx` | Modificar | Mesmo fix, versão do estabelecimento |
| `database/19_transferencia_servidor_constraint.sql` | Criar | `employees` passa a ter `UNIQUE(matricula)` |
| `database/20_transferencia_servidor_rls.sql` | Criar | RLS `Est_shifts`/`Est_compensatory_days` usam a coluna direta; `NOT NULL` + índice |

---

### Task 1: Migration 17 — colunas novas + backfill

**Files:**
- Create: `database/17_transferencia_servidor_colunas.sql`

**Interfaces:**
- Produces: colunas `shifts.establishment_id` (UUID, nullable por enquanto) e `compensatory_days.establishment_id` (UUID, nullable por enquanto), ambas `REFERENCES establishments(id)`, com todas as linhas existentes preenchidas.

- [ ] **Step 1: Escrever a migration**

```sql
-- =====================================================================================
-- 17. TRANSFERÊNCIA DE SERVIDOR — Passo 1/4: colunas novas (histórico fixo por unidade)
-- =====================================================================================
-- shifts/compensatory_days passam a guardar em qual estabelecimento o plantão/folga
-- de fato aconteceu, de forma imutável — independente de o servidor ser transferido
-- depois. employees.establishment_id continua sendo a "custódia atual" (móvel).
-- Nullable por enquanto: só viram NOT NULL na migration 20, depois que o novo
-- Configuracoes.tsx (que preenche a coluna no insert) estiver em produção.

ALTER TABLE shifts ADD COLUMN IF NOT EXISTS establishment_id UUID REFERENCES establishments(id);
ALTER TABLE compensatory_days ADD COLUMN IF NOT EXISTS establishment_id UUID REFERENCES establishments(id);

-- Backfill: única fonte disponível para linhas já existentes é o establishment_id
-- ATUAL do servidor. Aceitável — sistema em produção há poucos dias (~10) e a
-- auditoria de 2026-08-11 não encontrou nenhuma matrícula em mais de um
-- estabelecimento, ou seja, nenhuma transferência real ainda aconteceu na base.
UPDATE shifts s
SET establishment_id = e.establishment_id
FROM employees e
WHERE s.employee_id = e.id AND s.establishment_id IS NULL;

UPDATE compensatory_days cd
SET establishment_id = e.establishment_id
FROM employees e
WHERE cd.employee_id = e.id AND cd.establishment_id IS NULL;
```

- [ ] **Step 2: Pausar e pedir para o usuário aplicar**

Peça ao usuário para colar o conteúdo de `database/17_transferencia_servidor_colunas.sql` no SQL Editor do Supabase (projeto `kpieihxfwuoqxsiysezk`) e confirmar que rodou sem erro. Não prossiga para o Step 3 sem essa confirmação.

- [ ] **Step 3: Verificar via service role key**

Rode (reaproveita o padrão de `audit_matriculas.cjs`, lendo `SUPABASE_SERVICE_ROLE_KEY` de `frontend/.env.local`):

```bash
node -e "
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const env = {};
fs.readFileSync('frontend/.env.local', 'utf-8').split('\n').forEach(l => { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m) env[m[1]] = m[2].trim(); });
const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
(async () => {
  const { count: shiftsNull } = await supabase.from('shifts').select('*', { count: 'exact', head: true }).is('establishment_id', null);
  const { count: compNull } = await supabase.from('compensatory_days').select('*', { count: 'exact', head: true }).is('establishment_id', null);
  console.log('shifts com establishment_id NULL:', shiftsNull);
  console.log('compensatory_days com establishment_id NULL:', compNull);
})();
"
```

Expected: `0` para ambos. Se algum não for zero, a migration não rodou completa (verifique se `employees.establishment_id` está NULL para algum funcionário referenciado — não deveria, mas pare e investigue antes de seguir).

- [ ] **Step 4: Commit**

```bash
git add database/17_transferencia_servidor_colunas.sql
git commit -m "feat: adiciona establishment_id fixo em shifts e compensatory_days"
```

---

### Task 2: Migration 18 — trigger propaga establishment_id

**Files:**
- Create: `database/18_transferencia_servidor_trigger.sql`
- Modify (referência, não editar diretamente): `database/04_saldo_plantoes.sql:16-91` (função original — fica desatualizada como registro histórico; a definição viva no banco é sempre o último `CREATE OR REPLACE FUNCTION`, então esta migration nova é que vale)

**Interfaces:**
- Consumes: `shifts.establishment_id` (Task 1)
- Produces: `compensatory_days` geradas automaticamente pelo trigger agora vêm com `establishment_id` preenchido, herdado do shift mais recente do servidor.

- [ ] **Step 1: Escrever a migration**

```sql
-- =====================================================================================
-- 18. TRANSFERÊNCIA DE SERVIDOR — Passo 2/4: trigger propaga establishment_id
-- =====================================================================================
-- Quem gera compensatory_days não é o frontend, é este trigger (dispara a cada
-- INSERT/UPDATE/DELETE em shifts). Ele já busca cycle_id/periodo_inicio/periodo_fim/
-- created_by do shift mais recente do servidor — passa a buscar establishment_id
-- também e gravar na folga gerada.

CREATE OR REPLACE FUNCTION trg_recalculate_shift_balance()
RETURNS TRIGGER AS $$
DECLARE
    v_emp_id UUID;
    v_total_shifts INTEGER;
    v_total_folgas INTEGER;
    v_current_balance INTEGER;
    v_folgas_to_generate INTEGER;
    v_cycle_id UUID;
    v_per_inicio DATE;
    v_per_fim DATE;
    v_user UUID;
    v_establishment_id UUID;
    v_i INTEGER;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_emp_id := OLD.employee_id;
    ELSE
        v_emp_id := NEW.employee_id;
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
        SELECT cycle_id, periodo_inicio, periodo_fim, created_by, establishment_id
        INTO v_cycle_id, v_per_inicio, v_per_fim, v_user, v_establishment_id
        FROM shifts WHERE employee_id = v_emp_id ORDER BY created_at DESC LIMIT 1;

        FOR v_i IN 1..v_folgas_to_generate LOOP
            INSERT INTO compensatory_days (employee_id, cycle_id, shift_id, periodo_inicio, periodo_fim, quantidade_plantoes, status, generated_by, establishment_id)
            VALUES (v_emp_id, v_cycle_id, NULL, v_per_inicio, v_per_fim, 1, 'GERADA', v_user, v_establishment_id);
        END LOOP;

        v_current_balance := v_current_balance - (v_folgas_to_generate * 21);
    END IF;

    UPDATE employees SET saldo_plantoes = v_current_balance WHERE id = v_emp_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;
```

- [ ] **Step 2: Pausar e pedir para o usuário aplicar**

Mesmo processo da Task 1 — colar no SQL Editor, confirmar sucesso antes de seguir. `CREATE OR REPLACE FUNCTION` é seguro de reaplicar (idempotente), não precisa recriar o trigger em si (o `CREATE TRIGGER` original de `04_saldo_plantoes.sql:95-97` continua apontando para a função, que agora tem corpo novo).

- [ ] **Step 3: Verificar**

Não dá para verificar só de leitura sem gerar uma folga de verdade (precisa de 21 plantões acumulados). Verificação funcional fica para a Task 8 (cenário de ponta a ponta). Aqui, confirme apenas que a aplicação não retornou erro no SQL Editor (uma função `plpgsql` com erro de sintaxe falha na hora do `CREATE OR REPLACE`).

- [ ] **Step 4: Commit**

```bash
git add database/18_transferencia_servidor_trigger.sql
git commit -m "feat: trigger de folgas automaticas propaga establishment_id"
```

---

### Task 3: Configuracoes.tsx — importação reconhece transferência

**Files:**
- Modify: `frontend/src/pages/admin/Configuracoes.tsx:75` (tipo `ImportResult`)
- Modify: `frontend/src/pages/admin/Configuracoes.tsx:560-676` (`handleConfirmImport`)
- Modify: `frontend/src/pages/admin/Configuracoes.tsx:1027-1043` (render do resultado)

**Interfaces:**
- Consumes: `shifts.establishment_id` (Task 1) — passa a ser gravado no insert do shift.
- Produces: `ImportResult` ganha os campos `transferidos: number` e `transferenciasDetalhe: string[]`, consumidos pelo bloco de render da Etapa 4.

GitNexus `impact(handleConfirmImport, upstream)` já foi rodado: risco **LOW**, 2 símbolos afetados (`Configuracoes` e `App`), sem processos críticos quebrados — seguro para editar.

- [ ] **Step 1: Atualizar o tipo `ImportResult` (linha 75)**

De:
```tsx
  type ImportResult = { importados: number; atualizados: number; shiftsInseridos: number; erros: string[] };
```
Para:
```tsx
  type ImportResult = { importados: number; atualizados: number; transferidos: number; shiftsInseridos: number; transferenciasDetalhe: string[]; erros: string[] };
```

- [ ] **Step 2: Mapear id→nome de estabelecimento e trocar a busca de servidor existente para matrícula global**

Dentro de `handleConfirmImport`, logo após a leitura de `ests`/`positions` (por volta da linha 564-568), adicionar o mapa reverso:

```tsx
      const estMap = new Map<string, string>();
      ests?.forEach(e => estMap.set(normalizeStr(e.nome), e.id));

      const estIdToNome = new Map<string, string>();
      ests?.forEach(e => estIdToNome.set(e.id, e.nome));

      const posMap = new Map<string, string>();
```

Depois, trocar (por volta da linha 571) a inicialização de contadores:

De:
```tsx
      let importados = 0, atualizados = 0, shiftsInseridos = 0;
      const erros: string[] = [];
```
Para:
```tsx
      let importados = 0, atualizados = 0, transferidos = 0, shiftsInseridos = 0;
      const erros: string[] = [];
      const transferenciasDetalhe: string[] = [];
```

E trocar a busca do servidor existente (por volta da linha 590-598):

De:
```tsx
        // Buscar servidor existente com saldo de minutos atual
        const { data: existingEmp } = await supabase
          .from('employees')
          .select('id, saldo_minutos')
          .eq('establishment_id', estId)
          .eq('matricula', row.matricula)
          .maybeSingle();

        let saldoMinutosBase = existingEmp?.saldo_minutos ?? 0;
```
Para:
```tsx
        // Busca por matrícula globalmente — matrícula é identificador único do
        // servidor na SEAP, não escopado por estabelecimento. Isso é o que permite
        // reconhecer o mesmo servidor quando ele é transferido de unidade.
        const { data: existingEmp } = await supabase
          .from('employees')
          .select('id, saldo_minutos, establishment_id')
          .eq('matricula', row.matricula)
          .maybeSingle();

        const isTransfer = !!existingEmp && existingEmp.establishment_id !== estId;
        let saldoMinutosBase = existingEmp?.saldo_minutos ?? 0;
```

- [ ] **Step 3: Substituir o `upsert` por INSERT/UPDATE explícito**

O bloco de `forceOverwrite` (linhas ~604-624, que reverte `minutos_residuais` de shifts antigos do mesmo ciclo antes de reimportar) e o cálculo de `plantoesTotal`/`novoSaldoMinutos` (linhas ~626-629) **não mudam** — já operam em cima de `existingEmp.id`, que agora é resolvido globalmente em vez de por estabelecimento, e continuam corretos.

O que muda é só o bloco de salvar o servidor (linhas 631-650). O `upsert` com `onConflict: 'establishment_id,matricula'` depende da constraint composta atual do banco — que só será trocada na Task 6, **depois** deste deploy. Trocar o `onConflict` para `'matricula'` agora quebraria a importação até a Task 6 rodar (não existe ainda constraint única só em `matricula`). A solução é não depender de `onConflict` nenhum: fazer `UPDATE` explícito quando já existe, `INSERT` quando não existe — funciona igual antes e depois da Task 6.

De:
```tsx
        // Upsert do servidor com novo saldo_minutos
        const { data: empData, error: empError } = await supabase
          .from('employees')
          .upsert(
            {
              establishment_id: estId,
              matricula: row.matricula,
              nome: row.nome,
              position_id: posId,
              ativo: true,
              data_admissao: row.dataAdmissao,
              saldo_minutos: novoSaldoMinutos
            },
            { onConflict: 'establishment_id,matricula', ignoreDuplicates: false }
          )
          .select('id')
          .single();

        const empId = empData?.id ?? existingEmp?.id;
        if (!empId) { erros.push(`Erro ao salvar servidor ${row.nome}: ${empError?.message}`); continue; }

        if (!existingEmp) importados++;
        else atualizados++;

        // Inserir shift — seguro pois os shifts antigos foram deletados acima
        if (plantoesTotal > 0) {
          const { error: shiftErr } = await supabase.from('shifts').insert({
            employee_id: empId,
            cycle_id: activeCycleForImport.id,
            periodo_inicio: activeCycleForImport.data_inicio,
            periodo_fim: activeCycleForImport.data_fim,
            quantidade_plantoes: plantoesTotal,
            minutos_residuais: novoSaldoMinutos,
          });
          if (!shiftErr) shiftsInseridos++;
          else erros.push(`Erro ao inserir plantões de ${row.nome}: ${shiftErr.message}`);
        }
```
Para:
```tsx
        // INSERT/UPDATE explícito (não upsert) — cobre atualização normal E
        // transferência sem depender de qual constraint única existe no momento
        // do deploy (ver Task 6 da migration).
        let empId: string | undefined;
        if (existingEmp) {
          const { error: empError } = await supabase
            .from('employees')
            .update({
              establishment_id: estId,
              nome: row.nome,
              position_id: posId,
              ativo: true,
              data_admissao: row.dataAdmissao,
              saldo_minutos: novoSaldoMinutos
            })
            .eq('id', existingEmp.id);
          if (empError) { erros.push(`Erro ao salvar servidor ${row.nome}: ${empError.message}`); continue; }
          empId = existingEmp.id;
        } else {
          const { data: empData, error: empError } = await supabase
            .from('employees')
            .insert({
              establishment_id: estId,
              matricula: row.matricula,
              nome: row.nome,
              position_id: posId,
              ativo: true,
              data_admissao: row.dataAdmissao,
              saldo_minutos: novoSaldoMinutos
            })
            .select('id')
            .single();
          if (empError || !empData) { erros.push(`Erro ao salvar servidor ${row.nome}: ${empError?.message}`); continue; }
          empId = empData.id;
        }

        if (!existingEmp) {
          importados++;
        } else if (isTransfer) {
          transferidos++;
          transferenciasDetalhe.push(`${row.nome} (matrícula ${row.matricula}): ${estIdToNome.get(existingEmp.establishment_id) || existingEmp.establishment_id} → ${row.estabelecimento}`);
        } else {
          atualizados++;
        }

        // Inserir shift — seguro pois os shifts antigos foram deletados acima.
        // establishment_id fixa para sempre onde este plantão aconteceu.
        if (plantoesTotal > 0) {
          const { error: shiftErr } = await supabase.from('shifts').insert({
            employee_id: empId,
            cycle_id: activeCycleForImport.id,
            establishment_id: estId,
            periodo_inicio: activeCycleForImport.data_inicio,
            periodo_fim: activeCycleForImport.data_fim,
            quantidade_plantoes: plantoesTotal,
            minutos_residuais: novoSaldoMinutos,
          });
          if (!shiftErr) shiftsInseridos++;
          else erros.push(`Erro ao inserir plantões de ${row.nome}: ${shiftErr.message}`);
        }
```

- [ ] **Step 4: Atualizar o `setImportResult` final (linha ~670)**

De:
```tsx
      setImportResult({ importados, atualizados, shiftsInseridos, erros });
```
Para:
```tsx
      setImportResult({ importados, atualizados, transferidos, shiftsInseridos, transferenciasDetalhe, erros });
```

- [ ] **Step 5: Atualizar o render da Etapa 4 (linhas 1027-1043)**

De:
```tsx
                {importStep === 'done' && importResult && (
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '16px', marginBottom: '20px' }}>✅ Importação Concluída!</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
                      <div style={{ padding: '16px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '8px', textAlign: 'center' }}>
                        <div style={{ fontSize: '28px', fontWeight: 800, color: '#16a34a' }}>{importResult.importados}</div>
                        <div style={{ fontSize: '12px', color: '#15803d', marginTop: '4px' }}>Servidores Novos</div>
                      </div>
                      <div style={{ padding: '16px', background: '#eff6ff', border: '1px solid #93c5fd', borderRadius: '8px', textAlign: 'center' }}>
                        <div style={{ fontSize: '28px', fontWeight: 800, color: '#2563eb' }}>{importResult.atualizados}</div>
                        <div style={{ fontSize: '12px', color: '#1d4ed8', marginTop: '4px' }}>Servidores Atualizados</div>
                      </div>
                      <div style={{ padding: '16px', background: '#fefce8', border: '1px solid #fde047', borderRadius: '8px', textAlign: 'center' }}>
                        <div style={{ fontSize: '28px', fontWeight: 800, color: '#ca8a04' }}>{importResult.shiftsInseridos}</div>
                        <div style={{ fontSize: '12px', color: '#a16207', marginTop: '4px' }}>Registros de Plantões</div>
                      </div>
                    </div>

                    {importResult.erros.length > 0 && (
```
Para:
```tsx
                {importStep === 'done' && importResult && (
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '16px', marginBottom: '20px' }}>✅ Importação Concluída!</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
                      <div style={{ padding: '16px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '8px', textAlign: 'center' }}>
                        <div style={{ fontSize: '28px', fontWeight: 800, color: '#16a34a' }}>{importResult.importados}</div>
                        <div style={{ fontSize: '12px', color: '#15803d', marginTop: '4px' }}>Servidores Novos</div>
                      </div>
                      <div style={{ padding: '16px', background: '#eff6ff', border: '1px solid #93c5fd', borderRadius: '8px', textAlign: 'center' }}>
                        <div style={{ fontSize: '28px', fontWeight: 800, color: '#2563eb' }}>{importResult.atualizados}</div>
                        <div style={{ fontSize: '12px', color: '#1d4ed8', marginTop: '4px' }}>Servidores Atualizados</div>
                      </div>
                      <div style={{ padding: '16px', background: '#faf5ff', border: '1px solid #d8b4fe', borderRadius: '8px', textAlign: 'center' }}>
                        <div style={{ fontSize: '28px', fontWeight: 800, color: '#9333ea' }}>{importResult.transferidos}</div>
                        <div style={{ fontSize: '12px', color: '#7e22ce', marginTop: '4px' }}>Servidores Transferidos</div>
                      </div>
                      <div style={{ padding: '16px', background: '#fefce8', border: '1px solid #fde047', borderRadius: '8px', textAlign: 'center' }}>
                        <div style={{ fontSize: '28px', fontWeight: 800, color: '#ca8a04' }}>{importResult.shiftsInseridos}</div>
                        <div style={{ fontSize: '12px', color: '#a16207', marginTop: '4px' }}>Registros de Plantões</div>
                      </div>
                    </div>

                    {importResult.transferenciasDetalhe.length > 0 && (
                      <div style={{ background: '#faf5ff', border: '1px solid #d8b4fe', borderRadius: '8px', padding: '16px', marginBottom: '20px' }}>
                        <div style={{ fontWeight: 700, color: '#7e22ce', marginBottom: '8px' }}>🔄 {importResult.transferenciasDetalhe.length} transferência(s) detectada(s):</div>
                        <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                          {importResult.transferenciasDetalhe.map((t, i) => <div key={i} style={{ fontSize: '12px', color: '#6b21a8', marginBottom: '4px' }}>• {t}</div>)}
                        </div>
                      </div>
                    )}

                    {importResult.erros.length > 0 && (
```

- [ ] **Step 6: Type-check**

Run: `cd frontend && npm run build`
Expected: build sem erros de TypeScript.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/admin/Configuracoes.tsx
git commit -m "feat: importacao mensal reconhece transferencia de servidor por matricula global"
```

- [ ] **Step 8: Pausar — este deploy precisa ir para produção antes da Task 6**

Avise o usuário: a partir daqui, o código de importação já assume que a matrícula é global, mas o banco ainda tem a constraint composta antiga (isso é seguro — o novo código não depende mais dela, usa INSERT/UPDATE explícito). A Task 6 (migration de constraint) só deve ser aplicada depois deste deploy estar rodando em produção, para não haver descompasso.

---

### Task 4: admin/Relatorios.tsx — "Folha por Servidor" usa establishment_id fixo

**Files:**
- Modify: `frontend/src/pages/admin/Relatorios.tsx:293-383` (`loadFolhaServidor`)

**Interfaces:**
- Consumes: `shifts.establishment_id`, `compensatory_days.establishment_id` (Task 1)

GitNexus `impact(loadFolhaServidor, upstream)` já foi rodado: risco **LOW**, 3 símbolos afetados (`loadData`, `Relatorios`, `App`), sem quebra de processo crítico.

- [ ] **Step 1: Trocar a query de shifts para filtrar/expor establishment_id direto**

De:
```tsx
  const loadFolhaServidor = async () => {
    // 1. Busca shifts no ciclo (plantões trabalhados)
    let shiftQ = supabase
      .from('shifts')
      .select('employee_id, quantidade_plantoes, minutos_residuais, employees ( id, matricula, nome, saldo_minutos, establishment_id, establishments ( nome ), positions ( codigo, nome ) )')
      .eq('cycle_id', selectedCycle);
    if (selectedEst) shiftQ = shiftQ.eq('employees.establishment_id', selectedEst);
    const shiftData = await fetchAll(shiftQ);

    // 2. Busca compensatory_days (folgas geradas)
    let compQ = supabase
      .from('compensatory_days')
      .select('employee_id, status, quantidade_plantoes')
      .eq('cycle_id', selectedCycle);
    const compData = await fetchAll(compQ);
```
Para:
```tsx
  const loadFolhaServidor = async () => {
    // 1. Busca shifts no ciclo (plantões trabalhados). establishment_id é fixo por
    // registro — onde o plantão aconteceu, não a lotação atual do servidor.
    let shiftQ = supabase
      .from('shifts')
      .select('employee_id, quantidade_plantoes, minutos_residuais, establishment_id, establishments ( nome ), employees ( id, matricula, nome, saldo_minutos, positions ( codigo, nome ) )')
      .eq('cycle_id', selectedCycle);
    if (selectedEst) shiftQ = shiftQ.eq('establishment_id', selectedEst);
    const shiftData = await fetchAll(shiftQ);

    // 2. Busca compensatory_days (folgas geradas). Mesmo princípio: establishment_id
    // fixo, não a lotação atual do servidor.
    let compQ = supabase
      .from('compensatory_days')
      .select('employee_id, status, quantidade_plantoes')
      .eq('cycle_id', selectedCycle);
    if (selectedEst) compQ = compQ.eq('establishment_id', selectedEst);
    const compData = await fetchAll(compQ);
```

- [ ] **Step 2: Trocar o filtro em memória e a origem de `establishment_id`/`nome_est` da linha**

De:
```tsx
    for (const s of shiftData || []) {
      const emp = (s.employees as any);
      if (!emp) continue;
      if (selectedEst && emp.establishment_id !== selectedEst) continue;

      const empId = emp.id;
      if (!empMap.has(empId)) {
        empMap.set(empId, {
          employee_id: empId,
          matricula: emp.matricula || '',
          nome: emp.nome || '',
          cargo_codigo: emp.positions?.codigo || '',
          cargo_nome: emp.positions?.nome || '',
          establishment_id: emp.establishment_id || '',
          nome_est: emp.establishments?.nome || '',
```
Para:
```tsx
    for (const s of shiftData || []) {
      const emp = (s.employees as any);
      if (!emp) continue;

      const empId = emp.id;
      if (!empMap.has(empId)) {
        empMap.set(empId, {
          employee_id: empId,
          matricula: emp.matricula || '',
          nome: emp.nome || '',
          cargo_codigo: emp.positions?.codigo || '',
          cargo_nome: emp.positions?.nome || '',
          establishment_id: (s as any).establishment_id || '',
          nome_est: (s as any).establishments?.nome || '',
```

(O filtro `if (selectedEst && emp.establishment_id !== selectedEst) continue;` some porque o filtro já acontece na query, em `shiftQ`, contra `establishment_id` do próprio shift.)

- [ ] **Step 3: Type-check**

Run: `cd frontend && npm run build`
Expected: build sem erros de TypeScript.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/admin/Relatorios.tsx
git commit -m "fix: Folha por Servidor (admin) usa establishment_id fixo do plantao/folga"
```

---

### Task 5: estabelecimento/Relatorios.tsx — mesmo fix

**Files:**
- Modify: `frontend/src/pages/estabelecimento/Relatorios.tsx:173-190` (`loadFolhaServidor`)

**Interfaces:**
- Consumes: `shifts.establishment_id`, `compensatory_days.establishment_id` (Task 1)

GitNexus `impact(loadFolhaServidor, upstream)` já foi rodado (arquivo estabelecimento): risco **LOW**, 3 símbolos afetados (`loadData`, `Relatorios`, `App`), sem quebra de processo crítico.

- [ ] **Step 1: Trocar as duas queries**

De:
```tsx
  const loadFolhaServidor = async () => {
    const estId = profile!.establishment_id!;

    // 1. Busca shifts no ciclo
    const { data: shiftData, error: shiftErr } = await supabase
      .from('shifts')
      .select('employee_id, quantidade_plantoes, employees!inner(id, matricula, nome, saldo_minutos, establishment_id, positions(codigo, nome))')
      .eq('cycle_id', selectedCycle)
      .eq('employees.establishment_id', estId);
    if (shiftErr) throw shiftErr;

    // 2. Busca compensatory_days
    const { data: compData, error: compErr } = await supabase
      .from('compensatory_days')
      .select('employee_id, status, quantidade_plantoes, employees!inner(establishment_id)')
      .eq('cycle_id', selectedCycle)
      .eq('employees.establishment_id', estId);
    if (compErr) throw compErr;
```
Para:
```tsx
  const loadFolhaServidor = async () => {
    const estId = profile!.establishment_id!;

    // 1. Busca shifts no ciclo. establishment_id é fixo por registro — onde o
    // plantão aconteceu, não a lotação atual do servidor.
    const { data: shiftData, error: shiftErr } = await supabase
      .from('shifts')
      .select('employee_id, quantidade_plantoes, employees!inner(id, matricula, nome, saldo_minutos, positions(codigo, nome))')
      .eq('cycle_id', selectedCycle)
      .eq('establishment_id', estId);
    if (shiftErr) throw shiftErr;

    // 2. Busca compensatory_days. Mesmo princípio.
    const { data: compData, error: compErr } = await supabase
      .from('compensatory_days')
      .select('employee_id, status, quantidade_plantoes')
      .eq('cycle_id', selectedCycle)
      .eq('establishment_id', estId);
    if (compErr) throw compErr;
```

- [ ] **Step 2: Type-check**

Run: `cd frontend && npm run build`
Expected: build sem erros de TypeScript.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/estabelecimento/Relatorios.tsx
git commit -m "fix: Folha por Servidor (estabelecimento) usa establishment_id fixo do plantao/folga"
```

---

### Task 6: Migration 19 — `employees.matricula` única globalmente

**Pré-condição obrigatória:** Tasks 3, 4 e 5 já implantadas em produção (o código que depende da constraint antiga via `onConflict` não existe mais). Não aplicar esta migration antes disso.

**Files:**
- Create: `database/19_transferencia_servidor_constraint.sql`

**Interfaces:**
- Produces: `employees` passa a ter `UNIQUE (matricula)` no lugar de `UNIQUE (establishment_id, matricula)`.

- [ ] **Step 1: Escrever a migration**

```sql
-- =====================================================================================
-- 19. TRANSFERÊNCIA DE SERVIDOR — Passo 3/4: matrícula única globalmente
-- APLICAR SOMENTE DEPOIS que Configuracoes.tsx novo (busca por matrícula global,
-- sem depender de onConflict) já estiver em produção.
-- =====================================================================================
-- Migração autoprotegida: se já existir matrícula duplicada entre estabelecimentos,
-- o ADD CONSTRAINT falha explicitamente, sem apagar nada. Auditoria de 2026-08-11
-- não encontrou nenhuma (1000 employees, 1000 matrículas distintas).

DO $$
DECLARE
  v_conname TEXT;
BEGIN
  SELECT conname INTO v_conname
  FROM pg_constraint
  WHERE conrelid = 'employees'::regclass
    AND contype = 'u'
    AND conname <> 'employees_matricula_key';

  IF v_conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE employees DROP CONSTRAINT %I', v_conname);
  END IF;
END $$;

ALTER TABLE employees ADD CONSTRAINT employees_matricula_key UNIQUE (matricula);
```

- [ ] **Step 2: Pausar e pedir para o usuário aplicar**

Colar no SQL Editor, confirmar sucesso. Se falhar com erro de duplicidade, PARAR — significa que uma matrícula real colidiu entre estabelecimentos desde a auditoria; rode a query de auditoria (seção 6 da spec) de novo antes de insistir.

- [ ] **Step 3: Verificar**

Reaproveitar o script de auditoria já usado (`audit_matriculas.cjs`, adaptado no scratchpad) — deve continuar reportando zero matrículas duplicadas. Adicionalmente, confirmar que a constraint nova existe tentando um insert de teste que deveria falhar não é seguro em produção (evitar). Confiar no erro explícito do `ADD CONSTRAINT` do Step 2 como sinal de sucesso/falha.

- [ ] **Step 4: Commit**

```bash
git add database/19_transferencia_servidor_constraint.sql
git commit -m "feat: matricula passa a ser identificador unico global do servidor"
```

---

### Task 7: Migration 20 — RLS usa establishment_id direto + NOT NULL + índice

**Pré-condição obrigatória:** Task 3 em produção há pelo menos um ciclo completo de importação, para garantir que não há mais nenhum shift/compensatory_day sendo criado com `establishment_id` NULL (senão o `NOT NULL` falha, e trocar a RLS antes esconderia dados de quem tem permissão de vê-los).

**Files:**
- Create: `database/20_transferencia_servidor_rls.sql`

**Interfaces:**
- Consumes: `shifts.establishment_id`, `compensatory_days.establishment_id` 100% preenchidos (Tasks 1 + 3)

- [ ] **Step 1: Verificar que não há mais NULLs antes de continuar**

Rode o mesmo script de verificação da Task 1 (Step 3). Se `shifts com establishment_id NULL` ou `compensatory_days com establishment_id NULL` não forem `0`, pare — a Task 3 pode não estar em produção ainda, ou algum outro caminho de insert não passou por ela.

- [ ] **Step 2: Escrever a migration**

```sql
-- =====================================================================================
-- 20. TRANSFERÊNCIA DE SERVIDOR — Passo 4/4: RLS usa coluna direta, NOT NULL, índice
-- =====================================================================================
-- Antes: RLS de shifts/compensatory_days filtrava pela lotação ATUAL do servidor
-- (join em employees.establishment_id) — depois de uma transferência, a unidade de
-- origem perderia a permissão de ver o próprio histórico. Agora filtra pela coluna
-- fixa, gravada no momento em que o plantão/folga aconteceu.

DROP POLICY IF EXISTS "Est_shifts" ON shifts;
CREATE POLICY "Est_shifts" ON shifts FOR ALL USING (establishment_id = get_user_establishment());

DROP POLICY IF EXISTS "Est_compensatory_days" ON compensatory_days;
CREATE POLICY "Est_compensatory_days" ON compensatory_days FOR ALL USING (establishment_id = get_user_establishment());

ALTER TABLE shifts ALTER COLUMN establishment_id SET NOT NULL;
ALTER TABLE compensatory_days ALTER COLUMN establishment_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_shifts_establishment ON shifts(establishment_id);
CREATE INDEX IF NOT EXISTS idx_compensatory_days_establishment ON compensatory_days(establishment_id);
```

- [ ] **Step 3: Pausar e pedir para o usuário aplicar**

Colar no SQL Editor, confirmar sucesso. Se o `SET NOT NULL` falhar, é sinal de que o Step 1 desta task não foi respeitado — voltar e investigar quais linhas ainda estão NULL antes de tentar de novo.

- [ ] **Step 4: Verificar**

Confirmar, logado como um usuário ESTABELECIMENTO (via app real, não service role), que os relatórios "Folha por Servidor" e a tela de Folgas continuam mostrando os dados esperados da própria unidade (smoke test manual — não há como simular RLS de outro papel só com a service role key, que sempre bypassa RLS).

- [ ] **Step 5: Commit**

```bash
git add database/20_transferencia_servidor_rls.sql
git commit -m "feat: RLS de shifts/compensatory_days usa establishment_id fixo (nao mais lotacao atual)"
```

---

### Task 8: Verificação de ponta a ponta (cenário real de transferência)

**Files:** nenhum arquivo novo — só execução manual guiada, conforme seção 7 da spec.

- [ ] **Step 1: Preparar cenário**

Em ambiente de teste/staging (ou produção fora do horário de uso, com aviso ao usuário — decisão dele), montar uma planilha de importação simulando: mesmo servidor (mesma matrícula), ciclo N no estabelecimento A, ciclo N+1 no estabelecimento B.

- [ ] **Step 2: Importar ciclo N (estabelecimento A)**

Rodar a importação normalmente. Confirmar no resultado: 1 "Servidor Novo", 0 "Transferidos".

- [ ] **Step 3: Importar ciclo N+1 (estabelecimento B, mesma matrícula)**

Rodar a importação. Confirmar no resultado: 0 "Servidores Novos", 1 "Transferidos", com a linha de detalhe mostrando "Nome (matrícula X): Estabelecimento A → Estabelecimento B".

- [ ] **Step 4: Conferir via script de leitura (service role key)**

```bash
node -e "
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const env = {};
fs.readFileSync('frontend/.env.local', 'utf-8').split('\n').forEach(l => { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m) env[m[1]] = m[2].trim(); });
const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
(async () => {
  const matricula = 'COLOQUE_A_MATRICULA_DO_TESTE_AQUI';
  const { data: emp } = await supabase.from('employees').select('id, establishment_id, saldo_minutos').eq('matricula', matricula);
  console.log('employees (deve ser 1 registro só, establishment_id = B):', emp);
  const { data: shifts } = await supabase.from('shifts').select('cycle_id, establishment_id, quantidade_plantoes').eq('employee_id', emp[0].id);
  console.log('shifts (um por ciclo, cada um com o establishment_id de onde aconteceu):', shifts);
})();
"
```

Expected:
- Um único registro em `employees` (não dois) — `establishment_id` = B, `saldo_minutos` preservado/acumulado corretamente.
- `shifts` do ciclo N com `establishment_id` = A; `shifts` do ciclo N+1 com `establishment_id` = B.

- [ ] **Step 5: Conferir relatórios**

No relatório "Folha por Servidor" (admin e estabelecimento), filtrando ciclo N + estabelecimento A: servidor aparece. Filtrando ciclo N + estabelecimento B: servidor **não** aparece. Filtrando ciclo N+1 + estabelecimento B: servidor aparece. Filtrando ciclo N+1 + estabelecimento A: servidor **não** aparece.

- [ ] **Step 6: Limpar dados de teste**

Se o teste rodou em produção, apagar a planilha de teste e os registros criados (via SQL Editor, ou re-import com `forceOverwrite`), com confirmação do usuário antes de deletar qualquer coisa.

---

## Self-Review

**Cobertura da spec:** seção 2 (regra automática/no-meio-do-ciclo) → reforçada pelos Global Constraints e pelo trigger `check_cycle_status()` já existente, nada a implementar. Seção 3.1 (custódia atual) → Task 3. Seção 3.2 (histórico fixo + trigger) → Tasks 1, 2. Seção 3.3 (RLS) → Task 7. Seção 3.4 (relatórios) → Tasks 4, 5. Seção 4 (ordem de rollout) → ordem das Tasks 1→7 segue exatamente essa ordem, com gates explícitos. Seção 6 (auditoria) → já rodada antes deste plano (0 duplicatas). Seção 7 (verificação manual) → Task 8.

**Placeholders:** nenhum — todo bloco de código é o diff real a aplicar. Única exceção documentada: `COLOQUE_A_MATRICULA_DO_TESTE_AQUI` na Task 8/Step 4, que é necessariamente escolhida em tempo de execução (depende dos dados de teste montados no Step 1).

**Consistência de tipos:** `ImportResult.transferidos`/`transferenciasDetalhe` (Task 3) usados de forma consistente entre a lógica (Step 2-4) e o render (Step 5). `establishment_id` em `shifts`/`compensatory_days` (Task 1) tem o mesmo tipo (UUID, FK para `establishments`) consumido igual nas Tasks 2, 4, 5, 7.

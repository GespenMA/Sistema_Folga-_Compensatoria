# Design: Transferência de servidor entre estabelecimentos penais

**Status:** aprovado para implementação futura — NÃO IMPLEMENTADO ainda.
**Data:** 2026-08-07
**Contexto:** Compensa+ (SEAP-MA)

## 1. Problema

Hoje a identidade de um servidor no banco é o par `UNIQUE(establishment_id, matricula)` ([database/00_init_schema.sql:106](../../../database/00_init_schema.sql#L106)). Quando um servidor é transferido de uma unidade para outra (ex: João sai da unidade A em julho/2026 e aparece na planilha de agosto/2026 lotado na unidade B), a importação mensal ([Configuracoes.tsx:591-650](../../../frontend/src/pages/admin/Configuracoes.tsx#L591-L650)) não reconhece que é a mesma pessoa:

- A busca do servidor existente é `.eq('establishment_id', estId).eq('matricula', row.matricula)` — como `estId` agora é B e o registro antigo tem `establishment_id = A`, a busca não encontra nada.
- O `upsert` com `onConflict: 'establishment_id,matricula'` cria um **novo registro** (novo UUID) em B, com `saldo_minutos` zerado.
- O registro antigo em A fica órfão, congelado, nunca desativado — João vira duas pessoas no sistema.
- Isso foi confirmado por análise de código em 2026-08-07 (ver memória `gaps_logica_ciclos` e a conversa que originou este documento).

## 2. Regra de negócio definida (com o usuário)

Cenário de referência: João está em A no ciclo de julho/2026. É transferido para B; a partir da carga de agosto/2026 aparece lotado em B.

1. **Matrícula é identificador único e global do servidor na SEAP** (confirmado pelo usuário — não se repete entre unidades, não é escopada por estabelecimento).
2. **A detecção da transferência é 100% automática**, feita durante a importação mensal — não haverá tela manual de "Transferir Servidor".
3. **O saldo de horas acumuladas (`saldo_minutos`) e a responsabilidade atual seguem o servidor.** Ao ser transferido, B herda o saldo residual acumulado até então e passa a ser responsável pelos lançamentos e decisões dali em diante.
4. **O histórico de onde cada plantão/folga aconteceu fica fixo na unidade de origem.** Os plantões trabalhados e as folgas geradas em julho continuam sendo de A para sempre, mesmo depois da transferência — tanto para fins de auditoria quanto porque isso alimenta relatórios usados na prestação de contas.
5. **A responsabilidade financeira por indenizar/pagar uma folga é de quem aprova a solicitação no momento em que ela é feita** — isso já funciona corretamente hoje (ver seção 3.3) e não muda.

## 3. Modelo técnico — 3 camadas de responsabilidade

| Camada | Campo | Comportamento | Precisa mudar? |
|---|---|---|---|
| **Custódia atual** | `employees.establishment_id` + `employees.saldo_minutos` | Móvel — sempre reflete a unidade e o saldo atuais do servidor | Sim — ver 3.1 |
| **Histórico de onde aconteceu** | `shifts.establishment_id` (nova), `compensatory_days.establishment_id` (nova) | Fixo — gravado no momento em que o plantão/folga é gerado, nunca muda depois | Sim — ver 3.2 |
| **Responsabilidade financeira** | `purchase_requests.establishment_id` (já existe) | Já é gravado no momento da solicitação e nunca muda. Quem aprova/paga assume o custo no orçamento daquele ciclo | Não — já correto |

### 3.1 Identidade do servidor (custódia atual)

**Schema:**
```sql
-- Confirmar o nome exato da constraint em produção antes de aplicar
-- (via information_schema.table_constraints), o nome abaixo é o padrão
-- que o Postgres geraria para a UNIQUE inline original.
ALTER TABLE employees DROP CONSTRAINT employees_establishment_id_matricula_key;
ALTER TABLE employees ADD CONSTRAINT employees_matricula_key UNIQUE (matricula);
```
Migração aditiva/autoprotegida: se já existir alguma matrícula duplicada entre estabelecimentos hoje, o `ADD CONSTRAINT` falha explicitamente, sem apagar nada. Antes de aplicar, rodar a query de auditoria (seção 6) para checar.

**Importação (`Configuracoes.tsx`):**
```js
// Busca por matrícula globalmente, não mais por (establishment_id, matricula)
const { data: existingEmp } = await supabase
  .from('employees')
  .select('id, saldo_minutos, establishment_id')
  .eq('matricula', row.matricula)
  .maybeSingle();

const isTransfer = existingEmp && existingEmp.establishment_id !== estId;
const saldoMinutosBase = existingEmp?.saldo_minutos ?? 0; // preservado mesmo em transferência

// ... cálculo de plantoesTotal / novoSaldoMinutos como hoje ...

if (existingEmp) {
  // UPDATE explícito — cobre atualização normal E transferência
  await supabase.from('employees').update({
    establishment_id: estId,
    nome: row.nome,
    position_id: posId,
    data_admissao: row.dataAdmissao,
    saldo_minutos: novoSaldoMinutos,
  }).eq('id', existingEmp.id);
} else {
  await supabase.from('employees').insert({ /* servidor novo */ });
}
```
O `id` do servidor nunca muda numa transferência — `shifts`, `compensatory_days` e `purchase_requests` continuam apontando para o mesmo `employee_id` sem nenhum ajuste adicional.

**Feedback ao usuário:** adicionar contador `transferidos` no resultado da importação (`ImportResult`), distinto de `importados`/`atualizados`, listando nome + unidade de origem/destino.

### 3.2 Histórico fixo por unidade (descoberta importante)

Quem gera `compensatory_days` hoje **não é o frontend, é um trigger de banco**: `trg_recalculate_shift_balance` ([database/04_saldo_plantoes.sql:16-91](../../../database/04_saldo_plantoes.sql#L16-L91)), disparado `AFTER INSERT OR UPDATE OR DELETE ON shifts`. Ele soma o total histórico de plantões do servidor (todas as unidades, todos os ciclos) e gera uma folga a cada 21, copiando `cycle_id`/`periodo_inicio`/`periodo_fim` do shift mais recente. Isso significa que a coluna nova de `establishment_id` em `compensatory_days` também precisa ser preenchida **dentro desse trigger**, não só no código do frontend.

**Mudanças:**
1. `ALTER TABLE shifts ADD COLUMN establishment_id UUID REFERENCES establishments(id);`
2. `ALTER TABLE compensatory_days ADD COLUMN establishment_id UUID REFERENCES establishments(id);`
3. Backfill de ambas a partir do `employees.establishment_id` atual (única fonte disponível para linhas já existentes — aceitável dado que o sistema está em produção há poucos dias).
4. Import (`Configuracoes.tsx`): o `insert` em `shifts` passa a gravar `establishment_id: estId`.
5. Trigger `trg_recalculate_shift_balance`: no `SELECT cycle_id, periodo_inicio, periodo_fim, created_by ... FROM shifts WHERE employee_id = v_emp_id ORDER BY created_at DESC LIMIT 1`, incluir também `establishment_id`, e propagá-lo no `INSERT INTO compensatory_days (...)`.

### 3.3 RLS — ponto crítico, fácil de esquecer

As políticas atuais de `ESTABELECIMENTO` em `shifts`/`compensatory_days` filtram pela unidade **atual** do servidor, não pela unidade onde o registro foi gerado:
```sql
-- database/01_rls_functions_triggers.sql:68-69
CREATE POLICY "Est_shifts" ON shifts FOR ALL USING (employee_id IN (SELECT id FROM employees WHERE establishment_id = get_user_establishment()));
CREATE POLICY "Est_compensatory_days" ON compensatory_days FOR ALL USING (employee_id IN (SELECT id FROM employees WHERE establishment_id = get_user_establishment()));
```
Só adicionar a coluna nova **não basta** — se essa policy não mudar, a unidade A fica com o dado corretamente marcado como dela, mas **sem permissão de lê-lo**, porque o RLS ainda decide pela unidade atual do servidor (que já é B). É preciso trocar para usar a coluna direta nova:
```sql
CREATE POLICY "Est_shifts" ON shifts FOR ALL USING (establishment_id = get_user_establishment());
CREATE POLICY "Est_compensatory_days" ON compensatory_days FOR ALL USING (establishment_id = get_user_establishment());
```

### 3.4 Relatórios

Os pontos que hoje filtram via `employees.establishment_id` (unidade atual) e precisam trocar para a coluna direta nova:
- [admin/Relatorios.tsx:295-325](../../../frontend/src/pages/admin/Relatorios.tsx#L295-L325) — aba "Folha por Servidor", query de `shifts` com `.eq('employees.establishment_id', selectedEst)` e o filtro em memória `emp.establishment_id !== selectedEst`.
- Verificar também `estabelecimento/Relatorios.tsx` e `estabelecimento/Dashboard.tsx`/`Folgas.tsx` por padrões equivalentes antes de implementar (não auditados em detalhe neste design).

`purchase_requests` (Rel 1 "Orçado vs Gasto" e Rel 2 "Detalhamento por Estabelecimento") já usa `establishment_id` próprio — não muda.

## 4. Ordem de rollout (para não quebrar produção)

A ordem importa por dois motivos: (a) o `upsert` atual usa `onConflict: 'establishment_id,matricula'`, que depende da constraint composta existir; (b) se o RLS mudar antes das colunas novas estarem preenchidas, ninguém enxerga os próprios dados.

1. `ALTER TABLE` — adicionar as colunas novas (nullable, sem constraint) em `shifts` e `compensatory_days`.
2. Backfill das colunas novas a partir de `employees.establishment_id` atual.
3. Atualizar o trigger `trg_recalculate_shift_balance` para propagar `establishment_id`.
4. Deploy do novo `Configuracoes.tsx` (identidade por matrícula global + grava `establishment_id` no insert de `shifts`). Este deploy tem que vir **antes** da migração de constraint do passo 6, porque o código velho depende dela.
5. Deploy das mudanças em `Relatorios.tsx` (admin e estabelecimento) para ler as colunas novas.
6. Migração `employees`: trocar `UNIQUE(establishment_id, matricula)` por `UNIQUE(matricula)`.
7. Só depois de confirmar que não há mais linhas sendo criadas sem `establishment_id`: atualizar as policies RLS (`Est_shifts`, `Est_compensatory_days`) para usar a coluna direta. Opcionalmente, tornar as colunas `NOT NULL` e indexá-las nesse momento.

## 5. Fora de escopo

- Migração/merge de duplicatas de servidor que já possam existir hoje na base de produção (sistema no ar há ~10 dias, risco considerado baixo, mas não verificado). Ver query de auditoria abaixo.
- Tela manual de "Transferir Servidor" — a detecção é só automática, via importação mensal.
- Qualquer mudança em `purchase_requests` — já está correto.

## 6. Query de auditoria (rodar antes da migração de constraint)

```sql
SELECT matricula, COUNT(DISTINCT establishment_id) AS qtd_estabelecimentos, COUNT(*) AS qtd_registros,
       array_agg(DISTINCT e.nome) AS estabelecimentos
FROM employees emp
JOIN establishments e ON e.id = emp.establishment_id
GROUP BY matricula
HAVING COUNT(DISTINCT establishment_id) > 1
ORDER BY matricula;
```
Deve rodar no SQL Editor do projeto Supabase **correto** do Compensa+ (o MCP do Supabase conectado nesta sessão de trabalho aponta para outro projeto — um sistema de rondas/patrulhamento — e não tem as tabelas deste sistema).

## 7. Verificação

Não há suíte de testes automatizados no projeto. Verificação manual sugerida: montar uma planilha de teste simulando uma transferência (mesma matrícula, estabelecimento diferente do mês anterior) em ambiente local/staging e conferir:
- `saldo_minutos` preservado no novo estabelecimento.
- Nenhum registro novo criado em `employees` (mesmo `id`).
- `shifts`/`compensatory_days` de antes da transferência continuam com `establishment_id` da unidade antiga e visíveis nos relatórios dela.
- `shifts`/`compensatory_days` gerados após a transferência têm `establishment_id` da unidade nova.

# Design: Nova aba de relatório — Folgas Usufruídas

**Status:** aprovado para implementação.
**Data:** 2026-08-12
**Contexto:** Compensa+ (SEAP-MA)

## 1. Problema

A tela de Relatórios hoje cobre orçamento (Rel 1), solicitações de compra/indenização de folga e plantão plus (Rel 2 "Detalhamento por Estabelecimento") e um resumo agregado por servidor (Rel 3 "Folha por Servidor"). Nenhuma delas mostra as folgas que o servidor efetivamente **usufruiu** (gozou o dia de descanso, em vez de vender/indenizar). Esse evento já é registrado no sistema — `compensatory_days.status = 'USUFRUIDA'`, com `used_at` (data do gozo) e `usage_registered_by` (quem confirmou) — via [estabelecimento/Solicitacoes.tsx:341-364](../../../frontend/src/pages/estabelecimento/Solicitacoes.tsx#L341-L364) — mas não existe nenhum relatório que liste isso.

## 2. Requisito definido com o usuário

Uma nova seção/aba de relatório, ao lado das já existentes, mostrando **uma linha por folga usufruída**, com: data em que a folga foi usufruída, referência do ciclo, nome do servidor, matrícula e lotação (estabelecimento).

Confirmado com o usuário:
- Entra nas duas telas de Relatórios: admin ([admin/Relatorios.tsx](../../../frontend/src/pages/admin/Relatorios.tsx), vê todas as unidades) e estabelecimento ([estabelecimento/Relatorios.tsx](../../../frontend/src/pages/estabelecimento/Relatorios.tsx), vê só a própria unidade) — mesmo padrão das features anteriores desta sessão.
- É uma aba nova, não uma coluna a mais em "Folha por Servidor" — estruturalmente é uma listagem detalhada (1 linha por evento), como "Detalhamento por Estabelecimento", não uma agregação por servidor.
- O filtro de ciclo usa `compensatory_days.cycle_id` (o ciclo em que a folga foi **gerada** — mesmo critério já usado em "Folha por Servidor" e "Detalhamento por Estabelecimento"), não o período em que foi usufruída. Isso é consciente: uma folga gerada num ciclo pode só ser usufruída (e registrada) num ciclo posterior; o relatório continua agrupado pelo ciclo de origem para ficar consistente com as outras abas.

## 3. Modelo técnico

### 3.1 Fonte de dados

`compensatory_days` filtrado por `status = 'USUFRUIDA'` e `cycle_id = <ciclo selecionado>`. `establishment_id` (coluna fixa adicionada nesta mesma sessão, na feature de transferência de servidor — [database/17_transferencia_servidor_colunas.sql](../../../database/17_transferencia_servidor_colunas.sql)) já resolve corretamente a lotação mesmo que o servidor tenha sido transferido depois — não precisa de nenhuma lógica nova para isso.

### 3.2 Colunas

| Coluna | Origem |
|---|---|
| Estabelecimento Penal | `compensatory_days.establishment_id` → `establishments.nome` |
| Servidor | `employees.nome` |
| Matrícula | `employees.matricula` |
| Cargo | `employees.position_id` → `positions.codigo`/`nome` |
| Ciclo | `compensatory_days.cycle_id` → `cycles.nome` |
| Data de Usufruto | `compensatory_days.used_at` |
| Registrado por | `compensatory_days.usage_registered_by` → `profiles.nome` |

`compensatory_days` não guarda um "retrato" do cargo no momento do usufruto (diferente de `purchase_requests`, que grava `position_id` na hora da solicitação). Por isso "Cargo" aqui reflete o cargo **atual** do servidor, não necessariamente o cargo que ele tinha quando gerou/usufruiu a folga — mesmo comportamento que "Folha por Servidor" já tem hoje (não é uma inconsistência nova).

### 3.3 Filtros, paginação e exportação

Reaproveita a infraestrutura de filtro já existente em cada tela (seletor de ciclo, estabelecimento no admin, cargo, busca por nome/matrícula) e o mesmo padrão de paginação das outras abas. Exportação em CSV/Excel e PDF, seguindo exatamente o padrão das abas irmãs (`exportXLSX`/`exportExcel` e `exportPDF` já existentes em cada arquivo).

### 3.4 RLS

Nenhuma mudança necessária — `compensatory_days` já tem RLS correto (`Est_compensatory_days` filtra por `establishment_id` direto, ajustado na mesma sessão da feature de transferência). Admin (`is_admin()`) já vê tudo.

## 4. Fora de escopo

- Qualquer alteração no fluxo de registro de usufruto ([estabelecimento/Solicitacoes.tsx](../../../frontend/src/pages/estabelecimento/Solicitacoes.tsx)) — já funciona corretamente, essa spec é só sobre exibir o relatório.
- Filtro por data de usufruto (`used_at`) em vez de ciclo de origem — decidido explicitamente que não é necessário agora.
- Mudanças em "Folha por Servidor" ou "Detalhamento por Estabelecimento" — ficam como estão.

## 5. Verificação sugerida

Sem suíte de testes automatizada no projeto (mesma situação já documentada na spec de transferência de servidor). Verificação manual: registrar o usufruto de uma folga de teste (via `estabelecimento/Solicitacoes.tsx`, aba "Usufruídas"), conferir que ela aparece na nova aba em ambas as telas de relatório, com a data e a lotação corretas, e que some do filtro quando um ciclo diferente é selecionado.

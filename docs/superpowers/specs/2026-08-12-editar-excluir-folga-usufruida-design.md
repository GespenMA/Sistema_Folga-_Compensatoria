# Design: Editar/Excluir folga usufruída (tela Solicitar Compra, estabelecimento)

**Status:** aprovado para implementação.
**Data:** 2026-08-12
**Contexto:** Compensa+ (SEAP-MA)

## 1. Problema

Na tela `estabelecimento/Solicitacoes.tsx` ("Comprar Folgas"), aba "Folgas Usufruídas", o diretor da unidade só consegue ver a lista de folgas já registradas como usufruídas — não há como corrigir um registro feito por engano (data errada, ou servidor errado).

## 2. Requisito definido com o usuário

Adicionar "Editar" e "Excluir" a cada linha da lista de folgas usufruídas nessa tela, com duas condições explícitas do usuário:
1. **Só deve ser possível enquanto o ciclo estiver aberto.**
2. **Excluir precisa preservar o saldo do servidor** — não pode fazer o servidor "perder" o crédito de plantões que gerou aquela folga.

## 3. Modelo técnico

### 3.1 A trava de ciclo já existe em dois níveis — nada novo a implementar

A lista desta aba já é carregada com `.eq('cycle_id', cycleData.id)`, onde `cycleData` é sempre o ciclo com `status IN ('ABERTO', 'REABERTO')` ([estabelecimento/Solicitacoes.tsx:106-145](../../../frontend/src/pages/estabelecimento/Solicitacoes.tsx#L106-L145)). Ou seja: **toda linha exibida nessa aba já pertence ao ciclo atualmente aberto**, por construção da própria query. Não é preciso nenhuma verificação extra de "ciclo aberto?" no frontend.

Como segunda camada de segurança, o trigger `check_cycle_status()` ([database/01_rls_functions_triggers.sql:78-97](../../../database/01_rls_functions_triggers.sql#L78-L97)) já bloqueia qualquer `UPDATE` em `compensatory_days` cujo ciclo esteja `FECHADO` — cobre o caso raro de o ciclo fechar entre o carregamento da tela e o clique do usuário. A mensagem de erro do próprio trigger é amigável o suficiente para mostrar direto ao usuário.

### 3.2 Editar — reaproveita o fluxo "Registrar Gozo" já existente

`openUsufrutoModal(folga)` ([Solicitacoes.tsx:335](../../../frontend/src/pages/estabelecimento/Solicitacoes.tsx#L335)) passa a pré-preencher `dataUsufruto` com `folga.used_at` em vez de sempre abrir vazio. Isso serve para os dois casos com a mesma função: registrar pela primeira vez (uma folga `GERADA` não tem `used_at`, então abre vazio) e editar uma já usufruída (abre com a data atual, pronta para corrigir).

`handleRegistrarUsufruto` ([Solicitacoes.tsx:341](../../../frontend/src/pages/estabelecimento/Solicitacoes.tsx#L341)) já faz um `UPDATE` (não um insert) — reenviar o formulário com uma folga que já está `USUFRUIDA` funciona sem nenhuma mudança na função em si, só atualiza `used_at` (e `usage_registered_by` para quem editou, o que é aceitável — reflete quem confirmou o dado por último).

O título do modal e o texto do botão mudam dinamicamente conforme `selectedFolga.status`: "Registrar Gozo"/"Confirmar Gozo" para uma folga nova, "Editar Gozo"/"Salvar Alteração" para uma já usufruída.

### 3.3 Excluir — reverte para `GERADA`, nunca apaga a linha

Novo handler `handleDesfazerUsufruto(folga)`:
```
UPDATE compensatory_days
SET status = 'GERADA', used_at = NULL, usage_registered_by = NULL
WHERE id = folga.id
```
Confirmação via `window.confirm(...)`, mesmo padrão já usado em outras telas do sistema para ações destrutivas (ex: [admin/Configuracoes.tsx:154](../../../frontend/src/pages/admin/Configuracoes.tsx#L154)).

**Por que isso preserva o saldo automaticamente (a exigência do usuário):** o trigger `trg_recalculate_shift_balance` ([database/04_saldo_plantoes.sql:16-91](../../../database/04_saldo_plantoes.sql#L16-L91)) só é acionado por `INSERT/UPDATE/DELETE` em `shifts` — nunca por mudanças em `compensatory_days`. E o cálculo de quantos "21 plantões" já foram consumidos conta **todas** as linhas de `compensatory_days` do servidor (`SELECT COUNT(*) ... FROM compensatory_days WHERE employee_id = v_emp_id`, sem filtro de status — [database/04_saldo_plantoes.sql:42](../../../database/04_saldo_plantoes.sql#L42)). Isso significa que o saldo já foi descontado no momento em que a folga foi **gerada**, não quando muda de status. Reverter `USUFRUIDA → GERADA` não cria nem apaga nenhuma linha, então o saldo do servidor (`employees.saldo_plantoes`) **nunca é alterado por essa ação** — não precisa de nenhum ajuste manual ou trigger novo.

(Se a decisão tivesse sido apagar a linha de verdade — opção que o usuário rejeitou — aí sim seria necessário lidar com o saldo manualmente, porque o trigger não reage a mudanças em `compensatory_days`.)

### 3.4 UI

Na lista da aba "Folgas Usufruídas" ([Solicitacoes.tsx:1010-1025](../../../frontend/src/pages/estabelecimento/Solicitacoes.tsx#L1010-L1025)), cada linha ganha dois botões pequenos — "Editar" (chama `openUsufrutoModal(f)`) e "Excluir" (chama `handleDesfazerUsufruto(f)`) — ao lado do badge "Usufruída" já existente.

## 4. Fora de escopo

- Qualquer mudança em `saldo_minutos` (não relacionado — é sobre minutos residuais de importação, não sobre folgas).
- Editar/excluir folgas de ciclos fechados — impossível por design (seção 3.1).
- Apagar a linha de `compensatory_days` de verdade — decisão explícita do usuário de não fazer isso.

## 5. Verificação sugerida

Sem suíte de testes automatizada. Verificação manual/script:
1. Registrar o gozo de uma folga de teste, conferir `employees.saldo_plantoes` antes e depois de "Excluir" — deve ser o mesmo valor (confirma a seção 3.3).
2. Editar a data de uma folga usufruída, conferir que `used_at` muda e `status` continua `USUFRUIDA`.
3. Conferir que a folga excluída reaparece em "Folgas Disponíveis para Compra".

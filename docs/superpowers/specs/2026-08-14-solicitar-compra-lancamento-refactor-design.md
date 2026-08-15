# Design: Finalizar o refactor de UI iniciado pelo Kombai (Solicitar Compra + Lançamento de Plantões)

## Contexto

Durante esta sessão, `frontend/src/pages/estabelecimento/Solicitacoes.tsx` e
`frontend/src/pages/estabelecimento/Folgas.tsx` receberam uma quantidade grande de
lógica de negócio nova (bloqueio de orçamento na criação e na aprovação, avisos
estilizados no lugar de `alert()`/`window.confirm()`/`window.prompt()`, filtros de
busca por nome/matrícula/cargo em várias tabelas, limite de justificativa). Cada tela
acabou reimplementando o mesmo padrão de busca+cargo+ordenação+paginação várias vezes
(3× em Solicitacoes.tsx, 2× em Folgas.tsx), e cada uma tem sua própria cópia local de
modal de confirmação / modal de aviso / toast.

Em paralelo, o usuário usou a extensão Kombai para revisar a tela de Solicitar Compra.
O Kombai ficou sem créditos no meio do trabalho, deixando pronto — mas não conectado a
nenhuma tela — um conjunto de peças de UI reutilizáveis e um hook de dados para
Solicitacoes.tsx:

- `frontend/src/components/ui/{Modal,ConfirmDialog,AlertDialog,ToastProvider,Callout,Pagination,SortableTh,TableToolbar,States}.tsx`
- `frontend/src/hooks/useTableControls.ts`
- `frontend/src/pages/estabelecimento/solicitacoes/{types.ts,useSolicitacoesData.ts}`
- `frontend/src/utils/format.ts`
- Ajustes aditivos em `frontend/src/index.css` (tokens de cor + troca dos 6 badges de
  hex fixo para os tokens já existentes — verificado como seguro, sem token novo
  indefinido)

Nada disso está importado em nenhuma tela hoje — o app builda e roda exatamente como
antes. `useSolicitacoesData.ts` já replica corretamente a fórmula de orçamento
corrigida nesta sessão (teto vem sempre do `total_orçado` gravado no banco, nunca de
um recálculo com preço atual), mas não inclui o bloqueio proativo no cliente (a
mensagem "faltam R$X" + sugestão de ação) — isso ficou para quem monta a tela.

Este spec cobre terminar esse refactor: finalizar `useSolicitacoesData` onde faltar,
criar o equivalente para Folgas.tsx, e reescrever as duas telas para usar essas peças —
preservando 100% do comportamento já construído.

## Objetivo

Migrar `Solicitacoes.tsx` e `Folgas.tsx` para a arquitetura hook-de-dados +
componente-de-view + peças de `components/ui/` compartilhadas, sem alterar
comportamento visível para o usuário final (é uma migração de arquitetura, não um
redesenho de UX).

## Fora de escopo

- `admin/Solicitacoes.tsx` e qualquer outra tela do módulo admin — continuam com
  `window.confirm`/`window.prompt`/`alert()` como estão hoje.
- Qualquer mudança de regra de negócio nova além da que já foi construída e aprovada
  nesta sessão.
- Testes automatizados (o projeto não tem suíte hoje; fora de escopo introduzir uma
  como parte deste refactor).

## Arquitetura

**Hook de dados** (`useSolicitacoesData`, `useFolgasData`): dono de todo acesso ao
Supabase da tela — leitura e mutação. Mutações sempre retornam `ActionResult`
(`{ok:true}` ou `{ok:false, message, details?}`), nunca lançam exceção nem chamam
`alert`. Loading/erro de carregamento inicial ficam expostos como estado
(`loading`, `error`) para a tela renderizar `LoadingState`/`ErrorState`.

**Componente de página**: só renderiza o que o hook expõe e encaminha intenção do
usuário para as funções do hook. Decide QUANDO bloquear uma ação (ex: comparar
`budget.disponivelParaLancamento` contra o valor do formulário antes de habilitar o
botão de submit) — a regra em si (o número certo pra comparar) vem do hook.

**`components/ui/` compartilhado**: Modal (acessível — foco preso, ESC, portal),
ConfirmDialog (substitui `window.confirm`/`window.prompt`), AlertDialog (substitui
`alert()`, aceita lista de `details` para falhas em lote), ToastProvider/`useToast()`
(substitui os toasts locais), Callout (mensagem inline única para info/aviso/erro/
sucesso — é a peça que vai carregar o "faltam R$X + sugestão de ação"), Pagination,
SortableTh, TableToolbar (busca + select de cargo), States (Loading/Empty/Error).

**`useTableControls`**: busca + filtro de cargo + ordenação + paginação sobre uma
lista — substitui as 5 cópias manuais atuais (3 em Solicitacoes, 2 em Folgas).

## Escopo de montagem do ToastProvider

`ToastProvider` usa Context do React — precisa envolver a árvore uma vez, acima de
onde `useToast()` é chamado. Ele entra em
`frontend/src/layouts/EstabelecimentoLayout.tsx`, envolvendo as rotas
`/estabelecimento/*`. O módulo admin não é tocado.

## Plano de arquivos

**Novo:**
- `frontend/src/pages/estabelecimento/folgas/types.ts`
- `frontend/src/pages/estabelecimento/folgas/useFolgasData.ts` — espelha
  `useSolicitacoesData.ts`: fetch de ciclo ativo + funcionários + orçamento
  (aprovado/pendente, mesma fórmula), mutação `lancarPlantaoPlus` retornando
  `ActionResult`.

**Reescrito (comportamento preservado, arquitetura nova):**
- `frontend/src/pages/estabelecimento/Solicitacoes.tsx`
- `frontend/src/pages/estabelecimento/Folgas.tsx`
- `frontend/src/layouts/EstabelecimentoLayout.tsx` (só adiciona `<ToastProvider>`)

**Ajustado no hook existente do Kombai:**
- `useSolicitacoesData.ts` ganha o que falta: nada de lógica de bloqueio (isso é da
  view), mas os tipos/retornos já cobrem tudo que as duas telas precisam — validado
  função por função durante a implementação.

**Não tocado:** todo o resto do módulo admin, banco de dados (as migrations 21/22/23
já cobrem a parte de banco desta sessão e não fazem parte deste refactor).

## Comportamento que precisa sobreviver 1:1

Checklist explícito — cada item vira um caso de verificação manual no plano de
implementação:

1. Bloqueio de orçamento ao **lançar** (Plantão Plus e Comprar Folga, individual e em
   lote): usa `disponivelParaLancamento` (orçado − aprovado − pendente), desabilita o
   botão de submit, mostra "🚫 Orçamento insuficiente — faltam R$X" + sugestão de ação
   ("Aprove ou rejeite pendências...").
2. Bloqueio de orçamento ao **aprovar** (individual e em lote): usa
   `disponivelParaAprovacao` (orçado − aprovado). Lote pré-soma o total selecionado e
   bloqueia tudo de uma vez antes de gravar qualquer um.
3. Justificativa: 50–1000 caracteres, contador visível, cor de alerta abaixo do
   mínimo.
4. Busca por nome/matrícula + filtro de cargo nas 3 tabelas de Solicitacoes.tsx
   (Folgas Disponíveis, Solicitações do Ciclo, Folgas Usufruídas) e na lista de
   Folgas.tsx.
5. Aviso "Atenção aos Pagamentos", aba "Folgas Usufruídas" com contagem, editar/
   excluir registro de gozo, cancelar solicitação, aprovar/rejeitar com motivo
   obrigatório.
6. Duplicidade de data por servidor (verificação antes de criar) continua sendo
   checada antes de cada gravação.
7. `valor_historico_id` e `position_id` continuam sendo enviados corretamente em toda
   criação de `purchase_requests` (é o que a migration 21 valida no banco — qualquer
   regressão aqui vira erro no lançamento, não silenciosa).

## Verificação

Sem suíte automatizada neste projeto — mesma disciplina usada a sessão inteira:
`npm run build` a cada etapa relevante, `detect_changes()` do GitNexus antes de cada
commit, teste manual no navegador (dev server já ativo) cobrindo os 7 itens da lista
acima nas duas telas.

Dado o tamanho da mudança (~2300 linhas somadas nas duas telas, uma delas — Solicitar
Compra — em uso operacional real), a implementação será faseada com checkpoints
revisáveis (mesmo padrão usado no plano de transferência de servidor desta sessão),
não uma reescrita de um golpe só. A ordem exata das fases fica para o plano de
implementação, não para este spec.

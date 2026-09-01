# Design: Elegibilidade de escala para modalidade de compra de plantão

**Status:** aprovado para implementação futura — NÃO IMPLEMENTADO ainda.
**Data:** 2026-09-01
**Contexto:** Compensa+ (SEAP-MA)

## 1. Problema

A planilha de importação mensal (`Base_Geral`) traz uma coluna **"Horário"** (coluna F, índice `r[5]`) com o regime de trabalho de cada servidor — valores como `"24 H X 72H"`, `"12HX36H - NOTURNO"`, `"12HX36H - NOTURNO 2"`, `"12HX36H - DIURNO"`, `"08H AS 17H 1H ALMOÇO"`, `"04 D X 10 H - 3 DIAS DE FOLGA - 1"`, `"24 H X 72H - 002"`. Hoje essa coluna é **completamente ignorada** pelo import — [Configuracoes.tsx:484-521](../../../frontend/src/pages/admin/Configuracoes.tsx#L484-L521) mapeia `r[0]`(matrícula)/`r[1]`(nome)/`r[2]`(cargo)/`r[3]`(admissão)/`r[4]`(estabelecimento)/`r[6]`(trabalhadas), pulando `r[5]`.

Não existe, em nenhuma tabela do banco ([database/00_init_schema.sql](../../../database/00_init_schema.sql)), nenhum conceito de "escala"/regime de trabalho — `positions` é cargo/função, uma entidade diferente.

Hoje **todo servidor acumula plantões da mesma forma**, independente do regime: cada plantão importado soma em `shifts`, o trigger `trg_recalculate_shift_balance` ([database/04_saldo_plantoes.sql:16-91](../../../database/04_saldo_plantoes.sql#L16-L91)) acumula em `employees.saldo_plantoes` e gera `compensatory_days` a cada 21 plantões, e essas folgas podem ser compradas (`purchase_requests.tipo_solicitacao = 'FOLGA_COMPENSATORIA'`) ou usufruídas (`handleRegistrarUsufruto`, [Solicitacoes.tsx:408](../../../frontend/src/pages/estabelecimento/Solicitacoes.tsx#L408)). Em paralelo, qualquer servidor também pode ter um Plantão Plus lançado diretamente (`tipo_solicitacao = 'PLANTAO_PLUS'`, via `handleSavePlus`, [Folgas.tsx:334](../../../frontend/src/pages/estabelecimento/Folgas.tsx#L334)).

Na prática, servidores em certos regimes (ex.: expediente administrativo 08h-17h) não deveriam acumular carga horária compensatória — só devem ter acesso ao Plantão Plus. Hoje o sistema não distingue isso: todo mundo acumula.

## 2. Regra de negócio definida (com o usuário)

1. **A elegibilidade é por escala (regime de trabalho), definida globalmente pelo admin geral** — não por servidor individual, não por estabelecimento. Toda escala nasce com um único interruptor: "permite carga horária (acúmulo + compra de folga + gozo)".
2. **Escala habilitada** → servidor tem as duas modalidades: acumula carga horária normalmente (gera `compensatory_days`, pode comprar a folga ou usufruir/gozar) **e** pode ter Plantão Plus lançado.
3. **Escala não habilitada (só-Plus)** → servidor **não acumula carga horária de forma alguma** (confirmado explicitamente: não é "calcular escondido para o caso de habilitar depois" — é não contar nada enquanto estiver desabilitada) e **não deve nem ver a carga horária acumulada na tela**. Só pode ter Plantão Plus lançado.
4. **Variações de texto da coluna "Horário" que são a mesma escala** (confirmado: sufixos como `"- 002"`, `"NOTURNO 2"` identificam turma/grupo, não um regime diferente) devem ser agrupadas automaticamente sob uma única escala canônica — o admin não deve precisar marcar cada variação separadamente.
5. **Rollout não-destrutivo:** todas as escalas que já existem na base atual (as da última planilha importada) nascem **habilitadas para as duas modalidades** no dia em que a feature entra no ar. Nada muda no comportamento de ninguém até o admin geral desabilitar manualmente as escalas que ele decidir restringir. Escalas novas, descobertas em importações futuras, seguem a mesma regra — nascem habilitadas por padrão.
6. **Não retroativo:** se uma escala for desabilitada e depois reabilitada, os plantões importados enquanto ela estava desabilitada não são recontados automaticamente. O acúmulo simplesmente recomeça a valer para plantões importados dali em diante.

## 3. Modelo técnico

### 3.1 Schema novo

```sql
CREATE TABLE schedule_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(255) NOT NULL UNIQUE,               -- nome canônico, ex: "24 H X 72H"
    permite_carga_horaria BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE schedule_type_aliases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    texto_bruto VARCHAR(255) NOT NULL UNIQUE,        -- valor exato da coluna "Horário" na planilha
    schedule_type_id UUID NOT NULL REFERENCES schedule_types(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE employees ADD COLUMN schedule_type_id UUID REFERENCES schedule_types(id);
-- nullable: servidor sem "Horário" preenchido na planilha fica sem escala definida
```

`employees.schedule_type_id` é ressincronizado a cada import, no mesmo padrão que `position_id`/`establishment_id` já seguem hoje.

### 3.2 Normalização de texto bruto → escala canônica

Regra aplicada no frontend, no momento do import, antes de resolver a escala de cada linha:

```js
function normalizarEscala(textoBruto) {
  return textoBruto
    .trim()
    .replace(/\s*-\s*\d+\s*$/, '')   // remove sufixo "- NNN" no final (turma/grupo)
    .replace(/\s+\d+\s*$/, '')       // remove número solto no final (ex: "NOTURNO 2" -> "NOTURNO")
    .trim();
}
```

Verificado contra os valores reais da planilha mostrados pelo usuário:

| Texto bruto | Normalizado |
|---|---|
| `24 H X 72H` | `24 H X 72H` |
| `24 H X 72H - 002` | `24 H X 72H` |
| `12HX36H - NOTURNO` | `12HX36H - NOTURNO` |
| `12HX36H - NOTURNO 2` | `12HX36H - NOTURNO` |
| `12HX36H - DIURNO` | `12HX36H - DIURNO` |
| `08H AS 17H 1H ALMOÇO` | `08H AS 17H 1H ALMOÇO` (inalterado — dígito não está no final) |
| `04 D X 10 H - 3 DIAS DE FOLGA - 1` | `04 D X 10 H - 3 DIAS DE FOLGA` |

A regra é heurística — por isso a tabela `schedule_type_aliases` guarda o mapeamento **por texto bruto individual**, não recalcula a normalização toda vez. Se a regra errar algum caso, o admin corrige manualmente na tela de mapeamento (3.7) reatribuindo aquele alias para outra `schedule_type` — sem precisar mexer em código.

### 3.3 Import (`Configuracoes.tsx`)

Em `handleFileChange` ([Configuracoes.tsx:467-527](../../../frontend/src/pages/admin/Configuracoes.tsx#L467-L527)): ler `r[5]`, adicionar `escalaTexto: String(r[5] || '').trim()` ao `PreviewRow`. Preview ganha coluna "Escala" mostrando o nome canônico resolvido, com uma marca "🆕 nova" quando `texto_bruto` não existir ainda em `schedule_type_aliases`.

Em `handleConfirmImport` ([Configuracoes.tsx:529+](../../../frontend/src/pages/admin/Configuracoes.tsx#L529)), no mesmo bloco que já resolve `estId`/`posId` por linha:
1. Buscar `schedule_type_aliases` por `texto_bruto = row.escalaTexto` (case-sensitive, valor exato).
2. Se não achar: aplicar `normalizarEscala()`, buscar `schedule_types` por nome (comparação normalizada tipo `normalizeStr`, já usado para estabelecimento/cargo); se não existir, criar com `permite_carga_horaria = true`; criar o alias `texto_bruto → schedule_type_id`.
3. Se `row.escalaTexto` vazio: `schedule_type_id = null` para o servidor, sem erro bloqueante — só um aviso no preview (mesmo padrão de "Matrícula vazia" etc., [Configuracoes.tsx:505-509](../../../frontend/src/pages/admin/Configuracoes.tsx#L505-L509)).
4. Gravar `schedule_type_id` no `insert`/`update` de `employees`.

**Resumo pós-importação:** o resultado da importação (mesmo componente que já mostra `importados`/`atualizados`/`transferidos`) ganha um contador `escalasNovas` — quantas linhas de `schedule_type_aliases` foram criadas nessa importação (ou seja, quantos textos brutos da coluna "Horário" nunca tinham sido vistos antes). Isso dá ao admin um número pra conferir de cabeça contra o que ele sabe que existe na prática: se ele espera ~15 regimes reais e o resumo mostra 42 escalas novas criadas de uma vez, é sinal de que a normalização (3.2) não agrupou direito e vale revisar o mapa de variações (3.7) antes de desabilitar qualquer escala. Em importações seguintes, o número tende a cair perto de zero (a maioria dos textos já vira alias reconhecido).

### 3.4 Trigger de saldo (`trg_recalculate_shift_balance`)

Gate no início da função, antes de qualquer cálculo:

```sql
DECLARE
    v_permite_carga_horaria BOOLEAN;
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
        RETURN NULL; -- escala só-Plus: este shift não altera saldo_plantoes nem gera
                      -- compensatory_days. Saldo anterior (se houver, de antes da escala
                      -- ser desabilitada) fica congelado, não é zerado nem recalculado.
    END IF;

    -- ... resto da função exatamente como hoje ...
```

`COALESCE(..., TRUE)` cobre `schedule_type_id IS NULL` (servidor sem escala definida) — comportamento atual preservado, consistente com a regra 5.

Importante: este gate só é reavaliado quando um `shift` é inserido/atualizado/deletado (é o evento que dispara o trigger). Mudar `employees.schedule_type_id` num import, ou desligar/ligar `schedule_types.permite_carga_horaria`, **não** recalcula automaticamente os `shifts` já existentes — é exatamente o comportamento "não retroativo" da regra 6, sem precisar de nenhum mecanismo extra.

### 3.5 Lançamento de Plantões (`Folgas.tsx`)

Servidor com escala só-Plus (`employee.schedule_types?.permite_carga_horaria === false`):
- Esconder o bloco de saldo acumulado nos cards e no modal — pontos: [Folgas.tsx:425](../../../frontend/src/pages/estabelecimento/Folgas.tsx#L425), [:761](../../../frontend/src/pages/estabelecimento/Folgas.tsx#L761), [:1089-1095](../../../frontend/src/pages/estabelecimento/Folgas.tsx#L1089-L1095).
- Aba "Plantões" do modal de detalhe ([:1113](../../../frontend/src/pages/estabelecimento/Folgas.tsx#L1113), conteúdo em [:1255+](../../../frontend/src/pages/estabelecimento/Folgas.tsx#L1255)) substituída por uma nota simples: "Este servidor está em escala só-Plantão Plus — não acumula carga horária compensatória."
- A aba "Plantão Plus" ([:1368+](../../../frontend/src/pages/estabelecimento/Folgas.tsx#L1368)) e o botão "⚡ Lançar Plus" ([:796-807](../../../frontend/src/pages/estabelecimento/Folgas.tsx#L796-L807), header em [:537](../../../frontend/src/pages/estabelecimento/Folgas.tsx#L537)) continuam disponíveis normalmente para todo mundo.

### 3.6 Solicitar Compra (`Solicitacoes.tsx`)

A query que popula `folgasDisponiveis` já só retorna `compensatory_days` com status `GERADA` — como o trigger (3.4) para de gerar essas linhas para servidor só-Plus, a lista já fica naturalmente vazia para eles em condições normais. Ainda assim, os dois botões de ação por linha — "Comprar Folga" ([:1133-1135](../../../frontend/src/pages/estabelecimento/Solicitacoes.tsx#L1133-L1135)) e "Registrar Gozo" ([:1136-1138](../../../frontend/src/pages/estabelecimento/Solicitacoes.tsx#L1136-L1138)) — continuam funcionando normalmente para qualquer `compensatory_days` que já exista (ex.: gerada antes da escala ser desabilitada). Isso é intencional: registros já gerados não são invalidados retroativamente, só a geração de novos para de acontecer (regra 6).

Nenhuma mudança é necessária no fluxo de Plantão Plus (`handleComprar`/`handleBulkComprarForm` não se aplicam aqui — Plantão Plus usa `handleSavePlus` em Folgas.tsx, 3.5) — continua liberado pra todo mundo, com ou sem escala configurada.

### 3.7 Tela nova: "Escalas de Trabalho" (Configurações, admin geral)

Nova sub-seção dentro de `Configuracoes.tsx`, mesmo padrão da gestão de Cargos já existente:
- **Lista de escalas:** nome canônico, toggle "Habilitada para Carga Horária + Gozo", contagem de servidores ativos nessa escala (`COUNT(*) FROM employees WHERE schedule_type_id = ...`).
- **Mapa de variações:** lista de `schedule_type_aliases` (texto bruto → escala atual), com select para reatribuir um alias a outra escala canônica (cobre os casos em que a normalização automática (3.2) errou).

## 4. Fora de escopo

- Elegibilidade por estabelecimento (a regra é global por escala, confirmado na regra 1).
- Recompute retroativo automático ao religar uma escala (regra 6 — explicitamente não-retroativo).
- Tela de edição manual do `schedule_type_id` de um servidor individual fora do fluxo de import — se necessário, entra depois via a mesma tela do 3.7 ou uma edição direta no cadastro do servidor (não pedido pelo usuário).
- Qualquer mudança em `purchase_requests`/RLS — não há necessidade identificada.

## 5. Verificação

Não há suíte de testes automatizada no projeto. Antes de implementar: rodar `impact()` do GitNexus sobre `trg_recalculate_shift_balance` (função crítica, compartilhada, dispara em todo INSERT/UPDATE/DELETE de `shifts`) e sobre `fetchData`/`fetchOrcamento` em `Solicitacoes.tsx`/`Folgas.tsx` antes de tocar nelas, e reportar o raio de impacto antes de prosseguir, conforme `CLAUDE.md`.

Verificação manual sugerida após implementar:
1. Importar uma planilha de teste com valores variados na coluna "Horário" (incluindo variações tipo "- 002"/"NOTURNO 2") e conferir que o resumo pós-importação (`escalasNovas`) bate com o número esperado de regimes reais distintos, não com o número de textos brutos distintos.
2. Criar uma escala de teste com `permite_carga_horaria = false`, associar um servidor de teste a ela, importar um plantão para ele e confirmar que `saldo_plantoes`/`compensatory_days` não mudam.
3. Confirmar que a carga horária acumulada não aparece na tela de Lançamento de Plantões para esse servidor, mas o Plantão Plus continua lançável.
4. Reabilitar a escala, importar um novo plantão, confirmar que o acúmulo volta a valer só a partir desse plantão novo (não retroativo).
5. Rodar `detect_changes()` antes de commitar, comparando com `main`.

-- =====================================================================================
-- CORREÇÃO: total_orçado (cycle_establishments) ficava desatualizado quando o preço de
-- um cargo mudava em position_values.
--
-- O trigger existente (recalcular_orcamento_unidade, em 10_trigger_calculo_orcamento.sql)
-- só recalcula total_orçado quando alguém mexe em planning_limits (quantidade planejada
-- por cargo). Não existe nenhum trigger em position_values — só um log de auditoria —
-- então uma edição de preço feita direto no banco (como em
-- 16_update_valor_cargo_temporario.sql) não propaga automaticamente, e o total_orçado
-- gravado fica dessincronizado do preço real do cargo até alguém rodar um recálculo manual.
--
-- IMPORTANTE — qual preço usar: o trigger de planning_limits usa o preço vigente na data
-- de início do ciclo (vigencia_inicio <= data_inicio). Só que 16_update_valor_cargo_temporario
-- já rompeu essa regra de propósito pro reajuste de "Agente Penitenciário Temporário": ele
-- forçou TODOS os ciclos abertos a usar o preço mais recente (316.21), mesmo os que
-- começaram antes da vigência desse preço. Verifiquei contra produção: hoje, pra todo
-- estabelecimento real com ciclo aberto, total_orçado gravado já bate exatamente com "usar
-- sempre o preço mais recente do cargo" (sem filtrar por vigência) — foi assim que
-- 16_update_valor_cargo_temporario deixou o sistema. Se este trigger usasse a fórmula por
-- vigência (como planning_limits usa), ele reduziria o orçamento de ~44 estabelecimentos
-- reais na primeira execução, revertendo aquele reajuste. Por isso aqui usamos sempre o
-- preço mais recente, pra manter compatível com o estado atual de produção.
--
-- Só recalcula ciclos em RASCUNHO/ABERTO/REABERTO, pra não alterar histórico de ciclos
-- fechados — mesmo critério já usado em 16_update_valor_cargo_temporario.sql.
-- =====================================================================================

CREATE OR REPLACE FUNCTION recalcular_orcamento_ao_mudar_preco_cargo()
RETURNS TRIGGER AS $$
DECLARE
    v_position_id UUID;
    rec RECORD;
    v_total DECIMAL(10,2);
BEGIN
    v_position_id := COALESCE(NEW.position_id, OLD.position_id);

    FOR rec IN
        SELECT DISTINCT ce.id
        FROM cycle_establishments ce
        JOIN cycles c ON c.id = ce.cycle_id
        JOIN planning_limits pl ON pl.cycle_establishment_id = ce.id
        WHERE pl.position_id = v_position_id
          AND c.status IN ('RASCUNHO', 'ABERTO', 'REABERTO')
    LOOP
        SELECT COALESCE(SUM(
            pl.quantidade_planejada * (
                SELECT pv.valor
                FROM position_values pv
                WHERE pv.position_id = pl.position_id
                ORDER BY pv.vigencia_inicio DESC
                LIMIT 1
            )
        ), 0) INTO v_total
        FROM planning_limits pl
        WHERE pl.cycle_establishment_id = rec.id;

        UPDATE cycle_establishments
        SET total_orcado = v_total
        WHERE id = rec.id;
    END LOOP;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_recalcular_orcamento_preco_cargo ON position_values;

CREATE TRIGGER trg_recalcular_orcamento_preco_cargo
AFTER INSERT OR UPDATE OR DELETE ON position_values
FOR EACH ROW
EXECUTE FUNCTION recalcular_orcamento_ao_mudar_preco_cargo();

-- =====================================================================================
-- BLOCO DE EXECUÇÃO ÚNICA: corrige agora o total_orçado de ciclos abertos que já estão
-- dessincronizados (verificado em produção: só "Unidade Teste" está desatualizado hoje;
-- todo o resto já está em sync graças a 16_update_valor_cargo_temporario.sql — este bloco
-- só reafirma isso, sem impacto nos demais).
-- =====================================================================================
DO $$
DECLARE
    rec RECORD;
    v_total DECIMAL(10,2);
BEGIN
    FOR rec IN
        SELECT ce.id
        FROM cycle_establishments ce
        JOIN cycles c ON c.id = ce.cycle_id
        WHERE c.status IN ('RASCUNHO', 'ABERTO', 'REABERTO')
    LOOP
        SELECT COALESCE(SUM(
            pl.quantidade_planejada * (
                SELECT pv.valor
                FROM position_values pv
                WHERE pv.position_id = pl.position_id
                ORDER BY pv.vigencia_inicio DESC
                LIMIT 1
            )
        ), 0) INTO v_total
        FROM planning_limits pl
        WHERE pl.cycle_establishment_id = rec.id;

        UPDATE cycle_establishments
        SET total_orcado = v_total
        WHERE id = rec.id;
    END LOOP;
END;
$$;

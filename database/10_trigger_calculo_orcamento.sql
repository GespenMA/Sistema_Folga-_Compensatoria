-- =====================================================================================
-- TRIGGER PARA CÁLCULO AUTOMÁTICO DO ORÇAMENTO DA UNIDADE
-- Regra: Total Orçado = Soma(Quantidade Planejada * Valor da Folga do Cargo)
-- =====================================================================================

-- 1. Cria a função que faz o cálculo e atualiza a tabela cycle_establishments
CREATE OR REPLACE FUNCTION recalcular_orcamento_unidade()
RETURNS TRIGGER AS $$
DECLARE
    v_ce_id UUID;
    v_total DECIMAL(10,2) := 0;
    v_cycle_date DATE;
BEGIN
    -- Identifica o cycle_establishment_id afetado pela alteração
    IF TG_OP = 'DELETE' THEN
        v_ce_id := OLD.cycle_establishment_id;
    ELSE
        v_ce_id := NEW.cycle_establishment_id;
    END IF;

    -- Descobre a data de início do ciclo para buscar o valor histórico correto do cargo
    SELECT c.data_inicio INTO v_cycle_date
    FROM cycle_establishments ce
    JOIN cycles c ON c.id = ce.cycle_id
    WHERE ce.id = v_ce_id;

    -- Soma (quantidade_planejada * valor_do_cargo) para todos os cargos desta unidade neste ciclo
    SELECT COALESCE(SUM(
        pl.quantidade_planejada * (
            SELECT pv.valor 
            FROM position_values pv 
            WHERE pv.position_id = pl.position_id 
              AND pv.vigencia_inicio <= v_cycle_date 
            ORDER BY pv.vigencia_inicio DESC 
            LIMIT 1
        )
    ), 0) INTO v_total
    FROM planning_limits pl
    WHERE pl.cycle_establishment_id = v_ce_id;

    -- Atualiza o orçamento total na tabela cycle_establishments
    UPDATE cycle_establishments 
    SET total_orcado = v_total
    WHERE id = v_ce_id;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 2. Remove o trigger se já existir para evitar duplicidade
DROP TRIGGER IF EXISTS trg_recalcular_orcamento ON planning_limits;

-- 3. Cria o gatilho na tabela planning_limits (sempre que inserir, atualizar ou deletar um limite)
CREATE TRIGGER trg_recalcular_orcamento
AFTER INSERT OR UPDATE OR DELETE ON planning_limits
FOR EACH ROW
EXECUTE FUNCTION recalcular_orcamento_unidade();

-- =====================================================================================
-- BLOCO DE EXECUÇÃO ÚNICA: RECALCULAR TODOS OS ORÇAMENTOS EXISTENTES AGORA
-- Isso garante que as importações anteriores já fiquem perfeitamente sincronizadas
-- =====================================================================================
DO $$
DECLARE
    rec RECORD;
    v_total DECIMAL(10,2);
    v_cycle_date DATE;
BEGIN
    FOR rec IN SELECT id, cycle_id FROM cycle_establishments LOOP
        
        -- Busca a data do ciclo
        SELECT data_inicio INTO v_cycle_date FROM cycles WHERE id = rec.cycle_id;

        -- Calcula o valor correto
        SELECT COALESCE(SUM(
            pl.quantidade_planejada * (
                SELECT pv.valor 
                FROM position_values pv 
                WHERE pv.position_id = pl.position_id 
                  AND pv.vigencia_inicio <= v_cycle_date 
                ORDER BY pv.vigencia_inicio DESC 
                LIMIT 1
            )
        ), 0) INTO v_total
        FROM planning_limits pl
        WHERE pl.cycle_establishment_id = rec.id;

        -- Atualiza
        UPDATE cycle_establishments 
        SET total_orcado = v_total
        WHERE id = rec.id;

    END LOOP;
END;
$$;

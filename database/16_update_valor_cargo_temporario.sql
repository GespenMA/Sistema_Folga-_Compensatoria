-- 1. Atualizar o valor vigente na tabela de valores de cargo
UPDATE position_values
SET valor = 316.21
WHERE position_id = (SELECT id FROM positions WHERE nome = 'Agente Penitenciário Temporário')
  AND vigencia_fim IS NULL;

-- 2. Atualizar o valor nas solicitações de compra no banco
UPDATE purchase_requests
SET valor = 316.21
WHERE position_id = (SELECT id FROM positions WHERE nome = 'Agente Penitenciário Temporário');

-- 3. Recalcular o Total Orçado de todos os estabelecimentos baseado no novo valor do cargo
DO $$
DECLARE
    rec RECORD;
    v_total DECIMAL(10,2);
    v_cycle_date DATE;
BEGIN
    -- Pega apenas os ciclos ativos/abertos para não mexer em históricos de ciclos fechados
    FOR rec IN 
        SELECT ce.id, ce.cycle_id 
        FROM cycle_establishments ce
        JOIN cycles c ON c.id = ce.cycle_id
        WHERE c.status IN ('RASCUNHO', 'ABERTO', 'REABERTO') 
    LOOP
        
        -- Calcula o valor correto (soma qtd_planejada * valor ATUALIZADO do cargo)
        SELECT COALESCE(SUM(
            pl.quantidade_planejada * (
                SELECT pv.valor 
                FROM position_values pv 
                WHERE pv.position_id = pl.position_id 
                -- Ignora a data de início do ciclo para forçar pegar o valor mais recente cadastrado
                ORDER BY pv.vigencia_inicio DESC 
                LIMIT 1
            )
        ), 0) INTO v_total
        FROM planning_limits pl
        WHERE pl.cycle_establishment_id = rec.id;

        -- Atualiza a tabela com o total orçado recalibrado
        UPDATE cycle_establishments 
        SET total_orcado = v_total
        WHERE id = rec.id;

    END LOOP;
END;
$$;

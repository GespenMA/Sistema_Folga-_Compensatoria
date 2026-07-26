-- =====================================================================================
-- Função para clonar o orçamento e os limites de cargos de um ciclo anterior para um novo ciclo.
-- Isso copia as linhas de `cycle_establishments` e `planning_limits`.
-- =====================================================================================

CREATE OR REPLACE FUNCTION clone_cycle_budget(p_new_cycle_id UUID, p_old_cycle_id UUID)
RETURNS VOID AS $$
DECLARE
  v_ce RECORD;
  v_new_ce_id UUID;
  v_pl RECORD;
BEGIN
  -- Percorre todos os estabelecimentos vinculados ao ciclo antigo
  FOR v_ce IN SELECT * FROM cycle_establishments WHERE cycle_id = p_old_cycle_id LOOP
    
    -- Insere o mesmo estabelecimento no novo ciclo (com o mesmo orçamento)
    INSERT INTO cycle_establishments (cycle_id, establishment_id, total_orcado)
    VALUES (p_new_cycle_id, v_ce.establishment_id, v_ce.total_orcado)
    RETURNING id INTO v_new_ce_id;

    -- Clona os limites atrelados a este estabelecimento
    FOR v_pl IN SELECT * FROM planning_limits WHERE cycle_establishment_id = v_ce.id LOOP
      INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
      VALUES (v_new_ce_id, v_pl.position_id, v_pl.quantidade_planejada);
    END LOOP;
    
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

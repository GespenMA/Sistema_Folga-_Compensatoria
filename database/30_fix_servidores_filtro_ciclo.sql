-- =============================================================================
-- Migration 30: Corrige filtro de ciclo na tela de Servidores
-- =============================================================================
-- PROBLEMA: A query anterior usava shifts!inner para filtrar servidores por
-- ciclo, excluindo servidores que tem apenas purchase_requests do tipo
-- PLANTAO_PLUS (sem shifts) no ciclo selecionado.
--
-- SOLUCAO: Funcao RPC que faz UNION de shifts e purchase_requests para obter
-- todos os employee_ids com lancamento no ciclo, depois aplica os demais
-- filtros e paginacao inteiramente no servidor.
-- =============================================================================

CREATE OR REPLACE FUNCTION get_employee_ids_by_cycle(p_cycle_id UUID)
RETURNS TABLE(employee_id UUID)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT DISTINCT employee_id FROM shifts WHERE cycle_id = p_cycle_id
  UNION
  SELECT DISTINCT employee_id FROM purchase_requests WHERE cycle_id = p_cycle_id
$$;

CREATE OR REPLACE FUNCTION get_servidores_por_ciclo(
  p_cycle_id UUID DEFAULT NULL,
  p_establishment_id UUID DEFAULT NULL,
  p_position_id UUID DEFAULT NULL,
  p_search TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE(
  id UUID, matricula VARCHAR, nome VARCHAR, data_admissao DATE, ativo BOOLEAN,
  position_id UUID, position_nome VARCHAR, establishment_id UUID,
  establishment_nome VARCHAR, total_count BIGINT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH ciclo_employees AS (
    SELECT DISTINCT employee_id FROM (
      SELECT employee_id FROM shifts WHERE p_cycle_id IS NULL OR cycle_id = p_cycle_id
      UNION
      SELECT employee_id FROM purchase_requests WHERE p_cycle_id IS NULL OR cycle_id = p_cycle_id
    ) sub
  ),
  filtered AS (
    SELECT e.id, e.matricula, e.nome, e.data_admissao, e.ativo,
           pos.id AS position_id, pos.nome AS position_nome,
           est.id AS establishment_id, est.nome AS establishment_nome
    FROM employees e
    LEFT JOIN positions pos ON pos.id = e.position_id
    LEFT JOIN establishments est ON est.id = e.establishment_id
    WHERE
      (p_cycle_id IS NULL OR e.id IN (SELECT employee_id FROM ciclo_employees))
      AND (p_establishment_id IS NULL OR e.establishment_id = p_establishment_id)
      AND (p_position_id IS NULL OR e.position_id = p_position_id)
      AND (p_search IS NULL OR e.nome ILIKE ''%'' || p_search || ''%'' OR e.matricula ILIKE ''%'' || p_search || ''%'')
  )
  SELECT f.id, f.matricula, f.nome, f.data_admissao, f.ativo,
    f.position_id, f.position_nome, f.establishment_id, f.establishment_nome,
    COUNT(*) OVER () AS total_count
  FROM filtered f ORDER BY f.nome LIMIT p_limit OFFSET p_offset;
$$;

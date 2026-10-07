-- =============================================================================
-- Migration 34: Função para listar escalas presentes em um estabelecimento penal
-- =============================================================================

CREATE OR REPLACE FUNCTION get_escalas_por_estabelecimento(p_establishment_id UUID DEFAULT NULL)
RETURNS TABLE(id UUID, nome VARCHAR)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT DISTINCT st.id, st.nome
  FROM employees e
  JOIN schedule_types st ON st.id = e.schedule_type_id
  WHERE (p_establishment_id IS NULL OR e.establishment_id = p_establishment_id)
  ORDER BY st.nome;
$$;

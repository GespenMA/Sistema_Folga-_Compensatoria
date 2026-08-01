-- =====================================================================================
-- 9. CONSTRAINT ÚNICA: UM SHIFT POR SERVIDOR POR CICLO
-- =====================================================================================
-- Previne a inserção acidental de múltiplos shifts para o mesmo servidor
-- no mesmo ciclo, garantindo integridade no nível do banco de dados.
-- Antes de adicionar a constraint, é necessário remover duplicatas existentes.

-- PASSO 1: Remover duplicatas, mantendo apenas o mais recente por (employee_id, cycle_id)
-- (Execute manualmente se houver duplicatas no banco atual)
/*
DELETE FROM shifts
WHERE id NOT IN (
  SELECT DISTINCT ON (employee_id, cycle_id) id
  FROM shifts
  ORDER BY employee_id, cycle_id, created_at DESC
);
*/

-- PASSO 2: Adicionar a constraint única
ALTER TABLE shifts
  ADD CONSTRAINT uq_shifts_employee_cycle UNIQUE (employee_id, cycle_id);

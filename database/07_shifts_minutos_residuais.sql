-- =====================================================================================
-- 7. GUARDAR MINUTOS RESIDUAIS POR LANÇAMENTO DE PLANTÕES
-- =====================================================================================
-- Permite reverter corretamente o saldo_minutos ao re-importar o mesmo ciclo.
-- Quando um shift é substituído, subtraímos o residuo_minutos antigo do saldo
-- do servidor, e adicionamos o novo — garantindo que não há acúmulo indevido.

ALTER TABLE shifts ADD COLUMN IF NOT EXISTS minutos_residuais INTEGER DEFAULT 0;

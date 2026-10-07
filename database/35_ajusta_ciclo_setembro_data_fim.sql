-- ==============================================================================
-- Migração 35: Ajusta data_fim do ciclo Setembro/2026 para fechar em 25/10/2026
--
-- Regra de negócio: Ciclos iniciam no dia 26 e encerram no dia 25 do mês subsequente
-- às 23:59:59. O ciclo Setembro/2026 havia sido criado até 26/10/2026 por conta
-- do cálculo genérico de +30 dias.
-- ==============================================================================

UPDATE cycles 
SET data_fim = '2026-10-25' 
WHERE nome = 'Setembro/2026' 
  AND data_inicio = '2026-09-26' 
  AND data_fim = '2026-10-26';

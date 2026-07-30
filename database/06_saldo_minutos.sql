-- =====================================================================================
-- 6. SALDO DE MINUTOS RESIDUAIS POR SERVIDOR
-- =====================================================================================
-- Guarda os minutos que "sobraram" após a divisão por 720 (12h = 1 plantão).
-- Esses minutos são somados às horas do próximo ciclo antes de calcular os plantões.
-- Exemplo: 146:19 = 8779 min / 720 = 12 plantões com saldo de 139 min (2h19min)
--          No próximo ciclo: 139 min + X min novos = total antes de dividir

ALTER TABLE employees ADD COLUMN IF NOT EXISTS saldo_minutos INTEGER DEFAULT 0;

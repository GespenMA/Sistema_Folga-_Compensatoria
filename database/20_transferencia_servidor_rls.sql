-- =====================================================================================
-- 20. TRANSFERÊNCIA DE SERVIDOR — Passo 4/4: RLS usa coluna direta, NOT NULL, índice
-- =====================================================================================
-- Antes: RLS de shifts/compensatory_days filtrava pela lotação ATUAL do servidor
-- (join em employees.establishment_id) — depois de uma transferência, a unidade de
-- origem perderia a permissão de ver o próprio histórico. Agora filtra pela coluna
-- fixa, gravada no momento em que o plantão/folga aconteceu.

DROP POLICY IF EXISTS "Est_shifts" ON shifts;
CREATE POLICY "Est_shifts" ON shifts FOR ALL USING (establishment_id = get_user_establishment());

DROP POLICY IF EXISTS "Est_compensatory_days" ON compensatory_days;
CREATE POLICY "Est_compensatory_days" ON compensatory_days FOR ALL USING (establishment_id = get_user_establishment());

ALTER TABLE shifts ALTER COLUMN establishment_id SET NOT NULL;
ALTER TABLE compensatory_days ALTER COLUMN establishment_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_shifts_establishment ON shifts(establishment_id);
CREATE INDEX IF NOT EXISTS idx_compensatory_days_establishment ON compensatory_days(establishment_id);

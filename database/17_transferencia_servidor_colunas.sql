-- =====================================================================================
-- 17. TRANSFERÊNCIA DE SERVIDOR — Passo 1/4: colunas novas (histórico fixo por unidade)
-- =====================================================================================
-- shifts/compensatory_days passam a guardar em qual estabelecimento o plantão/folga
-- de fato aconteceu, de forma imutável — independente de o servidor ser transferido
-- depois. employees.establishment_id continua sendo a "custódia atual" (móvel).
-- Nullable por enquanto: só viram NOT NULL na migration 20, depois que o novo
-- Configuracoes.tsx (que preenche a coluna no insert) estiver em produção.

ALTER TABLE shifts ADD COLUMN IF NOT EXISTS establishment_id UUID REFERENCES establishments(id);
ALTER TABLE compensatory_days ADD COLUMN IF NOT EXISTS establishment_id UUID REFERENCES establishments(id);

-- Backfill: única fonte disponível para linhas já existentes é o establishment_id
-- ATUAL do servidor. Aceitável — sistema em produção há poucos dias (~10) e a
-- auditoria de 2026-08-11 não encontrou nenhuma matrícula em mais de um
-- estabelecimento, ou seja, nenhuma transferência real ainda aconteceu na base.
UPDATE shifts s
SET establishment_id = e.establishment_id
FROM employees e
WHERE s.employee_id = e.id AND s.establishment_id IS NULL;

UPDATE compensatory_days cd
SET establishment_id = e.establishment_id
FROM employees e
WHERE cd.employee_id = e.id AND cd.establishment_id IS NULL;

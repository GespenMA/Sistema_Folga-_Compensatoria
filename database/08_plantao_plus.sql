-- 08_plantao_plus.sql
-- Adiciona suporte ao Plantão Plus na tabela de purchase_requests

ALTER TABLE purchase_requests 
ADD COLUMN tipo_solicitacao VARCHAR(30) DEFAULT 'FOLGA_COMPENSATORIA' CHECK (tipo_solicitacao IN ('FOLGA_COMPENSATORIA', 'PLANTAO_PLUS')),
ADD COLUMN data_plantao DATE;

-- Opcional: Atualizar registros antigos para ter o tipo explicitamente preenchido
UPDATE purchase_requests SET tipo_solicitacao = 'FOLGA_COMPENSATORIA' WHERE tipo_solicitacao IS NULL;

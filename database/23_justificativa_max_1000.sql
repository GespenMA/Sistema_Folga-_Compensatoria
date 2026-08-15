-- =====================================================================================
-- Reduz o limite máximo de caracteres da justificativa de 2000 para 1000 (mínimo
-- continua 50). Verificado em produção antes desta migration: das 1.669 solicitações
-- existentes, a maior justificativa tem 655 caracteres — nenhuma ultrapassa 1000, então
-- essa constraint mais rígida não invalida nenhum registro já gravado.
-- =====================================================================================

ALTER TABLE purchase_requests DROP CONSTRAINT IF EXISTS purchase_requests_justificativa_check;

ALTER TABLE purchase_requests
  ADD CONSTRAINT purchase_requests_justificativa_check
  CHECK (char_length(justificativa) >= 50 AND char_length(justificativa) <= 1000);

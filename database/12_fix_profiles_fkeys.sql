-- Este script altera as restrições de chave estrangeira que apontam para a tabela profiles
-- mudando o comportamento de exclusão para ON DELETE SET NULL.
-- Isso permite a exclusão de um perfil sem violar restrições e sem apagar os dados relacionados.

BEGIN;

-- 1. Cycles
ALTER TABLE cycles 
  DROP CONSTRAINT IF EXISTS cycles_opened_by_fkey,
  DROP CONSTRAINT IF EXISTS cycles_closed_by_fkey,
  DROP CONSTRAINT IF EXISTS cycles_reopened_by_fkey,
  ADD CONSTRAINT cycles_opened_by_fkey FOREIGN KEY (opened_by) REFERENCES profiles(id) ON DELETE SET NULL,
  ADD CONSTRAINT cycles_closed_by_fkey FOREIGN KEY (closed_by) REFERENCES profiles(id) ON DELETE SET NULL,
  ADD CONSTRAINT cycles_reopened_by_fkey FOREIGN KEY (reopened_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- 2. Shifts
ALTER TABLE shifts
  DROP CONSTRAINT IF EXISTS shifts_created_by_fkey,
  ADD CONSTRAINT shifts_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- 3. Compensatory Days
ALTER TABLE compensatory_days
  DROP CONSTRAINT IF EXISTS compensatory_days_generated_by_fkey,
  DROP CONSTRAINT IF EXISTS compensatory_days_decided_by_fkey,
  ADD CONSTRAINT compensatory_days_generated_by_fkey FOREIGN KEY (generated_by) REFERENCES profiles(id) ON DELETE SET NULL,
  ADD CONSTRAINT compensatory_days_decided_by_fkey FOREIGN KEY (decided_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- 4. Purchase Requests
ALTER TABLE purchase_requests
  DROP CONSTRAINT IF EXISTS purchase_requests_requested_by_fkey,
  DROP CONSTRAINT IF EXISTS purchase_requests_analyzed_by_fkey,
  DROP CONSTRAINT IF EXISTS purchase_requests_cancelled_by_fkey,
  ADD CONSTRAINT purchase_requests_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES profiles(id) ON DELETE SET NULL,
  ADD CONSTRAINT purchase_requests_analyzed_by_fkey FOREIGN KEY (analyzed_by) REFERENCES profiles(id) ON DELETE SET NULL,
  ADD CONSTRAINT purchase_requests_cancelled_by_fkey FOREIGN KEY (cancelled_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- 5. Audit Logs
ALTER TABLE audit_logs
  DROP CONSTRAINT IF EXISTS audit_logs_user_id_fkey,
  ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL;

COMMIT;

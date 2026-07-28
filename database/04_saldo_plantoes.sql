-- =====================================================================================
-- 4. ATUALIZAÇÃO: BANCO DE PLANTÕES (ACÚMULO E GERAÇÃO AUTOMÁTICA DE FOLGAS)
-- =====================================================================================

-- 1. Adicionar saldo_plantoes na tabela de employees
ALTER TABLE employees ADD COLUMN IF NOT EXISTS saldo_plantoes INTEGER DEFAULT 0;

-- 2. Limpar os dados antigos para evitar inconsistências nos testes
-- CUIDADO: Isso apaga todas as folgas, plantões e solicitações de testes anteriores.
DELETE FROM purchase_requests;
DELETE FROM compensatory_days;
DELETE FROM shifts;
UPDATE employees SET saldo_plantoes = 0;

-- 3. Função Trigger para recalcular o saldo e gerar folgas automaticamente a cada 21 plantões
CREATE OR REPLACE FUNCTION trg_recalculate_shift_balance()
RETURNS TRIGGER AS $$
DECLARE
    v_emp_id UUID;
    v_total_shifts INTEGER;
    v_total_folgas INTEGER;
    v_current_balance INTEGER;
    v_folgas_to_generate INTEGER;
    v_cycle_id UUID;
    v_per_inicio DATE;
    v_per_fim DATE;
    v_user UUID;
    v_i INTEGER;
BEGIN
    -- Identificar o funcionário afetado
    IF TG_OP = 'DELETE' THEN
        v_emp_id := OLD.employee_id;
    ELSE
        v_emp_id := NEW.employee_id;
    END IF;

    -- Calcular o total histórico de plantões inseridos na tabela shifts
    SELECT COALESCE(SUM(quantidade_plantoes), 0) INTO v_total_shifts FROM shifts WHERE employee_id = v_emp_id;
    
    -- Calcular quantas folgas já existem na tabela compensatory_days para este funcionário
    -- IMPORTANTE: Cada folga custa 21 plantões do saldo histórico!
    SELECT COUNT(*) INTO v_total_folgas FROM compensatory_days WHERE employee_id = v_emp_id;
    
    -- O Saldo atual é o total trabalhado menos (Total de folgas geradas x 21)
    v_current_balance := v_total_shifts - (v_total_folgas * 21);
    
    -- Segurança: Se o saldo ficar negativo (ex: usuário deletou um plantão de 15)
    -- Devemos tentar deletar folgas que ainda não foram compradas (status = 'GERADA')
    WHILE v_current_balance < 0 LOOP
        -- Tenta deletar a folga GERADA mais recente
        DELETE FROM compensatory_days 
        WHERE id = (
            SELECT id FROM compensatory_days 
            WHERE employee_id = v_emp_id AND status = 'GERADA' 
            ORDER BY generated_at DESC LIMIT 1
        );
        
        IF FOUND THEN
            v_total_folgas := v_total_folgas - 1;
            v_current_balance := v_current_balance + 21;
        ELSE
            -- Se não tem mais folgas GERADAS para deletar e o saldo ainda é negativo, é porque a folga já foi COMPRADA.
            RAISE EXCEPTION 'Ação negada: O servidor possui folgas ativas que dependem destes plantões. Exclua a folga primeiro.';
        END IF;
    END LOOP;
    
    -- Verifica se o novo saldo acumulado atingiu ou passou de 21 plantões
    v_folgas_to_generate := v_current_balance / 21; -- Divisão inteira (ex: 45 / 21 = 2)
    
    IF v_folgas_to_generate > 0 THEN
        -- Vamos precisar das informações do plantão mais recente para preencher os dados da folga
        SELECT cycle_id, periodo_inicio, periodo_fim, created_by 
        INTO v_cycle_id, v_per_inicio, v_per_fim, v_user
        FROM shifts WHERE employee_id = v_emp_id ORDER BY created_at DESC LIMIT 1;
        
        -- Inserir as novas folgas automaticamente!
        FOR v_i IN 1..v_folgas_to_generate LOOP
            INSERT INTO compensatory_days (employee_id, cycle_id, shift_id, periodo_inicio, periodo_fim, quantidade_plantoes, status, generated_by)
            VALUES (v_emp_id, v_cycle_id, NULL, v_per_inicio, v_per_fim, 1, 'GERADA', v_user);
        END LOOP;
        
        -- Atualizar a variável de saldo (descontando as novas folgas geradas no loop)
        v_current_balance := v_current_balance - (v_folgas_to_generate * 21);
    END IF;
    
    -- Atualiza a tabela employees com o saldo que restou (entre 0 e 20)
    UPDATE employees SET saldo_plantoes = v_current_balance WHERE id = v_emp_id;
    
    RETURN NULL; -- Trigger AFTER não precisa retornar a ROW
END;
$$ LANGUAGE plpgsql;

-- 4. Registrar a Trigger para ouvir inserções, atualizações e deleções em shifts
DROP TRIGGER IF EXISTS trigger_shift_balance ON shifts;
CREATE TRIGGER trigger_shift_balance
AFTER INSERT OR UPDATE OR DELETE ON shifts
FOR EACH ROW EXECUTE FUNCTION trg_recalculate_shift_balance();

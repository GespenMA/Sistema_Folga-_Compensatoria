-- =====================================================================================
-- 18. TRANSFERÊNCIA DE SERVIDOR — Passo 2/4: trigger propaga establishment_id
-- =====================================================================================
-- Quem gera compensatory_days não é o frontend, é este trigger (dispara a cada
-- INSERT/UPDATE/DELETE em shifts). Ele já busca cycle_id/periodo_inicio/periodo_fim/
-- created_by do shift mais recente do servidor — passa a buscar establishment_id
-- também e gravar na folga gerada.

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
    v_establishment_id UUID;
    v_i INTEGER;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_emp_id := OLD.employee_id;
    ELSE
        v_emp_id := NEW.employee_id;
    END IF;

    SELECT COALESCE(SUM(quantidade_plantoes), 0) INTO v_total_shifts FROM shifts WHERE employee_id = v_emp_id;
    SELECT COUNT(*) INTO v_total_folgas FROM compensatory_days WHERE employee_id = v_emp_id;
    v_current_balance := v_total_shifts - (v_total_folgas * 21);

    WHILE v_current_balance < 0 LOOP
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
            RAISE EXCEPTION 'Ação negada: O servidor possui folgas ativas que dependem destes plantões. Exclua a folga primeiro.';
        END IF;
    END LOOP;

    v_folgas_to_generate := v_current_balance / 21;

    IF v_folgas_to_generate > 0 THEN
        SELECT cycle_id, periodo_inicio, periodo_fim, created_by, establishment_id
        INTO v_cycle_id, v_per_inicio, v_per_fim, v_user, v_establishment_id
        FROM shifts WHERE employee_id = v_emp_id ORDER BY created_at DESC LIMIT 1;

        FOR v_i IN 1..v_folgas_to_generate LOOP
            INSERT INTO compensatory_days (employee_id, cycle_id, shift_id, periodo_inicio, periodo_fim, quantidade_plantoes, status, generated_by, establishment_id)
            VALUES (v_emp_id, v_cycle_id, NULL, v_per_inicio, v_per_fim, 1, 'GERADA', v_user, v_establishment_id);
        END LOOP;

        v_current_balance := v_current_balance - (v_folgas_to_generate * 21);
    END IF;

    UPDATE employees SET saldo_plantoes = v_current_balance WHERE id = v_emp_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

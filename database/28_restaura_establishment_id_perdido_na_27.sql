-- =====================================================================================
-- Corrige uma regressão introduzida pelas migrações 26 e 27.
--
-- trg_recalculate_shift_balance tinha sido modificado pela migração 18 (transferência
-- de servidor) para propagar establishment_id do shift mais recente para a folga
-- gerada em compensatory_days (coluna NOT NULL desde a migração 20). As migrações 26 e
-- 27 desta feature reescreveram a função com base no corpo ORIGINAL de
-- database/04_saldo_plantoes.sql, sem essa propagação — revertendo por engano a
-- migração 18. Isso quebrava a geração automática de folga (violava NOT NULL em
-- compensatory_days.establishment_id) sempre que um servidor completasse 21 plantões.
--
-- Encontrado na verificação final desta feature, antes de qualquer push. Corrige
-- restaurando a lógica da migração 18 combinada com o filtro conta_para_saldo da 27.
-- =====================================================================================

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

    SELECT COALESCE(SUM(quantidade_plantoes), 0) INTO v_total_shifts
    FROM shifts WHERE employee_id = v_emp_id AND conta_para_saldo = TRUE;

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
        FROM shifts
        WHERE employee_id = v_emp_id AND conta_para_saldo = TRUE
        ORDER BY created_at DESC LIMIT 1;

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

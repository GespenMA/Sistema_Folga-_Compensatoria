-- =====================================================================================
-- Corrige retroatividade indevida na migração 26 (escalas / modalidade de compra).
--
-- Problema encontrado na verificação final: trg_recalculate_shift_balance recalcula
-- o saldo por SOMA HISTÓRICA COMPLETA de shifts a cada evento (isso já era assim antes
-- da migração 26, ver database/04_saldo_plantoes.sql). O gate da migração 26 só evitava
-- o recálculo NO MOMENTO em que um shift é inserido com a escala desabilitada — mas não
-- marcava esse shift como "fora da conta" pra sempre. Resultado: assim que QUALQUER
-- evento novo dispara o trigger de novo pro mesmo servidor (ex: religar a escala e
-- importar o mês seguinte), a soma histórica completa volta a incluir os plantões
-- antigos — retroativo, violando a regra 6 da spec (não-retroativo).
--
-- Solução: cada shift passa a guardar, permanentemente, se ele conta pro saldo — decidido
-- UMA VEZ, no momento em que é inserido, e nunca revisado depois (nem se a escala for
-- religada). trg_recalculate_shift_balance passa a somar só os shifts marcados.
-- =====================================================================================

-- 1. Nova coluna — nasce TRUE pra todo shift já existente, preservando 100% do
-- comportamento atual (mesma lógica de "nasce habilitado" da migração 26).
ALTER TABLE shifts ADD COLUMN conta_para_saldo BOOLEAN NOT NULL DEFAULT TRUE;

-- 2. Trigger novo, BEFORE INSERT: decide e grava conta_para_saldo no momento da
-- criação do shift, a partir da escala do servidor NAQUELE momento.
CREATE OR REPLACE FUNCTION trg_set_shift_conta_para_saldo()
RETURNS TRIGGER AS $$
DECLARE
    v_permite_carga_horaria BOOLEAN;
BEGIN
    SELECT COALESCE(st.permite_carga_horaria, TRUE) INTO v_permite_carga_horaria
    FROM employees e
    LEFT JOIN schedule_types st ON st.id = e.schedule_type_id
    WHERE e.id = NEW.employee_id;

    NEW.conta_para_saldo := v_permite_carga_horaria;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_before_shift_conta_para_saldo ON shifts;
CREATE TRIGGER trg_before_shift_conta_para_saldo
BEFORE INSERT ON shifts
FOR EACH ROW EXECUTE FUNCTION trg_set_shift_conta_para_saldo();

-- 3. trg_recalculate_shift_balance simplifica: não precisa mais checar a escala (isso
-- já foi decidido e gravado por shift na inserção) — só filtra a soma por
-- conta_para_saldo = TRUE. Mesmo corpo de negócio de sempre, sem o gate antigo.
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
        SELECT cycle_id, periodo_inicio, periodo_fim, created_by
        INTO v_cycle_id, v_per_inicio, v_per_fim, v_user
        FROM shifts
        WHERE employee_id = v_emp_id AND conta_para_saldo = TRUE
        ORDER BY created_at DESC LIMIT 1;

        FOR v_i IN 1..v_folgas_to_generate LOOP
            INSERT INTO compensatory_days (employee_id, cycle_id, shift_id, periodo_inicio, periodo_fim, quantidade_plantoes, status, generated_by)
            VALUES (v_emp_id, v_cycle_id, NULL, v_per_inicio, v_per_fim, 1, 'GERADA', v_user);
        END LOOP;

        v_current_balance := v_current_balance - (v_folgas_to_generate * 21);
    END IF;

    UPDATE employees SET saldo_plantoes = v_current_balance WHERE id = v_emp_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

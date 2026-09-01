-- =====================================================================================
-- Elegibilidade de escala (regime de trabalho) para modalidade de compra de plantão.
-- Ver spec: docs/superpowers/specs/2026-09-01-escalas-modalidade-compra-design.md
--
-- Cria o conceito de "escala" (regime de trabalho, ex: "24 H X 72H"), lido da coluna
-- "Horário" da planilha de importação mensal. Cada escala tem um interruptor
-- permite_carga_horaria: quando desligado, o servidor só tem acesso a Plantão Plus —
-- não acumula carga horária compensatória (não gera compensatory_days, não mostra
-- saldo acumulado na tela). Todas as escalas nascem HABILITADAS — nada muda no
-- comportamento atual até o admin geral desabilitar manualmente alguma.
-- =====================================================================================

-- 1. Tabelas novas
CREATE TABLE schedule_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(255) NOT NULL UNIQUE,
    permite_carga_horaria BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE schedule_type_aliases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    texto_bruto VARCHAR(255) NOT NULL UNIQUE,
    schedule_type_id UUID NOT NULL REFERENCES schedule_types(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE employees ADD COLUMN schedule_type_id UUID REFERENCES schedule_types(id);

-- 2. RLS — mesmo padrão de positions/position_values (referência global, admin
-- escreve, todo mundo lê — necessário pra Folgas.tsx/Solicitacoes.tsx conseguirem
-- checar o flag mesmo logados como ESTABELECIMENTO/GESTOR).
ALTER TABLE schedule_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_type_aliases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem tudo em schedule_types" ON schedule_types FOR ALL USING (is_admin());
CREATE POLICY "Todos podem ver schedule_types" ON schedule_types FOR SELECT USING (true);
CREATE POLICY "Admins podem tudo em schedule_type_aliases" ON schedule_type_aliases FOR ALL USING (is_admin());
CREATE POLICY "Todos podem ver schedule_type_aliases" ON schedule_type_aliases FOR SELECT USING (true);

-- 3. Gate no trigger de saldo: servidor em escala só-Plus não acumula carga horária.
-- Mesmo corpo de database/04_saldo_plantoes.sql:16-91, só acrescenta o gate no
-- início. COALESCE(..., TRUE) cobre schedule_type_id IS NULL (servidor sem escala
-- definida) — comportamento atual preservado.
CREATE OR REPLACE FUNCTION trg_recalculate_shift_balance()
RETURNS TRIGGER AS $$
DECLARE
    v_emp_id UUID;
    v_permite_carga_horaria BOOLEAN;
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

    SELECT COALESCE(st.permite_carga_horaria, TRUE) INTO v_permite_carga_horaria
    FROM employees e
    LEFT JOIN schedule_types st ON st.id = e.schedule_type_id
    WHERE e.id = v_emp_id;

    IF NOT v_permite_carga_horaria THEN
        -- Escala só-Plus: este shift não altera saldo_plantoes nem gera
        -- compensatory_days. Saldo anterior (se houver, de antes da escala ser
        -- desabilitada) fica congelado — não é zerado nem recalculado.
        RETURN NULL;
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
        SELECT cycle_id, periodo_inicio, periodo_fim, created_by
        INTO v_cycle_id, v_per_inicio, v_per_fim, v_user
        FROM shifts WHERE employee_id = v_emp_id ORDER BY created_at DESC LIMIT 1;

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

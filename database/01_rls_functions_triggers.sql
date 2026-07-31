-- =====================================================================================
-- 1. ROW LEVEL SECURITY (RLS)
-- =====================================================================================

-- Ativar RLS em todas as tabelas
ALTER TABLE establishments ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE cycle_establishments ENABLE ROW LEVEL SECURITY;
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE position_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE planning_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE compensatory_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Função auxiliar para obter o estabelecimento do usuário logado
CREATE OR REPLACE FUNCTION get_user_establishment()
RETURNS UUID AS $$
BEGIN
  RETURN (SELECT establishment_id FROM profiles WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função auxiliar para checar se é ADMIN
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (SELECT perfil = 'ADMIN' FROM profiles WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 1.1 Establishments
CREATE POLICY "Admins podem tudo em establishments" ON establishments FOR ALL USING (is_admin());
CREATE POLICY "Estabelecimentos podem ver a si mesmos" ON establishments FOR SELECT USING (id = get_user_establishment());

-- 1.2 Profiles
CREATE POLICY "Admins podem tudo em profiles" ON profiles FOR ALL USING (is_admin());
CREATE POLICY "Usuários podem ver a si mesmos e colegas da mesma unidade" ON profiles FOR SELECT USING (establishment_id = get_user_establishment() OR id = auth.uid());

-- 1.3 Cycles e Ciclos de Unidade
CREATE POLICY "Admins podem tudo em cycles" ON cycles FOR ALL USING (is_admin());
CREATE POLICY "Estabelecimentos podem ver cycles" ON cycles FOR SELECT USING (true);
CREATE POLICY "Admins podem tudo em cycle_establishments" ON cycle_establishments FOR ALL USING (is_admin());
CREATE POLICY "Estabelecimentos podem ver seus orçamentos" ON cycle_establishments FOR SELECT USING (establishment_id = get_user_establishment());

-- 1.4 Cargos, Valores e Limites
CREATE POLICY "Admins podem tudo em planning e positions" ON positions FOR ALL USING (is_admin());
CREATE POLICY "Todos podem ver positions" ON positions FOR SELECT USING (true);
CREATE POLICY "Admins podem tudo em position_values" ON position_values FOR ALL USING (is_admin());
CREATE POLICY "Todos podem ver position_values" ON position_values FOR SELECT USING (true);
CREATE POLICY "Admins podem tudo em planning_limits" ON planning_limits FOR ALL USING (is_admin());
CREATE POLICY "Estabelecimentos podem ver seus planning_limits" ON planning_limits FOR SELECT USING (
    cycle_establishment_id IN (SELECT id FROM cycle_establishments WHERE establishment_id = get_user_establishment())
);

-- 1.5 Servidores, Plantões, Folgas e Compras
-- ADMIN:
CREATE POLICY "Admins_employees" ON employees FOR ALL USING (is_admin());
CREATE POLICY "Admins_shifts" ON shifts FOR ALL USING (is_admin());
CREATE POLICY "Admins_compensatory_days" ON compensatory_days FOR ALL USING (is_admin());
CREATE POLICY "Admins_purchase_requests" ON purchase_requests FOR ALL USING (is_admin());

-- ESTABELECIMENTO:
CREATE POLICY "Est_employees" ON employees FOR ALL USING (establishment_id = get_user_establishment());
CREATE POLICY "Est_shifts" ON shifts FOR ALL USING (employee_id IN (SELECT id FROM employees WHERE establishment_id = get_user_establishment()));
CREATE POLICY "Est_compensatory_days" ON compensatory_days FOR ALL USING (employee_id IN (SELECT id FROM employees WHERE establishment_id = get_user_establishment()));
CREATE POLICY "Est_purchase_requests" ON purchase_requests FOR ALL USING (establishment_id = get_user_establishment());


-- =====================================================================================
-- 2. FUNÇÕES E TRIGGERS (REGRAS DE NEGÓCIO)
-- =====================================================================================

-- 2.1 Prevenir modificações após fechamento do ciclo
CREATE OR REPLACE FUNCTION check_cycle_status() RETURNS TRIGGER AS $$
DECLARE
  v_status ciclo_status_enum;
BEGIN
  -- Se for operação na tabela cycles, ignorar aqui
  
  -- Para tabelas vinculadas ao ciclo, pega o status
  IF TG_TABLE_NAME = 'shifts' OR TG_TABLE_NAME = 'compensatory_days' OR TG_TABLE_NAME = 'purchase_requests' THEN
    SELECT status INTO v_status FROM cycles WHERE id = NEW.cycle_id;
    IF v_status = 'FECHADO' THEN
      RAISE EXCEPTION 'O ciclo está FECHADO e não permite novos lançamentos ou alterações.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_cycle_shifts BEFORE INSERT OR UPDATE ON shifts FOR EACH ROW EXECUTE FUNCTION check_cycle_status();
CREATE TRIGGER trg_check_cycle_days BEFORE INSERT OR UPDATE ON compensatory_days FOR EACH ROW EXECUTE FUNCTION check_cycle_status();
CREATE TRIGGER trg_check_cycle_requests BEFORE INSERT OR UPDATE ON purchase_requests FOR EACH ROW EXECUTE FUNCTION check_cycle_status();

-- 2.2 Controle de Saldo Concorrente (Solicitação de Compra)
CREATE OR REPLACE FUNCTION validar_solicitacao_compra() RETURNS TRIGGER AS $$
DECLARE
  v_saldo_financeiro DECIMAL;
  v_valor_comprometido DECIMAL;
  v_orcamento DECIMAL;
  
  v_planejado INTEGER;
  v_qtd_comprometida INTEGER;
BEGIN
  -- Apenas valida no INSERT ou se o status mudou para SOLICITADA/APROVADA
  IF (TG_OP = 'INSERT') OR (TG_OP = 'UPDATE' AND NEW.status IN ('SOLICITADA', 'APROVADA') AND OLD.status NOT IN ('SOLICITADA', 'APROVADA')) THEN
    
    -- Lock no orçamento (cycle_establishments)
    SELECT total_orcado INTO v_orcamento 
    FROM cycle_establishments 
    WHERE cycle_id = NEW.cycle_id AND establishment_id = NEW.establishment_id 
    FOR UPDATE;

    -- Soma do valor de todas as solicitações (SOLICITADA ou APROVADA)
    SELECT COALESCE(SUM(valor), 0) INTO v_valor_comprometido
    FROM purchase_requests
    WHERE cycle_id = NEW.cycle_id 
      AND establishment_id = NEW.establishment_id
      AND status IN ('SOLICITADA', 'APROVADA')
      AND id != NEW.id;
      
    IF (v_valor_comprometido + NEW.valor) > v_orcamento THEN
      RAISE EXCEPTION 'Saldo financeiro insuficiente. Orçamento: %, Comprometido: %, Tentativa: %', v_orcamento, v_valor_comprometido, NEW.valor;
    END IF;

    -- Lock e validação de quantidade por cargo
    SELECT quantidade_planejada INTO v_planejado
    FROM planning_limits pl
    JOIN cycle_establishments ce ON ce.id = pl.cycle_establishment_id
    WHERE ce.cycle_id = NEW.cycle_id AND ce.establishment_id = NEW.establishment_id AND pl.position_id = NEW.position_id
    FOR UPDATE;

    SELECT COUNT(*) INTO v_qtd_comprometida
    FROM purchase_requests
    WHERE cycle_id = NEW.cycle_id 
      AND establishment_id = NEW.establishment_id
      AND position_id = NEW.position_id
      AND status IN ('SOLICITADA', 'APROVADA')
      AND id != NEW.id;

    IF (v_qtd_comprometida + 1) > v_planejado THEN
      RAISE EXCEPTION 'Limite quantitativo para o cargo excedido. Planejado: %, Utilizado/Solicitado: %', v_planejado, v_qtd_comprometida;
    END IF;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validar_solicitacao BEFORE INSERT OR UPDATE ON purchase_requests FOR EACH ROW EXECUTE FUNCTION validar_solicitacao_compra();

-- =====================================================================================
-- 3. AUDITORIA (TRIGGER GENÉRICO)
-- =====================================================================================
CREATE OR REPLACE FUNCTION log_audit_event() RETURNS TRIGGER AS $$
DECLARE
  v_action VARCHAR(100);
BEGIN
  v_action := TG_OP;
  
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs (user_id, action, entity, entity_id, new_data)
    VALUES (auth.uid(), v_action, TG_TABLE_NAME, NEW.id, row_to_json(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_logs (user_id, action, entity, entity_id, old_data, new_data)
    VALUES (auth.uid(), v_action, TG_TABLE_NAME, NEW.id, row_to_json(OLD), row_to_json(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_logs (user_id, action, entity, entity_id, old_data)
    VALUES (auth.uid(), v_action, TG_TABLE_NAME, OLD.id, row_to_json(OLD));
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Anexar auditoria às tabelas
CREATE TRIGGER audit_cycles AFTER INSERT OR UPDATE OR DELETE ON cycles FOR EACH ROW EXECUTE FUNCTION log_audit_event();
CREATE TRIGGER audit_purchase_requests AFTER INSERT OR UPDATE OR DELETE ON purchase_requests FOR EACH ROW EXECUTE FUNCTION log_audit_event();
CREATE TRIGGER audit_compensatory_days AFTER INSERT OR UPDATE OR DELETE ON compensatory_days FOR EACH ROW EXECUTE FUNCTION log_audit_event();

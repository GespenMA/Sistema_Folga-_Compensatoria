-- =====================================================================================
-- 13. ADICIONAR AUDITORIA NAS TABELAS RESTANTES
-- =====================================================================================

-- Adiciona os triggers de auditoria nas tabelas que ainda não os possuíam

CREATE TRIGGER audit_profiles AFTER INSERT OR UPDATE OR DELETE ON profiles FOR EACH ROW EXECUTE FUNCTION log_audit_event();
CREATE TRIGGER audit_employees AFTER INSERT OR UPDATE OR DELETE ON employees FOR EACH ROW EXECUTE FUNCTION log_audit_event();
CREATE TRIGGER audit_shifts AFTER INSERT OR UPDATE OR DELETE ON shifts FOR EACH ROW EXECUTE FUNCTION log_audit_event();
CREATE TRIGGER audit_planning_limits AFTER INSERT OR UPDATE OR DELETE ON planning_limits FOR EACH ROW EXECUTE FUNCTION log_audit_event();
CREATE TRIGGER audit_position_values AFTER INSERT OR UPDATE OR DELETE ON position_values FOR EACH ROW EXECUTE FUNCTION log_audit_event();
CREATE TRIGGER audit_cycle_establishments AFTER INSERT OR UPDATE OR DELETE ON cycle_establishments FOR EACH ROW EXECUTE FUNCTION log_audit_event();
CREATE TRIGGER audit_establishments AFTER INSERT OR UPDATE OR DELETE ON establishments FOR EACH ROW EXECUTE FUNCTION log_audit_event();
CREATE TRIGGER audit_positions AFTER INSERT OR UPDATE OR DELETE ON positions FOR EACH ROW EXECUTE FUNCTION log_audit_event();

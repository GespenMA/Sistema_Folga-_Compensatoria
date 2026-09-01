-- =====================================================================================
-- Libera leitura (SOMENTE leitura) para o perfil GESTAO em employees/shifts/
-- compensatory_days/purchase_requests.
--
-- Hoje o RLS dessas 4 tabelas só libera: (a) is_admin() = perfil ADMIN, ou (b)
-- establishment_id = get_user_establishment(). Perfis GESTAO são cadastrados com
-- establishment_id = NULL (não pertencem a nenhuma unidade específica) e
-- "NULL = NULL" nunca é verdadeiro no Postgres — na prática, hoje GESTAO não
-- enxerga NENHUM servidor/plantão/folga/solicitação, mesmo tendo acesso às
-- páginas do admin (a UI já rotula esse perfil como "Gestão (Apenas Leitura)").
--
-- Aditivo e só-leitura por natureza: FOR SELECT nunca concede INSERT/UPDATE/DELETE.
-- Escrita continua exigindo is_admin() ou dono do estabelecimento, exatamente
-- como hoje — este perfil continua sem conseguir alterar nada em lugar nenhum.
-- =====================================================================================

CREATE OR REPLACE FUNCTION is_gestao()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (SELECT perfil = 'GESTAO' FROM profiles WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE POLICY "Gestao_select_employees" ON employees FOR SELECT USING (is_gestao());
CREATE POLICY "Gestao_select_shifts" ON shifts FOR SELECT USING (is_gestao());
CREATE POLICY "Gestao_select_compensatory_days" ON compensatory_days FOR SELECT USING (is_gestao());
CREATE POLICY "Gestao_select_purchase_requests" ON purchase_requests FOR SELECT USING (is_gestao());

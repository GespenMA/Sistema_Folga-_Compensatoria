-- =====================================================================================
-- 14. ADICIONAR REDEFINIÇÃO DE SENHA OBRIGATÓRIA
-- =====================================================================================

-- Adiciona a coluna na tabela de perfis
ALTER TABLE profiles ADD COLUMN must_change_password BOOLEAN DEFAULT TRUE;

-- Cria a função RPC para que o próprio usuário possa confirmar a troca
CREATE OR REPLACE FUNCTION mark_password_changed()
RETURNS void AS $$
BEGIN
  UPDATE profiles 
  SET must_change_password = false 
  WHERE id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

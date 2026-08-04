-- =====================================================================================
-- 11. TABELA DE TUTORIAIS EM VÍDEO
-- =====================================================================================

CREATE TABLE tutorials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  titulo VARCHAR(255) NOT NULL,
  descricao TEXT,
  youtube_url VARCHAR(500) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE tutorials ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
-- Permite leitura por qualquer usuário autenticado (estabelecimentos ou admins)
CREATE POLICY "Tutoriais visíveis para todos os usuários autenticados" 
  ON tutorials 
  FOR SELECT 
  USING (auth.role() = 'authenticated');

-- Permite inserção/edição/exclusão apenas para o perfil ADMIN
CREATE POLICY "Apenas ADMIN pode alterar tutoriais" 
  ON tutorials 
  FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
        AND perfil = 'ADMIN'
    )
  );

-- Função para atualizar o updated_at (caso não exista)
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para atualizar o updated_at
CREATE TRIGGER update_tutorials_modtime
  BEFORE UPDATE ON tutorials
  FOR EACH ROW
  EXECUTE FUNCTION update_modified_column();

-- Migração de Status de Folga Compensatória (Usufruto vs Indenização)

-- 1. Renomear os valores do ENUM existentes para a nova nomenclatura
ALTER TYPE folga_status_enum RENAME VALUE 'AGUARDANDO_DECISAO' TO 'INDENIZACAO_SOLICITADA';
ALTER TYPE folga_status_enum RENAME VALUE 'COMPRADA' TO 'INDENIZADA';
ALTER TYPE folga_status_enum RENAME VALUE 'UTILIZADA' TO 'USUFRUIDA';

-- 2. Adicionar colunas de controle para Usufruto
ALTER TABLE compensatory_days ADD COLUMN used_at DATE;
ALTER TABLE compensatory_days ADD COLUMN usage_registered_by UUID REFERENCES profiles(id);

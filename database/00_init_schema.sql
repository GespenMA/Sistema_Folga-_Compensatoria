-- =====================================================================================
-- 1. ENUMS
-- =====================================================================================
CREATE TYPE perfil_enum AS ENUM ('ADMIN', 'ESTABELECIMENTO');
CREATE TYPE ciclo_status_enum AS ENUM ('RASCUNHO', 'ABERTO', 'EM_ANALISE', 'FECHADO', 'REABERTO');
CREATE TYPE folga_status_enum AS ENUM ('GERADA', 'AGUARDANDO_DECISAO', 'UTILIZADA', 'COMPRADA', 'CANCELADA');
CREATE TYPE solicitacao_status_enum AS ENUM ('SOLICITADA', 'APROVADA', 'REJEITADA', 'CANCELADA');

-- =====================================================================================
-- 2. TABELAS
-- =====================================================================================

-- 2.1 Establishments
CREATE TABLE establishments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(255) NOT NULL,
    localizacao VARCHAR(100),
    complexidade VARCHAR(100),
    ativo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2.2 Profiles
CREATE TABLE profiles (
    id UUID PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    perfil perfil_enum NOT NULL,
    establishment_id UUID REFERENCES establishments(id) ON DELETE SET NULL,
    ativo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2.3 Cycles
CREATE TABLE cycles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(50) NOT NULL,
    mes INTEGER NOT NULL,
    ano INTEGER NOT NULL,
    data_inicio DATE NOT NULL,
    data_fim DATE NOT NULL,
    status ciclo_status_enum DEFAULT 'RASCUNHO',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    opened_at TIMESTAMP WITH TIME ZONE,
    opened_by UUID REFERENCES profiles(id),
    closed_at TIMESTAMP WITH TIME ZONE,
    closed_by UUID REFERENCES profiles(id),
    reopened_at TIMESTAMP WITH TIME ZONE,
    reopened_by UUID REFERENCES profiles(id),
    reopened_count INTEGER DEFAULT 0
);

-- 2.4 Cycle Establishments
CREATE TABLE cycle_establishments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cycle_id UUID REFERENCES cycles(id) ON DELETE CASCADE,
    establishment_id UUID REFERENCES establishments(id) ON DELETE CASCADE,
    total_orcado DECIMAL(12,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (cycle_id, establishment_id)
);

-- 2.5 Positions
CREATE TABLE positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(100) NOT NULL,
    codigo VARCHAR(50) NOT NULL UNIQUE,
    ativo BOOLEAN DEFAULT TRUE
);

-- 2.6 Position Values
CREATE TABLE position_values (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    position_id UUID REFERENCES positions(id) ON DELETE CASCADE,
    valor DECIMAL(10,2) NOT NULL,
    vigencia_inicio DATE NOT NULL,
    vigencia_fim DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2.7 Planning Limits
CREATE TABLE planning_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cycle_establishment_id UUID REFERENCES cycle_establishments(id) ON DELETE CASCADE,
    position_id UUID REFERENCES positions(id) ON DELETE CASCADE,
    quantidade_planejada INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(cycle_establishment_id, position_id)
);

-- 2.8 Employees
CREATE TABLE employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    establishment_id UUID REFERENCES establishments(id) ON DELETE CASCADE,
    matricula VARCHAR(50) NOT NULL,
    nome VARCHAR(255) NOT NULL,
    data_admissao DATE NOT NULL,
    position_id UUID REFERENCES positions(id) ON DELETE RESTRICT,
    ativo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(establishment_id, matricula)
);

-- 2.9 Shifts
CREATE TABLE shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    cycle_id UUID REFERENCES cycles(id) ON DELETE RESTRICT,
    periodo_inicio DATE NOT NULL,
    periodo_fim DATE NOT NULL,
    quantidade_plantoes INTEGER NOT NULL,
    observacao TEXT,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2.10 Compensatory Days
CREATE TABLE compensatory_days (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    cycle_id UUID REFERENCES cycles(id) ON DELETE RESTRICT,
    shift_id UUID REFERENCES shifts(id) ON DELETE RESTRICT,
    periodo_inicio DATE NOT NULL,
    periodo_fim DATE NOT NULL,
    quantidade_plantoes INTEGER NOT NULL,
    status folga_status_enum DEFAULT 'GERADA',
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    generated_by UUID REFERENCES profiles(id),
    decided_at TIMESTAMP WITH TIME ZONE,
    decided_by UUID REFERENCES profiles(id)
);

-- 2.11 Purchase Requests
CREATE TABLE purchase_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    compensatory_day_id UUID REFERENCES compensatory_days(id) ON DELETE CASCADE UNIQUE,
    establishment_id UUID REFERENCES establishments(id) ON DELETE RESTRICT,
    cycle_id UUID REFERENCES cycles(id) ON DELETE RESTRICT,
    employee_id UUID REFERENCES employees(id) ON DELETE RESTRICT,
    position_id UUID REFERENCES positions(id) ON DELETE RESTRICT,
    valor DECIMAL(10,2) NOT NULL,
    valor_historico_id UUID REFERENCES position_values(id) ON DELETE RESTRICT,
    justificativa TEXT NOT NULL CHECK (char_length(justificativa) >= 50 AND char_length(justificativa) <= 2000),
    status solicitacao_status_enum DEFAULT 'SOLICITADA',
    requested_by UUID REFERENCES profiles(id),
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    analyzed_by UUID REFERENCES profiles(id),
    analyzed_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    cancelled_by UUID REFERENCES profiles(id),
    cancelled_at TIMESTAMP WITH TIME ZONE,
    cancellation_reason TEXT
);

-- 2.12 Audit Logs
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id),
    action VARCHAR(100) NOT NULL,
    entity VARCHAR(100) NOT NULL,
    entity_id UUID,
    old_data JSONB,
    new_data JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================================================
-- 3. ÍNDICES
-- =====================================================================================
CREATE INDEX idx_purchase_requests_cycle_establishment ON purchase_requests(cycle_id, establishment_id);
CREATE INDEX idx_purchase_requests_status ON purchase_requests(status);
CREATE INDEX idx_shifts_employee_cycle ON shifts(employee_id, cycle_id);
CREATE INDEX idx_compensatory_days_employee_cycle ON compensatory_days(employee_id, cycle_id);
CREATE INDEX idx_compensatory_days_period ON compensatory_days(employee_id, periodo_inicio, periodo_fim);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity, entity_id, created_at DESC);
CREATE INDEX idx_employees_establishment ON employees(establishment_id, matricula);

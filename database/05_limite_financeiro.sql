-- 05_limite_financeiro.sql
-- Trava rigorosa para impedir que uma Unidade Penal ultrapasse o Orçamento financeiro

CREATE OR REPLACE FUNCTION check_establishment_financial_limit()
RETURNS TRIGGER AS $$
DECLARE
    v_total_orcado DECIMAL(10,2);
    v_total_gasto DECIMAL(10,2);
BEGIN
    -- Só faz a checagem se o status estiver mudando para APROVADA
    IF NEW.status = 'APROVADA' AND (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.status != 'APROVADA')) THEN
        
        -- 1. Buscar o orçamento estipulado para a unidade no ciclo
        SELECT COALESCE(total_orcado, 0) INTO v_total_orcado
        FROM cycle_establishments
        WHERE cycle_id = NEW.cycle_id 
          AND establishment_id = NEW.establishment_id;
          
        IF NOT FOUND THEN
            RAISE EXCEPTION 'A unidade não possui orçamento configurado para este ciclo.';
        END IF;

        -- 2. Calcular o valor total já gasto (somando apenas solicitações APROVADAS)
        SELECT COALESCE(SUM(valor), 0) INTO v_total_gasto
        FROM purchase_requests
        WHERE cycle_id = NEW.cycle_id
          AND establishment_id = NEW.establishment_id
          AND status = 'APROVADA'
          AND id != NEW.id; -- Ignora a si mesmo em caso de update

        -- 3. Verificar se o novo valor vai estourar o limite
        IF (v_total_gasto + NEW.valor) > v_total_orcado THEN
            RAISE EXCEPTION 'ORCAMENTO_EXCEDIDO: Não é possível aprovar esta folga. O orçamento restante é de R$ %', (v_total_orcado - v_total_gasto);
        END IF;

    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Remove o trigger se ele já existir (para evitar duplicação)
DROP TRIGGER IF EXISTS trigger_check_financial_limit ON purchase_requests;

-- Aplica o trigger na tabela purchase_requests
CREATE TRIGGER trigger_check_financial_limit
BEFORE INSERT OR UPDATE ON purchase_requests
FOR EACH ROW
EXECUTE FUNCTION check_establishment_financial_limit();

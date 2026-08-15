-- =====================================================================================
-- CORREÇÃO DE SEGURANÇA: valida que o `valor` enviado pelo cliente numa solicitação de
-- compra confere com o valor oficial do cargo (position_values), em vez de confiar
-- cegamente no número que o navegador envia.
--
-- Antes: validar_solicitacao_compra() só checava se NEW.valor cabia no orçamento restante,
-- nunca se NEW.valor era o valor CORRETO. Um cliente ESTABELECIMENTO podia enviar um valor
-- artificialmente baixo e o trigger aceitava, desde que coubesse no orçamento.
--
-- Agora: recalcula o valor esperado a partir da linha de position_values referenciada em
-- NEW.valor_historico_id (a mesma que o frontend já usa para montar NEW.valor) multiplicada
-- pela quantidade de plantões (compensatory_days.quantidade_plantoes para Folga Compensatória,
-- 1 para Plantão Plus, que não tem quantidade). Não recalcula pelo "preço atual" do cargo,
-- pois position_values é versionado por vigência e o preço pode ter mudado desde o pedido.
--
-- Continua rodando só nos mesmos casos de antes (INSERT, ou UPDATE que reativa uma
-- solicitação REJEITADA/CANCELADA de volta para SOLICITADA/APROVADA) — aprovar uma
-- solicitação já SOLICITADA não passa por aqui, pois não altera valor/valor_historico_id.
-- =====================================================================================

CREATE OR REPLACE FUNCTION validar_solicitacao_compra() RETURNS TRIGGER AS $$
DECLARE
  v_saldo_financeiro DECIMAL;
  v_valor_comprometido DECIMAL;
  v_orcamento DECIMAL;

  v_planejado INTEGER;
  v_qtd_comprometida INTEGER;

  v_valor_unitario DECIMAL;
  v_qtd_plantoes INTEGER;
  v_valor_esperado DECIMAL;
BEGIN
  -- Apenas valida no INSERT ou se o status mudou para SOLICITADA/APROVADA
  IF (TG_OP = 'INSERT') OR (TG_OP = 'UPDATE' AND NEW.status IN ('SOLICITADA', 'APROVADA') AND OLD.status NOT IN ('SOLICITADA', 'APROVADA')) THEN

    -- Confere se o valor enviado bate com o valor oficial do cargo referenciado
    SELECT valor INTO v_valor_unitario
    FROM position_values
    WHERE id = NEW.valor_historico_id
      AND position_id = NEW.position_id;

    IF v_valor_unitario IS NULL THEN
      RAISE EXCEPTION 'Referência de valor histórico inválida ou não corresponde ao cargo informado.';
    END IF;

    IF NEW.compensatory_day_id IS NOT NULL THEN
      SELECT quantidade_plantoes INTO v_qtd_plantoes
      FROM compensatory_days
      WHERE id = NEW.compensatory_day_id;
    ELSE
      v_qtd_plantoes := 1;
    END IF;

    v_valor_esperado := v_valor_unitario * COALESCE(v_qtd_plantoes, 1);

    IF NEW.valor <> v_valor_esperado THEN
      RAISE EXCEPTION 'Valor da solicitação não confere com o valor oficial do cargo (esperado: %, informado: %).', v_valor_esperado, NEW.valor;
    END IF;

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

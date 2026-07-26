-- SCRIPT GERADO AUTOMATICAMENTE PARA ATUALIZAR O ORÇAMENTO E LIMITES PLANEJADOS

DO $$
DECLARE
  v_cycle_id UUID;
  v_est_id UUID;
  v_ce_id UUID;
  v_insp_id UUID;
  v_apt_id UUID;
  v_asp_id UUID;
BEGIN
  -- Pegar IDs base
  SELECT id INTO v_insp_id FROM positions WHERE codigo = 'INSP';
  SELECT id INTO v_apt_id FROM positions WHERE codigo = 'APT';
  SELECT id INTO v_asp_id FROM positions WHERE codigo = 'ASP';
  -- Pegar o ciclo mais recente que NÃO está fechado
  SELECT id INTO v_cycle_id FROM cycles WHERE status IN ('RASCUNHO', 'ABERTO', 'REABERTO') ORDER BY created_at DESC LIMIT 1;
  IF v_cycle_id IS NULL THEN
    RAISE EXCEPTION 'Nenhum ciclo aberto ou em rascunho encontrado!';
  END IF;

  -- ==========================================
  -- Unidade: CAAE de São Luís
  -- ==========================================
  SELECT id INTO v_est_id FROM establishments WHERE nome ILIKE 'CAAE de São Luís';
  IF v_est_id IS NULL THEN
    INSERT INTO establishments (nome, localizacao, complexidade, tipo) VALUES ('CAAE de São Luís', 'Capital', 'Especial', 'Unidade prisional') RETURNING id INTO v_est_id;
  END IF;

  SELECT id INTO v_ce_id FROM cycle_establishments WHERE cycle_id = v_cycle_id AND establishment_id = v_est_id;
  IF v_ce_id IS NULL THEN
    INSERT INTO cycle_establishments (cycle_id, establishment_id, total_orcado) VALUES (v_cycle_id, v_est_id, 7132.49) RETURNING id INTO v_ce_id;
  ELSE
    UPDATE cycle_establishments SET total_orcado = 7132.49 WHERE id = v_ce_id;
  END IF;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_insp_id, 8)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_apt_id, 0)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_asp_id, 11)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  -- ==========================================
  -- Unidade: COCT de São Luís
  -- ==========================================
  SELECT id INTO v_est_id FROM establishments WHERE nome ILIKE 'COCT de São Luís';
  IF v_est_id IS NULL THEN
    INSERT INTO establishments (nome, localizacao, complexidade, tipo) VALUES ('COCT de São Luís', 'Capital - Complexo', 'Especial', 'Unidade prisional') RETURNING id INTO v_est_id;
  END IF;

  SELECT id INTO v_ce_id FROM cycle_establishments WHERE cycle_id = v_cycle_id AND establishment_id = v_est_id;
  IF v_ce_id IS NULL THEN
    INSERT INTO cycle_establishments (cycle_id, establishment_id, total_orcado) VALUES (v_cycle_id, v_est_id, 10622.199999999999) RETURNING id INTO v_ce_id;
  ELSE
    UPDATE cycle_establishments SET total_orcado = 10622.199999999999 WHERE id = v_ce_id;
  END IF;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_insp_id, 2)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_apt_id, 20)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_asp_id, 20)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  -- ==========================================
  -- Unidade: Grupo Especial de Operação Penitenciárias - GEOP
  -- ==========================================
  SELECT id INTO v_est_id FROM establishments WHERE nome ILIKE 'Grupo Especial de Operação Penitenciárias - GEOP';
  IF v_est_id IS NULL THEN
    INSERT INTO establishments (nome, localizacao, complexidade, tipo) VALUES ('Grupo Especial de Operação Penitenciárias - GEOP', 'Capital - Apoio', 'Apoio', 'Unidade de apoio') RETURNING id INTO v_est_id;
  END IF;

  SELECT id INTO v_ce_id FROM cycle_establishments WHERE cycle_id = v_cycle_id AND establishment_id = v_est_id;
  IF v_ce_id IS NULL THEN
    INSERT INTO cycle_establishments (cycle_id, establishment_id, total_orcado) VALUES (v_cycle_id, v_est_id, 25570.7) RETURNING id INTO v_ce_id;
  ELSE
    UPDATE cycle_establishments SET total_orcado = 25570.7 WHERE id = v_ce_id;
  END IF;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_insp_id, 37)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_apt_id, 0)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_asp_id, 0)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  -- ==========================================
  -- Unidade: Grupo Tático de Escolta - GTE
  -- ==========================================
  SELECT id INTO v_est_id FROM establishments WHERE nome ILIKE 'Grupo Tático de Escolta - GTE';
  IF v_est_id IS NULL THEN
    INSERT INTO establishments (nome, localizacao, complexidade, tipo) VALUES ('Grupo Tático de Escolta - GTE', 'Capital - Apoio', 'Apoio', 'Unidade de apoio') RETURNING id INTO v_est_id;
  END IF;

  SELECT id INTO v_ce_id FROM cycle_establishments WHERE cycle_id = v_cycle_id AND establishment_id = v_est_id;
  IF v_ce_id IS NULL THEN
    INSERT INTO cycle_establishments (cycle_id, establishment_id, total_orcado) VALUES (v_cycle_id, v_est_id, 40071.06) RETURNING id INTO v_ce_id;
  ELSE
    UPDATE cycle_establishments SET total_orcado = 40071.06 WHERE id = v_ce_id;
  END IF;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_insp_id, 23)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_apt_id, 70)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_asp_id, 14)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  -- ==========================================
  -- Unidade: Penitenciária Regional de Bacabal
  -- ==========================================
  SELECT id INTO v_est_id FROM establishments WHERE nome ILIKE 'Penitenciária Regional de Bacabal';
  IF v_est_id IS NULL THEN
    INSERT INTO establishments (nome, localizacao, complexidade, tipo) VALUES ('Penitenciária Regional de Bacabal', 'Interior', 'Alta Complexidade', 'Unidade prisional') RETURNING id INTO v_est_id;
  END IF;

  SELECT id INTO v_ce_id FROM cycle_establishments WHERE cycle_id = v_cycle_id AND establishment_id = v_est_id;
  IF v_ce_id IS NULL THEN
    INSERT INTO cycle_establishments (cycle_id, establishment_id, total_orcado) VALUES (v_cycle_id, v_est_id, 21842.6) RETURNING id INTO v_ce_id;
  ELSE
    UPDATE cycle_establishments SET total_orcado = 21842.6 WHERE id = v_ce_id;
  END IF;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_insp_id, 8)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_apt_id, 29)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_asp_id, 49)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  -- ==========================================
  -- Unidade: Penitenciária Regional de Brejo
  -- ==========================================
  SELECT id INTO v_est_id FROM establishments WHERE nome ILIKE 'Penitenciária Regional de Brejo';
  IF v_est_id IS NULL THEN
    INSERT INTO establishments (nome, localizacao, complexidade, tipo) VALUES ('Penitenciária Regional de Brejo', 'Interior', 'Média Alta Complexidade', 'Unidade prisional') RETURNING id INTO v_est_id;
  END IF;

  SELECT id INTO v_ce_id FROM cycle_establishments WHERE cycle_id = v_cycle_id AND establishment_id = v_est_id;
  IF v_ce_id IS NULL THEN
    INSERT INTO cycle_establishments (cycle_id, establishment_id, total_orcado) VALUES (v_cycle_id, v_est_id, 19405.82) RETURNING id INTO v_ce_id;
  ELSE
    UPDATE cycle_establishments SET total_orcado = 19405.82 WHERE id = v_ce_id;
  END IF;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_insp_id, 5)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_apt_id, 32)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_asp_id, 40)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  -- ==========================================
  -- Unidade: Penitenciária Regional de Governador Nunes Freire
  -- ==========================================
  SELECT id INTO v_est_id FROM establishments WHERE nome ILIKE 'Penitenciária Regional de Governador Nunes Freire';
  IF v_est_id IS NULL THEN
    INSERT INTO establishments (nome, localizacao, complexidade, tipo) VALUES ('Penitenciária Regional de Governador Nunes Freire', 'Interior', 'Média Alta Complexidade', 'Unidade prisional') RETURNING id INTO v_est_id;
  END IF;

  SELECT id INTO v_ce_id FROM cycle_establishments WHERE cycle_id = v_cycle_id AND establishment_id = v_est_id;
  IF v_ce_id IS NULL THEN
    INSERT INTO cycle_establishments (cycle_id, establishment_id, total_orcado) VALUES (v_cycle_id, v_est_id, 17273.84) RETURNING id INTO v_ce_id;
  ELSE
    UPDATE cycle_establishments SET total_orcado = 17273.84 WHERE id = v_ce_id;
  END IF;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_insp_id, 1)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_apt_id, 34)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_asp_id, 40)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  -- ==========================================
  -- Unidade: Penitenciária Regional de Imperatriz
  -- ==========================================
  SELECT id INTO v_est_id FROM establishments WHERE nome ILIKE 'Penitenciária Regional de Imperatriz';
  IF v_est_id IS NULL THEN
    INSERT INTO establishments (nome, localizacao, complexidade, tipo) VALUES ('Penitenciária Regional de Imperatriz', 'Interior', 'Média Alta Complexidade', 'Unidade prisional') RETURNING id INTO v_est_id;
  END IF;

  SELECT id INTO v_ce_id FROM cycle_establishments WHERE cycle_id = v_cycle_id AND establishment_id = v_est_id;
  IF v_ce_id IS NULL THEN
    INSERT INTO cycle_establishments (cycle_id, establishment_id, total_orcado) VALUES (v_cycle_id, v_est_id, 23319.35) RETURNING id INTO v_ce_id;
  ELSE
    UPDATE cycle_establishments SET total_orcado = 23319.35 WHERE id = v_ce_id;
  END IF;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_insp_id, 17)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_apt_id, 14)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_asp_id, 49)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  -- ==========================================
  -- Unidade: Penitenciária Regional de Pedreiras
  -- ==========================================
  SELECT id INTO v_est_id FROM establishments WHERE nome ILIKE 'Penitenciária Regional de Pedreiras';
  IF v_est_id IS NULL THEN
    INSERT INTO establishments (nome, localizacao, complexidade, tipo) VALUES ('Penitenciária Regional de Pedreiras', 'Interior', 'Média Alta Complexidade', 'Unidade prisional') RETURNING id INTO v_est_id;
  END IF;

  SELECT id INTO v_ce_id FROM cycle_establishments WHERE cycle_id = v_cycle_id AND establishment_id = v_est_id;
  IF v_ce_id IS NULL THEN
    INSERT INTO cycle_establishments (cycle_id, establishment_id, total_orcado) VALUES (v_cycle_id, v_est_id, 19362.18) RETURNING id INTO v_ce_id;
  ELSE
    UPDATE cycle_establishments SET total_orcado = 19362.18 WHERE id = v_ce_id;
  END IF;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_insp_id, 8)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_apt_id, 23)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_asp_id, 45)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  -- ==========================================
  -- Unidade: Penitenciária Regional de Pinheiro
  -- ==========================================
  SELECT id INTO v_est_id FROM establishments WHERE nome ILIKE 'Penitenciária Regional de Pinheiro';
  IF v_est_id IS NULL THEN
    INSERT INTO establishments (nome, localizacao, complexidade, tipo) VALUES ('Penitenciária Regional de Pinheiro', 'Interior', 'Alta Complexidade', 'Unidade prisional') RETURNING id INTO v_est_id;
  END IF;

  SELECT id INTO v_ce_id FROM cycle_establishments WHERE cycle_id = v_cycle_id AND establishment_id = v_est_id;
  IF v_ce_id IS NULL THEN
    INSERT INTO cycle_establishments (cycle_id, establishment_id, total_orcado) VALUES (v_cycle_id, v_est_id, 19436.059999999998) RETURNING id INTO v_ce_id;
  ELSE
    UPDATE cycle_establishments SET total_orcado = 19436.059999999998 WHERE id = v_ce_id;
  END IF;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_insp_id, 1)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_apt_id, 33)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_asp_id, 57)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  -- ==========================================
  -- Unidade: Penitenciária Regional de São Luís
  -- ==========================================
  SELECT id INTO v_est_id FROM establishments WHERE nome ILIKE 'Penitenciária Regional de São Luís';
  IF v_est_id IS NULL THEN
    INSERT INTO establishments (nome, localizacao, complexidade, tipo) VALUES ('Penitenciária Regional de São Luís', 'Capital - Complexo', 'Alta Complexidade', 'Unidade prisional') RETURNING id INTO v_est_id;
  END IF;

  SELECT id INTO v_ce_id FROM cycle_establishments WHERE cycle_id = v_cycle_id AND establishment_id = v_est_id;
  IF v_ce_id IS NULL THEN
    INSERT INTO cycle_establishments (cycle_id, establishment_id, total_orcado) VALUES (v_cycle_id, v_est_id, 24944.2) RETURNING id INTO v_ce_id;
  ELSE
    UPDATE cycle_establishments SET total_orcado = 24944.2 WHERE id = v_ce_id;
  END IF;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_insp_id, 2)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_apt_id, 51)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_asp_id, 51)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  -- ==========================================
  -- Unidade: Penitenciária Regional de Timon
  -- ==========================================
  SELECT id INTO v_est_id FROM establishments WHERE nome ILIKE 'Penitenciária Regional de Timon';
  IF v_est_id IS NULL THEN
    INSERT INTO establishments (nome, localizacao, complexidade, tipo) VALUES ('Penitenciária Regional de Timon', 'Interior', 'Média Alta Complexidade', 'Unidade prisional') RETURNING id INTO v_est_id;
  END IF;

  SELECT id INTO v_ce_id FROM cycle_establishments WHERE cycle_id = v_cycle_id AND establishment_id = v_est_id;
  IF v_ce_id IS NULL THEN
    INSERT INTO cycle_establishments (cycle_id, establishment_id, total_orcado) VALUES (v_cycle_id, v_est_id, 31695.86) RETURNING id INTO v_ce_id;
  ELSE
    UPDATE cycle_establishments SET total_orcado = 31695.86 WHERE id = v_ce_id;
  END IF;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_insp_id, 30)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_apt_id, 13)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_asp_id, 47)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  -- ==========================================
  -- Unidade: Supervisão de Segurabça Interna - SSI
  -- ==========================================
  SELECT id INTO v_est_id FROM establishments WHERE nome ILIKE 'Supervisão de Segurabça Interna - SSI';
  IF v_est_id IS NULL THEN
    INSERT INTO establishments (nome, localizacao, complexidade, tipo) VALUES ('Supervisão de Segurabça Interna - SSI', 'Capital - Apoio', 'Apoio', 'Unidade de apoio') RETURNING id INTO v_est_id;
  END IF;

  SELECT id INTO v_ce_id FROM cycle_establishments WHERE cycle_id = v_cycle_id AND establishment_id = v_est_id;
  IF v_ce_id IS NULL THEN
    INSERT INTO cycle_establishments (cycle_id, establishment_id, total_orcado) VALUES (v_cycle_id, v_est_id, 165428.43) RETURNING id INTO v_ce_id;
  ELSE
    UPDATE cycle_establishments SET total_orcado = 165428.43 WHERE id = v_ce_id;
  END IF;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_insp_id, 12)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_apt_id, 360)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_asp_id, 297)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  -- ==========================================
  -- Unidade: UPR de Açailândia
  -- ==========================================
  SELECT id INTO v_est_id FROM establishments WHERE nome ILIKE 'UPR de Açailândia';
  IF v_est_id IS NULL THEN
    INSERT INTO establishments (nome, localizacao, complexidade, tipo) VALUES ('UPR de Açailândia', 'Interior', 'Média Alta Complexidade', 'Unidade prisional') RETURNING id INTO v_est_id;
  END IF;

  SELECT id INTO v_ce_id FROM cycle_establishments WHERE cycle_id = v_cycle_id AND establishment_id = v_est_id;
  IF v_ce_id IS NULL THEN
    INSERT INTO cycle_establishments (cycle_id, establishment_id, total_orcado) VALUES (v_cycle_id, v_est_id, 12384.9) RETURNING id INTO v_ce_id;
  ELSE
    UPDATE cycle_establishments SET total_orcado = 12384.9 WHERE id = v_ce_id;
  END IF;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_insp_id, 1)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_apt_id, 19)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_asp_id, 39)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  -- ==========================================
  -- Unidade: UPR de Balsas
  -- ==========================================
  SELECT id INTO v_est_id FROM establishments WHERE nome ILIKE 'UPR de Balsas';
  IF v_est_id IS NULL THEN
    INSERT INTO establishments (nome, localizacao, complexidade, tipo) VALUES ('UPR de Balsas', 'Interior', 'Média Alta Complexidade', 'Unidade prisional') RETURNING id INTO v_est_id;
  END IF;

  SELECT id INTO v_ce_id FROM cycle_establishments WHERE cycle_id = v_cycle_id AND establishment_id = v_est_id;
  IF v_ce_id IS NULL THEN
    INSERT INTO cycle_establishments (cycle_id, establishment_id, total_orcado) VALUES (v_cycle_id, v_est_id, 10357.06) RETURNING id INTO v_ce_id;
  ELSE
    UPDATE cycle_establishments SET total_orcado = 10357.06 WHERE id = v_ce_id;
  END IF;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_insp_id, 0)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_apt_id, 18)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_asp_id, 32)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  -- ==========================================
  -- Unidade: UPR de Barra do Corda
  -- ==========================================
  SELECT id INTO v_est_id FROM establishments WHERE nome ILIKE 'UPR de Barra do Corda';
  IF v_est_id IS NULL THEN
    INSERT INTO establishments (nome, localizacao, complexidade, tipo) VALUES ('UPR de Barra do Corda', 'Interior', 'Baixa Complexidade', 'Unidade prisional') RETURNING id INTO v_est_id;
  END IF;

  SELECT id INTO v_ce_id FROM cycle_establishments WHERE cycle_id = v_cycle_id AND establishment_id = v_est_id;
  IF v_ce_id IS NULL THEN
    INSERT INTO cycle_establishments (cycle_id, establishment_id, total_orcado) VALUES (v_cycle_id, v_est_id, 6876.9400000000005) RETURNING id INTO v_ce_id;
  ELSE
    UPDATE cycle_establishments SET total_orcado = 6876.9400000000005 WHERE id = v_ce_id;
  END IF;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_insp_id, 2)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_apt_id, 10)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_asp_id, 16)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  -- ==========================================
  -- Unidade: UPR de Caxias
  -- ==========================================
  SELECT id INTO v_est_id FROM establishments WHERE nome ILIKE 'UPR de Caxias';
  IF v_est_id IS NULL THEN
    INSERT INTO establishments (nome, localizacao, complexidade, tipo) VALUES ('UPR de Caxias', 'Interior', 'Média Complexidade', 'Unidade prisional') RETURNING id INTO v_est_id;
  END IF;

  SELECT id INTO v_ce_id FROM cycle_establishments WHERE cycle_id = v_cycle_id AND establishment_id = v_est_id;
  IF v_ce_id IS NULL THEN
    INSERT INTO cycle_establishments (cycle_id, establishment_id, total_orcado) VALUES (v_cycle_id, v_est_id, 19540.04) RETURNING id INTO v_ce_id;
  ELSE
    UPDATE cycle_establishments SET total_orcado = 19540.04 WHERE id = v_ce_id;
  END IF;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_insp_id, 16)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_apt_id, 7)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_asp_id, 43)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  -- ==========================================
  -- Unidade: UPR de Chapadinha
  -- ==========================================
  SELECT id INTO v_est_id FROM establishments WHERE nome ILIKE 'UPR de Chapadinha';
  IF v_est_id IS NULL THEN
    INSERT INTO establishments (nome, localizacao, complexidade, tipo) VALUES ('UPR de Chapadinha', 'Interior', 'Média Complexidade', 'Unidade prisional') RETURNING id INTO v_est_id;
  END IF;

  SELECT id INTO v_ce_id FROM cycle_establishments WHERE cycle_id = v_cycle_id AND establishment_id = v_est_id;
  IF v_ce_id IS NULL THEN
    INSERT INTO cycle_establishments (cycle_id, establishment_id, total_orcado) VALUES (v_cycle_id, v_est_id, 16273.97) RETURNING id INTO v_ce_id;
  ELSE
    UPDATE cycle_establishments SET total_orcado = 16273.97 WHERE id = v_ce_id;
  END IF;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_insp_id, 8)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_apt_id, 16)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_asp_id, 39)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  -- ==========================================
  -- Unidade: UPR de Codó
  -- ==========================================
  SELECT id INTO v_est_id FROM establishments WHERE nome ILIKE 'UPR de Codó';
  IF v_est_id IS NULL THEN
    INSERT INTO establishments (nome, localizacao, complexidade, tipo) VALUES ('UPR de Codó', 'Interior', 'Média Complexidade', 'Unidade prisional') RETURNING id INTO v_est_id;
  END IF;

  SELECT id INTO v_ce_id FROM cycle_establishments WHERE cycle_id = v_cycle_id AND establishment_id = v_est_id;
  IF v_ce_id IS NULL THEN
    INSERT INTO cycle_establishments (cycle_id, establishment_id, total_orcado) VALUES (v_cycle_id, v_est_id, 13856.029999999999) RETURNING id INTO v_ce_id;
  ELSE
    UPDATE cycle_establishments SET total_orcado = 13856.029999999999 WHERE id = v_ce_id;
  END IF;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_insp_id, 7)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_apt_id, 11)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_asp_id, 38)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  -- ==========================================
  -- Unidade: UPR de Colinas
  -- ==========================================
  SELECT id INTO v_est_id FROM establishments WHERE nome ILIKE 'UPR de Colinas';
  IF v_est_id IS NULL THEN
    INSERT INTO establishments (nome, localizacao, complexidade, tipo) VALUES ('UPR de Colinas', 'Interior', 'Baixa Complexidade', 'Unidade prisional') RETURNING id INTO v_est_id;
  END IF;

  SELECT id INTO v_ce_id FROM cycle_establishments WHERE cycle_id = v_cycle_id AND establishment_id = v_est_id;
  IF v_ce_id IS NULL THEN
    INSERT INTO cycle_establishments (cycle_id, establishment_id, total_orcado) VALUES (v_cycle_id, v_est_id, 8437.16) RETURNING id INTO v_ce_id;
  ELSE
    UPDATE cycle_establishments SET total_orcado = 8437.16 WHERE id = v_ce_id;
  END IF;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_insp_id, 0)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_apt_id, 17)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_asp_id, 21)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  -- ==========================================
  -- Unidade: UPR de Coroatá
  -- ==========================================
  SELECT id INTO v_est_id FROM establishments WHERE nome ILIKE 'UPR de Coroatá';
  IF v_est_id IS NULL THEN
    INSERT INTO establishments (nome, localizacao, complexidade, tipo) VALUES ('UPR de Coroatá', 'Interior', 'Média Alta Complexidade', 'Unidade prisional') RETURNING id INTO v_est_id;
  END IF;

  SELECT id INTO v_ce_id FROM cycle_establishments WHERE cycle_id = v_cycle_id AND establishment_id = v_est_id;
  IF v_ce_id IS NULL THEN
    INSERT INTO cycle_establishments (cycle_id, establishment_id, total_orcado) VALUES (v_cycle_id, v_est_id, 16910.19) RETURNING id INTO v_ce_id;
  ELSE
    UPDATE cycle_establishments SET total_orcado = 16910.19 WHERE id = v_ce_id;
  END IF;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_insp_id, 6)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_apt_id, 21)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_asp_id, 42)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  -- ==========================================
  -- Unidade: UPR de Davinópolis
  -- ==========================================
  SELECT id INTO v_est_id FROM establishments WHERE nome ILIKE 'UPR de Davinópolis';
  IF v_est_id IS NULL THEN
    INSERT INTO establishments (nome, localizacao, complexidade, tipo) VALUES ('UPR de Davinópolis', 'Interior', 'Baixa Complexidade', 'Unidade prisional') RETURNING id INTO v_est_id;
  END IF;

  SELECT id INTO v_ce_id FROM cycle_establishments WHERE cycle_id = v_cycle_id AND establishment_id = v_est_id;
  IF v_ce_id IS NULL THEN
    INSERT INTO cycle_establishments (cycle_id, establishment_id, total_orcado) VALUES (v_cycle_id, v_est_id, 11021.55) RETURNING id INTO v_ce_id;
  ELSE
    UPDATE cycle_establishments SET total_orcado = 11021.55 WHERE id = v_ce_id;
  END IF;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_insp_id, 8)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_apt_id, 4)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_asp_id, 29)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  -- ==========================================
  -- Unidade: UPR de Godofredo Viana
  -- ==========================================
  SELECT id INTO v_est_id FROM establishments WHERE nome ILIKE 'UPR de Godofredo Viana';
  IF v_est_id IS NULL THEN
    INSERT INTO establishments (nome, localizacao, complexidade, tipo) VALUES ('UPR de Godofredo Viana', 'Interior', 'Baixa Complexidade', 'Unidade prisional') RETURNING id INTO v_est_id;
  END IF;

  SELECT id INTO v_ce_id FROM cycle_establishments WHERE cycle_id = v_cycle_id AND establishment_id = v_est_id;
  IF v_ce_id IS NULL THEN
    INSERT INTO cycle_establishments (cycle_id, establishment_id, total_orcado) VALUES (v_cycle_id, v_est_id, 6452.789999999999) RETURNING id INTO v_ce_id;
  ELSE
    UPDATE cycle_establishments SET total_orcado = 6452.789999999999 WHERE id = v_ce_id;
  END IF;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_insp_id, 1)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_apt_id, 9)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_asp_id, 20)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  -- ==========================================
  -- Unidade: UPR de Grajaú
  -- ==========================================
  SELECT id INTO v_est_id FROM establishments WHERE nome ILIKE 'UPR de Grajaú';
  IF v_est_id IS NULL THEN
    INSERT INTO establishments (nome, localizacao, complexidade, tipo) VALUES ('UPR de Grajaú', 'Interior', 'Baixa Complexidade', 'Unidade prisional') RETURNING id INTO v_est_id;
  END IF;

  SELECT id INTO v_ce_id FROM cycle_establishments WHERE cycle_id = v_cycle_id AND establishment_id = v_est_id;
  IF v_ce_id IS NULL THEN
    INSERT INTO cycle_establishments (cycle_id, establishment_id, total_orcado) VALUES (v_cycle_id, v_est_id, 5699.209999999999) RETURNING id INTO v_ce_id;
  ELSE
    UPDATE cycle_establishments SET total_orcado = 5699.209999999999 WHERE id = v_ce_id;
  END IF;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_insp_id, 1)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_apt_id, 8)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_asp_id, 17)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  -- ==========================================
  -- Unidade: UPR de Imperatriz
  -- ==========================================
  SELECT id INTO v_est_id FROM establishments WHERE nome ILIKE 'UPR de Imperatriz';
  IF v_est_id IS NULL THEN
    INSERT INTO establishments (nome, localizacao, complexidade, tipo) VALUES ('UPR de Imperatriz', 'Interior', 'Alta Complexidade', 'Unidade prisional') RETURNING id INTO v_est_id;
  END IF;

  SELECT id INTO v_ce_id FROM cycle_establishments WHERE cycle_id = v_cycle_id AND establishment_id = v_est_id;
  IF v_ce_id IS NULL THEN
    INSERT INTO cycle_establishments (cycle_id, establishment_id, total_orcado) VALUES (v_cycle_id, v_est_id, 20814.46) RETURNING id INTO v_ce_id;
  ELSE
    UPDATE cycle_establishments SET total_orcado = 20814.46 WHERE id = v_ce_id;
  END IF;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_insp_id, 5)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_apt_id, 30)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_asp_id, 54)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  -- ==========================================
  -- Unidade: UPR de Itapecuru-Mirim
  -- ==========================================
  SELECT id INTO v_est_id FROM establishments WHERE nome ILIKE 'UPR de Itapecuru-Mirim';
  IF v_est_id IS NULL THEN
    INSERT INTO establishments (nome, localizacao, complexidade, tipo) VALUES ('UPR de Itapecuru-Mirim', 'Interior', 'Média Complexidade', 'Unidade prisional') RETURNING id INTO v_est_id;
  END IF;

  SELECT id INTO v_ce_id FROM cycle_establishments WHERE cycle_id = v_cycle_id AND establishment_id = v_est_id;
  IF v_ce_id IS NULL THEN
    INSERT INTO cycle_establishments (cycle_id, establishment_id, total_orcado) VALUES (v_cycle_id, v_est_id, 9696.21) RETURNING id INTO v_ce_id;
  ELSE
    UPDATE cycle_establishments SET total_orcado = 9696.21 WHERE id = v_ce_id;
  END IF;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_insp_id, 2)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_apt_id, 12)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_asp_id, 31)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  -- ==========================================
  -- Unidade: UPR de Pinheiro
  -- ==========================================
  SELECT id INTO v_est_id FROM establishments WHERE nome ILIKE 'UPR de Pinheiro';
  IF v_est_id IS NULL THEN
    INSERT INTO establishments (nome, localizacao, complexidade, tipo) VALUES ('UPR de Pinheiro', 'Interior', 'Baixa Complexidade', 'Unidade prisional') RETURNING id INTO v_est_id;
  END IF;

  SELECT id INTO v_ce_id FROM cycle_establishments WHERE cycle_id = v_cycle_id AND establishment_id = v_est_id;
  IF v_ce_id IS NULL THEN
    INSERT INTO cycle_establishments (cycle_id, establishment_id, total_orcado) VALUES (v_cycle_id, v_est_id, 19436.059999999998) RETURNING id INTO v_ce_id;
  ELSE
    UPDATE cycle_establishments SET total_orcado = 19436.059999999998 WHERE id = v_ce_id;
  END IF;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_insp_id, 1)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_apt_id, 33)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_asp_id, 57)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  -- ==========================================
  -- Unidade: UPR de Porto Franco
  -- ==========================================
  SELECT id INTO v_est_id FROM establishments WHERE nome ILIKE 'UPR de Porto Franco';
  IF v_est_id IS NULL THEN
    INSERT INTO establishments (nome, localizacao, complexidade, tipo) VALUES ('UPR de Porto Franco', 'Interior', 'Baixa Complexidade', 'Unidade prisional') RETURNING id INTO v_est_id;
  END IF;

  SELECT id INTO v_ce_id FROM cycle_establishments WHERE cycle_id = v_cycle_id AND establishment_id = v_est_id;
  IF v_ce_id IS NULL THEN
    INSERT INTO cycle_establishments (cycle_id, establishment_id, total_orcado) VALUES (v_cycle_id, v_est_id, 7372.99) RETURNING id INTO v_ce_id;
  ELSE
    UPDATE cycle_establishments SET total_orcado = 7372.99 WHERE id = v_ce_id;
  END IF;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_insp_id, 3)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_apt_id, 8)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_asp_id, 19)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  -- ==========================================
  -- Unidade: UPR de Presidente Dutra
  -- ==========================================
  SELECT id INTO v_est_id FROM establishments WHERE nome ILIKE 'UPR de Presidente Dutra';
  IF v_est_id IS NULL THEN
    INSERT INTO establishments (nome, localizacao, complexidade, tipo) VALUES ('UPR de Presidente Dutra', 'Interior', 'Baixa Complexidade', 'Unidade prisional') RETURNING id INTO v_est_id;
  END IF;

  SELECT id INTO v_ce_id FROM cycle_establishments WHERE cycle_id = v_cycle_id AND establishment_id = v_est_id;
  IF v_ce_id IS NULL THEN
    INSERT INTO cycle_establishments (cycle_id, establishment_id, total_orcado) VALUES (v_cycle_id, v_est_id, 6852.3099999999995) RETURNING id INTO v_ce_id;
  ELSE
    UPDATE cycle_establishments SET total_orcado = 6852.3099999999995 WHERE id = v_ce_id;
  END IF;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_insp_id, 2)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_apt_id, 9)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_asp_id, 18)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  -- ==========================================
  -- Unidade: UPR de Rosário
  -- ==========================================
  SELECT id INTO v_est_id FROM establishments WHERE nome ILIKE 'UPR de Rosário';
  IF v_est_id IS NULL THEN
    INSERT INTO establishments (nome, localizacao, complexidade, tipo) VALUES ('UPR de Rosário', 'Interior', 'Média Complexidade', 'Unidade prisional') RETURNING id INTO v_est_id;
  END IF;

  SELECT id INTO v_ce_id FROM cycle_establishments WHERE cycle_id = v_cycle_id AND establishment_id = v_est_id;
  IF v_ce_id IS NULL THEN
    INSERT INTO cycle_establishments (cycle_id, establishment_id, total_orcado) VALUES (v_cycle_id, v_est_id, 11595.289999999999) RETURNING id INTO v_ce_id;
  ELSE
    UPDATE cycle_establishments SET total_orcado = 11595.289999999999 WHERE id = v_ce_id;
  END IF;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_insp_id, 7)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_apt_id, 8)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_asp_id, 29)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  -- ==========================================
  -- Unidade: UPR de Santa Inês
  -- ==========================================
  SELECT id INTO v_est_id FROM establishments WHERE nome ILIKE 'UPR de Santa Inês';
  IF v_est_id IS NULL THEN
    INSERT INTO establishments (nome, localizacao, complexidade, tipo) VALUES ('UPR de Santa Inês', 'Interior', 'Média Complexidade', 'Unidade prisional') RETURNING id INTO v_est_id;
  END IF;

  SELECT id INTO v_ce_id FROM cycle_establishments WHERE cycle_id = v_cycle_id AND establishment_id = v_est_id;
  IF v_ce_id IS NULL THEN
    INSERT INTO cycle_establishments (cycle_id, establishment_id, total_orcado) VALUES (v_cycle_id, v_est_id, 12114.15) RETURNING id INTO v_ce_id;
  ELSE
    UPDATE cycle_establishments SET total_orcado = 12114.15 WHERE id = v_ce_id;
  END IF;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_insp_id, 3)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_apt_id, 17)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_asp_id, 32)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  -- ==========================================
  -- Unidade: UPR de São João dos Patos
  -- ==========================================
  SELECT id INTO v_est_id FROM establishments WHERE nome ILIKE 'UPR de São João dos Patos';
  IF v_est_id IS NULL THEN
    INSERT INTO establishments (nome, localizacao, complexidade, tipo) VALUES ('UPR de São João dos Patos', 'Interior', 'Baixa Complexidade', 'Unidade prisional') RETURNING id INTO v_est_id;
  END IF;

  SELECT id INTO v_ce_id FROM cycle_establishments WHERE cycle_id = v_cycle_id AND establishment_id = v_est_id;
  IF v_ce_id IS NULL THEN
    INSERT INTO cycle_establishments (cycle_id, establishment_id, total_orcado) VALUES (v_cycle_id, v_est_id, 7431.67) RETURNING id INTO v_ce_id;
  ELSE
    UPDATE cycle_establishments SET total_orcado = 7431.67 WHERE id = v_ce_id;
  END IF;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_insp_id, 4)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_apt_id, 6)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_asp_id, 19)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  -- ==========================================
  -- Unidade: UPR de São Luís 1
  -- ==========================================
  SELECT id INTO v_est_id FROM establishments WHERE nome ILIKE 'UPR de São Luís 1';
  IF v_est_id IS NULL THEN
    INSERT INTO establishments (nome, localizacao, complexidade, tipo) VALUES ('UPR de São Luís 1', 'Capital - Complexo', 'Média Alta Complexidade', 'Unidade prisional') RETURNING id INTO v_est_id;
  END IF;

  SELECT id INTO v_ce_id FROM cycle_establishments WHERE cycle_id = v_cycle_id AND establishment_id = v_est_id;
  IF v_ce_id IS NULL THEN
    INSERT INTO cycle_establishments (cycle_id, establishment_id, total_orcado) VALUES (v_cycle_id, v_est_id, 19805.34) RETURNING id INTO v_ce_id;
  ELSE
    UPDATE cycle_establishments SET total_orcado = 19805.34 WHERE id = v_ce_id;
  END IF;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_insp_id, 6)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_apt_id, 32)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_asp_id, 38)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  -- ==========================================
  -- Unidade: UPR de São Luís 2
  -- ==========================================
  SELECT id INTO v_est_id FROM establishments WHERE nome ILIKE 'UPR de São Luís 2';
  IF v_est_id IS NULL THEN
    INSERT INTO establishments (nome, localizacao, complexidade, tipo) VALUES ('UPR de São Luís 2', 'Capital - Complexo', 'Alta Complexidade', 'Unidade prisional') RETURNING id INTO v_est_id;
  END IF;

  SELECT id INTO v_ce_id FROM cycle_establishments WHERE cycle_id = v_cycle_id AND establishment_id = v_est_id;
  IF v_ce_id IS NULL THEN
    INSERT INTO cycle_establishments (cycle_id, establishment_id, total_orcado) VALUES (v_cycle_id, v_est_id, 22272.53) RETURNING id INTO v_ce_id;
  ELSE
    UPDATE cycle_establishments SET total_orcado = 22272.53 WHERE id = v_ce_id;
  END IF;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_insp_id, 0)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_apt_id, 46)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_asp_id, 53)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  -- ==========================================
  -- Unidade: UPR de São Luís 3
  -- ==========================================
  SELECT id INTO v_est_id FROM establishments WHERE nome ILIKE 'UPR de São Luís 3';
  IF v_est_id IS NULL THEN
    INSERT INTO establishments (nome, localizacao, complexidade, tipo) VALUES ('UPR de São Luís 3', 'Capital - Complexo', 'Média Alta Complexidade', 'Unidade prisional') RETURNING id INTO v_est_id;
  END IF;

  SELECT id INTO v_ce_id FROM cycle_establishments WHERE cycle_id = v_cycle_id AND establishment_id = v_est_id;
  IF v_ce_id IS NULL THEN
    INSERT INTO cycle_establishments (cycle_id, establishment_id, total_orcado) VALUES (v_cycle_id, v_est_id, 14721.52) RETURNING id INTO v_ce_id;
  ELSE
    UPDATE cycle_establishments SET total_orcado = 14721.52 WHERE id = v_ce_id;
  END IF;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_insp_id, 1)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_apt_id, 31)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_asp_id, 29)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  -- ==========================================
  -- Unidade: UPR de São Luís 4
  -- ==========================================
  SELECT id INTO v_est_id FROM establishments WHERE nome ILIKE 'UPR de São Luís 4';
  IF v_est_id IS NULL THEN
    INSERT INTO establishments (nome, localizacao, complexidade, tipo) VALUES ('UPR de São Luís 4', 'Capital - Complexo', 'Especial', 'Unidade prisional') RETURNING id INTO v_est_id;
  END IF;

  SELECT id INTO v_ce_id FROM cycle_establishments WHERE cycle_id = v_cycle_id AND establishment_id = v_est_id;
  IF v_ce_id IS NULL THEN
    INSERT INTO cycle_establishments (cycle_id, establishment_id, total_orcado) VALUES (v_cycle_id, v_est_id, 17658.329999999998) RETURNING id INTO v_ce_id;
  ELSE
    UPDATE cycle_establishments SET total_orcado = 17658.329999999998 WHERE id = v_ce_id;
  END IF;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_insp_id, 5)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_apt_id, 38)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_asp_id, 15)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  -- ==========================================
  -- Unidade: UPR de São Luís 5
  -- ==========================================
  SELECT id INTO v_est_id FROM establishments WHERE nome ILIKE 'UPR de São Luís 5';
  IF v_est_id IS NULL THEN
    INSERT INTO establishments (nome, localizacao, complexidade, tipo) VALUES ('UPR de São Luís 5', 'Capital - Complexo', 'Alta Complexidade', 'Unidade prisional') RETURNING id INTO v_est_id;
  END IF;

  SELECT id INTO v_ce_id FROM cycle_establishments WHERE cycle_id = v_cycle_id AND establishment_id = v_est_id;
  IF v_ce_id IS NULL THEN
    INSERT INTO cycle_establishments (cycle_id, establishment_id, total_orcado) VALUES (v_cycle_id, v_est_id, 14500.03) RETURNING id INTO v_ce_id;
  ELSE
    UPDATE cycle_establishments SET total_orcado = 14500.03 WHERE id = v_ce_id;
  END IF;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_insp_id, 3)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_apt_id, 31)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_asp_id, 18)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  -- ==========================================
  -- Unidade: UPR de São Luís 6
  -- ==========================================
  SELECT id INTO v_est_id FROM establishments WHERE nome ILIKE 'UPR de São Luís 6';
  IF v_est_id IS NULL THEN
    INSERT INTO establishments (nome, localizacao, complexidade, tipo) VALUES ('UPR de São Luís 6', 'Capital - Complexo', 'Alta Complexidade', 'Unidade prisional') RETURNING id INTO v_est_id;
  END IF;

  SELECT id INTO v_ce_id FROM cycle_establishments WHERE cycle_id = v_cycle_id AND establishment_id = v_est_id;
  IF v_ce_id IS NULL THEN
    INSERT INTO cycle_establishments (cycle_id, establishment_id, total_orcado) VALUES (v_cycle_id, v_est_id, 18705.3) RETURNING id INTO v_ce_id;
  ELSE
    UPDATE cycle_establishments SET total_orcado = 18705.3 WHERE id = v_ce_id;
  END IF;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_insp_id, 0)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_apt_id, 36)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_asp_id, 36)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  -- ==========================================
  -- Unidade: UPR de São Luís 7
  -- ==========================================
  SELECT id INTO v_est_id FROM establishments WHERE nome ILIKE 'UPR de São Luís 7';
  IF v_est_id IS NULL THEN
    INSERT INTO establishments (nome, localizacao, complexidade, tipo) VALUES ('UPR de São Luís 7', 'Capital - Complexo', 'Alta Complexidade', 'Unidade prisional') RETURNING id INTO v_est_id;
  END IF;

  SELECT id INTO v_ce_id FROM cycle_establishments WHERE cycle_id = v_cycle_id AND establishment_id = v_est_id;
  IF v_ce_id IS NULL THEN
    INSERT INTO cycle_establishments (cycle_id, establishment_id, total_orcado) VALUES (v_cycle_id, v_est_id, 12447.38) RETURNING id INTO v_ce_id;
  ELSE
    UPDATE cycle_establishments SET total_orcado = 12447.38 WHERE id = v_ce_id;
  END IF;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_insp_id, 0)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_apt_id, 20)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_asp_id, 42)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  -- ==========================================
  -- Unidade: UPR de Segurança Máxima
  -- ==========================================
  SELECT id INTO v_est_id FROM establishments WHERE nome ILIKE 'UPR de Segurança Máxima';
  IF v_est_id IS NULL THEN
    INSERT INTO establishments (nome, localizacao, complexidade, tipo) VALUES ('UPR de Segurança Máxima', 'Capital - Complexo', 'Especial', 'Unidade prisional') RETURNING id INTO v_est_id;
  END IF;

  SELECT id INTO v_ce_id FROM cycle_establishments WHERE cycle_id = v_cycle_id AND establishment_id = v_est_id;
  IF v_ce_id IS NULL THEN
    INSERT INTO cycle_establishments (cycle_id, establishment_id, total_orcado) VALUES (v_cycle_id, v_est_id, 23315.879999999997) RETURNING id INTO v_ce_id;
  ELSE
    UPDATE cycle_establishments SET total_orcado = 23315.879999999997 WHERE id = v_ce_id;
  END IF;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_insp_id, 2)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_apt_id, 50)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_asp_id, 42)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  -- ==========================================
  -- Unidade: UPR de Timon
  -- ==========================================
  SELECT id INTO v_est_id FROM establishments WHERE nome ILIKE 'UPR de Timon';
  IF v_est_id IS NULL THEN
    INSERT INTO establishments (nome, localizacao, complexidade, tipo) VALUES ('UPR de Timon', 'Interior', 'Alta Complexidade', 'Unidade prisional') RETURNING id INTO v_est_id;
  END IF;

  SELECT id INTO v_ce_id FROM cycle_establishments WHERE cycle_id = v_cycle_id AND establishment_id = v_est_id;
  IF v_ce_id IS NULL THEN
    INSERT INTO cycle_establishments (cycle_id, establishment_id, total_orcado) VALUES (v_cycle_id, v_est_id, 26358.31) RETURNING id INTO v_ce_id;
  ELSE
    UPDATE cycle_establishments SET total_orcado = 26358.31 WHERE id = v_ce_id;
  END IF;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_insp_id, 24)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_apt_id, 12)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_asp_id, 41)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  -- ==========================================
  -- Unidade: UPR de Viana
  -- ==========================================
  SELECT id INTO v_est_id FROM establishments WHERE nome ILIKE 'UPR de Viana';
  IF v_est_id IS NULL THEN
    INSERT INTO establishments (nome, localizacao, complexidade, tipo) VALUES ('UPR de Viana', 'Interior', 'Baixa Complexidade', 'Unidade prisional') RETURNING id INTO v_est_id;
  END IF;

  SELECT id INTO v_ce_id FROM cycle_establishments WHERE cycle_id = v_cycle_id AND establishment_id = v_est_id;
  IF v_ce_id IS NULL THEN
    INSERT INTO cycle_establishments (cycle_id, establishment_id, total_orcado) VALUES (v_cycle_id, v_est_id, 9696.21) RETURNING id INTO v_ce_id;
  ELSE
    UPDATE cycle_establishments SET total_orcado = 9696.21 WHERE id = v_ce_id;
  END IF;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_insp_id, 2)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_apt_id, 12)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_asp_id, 31)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  -- ==========================================
  -- Unidade: UPR de Zé Doca
  -- ==========================================
  SELECT id INTO v_est_id FROM establishments WHERE nome ILIKE 'UPR de Zé Doca';
  IF v_est_id IS NULL THEN
    INSERT INTO establishments (nome, localizacao, complexidade, tipo) VALUES ('UPR de Zé Doca', 'Interior', 'Baixa Complexidade', 'Unidade prisional') RETURNING id INTO v_est_id;
  END IF;

  SELECT id INTO v_ce_id FROM cycle_establishments WHERE cycle_id = v_cycle_id AND establishment_id = v_est_id;
  IF v_ce_id IS NULL THEN
    INSERT INTO cycle_establishments (cycle_id, establishment_id, total_orcado) VALUES (v_cycle_id, v_est_id, 7643.74) RETURNING id INTO v_ce_id;
  ELSE
    UPDATE cycle_establishments SET total_orcado = 7643.74 WHERE id = v_ce_id;
  END IF;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_insp_id, 1)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_apt_id, 10)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_asp_id, 26)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  -- ==========================================
  -- Unidade: UPR do Anil
  -- ==========================================
  SELECT id INTO v_est_id FROM establishments WHERE nome ILIKE 'UPR do Anil';
  IF v_est_id IS NULL THEN
    INSERT INTO establishments (nome, localizacao, complexidade, tipo) VALUES ('UPR do Anil', 'Capital', 'Média Complexidade', 'Unidade prisional') RETURNING id INTO v_est_id;
  END IF;

  SELECT id INTO v_ce_id FROM cycle_establishments WHERE cycle_id = v_cycle_id AND establishment_id = v_est_id;
  IF v_ce_id IS NULL THEN
    INSERT INTO cycle_establishments (cycle_id, establishment_id, total_orcado) VALUES (v_cycle_id, v_est_id, 18176.86) RETURNING id INTO v_ce_id;
  ELSE
    UPDATE cycle_establishments SET total_orcado = 18176.86 WHERE id = v_ce_id;
  END IF;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_insp_id, 18)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_apt_id, 8)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_asp_id, 22)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  -- ==========================================
  -- Unidade: UPR do Monte Castelo
  -- ==========================================
  SELECT id INTO v_est_id FROM establishments WHERE nome ILIKE 'UPR do Monte Castelo';
  IF v_est_id IS NULL THEN
    INSERT INTO establishments (nome, localizacao, complexidade, tipo) VALUES ('UPR do Monte Castelo', 'Capital', 'Especial', 'Unidade prisional') RETURNING id INTO v_est_id;
  END IF;

  SELECT id INTO v_ce_id FROM cycle_establishments WHERE cycle_id = v_cycle_id AND establishment_id = v_est_id;
  IF v_ce_id IS NULL THEN
    INSERT INTO cycle_establishments (cycle_id, establishment_id, total_orcado) VALUES (v_cycle_id, v_est_id, 13734.88) RETURNING id INTO v_ce_id;
  ELSE
    UPDATE cycle_establishments SET total_orcado = 13734.88 WHERE id = v_ce_id;
  END IF;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_insp_id, 14)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_apt_id, 5)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_asp_id, 17)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  -- ==========================================
  -- Unidade: UPR do Olho D''Água
  -- ==========================================
  SELECT id INTO v_est_id FROM establishments WHERE nome ILIKE 'UPR do Olho D''Água';
  IF v_est_id IS NULL THEN
    INSERT INTO establishments (nome, localizacao, complexidade, tipo) VALUES ('UPR do Olho D''Água', 'Capital', 'Baixa Complexidade', 'Unidade prisional') RETURNING id INTO v_est_id;
  END IF;

  SELECT id INTO v_ce_id FROM cycle_establishments WHERE cycle_id = v_cycle_id AND establishment_id = v_est_id;
  IF v_ce_id IS NULL THEN
    INSERT INTO cycle_establishments (cycle_id, establishment_id, total_orcado) VALUES (v_cycle_id, v_est_id, 23342.17) RETURNING id INTO v_ce_id;
  ELSE
    UPDATE cycle_establishments SET total_orcado = 23342.17 WHERE id = v_ce_id;
  END IF;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_insp_id, 19)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_apt_id, 18)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_asp_id, 31)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  -- ==========================================
  -- Unidade: UPR do Paço do Lumiar
  -- ==========================================
  SELECT id INTO v_est_id FROM establishments WHERE nome ILIKE 'UPR do Paço do Lumiar';
  IF v_est_id IS NULL THEN
    INSERT INTO establishments (nome, localizacao, complexidade, tipo) VALUES ('UPR do Paço do Lumiar', 'Capital', 'Especial', 'Unidade prisional') RETURNING id INTO v_est_id;
  END IF;

  SELECT id INTO v_ce_id FROM cycle_establishments WHERE cycle_id = v_cycle_id AND establishment_id = v_est_id;
  IF v_ce_id IS NULL THEN
    INSERT INTO cycle_establishments (cycle_id, establishment_id, total_orcado) VALUES (v_cycle_id, v_est_id, 11462.730000000001) RETURNING id INTO v_ce_id;
  ELSE
    UPDATE cycle_establishments SET total_orcado = 11462.730000000001 WHERE id = v_ce_id;
  END IF;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_insp_id, 13)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_apt_id, 0)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_asp_id, 17)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  -- ==========================================
  -- Unidade: UPR Feminina
  -- ==========================================
  SELECT id INTO v_est_id FROM establishments WHERE nome ILIKE 'UPR Feminina';
  IF v_est_id IS NULL THEN
    INSERT INTO establishments (nome, localizacao, complexidade, tipo) VALUES ('UPR Feminina', 'Capital - Complexo', 'Média Alta Complexidade', 'Unidade prisional') RETURNING id INTO v_est_id;
  END IF;

  SELECT id INTO v_ce_id FROM cycle_establishments WHERE cycle_id = v_cycle_id AND establishment_id = v_est_id;
  IF v_ce_id IS NULL THEN
    INSERT INTO cycle_establishments (cycle_id, establishment_id, total_orcado) VALUES (v_cycle_id, v_est_id, 21052.979999999996) RETURNING id INTO v_ce_id;
  ELSE
    UPDATE cycle_establishments SET total_orcado = 21052.979999999996 WHERE id = v_ce_id;
  END IF;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_insp_id, 7)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_apt_id, 25)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_asp_id, 57)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  -- ==========================================
  -- Unidade: UPRS Feminina de Carolina
  -- ==========================================
  SELECT id INTO v_est_id FROM establishments WHERE nome ILIKE 'UPRS Feminina de Carolina';
  IF v_est_id IS NULL THEN
    INSERT INTO establishments (nome, localizacao, complexidade, tipo) VALUES ('UPRS Feminina de Carolina', 'Interior', 'Baixa Complexidade', 'Unidade prisional') RETURNING id INTO v_est_id;
  END IF;

  SELECT id INTO v_ce_id FROM cycle_establishments WHERE cycle_id = v_cycle_id AND establishment_id = v_est_id;
  IF v_ce_id IS NULL THEN
    INSERT INTO cycle_establishments (cycle_id, establishment_id, total_orcado) VALUES (v_cycle_id, v_est_id, 5153.9) RETURNING id INTO v_ce_id;
  ELSE
    UPDATE cycle_establishments SET total_orcado = 5153.9 WHERE id = v_ce_id;
  END IF;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_insp_id, 0)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_apt_id, 8)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_asp_id, 18)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  -- ==========================================
  -- Unidade: UPRS Feminina de Timon
  -- ==========================================
  SELECT id INTO v_est_id FROM establishments WHERE nome ILIKE 'UPRS Feminina de Timon';
  IF v_est_id IS NULL THEN
    INSERT INTO establishments (nome, localizacao, complexidade, tipo) VALUES ('UPRS Feminina de Timon', 'Interior', 'Baixa Complexidade', 'Unidade prisional') RETURNING id INTO v_est_id;
  END IF;

  SELECT id INTO v_ce_id FROM cycle_establishments WHERE cycle_id = v_cycle_id AND establishment_id = v_est_id;
  IF v_ce_id IS NULL THEN
    INSERT INTO cycle_establishments (cycle_id, establishment_id, total_orcado) VALUES (v_cycle_id, v_est_id, 7889.870000000001) RETURNING id INTO v_ce_id;
  ELSE
    UPDATE cycle_establishments SET total_orcado = 7889.870000000001 WHERE id = v_ce_id;
  END IF;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_insp_id, 6)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_apt_id, 4)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
  VALUES (v_ce_id, v_asp_id, 17)
  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;

END;
$$;


-- ==========================================================
-- SCRIPT DE ATUALIZAÇÃO DO PLANEJAMENTO (ORÇAMENTO E LIMITES)
-- ==========================================================
DO $$
DECLARE
  v_cycle_id UUID;
  v_est_id UUID;
  v_pos_inspetor UUID;
  v_pos_agente UUID;
  v_pos_auxiliar UUID;
  v_ce_id UUID;
BEGIN
  -- 1. Obter o ciclo aberto atual
  SELECT id INTO v_cycle_id FROM cycles WHERE status IN ('ABERTO', 'REABERTO') ORDER BY ano DESC, mes DESC LIMIT 1;
  IF v_cycle_id IS NULL THEN
    RAISE EXCEPTION 'Nenhum ciclo aberto encontrado';
  END IF;

  -- 2. Obter os IDs dos cargos
  SELECT id INTO v_pos_inspetor FROM positions WHERE codigo = 'INSP' LIMIT 1;
  SELECT id INTO v_pos_agente FROM positions WHERE codigo = 'APT' LIMIT 1;
  SELECT id INTO v_pos_auxiliar FROM positions WHERE codigo = 'ASP' LIMIT 1;


  -- --------------------------------------------------------
  -- CAAE de São Luís
  -- --------------------------------------------------------
  SELECT id INTO v_est_id FROM establishments WHERE nome = 'CAAE de São Luís' LIMIT 1;
  IF v_est_id IS NOT NULL THEN
     
     -- Atualiza ou insere o orçamento no cycle_establishments
     INSERT INTO cycle_establishments (cycle_id, establishment_id, total_orcado)
     VALUES (v_cycle_id, v_est_id, 7132.49)
     ON CONFLICT (cycle_id, establishment_id) DO UPDATE SET total_orcado = EXCLUDED.total_orcado
     RETURNING id INTO v_ce_id;

     -- Limites: Inspetor
     IF v_pos_inspetor IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_inspetor, 8)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

     -- Limites: Agente
     IF v_pos_agente IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_agente, 0)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

     -- Limites: Auxiliar
     IF v_pos_auxiliar IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_auxiliar, 11)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

  END IF;

  -- --------------------------------------------------------
  -- COCT de São Luís
  -- --------------------------------------------------------
  SELECT id INTO v_est_id FROM establishments WHERE nome = 'COCT de São Luís' LIMIT 1;
  IF v_est_id IS NOT NULL THEN
     
     -- Atualiza ou insere o orçamento no cycle_establishments
     INSERT INTO cycle_establishments (cycle_id, establishment_id, total_orcado)
     VALUES (v_cycle_id, v_est_id, 10622.20)
     ON CONFLICT (cycle_id, establishment_id) DO UPDATE SET total_orcado = EXCLUDED.total_orcado
     RETURNING id INTO v_ce_id;

     -- Limites: Inspetor
     IF v_pos_inspetor IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_inspetor, 2)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

     -- Limites: Agente
     IF v_pos_agente IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_agente, 20)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

     -- Limites: Auxiliar
     IF v_pos_auxiliar IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_auxiliar, 20)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

  END IF;

  -- --------------------------------------------------------
  -- Grupo Especial de Operação Penitenciárias - GEOP
  -- --------------------------------------------------------
  SELECT id INTO v_est_id FROM establishments WHERE nome = 'Grupo Especial de Operação Penitenciárias - GEOP' LIMIT 1;
  IF v_est_id IS NOT NULL THEN
     
     -- Atualiza ou insere o orçamento no cycle_establishments
     INSERT INTO cycle_establishments (cycle_id, establishment_id, total_orcado)
     VALUES (v_cycle_id, v_est_id, 25570.70)
     ON CONFLICT (cycle_id, establishment_id) DO UPDATE SET total_orcado = EXCLUDED.total_orcado
     RETURNING id INTO v_ce_id;

     -- Limites: Inspetor
     IF v_pos_inspetor IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_inspetor, 37)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

     -- Limites: Agente
     IF v_pos_agente IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_agente, 0)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

     -- Limites: Auxiliar
     IF v_pos_auxiliar IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_auxiliar, 0)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

  END IF;

  -- --------------------------------------------------------
  -- Grupo Tático de Escolta - GTE
  -- --------------------------------------------------------
  SELECT id INTO v_est_id FROM establishments WHERE nome = 'Grupo Tático de Escolta - GTE' LIMIT 1;
  IF v_est_id IS NOT NULL THEN
     
     -- Atualiza ou insere o orçamento no cycle_establishments
     INSERT INTO cycle_establishments (cycle_id, establishment_id, total_orcado)
     VALUES (v_cycle_id, v_est_id, 40071.06)
     ON CONFLICT (cycle_id, establishment_id) DO UPDATE SET total_orcado = EXCLUDED.total_orcado
     RETURNING id INTO v_ce_id;

     -- Limites: Inspetor
     IF v_pos_inspetor IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_inspetor, 23)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

     -- Limites: Agente
     IF v_pos_agente IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_agente, 70)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

     -- Limites: Auxiliar
     IF v_pos_auxiliar IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_auxiliar, 14)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

  END IF;

  -- --------------------------------------------------------
  -- Penitenciária Regional de Bacabal
  -- --------------------------------------------------------
  SELECT id INTO v_est_id FROM establishments WHERE nome = 'Penitenciária Regional de Bacabal' LIMIT 1;
  IF v_est_id IS NOT NULL THEN
     
     -- Atualiza ou insere o orçamento no cycle_establishments
     INSERT INTO cycle_establishments (cycle_id, establishment_id, total_orcado)
     VALUES (v_cycle_id, v_est_id, 21842.60)
     ON CONFLICT (cycle_id, establishment_id) DO UPDATE SET total_orcado = EXCLUDED.total_orcado
     RETURNING id INTO v_ce_id;

     -- Limites: Inspetor
     IF v_pos_inspetor IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_inspetor, 8)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

     -- Limites: Agente
     IF v_pos_agente IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_agente, 29)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

     -- Limites: Auxiliar
     IF v_pos_auxiliar IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_auxiliar, 49)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

  END IF;

  -- --------------------------------------------------------
  -- Penitenciária Regional de Brejo
  -- --------------------------------------------------------
  SELECT id INTO v_est_id FROM establishments WHERE nome = 'Penitenciária Regional de Brejo' LIMIT 1;
  IF v_est_id IS NOT NULL THEN
     
     -- Atualiza ou insere o orçamento no cycle_establishments
     INSERT INTO cycle_establishments (cycle_id, establishment_id, total_orcado)
     VALUES (v_cycle_id, v_est_id, 19405.82)
     ON CONFLICT (cycle_id, establishment_id) DO UPDATE SET total_orcado = EXCLUDED.total_orcado
     RETURNING id INTO v_ce_id;

     -- Limites: Inspetor
     IF v_pos_inspetor IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_inspetor, 5)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

     -- Limites: Agente
     IF v_pos_agente IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_agente, 32)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

     -- Limites: Auxiliar
     IF v_pos_auxiliar IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_auxiliar, 40)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

  END IF;

  -- --------------------------------------------------------
  -- Penitenciária Regional de Governador Nunes Freire
  -- --------------------------------------------------------
  SELECT id INTO v_est_id FROM establishments WHERE nome = 'Penitenciária Regional de Governador Nunes Freire' LIMIT 1;
  IF v_est_id IS NOT NULL THEN
     
     -- Atualiza ou insere o orçamento no cycle_establishments
     INSERT INTO cycle_establishments (cycle_id, establishment_id, total_orcado)
     VALUES (v_cycle_id, v_est_id, 17273.84)
     ON CONFLICT (cycle_id, establishment_id) DO UPDATE SET total_orcado = EXCLUDED.total_orcado
     RETURNING id INTO v_ce_id;

     -- Limites: Inspetor
     IF v_pos_inspetor IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_inspetor, 1)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

     -- Limites: Agente
     IF v_pos_agente IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_agente, 34)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

     -- Limites: Auxiliar
     IF v_pos_auxiliar IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_auxiliar, 40)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

  END IF;

  -- --------------------------------------------------------
  -- Penitenciária Regional de Imperatriz
  -- --------------------------------------------------------
  SELECT id INTO v_est_id FROM establishments WHERE nome = 'Penitenciária Regional de Imperatriz' LIMIT 1;
  IF v_est_id IS NOT NULL THEN
     
     -- Atualiza ou insere o orçamento no cycle_establishments
     INSERT INTO cycle_establishments (cycle_id, establishment_id, total_orcado)
     VALUES (v_cycle_id, v_est_id, 23319.35)
     ON CONFLICT (cycle_id, establishment_id) DO UPDATE SET total_orcado = EXCLUDED.total_orcado
     RETURNING id INTO v_ce_id;

     -- Limites: Inspetor
     IF v_pos_inspetor IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_inspetor, 17)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

     -- Limites: Agente
     IF v_pos_agente IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_agente, 14)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

     -- Limites: Auxiliar
     IF v_pos_auxiliar IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_auxiliar, 49)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

  END IF;

  -- --------------------------------------------------------
  -- Penitenciária Regional de Pedreiras
  -- --------------------------------------------------------
  SELECT id INTO v_est_id FROM establishments WHERE nome = 'Penitenciária Regional de Pedreiras' LIMIT 1;
  IF v_est_id IS NOT NULL THEN
     
     -- Atualiza ou insere o orçamento no cycle_establishments
     INSERT INTO cycle_establishments (cycle_id, establishment_id, total_orcado)
     VALUES (v_cycle_id, v_est_id, 19362.18)
     ON CONFLICT (cycle_id, establishment_id) DO UPDATE SET total_orcado = EXCLUDED.total_orcado
     RETURNING id INTO v_ce_id;

     -- Limites: Inspetor
     IF v_pos_inspetor IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_inspetor, 8)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

     -- Limites: Agente
     IF v_pos_agente IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_agente, 23)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

     -- Limites: Auxiliar
     IF v_pos_auxiliar IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_auxiliar, 45)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

  END IF;

  -- --------------------------------------------------------
  -- Penitenciária Regional de Pinheiro
  -- --------------------------------------------------------
  SELECT id INTO v_est_id FROM establishments WHERE nome = 'Penitenciária Regional de Pinheiro' LIMIT 1;
  IF v_est_id IS NOT NULL THEN
     
     -- Atualiza ou insere o orçamento no cycle_establishments
     INSERT INTO cycle_establishments (cycle_id, establishment_id, total_orcado)
     VALUES (v_cycle_id, v_est_id, 19436.06)
     ON CONFLICT (cycle_id, establishment_id) DO UPDATE SET total_orcado = EXCLUDED.total_orcado
     RETURNING id INTO v_ce_id;

     -- Limites: Inspetor
     IF v_pos_inspetor IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_inspetor, 1)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

     -- Limites: Agente
     IF v_pos_agente IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_agente, 33)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

     -- Limites: Auxiliar
     IF v_pos_auxiliar IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_auxiliar, 57)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

  END IF;

  -- --------------------------------------------------------
  -- Penitenciária Regional de São Luís
  -- --------------------------------------------------------
  SELECT id INTO v_est_id FROM establishments WHERE nome = 'Penitenciária Regional de São Luís' LIMIT 1;
  IF v_est_id IS NOT NULL THEN
     
     -- Atualiza ou insere o orçamento no cycle_establishments
     INSERT INTO cycle_establishments (cycle_id, establishment_id, total_orcado)
     VALUES (v_cycle_id, v_est_id, 24944.20)
     ON CONFLICT (cycle_id, establishment_id) DO UPDATE SET total_orcado = EXCLUDED.total_orcado
     RETURNING id INTO v_ce_id;

     -- Limites: Inspetor
     IF v_pos_inspetor IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_inspetor, 2)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

     -- Limites: Agente
     IF v_pos_agente IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_agente, 51)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

     -- Limites: Auxiliar
     IF v_pos_auxiliar IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_auxiliar, 51)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

  END IF;

  -- --------------------------------------------------------
  -- Penitenciária Regional de Timon
  -- --------------------------------------------------------
  SELECT id INTO v_est_id FROM establishments WHERE nome = 'Penitenciária Regional de Timon' LIMIT 1;
  IF v_est_id IS NOT NULL THEN
     
     -- Atualiza ou insere o orçamento no cycle_establishments
     INSERT INTO cycle_establishments (cycle_id, establishment_id, total_orcado)
     VALUES (v_cycle_id, v_est_id, 31695.86)
     ON CONFLICT (cycle_id, establishment_id) DO UPDATE SET total_orcado = EXCLUDED.total_orcado
     RETURNING id INTO v_ce_id;

     -- Limites: Inspetor
     IF v_pos_inspetor IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_inspetor, 30)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

     -- Limites: Agente
     IF v_pos_agente IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_agente, 13)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

     -- Limites: Auxiliar
     IF v_pos_auxiliar IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_auxiliar, 47)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

  END IF;

  -- --------------------------------------------------------
  -- Supervisão de Segurabça Interna - SSI
  -- --------------------------------------------------------
  SELECT id INTO v_est_id FROM establishments WHERE nome = 'Supervisão de Segurabça Interna - SSI' LIMIT 1;
  IF v_est_id IS NOT NULL THEN
     
     -- Atualiza ou insere o orçamento no cycle_establishments
     INSERT INTO cycle_establishments (cycle_id, establishment_id, total_orcado)
     VALUES (v_cycle_id, v_est_id, 165428.43)
     ON CONFLICT (cycle_id, establishment_id) DO UPDATE SET total_orcado = EXCLUDED.total_orcado
     RETURNING id INTO v_ce_id;

     -- Limites: Inspetor
     IF v_pos_inspetor IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_inspetor, 12)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

     -- Limites: Agente
     IF v_pos_agente IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_agente, 360)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

     -- Limites: Auxiliar
     IF v_pos_auxiliar IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_auxiliar, 297)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

  END IF;

  -- --------------------------------------------------------
  -- UPR de Açailândia
  -- --------------------------------------------------------
  SELECT id INTO v_est_id FROM establishments WHERE nome = 'UPR de Açailândia' LIMIT 1;
  IF v_est_id IS NOT NULL THEN
     
     -- Atualiza ou insere o orçamento no cycle_establishments
     INSERT INTO cycle_establishments (cycle_id, establishment_id, total_orcado)
     VALUES (v_cycle_id, v_est_id, 12384.90)
     ON CONFLICT (cycle_id, establishment_id) DO UPDATE SET total_orcado = EXCLUDED.total_orcado
     RETURNING id INTO v_ce_id;

     -- Limites: Inspetor
     IF v_pos_inspetor IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_inspetor, 1)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

     -- Limites: Agente
     IF v_pos_agente IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_agente, 19)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

     -- Limites: Auxiliar
     IF v_pos_auxiliar IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_auxiliar, 39)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

  END IF;

  -- --------------------------------------------------------
  -- UPR de Balsas
  -- --------------------------------------------------------
  SELECT id INTO v_est_id FROM establishments WHERE nome = 'UPR de Balsas' LIMIT 1;
  IF v_est_id IS NOT NULL THEN
     
     -- Atualiza ou insere o orçamento no cycle_establishments
     INSERT INTO cycle_establishments (cycle_id, establishment_id, total_orcado)
     VALUES (v_cycle_id, v_est_id, 10357.06)
     ON CONFLICT (cycle_id, establishment_id) DO UPDATE SET total_orcado = EXCLUDED.total_orcado
     RETURNING id INTO v_ce_id;

     -- Limites: Inspetor
     IF v_pos_inspetor IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_inspetor, 0)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

     -- Limites: Agente
     IF v_pos_agente IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_agente, 18)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

     -- Limites: Auxiliar
     IF v_pos_auxiliar IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_auxiliar, 32)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

  END IF;

  -- --------------------------------------------------------
  -- UPR de Barra do Corda
  -- --------------------------------------------------------
  SELECT id INTO v_est_id FROM establishments WHERE nome = 'UPR de Barra do Corda' LIMIT 1;
  IF v_est_id IS NOT NULL THEN
     
     -- Atualiza ou insere o orçamento no cycle_establishments
     INSERT INTO cycle_establishments (cycle_id, establishment_id, total_orcado)
     VALUES (v_cycle_id, v_est_id, 6876.94)
     ON CONFLICT (cycle_id, establishment_id) DO UPDATE SET total_orcado = EXCLUDED.total_orcado
     RETURNING id INTO v_ce_id;

     -- Limites: Inspetor
     IF v_pos_inspetor IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_inspetor, 2)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

     -- Limites: Agente
     IF v_pos_agente IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_agente, 10)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

     -- Limites: Auxiliar
     IF v_pos_auxiliar IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_auxiliar, 16)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

  END IF;

  -- --------------------------------------------------------
  -- UPR de Caxias
  -- --------------------------------------------------------
  SELECT id INTO v_est_id FROM establishments WHERE nome = 'UPR de Caxias' LIMIT 1;
  IF v_est_id IS NOT NULL THEN
     
     -- Atualiza ou insere o orçamento no cycle_establishments
     INSERT INTO cycle_establishments (cycle_id, establishment_id, total_orcado)
     VALUES (v_cycle_id, v_est_id, 19540.04)
     ON CONFLICT (cycle_id, establishment_id) DO UPDATE SET total_orcado = EXCLUDED.total_orcado
     RETURNING id INTO v_ce_id;

     -- Limites: Inspetor
     IF v_pos_inspetor IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_inspetor, 16)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

     -- Limites: Agente
     IF v_pos_agente IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_agente, 7)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

     -- Limites: Auxiliar
     IF v_pos_auxiliar IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_auxiliar, 43)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

  END IF;

  -- --------------------------------------------------------
  -- UPR de Chapadinha
  -- --------------------------------------------------------
  SELECT id INTO v_est_id FROM establishments WHERE nome = 'UPR de Chapadinha' LIMIT 1;
  IF v_est_id IS NOT NULL THEN
     
     -- Atualiza ou insere o orçamento no cycle_establishments
     INSERT INTO cycle_establishments (cycle_id, establishment_id, total_orcado)
     VALUES (v_cycle_id, v_est_id, 16273.97)
     ON CONFLICT (cycle_id, establishment_id) DO UPDATE SET total_orcado = EXCLUDED.total_orcado
     RETURNING id INTO v_ce_id;

     -- Limites: Inspetor
     IF v_pos_inspetor IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_inspetor, 8)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

     -- Limites: Agente
     IF v_pos_agente IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_agente, 16)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

     -- Limites: Auxiliar
     IF v_pos_auxiliar IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_auxiliar, 39)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

  END IF;

  -- --------------------------------------------------------
  -- UPR de Codó
  -- --------------------------------------------------------
  SELECT id INTO v_est_id FROM establishments WHERE nome = 'UPR de Codó' LIMIT 1;
  IF v_est_id IS NOT NULL THEN
     
     -- Atualiza ou insere o orçamento no cycle_establishments
     INSERT INTO cycle_establishments (cycle_id, establishment_id, total_orcado)
     VALUES (v_cycle_id, v_est_id, 13856.03)
     ON CONFLICT (cycle_id, establishment_id) DO UPDATE SET total_orcado = EXCLUDED.total_orcado
     RETURNING id INTO v_ce_id;

     -- Limites: Inspetor
     IF v_pos_inspetor IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_inspetor, 7)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

     -- Limites: Agente
     IF v_pos_agente IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_agente, 11)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

     -- Limites: Auxiliar
     IF v_pos_auxiliar IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_auxiliar, 38)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

  END IF;

  -- --------------------------------------------------------
  -- UPR de Colinas
  -- --------------------------------------------------------
  SELECT id INTO v_est_id FROM establishments WHERE nome = 'UPR de Colinas' LIMIT 1;
  IF v_est_id IS NOT NULL THEN
     
     -- Atualiza ou insere o orçamento no cycle_establishments
     INSERT INTO cycle_establishments (cycle_id, establishment_id, total_orcado)
     VALUES (v_cycle_id, v_est_id, 8437.16)
     ON CONFLICT (cycle_id, establishment_id) DO UPDATE SET total_orcado = EXCLUDED.total_orcado
     RETURNING id INTO v_ce_id;

     -- Limites: Inspetor
     IF v_pos_inspetor IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_inspetor, 0)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

     -- Limites: Agente
     IF v_pos_agente IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_agente, 17)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

     -- Limites: Auxiliar
     IF v_pos_auxiliar IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_auxiliar, 21)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

  END IF;

  -- --------------------------------------------------------
  -- UPR de Coroatá
  -- --------------------------------------------------------
  SELECT id INTO v_est_id FROM establishments WHERE nome = 'UPR de Coroatá' LIMIT 1;
  IF v_est_id IS NOT NULL THEN
     
     -- Atualiza ou insere o orçamento no cycle_establishments
     INSERT INTO cycle_establishments (cycle_id, establishment_id, total_orcado)
     VALUES (v_cycle_id, v_est_id, 16910.19)
     ON CONFLICT (cycle_id, establishment_id) DO UPDATE SET total_orcado = EXCLUDED.total_orcado
     RETURNING id INTO v_ce_id;

     -- Limites: Inspetor
     IF v_pos_inspetor IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_inspetor, 6)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

     -- Limites: Agente
     IF v_pos_agente IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_agente, 21)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

     -- Limites: Auxiliar
     IF v_pos_auxiliar IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_auxiliar, 42)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

  END IF;

  -- --------------------------------------------------------
  -- UPR de Davinópolis
  -- --------------------------------------------------------
  SELECT id INTO v_est_id FROM establishments WHERE nome = 'UPR de Davinópolis' LIMIT 1;
  IF v_est_id IS NOT NULL THEN
     
     -- Atualiza ou insere o orçamento no cycle_establishments
     INSERT INTO cycle_establishments (cycle_id, establishment_id, total_orcado)
     VALUES (v_cycle_id, v_est_id, 11021.55)
     ON CONFLICT (cycle_id, establishment_id) DO UPDATE SET total_orcado = EXCLUDED.total_orcado
     RETURNING id INTO v_ce_id;

     -- Limites: Inspetor
     IF v_pos_inspetor IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_inspetor, 8)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

     -- Limites: Agente
     IF v_pos_agente IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_agente, 4)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

     -- Limites: Auxiliar
     IF v_pos_auxiliar IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_auxiliar, 29)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

  END IF;

  -- --------------------------------------------------------
  -- UPR de Godofredo Viana
  -- --------------------------------------------------------
  SELECT id INTO v_est_id FROM establishments WHERE nome = 'UPR de Godofredo Viana' LIMIT 1;
  IF v_est_id IS NOT NULL THEN
     
     -- Atualiza ou insere o orçamento no cycle_establishments
     INSERT INTO cycle_establishments (cycle_id, establishment_id, total_orcado)
     VALUES (v_cycle_id, v_est_id, 6452.79)
     ON CONFLICT (cycle_id, establishment_id) DO UPDATE SET total_orcado = EXCLUDED.total_orcado
     RETURNING id INTO v_ce_id;

     -- Limites: Inspetor
     IF v_pos_inspetor IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_inspetor, 1)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

     -- Limites: Agente
     IF v_pos_agente IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_agente, 9)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

     -- Limites: Auxiliar
     IF v_pos_auxiliar IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_auxiliar, 20)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

  END IF;

  -- --------------------------------------------------------
  -- UPR de Grajaú
  -- --------------------------------------------------------
  SELECT id INTO v_est_id FROM establishments WHERE nome = 'UPR de Grajaú' LIMIT 1;
  IF v_est_id IS NOT NULL THEN
     
     -- Atualiza ou insere o orçamento no cycle_establishments
     INSERT INTO cycle_establishments (cycle_id, establishment_id, total_orcado)
     VALUES (v_cycle_id, v_est_id, 5699.21)
     ON CONFLICT (cycle_id, establishment_id) DO UPDATE SET total_orcado = EXCLUDED.total_orcado
     RETURNING id INTO v_ce_id;

     -- Limites: Inspetor
     IF v_pos_inspetor IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_inspetor, 1)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

     -- Limites: Agente
     IF v_pos_agente IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_agente, 8)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

     -- Limites: Auxiliar
     IF v_pos_auxiliar IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_auxiliar, 17)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

  END IF;

  -- --------------------------------------------------------
  -- UPR de Imperatriz
  -- --------------------------------------------------------
  SELECT id INTO v_est_id FROM establishments WHERE nome = 'UPR de Imperatriz' LIMIT 1;
  IF v_est_id IS NOT NULL THEN
     
     -- Atualiza ou insere o orçamento no cycle_establishments
     INSERT INTO cycle_establishments (cycle_id, establishment_id, total_orcado)
     VALUES (v_cycle_id, v_est_id, 20814.46)
     ON CONFLICT (cycle_id, establishment_id) DO UPDATE SET total_orcado = EXCLUDED.total_orcado
     RETURNING id INTO v_ce_id;

     -- Limites: Inspetor
     IF v_pos_inspetor IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_inspetor, 5)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

     -- Limites: Agente
     IF v_pos_agente IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_agente, 30)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

     -- Limites: Auxiliar
     IF v_pos_auxiliar IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_auxiliar, 54)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

  END IF;

  -- --------------------------------------------------------
  -- UPR de Itapecuru-Mirim
  -- --------------------------------------------------------
  SELECT id INTO v_est_id FROM establishments WHERE nome = 'UPR de Itapecuru-Mirim' LIMIT 1;
  IF v_est_id IS NOT NULL THEN
     
     -- Atualiza ou insere o orçamento no cycle_establishments
     INSERT INTO cycle_establishments (cycle_id, establishment_id, total_orcado)
     VALUES (v_cycle_id, v_est_id, 9696.21)
     ON CONFLICT (cycle_id, establishment_id) DO UPDATE SET total_orcado = EXCLUDED.total_orcado
     RETURNING id INTO v_ce_id;

     -- Limites: Inspetor
     IF v_pos_inspetor IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_inspetor, 2)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

     -- Limites: Agente
     IF v_pos_agente IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_agente, 12)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

     -- Limites: Auxiliar
     IF v_pos_auxiliar IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_auxiliar, 31)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

  END IF;

  -- --------------------------------------------------------
  -- UPR de Pinheiro
  -- --------------------------------------------------------
  SELECT id INTO v_est_id FROM establishments WHERE nome = 'UPR de Pinheiro' LIMIT 1;
  IF v_est_id IS NOT NULL THEN
     
     -- Atualiza ou insere o orçamento no cycle_establishments
     INSERT INTO cycle_establishments (cycle_id, establishment_id, total_orcado)
     VALUES (v_cycle_id, v_est_id, 19436.06)
     ON CONFLICT (cycle_id, establishment_id) DO UPDATE SET total_orcado = EXCLUDED.total_orcado
     RETURNING id INTO v_ce_id;

     -- Limites: Inspetor
     IF v_pos_inspetor IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_inspetor, 1)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

     -- Limites: Agente
     IF v_pos_agente IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_agente, 33)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

     -- Limites: Auxiliar
     IF v_pos_auxiliar IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_auxiliar, 57)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

  END IF;

  -- --------------------------------------------------------
  -- UPR de Porto Franco
  -- --------------------------------------------------------
  SELECT id INTO v_est_id FROM establishments WHERE nome = 'UPR de Porto Franco' LIMIT 1;
  IF v_est_id IS NOT NULL THEN
     
     -- Atualiza ou insere o orçamento no cycle_establishments
     INSERT INTO cycle_establishments (cycle_id, establishment_id, total_orcado)
     VALUES (v_cycle_id, v_est_id, 7372.99)
     ON CONFLICT (cycle_id, establishment_id) DO UPDATE SET total_orcado = EXCLUDED.total_orcado
     RETURNING id INTO v_ce_id;

     -- Limites: Inspetor
     IF v_pos_inspetor IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_inspetor, 3)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

     -- Limites: Agente
     IF v_pos_agente IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_agente, 8)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

     -- Limites: Auxiliar
     IF v_pos_auxiliar IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_auxiliar, 19)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

  END IF;

  -- --------------------------------------------------------
  -- UPR de Presidente Dutra
  -- --------------------------------------------------------
  SELECT id INTO v_est_id FROM establishments WHERE nome = 'UPR de Presidente Dutra' LIMIT 1;
  IF v_est_id IS NOT NULL THEN
     
     -- Atualiza ou insere o orçamento no cycle_establishments
     INSERT INTO cycle_establishments (cycle_id, establishment_id, total_orcado)
     VALUES (v_cycle_id, v_est_id, 6852.31)
     ON CONFLICT (cycle_id, establishment_id) DO UPDATE SET total_orcado = EXCLUDED.total_orcado
     RETURNING id INTO v_ce_id;

     -- Limites: Inspetor
     IF v_pos_inspetor IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_inspetor, 2)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

     -- Limites: Agente
     IF v_pos_agente IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_agente, 9)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

     -- Limites: Auxiliar
     IF v_pos_auxiliar IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_auxiliar, 18)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

  END IF;

  -- --------------------------------------------------------
  -- UPR de Rosário
  -- --------------------------------------------------------
  SELECT id INTO v_est_id FROM establishments WHERE nome = 'UPR de Rosário' LIMIT 1;
  IF v_est_id IS NOT NULL THEN
     
     -- Atualiza ou insere o orçamento no cycle_establishments
     INSERT INTO cycle_establishments (cycle_id, establishment_id, total_orcado)
     VALUES (v_cycle_id, v_est_id, 11595.29)
     ON CONFLICT (cycle_id, establishment_id) DO UPDATE SET total_orcado = EXCLUDED.total_orcado
     RETURNING id INTO v_ce_id;

     -- Limites: Inspetor
     IF v_pos_inspetor IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_inspetor, 7)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

     -- Limites: Agente
     IF v_pos_agente IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_agente, 8)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

     -- Limites: Auxiliar
     IF v_pos_auxiliar IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_auxiliar, 29)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

  END IF;

  -- --------------------------------------------------------
  -- UPR de Santa Inês
  -- --------------------------------------------------------
  SELECT id INTO v_est_id FROM establishments WHERE nome = 'UPR de Santa Inês' LIMIT 1;
  IF v_est_id IS NOT NULL THEN
     
     -- Atualiza ou insere o orçamento no cycle_establishments
     INSERT INTO cycle_establishments (cycle_id, establishment_id, total_orcado)
     VALUES (v_cycle_id, v_est_id, 12114.15)
     ON CONFLICT (cycle_id, establishment_id) DO UPDATE SET total_orcado = EXCLUDED.total_orcado
     RETURNING id INTO v_ce_id;

     -- Limites: Inspetor
     IF v_pos_inspetor IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_inspetor, 3)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

     -- Limites: Agente
     IF v_pos_agente IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_agente, 17)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

     -- Limites: Auxiliar
     IF v_pos_auxiliar IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_auxiliar, 32)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

  END IF;

  -- --------------------------------------------------------
  -- UPR de São João dos Patos
  -- --------------------------------------------------------
  SELECT id INTO v_est_id FROM establishments WHERE nome = 'UPR de São João dos Patos' LIMIT 1;
  IF v_est_id IS NOT NULL THEN
     
     -- Atualiza ou insere o orçamento no cycle_establishments
     INSERT INTO cycle_establishments (cycle_id, establishment_id, total_orcado)
     VALUES (v_cycle_id, v_est_id, 7431.67)
     ON CONFLICT (cycle_id, establishment_id) DO UPDATE SET total_orcado = EXCLUDED.total_orcado
     RETURNING id INTO v_ce_id;

     -- Limites: Inspetor
     IF v_pos_inspetor IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_inspetor, 4)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

     -- Limites: Agente
     IF v_pos_agente IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_agente, 6)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

     -- Limites: Auxiliar
     IF v_pos_auxiliar IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_auxiliar, 19)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

  END IF;

  -- --------------------------------------------------------
  -- UPR de São Luís 1
  -- --------------------------------------------------------
  SELECT id INTO v_est_id FROM establishments WHERE nome = 'UPR de São Luís 1' LIMIT 1;
  IF v_est_id IS NOT NULL THEN
     
     -- Atualiza ou insere o orçamento no cycle_establishments
     INSERT INTO cycle_establishments (cycle_id, establishment_id, total_orcado)
     VALUES (v_cycle_id, v_est_id, 19805.34)
     ON CONFLICT (cycle_id, establishment_id) DO UPDATE SET total_orcado = EXCLUDED.total_orcado
     RETURNING id INTO v_ce_id;

     -- Limites: Inspetor
     IF v_pos_inspetor IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_inspetor, 6)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

     -- Limites: Agente
     IF v_pos_agente IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_agente, 32)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

     -- Limites: Auxiliar
     IF v_pos_auxiliar IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_auxiliar, 38)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

  END IF;

  -- --------------------------------------------------------
  -- UPR de São Luís 2
  -- --------------------------------------------------------
  SELECT id INTO v_est_id FROM establishments WHERE nome = 'UPR de São Luís 2' LIMIT 1;
  IF v_est_id IS NOT NULL THEN
     
     -- Atualiza ou insere o orçamento no cycle_establishments
     INSERT INTO cycle_establishments (cycle_id, establishment_id, total_orcado)
     VALUES (v_cycle_id, v_est_id, 22272.53)
     ON CONFLICT (cycle_id, establishment_id) DO UPDATE SET total_orcado = EXCLUDED.total_orcado
     RETURNING id INTO v_ce_id;

     -- Limites: Inspetor
     IF v_pos_inspetor IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_inspetor, 0)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

     -- Limites: Agente
     IF v_pos_agente IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_agente, 46)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

     -- Limites: Auxiliar
     IF v_pos_auxiliar IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_auxiliar, 53)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

  END IF;

  -- --------------------------------------------------------
  -- UPR de São Luís 3
  -- --------------------------------------------------------
  SELECT id INTO v_est_id FROM establishments WHERE nome = 'UPR de São Luís 3' LIMIT 1;
  IF v_est_id IS NOT NULL THEN
     
     -- Atualiza ou insere o orçamento no cycle_establishments
     INSERT INTO cycle_establishments (cycle_id, establishment_id, total_orcado)
     VALUES (v_cycle_id, v_est_id, 14721.52)
     ON CONFLICT (cycle_id, establishment_id) DO UPDATE SET total_orcado = EXCLUDED.total_orcado
     RETURNING id INTO v_ce_id;

     -- Limites: Inspetor
     IF v_pos_inspetor IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_inspetor, 1)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

     -- Limites: Agente
     IF v_pos_agente IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_agente, 31)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

     -- Limites: Auxiliar
     IF v_pos_auxiliar IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_auxiliar, 29)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

  END IF;

  -- --------------------------------------------------------
  -- UPR de São Luís 4
  -- --------------------------------------------------------
  SELECT id INTO v_est_id FROM establishments WHERE nome = 'UPR de São Luís 4' LIMIT 1;
  IF v_est_id IS NOT NULL THEN
     
     -- Atualiza ou insere o orçamento no cycle_establishments
     INSERT INTO cycle_establishments (cycle_id, establishment_id, total_orcado)
     VALUES (v_cycle_id, v_est_id, 17658.33)
     ON CONFLICT (cycle_id, establishment_id) DO UPDATE SET total_orcado = EXCLUDED.total_orcado
     RETURNING id INTO v_ce_id;

     -- Limites: Inspetor
     IF v_pos_inspetor IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_inspetor, 5)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

     -- Limites: Agente
     IF v_pos_agente IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_agente, 38)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

     -- Limites: Auxiliar
     IF v_pos_auxiliar IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_auxiliar, 15)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

  END IF;

  -- --------------------------------------------------------
  -- UPR de São Luís 5
  -- --------------------------------------------------------
  SELECT id INTO v_est_id FROM establishments WHERE nome = 'UPR de São Luís 5' LIMIT 1;
  IF v_est_id IS NOT NULL THEN
     
     -- Atualiza ou insere o orçamento no cycle_establishments
     INSERT INTO cycle_establishments (cycle_id, establishment_id, total_orcado)
     VALUES (v_cycle_id, v_est_id, 14500.03)
     ON CONFLICT (cycle_id, establishment_id) DO UPDATE SET total_orcado = EXCLUDED.total_orcado
     RETURNING id INTO v_ce_id;

     -- Limites: Inspetor
     IF v_pos_inspetor IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_inspetor, 3)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

     -- Limites: Agente
     IF v_pos_agente IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_agente, 31)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

     -- Limites: Auxiliar
     IF v_pos_auxiliar IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_auxiliar, 18)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

  END IF;

  -- --------------------------------------------------------
  -- UPR de São Luís 6
  -- --------------------------------------------------------
  SELECT id INTO v_est_id FROM establishments WHERE nome = 'UPR de São Luís 6' LIMIT 1;
  IF v_est_id IS NOT NULL THEN
     
     -- Atualiza ou insere o orçamento no cycle_establishments
     INSERT INTO cycle_establishments (cycle_id, establishment_id, total_orcado)
     VALUES (v_cycle_id, v_est_id, 18705.30)
     ON CONFLICT (cycle_id, establishment_id) DO UPDATE SET total_orcado = EXCLUDED.total_orcado
     RETURNING id INTO v_ce_id;

     -- Limites: Inspetor
     IF v_pos_inspetor IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_inspetor, 0)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

     -- Limites: Agente
     IF v_pos_agente IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_agente, 36)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

     -- Limites: Auxiliar
     IF v_pos_auxiliar IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_auxiliar, 36)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

  END IF;

  -- --------------------------------------------------------
  -- UPR de São Luís 7
  -- --------------------------------------------------------
  SELECT id INTO v_est_id FROM establishments WHERE nome = 'UPR de São Luís 7' LIMIT 1;
  IF v_est_id IS NOT NULL THEN
     
     -- Atualiza ou insere o orçamento no cycle_establishments
     INSERT INTO cycle_establishments (cycle_id, establishment_id, total_orcado)
     VALUES (v_cycle_id, v_est_id, 12447.38)
     ON CONFLICT (cycle_id, establishment_id) DO UPDATE SET total_orcado = EXCLUDED.total_orcado
     RETURNING id INTO v_ce_id;

     -- Limites: Inspetor
     IF v_pos_inspetor IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_inspetor, 0)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

     -- Limites: Agente
     IF v_pos_agente IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_agente, 20)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

     -- Limites: Auxiliar
     IF v_pos_auxiliar IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_auxiliar, 42)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

  END IF;

  -- --------------------------------------------------------
  -- UPR de Segurança Máxima
  -- --------------------------------------------------------
  SELECT id INTO v_est_id FROM establishments WHERE nome = 'UPR de Segurança Máxima' LIMIT 1;
  IF v_est_id IS NOT NULL THEN
     
     -- Atualiza ou insere o orçamento no cycle_establishments
     INSERT INTO cycle_establishments (cycle_id, establishment_id, total_orcado)
     VALUES (v_cycle_id, v_est_id, 23315.88)
     ON CONFLICT (cycle_id, establishment_id) DO UPDATE SET total_orcado = EXCLUDED.total_orcado
     RETURNING id INTO v_ce_id;

     -- Limites: Inspetor
     IF v_pos_inspetor IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_inspetor, 2)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

     -- Limites: Agente
     IF v_pos_agente IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_agente, 50)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

     -- Limites: Auxiliar
     IF v_pos_auxiliar IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_auxiliar, 42)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

  END IF;

  -- --------------------------------------------------------
  -- UPR de Timon
  -- --------------------------------------------------------
  SELECT id INTO v_est_id FROM establishments WHERE nome = 'UPR de Timon' LIMIT 1;
  IF v_est_id IS NOT NULL THEN
     
     -- Atualiza ou insere o orçamento no cycle_establishments
     INSERT INTO cycle_establishments (cycle_id, establishment_id, total_orcado)
     VALUES (v_cycle_id, v_est_id, 26358.31)
     ON CONFLICT (cycle_id, establishment_id) DO UPDATE SET total_orcado = EXCLUDED.total_orcado
     RETURNING id INTO v_ce_id;

     -- Limites: Inspetor
     IF v_pos_inspetor IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_inspetor, 24)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

     -- Limites: Agente
     IF v_pos_agente IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_agente, 12)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

     -- Limites: Auxiliar
     IF v_pos_auxiliar IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_auxiliar, 41)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

  END IF;

  -- --------------------------------------------------------
  -- UPR de Viana
  -- --------------------------------------------------------
  SELECT id INTO v_est_id FROM establishments WHERE nome = 'UPR de Viana' LIMIT 1;
  IF v_est_id IS NOT NULL THEN
     
     -- Atualiza ou insere o orçamento no cycle_establishments
     INSERT INTO cycle_establishments (cycle_id, establishment_id, total_orcado)
     VALUES (v_cycle_id, v_est_id, 9696.21)
     ON CONFLICT (cycle_id, establishment_id) DO UPDATE SET total_orcado = EXCLUDED.total_orcado
     RETURNING id INTO v_ce_id;

     -- Limites: Inspetor
     IF v_pos_inspetor IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_inspetor, 2)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

     -- Limites: Agente
     IF v_pos_agente IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_agente, 12)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

     -- Limites: Auxiliar
     IF v_pos_auxiliar IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_auxiliar, 31)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

  END IF;

  -- --------------------------------------------------------
  -- UPR de Zé Doca
  -- --------------------------------------------------------
  SELECT id INTO v_est_id FROM establishments WHERE nome = 'UPR de Zé Doca' LIMIT 1;
  IF v_est_id IS NOT NULL THEN
     
     -- Atualiza ou insere o orçamento no cycle_establishments
     INSERT INTO cycle_establishments (cycle_id, establishment_id, total_orcado)
     VALUES (v_cycle_id, v_est_id, 7643.74)
     ON CONFLICT (cycle_id, establishment_id) DO UPDATE SET total_orcado = EXCLUDED.total_orcado
     RETURNING id INTO v_ce_id;

     -- Limites: Inspetor
     IF v_pos_inspetor IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_inspetor, 1)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

     -- Limites: Agente
     IF v_pos_agente IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_agente, 10)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

     -- Limites: Auxiliar
     IF v_pos_auxiliar IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_auxiliar, 26)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

  END IF;

  -- --------------------------------------------------------
  -- UPR do Anil
  -- --------------------------------------------------------
  SELECT id INTO v_est_id FROM establishments WHERE nome = 'UPR do Anil' LIMIT 1;
  IF v_est_id IS NOT NULL THEN
     
     -- Atualiza ou insere o orçamento no cycle_establishments
     INSERT INTO cycle_establishments (cycle_id, establishment_id, total_orcado)
     VALUES (v_cycle_id, v_est_id, 18176.86)
     ON CONFLICT (cycle_id, establishment_id) DO UPDATE SET total_orcado = EXCLUDED.total_orcado
     RETURNING id INTO v_ce_id;

     -- Limites: Inspetor
     IF v_pos_inspetor IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_inspetor, 18)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

     -- Limites: Agente
     IF v_pos_agente IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_agente, 8)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

     -- Limites: Auxiliar
     IF v_pos_auxiliar IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_auxiliar, 22)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

  END IF;

  -- --------------------------------------------------------
  -- UPR do Monte Castelo
  -- --------------------------------------------------------
  SELECT id INTO v_est_id FROM establishments WHERE nome = 'UPR do Monte Castelo' LIMIT 1;
  IF v_est_id IS NOT NULL THEN
     
     -- Atualiza ou insere o orçamento no cycle_establishments
     INSERT INTO cycle_establishments (cycle_id, establishment_id, total_orcado)
     VALUES (v_cycle_id, v_est_id, 13734.88)
     ON CONFLICT (cycle_id, establishment_id) DO UPDATE SET total_orcado = EXCLUDED.total_orcado
     RETURNING id INTO v_ce_id;

     -- Limites: Inspetor
     IF v_pos_inspetor IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_inspetor, 14)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

     -- Limites: Agente
     IF v_pos_agente IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_agente, 5)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

     -- Limites: Auxiliar
     IF v_pos_auxiliar IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_auxiliar, 17)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

  END IF;

  -- --------------------------------------------------------
  -- UPR do Olho D'Água
  -- --------------------------------------------------------
  SELECT id INTO v_est_id FROM establishments WHERE nome = 'UPR do Olho D''Água' LIMIT 1;
  IF v_est_id IS NOT NULL THEN
     
     -- Atualiza ou insere o orçamento no cycle_establishments
     INSERT INTO cycle_establishments (cycle_id, establishment_id, total_orcado)
     VALUES (v_cycle_id, v_est_id, 23342.17)
     ON CONFLICT (cycle_id, establishment_id) DO UPDATE SET total_orcado = EXCLUDED.total_orcado
     RETURNING id INTO v_ce_id;

     -- Limites: Inspetor
     IF v_pos_inspetor IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_inspetor, 19)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

     -- Limites: Agente
     IF v_pos_agente IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_agente, 18)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

     -- Limites: Auxiliar
     IF v_pos_auxiliar IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_auxiliar, 31)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

  END IF;

  -- --------------------------------------------------------
  -- UPR do Paço do Lumiar
  -- --------------------------------------------------------
  SELECT id INTO v_est_id FROM establishments WHERE nome = 'UPR do Paço do Lumiar' LIMIT 1;
  IF v_est_id IS NOT NULL THEN
     
     -- Atualiza ou insere o orçamento no cycle_establishments
     INSERT INTO cycle_establishments (cycle_id, establishment_id, total_orcado)
     VALUES (v_cycle_id, v_est_id, 11462.73)
     ON CONFLICT (cycle_id, establishment_id) DO UPDATE SET total_orcado = EXCLUDED.total_orcado
     RETURNING id INTO v_ce_id;

     -- Limites: Inspetor
     IF v_pos_inspetor IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_inspetor, 13)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

     -- Limites: Agente
     IF v_pos_agente IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_agente, 0)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

     -- Limites: Auxiliar
     IF v_pos_auxiliar IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_auxiliar, 17)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

  END IF;

  -- --------------------------------------------------------
  -- UPR Feminina
  -- --------------------------------------------------------
  SELECT id INTO v_est_id FROM establishments WHERE nome = 'UPR Feminina' LIMIT 1;
  IF v_est_id IS NOT NULL THEN
     
     -- Atualiza ou insere o orçamento no cycle_establishments
     INSERT INTO cycle_establishments (cycle_id, establishment_id, total_orcado)
     VALUES (v_cycle_id, v_est_id, 21052.98)
     ON CONFLICT (cycle_id, establishment_id) DO UPDATE SET total_orcado = EXCLUDED.total_orcado
     RETURNING id INTO v_ce_id;

     -- Limites: Inspetor
     IF v_pos_inspetor IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_inspetor, 7)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

     -- Limites: Agente
     IF v_pos_agente IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_agente, 25)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

     -- Limites: Auxiliar
     IF v_pos_auxiliar IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_auxiliar, 57)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

  END IF;

  -- --------------------------------------------------------
  -- UPRS Feminina de Carolina
  -- --------------------------------------------------------
  SELECT id INTO v_est_id FROM establishments WHERE nome = 'UPRS Feminina de Carolina' LIMIT 1;
  IF v_est_id IS NOT NULL THEN
     
     -- Atualiza ou insere o orçamento no cycle_establishments
     INSERT INTO cycle_establishments (cycle_id, establishment_id, total_orcado)
     VALUES (v_cycle_id, v_est_id, 5153.90)
     ON CONFLICT (cycle_id, establishment_id) DO UPDATE SET total_orcado = EXCLUDED.total_orcado
     RETURNING id INTO v_ce_id;

     -- Limites: Inspetor
     IF v_pos_inspetor IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_inspetor, 0)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

     -- Limites: Agente
     IF v_pos_agente IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_agente, 8)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

     -- Limites: Auxiliar
     IF v_pos_auxiliar IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_auxiliar, 18)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

  END IF;

  -- --------------------------------------------------------
  -- UPRS Feminina de Timon
  -- --------------------------------------------------------
  SELECT id INTO v_est_id FROM establishments WHERE nome = 'UPRS Feminina de Timon' LIMIT 1;
  IF v_est_id IS NOT NULL THEN
     
     -- Atualiza ou insere o orçamento no cycle_establishments
     INSERT INTO cycle_establishments (cycle_id, establishment_id, total_orcado)
     VALUES (v_cycle_id, v_est_id, 7889.87)
     ON CONFLICT (cycle_id, establishment_id) DO UPDATE SET total_orcado = EXCLUDED.total_orcado
     RETURNING id INTO v_ce_id;

     -- Limites: Inspetor
     IF v_pos_inspetor IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_inspetor, 6)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

     -- Limites: Agente
     IF v_pos_agente IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_agente, 4)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

     -- Limites: Auxiliar
     IF v_pos_auxiliar IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_auxiliar, 17)
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

  END IF;

END $$;

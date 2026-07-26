-- Seed from Excel
DO $$
DECLARE
  v_cycle UUID := gen_random_uuid();
  v_est UUID;
  v_cycle_est UUID;
  v_inspetor UUID;
  v_agente UUID;
  v_auxiliar UUID;
BEGIN
  -- 1. Create a Base Cycle
  INSERT INTO cycles (id, nome, mes, ano, data_inicio, data_fim, status)
  VALUES (v_cycle, 'Ciclo Base (Importado)', EXTRACT(MONTH FROM CURRENT_DATE), EXTRACT(YEAR FROM CURRENT_DATE), CURRENT_DATE, CURRENT_DATE + interval '30 days', 'ABERTO');

  -- 2. Get the position IDs that were already seeded
  SELECT id INTO v_inspetor FROM positions WHERE codigo = 'INSP' LIMIT 1;
  SELECT id INTO v_agente FROM positions WHERE codigo = 'APT' LIMIT 1;
  SELECT id INTO v_auxiliar FROM positions WHERE codigo = 'ASP' LIMIT 1;


  -- CAAE de São Luís
  v_est := gen_random_uuid();
  INSERT INTO establishments (id, nome, localizacao, complexidade) VALUES (v_est, 'CAAE de São Luís', 'Capital', 'Especial');
  
  v_cycle_est := gen_random_uuid();
  INSERT INTO cycle_establishments (id, cycle_id, establishment_id, total_orcado) VALUES (v_cycle_est, v_cycle, v_est, 7132.49);
  
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_inspetor, 8);
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_agente, 0);
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_auxiliar, 11);

  -- COCT de São Luís
  v_est := gen_random_uuid();
  INSERT INTO establishments (id, nome, localizacao, complexidade) VALUES (v_est, 'COCT de São Luís', 'Capital - Complexo', 'Especial');
  
  v_cycle_est := gen_random_uuid();
  INSERT INTO cycle_establishments (id, cycle_id, establishment_id, total_orcado) VALUES (v_cycle_est, v_cycle, v_est, 10622.199999999999);
  
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_inspetor, 2);
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_agente, 20);
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_auxiliar, 20);

  -- Grupo Especial de Operação Penitenciárias - GEOP
  v_est := gen_random_uuid();
  INSERT INTO establishments (id, nome, localizacao, complexidade) VALUES (v_est, 'Grupo Especial de Operação Penitenciárias - GEOP', 'Capital - Apoio', 'Apoio');
  
  v_cycle_est := gen_random_uuid();
  INSERT INTO cycle_establishments (id, cycle_id, establishment_id, total_orcado) VALUES (v_cycle_est, v_cycle, v_est, 25570.7);
  
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_inspetor, 37);
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_agente, 0);
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_auxiliar, 0);

  -- Grupo Tático de Escolta - GTE
  v_est := gen_random_uuid();
  INSERT INTO establishments (id, nome, localizacao, complexidade) VALUES (v_est, 'Grupo Tático de Escolta - GTE', 'Capital - Apoio', 'Apoio');
  
  v_cycle_est := gen_random_uuid();
  INSERT INTO cycle_establishments (id, cycle_id, establishment_id, total_orcado) VALUES (v_cycle_est, v_cycle, v_est, 40071.06);
  
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_inspetor, 23);
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_agente, 70);
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_auxiliar, 14);

  -- Penitenciária Regional de Bacabal
  v_est := gen_random_uuid();
  INSERT INTO establishments (id, nome, localizacao, complexidade) VALUES (v_est, 'Penitenciária Regional de Bacabal', 'Interior', 'Alta Complexidade');
  
  v_cycle_est := gen_random_uuid();
  INSERT INTO cycle_establishments (id, cycle_id, establishment_id, total_orcado) VALUES (v_cycle_est, v_cycle, v_est, 21842.6);
  
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_inspetor, 8);
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_agente, 29);
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_auxiliar, 49);

  -- Penitenciária Regional de Brejo
  v_est := gen_random_uuid();
  INSERT INTO establishments (id, nome, localizacao, complexidade) VALUES (v_est, 'Penitenciária Regional de Brejo', 'Interior', 'Média Alta Complexidade');
  
  v_cycle_est := gen_random_uuid();
  INSERT INTO cycle_establishments (id, cycle_id, establishment_id, total_orcado) VALUES (v_cycle_est, v_cycle, v_est, 19405.82);
  
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_inspetor, 5);
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_agente, 32);
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_auxiliar, 40);

  -- Penitenciária Regional de Governador Nunes Freire
  v_est := gen_random_uuid();
  INSERT INTO establishments (id, nome, localizacao, complexidade) VALUES (v_est, 'Penitenciária Regional de Governador Nunes Freire', 'Interior', 'Média Alta Complexidade');
  
  v_cycle_est := gen_random_uuid();
  INSERT INTO cycle_establishments (id, cycle_id, establishment_id, total_orcado) VALUES (v_cycle_est, v_cycle, v_est, 17273.84);
  
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_inspetor, 1);
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_agente, 34);
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_auxiliar, 40);

  -- Penitenciária Regional de Imperatriz
  v_est := gen_random_uuid();
  INSERT INTO establishments (id, nome, localizacao, complexidade) VALUES (v_est, 'Penitenciária Regional de Imperatriz', 'Interior', 'Média Alta Complexidade');
  
  v_cycle_est := gen_random_uuid();
  INSERT INTO cycle_establishments (id, cycle_id, establishment_id, total_orcado) VALUES (v_cycle_est, v_cycle, v_est, 23319.35);
  
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_inspetor, 17);
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_agente, 14);
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_auxiliar, 49);

  -- Penitenciária Regional de Pedreiras
  v_est := gen_random_uuid();
  INSERT INTO establishments (id, nome, localizacao, complexidade) VALUES (v_est, 'Penitenciária Regional de Pedreiras', 'Interior', 'Média Alta Complexidade');
  
  v_cycle_est := gen_random_uuid();
  INSERT INTO cycle_establishments (id, cycle_id, establishment_id, total_orcado) VALUES (v_cycle_est, v_cycle, v_est, 19362.18);
  
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_inspetor, 8);
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_agente, 23);
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_auxiliar, 45);

  -- Penitenciária Regional de Pinheiro
  v_est := gen_random_uuid();
  INSERT INTO establishments (id, nome, localizacao, complexidade) VALUES (v_est, 'Penitenciária Regional de Pinheiro', 'Interior', 'Alta Complexidade');
  
  v_cycle_est := gen_random_uuid();
  INSERT INTO cycle_establishments (id, cycle_id, establishment_id, total_orcado) VALUES (v_cycle_est, v_cycle, v_est, 19436.059999999998);
  
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_inspetor, 1);
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_agente, 33);
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_auxiliar, 57);

  -- Penitenciária Regional de São Luís
  v_est := gen_random_uuid();
  INSERT INTO establishments (id, nome, localizacao, complexidade) VALUES (v_est, 'Penitenciária Regional de São Luís', 'Capital - Complexo', 'Alta Complexidade');
  
  v_cycle_est := gen_random_uuid();
  INSERT INTO cycle_establishments (id, cycle_id, establishment_id, total_orcado) VALUES (v_cycle_est, v_cycle, v_est, 24944.2);
  
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_inspetor, 2);
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_agente, 51);
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_auxiliar, 51);

  -- Penitenciária Regional de Timon
  v_est := gen_random_uuid();
  INSERT INTO establishments (id, nome, localizacao, complexidade) VALUES (v_est, 'Penitenciária Regional de Timon', 'Interior', 'Média Alta Complexidade');
  
  v_cycle_est := gen_random_uuid();
  INSERT INTO cycle_establishments (id, cycle_id, establishment_id, total_orcado) VALUES (v_cycle_est, v_cycle, v_est, 31695.86);
  
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_inspetor, 30);
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_agente, 13);
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_auxiliar, 47);

  -- Supervisão de Segurabça Interna - SSI
  v_est := gen_random_uuid();
  INSERT INTO establishments (id, nome, localizacao, complexidade) VALUES (v_est, 'Supervisão de Segurabça Interna - SSI', 'Capital - Apoio', 'Apoio');
  
  v_cycle_est := gen_random_uuid();
  INSERT INTO cycle_establishments (id, cycle_id, establishment_id, total_orcado) VALUES (v_cycle_est, v_cycle, v_est, 165428.43);
  
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_inspetor, 12);
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_agente, 360);
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_auxiliar, 297);

  -- UPR de Açailândia
  v_est := gen_random_uuid();
  INSERT INTO establishments (id, nome, localizacao, complexidade) VALUES (v_est, 'UPR de Açailândia', 'Interior', 'Média Alta Complexidade');
  
  v_cycle_est := gen_random_uuid();
  INSERT INTO cycle_establishments (id, cycle_id, establishment_id, total_orcado) VALUES (v_cycle_est, v_cycle, v_est, 12384.9);
  
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_inspetor, 1);
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_agente, 19);
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_auxiliar, 39);

  -- UPR de Balsas
  v_est := gen_random_uuid();
  INSERT INTO establishments (id, nome, localizacao, complexidade) VALUES (v_est, 'UPR de Balsas', 'Interior', 'Média Alta Complexidade');
  
  v_cycle_est := gen_random_uuid();
  INSERT INTO cycle_establishments (id, cycle_id, establishment_id, total_orcado) VALUES (v_cycle_est, v_cycle, v_est, 10357.06);
  
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_inspetor, 0);
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_agente, 18);
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_auxiliar, 32);

  -- UPR de Barra do Corda
  v_est := gen_random_uuid();
  INSERT INTO establishments (id, nome, localizacao, complexidade) VALUES (v_est, 'UPR de Barra do Corda', 'Interior', 'Baixa Complexidade');
  
  v_cycle_est := gen_random_uuid();
  INSERT INTO cycle_establishments (id, cycle_id, establishment_id, total_orcado) VALUES (v_cycle_est, v_cycle, v_est, 6876.9400000000005);
  
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_inspetor, 2);
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_agente, 10);
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_auxiliar, 16);

  -- UPR de Caxias
  v_est := gen_random_uuid();
  INSERT INTO establishments (id, nome, localizacao, complexidade) VALUES (v_est, 'UPR de Caxias', 'Interior', 'Média Complexidade');
  
  v_cycle_est := gen_random_uuid();
  INSERT INTO cycle_establishments (id, cycle_id, establishment_id, total_orcado) VALUES (v_cycle_est, v_cycle, v_est, 19540.04);
  
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_inspetor, 16);
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_agente, 7);
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_auxiliar, 43);

  -- UPR de Chapadinha
  v_est := gen_random_uuid();
  INSERT INTO establishments (id, nome, localizacao, complexidade) VALUES (v_est, 'UPR de Chapadinha', 'Interior', 'Média Complexidade');
  
  v_cycle_est := gen_random_uuid();
  INSERT INTO cycle_establishments (id, cycle_id, establishment_id, total_orcado) VALUES (v_cycle_est, v_cycle, v_est, 16273.97);
  
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_inspetor, 8);
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_agente, 16);
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_auxiliar, 39);

  -- UPR de Codó
  v_est := gen_random_uuid();
  INSERT INTO establishments (id, nome, localizacao, complexidade) VALUES (v_est, 'UPR de Codó', 'Interior', 'Média Complexidade');
  
  v_cycle_est := gen_random_uuid();
  INSERT INTO cycle_establishments (id, cycle_id, establishment_id, total_orcado) VALUES (v_cycle_est, v_cycle, v_est, 13856.029999999999);
  
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_inspetor, 7);
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_agente, 11);
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_auxiliar, 38);

  -- UPR de Colinas
  v_est := gen_random_uuid();
  INSERT INTO establishments (id, nome, localizacao, complexidade) VALUES (v_est, 'UPR de Colinas', 'Interior', 'Baixa Complexidade');
  
  v_cycle_est := gen_random_uuid();
  INSERT INTO cycle_establishments (id, cycle_id, establishment_id, total_orcado) VALUES (v_cycle_est, v_cycle, v_est, 8437.16);
  
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_inspetor, 0);
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_agente, 17);
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_auxiliar, 21);

  -- UPR de Coroatá
  v_est := gen_random_uuid();
  INSERT INTO establishments (id, nome, localizacao, complexidade) VALUES (v_est, 'UPR de Coroatá', 'Interior', 'Média Alta Complexidade');
  
  v_cycle_est := gen_random_uuid();
  INSERT INTO cycle_establishments (id, cycle_id, establishment_id, total_orcado) VALUES (v_cycle_est, v_cycle, v_est, 16910.19);
  
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_inspetor, 6);
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_agente, 21);
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_auxiliar, 42);

  -- UPR de Davinópolis
  v_est := gen_random_uuid();
  INSERT INTO establishments (id, nome, localizacao, complexidade) VALUES (v_est, 'UPR de Davinópolis', 'Interior', 'Baixa Complexidade');
  
  v_cycle_est := gen_random_uuid();
  INSERT INTO cycle_establishments (id, cycle_id, establishment_id, total_orcado) VALUES (v_cycle_est, v_cycle, v_est, 11021.55);
  
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_inspetor, 8);
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_agente, 4);
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_auxiliar, 29);

  -- UPR de Godofredo Viana
  v_est := gen_random_uuid();
  INSERT INTO establishments (id, nome, localizacao, complexidade) VALUES (v_est, 'UPR de Godofredo Viana', 'Interior', 'Baixa Complexidade');
  
  v_cycle_est := gen_random_uuid();
  INSERT INTO cycle_establishments (id, cycle_id, establishment_id, total_orcado) VALUES (v_cycle_est, v_cycle, v_est, 6452.789999999999);
  
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_inspetor, 1);
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_agente, 9);
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_auxiliar, 20);

  -- UPR de Grajaú
  v_est := gen_random_uuid();
  INSERT INTO establishments (id, nome, localizacao, complexidade) VALUES (v_est, 'UPR de Grajaú', 'Interior', 'Baixa Complexidade');
  
  v_cycle_est := gen_random_uuid();
  INSERT INTO cycle_establishments (id, cycle_id, establishment_id, total_orcado) VALUES (v_cycle_est, v_cycle, v_est, 5699.209999999999);
  
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_inspetor, 1);
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_agente, 8);
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_auxiliar, 17);

  -- UPR de Imperatriz
  v_est := gen_random_uuid();
  INSERT INTO establishments (id, nome, localizacao, complexidade) VALUES (v_est, 'UPR de Imperatriz', 'Interior', 'Alta Complexidade');
  
  v_cycle_est := gen_random_uuid();
  INSERT INTO cycle_establishments (id, cycle_id, establishment_id, total_orcado) VALUES (v_cycle_est, v_cycle, v_est, 20814.46);
  
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_inspetor, 5);
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_agente, 30);
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_auxiliar, 54);

  -- UPR de Itapecuru-Mirim
  v_est := gen_random_uuid();
  INSERT INTO establishments (id, nome, localizacao, complexidade) VALUES (v_est, 'UPR de Itapecuru-Mirim', 'Interior', 'Média Complexidade');
  
  v_cycle_est := gen_random_uuid();
  INSERT INTO cycle_establishments (id, cycle_id, establishment_id, total_orcado) VALUES (v_cycle_est, v_cycle, v_est, 9696.21);
  
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_inspetor, 2);
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_agente, 12);
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_auxiliar, 31);

  -- UPR de Pinheiro
  v_est := gen_random_uuid();
  INSERT INTO establishments (id, nome, localizacao, complexidade) VALUES (v_est, 'UPR de Pinheiro', 'Interior', 'Baixa Complexidade');
  
  v_cycle_est := gen_random_uuid();
  INSERT INTO cycle_establishments (id, cycle_id, establishment_id, total_orcado) VALUES (v_cycle_est, v_cycle, v_est, 19436.059999999998);
  
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_inspetor, 1);
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_agente, 33);
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_auxiliar, 57);

  -- UPR de Porto Franco
  v_est := gen_random_uuid();
  INSERT INTO establishments (id, nome, localizacao, complexidade) VALUES (v_est, 'UPR de Porto Franco', 'Interior', 'Baixa Complexidade');
  
  v_cycle_est := gen_random_uuid();
  INSERT INTO cycle_establishments (id, cycle_id, establishment_id, total_orcado) VALUES (v_cycle_est, v_cycle, v_est, 7372.99);
  
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_inspetor, 3);
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_agente, 8);
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_auxiliar, 19);

  -- UPR de Presidente Dutra
  v_est := gen_random_uuid();
  INSERT INTO establishments (id, nome, localizacao, complexidade) VALUES (v_est, 'UPR de Presidente Dutra', 'Interior', 'Baixa Complexidade');
  
  v_cycle_est := gen_random_uuid();
  INSERT INTO cycle_establishments (id, cycle_id, establishment_id, total_orcado) VALUES (v_cycle_est, v_cycle, v_est, 6852.3099999999995);
  
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_inspetor, 2);
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_agente, 9);
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_auxiliar, 18);

  -- UPR de Rosário
  v_est := gen_random_uuid();
  INSERT INTO establishments (id, nome, localizacao, complexidade) VALUES (v_est, 'UPR de Rosário', 'Interior', 'Média Complexidade');
  
  v_cycle_est := gen_random_uuid();
  INSERT INTO cycle_establishments (id, cycle_id, establishment_id, total_orcado) VALUES (v_cycle_est, v_cycle, v_est, 11595.289999999999);
  
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_inspetor, 7);
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_agente, 8);
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_auxiliar, 29);

  -- UPR de Santa Inês
  v_est := gen_random_uuid();
  INSERT INTO establishments (id, nome, localizacao, complexidade) VALUES (v_est, 'UPR de Santa Inês', 'Interior', 'Média Complexidade');
  
  v_cycle_est := gen_random_uuid();
  INSERT INTO cycle_establishments (id, cycle_id, establishment_id, total_orcado) VALUES (v_cycle_est, v_cycle, v_est, 12114.15);
  
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_inspetor, 3);
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_agente, 17);
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_auxiliar, 32);

  -- UPR de São João dos Patos
  v_est := gen_random_uuid();
  INSERT INTO establishments (id, nome, localizacao, complexidade) VALUES (v_est, 'UPR de São João dos Patos', 'Interior', 'Baixa Complexidade');
  
  v_cycle_est := gen_random_uuid();
  INSERT INTO cycle_establishments (id, cycle_id, establishment_id, total_orcado) VALUES (v_cycle_est, v_cycle, v_est, 7431.67);
  
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_inspetor, 4);
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_agente, 6);
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_auxiliar, 19);

  -- UPR de São Luís 1
  v_est := gen_random_uuid();
  INSERT INTO establishments (id, nome, localizacao, complexidade) VALUES (v_est, 'UPR de São Luís 1', 'Capital - Complexo', 'Média Alta Complexidade');
  
  v_cycle_est := gen_random_uuid();
  INSERT INTO cycle_establishments (id, cycle_id, establishment_id, total_orcado) VALUES (v_cycle_est, v_cycle, v_est, 19805.34);
  
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_inspetor, 6);
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_agente, 32);
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_auxiliar, 38);

  -- UPR de São Luís 2
  v_est := gen_random_uuid();
  INSERT INTO establishments (id, nome, localizacao, complexidade) VALUES (v_est, 'UPR de São Luís 2', 'Capital - Complexo', 'Alta Complexidade');
  
  v_cycle_est := gen_random_uuid();
  INSERT INTO cycle_establishments (id, cycle_id, establishment_id, total_orcado) VALUES (v_cycle_est, v_cycle, v_est, 22272.53);
  
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_inspetor, 0);
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_agente, 46);
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_auxiliar, 53);

  -- UPR de São Luís 3
  v_est := gen_random_uuid();
  INSERT INTO establishments (id, nome, localizacao, complexidade) VALUES (v_est, 'UPR de São Luís 3', 'Capital - Complexo', 'Média Alta Complexidade');
  
  v_cycle_est := gen_random_uuid();
  INSERT INTO cycle_establishments (id, cycle_id, establishment_id, total_orcado) VALUES (v_cycle_est, v_cycle, v_est, 14721.52);
  
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_inspetor, 1);
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_agente, 31);
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_auxiliar, 29);

  -- UPR de São Luís 4
  v_est := gen_random_uuid();
  INSERT INTO establishments (id, nome, localizacao, complexidade) VALUES (v_est, 'UPR de São Luís 4', 'Capital - Complexo', 'Especial');
  
  v_cycle_est := gen_random_uuid();
  INSERT INTO cycle_establishments (id, cycle_id, establishment_id, total_orcado) VALUES (v_cycle_est, v_cycle, v_est, 17658.329999999998);
  
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_inspetor, 5);
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_agente, 38);
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_auxiliar, 15);

  -- UPR de São Luís 5
  v_est := gen_random_uuid();
  INSERT INTO establishments (id, nome, localizacao, complexidade) VALUES (v_est, 'UPR de São Luís 5', 'Capital - Complexo', 'Alta Complexidade');
  
  v_cycle_est := gen_random_uuid();
  INSERT INTO cycle_establishments (id, cycle_id, establishment_id, total_orcado) VALUES (v_cycle_est, v_cycle, v_est, 14500.03);
  
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_inspetor, 3);
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_agente, 31);
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_auxiliar, 18);

  -- UPR de São Luís 6
  v_est := gen_random_uuid();
  INSERT INTO establishments (id, nome, localizacao, complexidade) VALUES (v_est, 'UPR de São Luís 6', 'Capital - Complexo', 'Alta Complexidade');
  
  v_cycle_est := gen_random_uuid();
  INSERT INTO cycle_establishments (id, cycle_id, establishment_id, total_orcado) VALUES (v_cycle_est, v_cycle, v_est, 18705.3);
  
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_inspetor, 0);
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_agente, 36);
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_auxiliar, 36);

  -- UPR de São Luís 7
  v_est := gen_random_uuid();
  INSERT INTO establishments (id, nome, localizacao, complexidade) VALUES (v_est, 'UPR de São Luís 7', 'Capital - Complexo', 'Alta Complexidade');
  
  v_cycle_est := gen_random_uuid();
  INSERT INTO cycle_establishments (id, cycle_id, establishment_id, total_orcado) VALUES (v_cycle_est, v_cycle, v_est, 12447.38);
  
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_inspetor, 0);
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_agente, 20);
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_auxiliar, 42);

  -- UPR de Segurança Máxima
  v_est := gen_random_uuid();
  INSERT INTO establishments (id, nome, localizacao, complexidade) VALUES (v_est, 'UPR de Segurança Máxima', 'Capital - Complexo', 'Especial');
  
  v_cycle_est := gen_random_uuid();
  INSERT INTO cycle_establishments (id, cycle_id, establishment_id, total_orcado) VALUES (v_cycle_est, v_cycle, v_est, 23315.879999999997);
  
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_inspetor, 2);
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_agente, 50);
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_auxiliar, 42);

  -- UPR de Timon
  v_est := gen_random_uuid();
  INSERT INTO establishments (id, nome, localizacao, complexidade) VALUES (v_est, 'UPR de Timon', 'Interior', 'Alta Complexidade');
  
  v_cycle_est := gen_random_uuid();
  INSERT INTO cycle_establishments (id, cycle_id, establishment_id, total_orcado) VALUES (v_cycle_est, v_cycle, v_est, 26358.31);
  
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_inspetor, 24);
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_agente, 12);
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_auxiliar, 41);

  -- UPR de Viana
  v_est := gen_random_uuid();
  INSERT INTO establishments (id, nome, localizacao, complexidade) VALUES (v_est, 'UPR de Viana', 'Interior', 'Baixa Complexidade');
  
  v_cycle_est := gen_random_uuid();
  INSERT INTO cycle_establishments (id, cycle_id, establishment_id, total_orcado) VALUES (v_cycle_est, v_cycle, v_est, 9696.21);
  
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_inspetor, 2);
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_agente, 12);
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_auxiliar, 31);

  -- UPR de Zé Doca
  v_est := gen_random_uuid();
  INSERT INTO establishments (id, nome, localizacao, complexidade) VALUES (v_est, 'UPR de Zé Doca', 'Interior', 'Baixa Complexidade');
  
  v_cycle_est := gen_random_uuid();
  INSERT INTO cycle_establishments (id, cycle_id, establishment_id, total_orcado) VALUES (v_cycle_est, v_cycle, v_est, 7643.74);
  
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_inspetor, 1);
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_agente, 10);
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_auxiliar, 26);

  -- UPR do Anil
  v_est := gen_random_uuid();
  INSERT INTO establishments (id, nome, localizacao, complexidade) VALUES (v_est, 'UPR do Anil', 'Capital', 'Média Complexidade');
  
  v_cycle_est := gen_random_uuid();
  INSERT INTO cycle_establishments (id, cycle_id, establishment_id, total_orcado) VALUES (v_cycle_est, v_cycle, v_est, 18176.86);
  
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_inspetor, 18);
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_agente, 8);
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_auxiliar, 22);

  -- UPR do Monte Castelo
  v_est := gen_random_uuid();
  INSERT INTO establishments (id, nome, localizacao, complexidade) VALUES (v_est, 'UPR do Monte Castelo', 'Capital', 'Especial');
  
  v_cycle_est := gen_random_uuid();
  INSERT INTO cycle_establishments (id, cycle_id, establishment_id, total_orcado) VALUES (v_cycle_est, v_cycle, v_est, 13734.88);
  
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_inspetor, 14);
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_agente, 5);
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_auxiliar, 17);

  -- UPR do Olho D''Água
  v_est := gen_random_uuid();
  INSERT INTO establishments (id, nome, localizacao, complexidade) VALUES (v_est, 'UPR do Olho D''Água', 'Capital', 'Baixa Complexidade');
  
  v_cycle_est := gen_random_uuid();
  INSERT INTO cycle_establishments (id, cycle_id, establishment_id, total_orcado) VALUES (v_cycle_est, v_cycle, v_est, 23342.17);
  
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_inspetor, 19);
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_agente, 18);
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_auxiliar, 31);

  -- UPR do Paço do Lumiar
  v_est := gen_random_uuid();
  INSERT INTO establishments (id, nome, localizacao, complexidade) VALUES (v_est, 'UPR do Paço do Lumiar', 'Capital', 'Especial');
  
  v_cycle_est := gen_random_uuid();
  INSERT INTO cycle_establishments (id, cycle_id, establishment_id, total_orcado) VALUES (v_cycle_est, v_cycle, v_est, 11462.730000000001);
  
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_inspetor, 13);
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_agente, 0);
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_auxiliar, 17);

  -- UPR Feminina
  v_est := gen_random_uuid();
  INSERT INTO establishments (id, nome, localizacao, complexidade) VALUES (v_est, 'UPR Feminina', 'Capital - Complexo', 'Média Alta Complexidade');
  
  v_cycle_est := gen_random_uuid();
  INSERT INTO cycle_establishments (id, cycle_id, establishment_id, total_orcado) VALUES (v_cycle_est, v_cycle, v_est, 21052.979999999996);
  
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_inspetor, 7);
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_agente, 25);
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_auxiliar, 57);

  -- UPRS Feminina de Carolina
  v_est := gen_random_uuid();
  INSERT INTO establishments (id, nome, localizacao, complexidade) VALUES (v_est, 'UPRS Feminina de Carolina', 'Interior', 'Baixa Complexidade');
  
  v_cycle_est := gen_random_uuid();
  INSERT INTO cycle_establishments (id, cycle_id, establishment_id, total_orcado) VALUES (v_cycle_est, v_cycle, v_est, 5153.9);
  
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_inspetor, 0);
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_agente, 8);
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_auxiliar, 18);

  -- UPRS Feminina de Timon
  v_est := gen_random_uuid();
  INSERT INTO establishments (id, nome, localizacao, complexidade) VALUES (v_est, 'UPRS Feminina de Timon', 'Interior', 'Baixa Complexidade');
  
  v_cycle_est := gen_random_uuid();
  INSERT INTO cycle_establishments (id, cycle_id, establishment_id, total_orcado) VALUES (v_cycle_est, v_cycle, v_est, 7889.870000000001);
  
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_inspetor, 6);
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_agente, 4);
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_auxiliar, 17);

END $$;

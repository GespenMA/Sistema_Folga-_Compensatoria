const xlsx = require('xlsx');
const fs = require('fs');

try {
  const workbook = xlsx.readFile('C:\\Users\\jonhy\\Downloads\\Bico Legal\\Planejado por Unidade .xlsx');
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(sheet);
  
  let sql = `
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

`;

  for (const row of data) {
    const nomeUnidade = row['Estabelecimento penal'];
    if (!nomeUnidade) continue;
    
    // Some values might be missing or parsed as string, so we ensure they are numbers
    const totalOrcado = parseFloat(row['Total orçado'] || 0).toFixed(2);
    const inspetor = parseInt(row['Inspetor de Policia Penal'] || 0, 10);
    const agente = parseInt(row['Agente Penitenciário Temporário'] || 0, 10);
    const auxiliar = parseInt(row['Auxiliar de Segurança Penitenciário'] || 0, 10);
    
    // Replace single quotes in names to avoid breaking SQL
    const safeName = nomeUnidade.replace(/'/g, "''");

    sql += `
  -- --------------------------------------------------------
  -- ${nomeUnidade}
  -- --------------------------------------------------------
  SELECT id INTO v_est_id FROM establishments WHERE nome = '${safeName}' LIMIT 1;
  IF v_est_id IS NOT NULL THEN
     
     -- Atualiza ou insere o orçamento no cycle_establishments
     INSERT INTO cycle_establishments (cycle_id, establishment_id, total_orcado)
     VALUES (v_cycle_id, v_est_id, ${totalOrcado})
     ON CONFLICT (cycle_id, establishment_id) DO UPDATE SET total_orcado = EXCLUDED.total_orcado
     RETURNING id INTO v_ce_id;

     -- Limites: Inspetor
     IF v_pos_inspetor IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_inspetor, ${inspetor})
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

     -- Limites: Agente
     IF v_pos_agente IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_agente, ${agente})
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

     -- Limites: Auxiliar
     IF v_pos_auxiliar IS NOT NULL THEN
       INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)
       VALUES (v_ce_id, v_pos_auxiliar, ${auxiliar})
       ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;
     END IF;

  END IF;
`;
  }

  sql += `
END $$;
`;

  fs.writeFileSync('C:\\Projetos\\SEAP\\Sistema - Folga Compensatória\\atualizar_planejado.sql', sql);
  console.log("SQL gerado com sucesso em atualizar_planejado.sql!");
} catch (e) {
  console.error(e);
}

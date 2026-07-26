const xlsx = require('xlsx');
const fs = require('fs');

async function runImport() {
  console.log('Gerando script SQL...');

  const workbook = xlsx.readFile('C:\\Users\\jonhy\\Downloads\\Bico Legal\\Planejado por Unidade .xlsx');
  const data = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

  let sql = `-- SCRIPT GERADO AUTOMATICAMENTE PARA ATUALIZAR O ORÇAMENTO E LIMITES PLANEJADOS\n\n`;
  sql += `DO $$\nDECLARE\n`;
  sql += `  v_cycle_id UUID;\n`;
  sql += `  v_est_id UUID;\n`;
  sql += `  v_ce_id UUID;\n`;
  sql += `  v_insp_id UUID;\n`;
  sql += `  v_apt_id UUID;\n`;
  sql += `  v_asp_id UUID;\n`;
  sql += `BEGIN\n`;
  
  sql += `  -- Pegar IDs base\n`;
  sql += `  SELECT id INTO v_insp_id FROM positions WHERE codigo = 'INSP';\n`;
  sql += `  SELECT id INTO v_apt_id FROM positions WHERE codigo = 'APT';\n`;
  sql += `  SELECT id INTO v_asp_id FROM positions WHERE codigo = 'ASP';\n`;

  sql += `  -- Pegar o ciclo mais recente que NÃO está fechado\n`;
  sql += `  SELECT id INTO v_cycle_id FROM cycles WHERE status IN ('RASCUNHO', 'ABERTO', 'REABERTO') ORDER BY created_at DESC LIMIT 1;\n`;
  sql += `  IF v_cycle_id IS NULL THEN\n`;
  sql += `    RAISE EXCEPTION 'Nenhum ciclo aberto ou em rascunho encontrado!';\n`;
  sql += `  END IF;\n\n`;

  for (const row of data) {
    let nome = row['Estabelecimento penal'];
    if (!nome) continue;
    
    // Escapar aspas simples
    nome = nome.replace(/'/g, "''");
    const local = (row['Localização'] || '').replace(/'/g, "''");
    const comp = (row['Complexidade'] || '').replace(/'/g, "''");
    const tipo = (local.includes('Apoio') ? 'Unidade de apoio' : 'Unidade prisional');
    const totalOrcado = parseFloat(row['Total orçado']) || 0;
    
    const qtyInsp = parseInt(row['Inspetor de Policia Penal']) || 0;
    const qtyApt = parseInt(row['Agente Penitenciário Temporário']) || 0;
    const qtyAsp = parseInt(row['Auxiliar de Segurança Penitenciário']) || 0;

    sql += `  -- ==========================================\n`;
    sql += `  -- Unidade: ${nome}\n`;
    sql += `  -- ==========================================\n`;
    sql += `  SELECT id INTO v_est_id FROM establishments WHERE nome ILIKE '${nome}';\n`;
    sql += `  IF v_est_id IS NULL THEN\n`;
    sql += `    INSERT INTO establishments (nome, localizacao, complexidade, tipo) VALUES ('${nome}', '${local}', '${comp}', '${tipo}') RETURNING id INTO v_est_id;\n`;
    sql += `  END IF;\n\n`;

    sql += `  SELECT id INTO v_ce_id FROM cycle_establishments WHERE cycle_id = v_cycle_id AND establishment_id = v_est_id;\n`;
    sql += `  IF v_ce_id IS NULL THEN\n`;
    sql += `    INSERT INTO cycle_establishments (cycle_id, establishment_id, total_orcado) VALUES (v_cycle_id, v_est_id, ${totalOrcado}) RETURNING id INTO v_ce_id;\n`;
    sql += `  ELSE\n`;
    sql += `    UPDATE cycle_establishments SET total_orcado = ${totalOrcado} WHERE id = v_ce_id;\n`;
    sql += `  END IF;\n\n`;

    sql += `  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)\n`;
    sql += `  VALUES (v_ce_id, v_insp_id, ${qtyInsp})\n`;
    sql += `  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;\n\n`;

    sql += `  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)\n`;
    sql += `  VALUES (v_ce_id, v_apt_id, ${qtyApt})\n`;
    sql += `  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;\n\n`;

    sql += `  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada)\n`;
    sql += `  VALUES (v_ce_id, v_asp_id, ${qtyAsp})\n`;
    sql += `  ON CONFLICT (cycle_establishment_id, position_id) DO UPDATE SET quantidade_planejada = EXCLUDED.quantidade_planejada;\n\n`;
  }

  sql += `END;\n$$;\n`;

  fs.writeFileSync('C:\\Projetos\\SEAP\\Sistema - Folga Compensatória\\database\\03_import_planilha.sql', sql);
  console.log('✅ Arquivo 03_import_planilha.sql gerado com sucesso!');
}

runImport().catch(console.error);

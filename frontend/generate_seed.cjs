const xlsx = require('xlsx');
const fs = require('fs');

try {
  const workbook = xlsx.readFile('C:\\Users\\jonhy\\Downloads\\Bico Legal\\Planejado por Unidade .xlsx');
  const sheet_name_list = workbook.SheetNames;
  const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheet_name_list[0]]);
  
  let sql = `-- Seed from Excel
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

`;

  data.forEach((row) => {
    const nome = row['Estabelecimento penal'] ? row['Estabelecimento penal'].replace(/'/g, "''") : '';
    const loc = row['Localização'] ? row['Localização'].replace(/'/g, "''") : '';
    const comp = row['Complexidade'] ? row['Complexidade'].replace(/'/g, "''") : '';
    
    // Some rows might be totals or empty
    if (!nome || nome.toLowerCase() === 'total') return;

    const orcado = row['Total orçado'] || 0;
    const qtdInsp = row['Inspetor de Policia Penal'] || 0;
    const qtdAgt = row['Agente Penitenciário Temporário'] || 0;
    const qtdAux = row['Auxiliar de Segurança Penitenciário'] || 0;

    sql += `
  -- ${nome}
  v_est := gen_random_uuid();
  INSERT INTO establishments (id, nome, localizacao, complexidade) VALUES (v_est, '${nome}', '${loc}', '${comp}');
  
  v_cycle_est := gen_random_uuid();
  INSERT INTO cycle_establishments (id, cycle_id, establishment_id, total_orcado) VALUES (v_cycle_est, v_cycle, v_est, ${orcado});
  
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_inspetor, ${qtdInsp});
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_agente, ${qtdAgt});
  INSERT INTO planning_limits (cycle_establishment_id, position_id, quantidade_planejada) VALUES (v_cycle_est, v_auxiliar, ${qtdAux});
`;
  });

  sql += `
END $$;
`;

  fs.writeFileSync('seed_excel.sql', sql);
  console.log("SQL gerado com sucesso em seed_excel.sql");
} catch (e) {
  console.error("Error generating SQL:", e);
}

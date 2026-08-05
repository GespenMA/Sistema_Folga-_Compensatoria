const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://kpieihxfwuoqxsiysezk.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtwaWVpaHhmd3VvcXhzaXlzZXprIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTAzNjMzNiwiZXhwIjoyMTAwNjEyMzM2fQ.ity7JhqLS_dqOjW8eWgFo46SX3HB8j4UVCtEo3zcBCc';
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const EST_ID = '7f44a19e-798f-4fb7-8404-51ab4409adf5'; // Unidade Teste
const CYCLE_ID = 'c42b3235-ab1b-44c9-a311-28bef60ddc2a'; // Ciclo REABERTO

async function run() {
  const { data: employees, error: empErr } = await supabase
    .from('employees')
    .select('id, nome')
    .eq('establishment_id', EST_ID);

  if (empErr) {
    console.error('Erro ao buscar servidores:', empErr);
    return;
  }

  // 180h = 15 plantões
  // 256h = 21 plantões
  // 320h = 26 plantões
  const testShifts = [15, 21, 26];

  const shiftsToInsert = employees.map((emp, index) => {
    // Distribui os valores de forma circular
    const qty = testShifts[index % testShifts.length];
    
    return {
      employee_id: emp.id,
      cycle_id: CYCLE_ID,
      periodo_inicio: '2026-07-26',
      periodo_fim: '2026-08-25',
      quantidade_plantoes: qty,
      minutos_residuais: qty * 720, // Simulando que tudo foram horas trabalhadas inteiras
      observacao: `Gerado via script de teste: ${qty * 12} horas`
    };
  });

  console.log('Inserindo plantões para gerar folgas...');
  const { error: shiftErr } = await supabase.from('shifts').insert(shiftsToInsert);

  if (shiftErr) {
    console.error('Erro ao inserir plantões:', shiftErr);
  } else {
    console.log(`✅ Sucesso! Plantões lançados para ${shiftsToInsert.length} servidores.`);
    console.log('As folgas compensatórias foram calculadas e geradas automaticamente pelos Triggers do banco!');
  }
}

run();

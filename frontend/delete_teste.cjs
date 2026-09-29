const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envLocal = fs.readFileSync('.env.local', 'utf8');
const VITE_SUPABASE_URL = envLocal.match(/VITE_SUPABASE_URL=(.*)/)[1];
const SUPABASE_SERVICE_ROLE_KEY = envLocal.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1];

const supabase = createClient(VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function deleteData() {
  console.log('Buscando ciclo de agosto e Unidade teste...');
  
  // Find Cycle
  const { data: cycles, error: cycleErr } = await supabase
    .from('cycles')
    .select('id, nome')
    .ilike('nome', '%agosto%');

  if (cycleErr || !cycles || cycles.length === 0) {
    console.error('Ciclo de agosto não encontrado.', cycleErr);
    return;
  }
  const cycle = cycles[0];
  console.log(`Ciclo encontrado: ${cycle.nome} (${cycle.id})`);

  // Find Establishment
  const { data: ests, error: estErr } = await supabase
    .from('establishments')
    .select('id, nome')
    .ilike('nome', '%Unidade teste%');

  if (estErr || !ests || ests.length === 0) {
    console.error('Unidade teste não encontrada.', estErr);
    return;
  }
  const est = ests[0];
  console.log(`Estabelecimento encontrado: ${est.nome} (${est.id})`);

  // Delete records
  console.log('Deletando lançamentos...');

  const { error: err1 } = await supabase
    .from('shifts')
    .delete()
    .eq('cycle_id', cycle.id)
    .eq('establishment_id', est.id);
  if (err1) console.error('Erro ao deletar shifts:', err1);
  else console.log('Shifts (plantões) deletados.');

  const { error: err2 } = await supabase
    .from('compensatory_days')
    .delete()
    .eq('cycle_id', cycle.id)
    .eq('establishment_id', est.id);
  if (err2) console.error('Erro ao deletar compensatory_days:', err2);
  else console.log('Compensatory days (folgas) deletadas.');

  const { error: err3 } = await supabase
    .from('purchase_requests')
    .delete()
    .eq('cycle_id', cycle.id)
    .eq('establishment_id', est.id);
  if (err3) console.error('Erro ao deletar purchase_requests:', err3);
  else console.log('Purchase requests (vendas de folga/plantão plus) deletadas.');

  console.log('Processo finalizado.');
}

deleteData();

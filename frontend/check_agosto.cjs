const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envLocal = fs.readFileSync('.env.local', 'utf8');
const VITE_SUPABASE_URL = envLocal.match(/VITE_SUPABASE_URL=(.*)/)[1];
const SUPABASE_SERVICE_ROLE_KEY = envLocal.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1];

const supabase = createClient(VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkData() {
  console.log('Buscando ciclo de agosto...');
  const { data: cycles, error: cycleErr } = await supabase
    .from('cycles')
    .select('id, nome, mes, ano')
    .ilike('nome', '%agosto%');

  if (cycleErr || !cycles || cycles.length === 0) {
    console.error('Ciclo de agosto não encontrado.', cycleErr);
    return;
  }
  const cycle = cycles[0];
  console.log(`Ciclo encontrado: ${cycle.nome} (${cycle.id})`);

  // Buscando position_values
  const { data: pvs } = await supabase.from('position_values').select('valor, position_id').is('vigencia_fim', null);
  const pvMap = {};
  if (pvs) pvs.forEach(p => pvMap[p.position_id] = Number(p.valor));

  // Buscando purchase_requests
  const { data: reqs, error: reqErr } = await supabase
    .from('purchase_requests')
    .select('id, valor, status, position_id, tipo_solicitacao, establishment_id, establishments (nome)')
    .eq('cycle_id', cycle.id)
    .in('status', ['APROVADA', 'SOLICITADA']);

  if (reqErr) {
    console.error('Erro nas requests:', reqErr);
    return;
  }

  let totalGasto = 0;
  let totalFolga = 0;
  let totalPlus = 0;

  console.log(`Encontradas ${reqs.length} solicitações (Aprovadas/Solicitadas).`);
  reqs.forEach(r => {
    let val = Number(r.valor);
    if (!val && r.position_id && pvMap[r.position_id]) {
      val = pvMap[r.position_id];
    }
    val = val || 0;
    totalGasto += val;

    if (r.tipo_solicitacao === 'FOLGA_COMPENSATORIA') totalFolga += val;
    if (r.tipo_solicitacao === 'PLANTAO_PLUS') totalPlus += val;
  });

  console.log(`Total Gasto (Aprovadas + Solicitadas): R$ ${totalGasto.toFixed(2)}`);
  console.log(`- Plantão Plus: R$ ${totalPlus.toFixed(2)}`);
  console.log(`- Folga Compensatória: R$ ${totalFolga.toFixed(2)}`);
}

checkData();

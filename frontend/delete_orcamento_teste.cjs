const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function deleteOrcamento() {
  const { data: cycle, error: cycleErr } = await supabase
    .from('cycles')
    .select('id, nome')
    .ilike('nome', '%Agosto%2026%')
    .single();

  if (cycleErr) {
    console.error('Erro ciclo:', cycleErr);
    return;
  }
  
  const { data: est, error: estErr } = await supabase
    .from('establishments')
    .select('id, nome')
    .ilike('nome', '%Teste%')
    .single();
    
  if (estErr) {
    console.error('Erro unidade:', estErr);
    return;
  }
  
  console.log(`Apagando orçamento do ciclo ${cycle.nome} para a unidade ${est.nome}`);
  
  // Update cycle_establishments to 0
  const { error: updErr } = await supabase
    .from('cycle_establishments')
    .update({ total_orcado: 0 })
    .eq('cycle_id', cycle.id)
    .eq('establishment_id', est.id);
    
  if (updErr) console.error('Erro ao atualizar total_orcado:', updErr);
  else console.log('total_orcado atualizado para 0');
  
  // Delete planning_limits for this cycle_establishment
  const { data: ce } = await supabase
    .from('cycle_establishments')
    .select('id')
    .eq('cycle_id', cycle.id)
    .eq('establishment_id', est.id)
    .single();
    
  if (ce) {
    const { error: plErr } = await supabase
      .from('planning_limits')
      .delete()
      .eq('cycle_establishment_id', ce.id);
      
    if (plErr) console.error('Erro ao apagar planning_limits:', plErr);
    else console.log('Cotas de planejamento (planning_limits) apagadas.');
  }

  console.log('Feito!');
}

deleteOrcamento();

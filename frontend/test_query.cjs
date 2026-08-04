const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env.local');
const envFile = fs.readFileSync(envPath, 'utf8');
const supabaseUrl = envFile.match(/VITE_SUPABASE_URL=(.*)/)[1];
const supabaseKey = envFile.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1];

const supabase = createClient(supabaseUrl, supabaseKey);

async function testQuery() {
  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'admin@seap.ma.gov.br',
    password: 'admin'
  });

  const { data, error } = await supabase
    .from('establishments')
    .select(`
      *,
      cycle_establishments (
        id,
        cycle_id,
        total_orcado,
        planning_limits (
          position_id,
          quantidade_planejada,
          positions ( codigo )
        )
      )
    `)
    .limit(1);
    
  if (error) {
    console.error('Query error:', error);
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
}

testQuery();

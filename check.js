const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'frontend/.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data, error } = await supabase.from('cycle_establishments').select('*, planning_limits(*)');
  console.log(JSON.stringify(data, null, 2));
  console.log('Error:', error);
}

check();

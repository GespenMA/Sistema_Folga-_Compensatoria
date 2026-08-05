const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://kpieihxfwuoqxsiysezk.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtwaWVpaHhmd3VvcXhzaXlzZXprIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTAzNjMzNiwiZXhwIjoyMTAwNjEyMzM2fQ.ity7JhqLS_dqOjW8eWgFo46SX3HB8j4UVCtEo3zcBCc';
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const EST_ID = '7f44a19e-798f-4fb7-8404-51ab4409adf5'; // Unidade Teste

const cargos = [
  { id: '6844a366-7ce4-45d7-b8c1-25d4a9d3390d', sigla: 'INSP', prefix: 'Inspetor', count: 2 },
  { id: '072f8280-c45f-403e-a2fd-8ee46da7371a', sigla: 'APT', prefix: 'Agente', count: 3 },
  { id: '775a277e-999f-405c-818e-55acf21f635e', sigla: 'ASP', prefix: 'Auxiliar', count: 10 }
];

async function generate() {
  const employees = [];
  
  for (const cargo of cargos) {
    for (let i = 1; i <= cargo.count; i++) {
      // Gera uma matrícula aleatória de 6 dígitos começando com a sigla do cargo para ficar bonito
      const numMatricula = Math.floor(Math.random() * 900000) + 100000;
      employees.push({
        establishment_id: EST_ID,
        matricula: `${cargo.sigla}${numMatricula}`,
        nome: `${cargo.prefix} Teste Fictício ${i}`,
        data_admissao: '2024-01-01',
        position_id: cargo.id,
        ativo: true
      });
    }
  }

  console.log('Inserindo servidores...');
  const { data, error } = await supabase.from('employees').insert(employees);
  
  if (error) {
    console.error('Erro ao inserir:', error);
  } else {
    console.log('✅ Sucesso! 15 servidores fictícios criados na Unidade Teste.');
  }
}

generate();

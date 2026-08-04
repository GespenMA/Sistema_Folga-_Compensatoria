const { createClient } = require('@supabase/supabase-js');
const xlsx = require('xlsx');
const fs = require('fs');
const crypto = require('crypto');

// ============================================================================
// CONFIGURAÇÕES
// ============================================================================
// ATENÇÃO: Insira suas chaves aqui ANTES de rodar o script
const SUPABASE_URL = 'https://kpieihxfwuoqxsiysezk.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtwaWVpaHhmd3VvcXhzaXlzZXprIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTAzNjMzNiwiZXhwIjoyMTAwNjEyMzM2fQ.ity7JhqLS_dqOjW8eWgFo46SX3HB8j4UVCtEo3zcBCc'; // NÃO USE A ANON KEY

const EXCEL_PATH = 'C:\\Users\\jonhy\\Downloads\\Base sistema - SIFOC\\Lista de email - Unidades.xlsm';
const OUTPUT_CSV_PATH = 'acessos_gerados.csv';

// Inicializa o Supabase com poderes de Admin
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Função para gerar senha aleatória (ex: A#b9XyZ2)
function generateRandomPassword() {
  return crypto.randomBytes(6).toString('base64').replace(/[^a-zA-Z0-9]/g, '') + 'A@1';
}

async function run() {
  console.log('Iniciando script de importação...');

  // 1. Ler o arquivo Excel
  if (!fs.existsSync(EXCEL_PATH)) {
    console.error(`Arquivo Excel não encontrado em: ${EXCEL_PATH}`);
    process.exit(1);
  }

  const workbook = xlsx.readFile(EXCEL_PATH);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(sheet);

  if (data.length === 0) {
    console.error('A planilha está vazia.');
    process.exit(1);
  }

  // Tentar descobrir as colunas de nome e email dinamicamente
  const nomeCol = 'UNIDADES';
  const emailCol = 'E-MAIL';

  console.log(`Usando as colunas -> Unidade: "${nomeCol}", Email: "${emailCol}"`);

  // 2. Buscar todos os estabelecimentos no banco de dados para cruzar os IDs
  const { data: establishments, error: dbError } = await supabase
    .from('establishments')
    .select('id, nome');

  if (dbError) {
    console.error('Erro ao buscar estabelecimentos no banco:', dbError);
    process.exit(1);
  }

  console.log(`Encontrados ${establishments.length} estabelecimentos no banco.`);

  const acessosGerados = [];
  const errors = [];

  // 3. Processar cada linha da planilha
  for (const row of data) {
    const nomeUnidade = row[nomeCol];
    let email = row[emailCol];

    if (!nomeUnidade || !email) continue;
    email = email.toString().trim().toLowerCase();

    // Encontrar o estabelecimento no banco (comparação ignorando case e espaços)
    const dbEstablishment = establishments.find(
      e => e.nome.trim().toLowerCase() === nomeUnidade.toString().trim().toLowerCase()
    );

    if (!dbEstablishment) {
      console.warn(`⚠️ Estabelecimento ignorado (não existe no banco): ${nomeUnidade}`);
      continue;
    }

    const password = generateRandomPassword();

    try {
      // Cria o usuário na aba Auth (Admin API ignora confirmação de e-mail e RLS)
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true,
      });

      if (authError) {
        // Se o usuário já existir, logamos o erro, mas não paramos o script
        console.error(`Erro ao criar Auth para ${email}:`, authError.message);
        errors.push({ unidade: nomeUnidade, email, erro: authError.message });
        continue;
      }

      const userId = authData.user.id;

      // Inserir na tabela profiles (usando upsert para garantir)
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: userId,
          nome: nomeUnidade,
          email: email,
          perfil: 'ESTABELECIMENTO',
          establishment_id: dbEstablishment.id,
          ativo: true,
          must_change_password: true // Opcional, pois é o DEFAULT, mas bom reforçar
        });

      if (profileError) {
        console.error(`Erro ao criar Perfil para ${email}:`, profileError.message);
        errors.push({ unidade: nomeUnidade, email, erro: profileError.message });
        // Em um script real, poderíamos tentar excluir o auth se falhar, mas vamos deixar simples
      } else {
        console.log(`✅ Acesso criado: ${nomeUnidade} -> ${email}`);
        acessosGerados.push({
          Unidade: nomeUnidade,
          Email: email,
          Senha: password
        });
      }
    } catch (err) {
      console.error(`Erro inesperado para ${email}:`, err);
    }
  }

  // 4. Salvar o arquivo CSV final
  if (acessosGerados.length > 0) {
    const csvHeader = 'Unidade,Email,Senha\n';
    const csvContent = acessosGerados.map(a => `"${a.Unidade}","${a.Email}","${a.Senha}"`).join('\n');
    fs.writeFileSync(OUTPUT_CSV_PATH, csvHeader + csvContent, 'utf-8');
    console.log(`\n🎉 Script concluído! ${acessosGerados.length} acessos gerados e salvos em ${OUTPUT_CSV_PATH}`);
  } else {
    console.log('\nNenhum acesso novo foi gerado.');
  }

  if (errors.length > 0) {
    console.log('\nErros encontrados:');
    console.table(errors);
  }
}

run();

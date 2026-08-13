import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('As variáveis de ambiente do Supabase estão ausentes.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// O Supabase/PostgREST corta silenciosamente os resultados em 1000 linhas por
// padrão quando a query não usa `.range()`. Qualquer busca sem filtro que limite
// naturalmente o tamanho (uma unidade, um servidor, um único registro) precisa
// passar por aqui — não confiar em `.select()` sozinho para tabelas que podem
// crescer além disso (employees, shifts, compensatory_days, purchase_requests já
// passaram dessa marca em produção).
export const fetchAll = async <T = any>(query: any): Promise<T[]> => {
  let allData: T[] = [];
  let from = 0;
  const step = 1000;
  while (true) {
    const { data, error } = await query.range(from, from + step - 1);
    if (error) throw error;
    if (data && data.length > 0) {
      allData = allData.concat(data);
    }
    if (!data || data.length < step) break;
    from += step;
  }
  return allData;
};

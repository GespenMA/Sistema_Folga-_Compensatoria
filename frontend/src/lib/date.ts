// Fuso horário oficial do sistema (SEAP-MA opera em horário de Brasília, UTC-3, sem
// horário de verão desde 2019 — mesmo fuso de todo o Maranhão).
const BRAZIL_TZ = 'America/Sao_Paulo';

// Data de hoje (YYYY-MM-DD) no calendário do Brasil, independente do fuso horário do
// navegador/servidor onde o app está rodando. Sem isso, `new Date()` usa o fuso local da
// máquina do usuário, que pode divergir do horário de Brasília.
export function hojeNoBrasil(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: BRAZIL_TZ }).format(new Date());
}

// Diferença em dias de calendário entre duas datas "YYYY-MM-DD" (colunas DATE do banco,
// sem componente de hora). Ambas ancoradas em T00:00:00Z apenas para ter uma base comum de
// subtração — não representa nenhum instante real, só a contagem de dias entre as duas
// datas civis.
export function diffDiasCalendario(dataInicioStr: string, dataFimStr: string): number {
  const inicio = new Date(dataInicioStr + 'T00:00:00Z').getTime();
  const fim = new Date(dataFimStr + 'T00:00:00Z').getTime();
  return Math.round((fim - inicio) / (1000 * 60 * 60 * 24));
}

// Dias restantes até uma data-limite (YYYY-MM-DD), contando a partir de "hoje" no
// calendário do Brasil. Nunca negativo.
export function diasRestantesAte(dataFimStr: string): number {
  return Math.max(0, diffDiasCalendario(hojeNoBrasil(), dataFimStr));
}

// Corrige erro de ponto flutuante em somas/subtrações de dinheiro feitas no cliente. Somar
// várias parcelas em `number` do JS (ex: 13734.88 - soma de 34 solicitações) pode resultar em
// algo como 691.0999999999967 em vez de 691.10 exatos — o NUMERIC do Postgres é exato, mas o
// `number` do JS não é. Isso é inofensivo pra exibição (`toFixed(2)` já arredonda), mas quebra
// comparações `>`/`<`: um lançamento que cabe exatamente no saldo pode ser bloqueado à toa.
// Por isso todo "orçamento disponível" calculado no cliente deve passar por aqui antes de
// entrar numa comparação.
export function roundCents(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

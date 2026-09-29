export type PaymentReportFields = {
  folgas_compradas_qtd: number;
  plantao_plus_qtd: number;
  valor_folga_comp: number;
  valor_plantao_plus: number;
  total_a_pagar: number;
  datas_plantao: string[];
};

export type ApprovedPurchase = {
  tipo_solicitacao: 'FOLGA_COMPENSATORIA' | 'PLANTAO_PLUS' | string;
  valor: number | string | null;
  data_plantao?: string | null;
};

export function applyApprovedPurchaseToReportRow(
  row: PaymentReportFields,
  purchase: ApprovedPurchase,
): void {
  const valor = Number(purchase.valor) || 0;

  if (purchase.tipo_solicitacao === 'PLANTAO_PLUS') {
    row.plantao_plus_qtd++;
    row.valor_plantao_plus += valor;
  } else if (purchase.tipo_solicitacao === 'FOLGA_COMPENSATORIA') {
    row.folgas_compradas_qtd++;
    row.valor_folga_comp += valor;
  }

  row.total_a_pagar = row.valor_folga_comp + row.valor_plantao_plus;
  if (purchase.data_plantao) row.datas_plantao.push(purchase.data_plantao);
}

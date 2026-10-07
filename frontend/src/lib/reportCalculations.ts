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

export type PlusPayment = {
  status: string;
  valor: number | string | null;
};

export function allowsCompensatoryLoad(
  scheduleType: { permite_carga_horaria?: boolean } | null | undefined,
) {
  return scheduleType?.permite_carga_horaria !== false;
}

export function getEmployeeStatementTitle(showCompensatoryLoad: boolean) {
  return showCompensatoryLoad
    ? 'EXTRATO INDIVIDUAL DE FOLGAS E PLANTÃO PLUS'
    : 'EXTRATO INDIVIDUAL - FOLGA COMPENSATÓRIA';
}

export function formatReportShiftCount(
  count: number,
  mode: 'normal' | 'deduction' | 'estimate' = 'normal',
) {
  if (mode === 'deduction') return `-${count} plantões`;
  if (mode === 'estimate') return `aprox. ${count} plantões`;
  return `${count} plantões`;
}

export function summarizeApprovedPlusPayments(payments: PlusPayment[]) {
  return payments.reduce(
    (summary, payment) => {
      if (payment.status === 'APROVADA') {
        summary.approvedCount++;
        summary.approvedAmount += Number(payment.valor) || 0;
      }
      return summary;
    },
    { approvedCount: 0, approvedAmount: 0 },
  );
}

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

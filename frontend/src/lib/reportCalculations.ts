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

export function getEmployeeStatementTitle(_showCompensatoryLoad: boolean) {
  return 'EXTRATO INDIVIDUAL - FOLGA COMPENSATÓRIA';
}

type StatementDay = {
  status: string;
  generated_at?: string | null;
  used_at?: string | null;
  purchase_requests?: { requested_at?: string | null } | Array<{ requested_at?: string | null }> | null;
};

type StatementPlus = PlusPayment & {
  data_plantao?: string | null;
};

const statementMonthNames = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const getYearMonth = (value?: string | null) => {
  if (!value) return null;
  const match = value.match(/^(\d{4})-(\d{2})/);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]) - 1 };
};

export function buildAnnualStatementSummary(
  year: number,
  days: StatementDay[],
  plusPayments: StatementPlus[],
) {
  const summary = statementMonthNames.map((month) => ({
    month,
    generatedDays: 0,
    enjoyedDays: 0,
    indemnifiedDays: 0,
    approvedPlus: 0,
    approvedPlusAmount: 0,
  }));

  days.forEach((day) => {
    const generated = getYearMonth(day.generated_at);
    if (generated?.year === year) summary[generated.month].generatedDays++;

    const enjoyed = getYearMonth(day.used_at);
    if (day.status === 'USUFRUIDA' && enjoyed?.year === year) {
      summary[enjoyed.month].enjoyedDays++;
    }

    const request = Array.isArray(day.purchase_requests)
      ? day.purchase_requests[0]
      : day.purchase_requests;
    const indemnified = getYearMonth(request?.requested_at);
    if (day.status === 'INDENIZADA' && indemnified?.year === year) {
      summary[indemnified.month].indemnifiedDays++;
    }
  });

  plusPayments.forEach((payment) => {
    const worked = getYearMonth(payment.data_plantao);
    if (payment.status !== 'APROVADA' || worked?.year !== year) return;
    summary[worked.month].approvedPlus++;
    summary[worked.month].approvedPlusAmount += Number(payment.valor) || 0;
  });

  return summary;
}

export function statementMonthHasEvents(month: {
  generatedDays: number;
  enjoyedDays: number;
  indemnifiedDays: number;
  approvedPlus: number;
  approvedPlusAmount: number;
}) {
  return month.generatedDays > 0
    || month.enjoyedDays > 0
    || month.indemnifiedDays > 0
    || month.approvedPlus > 0
    || month.approvedPlusAmount > 0;
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

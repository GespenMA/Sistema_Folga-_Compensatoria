import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyApprovedPurchaseToReportRow,
  allowsCompensatoryLoad,
  formatReportShiftCount,
  getEmployeeStatementTitle,
  summarizeApprovedPlusPayments,
} from './reportCalculations.ts';

const emptyPayment = () => ({
  folgas_compradas_qtd: 0,
  plantao_plus_qtd: 0,
  valor_folga_comp: 0,
  valor_plantao_plus: 0,
  total_a_pagar: 0,
  datas_plantao: [] as string[],
});

test('conta a folga comprada no ciclo de pagamento mesmo quando o direito nasceu em ciclo anterior', () => {
  const row = emptyPayment();

  applyApprovedPurchaseToReportRow(row, {
    tipo_solicitacao: 'FOLGA_COMPENSATORIA',
    valor: 316.21,
    data_plantao: '2026-09-10',
  });

  assert.deepEqual(row, {
    folgas_compradas_qtd: 1,
    plantao_plus_qtd: 0,
    valor_folga_comp: 316.21,
    valor_plantao_plus: 0,
    total_a_pagar: 316.21,
    datas_plantao: ['2026-09-10'],
  });
});

test('conta Plantão Plus e mantém os valores separados', () => {
  const row = emptyPayment();

  applyApprovedPurchaseToReportRow(row, {
    tipo_solicitacao: 'PLANTAO_PLUS',
    valor: 145.79,
    data_plantao: '2026-09-12',
  });

  assert.deepEqual(row, {
    folgas_compradas_qtd: 0,
    plantao_plus_qtd: 1,
    valor_folga_comp: 0,
    valor_plantao_plus: 145.79,
    total_a_pagar: 145.79,
    datas_plantao: ['2026-09-12'],
  });
});

test('resume como recebido somente o Plantão Plus aprovado', () => {
  const summary = summarizeApprovedPlusPayments([
    { status: 'APROVADA', valor: 316.21 },
    { status: 'SOLICITADA', valor: 200 },
    { status: 'REJEITADA', valor: 150 },
    { status: 'APROVADA', valor: '100.50' },
  ]);

  assert.deepEqual(summary, {
    approvedCount: 2,
    approvedAmount: 416.71,
  });
});

test('formata quantidades de plantões sem símbolos ambíguos no PDF', () => {
  assert.equal(formatReportShiftCount(42, 'deduction'), '-42 plantões');
  assert.equal(formatReportShiftCount(19, 'estimate'), 'aprox. 19 plantões');
  assert.equal(formatReportShiftCount(2), '2 plantões');
});

test('oculta carga horária quando a escala permite somente Plantão Plus', () => {
  assert.equal(allowsCompensatoryLoad({ permite_carga_horaria: false }), false);
  assert.equal(allowsCompensatoryLoad({ permite_carga_horaria: true }), true);
  assert.equal(allowsCompensatoryLoad(null), true);
});

test('usa o título solicitado quando a carga horária está desativada', () => {
  assert.equal(
    getEmployeeStatementTitle(false),
    'EXTRATO INDIVIDUAL - FOLGA COMPENSATÓRIA',
  );
});

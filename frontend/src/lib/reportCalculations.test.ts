import test from 'node:test';
import assert from 'node:assert/strict';
import { applyApprovedPurchaseToReportRow } from './reportCalculations.ts';

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

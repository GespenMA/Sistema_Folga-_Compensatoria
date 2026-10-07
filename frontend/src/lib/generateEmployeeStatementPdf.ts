import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  allowsCompensatoryLoad,
  formatReportShiftCount,
  getEmployeeStatementTitle,
  summarizeApprovedPlusPayments,
} from './reportCalculations';

type EmployeeStatementData = {
  employee: any;
  shifts: any[];
  folgas: any[];
  plusRequests: any[];
};

const TARGET_MINUTES = 252 * 60;

const formatDate = (value?: string | null) => {
  if (!value) return '—';
  const date = value.length === 10 ? new Date(`${value}T12:00:00Z`) : new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('pt-BR');
};

const formatHours = (minutes: number) => {
  const sign = minutes < 0 ? '-' : '';
  const absolute = Math.abs(minutes);
  return `${sign}${Math.floor(absolute / 60)}h${String(absolute % 60).padStart(2, '0')}`;
};

const formatCurrency = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const plusStatus = (status: string) => {
  if (status === 'APROVADA') return 'Aprovada';
  if (status === 'REJEITADA') return 'Rejeitada';
  return 'Em análise';
};

const folgaStatus = (status: string) => {
  if (status === 'GERADA') return 'Disponível';
  if (status === 'USUFRUIDA') return 'Gozada';
  if (status === 'INDENIZADA') return 'Indenizada';
  if (status === 'INDENIZACAO_SOLICITADA') return 'Em análise';
  return status;
};

const loadLogo = async () => {
  const image = new Image();
  image.src = '/seap-logo.png';
  await new Promise<void>((resolve) => {
    image.onload = () => resolve();
    image.onerror = () => resolve();
  });
  return image;
};

export async function generateEmployeeStatementPdf({
  employee,
  shifts,
  folgas,
  plusRequests,
}: EmployeeStatementData) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const left = 14;
  const contentWidth = pageWidth - 28;
  const navy: [number, number, number] = [38, 59, 85];
  const slate: [number, number, number] = [71, 84, 103];
  const green: [number, number, number] = [51, 116, 91];
  const light: [number, number, number] = [246, 248, 250];
  const border: [number, number, number] = [203, 211, 220];
  const emittedAt = new Date();
  const emittedLabel = emittedAt.toLocaleString('pt-BR');
  const logo = await loadLogo();

  const saldoMinutes = ((employee.saldo_plantoes || 0) * 720) + (employee.saldo_minutos || 0);
  const missingMinutes = Math.max(0, TARGET_MINUTES - saldoMinutes);
  const progress = Math.min(100, Math.max(0, (saldoMinutes / TARGET_MINUTES) * 100));
  const totalWorkedShifts = shifts.reduce((sum, shift) => sum + (shift.quantidade_plantoes || 0), 0);
  const totalWorkedMinutes = totalWorkedShifts * 720;
  const usedShifts = folgas.length * 21;
  const usedMinutes = usedShifts * 720;
  const adjustmentMinutes = saldoMinutes - (totalWorkedMinutes - usedMinutes);
  const availableCount = folgas.filter((item) => item.status === 'GERADA').length;
  const enjoyedCount = folgas.filter((item) => item.status === 'USUFRUIDA').length;
  const approvedPlus = summarizeApprovedPlusPayments(plusRequests);
  const showCompensatoryLoad = allowsCompensatoryLoad(employee.schedule_types);
  const unitName = shifts.find((item) => item.establishments?.nome)?.establishments?.nome
    || plusRequests.find((item) => item.establishments?.nome)?.establishments?.nome
    || folgas.find((item) => item.establishments?.nome)?.establishments?.nome
    || 'Não informada';

  const sectionTitle = (title: string, y: number) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...navy);
    doc.text(title, left, y);
    doc.setDrawColor(...navy);
    doc.setLineWidth(0.55);
    doc.line(left, y + 1.7, pageWidth - left, y + 1.7);
    return y + 5;
  };

  if (logo.complete && logo.naturalHeight) doc.addImage(logo, 'PNG', left, 10, 17, 19);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.setTextColor(...navy);
  doc.text('Governo do Estado do Maranhão', pageWidth / 2, 15, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.4);
  doc.setTextColor(...slate);
  doc.text('Secretaria de Estado de Administração Penitenciária — SEAP', pageWidth / 2, 20, { align: 'center' });
  doc.text('Sistema de Folga Compensatória', pageWidth / 2, 24, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(...navy);
  doc.text('Compensa+', pageWidth - left, 16, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...slate);
  doc.text('Extrato individual', pageWidth - left, 21, { align: 'right' });
  doc.setDrawColor(...navy);
  doc.line(left, 31, pageWidth - left, 31);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15.5);
  doc.setTextColor(...navy);
  doc.text(
    getEmployeeStatementTitle(showCompensatoryLoad),
    pageWidth / 2,
    40,
    { align: 'center' },
  );
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.4);
  doc.setTextColor(...slate);
  doc.text(
    showCompensatoryLoad
      ? 'Posição individual de saldo, concessões e registros operacionais'
      : 'Registros financeiros de Plantão Plus',
    pageWidth / 2,
    45,
    { align: 'center' },
  );

  const identityRows = [
    ['Nome', employee.nome || '—', 'Matrícula', String(employee.matricula || '—'), 'Cargo', employee.positions?.nome || employee.positions?.codigo || '—'],
    ['Escala', employee.schedule_types?.nome || 'Não definida', 'Unidade', unitName, 'Emissão', emittedLabel],
  ];
  autoTable(doc, {
    startY: 49,
    theme: 'grid',
    body: identityRows.map((row) => [
      `${row[0]}\n${row[1]}`, `${row[2]}\n${row[3]}`, `${row[4]}\n${row[5]}`,
    ]),
    styles: { fontSize: 7.2, cellPadding: 2.4, lineColor: border, fillColor: light, textColor: [29, 41, 57] },
    columnStyles: { 0: { cellWidth: 82 }, 1: { cellWidth: 40 }, 2: { cellWidth: 60 } },
  });

  let y = (doc as any).lastAutoTable.finalY + 6;
  if (showCompensatoryLoad) {
  y = sectionTitle('Situação atual', y);
  const cards = [
    ['Folgas disponíveis', String(availableCount), 'Liberadas para uso'],
    ['Folgas gozadas', String(enjoyedCount), 'Gozo registrado'],
    ['Saldo para próxima folga', formatHours(saldoMinutes), 'Saldo atual acumulado'],
    ['Falta para próxima folga', formatHours(missingMinutes), `Aprox. ${Math.ceil(missingMinutes / 720)} plantões`],
  ];
  const cardWidth = (contentWidth - 6) / 4;
  cards.forEach((card, index) => {
    const x = left + index * (cardWidth + 2);
    doc.setFillColor(...light);
    doc.setDrawColor(...border);
    doc.rect(x, y, cardWidth, 22, 'FD');
    doc.setFillColor(...(index === 0 ? green : navy));
    doc.rect(x, y, cardWidth, 1.2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.1);
    doc.setTextColor(...slate);
    doc.text(card[0], x + 2.5, y + 6, { maxWidth: cardWidth - 5 });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14.5);
    doc.setTextColor(...(index === 0 ? green : navy));
    doc.text(card[1], x + 2.5, y + 13.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.8);
    doc.setTextColor(...slate);
    doc.text(card[2], x + 2.5, y + 19, { maxWidth: cardWidth - 5 });
  });
  y += 27;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...navy);
  doc.text('Progresso para próxima folga', left, y);
  doc.text(`${progress.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`, pageWidth - left, y, { align: 'right' });
  doc.setFillColor(227, 231, 236);
  doc.rect(left, y + 2, contentWidth, 4.2, 'F');
  doc.setFillColor(...green);
  doc.rect(left, y + 2, contentWidth * (progress / 100), 4.2, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.2);
  doc.setTextColor(...slate);
  doc.text(`${formatHours(saldoMinutes)} acumuladas`, left, y + 9);
  doc.text('Meta: 252h', pageWidth / 2, y + 9, { align: 'center' });
  doc.text(`Faltam: ${formatHours(missingMinutes)}`, pageWidth - left, y + 9, { align: 'right' });

  y = sectionTitle('Histórico de folgas', y + 15);
  autoTable(doc, {
    startY: y,
    head: [['Nº', 'Ciclo de origem', 'Situação', 'Concessão', 'Gozo', 'Indenização', 'Carga utilizada']],
    body: folgas.length ? folgas.map((item, index) => {
      const request = Array.isArray(item.purchase_requests) ? item.purchase_requests[0] : item.purchase_requests;
      const indemnity = item.status === 'INDENIZADA'
        ? `${formatDate(request?.data_plantao || request?.requested_at)}\n${formatCurrency(Number(request?.valor) || 0)}`
        : '—';
      return [
        String(index + 1).padStart(2, '0'), item.cycles?.nome || 'Ciclo legado', folgaStatus(item.status),
        formatDate(item.generated_at), item.status === 'USUFRUIDA' ? formatDate(item.used_at) : '—',
        indemnity, `${item.quantidade_plantoes || 21} plantões\n${(item.quantidade_plantoes || 21) * 12}h`,
      ];
    }) : [['—', '—', 'Nenhuma folga gerada', '—', '—', '—', '—']],
    headStyles: { fillColor: navy, textColor: [255, 255, 255], fontSize: 6.2 },
    styles: { fontSize: 6.2, cellPadding: 1.6, lineColor: border, overflow: 'linebreak' },
    columnStyles: { 0: { cellWidth: 11 }, 1: { cellWidth: 29 }, 2: { cellWidth: 25 }, 3: { cellWidth: 25 }, 4: { cellWidth: 21 }, 5: { cellWidth: 35 }, 6: { cellWidth: 36 } },
    margin: { left, right: left },
  });

  y = sectionTitle('Memória do saldo', (doc as any).lastAutoTable.finalY + 6);
  const adjustmentLabel = adjustmentMinutes === 0 ? '—' : formatHours(adjustmentMinutes);
  autoTable(doc, {
    startY: y,
    head: [['Descrição', 'Plantões', 'Carga horária', 'Conferência']],
    body: [
      ['Total computado', formatReportShiftCount(totalWorkedShifts), formatHours(totalWorkedMinutes), 'Histórico'],
      ['Carga utilizada para gerar folgas', formatReportShiftCount(usedShifts, 'deduction'), formatHours(-usedMinutes), `${folgas.length} folga(s) gerada(s)`],
      ['Saldo/ajustes anteriores', '—', adjustmentLabel, adjustmentMinutes === 0 ? 'Sem diferença' : 'Origem não discriminada'],
      ['Saldo atual', formatReportShiftCount(employee.saldo_plantoes || 0), formatHours(saldoMinutes), 'Saldo do sistema'],
      ['Falta para próxima folga', formatReportShiftCount(Math.ceil(missingMinutes / 720), 'estimate'), formatHours(missingMinutes), 'Meta de 252h'],
    ],
    headStyles: { fillColor: navy, textColor: [255, 255, 255], fontSize: 6.4 },
    styles: { fontSize: 6.4, cellPadding: 1.6, lineColor: border },
    columnStyles: { 0: { cellWidth: 75, fontStyle: 'bold' }, 1: { cellWidth: 35 }, 2: { cellWidth: 35 }, 3: { cellWidth: 37 } },
    margin: { left, right: left },
    didParseCell: (data) => {
      if (data.section === 'body' && data.row.index === 2 && adjustmentMinutes !== 0) data.cell.styles.fillColor = [255, 248, 233];
      if (data.section === 'body' && data.row.index === 3) data.cell.styles.fillColor = [237, 245, 241];
    },
  });
  if (adjustmentMinutes !== 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.8);
    doc.setTextColor(...slate);
    doc.text(`A diferença de ${formatHours(adjustmentMinutes)} é exibida separadamente; sua origem não é presumida pelo relatório.`, left, (doc as any).lastAutoTable.finalY + 3.5);
  }

  } else {
    y = sectionTitle('Regime da escala', y);
    doc.setFillColor(241, 246, 243);
    doc.setDrawColor(...green);
    doc.rect(left, y, contentWidth, 24, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...green);
    doc.text('Escala configurada para somente Plantão Plus', left + 4, y + 7);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(...slate);
    doc.text('Este servidor não acumula carga horária e não gera folgas compensatórias.', left + 4, y + 13);
    doc.text('Por isso, saldos, metas, progresso, folgas e memória de carga não são exibidos neste extrato.', left + 4, y + 18);
    y += 30;
  }

  if (showCompensatoryLoad) {
  doc.addPage();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(...navy);
  doc.text('Histórico operacional', left, 17);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(...slate);
  doc.text('Registros considerados na formação da carga horária e no Plantão Plus', left, 22);

  y = sectionTitle('Histórico de plantões trabalhados', 30);
  autoTable(doc, {
    startY: y,
    head: [['Período', 'Ciclo', 'Estabelecimento', 'Plantões', 'Carga horária', 'Observação']],
    body: shifts.length ? shifts.map((item) => [
      item.periodo_inicio && item.periodo_fim ? `${formatDate(item.periodo_inicio)} a ${formatDate(item.periodo_fim)}` : '—',
      item.cycles?.nome || '—', item.establishments?.nome || '—', String(item.quantidade_plantoes || 0),
      formatHours((item.quantidade_plantoes || 0) * 720), item.observacao || '—',
    ]) : [['—', '—', 'Nenhum plantão computado', '—', '—', '—']],
    headStyles: { fillColor: navy, textColor: [255, 255, 255], fontSize: 6.2 },
    styles: { fontSize: 6.1, cellPadding: 1.8, lineColor: border },
    columnStyles: { 0: { cellWidth: 39 }, 1: { cellWidth: 29 }, 2: { cellWidth: 52 }, 3: { cellWidth: 19 }, 4: { cellWidth: 24 }, 5: { cellWidth: 19 } },
    margin: { left, right: left },
  });

  y = (doc as any).lastAutoTable.finalY + 7;
  }

  y = sectionTitle('Histórico de Plantão Plus', y);
  const summaryWidth = (contentWidth - 4) / 2;
  doc.setFillColor(...light);
  doc.setDrawColor(...border);
  doc.rect(left, y, summaryWidth, 13, 'FD');
  doc.rect(left + summaryWidth + 4, y, summaryWidth, 13, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.3);
  doc.setTextColor(...slate);
  doc.text('Plantões Plus aprovados', left + 3, y + 7.5);
  doc.text('Total efetivamente aprovado', left + summaryWidth + 7, y + 7.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...navy);
  doc.text(String(approvedPlus.approvedCount), left + summaryWidth - 3, y + 8, { align: 'right' });
  doc.text(formatCurrency(approvedPlus.approvedAmount), pageWidth - left - 3, y + 8, { align: 'right' });

  autoTable(doc, {
    startY: y + 17,
    head: [['Data', 'Estabelecimento', 'Situação', 'Valor recebido', 'Solicitação', 'Justificativa da convocação']],
    body: plusRequests.length ? plusRequests.map((item) => [
      formatDate(item.data_plantao), item.establishments?.nome || '—', plusStatus(item.status),
      item.status === 'APROVADA' ? formatCurrency(Number(item.valor) || 0) : '—',
      formatDate(item.requested_at), item.justificativa || '—',
    ]) : [['—', '—', 'Nenhum Plantão Plus', '—', '—', '—']],
    headStyles: { fillColor: navy, textColor: [255, 255, 255], fontSize: 6.1 },
    styles: { fontSize: 6.1, cellPadding: 1.7, lineColor: border, overflow: 'linebreak' },
    columnStyles: { 0: { cellWidth: 24 }, 1: { cellWidth: 42 }, 2: { cellWidth: 23 }, 3: { cellWidth: 28, fontStyle: 'bold' }, 4: { cellWidth: 25 }, 5: { cellWidth: 40 } },
    margin: { left, right: left },
  });

  y = Math.max((doc as any).lastAutoTable.finalY + 18, 205);
  if (y > pageHeight - 42) {
    doc.addPage();
    y = 35;
  }
  y = sectionTitle('Assinaturas', y);
  doc.setDrawColor(...navy);
  doc.line(left, y + 17, left + 78, y + 17);
  doc.line(pageWidth - left - 78, y + 17, pageWidth - left, y + 17);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...navy);
  doc.text('Ciência do servidor', left + 39, y + 22, { align: 'center' });
  doc.text('Chefia imediata', pageWidth - left - 39, y + 22, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.3);
  doc.setTextColor(...slate);
  doc.text(`${employee.nome || 'Servidor'} · Matrícula ${employee.matricula || '—'}`, left + 39, y + 26, { align: 'center', maxWidth: 78 });
  doc.text('Nome, matrícula e assinatura', pageWidth - left - 39, y + 26, { align: 'center' });

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page);
    doc.setDrawColor(...border);
    doc.line(left, pageHeight - 12, pageWidth - left, pageHeight - 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.2);
    doc.setTextColor(...slate);
    doc.text('Documento emitido pelo Sistema Compensa+', left, pageHeight - 8);
    doc.text(`${emittedLabel} · Página ${page} de ${pageCount}`, pageWidth - left, pageHeight - 8, { align: 'right' });
  }

  doc.save(`Extrato_${employee.matricula}_${emittedAt.toISOString().split('T')[0]}.pdf`);
}

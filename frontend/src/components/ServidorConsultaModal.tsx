import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Download } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Modal de consulta, SOMENTE LEITURA, do histórico de um servidor — usado pelos
// perfis ADMIN e GESTAO na tela "Consulta Global de Servidores"
// (admin/Servidores.tsx). Independente do modal de detalhe usado em
// estabelecimento/Folgas.tsx (Lançamento de Plantões) — mesma informação exibida,
// mas construído à parte de propósito, pra não arriscar nenhuma regressão numa
// tela que já está em produção. Sem nenhum botão de ação (nem Lançar Plus): é
// consulta, não interfere em nada.

type EmployeeDetalhe = {
  id: string;
  nome: string;
  matricula: string;
  saldo_plantoes: number;
  saldo_minutos?: number;
  positions?: { nome: string; codigo: string } | null;
  schedule_types?: { nome?: string; permite_carga_horaria: boolean } | null;
};

const folgaStatusMeta = (status: string) => {
  switch (status) {
    case 'GERADA': return { label: '✅ Disponível para uso', bg: 'rgba(16,185,129,0.1)', color: '#10b981' };
    case 'INDENIZACAO_SOLICITADA': return { label: '⏳ Indenização em aprovação', bg: 'rgba(234,179,8,0.1)', color: '#eab308' };
    case 'INDENIZADA': return { label: '💰 Indenizada', bg: 'rgba(59,130,246,0.1)', color: '#3b82f6' };
    case 'USUFRUIDA': return { label: '🏖️ Usufruída', bg: 'rgba(239,68,68,0.1)', color: '#ef4444' };
    default: return { label: status, bg: 'rgba(239,68,68,0.1)', color: '#ef4444' };
  }
};

export const ServidorConsultaModal: React.FC<{ employeeId: string | null; onClose: () => void }> = ({ employeeId, onClose }) => {
  const [employee, setEmployee] = useState<EmployeeDetalhe | null>(null);
  const [shifts, setShifts] = useState<any[]>([]);
  const [folgas, setFolgas] = useState<any[]>([]);
  const [plusRequests, setPlusRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'folgas' | 'plantoes' | 'plus'>('folgas');

  const handleDownloadPDF = async () => {
    if (!employee) return;
    
    // Carregar logo (usando a logo existente na pasta public do projeto)
    const img = new Image();
    img.src = '/seap-logo.png';
    await new Promise((resolve) => {
      img.onload = resolve;
      img.onerror = resolve; // se falhar, segue sem logo
    });

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    
    // Cabeçalho Oficial
    if (img.complete && img.naturalHeight !== 0) {
      doc.addImage(img, 'PNG', 14, 14, 18, 18);
    }
    
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('GOVERNO DO ESTADO DO MARANHÃO', 36, 18);
    doc.setFontSize(9);
    doc.text('SECRETARIA DE ESTADO DE ADMINISTRAÇÃO PENITENCIÁRIA - SEAP', 36, 23);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text('SISTEMA DE FOLGA COMPENSATÓRIA — COMPENSA+', 36, 28);
    
    // Título do Documento
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('EXTRATO OFICIAL DE SALDOS E LANÇAMENTOS', pageWidth / 2, 40, { align: 'center' });
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('Demonstrativo Individual de Carga Horária, Fruição de Folgas e Plantão Plus', pageWidth / 2, 45, { align: 'center' });
    doc.setTextColor(0, 0, 0);

    // Cálculos de Resumo e Balanço Contábil
    const saldoPlant = employee.saldo_plantoes || 0;
    const saldoMin = employee.saldo_minutos || 0;
    const totalMinutos = (saldoPlant * 720) + saldoMin;
    const horas = Math.floor(totalMinutos / 60);
    const min = totalMinutos % 60;
    
    const permiteCargaPDF = employee.schedule_types?.permite_carga_horaria !== false;

    // Totais de Plantões Trabalhados
    const totalPlantoesTrabalhados = shifts.reduce((acc, s) => acc + (s.quantidade_plantoes || 0), 0);
    const totalHorasTrabalhadas = totalPlantoesTrabalhados * 12;

    // Folgas e abatimentos
    const totalFolgasGeradas = folgas.length;
    const plantoesAbatidos = totalFolgasGeradas * 21;
    const horasAbatidas = plantoesAbatidos * 12;

    const folgasUsufruidas = folgas.filter(f => f.status === 'USUFRUIDA');
    const folgasIndenizadas = folgas.filter(f => f.status === 'INDENIZADA');
    const folgasSolicitadas = folgas.filter(f => f.status === 'INDENIZACAO_SOLICITADA');
    const folgasDisponiveis = folgas.filter(f => f.status === 'GERADA');

    const totalValorIndenizado = folgasIndenizadas.reduce((acc, f) => {
      const pr = Array.isArray(f.purchase_requests) ? f.purchase_requests[0] : f.purchase_requests;
      return acc + (Number(pr?.valor) || 0);
    }, 0);

    const valorTotalPlus = plusRequests.reduce((acc, p) => acc + (Number(p.valor) || 0), 0);

    // 1. Box de Identificação do Servidor
    doc.setDrawColor(203, 213, 225);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, 50, pageWidth - 28, 20, 2, 2, 'FD');

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Servidor:', 18, 56);
    doc.setFont('helvetica', 'bold');
    doc.text(employee.nome, 33, 56);

    doc.setFont('helvetica', 'normal');
    doc.text('Matrícula:', 135, 56);
    doc.setFont('helvetica', 'bold');
    doc.text(String(employee.matricula), 152, 56);

    const cargoNome = employee.positions?.nome || employee.positions?.codigo || '-';
    const escalaNome = employee.schedule_types?.nome || 'Não definida';
    const modalidadeStr = permiteCargaPDF ? 'Carga Horária + Plus' : 'Só Plantão Plus';

    doc.setFont('helvetica', 'normal');
    doc.text('Cargo:', 18, 64);
    doc.setFont('helvetica', 'bold');
    doc.text(cargoNome, 31, 64);

    doc.setFont('helvetica', 'normal');
    doc.text('Escala:', 95, 64);
    doc.setFont('helvetica', 'bold');
    doc.text(`${escalaNome} (${modalidadeStr})`, 108, 64);

    // 2. Quadro Demonstrativo Contábil e de Abatimentos
    let finalY = 74;
    if (permiteCargaPDF) {
      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text('1. Conciliação Contábil de Carga Horária e Abatimentos', 14, finalY);

      const minFaltam = Math.max(0, 15120 - totalMinutos);
      const horasFaltam = Math.floor(minFaltam / 60);
      const minRestam = minFaltam % 60;
      const plantoesFaltam = Math.ceil(minFaltam / 720);

      autoTable(doc, {
        startY: finalY + 3,
        head: [['Rubrica / Evento Contábil', 'Plantões', 'Carga Horária', 'Discriminação / Regra de Amortização']],
        headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        styles: { fontSize: 7.5, cellPadding: 2.2 },
        columnStyles: {
          0: { cellWidth: 54, fontStyle: 'bold' },
          1: { cellWidth: 22, halign: 'center' },
          2: { cellWidth: 26, halign: 'center' },
          3: { cellWidth: 'auto' },
        },
        body: [
          [
            '(+) Total Trabalhado no Histórico',
            `${totalPlantoesTrabalhados} pl.`,
            `${totalHorasTrabalhadas}h 00m`,
            'Soma de plantões apurados nos ciclos de escalas importados'
          ],
          [
            '(-) Abatimento p/ Folgas Concedidas',
            `-${plantoesAbatidos} pl.`,
            `-${horasAbatidas}h 00m`,
            `${totalFolgasGeradas} folga(s) gerada(s) (baixa regulamentar de 21 plantões / 252h por folga)`
          ],
          [
            '(=) Saldo Atual em Andamento',
            `${saldoPlant} pl.`,
            `${horas}h ${String(min).padStart(2, '0')}m`,
            'Saldo residual acumulando em direção à próxima folga (meta: 252h)'
          ],
          [
            'Pendente p/ Próxima Concessão',
            `~${plantoesFaltam} pl.`,
            `${horasFaltam}h ${String(minRestam).padStart(2, '0')}m`,
            'Carga faltante para completar o ciclo de 252h e gerar nova folga'
          ]
        ],
        didParseCell: (data) => {
          if (data.section === 'body') {
            if (data.row.index === 1) {
              data.cell.styles.textColor = [185, 28, 28]; // Vermelho para o abatimento
              data.cell.styles.fontStyle = 'bold';
            } else if (data.row.index === 2) {
              data.cell.styles.textColor = [29, 78, 216]; // Azul para o saldo atual
              data.cell.styles.fillColor = [239, 246, 255]; // Fundo azul suave
              data.cell.styles.fontStyle = 'bold';
            }
          }
        }
      });

      finalY = (doc as any).lastAutoTable.finalY + 8;

      // Resumo de Fruição / Destino das Folgas Geradas
      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(`2. Destino e Fruição das Folgas Concedidas (${totalFolgasGeradas} folga(s) gerada(s) no total)`, 14, finalY);

      autoTable(doc, {
        startY: finalY + 3,
        head: [['Destino / Modalidade', 'Quantidade', 'Carga Equivalente', 'Detalhamento / Posição Atual']],
        headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        styles: { fontSize: 7.5, cellPadding: 2.2 },
        columnStyles: {
          0: { cellWidth: 54, fontStyle: 'bold' },
          1: { cellWidth: 22, halign: 'center' },
          2: { cellWidth: 26, halign: 'center' },
          3: { cellWidth: 'auto' },
        },
        body: [
          [
            'Gozadas (Descanso)',
            `${folgasUsufruidas.length}`,
            `${folgasUsufruidas.length * 252}h`,
            folgasUsufruidas.length > 0 ? 'Fruição de descanso comprovada em registro de ponto' : 'Nenhuma folga usufruída até o momento'
          ],
          [
            'Indenizadas (Venda)',
            `${folgasIndenizadas.length}`,
            `${folgasIndenizadas.length * 252}h`,
            totalValorIndenizado > 0 ? `Total pago ao servidor: R$ ${totalValorIndenizado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : (folgasIndenizadas.length > 0 ? 'Indenização financeira efetivada' : 'Nenhuma folga indenizada')
          ],
          [
            'Em Análise / Solicitação',
            `${folgasSolicitadas.length}`,
            `${folgasSolicitadas.length * 252}h`,
            folgasSolicitadas.length > 0 ? 'Solicitação de indenização pendente de portaria/aprovação' : 'Nenhuma solicitação pendente'
          ],
          [
            'Disponíveis (Saldo Livre)',
            `${folgasDisponiveis.length}`,
            `${folgasDisponiveis.length * 252}h`,
            folgasDisponiveis.length > 0 ? 'Folga ativa e liberada para agendamento de gozo ou venda' : 'Sem folgas ativas pendentes de uso'
          ]
        ],
        didParseCell: (data) => {
          if (data.section === 'body') {
            if (data.row.index === 3 && folgasDisponiveis.length > 0) {
              data.cell.styles.textColor = [16, 185, 129]; // Verde
              data.cell.styles.fontStyle = 'bold';
            }
          }
        }
      });

      finalY = (doc as any).lastAutoTable.finalY + 9;
    } else {
      // Box Só Plus
      doc.setDrawColor(203, 213, 225);
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(14, finalY, pageWidth - 28, 22, 2, 2, 'FD');

      doc.setFillColor(241, 245, 249);
      doc.rect(14, finalY, pageWidth - 28, 7, 'F');
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text('REGIME DE TRABALHO: SÓ PLANTÃO PLUS (SEM ACÚMULO DE CARGA HORÁRIA)', 18, finalY + 5);

      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text('Servidor vinculado a regime exclusivo de Plantão Plus — não acumula carga horária nem gera folga compensatória.', 18, finalY + 13);
      doc.text(`Total de Plantão Plus Lançado: ${plusRequests.length} lançamento(s)  |  Valor Total Acumulado: R$ ${valorTotalPlus.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 18, finalY + 18);

      finalY += 27;
    }

    // 3. Tabela de Folgas Compensatórias
    if (permiteCargaPDF && folgas.length > 0) {
      if (finalY > pageHeight - 40) { doc.addPage(); finalY = 20; }
      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text('3. Relação Individualizada de Folgas Concedidas', 14, finalY);

      autoTable(doc, {
        startY: finalY + 3,
        head: [['Item', 'Ciclo Origem', 'Custo Baixado', 'Situação / Destino', 'Data do Evento', 'Comprovante / Detalhe']],
        headStyles: { fillColor: [5, 150, 105], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        styles: { fontSize: 7.5, cellPadding: 2.2 },
        columnStyles: {
          0: { cellWidth: 14, halign: 'center' },
          1: { cellWidth: 30 },
          2: { cellWidth: 26, halign: 'center' },
          3: { cellWidth: 38 },
          4: { cellWidth: 36 },
          5: { cellWidth: 'auto' },
        },
        body: folgas.flatMap((f: any, idx: number) => {
          const req = Array.isArray(f.purchase_requests) ? f.purchase_requests[0] : f.purchase_requests;
          const reqDataPlantao = req?.data_plantao || null;
          const prValor = req?.valor ? Number(req.valor) : null;

          let situacao = f.status;
          let dataEvento = '-';
          let detalhe = '-';

          if (f.status === 'USUFRUIDA') {
            situacao = 'GOZADA (Descanso)';
            dataEvento = f.used_at ? `Gozo: ${new Date(f.used_at + 'T12:00:00Z').toLocaleDateString('pt-BR')}` : 'Data não informada';
            detalhe = 'Registrado no Ponto';
          } else if (f.status === 'INDENIZADA') {
            situacao = 'INDENIZADA (Paga)';
            dataEvento = reqDataPlantao ? `Plantão: ${new Date(reqDataPlantao + 'T12:00:00Z').toLocaleDateString('pt-BR')}` : (f.generated_at ? `Concessão: ${new Date(f.generated_at).toLocaleDateString('pt-BR')}` : '-');
            detalhe = prValor ? `R$ ${prValor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'Indenização Efetivada';
          } else if (f.status === 'INDENIZACAO_SOLICITADA') {
            situacao = 'EM ANÁLISE';
            dataEvento = reqDataPlantao ? `Plantão: ${new Date(reqDataPlantao + 'T12:00:00Z').toLocaleDateString('pt-BR')}` : '-';
            detalhe = prValor ? `R$ ${prValor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (Solicitado)` : 'Aguardando Aprovação';
          } else if (f.status === 'GERADA') {
            situacao = 'DISPONÍVEL (Saldo Ativo)';
            dataEvento = f.generated_at ? `Concedida: ${new Date(f.generated_at).toLocaleDateString('pt-BR')}` : '-';
            detalhe = 'Pronta p/ Gozo ou Indenização';
          }

          const mainRow = [
            `#${String(folgas.length - idx).padStart(2, '0')}`,
            f.cycles?.nome || 'Ciclo Legado',
            '252h (21 pl.)',
            situacao,
            dataEvento,
            detalhe
          ];

          const subParts: string[] = [];
          if (req) {
            const unidNome = req.establishments?.nome || f.establishments?.nome || null;
            const reqDataStr = req.requested_at ? new Date(req.requested_at).toLocaleDateString('pt-BR') : null;
            if (unidNome || reqDataStr) {
              subParts.push(`Unidade Solicitante: ${unidNome || 'Não informada'}${reqDataStr ? ` (Solicitado em ${reqDataStr})` : ''}`);
            }
            if (req.justificativa) {
              subParts.push(`Justificativa Administrativa da Unidade: "${req.justificativa}"`);
            }
            if (req.rejection_reason) {
              subParts.push(`Motivo da Recusa pela SEAP: "${req.rejection_reason}"`);
            }
          } else if (f.status === 'USUFRUIDA') {
            const dataGozoStr = f.used_at ? new Date(f.used_at + 'T12:00:00Z').toLocaleDateString('pt-BR') : 'data registrada';
            subParts.push(`Usufruto Efetivo: Folga usufruída na escala em ${dataGozoStr} com comprovação em frequência.`);
          }

          if (subParts.length > 0) {
            const subRow = [{
              content: subParts.map(p => `   * ${p}`).join('\n'),
              colSpan: 6,
              styles: {
                fontSize: 6.8,
                textColor: [71, 85, 105],
                fillColor: [248, 250, 252],
                fontStyle: 'normal' as const,
                cellPadding: { top: 1.2, bottom: 2, left: 14, right: 6 }
              }
            }];
            return [mainRow, subRow];
          }

          return [mainRow];
        }),
      });
      finalY = (doc as any).lastAutoTable.finalY + 9;
    }

    // 4. Histórico de Plantões Trabalhados (Entradas de Carga Horária)
    if (permiteCargaPDF && shifts.length > 0) {
      if (finalY > pageHeight - 40) { doc.addPage(); finalY = 20; }
      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text('4. Histórico de Plantões Trabalhados (Entradas de Carga Horária)', 14, finalY);

      autoTable(doc, {
        startY: finalY + 3,
        head: [['Período de Vigência', 'Ciclo', 'Estabelecimento', 'Plantões', 'Carga Horária', 'Observação']],
        headStyles: { fillColor: [71, 85, 105], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        styles: { fontSize: 7.5, cellPadding: 2.2 },
        columnStyles: {
          0: { cellWidth: 40 },
          1: { cellWidth: 28 },
          2: { cellWidth: 46 },
          3: { cellWidth: 20, halign: 'center' },
          4: { cellWidth: 24, halign: 'center' },
          5: { cellWidth: 'auto' },
        },
        body: shifts.map((s: any) => [
          s.periodo_inicio && s.periodo_fim ? `${new Date(s.periodo_inicio).toLocaleDateString('pt-BR')} a ${new Date(s.periodo_fim).toLocaleDateString('pt-BR')}` : '-',
          s.cycles?.nome || '-',
          s.establishments?.nome || '-',
          `${s.quantidade_plantoes} pl.`,
          `${s.quantidade_plantoes * 12}h 00m`,
          s.observacao || '-'
        ]),
      });
      finalY = (doc as any).lastAutoTable.finalY + 9;
    }

    // 5. Histórico de Plantão Plus
    if (plusRequests.length > 0) {
      if (finalY > pageHeight - 40) { doc.addPage(); finalY = 20; }
      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      const tituloPlus = permiteCargaPDF ? '5. Histórico de Plantão Plus (Remuneração Extraordinária)' : 'Histórico de Plantão Plus (Remuneração Extraordinária)';
      doc.text(tituloPlus, 14, finalY);

      autoTable(doc, {
        startY: finalY + 3,
        head: [['Data do Plantão', 'Estabelecimento', 'Situação', 'Valor (R$)', 'Data da Solicitação']],
        headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        styles: { fontSize: 7.5, cellPadding: 2.2 },
        columnStyles: {
          0: { cellWidth: 30 },
          1: { cellWidth: 52 },
          2: { cellWidth: 32 },
          3: { cellWidth: 30, halign: 'right' },
          4: { cellWidth: 'auto' },
        },
        body: plusRequests.flatMap((p: any) => {
          const mainRow = [
            new Date(p.data_plantao).toLocaleDateString('pt-BR'),
            p.establishments?.nome || '-',
            p.status === 'APROVADA' ? 'APROVADA' : p.status === 'REJEITADA' ? 'REJEITADA' : 'SOLICITADA',
            `R$ ${Number(p.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
            new Date(p.requested_at).toLocaleDateString('pt-BR')
          ];

          const subParts: string[] = [];
          if (p.justificativa) {
            subParts.push(`Justificativa da Convocação da Unidade: "${p.justificativa}"`);
          }
          if (p.rejection_reason) {
            subParts.push(`Motivo da Recusa pela SEAP: "${p.rejection_reason}"`);
          }

          if (subParts.length > 0) {
            const subRow = [{
              content: subParts.map(s => `   * ${s}`).join('\n'),
              colSpan: 5,
              styles: {
                fontSize: 6.8,
                textColor: [71, 85, 105],
                fillColor: [248, 250, 252],
                fontStyle: 'normal' as const,
                cellPadding: { top: 1.2, bottom: 2, left: 14, right: 6 }
              }
            }];
            return [mainRow, subRow];
          }

          return [mainRow];
        }),
      });
      finalY = (doc as any).lastAutoTable.finalY + 9;
    }

    // 6. Termo de Conferência e Assinaturas
    if (finalY > pageHeight - 45) { doc.addPage(); finalY = 30; } else { finalY += 15; }

    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'italic');
    doc.text('Atesto para os devidos fins que as informações acima conferem com os registros operacionais da unidade prisional.', pageWidth / 2, finalY, { align: 'center' });
    finalY += 16;

    doc.setDrawColor(71, 85, 105);
    doc.line(25, finalY, 85, finalY); // Linha Servidor
    doc.line(125, finalY, 185, finalY); // Linha Chefia
    
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text('Assinatura do Servidor', 55, finalY + 4, { align: 'center' });
    doc.text('Chefia Imediata (Carimbo e Assinatura)', 155, finalY + 4, { align: 'center' });

    // 7. Paginação e Rodapé Oficial em todas as páginas
    const pageCount = (doc.internal as any).getNumberOfPages ? (doc.internal as any).getNumberOfPages() : doc.getNumberOfPages();
    const dataHora = new Date().toLocaleString('pt-BR');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setDrawColor(226, 232, 240);
      doc.line(14, pageHeight - 12, pageWidth - 14, pageHeight - 12);
      doc.text(`Documento emitido pelo Sistema Compensa+ (SEAP-MA) em ${dataHora}`, 14, pageHeight - 8);
      doc.text(`Página ${i} de ${pageCount}`, pageWidth - 14, pageHeight - 8, { align: 'right' });
    }

    doc.save(`Extrato_${employee.matricula}_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  useEffect(() => {
    if (!employeeId) return;
    setTab('folgas');
    setEmployee(null);
    setShifts([]);
    setFolgas([]);
    setPlusRequests([]);
    setLoading(true);

    (async () => {
      try {
        const [{ data: empData }, { data: shiftsData }, { data: folgasData }, { data: plusData }] = await Promise.all([
          supabase
            .from('employees')
            .select('id, nome, matricula, saldo_plantoes, saldo_minutos, positions(nome, codigo), schedule_types(nome, permite_carga_horaria)')
            .eq('id', employeeId)
            .single(),
          supabase
            .from('shifts')
            .select('id, cycle_id, periodo_inicio, periodo_fim, quantidade_plantoes, observacao, created_at, minutos_residuais, cycles(nome), establishments(nome)')
            .eq('employee_id', employeeId)
            .order('created_at', { ascending: false }),
          supabase
            .from('compensatory_days')
            .select('id, status, cycle_id, periodo_inicio, periodo_fim, quantidade_plantoes, generated_at, used_at, cycles(nome), purchase_requests(id, data_plantao, valor, status, justificativa, rejection_reason, requested_at, establishments(nome)), establishments(nome)')
            .eq('employee_id', employeeId)
            .order('generated_at', { ascending: false }),
          supabase
            .from('purchase_requests')
            .select('id, tipo_solicitacao, data_plantao, valor, status, justificativa, rejection_reason, requested_at, establishments(nome)')
            .eq('employee_id', employeeId)
            .eq('tipo_solicitacao', 'PLANTAO_PLUS')
            .order('requested_at', { ascending: false }),
        ]);
        if (empData) setEmployee(empData as any);
        if (shiftsData) setShifts(shiftsData);
        if (folgasData) setFolgas(folgasData);
        if (plusData) setPlusRequests(plusData);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, [employeeId]);

  if (!employeeId) return null;

  const permiteCargaHoraria = employee?.schedule_types?.permite_carga_horaria !== false;
  const totalPlantoesTrabalhados = shifts.reduce((acc, s) => acc + (s.quantidade_plantoes || 0), 0);
  const totalHorasTrabalhadas = totalPlantoesTrabalhados * 12;
  const totalFolgasGeradas = folgas.length;
  const plantoesAbatidos = totalFolgasGeradas * 21;
  const horasAbatidas = plantoesAbatidos * 12;
  const saldoPlant = employee?.saldo_plantoes || 0;
  const saldoMin = employee?.saldo_minutos || 0;
  const totalMinutos = (saldoPlant * 720) + saldoMin;
  const horas = Math.floor(totalMinutos / 60);
  const min = totalMinutos % 60;
  const minFaltam = Math.max(0, 15120 - totalMinutos);
  const folgasDisponiveisQtd = folgas.filter(f => f.status === 'GERADA').length;
  const folgasGozadasQtd = folgas.filter(f => f.status === 'USUFRUIDA').length;
  const folgasIndenizadasQtd = folgas.filter(f => f.status === 'INDENIZADA').length;
  const folgasSolicitadasQtd = folgas.filter(f => f.status === 'INDENIZACAO_SOLICITADA').length;
  const totalValorIndenizadoModal = folgas.filter(f => f.status === 'INDENIZADA').reduce((acc, f) => {
    const pr = Array.isArray(f.purchase_requests) ? f.purchase_requests[0] : f.purchase_requests;
    return acc + (Number(pr?.valor) || 0);
  }, 0);
  const percentualProximaFolga = Math.min(Math.round((totalMinutos / 15120) * 100), 100);
  const proximaFolgaNumero = totalFolgasGeradas + 1;
  const plantoesFaltamAprox = Math.ceil(minFaltam / 720);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
        background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', justifyContent: 'flex-end'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="blueprint card"
        style={{
          width: '520px', height: '100vh', background: 'var(--color-surface)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.3)'
        }}
      >
        <i className="corner tl"></i><i className="corner tr"></i>

        {/* Cabeçalho */}
        <div style={{ padding: '24px 24px 16px', flexShrink: 0, borderBottom: '1px solid var(--color-divider)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '16px', textTransform: 'uppercase' }}>{employee?.nome || '...'}</div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                {employee?.positions?.nome || employee?.positions?.codigo} &bull; Mat: {employee?.matricula}
                {employee?.schedule_types?.nome && (
                  <span> &bull; Escala: <strong style={{ color: 'var(--color-text)' }}>{employee.schedule_types.nome}</strong></span>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                onClick={handleDownloadPDF}
                className="btn btn-ghost" 
                style={{ padding: '4px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                title="Baixar extrato completo em PDF"
              >
                <Download size={14} /> PDF
              </button>
              <button className="btn btn-ghost" style={{ padding: '4px 8px' }} onClick={onClose}>✕</button>
            </div>
          </div>

          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            🔒 Somente consulta — nenhuma ação é feita a partir daqui.
          </div>

          {/* Cards de Resumo */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
            <div style={{ background: 'var(--color-bg)', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
              <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 600, marginBottom: '4px' }}>Saldo</div>
              {permiteCargaHoraria ? (
                <>
                  <div style={{ fontSize: '20px', fontWeight: 800 }}>
                    {Math.floor((((employee?.saldo_plantoes || 0) * 720) + (employee?.saldo_minutos || 0)) / 60)}h
                    <span style={{ fontSize: '14px', marginLeft: '2px' }}>
                      {String((((employee?.saldo_plantoes || 0) * 720) + (employee?.saldo_minutos || 0)) % 60).padStart(2, '0')}m
                    </span>
                  </div>
                  <div style={{ height: '4px', background: 'var(--color-divider)', borderRadius: '2px', marginTop: '6px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: 'var(--color-primary)', width: `${Math.min(((((employee?.saldo_plantoes || 0) * 720) + (employee?.saldo_minutos || 0)) / 15120) * 100, 100)}%` }}></div>
                  </div>
                </>
              ) : (
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-muted)', marginTop: '10px' }}>⚡ Só Plus</div>
              )}
            </div>
            <div style={{ background: 'rgba(16,185,129,0.08)', borderRadius: '8px', padding: '10px', textAlign: 'center', border: '1px solid rgba(16,185,129,0.2)' }}>
              <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#10b981', fontWeight: 600, marginBottom: '4px' }}>Folgas</div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: '#10b981' }}>
                {permiteCargaHoraria ? folgas.filter(f => f.status === 'GERADA').length : '—'}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                {permiteCargaHoraria ? 'disponíveis' : 'não aplicável'}
              </div>
            </div>
            <div style={{ background: 'rgba(59,130,246,0.08)', borderRadius: '8px', padding: '10px', textAlign: 'center', border: '1px solid rgba(59,130,246,0.2)' }}>
              <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--color-primary)', fontWeight: 600, marginBottom: '4px' }}>Pl. Plus</div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--color-primary)' }}>{plusRequests.length}</div>
              <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '4px' }}>lançado(s)</div>
            </div>
          </div>
        </div>

        {/* Abas */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--color-divider)', flexShrink: 0 }}>
          {([['plantoes', '📋 Plantões'], ['folgas', '🎉 Folgas'], ['plus', '⚡ Plantão Plus']] as const).map(([t, label]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1, padding: '12px 8px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600,
                background: 'transparent',
                color: tab === t ? 'var(--color-primary)' : 'var(--color-text-muted)',
                borderBottom: tab === t ? '2px solid var(--color-primary)' : '2px solid transparent',
                transition: 'all 0.2s'
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Conteúdo da Aba */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0', gap: '16px', color: 'var(--color-text-muted)' }}>
              <div style={{ width: '28px', height: '28px', border: '3px solid var(--color-divider)', borderTopColor: 'var(--color-primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              <span style={{ fontSize: '13px' }}>Carregando histórico...</span>
            </div>
          ) : (
            <>
              {/* ABA: Folgas */}
              {tab === 'folgas' && (
                !permiteCargaHoraria ? (
                  <div style={{ textAlign: 'center', padding: '32px', color: 'var(--color-text-muted)' }}>
                    ⚡ Este servidor está em escala só-Plantão Plus — folga compensatória não é permitida para este regime.
                  </div>
                ) : (
                <div>
                  {/* Painel Operacional de Situação e Decisão de Folgas */}
                  <div style={{ 
                    marginBottom: '16px', padding: '14px', borderRadius: '10px', 
                    background: 'var(--color-bg)', border: '1px solid var(--color-divider)',
                    display: 'flex', flexDirection: 'column', gap: '12px'
                  }}>
                    {/* Topo: Título e Regra */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '13px', color: 'var(--color-text)' }}>
                        <span>⚖️</span> Situação das Folgas Compensatórias
                      </div>
                      <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', background: 'var(--color-surface)', padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--color-divider)' }}>
                        Custo: 21 plantões (252h) / folga
                      </span>
                    </div>

                    {/* Bloco 1: Cards Rápidos de Decisão (Status Atual das Folgas) */}
                    <div style={{ display: 'grid', gridTemplateColumns: folgasSolicitadasQtd > 0 ? 'repeat(4, 1fr)' : 'repeat(3, 1fr)', gap: '8px' }}>
                      {/* Disponível */}
                      <div style={{ 
                        padding: '10px 8px', borderRadius: '8px', textAlign: 'center',
                        background: folgasDisponiveisQtd > 0 ? 'rgba(16, 185, 129, 0.1)' : 'var(--color-surface)',
                        border: `1px solid ${folgasDisponiveisQtd > 0 ? '#10b981' : 'var(--color-divider)'}`
                      }}>
                        <div style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', color: folgasDisponiveisQtd > 0 ? '#059669' : 'var(--color-text-muted)' }}>
                          Disponíveis
                        </div>
                        <div style={{ fontSize: '18px', fontWeight: 800, color: folgasDisponiveisQtd > 0 ? '#059669' : 'var(--color-text-muted)', marginTop: '2px' }}>
                          {folgasDisponiveisQtd}
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                          {folgasDisponiveisQtd > 0 ? 'Livre p/ gozo ou venda' : 'Nenhuma liberada'}
                        </div>
                      </div>

                      {/* Indenizadas */}
                      <div style={{ 
                        padding: '10px 8px', borderRadius: '8px', textAlign: 'center',
                        background: folgasIndenizadasQtd > 0 ? 'rgba(59, 130, 246, 0.08)' : 'var(--color-surface)',
                        border: '1px solid var(--color-divider)'
                      }}>
                        <div style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>
                          Indenizadas
                        </div>
                        <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--color-primary)', marginTop: '2px' }}>
                          {folgasIndenizadasQtd}
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                          {totalValorIndenizadoModal > 0 ? `R$ ${totalValorIndenizadoModal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'Venda financeira'}
                        </div>
                      </div>

                      {/* Gozadas */}
                      <div style={{ 
                        padding: '10px 8px', borderRadius: '8px', textAlign: 'center',
                        background: folgasGozadasQtd > 0 ? 'rgba(139, 92, 246, 0.08)' : 'var(--color-surface)',
                        border: '1px solid var(--color-divider)'
                      }}>
                        <div style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>
                          Gozadas
                        </div>
                        <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--color-text)', marginTop: '2px' }}>
                          {folgasGozadasQtd}
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                          Descanso usufruído
                        </div>
                      </div>

                      {/* Em Análise (Condicional) */}
                      {folgasSolicitadasQtd > 0 && (
                        <div style={{ 
                          padding: '10px 8px', borderRadius: '8px', textAlign: 'center',
                          background: 'rgba(245, 158, 11, 0.1)',
                          border: '1px solid #f59e0b'
                        }}>
                          <div style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', color: '#d97706' }}>
                            Em Análise
                          </div>
                          <div style={{ fontSize: '18px', fontWeight: 800, color: '#d97706', marginTop: '2px' }}>
                            {folgasSolicitadasQtd}
                          </div>
                          <div style={{ fontSize: '10px', color: '#b45309', marginTop: '2px' }}>
                            Aguardando portaria
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Bloco 2: Barra de Progresso Rumo à Próxima Folga */}
                    <div style={{ background: 'var(--color-surface)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--color-divider)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text)' }}>
                          Progresso p/ Próxima Folga (#{String(proximaFolgaNumero).padStart(2, '0')})
                        </span>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-primary)' }}>
                          {percentualProximaFolga}% acumulado
                        </span>
                      </div>
                      
                      {/* Barra de Progresso */}
                      <div style={{ height: '7px', background: 'var(--color-divider)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ 
                          height: '100%', 
                          background: 'linear-gradient(90deg, #3b82f6, #1d4ed8)', 
                          width: `${percentualProximaFolga}%`,
                          borderRadius: '4px',
                          transition: 'width 0.4s ease'
                        }} />
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', fontSize: '10.5px' }}>
                        <span style={{ color: 'var(--color-text-muted)' }}>
                          <strong>{saldoPlant} de 21 plantões</strong> ({horas}h {String(min).padStart(2, '0')}m / 252h)
                        </span>
                        <span style={{ color: '#d97706', fontWeight: 600 }}>
                          ⏳ Faltam {Math.floor(minFaltam / 60)}h {String(minFaltam % 60).padStart(2, '0')}m (~{plantoesFaltamAprox} pl.)
                        </span>
                      </div>
                    </div>

                    {/* Bloco 3: Memória de Cálculo e Auditoria Rápida (Trabalhou -> Baixou -> Saldo) */}
                    <div style={{ 
                      display: 'grid', gridTemplateColumns: '1fr auto 1fr auto 1fr', 
                      alignItems: 'center', gap: '6px', 
                      padding: '8px 10px', borderRadius: '6px', 
                      background: 'var(--color-surface-hover, rgba(0,0,0,0.02))', 
                      border: '1px dashed var(--color-divider)',
                      fontSize: '11px'
                    }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '9.5px', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 600 }}>1. Trabalhado</div>
                        <div style={{ fontWeight: 700, color: 'var(--color-text)' }}>{totalPlantoesTrabalhados} pl.</div>
                        <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>{totalHorasTrabalhadas}h</div>
                      </div>

                      <div style={{ color: 'var(--color-text-muted)', fontWeight: 700 }}>➔</div>

                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '9.5px', textTransform: 'uppercase', color: '#dc2626', fontWeight: 600 }}>2. Baixado ({totalFolgasGeradas}x)</div>
                        <div style={{ fontWeight: 700, color: '#dc2626' }}>-{plantoesAbatidos} pl.</div>
                        <div style={{ fontSize: '10px', color: '#b91c1c' }}>-{horasAbatidas}h</div>
                      </div>

                      <div style={{ color: 'var(--color-text-muted)', fontWeight: 700 }}>➔</div>

                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '9.5px', textTransform: 'uppercase', color: '#2563eb', fontWeight: 600 }}>3. Saldo Atual</div>
                        <div style={{ fontWeight: 700, color: '#2563eb' }}>{saldoPlant} pl.</div>
                        <div style={{ fontSize: '10px', color: '#1d4ed8' }}>{horas}h {String(min).padStart(2, '0')}m</div>
                      </div>
                    </div>
                  </div>
                  {folgas.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '32px', color: 'var(--color-text-muted)' }}>Nenhuma folga gerada ainda.</div>
                  ) : folgas.map((f: any) => {
                    const reqObj = Array.isArray(f.purchase_requests)
                      ? (f.purchase_requests.length > 0 ? f.purchase_requests[0] : null)
                      : (f.purchase_requests || null);
                    const reqDataPlantao = reqObj?.data_plantao || null;

                    return (
                      <div key={f.id} style={{
                        padding: '16px', marginBottom: '12px', borderRadius: '8px',
                        background: 'var(--color-bg)', border: '1px solid var(--color-divider)',
                        display: 'flex', flexDirection: 'column', gap: '8px'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>🎉</span> Direito à Folga Compensatória
                          </div>
                          <span style={{
                            padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, display: 'inline-block',
                            background: folgaStatusMeta(f.status).bg,
                            color: folgaStatusMeta(f.status).color
                          }}>
                            {folgaStatusMeta(f.status).label}
                          </span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '4px' }}>
                          <div>
                            <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 600 }}>Ciclo de Origem</div>
                            <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text)' }}>{f.cycles?.nome || 'Ciclo legado'}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 600 }}>Custo do Acúmulo</div>
                            <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text)' }}>252h (21 Plantões)</div>
                          </div>
                        </div>

                        <div style={{ height: '1px', background: 'var(--color-divider)', margin: '4px 0' }} />

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                              <strong>Período do Ciclo:</strong> {new Date(f.periodo_inicio + 'T12:00:00Z').toLocaleDateString('pt-BR')} a {new Date(f.periodo_fim + 'T12:00:00Z').toLocaleDateString('pt-BR')}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                              {reqDataPlantao ? (
                                <><strong>Data do Plantão:</strong> {new Date(reqDataPlantao + 'T12:00:00Z').toLocaleDateString('pt-BR')}</>
                              ) : (
                                <><strong>Data da Concessão:</strong> {new Date(f.generated_at).toLocaleDateString('pt-BR')}</>
                              )}
                            </div>
                          </div>
                          {f.status === 'USUFRUIDA' && f.used_at && (
                            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginTop: '2px' }}>
                              <div style={{ fontSize: '11px', color: 'var(--color-primary)' }}>
                                <strong>Data de Gozo:</strong> {new Date(f.used_at + 'T12:00:00Z').toLocaleDateString('pt-BR')}
                              </div>
                            </div>
                          )}

                          {reqObj && (reqObj.justificativa || reqObj.rejection_reason || reqObj.establishments?.nome) && (
                            <div style={{ marginTop: '6px', padding: '8px 10px', background: 'var(--color-surface)', borderRadius: '6px', borderLeft: '3px solid var(--color-primary)', fontSize: '11px', color: 'var(--color-text)' }}>
                              {reqObj.establishments?.nome && (
                                <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginBottom: '2px' }}>
                                  <strong>Unidade Solicitante:</strong> {reqObj.establishments.nome}
                                  {reqObj.requested_at && ` (em ${new Date(reqObj.requested_at).toLocaleDateString('pt-BR')})`}
                                </div>
                              )}
                              {reqObj.justificativa && (
                                <div style={{ fontStyle: 'italic', color: 'var(--color-text)' }}>
                                  <strong>Justificativa da Unidade:</strong> "{reqObj.justificativa}"
                                </div>
                              )}
                              {reqObj.rejection_reason && (
                                <div style={{ color: 'var(--color-danger)', marginTop: '3px' }}>
                                  <strong>Motivo da Recusa:</strong> "{reqObj.rejection_reason}"
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                )
              )}

              {/* ABA: Plantões */}
              {tab === 'plantoes' && (
                !permiteCargaHoraria ? (
                  <div style={{ textAlign: 'center', padding: '32px', color: 'var(--color-text-muted)' }}>
                    ⚡ Este servidor está em escala só-Plantão Plus — não acumula carga horária compensatória.
                  </div>
                ) : (
                <div>
                  <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(59,130,246,0.05)', borderRadius: '8px', border: '1px solid rgba(59,130,246,0.1)', fontSize: '12px', color: 'var(--color-text)', lineHeight: 1.5, textAlign: 'justify' }}>
                    Este painel detalha as horas contempladas dentro do ciclo atual do servidor. Cada carga horária lançada é somada ao saldo geral, acumulando o tempo exigido para a liberação da próxima folga.
                  </div>
                  {shifts.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '32px', color: 'var(--color-text-muted)' }}>Nenhum plantão registrado.</div>
                  ) : (() => {
                    // Mesma reconstrução cronológica usada em estabelecimento/Folgas.tsx — o banco
                    // recalcula o saldo do zero a cada importação (soma histórica menos folgas
                    // já geradas × 21), então reconstruímos aqui pra mostrar quanto sobrou depois
                    // de cada lançamento específico.
                    const chronoAsc = [...shifts].sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
                    const saldoAposShift = new Map<string, { plantoesRestantes: number; folgasGeradas: any[] }>();
                    let cumulativoPlantoes = 0;
                    let folgasContadas = 0;
                    const proximoCicloNome = new Map<string, string>();
                    chronoAsc.forEach((s: any, i: number) => {
                      cumulativoPlantoes += s.quantidade_plantoes;
                      const folgasDesteCiclo = folgas.filter((f: any) => f.cycle_id === s.cycle_id);
                      folgasContadas += folgasDesteCiclo.length;
                      saldoAposShift.set(s.id, { plantoesRestantes: cumulativoPlantoes - (folgasContadas * 21), folgasGeradas: folgasDesteCiclo });
                      if (i < chronoAsc.length - 1) proximoCicloNome.set(s.id, chronoAsc[i + 1].cycles?.nome || 'o lançamento seguinte');
                    });

                    return (
                      <div style={{ position: 'relative', paddingLeft: '22px' }}>
                        {shifts.length > 1 && (
                          <div style={{ position: 'absolute', left: '3px', top: '14px', bottom: '14px', width: '2px', background: 'var(--color-divider)' }} />
                        )}
                        {shifts.map((s: any, idx: number) => {
                          const workedTotalMinutes = (s.quantidade_plantoes * 720) + (s.minutos_residuais || 0);
                          const workedHours = Math.floor(workedTotalMinutes / 60);
                          const workedMinutes = workedTotalMinutes % 60;
                          const ehMaisRecente = idx === 0;
                          const info = saldoAposShift.get(s.id)!;
                          const plantoesRestantes = ehMaisRecente ? (employee?.saldo_plantoes || 0) : info.plantoesRestantes;
                          const minutosRestantes = ehMaisRecente ? (employee?.saldo_minutos || 0) : (s.minutos_residuais || 0);
                          return (
                            <div key={s.id} style={{ position: 'relative', marginBottom: '14px' }}>
                              <div style={{
                                position: 'absolute', left: '-22px', top: '18px', width: '8px', height: '8px', borderRadius: '50%',
                                background: 'var(--color-primary)', boxShadow: '0 0 0 3px var(--color-surface)'
                              }} />
                              <div style={{
                                padding: '14px 16px', borderRadius: '8px',
                                background: ehMaisRecente ? 'rgba(59,130,246,0.04)' : 'var(--color-bg)',
                                border: ehMaisRecente ? '1px solid rgba(59,130,246,0.3)' : '1px solid var(--color-divider)',
                                borderLeft: ehMaisRecente ? '3px solid var(--color-primary)' : '1px solid var(--color-divider)'
                              }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', gap: '8px', flexWrap: 'wrap' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text)' }}>
                                      ⏱️ {s.cycles?.nome || 'Importação Base'}
                                    </span>
                                    {ehMaisRecente && (
                                      <span style={{ fontSize: '9px', fontWeight: 800, letterSpacing: '0.4px', padding: '1px 6px', borderRadius: '10px', background: 'var(--color-primary)', color: '#fff' }}>
                                        ATUAL
                                      </span>
                                    )}
                                  </div>
                                  <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                                    {new Date(s.periodo_inicio + 'T12:00:00Z').toLocaleDateString('pt-BR')} a {new Date(s.periodo_fim + 'T12:00:00Z').toLocaleDateString('pt-BR')}
                                  </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: '6px' }}>
                                  <span style={{ fontSize: '19px', fontWeight: 800, color: 'var(--color-text)' }}>
                                    {workedHours}h {String(workedMinutes).padStart(2, '0')}m
                                  </span>
                                  <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>consideradas</span>
                                  <span style={{ fontSize: '15px', color: 'var(--color-text-muted)' }}>→</span>
                                  <span style={{ fontSize: '19px', fontWeight: 800, color: 'var(--color-primary)' }}>
                                    {s.quantidade_plantoes}
                                  </span>
                                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-primary)' }}>
                                    plantõe{s.quantidade_plantoes === 1 ? '' : 's'} inteiro{s.quantidade_plantoes === 1 ? '' : 's'}
                                  </span>
                                </div>

                                <div style={{ height: '1px', background: 'var(--color-divider)', margin: '12px 0' }} />
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                  <div>
                                    <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 700, marginBottom: '4px' }}>Gerou</div>
                                    {info.folgasGeradas.length === 0 ? (
                                      <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Ainda acumulando — nenhuma folga fechada neste lançamento</div>
                                    ) : (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                                        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text)' }}>
                                          {info.folgasGeradas.length * 21} plantões consumidos
                                        </div>
                                        {info.folgasGeradas.map((f: any) => {
                                          const meta = folgaStatusMeta(f.status);
                                          return (
                                            <span key={f.id} style={{
                                              padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600,
                                              background: meta.bg, color: meta.color
                                            }}>
                                              🎉 {meta.label}
                                            </span>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                  <div>
                                    <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 700, marginBottom: '4px' }}>
                                      {ehMaisRecente ? 'Saldo restante (atual)' : 'Saldo que sobrou'}
                                    </div>
                                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text)' }}>
                                      {plantoesRestantes > 0 && <>{plantoesRestantes} plantõe{plantoesRestantes === 1 ? '' : 's'} + </>}
                                      {Math.floor(minutosRestantes / 60)}h {String(minutosRestantes % 60).padStart(2, '0')}m
                                    </div>
                                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                                      {ehMaisRecente ? 'rumo à próxima folga' : `foi para ${proximoCicloNome.get(s.id) || 'o lançamento seguinte'}`}
                                    </div>
                                  </div>
                                </div>

                                {s.observacao && (
                                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', background: 'var(--color-surface)', padding: '6px 10px', borderRadius: '4px', fontStyle: 'italic', marginTop: '10px' }}>
                                    {s.observacao}
                                  </div>
                                )}

                                <div style={{ height: '1px', background: 'var(--color-divider)', margin: '10px 0' }} />

                                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                                  Lançado no ciclo em {new Date(s.created_at).toLocaleDateString('pt-BR')}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
                )
              )}

              {/* ABA: Plantão Plus */}
              {tab === 'plus' && (
                <div>
                  <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(59,130,246,0.05)', borderRadius: '8px', border: '1px solid rgba(59,130,246,0.1)', fontSize: '12px', color: 'var(--color-text)', lineHeight: 1.5, textAlign: 'justify' }}>
                    O Plantão Plus refere-se aos plantões remunerados realizados de forma suplementar, ou seja, turnos cumpridos pelo servidor que não fazem parte de sua escala obrigatória
                  </div>
                  {plusRequests.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '32px', color: 'var(--color-text-muted)' }}>Nenhum Plantão Plus lançado.</div>
                  ) : plusRequests.map(p => (
                    <div key={p.id} style={{
                      padding: '12px 14px', marginBottom: '8px', borderRadius: '8px',
                      background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.15)'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--color-primary)' }}>⚡ Plantão Plus</div>
                          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                            Data trabalhada: <strong>{p.data_plantao ? new Date(p.data_plantao + 'T12:00:00Z').toLocaleDateString('pt-BR') : '-'}</strong>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 700, fontSize: '14px' }}>R$ {Number(p.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                          <span style={{
                            fontSize: '10px', padding: '2px 8px', borderRadius: '12px', fontWeight: 700, display: 'inline-block', marginTop: '4px',
                            background: p.status === 'APROVADA' ? 'rgba(16,185,129,0.1)' : p.status === 'REJEITADA' ? 'rgba(239,68,68,0.1)' : 'rgba(234,179,8,0.1)',
                            color: p.status === 'APROVADA' ? '#10b981' : p.status === 'REJEITADA' ? '#ef4444' : '#eab308'
                          }}>
                            {p.status === 'APROVADA' ? '✅ Aprovado' : p.status === 'REJEITADA' ? '❌ Rejeitado' : '⏳ Aguardando'}
                          </span>
                        </div>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', borderTop: '1px solid rgba(59,130,246,0.1)', paddingTop: '8px' }}>
                        <strong>Justificativa:</strong> {p.justificativa}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                        Solicitado em {new Date(p.requested_at).toLocaleDateString('pt-BR')}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

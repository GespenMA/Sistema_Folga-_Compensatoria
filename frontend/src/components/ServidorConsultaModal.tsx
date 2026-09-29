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
  schedule_types?: { permite_carga_horaria: boolean } | null;
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
      doc.addImage(img, 'PNG', 14, 15, 20, 20); // Altura corrigida para 20 (proporção quadrada)
    }
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('GOVERNO DO ESTADO DO MARANHÃO', 40, 20);
    doc.setFontSize(10);
    doc.text('SECRETARIA DE ESTADO DE ADMINISTRAÇÃO PENITENCIÁRIA - SEAP', 40, 25);
    doc.text('SISTEMA DE FOLGA COMPENSATÓRIA', 40, 30);
    
    // Título do Documento
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('EXTRATO OFICIAL DE SALDOS E LANÇAMENTOS', pageWidth / 2, 45, { align: 'center' });
    
    // Box de Informações e Resumo de Saldos
    doc.setDrawColor(200, 200, 200);
    doc.setFillColor(249, 250, 251);
    doc.roundedRect(14, 52, pageWidth - 28, 25, 3, 3, 'FD');
    
    // Dados do Servidor
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Servidor: `, 18, 60);
    doc.setFont('helvetica', 'bold');
    doc.text(`${employee.nome}`, 35, 60);
    
    doc.setFont('helvetica', 'normal');
    doc.text(`Matrícula: `, 18, 66);
    doc.setFont('helvetica', 'bold');
    doc.text(`${employee.matricula}`, 35, 66);
    
    doc.setFont('helvetica', 'normal');
    doc.text(`Cargo: `, 18, 72);
    doc.setFont('helvetica', 'bold');
    doc.text(`${employee.positions?.nome || employee.positions?.codigo || '-'}`, 30, 72);
    
    // Cálculos de Resumo
    const saldoPlant = employee.saldo_plantoes || 0;
    const saldoMin = employee.saldo_minutos || 0;
    const totalMinutos = (saldoPlant * 720) + saldoMin;
    const horas = Math.floor(totalMinutos / 60);
    const min = totalMinutos % 60;
    
    const valorTotalPlus = plusRequests.reduce((acc, p) => acc + (Number(p.valor) || 0), 0);
    const folgasUsufruidas = folgas.filter(f => f.status === 'USUFRUIDA').length;
    const folgasIndenizadas = folgas.filter(f => f.status === 'INDENIZADA').length;
    const folgasDisponiveis = folgas.filter(f => f.status === 'GERADA').length;

    // Coluna 2 (Folgas)
    doc.setFont('helvetica', 'normal');
    doc.text(`Carga Acumulada: `, 90, 60);
    doc.setFont('helvetica', 'bold');
    doc.text(`${horas}h ${min}m`, 122, 60);
    
    doc.setFont('helvetica', 'normal');
    doc.text(`Folgas Disponíveis: `, 90, 66);
    doc.setFont('helvetica', 'bold');
    doc.text(`${folgasDisponiveis}`, 122, 66);

    // Coluna 3 (Plus e Uso)
    doc.setFont('helvetica', 'normal');
    doc.text(`Plantão Plus: `, 145, 60);
    doc.setFont('helvetica', 'bold');
    doc.text(`R$ ${valorTotalPlus.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${plusRequests.length}x)`, 168, 60);
    
    doc.setFont('helvetica', 'normal');
    doc.text(`Uso (Usu/Ind): `, 145, 66);
    doc.setFont('helvetica', 'bold');
    doc.text(`${folgasUsufruidas} / ${folgasIndenizadas}`, 168, 66);
    
    let finalY = 85;
    
    // Histórico de Folgas
    if (folgas.length > 0) {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Histórico de Folgas Compensatórias', 14, finalY);
      autoTable(doc, {
        startY: finalY + 5,
        head: [['Status', 'Ciclo Gerador', 'Estabelecimento', 'Período', 'Indenizada (Data)']],
        headStyles: { fillColor: [16, 185, 129] }, // Verde
        body: folgas.map((f: any) => {
          const reqDataPlantao = Array.isArray(f.purchase_requests)
            ? (f.purchase_requests.length > 0 ? f.purchase_requests[0].data_plantao : null)
            : (f.purchase_requests?.data_plantao || null);
          return [
            f.status,
            f.cycles?.nome || 'N/A',
            f.establishments?.nome || '-',
            `${new Date(f.periodo_inicio).toLocaleDateString('pt-BR')} a ${new Date(f.periodo_fim).toLocaleDateString('pt-BR')}`,
            f.status === 'INDENIZADA' && reqDataPlantao ? new Date(reqDataPlantao).toLocaleDateString('pt-BR') : '-'
          ];
        }),
      });
      finalY = (doc as any).lastAutoTable.finalY + 15;
    }
    
    // Histórico de Plantões
    if (shifts.length > 0) {
      if (finalY > pageHeight - 40) { doc.addPage(); finalY = 20; }
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Histórico de Lançamentos de Plantão', 14, finalY);
      autoTable(doc, {
        startY: finalY + 5,
        head: [['Data do Plantão', 'Ciclo', 'Estabelecimento', 'Quantidade', 'Observação']],
        headStyles: { fillColor: [100, 116, 139] }, // Cinza ardósia
        body: shifts.map((s: any) => [
          new Date(s.periodo_inicio).toLocaleDateString('pt-BR'),
          s.cycles?.nome || '-',
          s.establishments?.nome || '-',
          `${s.quantidade_plantoes} plantão(ões)`,
          s.observacao || '-'
        ]),
      });
      finalY = (doc as any).lastAutoTable.finalY + 15;
    }
    
    // Histórico de Plantão Plus
    if (plusRequests.length > 0) {
      if (finalY > pageHeight - 40) { doc.addPage(); finalY = 20; }
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Histórico de Plantão Plus', 14, finalY);
      autoTable(doc, {
        startY: finalY + 5,
        head: [['Data Solicitada', 'Estabelecimento', 'Status', 'Valor', 'Solicitado em']],
        headStyles: { fillColor: [59, 130, 246] }, // Azul
        body: plusRequests.map((p: any) => [
          new Date(p.data_plantao).toLocaleDateString('pt-BR'),
          p.establishments?.nome || '-',
          p.status,
          `R$ ${Number(p.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
          new Date(p.requested_at).toLocaleDateString('pt-BR')
        ]),
      });
      finalY = (doc as any).lastAutoTable.finalY + 15;
    }

    // Assinaturas (se houver espaço ou nova página)
    if (finalY > pageHeight - 50) { doc.addPage(); finalY = 40; } else { finalY += 25; }
    
    doc.setDrawColor(0, 0, 0);
    doc.line(30, finalY, 80, finalY); // Linha Servidor
    doc.line(120, finalY, 180, finalY); // Linha Chefia
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text('Assinatura do Servidor', 55, finalY + 5, { align: 'center' });
    doc.text('Chefia Imediata (Carimbo e Assinatura)', 150, finalY + 5, { align: 'center' });

    // Paginação e Data em todas as páginas
    const pageCount = (doc.internal as any).getNumberOfPages ? (doc.internal as any).getNumberOfPages() : doc.getNumberOfPages();
    const dataHora = new Date().toLocaleString('pt-BR');
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.text(`Documento gerado em: ${dataHora}`, 14, pageHeight - 10);
      doc.text(`Página ${i} de ${pageCount}`, pageWidth - 25, pageHeight - 10);
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
            .select('id, nome, matricula, saldo_plantoes, saldo_minutos, positions(nome, codigo), schedule_types(permite_carga_horaria)')
            .eq('id', employeeId)
            .single(),
          supabase
            .from('shifts')
            .select('id, cycle_id, periodo_inicio, periodo_fim, quantidade_plantoes, observacao, created_at, minutos_residuais, cycles(nome), establishments(nome)')
            .eq('employee_id', employeeId)
            .order('created_at', { ascending: false }),
          supabase
            .from('compensatory_days')
            .select('id, status, cycle_id, periodo_inicio, periodo_fim, quantidade_plantoes, generated_at, used_at, cycles(nome), purchase_requests(data_plantao), establishments(nome)')
            .eq('employee_id', employeeId)
            .order('generated_at', { ascending: false }),
          supabase
            .from('purchase_requests')
            .select('id, tipo_solicitacao, data_plantao, valor, status, justificativa, requested_at, establishments(nome)')
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
              <div style={{ fontSize: '22px', fontWeight: 800, color: '#10b981' }}>{folgas.filter(f => f.status === 'GERADA').length}</div>
              <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '4px' }}>disponíveis</div>
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
                <div>
                  <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(59,130,246,0.05)', borderRadius: '8px', border: '1px solid rgba(59,130,246,0.1)', fontSize: '12px', color: 'var(--color-text)', lineHeight: 1.5, textAlign: 'justify' }}>
                    {permiteCargaHoraria
                      ? 'Aqui estão listadas todas as folgas adquiridas pelo servidor. O sistema gera uma nova folga automaticamente a cada ciclo concluído, ou seja, sempre que o saldo acumulado atinge a marca de 21 plantões inteiros (252 horas)'
                      : 'Este servidor está em escala só-Plantão Plus e não acumula carga horária nova. As folgas listadas abaixo (se houver) foram geradas antes dessa configuração e continuam válidas normalmente.'}
                  </div>
                  {folgas.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '32px', color: 'var(--color-text-muted)' }}>Nenhuma folga gerada ainda.</div>
                  ) : folgas.map((f: any) => {
                    const reqDataPlantao = Array.isArray(f.purchase_requests)
                      ? (f.purchase_requests.length > 0 ? f.purchase_requests[0].data_plantao : null)
                      : (f.purchase_requests?.data_plantao || null);

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
                        </div>
                      </div>
                    );
                  })}
                </div>
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

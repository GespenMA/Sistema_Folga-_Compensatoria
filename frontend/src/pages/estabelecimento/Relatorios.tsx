import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import * as XLSX from 'xlsx';
import { FileText, FileSpreadsheet, Filter, Users, DollarSign, Building2, TrendingUp, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// =============================================
// TIPOS
// =============================================
type Cycle = { id: string; nome: string; mes: number; ano: number; status: string; data_inicio: string; data_fim: string };
type Position = { id: string; nome: string; codigo: string };

type ResumoCiclo = {
  total_orcado: number;
  valor_gasto: number;
  valor_reservado: number;
  saldo: number;
  pct_executado: number;
};

type FolhaServidorRow = {
  employee_id: string;
  matricula: string;
  nome: string;
  cargo_codigo: string;
  cargo_nome: string;
  plantoes_trabalhados: number;
  folgas_geradas: number;
  folgas_compradas_qtd: number;
  plantao_plus_qtd: number;
  valor_folga_comp: number;
  valor_plantao_plus: number;
  total_a_pagar: number;
  saldo_minutos: number;
};

// =============================================
// HELPERS
// =============================================
const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

// =============================================
// COMPONENTE PRINCIPAL
// =============================================
export const Relatorios: React.FC = () => {
  const { profile } = useAuth();
  
  // Filtros
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [selectedCycle, setSelectedCycle] = useState('');
  const [searchServidor, setSearchServidor] = useState('');
  const [selectedCargo, setSelectedCargo] = useState('');

  // Dados brutos
  const [resumoData, setResumoData] = useState<ResumoCiclo | null>(null);
  const [folhaData, setFolhaData] = useState<FolhaServidorRow[]>([]);

  // Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [exportingPdf, setExportingPdf] = useState(false);

  // Carrega filtros iniciais
  useEffect(() => {
    void loadFilters();
  }, []);

  // Recarrega dados quando o ciclo muda
  useEffect(() => {
    if (selectedCycle && profile?.establishment_id) {
      void loadData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCycle, profile?.establishment_id]);

  // -------------------------------------------
  // CARGA DE FILTROS
  // -------------------------------------------
  const loadFilters = async () => {
    const [{ data: cData }, { data: pData }] = await Promise.all([
      supabase.from('cycles').select('id, nome, mes, ano, status, data_inicio, data_fim').order('ano', { ascending: false }).order('mes', { ascending: false }),
      supabase.from('positions').select('id, nome, codigo').eq('ativo', true).order('nome'),
    ]);
    const cList = cData || [];
    setCycles(cList);
    setPositions(pData || []);

    // Auto-seleciona ciclo aberto
    const aberto = cList.find(c => c.status === 'ABERTO' || c.status === 'REABERTO');
    setSelectedCycle(aberto ? aberto.id : cList[0]?.id || '');
  };

  // -------------------------------------------
  // CARGA DE DADOS
  // -------------------------------------------
  const loadData = async () => {
    if (!profile?.establishment_id) return;
    
    setLoading(true);
    setErrorMsg(null);
    try {
      await Promise.all([
        loadResumoCiclo(),
        loadFolhaServidor()
      ]);
    } catch (e: any) {
      setErrorMsg(e?.message || 'Erro ao carregar dados.');
    } finally {
      setLoading(false);
    }
  };

  const loadResumoCiclo = async () => {
    const estId = profile!.establishment_id!;
    
    // Busca orcamento da unidade
    const { data: ceData, error: ceErr } = await supabase
      .from('cycle_establishments')
      .select('total_orcado')
      .eq('cycle_id', selectedCycle)
      .eq('establishment_id', estId)
      .maybeSingle();
      
    if (ceErr && ceErr.code !== 'PGRST116') throw ceErr; // ignore not found
    
    // Busca purchase_requests
    const { data: prData, error: prErr } = await supabase
      .from('purchase_requests')
      .select('valor, status')
      .eq('cycle_id', selectedCycle)
      .eq('establishment_id', estId)
      .in('status', ['APROVADA', 'SOLICITADA']);
      
    if (prErr) throw prErr;
    
    const aprovadas = (prData || []).filter(p => p.status === 'APROVADA');
    const pendentes = (prData || []).filter(p => p.status === 'SOLICITADA');
    const gasto = aprovadas.reduce((s, p) => s + Number(p.valor), 0);
    const reservado = pendentes.reduce((s, p) => s + Number(p.valor), 0);
    const totalOrcado = ceData ? Number(ceData.total_orcado) : 0;
    const saldo = totalOrcado - gasto - reservado;
    const pct = totalOrcado > 0 ? ((gasto + reservado) / totalOrcado) * 100 : 0;
    
    setResumoData({
      total_orcado: totalOrcado,
      valor_gasto: gasto,
      valor_reservado: reservado,
      saldo,
      pct_executado: pct
    });
  };

  const loadFolhaServidor = async () => {
    const estId = profile!.establishment_id!;
    
    // 1. Busca shifts no ciclo
    const { data: shiftData, error: shiftErr } = await supabase
      .from('shifts')
      .select('employee_id, quantidade_plantoes, employees!inner(id, matricula, nome, saldo_minutos, establishment_id, positions(codigo, nome))')
      .eq('cycle_id', selectedCycle)
      .eq('employees.establishment_id', estId);
    if (shiftErr) throw shiftErr;

    // 2. Busca compensatory_days
    const { data: compData, error: compErr } = await supabase
      .from('compensatory_days')
      .select('employee_id, status, quantidade_plantoes, employees!inner(establishment_id)')
      .eq('cycle_id', selectedCycle)
      .eq('employees.establishment_id', estId);
    if (compErr) throw compErr;

    // 3. Busca purchase_requests
    let prQ = supabase
      .from('purchase_requests')
      .select('employee_id, valor, tipo_solicitacao')
      .eq('cycle_id', selectedCycle)
      .eq('establishment_id', estId)
      .eq('status', 'APROVADA');
      
    if (selectedCargo) prQ = prQ.eq('position_id', selectedCargo);
    
    const { data: prData, error: prErr } = await prQ;
    if (prErr) throw prErr;

    // Agrupa por funcionário
    const empMap = new Map<string, FolhaServidorRow>();

    for (const s of shiftData || []) {
      const emp = (s.employees as any);
      if (!emp) continue;
      
      // Aplicar filtro de cargo se houver
      if (selectedCargo && emp.positions?.id !== selectedCargo) {
         // O id do cargo não está diretamente no shiftData, precisaríamos incluir no inner join,
         // mas vamos filtrar depois no frontend com o cargo_nome
      }

      const empId = emp.id;
      if (!empMap.has(empId)) {
        empMap.set(empId, {
          employee_id: empId,
          matricula: emp.matricula || '',
          nome: emp.nome || '',
          cargo_codigo: emp.positions?.codigo || '',
          cargo_nome: emp.positions?.nome || '',
          plantoes_trabalhados: 0,
          folgas_geradas: 0,
          folgas_compradas_qtd: 0,
          plantao_plus_qtd: 0,
          valor_folga_comp: 0,
          valor_plantao_plus: 0,
          total_a_pagar: 0,
          saldo_minutos: emp.saldo_minutos || 0,
        });
      }
      empMap.get(empId)!.plantoes_trabalhados += Number(s.quantidade_plantoes);
    }

    // Processa compensatory_days
    for (const c of compData || []) {
      if (!empMap.has(c.employee_id)) continue;
      empMap.get(c.employee_id)!.folgas_geradas++;
      if (c.status === 'COMPRADA') empMap.get(c.employee_id)!.folgas_compradas_qtd++;
    }

    // Processa purchase_requests
    for (const p of prData || []) {
      if (!empMap.has(p.employee_id)) continue;
      if (p.tipo_solicitacao === 'PLANTAO_PLUS') {
        empMap.get(p.employee_id)!.plantao_plus_qtd++;
        empMap.get(p.employee_id)!.valor_plantao_plus += Number(p.valor);
      } else {
        empMap.get(p.employee_id)!.valor_folga_comp += Number(p.valor);
      }
      empMap.get(p.employee_id)!.total_a_pagar += Number(p.valor);
    }

    const rows = Array.from(empMap.values());
    rows.sort((a, b) => a.nome.localeCompare(b.nome));
    setFolhaData(rows);
  };

  // -------------------------------------------
  // DADOS FILTRADOS
  // -------------------------------------------
  const filteredFolha = useMemo(() => {
    let f = folhaData;
    if (searchServidor) {
      const lower = searchServidor.toLowerCase();
      f = f.filter(r => r.nome.toLowerCase().includes(lower) || r.matricula.toLowerCase().includes(lower));
    }
    if (selectedCargo) {
      const cargoNome = positions.find(p => p.id === selectedCargo)?.nome;
      if (cargoNome) {
        f = f.filter(r => r.cargo_nome === cargoNome);
      }
    }
    return f;
  }, [folhaData, searchServidor, selectedCargo, positions]);

  // Resetar página ao filtrar
  useEffect(() => {
    setCurrentPage(1);
  }, [searchServidor, selectedCargo, selectedCycle]);

  // Dados paginados
  const totalPages = Math.ceil(filteredFolha.length / itemsPerPage);
  const paginatedFolha = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredFolha.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredFolha, currentPage]);

  // Totais Folha
  const totFolha = useMemo(() => {
    return filteredFolha.reduce((acc, r) => {
      acc.valor_folga_comp += r.valor_folga_comp;
      acc.valor_plantao_plus += r.valor_plantao_plus;
      acc.total_a_pagar += r.total_a_pagar;
      return acc;
    }, { valor_folga_comp: 0, valor_plantao_plus: 0, total_a_pagar: 0 });
  }, [filteredFolha]);

  // -------------------------------------------
  // EXPORTAÇÕES
  // -------------------------------------------
  const getSelectedCycleObj = () => cycles.find(c => c.id === selectedCycle);

  const exportExcel = () => {
    const data = filteredFolha.map(r => ({
      'Matrícula': r.matricula,
      'Servidor': r.nome,
      'Cargo': r.cargo_nome,
      'Plantões Trab.': r.plantoes_trabalhados,
      'Folgas Geradas': r.folgas_geradas,
      'Folgas Pagas (Qtd)': r.folgas_compradas_qtd,
      'Plantão+ (Qtd)': r.plantao_plus_qtd,
      'R$ Folga Comp.': r.valor_folga_comp,
      'R$ Plantão+': r.valor_plantao_plus,
      'Total a Pagar': r.total_a_pagar,
      'Banco Min.': r.saldo_minutos
    }));
    
    if (data.length === 0) return alert('Nenhum dado para exportar.');
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Folha de Pagamento");
    XLSX.writeFile(wb, `Folha_Unidade_${getSelectedCycleObj()?.nome || 'Ciclo'}.xlsx`);
  };

  const exportPDF = () => {
    if (filteredFolha.length === 0) return alert('Nenhum dado para exportar.');
    setExportingPdf(true);
    try {
      const doc = new jsPDF('l', 'mm', 'a4');
      const cycleObj = getSelectedCycleObj();
      
      // Cabeçalho
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text('SEAP — Compensa+', 14, 16);
      doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 282, 16, { align: 'right' });
      
      doc.setFontSize(16);
      doc.setTextColor(40);
      doc.text(`Relatório de Pagamento - Unidade`, 14, 26);
      doc.setFontSize(11);
      doc.text(`Ciclo: ${cycleObj?.nome || 'Não definido'}`, 14, 32);

      const tableData = filteredFolha.map(r => [
        r.matricula,
        r.nome,
        r.cargo_nome,
        r.folgas_compradas_qtd.toString(),
        fmt(r.valor_folga_comp),
        r.plantao_plus_qtd.toString(),
        fmt(r.valor_plantao_plus),
        fmt(r.total_a_pagar)
      ]);

      // Adiciona linha de totais
      tableData.push([
        '', 'TOTAIS', '', '', 
        fmt(totFolha.valor_folga_comp), 
        '', 
        fmt(totFolha.valor_plantao_plus), 
        fmt(totFolha.total_a_pagar)
      ]);

      autoTable(doc, {
        startY: 40,
        head: [['Matrícula', 'Servidor', 'Cargo', 'Qtd Folga', 'R$ Folga', 'Qtd Pl+', 'R$ Pl+', 'Total (R$)']],
        body: tableData,
        theme: 'striped',
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255], fontStyle: 'bold' },
        columnStyles: {
          4: { halign: 'right' },
          6: { halign: 'right' },
          7: { halign: 'right', fontStyle: 'bold' }
        },
        willDrawCell: function (data) {
          // Destaca a última linha (Totais)
          if (data.row.index === tableData.length - 1) {
            doc.setFillColor(240, 248, 255);
            doc.setFont('helvetica', 'bold');
            if (data.column.index === 1 || data.column.index > 3) {
              doc.setTextColor(15, 23, 42);
            }
          }
        },
      });

      doc.save(`Folha_Unidade_${cycleObj?.nome || 'Ciclo'}.pdf`);
    } catch (e) {
      console.error(e);
      alert('Erro ao gerar PDF.');
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <div style={{ padding: 'var(--space-6)', maxWidth: '1400px', margin: '0 auto' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
        <div>
          <h1 style={{ margin: '0 0 var(--space-2) 0', fontSize: '24px', color: 'var(--color-text-base)' }}>Relatórios da Unidade</h1>
          <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>Acompanhamento de custos e folha de pagamento do ciclo atual.</p>
        </div>
      </div>

      {errorMsg && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#ef4444', padding: '12px 16px', borderRadius: '8px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={20} />
          {errorMsg}
        </div>
      )}

      {/* FILTROS SUPERIORES */}
      <div style={{ background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)', marginBottom: 'var(--space-6)', display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        
        <div style={{ flex: '1 1 200px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '6px' }}>
            Ciclo de Pagamento
          </label>
          <div style={{ position: 'relative' }}>
            <Filter size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <select 
              value={selectedCycle} 
              onChange={e => setSelectedCycle(e.target.value)}
              style={{ width: '100%', padding: '10px 10px 10px 36px', borderRadius: '8px', border: '1px solid var(--color-border)', outline: 'none', background: '#fff' }}
            >
              {cycles.map(c => (
                <option key={c.id} value={c.id}>{c.nome} ({c.status})</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ flex: '1 1 200px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '6px' }}>
            Cargo (Opcional)
          </label>
          <select 
            value={selectedCargo} 
            onChange={e => setSelectedCargo(e.target.value)}
            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--color-border)', outline: 'none', background: '#fff' }}
          >
            <option value="">Todos os Cargos</option>
            {positions.map(p => (
              <option key={p.id} value={p.id}>{p.nome}</option>
            ))}
          </select>
        </div>

        <div style={{ flex: '2 1 300px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '6px' }}>
            Buscar Servidor
          </label>
          <input 
            type="text" 
            placeholder="Nome ou Matrícula..." 
            value={searchServidor}
            onChange={e => setSearchServidor(e.target.value)}
            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--color-border)', outline: 'none', background: '#fff' }}
          />
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Carregando dados...</div>
      ) : (
        <>
          {/* RESUMO DO CICLO (CARDS) */}
          {resumoData && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', marginBottom: '32px' }}>
              
              <div style={{ background: '#ffffff', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: '#64748b' }}></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                  <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569' }}>
                    <Building2 size={22} strokeWidth={2.5} />
                  </div>
                  <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Orçamento do Ciclo
                  </div>
                </div>
                <div style={{ fontSize: '28px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px' }}>
                  {fmt(resumoData.total_orcado)}
                </div>
              </div>

              <div style={{ background: '#ffffff', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: '#3b82f6' }}></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                  <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6' }}>
                    <TrendingUp size={22} strokeWidth={2.5} />
                  </div>
                  <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Custo Aprovado
                  </div>
                </div>
                <div style={{ fontSize: '28px', fontWeight: 800, color: '#1e3a8a', letterSpacing: '-0.5px' }}>
                  {fmt(resumoData.valor_gasto)}
                </div>
              </div>

              <div style={{ background: '#ffffff', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: resumoData.saldo >= 0 ? '#10b981' : '#ef4444' }}></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                  <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: resumoData.saldo >= 0 ? '#ecfdf5' : '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: resumoData.saldo >= 0 ? '#10b981' : '#ef4444' }}>
                    <DollarSign size={22} strokeWidth={2.5} />
                  </div>
                  <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Saldo Disponível
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: '28px', fontWeight: 800, color: resumoData.saldo >= 0 ? '#065f46' : '#991b1b', letterSpacing: '-0.5px' }}>
                    {fmt(resumoData.saldo)}
                  </div>
                  <div style={{ fontSize: '12px', fontWeight: 700, padding: '4px 10px', borderRadius: '20px', background: '#f1f5f9', color: '#475569' }}>
                    {resumoData.pct_executado.toFixed(1)}% Usado
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* TABELA: FOLHA POR SERVIDOR */}
          <div style={{ background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, color: 'var(--color-text-base)' }}>
                <Users size={18} color="#3b82f6" />
                Detalhamento da Folha de Pagamento
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button 
                  onClick={exportExcel}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#16a34a', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 500 }}
                >
                  <FileSpreadsheet size={16} /> Excel
                </button>
                <button 
                  onClick={exportPDF}
                  disabled={exportingPdf}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#dc2626', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 500, opacity: exportingPdf ? 0.7 : 1 }}
                >
                  <FileText size={16} /> {exportingPdf ? 'Gerando...' : 'PDF'}
                </button>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #e2e8f0', color: '#475569', textAlign: 'left' }}>
                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>Servidor</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'center' }}>Pl. Trab.</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'center' }}>Folga Ger.</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Qtd. FC</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>R$ FC</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Qtd. Pl+</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>R$ Pl+</th>
                    <th style={{ padding: '12px 16px', fontWeight: 700, textAlign: 'right' }}>Total (R$)</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFolha.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>
                        Nenhum registro encontrado para os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    <>
                      {paginatedFolha.map(r => (
                        <tr key={r.employee_id} style={{ borderBottom: '1px solid #e2e8f0', background: '#fff' }}>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ fontWeight: 500, color: '#0f172a' }}>{r.nome}</div>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>Mat: {r.matricula} | {r.cargo_nome}</div>
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'center' }}>{r.plantoes_trabalhados}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'center' }}>{r.folgas_geradas}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right' }}>{r.folgas_compradas_qtd}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', color: '#334155' }}>{fmt(r.valor_folga_comp)}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right' }}>{r.plantao_plus_qtd}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', color: '#334155' }}>{fmt(r.valor_plantao_plus)}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: '#16a34a' }}>
                            {fmt(r.total_a_pagar)}
                          </td>
                        </tr>
                      ))}
                      {/* Linha de Totalizadores (Mostra o total global, não só da página) */}
                      <tr style={{ background: '#f8fafc', borderTop: '2px solid #e2e8f0', fontWeight: 600 }}>
                        <td colSpan={4} style={{ padding: '12px 16px', textAlign: 'right', color: '#475569' }}>TOTAIS APROVADOS DA UNIDADE:</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', color: '#0f172a' }}>{fmt(totFolha.valor_folga_comp)}</td>
                        <td style={{ padding: '12px 16px' }}></td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', color: '#0f172a' }}>{fmt(totFolha.valor_plantao_plus)}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', color: '#16a34a', fontSize: '14px' }}>{fmt(totFolha.total_a_pagar)}</td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
              
              {/* Controles de Paginação */}
              {totalPages > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderTop: '1px solid var(--color-border)', background: '#f8fafc' }}>
                  <div style={{ fontSize: '13px', color: '#64748b' }}>
                    Mostrando {(currentPage - 1) * itemsPerPage + 1} até {Math.min(currentPage * itemsPerPage, filteredFolha.length)} de {filteredFolha.length} registros
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      style={{ padding: '6px 12px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', opacity: currentPage === 1 ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: '#334155' }}
                    >
                      <ChevronLeft size={16} /> Anterior
                    </button>
                    <button 
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      style={{ padding: '6px 12px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', opacity: currentPage === totalPages ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: '#334155' }}
                    >
                      Próxima <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

    </div>
  );
};

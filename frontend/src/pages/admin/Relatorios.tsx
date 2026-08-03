import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import * as XLSX from 'xlsx';
import { FileText, Download, FileSpreadsheet, Filter, Building2, Users, DollarSign, TrendingUp, AlertCircle } from 'lucide-react';

// =============================================
// TIPOS
// =============================================
type Cycle = { id: string; nome: string; mes: number; ano: number; status: string; data_inicio: string; data_fim: string };
type Establishment = { id: string; nome: string; localizacao: string };
type Position = { id: string; nome: string; codigo: string };

// Rel 1: Orçado vs Gasto
type OrcadoGastoRow = {
  establishment_id: string;
  nome: string;
  total_orcado: number;
  valor_gasto: number;
  valor_reservado: number;
  saldo: number;
  pct_executado: number;
};

// Rel 2: Detalhamento por Estabelecimento
type DetalhEstRow = {
  establishment_id: string;
  nome_est: string;
  position_codigo: string;
  nome_cargo: string;
  qtd_folga_comp: number;
  qtd_plantao_plus: number;
  total_aprovado: number;
};

// Rel 3: Folha por Servidor
type FolhaServidorRow = {
  employee_id: string;
  matricula: string;
  nome: string;
  cargo_codigo: string;
  cargo_nome: string;
  establishment_id: string;
  nome_est: string;
  plantoes_trabalhados: number;
  folgas_geradas: number;
  folgas_compradas_qtd: number;
  plantao_plus_qtd: number;
  valor_folga_comp: number;
  valor_plantao_plus: number;
  total_a_pagar: number;
  saldo_minutos: number;
};

type ActiveTab = 'orcado_gasto' | 'detalhe_est' | 'folha_servidor';

// =============================================
// HELPERS
// =============================================
const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '';

// =============================================
// COMPONENTE PRINCIPAL
// =============================================
export const Relatorios: React.FC = () => {
  // Filtros
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [selectedCycle, setSelectedCycle] = useState('');
  const [selectedEst, setSelectedEst] = useState('');
  const [searchServidor, setSearchServidor] = useState('');
  const [selectedCargo, setSelectedCargo] = useState('');

  // Dados brutos
  const [orcadoGastoData, setOrcadoGastoData] = useState<OrcadoGastoRow[]>([]);
  const [detalhEstData, setDetalhEstData] = useState<DetalhEstRow[]>([]);
  const [folhaData, setFolhaData] = useState<FolhaServidorRow[]>([]);

  const [activeTab, setActiveTab] = useState<ActiveTab>('orcado_gasto');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [exportingPdf, setExportingPdf] = useState(false);

  // Carrega filtros iniciais
  useEffect(() => {
    void loadFilters();
  }, []);

  // Recarrega dados quando o ciclo ou estabelecimento mudam
  useEffect(() => {
    if (selectedCycle) void loadData(activeTab);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCycle, selectedEst]);

  // Recarrega dados ao mudar de tab
  useEffect(() => {
    if (selectedCycle) void loadData(activeTab);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // -------------------------------------------
  // CARGA DE FILTROS
  // -------------------------------------------
  const loadFilters = async () => {
    const [{ data: cData }, { data: eData }, { data: pData }] = await Promise.all([
      supabase.from('cycles').select('id, nome, mes, ano, status, data_inicio, data_fim').order('ano', { ascending: false }).order('mes', { ascending: false }),
      supabase.from('establishments').select('id, nome, localizacao').eq('ativo', true).order('nome'),
      supabase.from('positions').select('id, nome, codigo').eq('ativo', true).order('nome'),
    ]);
    const cList = cData || [];
    setCycles(cList);
    setEstablishments(eData || []);
    setPositions(pData || []);

    // Auto-seleciona ciclo aberto
    const aberto = cList.find(c => c.status === 'ABERTO' || c.status === 'REABERTO');
    setSelectedCycle(aberto ? aberto.id : cList[0]?.id || '');
  };

  // -------------------------------------------
  // CARGA DE DADOS POR TAB
  // -------------------------------------------
  const loadData = async (tab: ActiveTab) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      if (tab === 'orcado_gasto') await loadOrcadoGasto();
      else if (tab === 'detalhe_est') await loadDetalhEstabelecimento();
      else await loadFolhaServidor();
    } catch (e: any) {
      setErrorMsg(e?.message || 'Erro ao carregar dados.');
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------------
  // TAB 1: Orçado vs. Gasto
  // -------------------------------------------
  const loadOrcadoGasto = async () => {
    // Busca cycle_establishments
    let ceQuery = supabase
      .from('cycle_establishments')
      .select('id, total_orcado, establishment_id, establishments ( nome )')
      .eq('cycle_id', selectedCycle);
    if (selectedEst) ceQuery = ceQuery.eq('establishment_id', selectedEst);
    const { data: ceData, error: ceErr } = await ceQuery;
    if (ceErr) throw ceErr;

    // Busca purchase_requests aprovadas e solicitadas para este ciclo
    let prQuery = supabase
      .from('purchase_requests')
      .select('establishment_id, valor, status')
      .eq('cycle_id', selectedCycle)
      .in('status', ['APROVADA', 'SOLICITADA']);
    if (selectedEst) prQuery = prQuery.eq('establishment_id', selectedEst);
    const { data: prData, error: prErr } = await prQuery;
    if (prErr) throw prErr;

    // Agrupa
    const rows: OrcadoGastoRow[] = (ceData || []).map((ce: any) => {
      const estId = ce.establishment_id;
      const aprovadas = (prData || []).filter(p => p.establishment_id === estId && p.status === 'APROVADA');
      const pendentes = (prData || []).filter(p => p.establishment_id === estId && p.status === 'SOLICITADA');
      const gasto = aprovadas.reduce((s, p) => s + Number(p.valor), 0);
      const reservado = pendentes.reduce((s, p) => s + Number(p.valor), 0);
      const saldo = Number(ce.total_orcado) - gasto - reservado;
      const pct = Number(ce.total_orcado) > 0 ? ((gasto + reservado) / Number(ce.total_orcado)) * 100 : 0;
      return {
        establishment_id: estId,
        nome: (ce.establishments as any)?.nome || '—',
        total_orcado: Number(ce.total_orcado),
        valor_gasto: gasto,
        valor_reservado: reservado,
        saldo,
        pct_executado: pct,
      };
    });

    rows.sort((a, b) => a.nome.localeCompare(b.nome));
    setOrcadoGastoData(rows);
  };

  // -------------------------------------------
  // TAB 2: Detalhamento por Estabelecimento
  // -------------------------------------------
  const loadDetalhEstabelecimento = async () => {
    let q = supabase
      .from('purchase_requests')
      .select('establishment_id, valor, status, tipo_solicitacao, establishments ( nome ), positions ( codigo, nome )')
      .eq('cycle_id', selectedCycle)
      .eq('status', 'APROVADA');
    if (selectedEst) q = q.eq('establishment_id', selectedEst);
    if (selectedCargo) q = q.eq('position_id', selectedCargo);
    const { data, error } = await q;
    if (error) throw error;

    // Agrupa por est + cargo
    const map = new Map<string, DetalhEstRow>();
    for (const row of data || []) {
      const key = `${row.establishment_id}|${(row.positions as any)?.codigo || ''}`;
      if (!map.has(key)) {
        map.set(key, {
          establishment_id: row.establishment_id,
          nome_est: (row.establishments as any)?.nome || '—',
          position_codigo: (row.positions as any)?.codigo || '—',
          nome_cargo: (row.positions as any)?.nome || '—',
          qtd_folga_comp: 0,
          qtd_plantao_plus: 0,
          total_aprovado: 0,
        });
      }
      const entry = map.get(key)!;
      entry.total_aprovado += Number(row.valor);
      if (row.tipo_solicitacao === 'PLANTAO_PLUS') entry.qtd_plantao_plus++;
      else entry.qtd_folga_comp++;
    }
    const rows = Array.from(map.values()).sort((a, b) => a.nome_est.localeCompare(b.nome_est) || a.nome_cargo.localeCompare(b.nome_cargo));
    setDetalhEstData(rows);
  };

  // -------------------------------------------
  // TAB 3: Folha por Servidor
  // -------------------------------------------
  const loadFolhaServidor = async () => {
    // 1. Busca shifts no ciclo (plantões trabalhados)
    let shiftQ = supabase
      .from('shifts')
      .select('employee_id, quantidade_plantoes, employees ( id, matricula, nome, saldo_minutos, establishment_id, establishments ( nome ), positions ( codigo, nome ) )')
      .eq('cycle_id', selectedCycle);
    if (selectedEst) shiftQ = shiftQ.eq('employees.establishment_id', selectedEst);
    const { data: shiftData, error: shiftErr } = await shiftQ;
    if (shiftErr) throw shiftErr;

    // 2. Busca compensatory_days (folgas geradas)
    let compQ = supabase
      .from('compensatory_days')
      .select('employee_id, status, quantidade_plantoes')
      .eq('cycle_id', selectedCycle);
    const { data: compData, error: compErr } = await compQ;
    if (compErr) throw compErr;

    // 3. Busca purchase_requests aprovadas
    let prQ = supabase
      .from('purchase_requests')
      .select('employee_id, valor, tipo_solicitacao')
      .eq('cycle_id', selectedCycle)
      .eq('status', 'APROVADA');
    if (selectedEst) prQ = prQ.eq('establishment_id', selectedEst);
    if (selectedCargo) prQ = prQ.eq('position_id', selectedCargo);
    const { data: prData, error: prErr } = await prQ;
    if (prErr) throw prErr;

    // Agrupa por funcionário
    const empMap = new Map<string, FolhaServidorRow>();

    for (const s of shiftData || []) {
      const emp = (s.employees as any);
      if (!emp) continue;
      if (selectedEst && emp.establishment_id !== selectedEst) continue;

      const empId = emp.id;
      if (!empMap.has(empId)) {
        empMap.set(empId, {
          employee_id: empId,
          matricula: emp.matricula || '',
          nome: emp.nome || '',
          cargo_codigo: emp.positions?.codigo || '',
          cargo_nome: emp.positions?.nome || '',
          establishment_id: emp.establishment_id || '',
          nome_est: emp.establishments?.nome || '',
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
    }

    // Calcula total a pagar
    for (const row of empMap.values()) {
      row.total_a_pagar = row.valor_folga_comp + row.valor_plantao_plus;
    }

    let rows = Array.from(empMap.values()).sort((a, b) => a.nome_est.localeCompare(b.nome_est) || a.nome.localeCompare(b.nome));

    // Filtro por cargo
    if (selectedCargo) {
      const pos = positions.find(p => p.id === selectedCargo);
      if (pos) rows = rows.filter(r => r.cargo_codigo === pos.codigo);
    }

    setFolhaData(rows);
  };

  // -------------------------------------------
  // FILTRO LOCAL POR SERVIDOR
  // -------------------------------------------
  const folhaFiltered = useMemo(() => {
    if (!searchServidor.trim()) return folhaData;
    const q = searchServidor.toLowerCase();
    return folhaData.filter(r => r.nome.toLowerCase().includes(q) || r.matricula.toLowerCase().includes(q));
  }, [folhaData, searchServidor]);

  // -------------------------------------------
  // KPIs
  // -------------------------------------------
  const kpiOrcado = useMemo(() => {
    const totalOrcado = orcadoGastoData.reduce((s, r) => s + r.total_orcado, 0);
    const totalGasto = orcadoGastoData.reduce((s, r) => s + r.valor_gasto, 0);
    const totalReservado = orcadoGastoData.reduce((s, r) => s + r.valor_reservado, 0);
    const saldo = totalOrcado - totalGasto - totalReservado;
    return { totalOrcado, totalGasto, totalReservado, saldo };
  }, [orcadoGastoData]);

  const kpiFolha = useMemo(() => {
    const totalPagar = folhaFiltered.reduce((s, r) => s + r.total_a_pagar, 0);
    const totalFolgas = folhaFiltered.reduce((s, r) => s + r.folgas_compradas_qtd, 0);
    const totalPlus = folhaFiltered.reduce((s, r) => s + r.plantao_plus_qtd, 0);
    return { totalPagar, totalFolgas, totalPlus, totalServidores: folhaFiltered.length };
  }, [folhaFiltered]);

  const kpiDetalh = useMemo(() => {
    const totalAprovado = detalhEstData.reduce((s, r) => s + r.total_aprovado, 0);
    const totalFolgas = detalhEstData.reduce((s, r) => s + r.qtd_folga_comp, 0);
    const totalPlus = detalhEstData.reduce((s, r) => s + r.qtd_plantao_plus, 0);
    return { totalAprovado, totalFolgas, totalPlus };
  }, [detalhEstData]);

  const activeCycleObj = cycles.find(c => c.id === selectedCycle);

  // -------------------------------------------
  // EXPORTAÇÃO XLSX
  // -------------------------------------------
  const exportXLSX = () => {
    const wb = XLSX.utils.book_new();
    const cicloNome = activeCycleObj?.nome || 'Ciclo';

    if (activeTab === 'orcado_gasto') {
      const rows = orcadoGastoData.map(r => ({
        'Estabelecimento Penal': r.nome,
        'Valor Orçado (R$)': r.total_orcado,
        'Valor Gasto (R$)': r.valor_gasto,
        'Valor Reservado (R$)': r.valor_reservado,
        'Saldo Disponível (R$)': r.saldo,
        '% Executado': `${r.pct_executado.toFixed(1)}%`,
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, 'Orçado vs Gasto');
    } else if (activeTab === 'detalhe_est') {
      const rows = detalhEstData.map(r => ({
        'Estabelecimento Penal': r.nome_est,
        'Cargo': r.nome_cargo,
        'Cód. Cargo': r.position_codigo,
        'Qtd. Folgas Compensatórias': r.qtd_folga_comp,
        'Qtd. Plantão Plus': r.qtd_plantao_plus,
        'Total Aprovado (R$)': r.total_aprovado,
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, 'Detalhe por Estabelecimento');
    } else {
      const rows = folhaFiltered.map(r => ({
        'Matrícula': r.matricula,
        'Nome do Servidor': r.nome,
        'Cargo': r.cargo_nome,
        'Estabelecimento Penal': r.nome_est,
        'Plantões Trabalhados': r.plantoes_trabalhados,
        'Folgas Geradas': r.folgas_geradas,
        'Folgas Compradas': r.folgas_compradas_qtd,
        'Plantão Plus': r.plantao_plus_qtd,
        'Valor Folga Comp. (R$)': r.valor_folga_comp,
        'Valor Plantão Plus (R$)': r.valor_plantao_plus,
        'TOTAL A PAGAR (R$)': r.total_a_pagar,
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, 'Folha por Servidor');
    }

    const tabName = activeTab === 'orcado_gasto' ? 'OrcadoGasto' : activeTab === 'detalhe_est' ? 'DetalhEst' : 'FolhaServidor';
    XLSX.writeFile(wb, `Relatorio_${tabName}_${cicloNome.replace(/\s/g, '_')}_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  // -------------------------------------------
  // EXPORTAÇÃO PDF
  // -------------------------------------------
  const exportPDF = async () => {
    setExportingPdf(true);
    try {
      const { jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');

      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const cicloNome = activeCycleObj?.nome || 'Ciclo';
      const estNome = selectedEst ? (establishments.find(e => e.id === selectedEst)?.nome || 'Todas') : 'Todas as Unidades';
      const now = new Date().toLocaleString('pt-BR');

      // Cabeçalho
      doc.setFontSize(16);
      doc.setTextColor(30, 58, 138);
      doc.text('SEAP — Compensa+', 14, 16);
      doc.setFontSize(11);
      doc.setTextColor(71, 85, 105);
      const tabLabel = activeTab === 'orcado_gasto'
        ? 'Relatório 1: Orçado vs. Gasto por Estabelecimento'
        : activeTab === 'detalhe_est'
        ? 'Relatório 2: Detalhamento por Estabelecimento'
        : 'Relatório 3: Folha de Pagamento por Servidor';
      doc.text(tabLabel, 14, 23);
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(`Ciclo: ${cicloNome}   |   Unidade: ${estNome}   |   Gerado em: ${now}`, 14, 29);
      doc.line(14, 32, 283, 32);

      if (activeTab === 'orcado_gasto') {
        const totalOrcado = orcadoGastoData.reduce((s, r) => s + r.total_orcado, 0);
        const totalGasto = orcadoGastoData.reduce((s, r) => s + r.valor_gasto, 0);
        const totalReservado = orcadoGastoData.reduce((s, r) => s + r.valor_reservado, 0);

        autoTable(doc, {
          startY: 36,
          head: [['Estabelecimento Penal', 'Valor Orçado', 'Valor Gasto (Aprov.)', 'Valor Reservado (Pend.)', 'Saldo Disponível', '% Exec.']],
          body: [
            ...orcadoGastoData.map(r => [
              r.nome,
              fmt(r.total_orcado),
              fmt(r.valor_gasto),
              fmt(r.valor_reservado),
              fmt(r.saldo),
              `${r.pct_executado.toFixed(1)}%`,
            ]),
            ['TOTAL GERAL', fmt(totalOrcado), fmt(totalGasto), fmt(totalReservado), fmt(totalOrcado - totalGasto - totalReservado), '—'],
          ],
          headStyles: { fillColor: [30, 58, 138], textColor: 255, fontSize: 8, fontStyle: 'bold' },
          bodyStyles: { fontSize: 8 },
          alternateRowStyles: { fillColor: [241, 245, 249] },
          foot: [],
          didParseCell: (data) => {
            if (data.row.index === orcadoGastoData.length) {
              data.cell.styles.fontStyle = 'bold';
              data.cell.styles.fillColor = [203, 213, 225];
            }
          },
        });
      } else if (activeTab === 'detalhe_est') {
        const totalAprovado = detalhEstData.reduce((s, r) => s + r.total_aprovado, 0);
        autoTable(doc, {
          startY: 36,
          head: [['Estabelecimento Penal', 'Cargo', 'Folgas Comp.', 'Plantão Plus', 'Total Aprovado']],
          body: [
            ...detalhEstData.map(r => [
              r.nome_est,
              `${r.position_codigo} — ${r.nome_cargo}`,
              r.qtd_folga_comp.toString(),
              r.qtd_plantao_plus.toString(),
              fmt(r.total_aprovado),
            ]),
            ['TOTAL GERAL', '', '', '', fmt(totalAprovado)],
          ],
          headStyles: { fillColor: [5, 150, 105], textColor: 255, fontSize: 8, fontStyle: 'bold' },
          bodyStyles: { fontSize: 8 },
          alternateRowStyles: { fillColor: [236, 253, 245] },
          didParseCell: (data) => {
            if (data.row.index === detalhEstData.length) {
              data.cell.styles.fontStyle = 'bold';
              data.cell.styles.fillColor = [167, 243, 208];
            }
          },
        });
      } else {
        const totalPagar = folhaFiltered.reduce((s, r) => s + r.total_a_pagar, 0);
        autoTable(doc, {
          startY: 36,
          head: [['Matrícula', 'Servidor', 'Cargo', 'Estabelecimento', 'Plant. Trab.', 'Folgas Ger.', 'Folgas Comp.', 'Plant. Plus', 'Vl. Folga Comp.', 'Vl. Plant. Plus', 'TOTAL A PAGAR']],
          body: [
            ...folhaFiltered.map(r => [
              r.matricula,
              r.nome,
              r.cargo_codigo,
              r.nome_est,
              r.plantoes_trabalhados.toString(),
              r.folgas_geradas.toString(),
              r.folgas_compradas_qtd.toString(),
              r.plantao_plus_qtd.toString(),
              fmt(r.valor_folga_comp),
              fmt(r.valor_plantao_plus),
              fmt(r.total_a_pagar),
            ]),
            ['', 'TOTAL GERAL', '', '', '', '', '', '', '', '', fmt(totalPagar)],
          ],
          headStyles: { fillColor: [124, 58, 237], textColor: 255, fontSize: 7, fontStyle: 'bold' },
          bodyStyles: { fontSize: 7 },
          alternateRowStyles: { fillColor: [245, 243, 255] },
          columnStyles: { 10: { fontStyle: 'bold', textColor: [5, 150, 105] } },
          didParseCell: (data) => {
            if (data.row.index === folhaFiltered.length) {
              data.cell.styles.fontStyle = 'bold';
              data.cell.styles.fillColor = [221, 214, 254];
            }
          },
        });
      }

      const tabName = activeTab === 'orcado_gasto' ? 'OrcadoGasto' : activeTab === 'detalhe_est' ? 'DetalhEst' : 'FolhaServidor';
      doc.save(`Relatorio_${tabName}_${cicloNome.replace(/\s/g, '_')}_${new Date().toISOString().slice(0,10)}.pdf`);
    } catch (e: any) {
      setErrorMsg('Erro ao gerar PDF: ' + (e?.message || String(e)));
    } finally {
      setExportingPdf(false);
    }
  };

  // -------------------------------------------
  // RENDER HELPERS
  // -------------------------------------------
  const currentEmpty =
    (activeTab === 'orcado_gasto' && orcadoGastoData.length === 0) ||
    (activeTab === 'detalhe_est' && detalhEstData.length === 0) ||
    (activeTab === 'folha_servidor' && folhaFiltered.length === 0);

  const tabConfig: { key: ActiveTab; label: string; icon: React.ReactNode }[] = [
    { key: 'orcado_gasto', label: 'Orçado vs. Gasto', icon: <TrendingUp size={15} /> },
    { key: 'detalhe_est', label: 'Detalhamento por Unidade', icon: <Building2 size={15} /> },
    { key: 'folha_servidor', label: 'Folha por Servidor', icon: <Users size={15} /> },
  ];

  // -------------------------------------------
  // RENDER
  // -------------------------------------------
  return (
    <div className="modern-dashboard">

      {/* HEADER */}
      <div className="modern-header" style={{ flexWrap: 'wrap', gap: '12px', marginBottom: '24px' }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: '22px', fontWeight: 700, margin: '0 0 4px', color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FileText size={22} color="#3b82f6" /> Relatórios — Folha de Pagamento de Folgas
          </h1>
          <p style={{ color: 'var(--color-neutral-600)', margin: 0, fontSize: '13px' }}>
            Gere relatórios consolidados por ciclo, unidade penal, cargo ou servidor. Exporte em PDF ou Planilha.
          </p>
        </div>

        {activeCycleObj && (
          <div style={{
            padding: '8px 16px',
            borderRadius: '8px',
            background: activeCycleObj.status === 'ABERTO' || activeCycleObj.status === 'REABERTO' ? '#ecfdf5' : '#f1f5f9',
            border: activeCycleObj.status === 'ABERTO' || activeCycleObj.status === 'REABERTO' ? '1px solid #10b981' : '1px solid #cbd5e1',
            fontSize: '12px',
            fontWeight: 700,
            color: activeCycleObj.status === 'ABERTO' || activeCycleObj.status === 'REABERTO' ? '#047857' : '#475569',
          }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: activeCycleObj.status === 'ABERTO' || activeCycleObj.status === 'REABERTO' ? '#10b981' : '#64748b', display: 'inline-block', marginRight: '6px' }}></span>
            {activeCycleObj.nome} — {activeCycleObj.status}
            <div style={{ fontSize: '10px', fontWeight: 400, marginTop: '2px', color: '#64748b' }}>
              {fmtDate(activeCycleObj.data_inicio)} a {fmtDate(activeCycleObj.data_fim)}
            </div>
          </div>
        )}
      </div>

      {/* FILTROS */}
      <div style={{ background: '#fff', border: '1px solid var(--color-divider)', borderRadius: '12px', padding: '16px 20px', marginBottom: '20px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <Filter size={16} color="#64748b" style={{ marginBottom: '8px' }} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '200px', flex: '1' }}>
          <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Ciclo *</label>
          <select className="input" value={selectedCycle} onChange={e => setSelectedCycle(e.target.value)}
            style={{ height: '38px', fontSize: '13px', borderRadius: '8px', border: '1px solid var(--color-divider)', padding: '0 12px' }}>
            {cycles.map(c => (
              <option key={c.id} value={c.id}>{c.nome} ({c.status})</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '220px', flex: '1' }}>
          <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Estabelecimento Penal</label>
          <select className="input" value={selectedEst} onChange={e => { setSelectedEst(e.target.value); }}
            style={{ height: '38px', fontSize: '13px', borderRadius: '8px', border: '1px solid var(--color-divider)', padding: '0 12px' }}>
            <option value="">Todas as Unidades</option>
            {establishments.map(e => (<option key={e.id} value={e.id}>{e.nome}</option>))}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '160px', flex: '1' }}>
          <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Cargo</label>
          <select className="input" value={selectedCargo}
            onChange={e => { setSelectedCargo(e.target.value); if (selectedCycle) void loadData(activeTab); }}
            style={{ height: '38px', fontSize: '13px', borderRadius: '8px', border: '1px solid var(--color-divider)', padding: '0 12px' }}>
            <option value="">Todos os Cargos</option>
            {positions.map(p => (<option key={p.id} value={p.id}>{p.nome} ({p.codigo})</option>))}
          </select>
        </div>

        {activeTab === 'folha_servidor' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '200px', flex: '1' }}>
            <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Buscar Servidor</label>
            <input
              type="text"
              className="input"
              placeholder="Nome ou Matrícula..."
              value={searchServidor}
              onChange={e => setSearchServidor(e.target.value)}
              style={{ height: '38px', fontSize: '13px', borderRadius: '8px', border: '1px solid var(--color-divider)', padding: '0 12px' }}
            />
          </div>
        )}
      </div>

      {/* TABS */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', background: '#f1f5f9', borderRadius: '10px', padding: '4px' }}>
        {tabConfig.map(tab => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            style={{
              flex: 1,
              padding: '10px 16px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.15s ease',
              background: activeTab === tab.key ? '#fff' : 'transparent',
              color: activeTab === tab.key ? '#1e293b' : '#64748b',
              boxShadow: activeTab === tab.key ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* KPI CARDS */}
      {!loading && !errorMsg && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '20px' }}>
          {activeTab === 'orcado_gasto' && (<>
            <KpiCard label="Total Orçado" value={fmt(kpiOrcado.totalOrcado)} color="#3b82f6" icon={<DollarSign size={18} />} />
            <KpiCard label="Total Gasto (Aprovado)" value={fmt(kpiOrcado.totalGasto)} color="#10b981" icon={<TrendingUp size={18} />} />
            <KpiCard label="Valor Reservado (Pend.)" value={fmt(kpiOrcado.totalReservado)} color="#f59e0b" icon={<FileText size={18} />} />
            <KpiCard label="Saldo Disponível" value={fmt(kpiOrcado.saldo)} color={kpiOrcado.saldo >= 0 ? '#059669' : '#ef4444'} icon={<DollarSign size={18} />} />
          </>)}
          {activeTab === 'detalhe_est' && (<>
            <KpiCard label="Unidades com Movimento" value={new Set(detalhEstData.map(r => r.establishment_id)).size.toString()} color="#3b82f6" icon={<Building2 size={18} />} />
            <KpiCard label="Folgas Compensatórias" value={kpiDetalh.totalFolgas.toString()} color="#10b981" icon={<FileText size={18} />} />
            <KpiCard label="Plantão Plus Aprovados" value={kpiDetalh.totalPlus.toString()} color="#8b5cf6" icon={<TrendingUp size={18} />} />
            <KpiCard label="Total Aprovado (R$)" value={fmt(kpiDetalh.totalAprovado)} color="#059669" icon={<DollarSign size={18} />} />
          </>)}
          {activeTab === 'folha_servidor' && (<>
            <KpiCard label="Total de Servidores" value={kpiFolha.totalServidores.toString()} color="#3b82f6" icon={<Users size={18} />} />
            <KpiCard label="Folgas Compradas" value={kpiFolha.totalFolgas.toString()} color="#10b981" icon={<FileText size={18} />} />
            <KpiCard label="Plantão Plus" value={kpiFolha.totalPlus.toString()} color="#8b5cf6" icon={<TrendingUp size={18} />} />
            <KpiCard label="TOTAL A PAGAR" value={fmt(kpiFolha.totalPagar)} color="#059669" icon={<DollarSign size={18} />} highlight />
          </>)}
        </div>
      )}

      {/* TABELA */}
      <div style={{ background: '#fff', border: '1px solid var(--color-divider)', borderRadius: '12px', overflow: 'hidden', marginBottom: '16px' }}>
        {/* Cabeçalho tabela */}
        <div style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-divider)', background: '#f8fafc' }}>
          <div style={{ fontWeight: 700, fontSize: '14px', color: '#1e293b' }}>
            {activeTab === 'orcado_gasto' && `${orcadoGastoData.length} unidade(s) encontrada(s)`}
            {activeTab === 'detalhe_est' && `${detalhEstData.length} linha(s) de detalhamento`}
            {activeTab === 'folha_servidor' && `${folhaFiltered.length} servidor(es) na folha`}
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={exportPDF}
              disabled={currentEmpty || exportingPdf || loading}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: currentEmpty ? 'not-allowed' : 'pointer', background: currentEmpty ? '#e2e8f0' : '#ef4444', color: currentEmpty ? '#94a3b8' : '#fff', fontSize: '13px', fontWeight: 600 }}
            >
              <FileText size={15} /> {exportingPdf ? 'Gerando PDF...' : 'Exportar PDF'}
            </button>
            <button
              type="button"
              onClick={exportXLSX}
              disabled={currentEmpty || loading}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: currentEmpty ? 'not-allowed' : 'pointer', background: currentEmpty ? '#e2e8f0' : '#059669', color: currentEmpty ? '#94a3b8' : '#fff', fontSize: '13px', fontWeight: 600 }}
            >
              <FileSpreadsheet size={15} /> Exportar XLSX
            </button>
          </div>
        </div>

        {/* Conteúdo */}
        {loading ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#64748b' }}>
            <Download size={32} style={{ display: 'block', margin: '0 auto 12px', opacity: 0.4 }} />
            Carregando dados do relatório...
          </div>
        ) : errorMsg ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#ef4444', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={28} />
            <strong>Erro ao carregar:</strong> {errorMsg}
          </div>
        ) : currentEmpty ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#94a3b8' }}>
            <FileText size={32} style={{ display: 'block', margin: '0 auto 12px', opacity: 0.3 }} />
            Nenhum dado encontrado para os filtros selecionados.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>

            {/* TAB 1: Orçado vs Gasto */}
            {activeTab === 'orcado_gasto' && (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#1e3a8a' }}>
                    {['Estabelecimento Penal', 'Valor Orçado', 'Valor Gasto (Aprov.)', 'Reservado (Pend.)', 'Saldo Disponível', '% Executado'].map(h => (
                      <th key={h} style={{ padding: '10px 16px', color: '#fff', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', textAlign: h === 'Estabelecimento Penal' ? 'left' : 'right', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {orcadoGastoData.map((r, i) => (
                    <tr key={r.establishment_id} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                      <td style={{ padding: '10px 16px', fontWeight: 600 }}>{r.nome}</td>
                      <td style={{ padding: '10px 16px', textAlign: 'right' }}>{fmt(r.total_orcado)}</td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', color: '#059669', fontWeight: 600 }}>{fmt(r.valor_gasto)}</td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', color: '#d97706' }}>{fmt(r.valor_reservado)}</td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700, color: r.saldo >= 0 ? '#059669' : '#ef4444' }}>{fmt(r.saldo)}</td>
                      <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
                          <div style={{ width: '60px', height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ width: `${Math.min(100, r.pct_executado)}%`, height: '100%', background: r.pct_executado > 90 ? '#ef4444' : r.pct_executado > 70 ? '#f59e0b' : '#10b981', borderRadius: '3px' }}></div>
                          </div>
                          <span style={{ fontSize: '12px', fontWeight: 600, minWidth: '40px' }}>{r.pct_executado.toFixed(1)}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: '#1e3a8a', color: '#fff' }}>
                    <td style={{ padding: '10px 16px', fontWeight: 700, fontSize: '13px' }}>TOTAL GERAL</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700 }}>{fmt(kpiOrcado.totalOrcado)}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700 }}>{fmt(kpiOrcado.totalGasto)}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700 }}>{fmt(kpiOrcado.totalReservado)}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700 }}>{fmt(kpiOrcado.saldo)}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700 }}>—</td>
                  </tr>
                </tfoot>
              </table>
            )}

            {/* TAB 2: Detalhamento por Estabelecimento */}
            {activeTab === 'detalhe_est' && (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#059669' }}>
                    {['Estabelecimento Penal', 'Cargo', 'Cód.', 'Folgas Comp.', 'Plantão Plus', 'Total Aprovado (R$)'].map(h => (
                      <th key={h} style={{ padding: '10px 16px', color: '#fff', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', textAlign: h === 'Estabelecimento Penal' || h === 'Cargo' ? 'left' : 'right', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {detalhEstData.map((r, i) => (
                    <tr key={`${r.establishment_id}-${r.position_codigo}`} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#f0fdf4' }}>
                      <td style={{ padding: '10px 16px', fontWeight: 600 }}>{r.nome_est}</td>
                      <td style={{ padding: '10px 16px' }}>{r.nome_cargo}</td>
                      <td style={{ padding: '10px 16px', textAlign: 'right' }}><span style={{ padding: '2px 8px', borderRadius: '4px', background: '#dbeafe', color: '#1e40af', fontWeight: 700, fontSize: '11px' }}>{r.position_codigo}</span></td>
                      <td style={{ padding: '10px 16px', textAlign: 'right' }}>{r.qtd_folga_comp}</td>
                      <td style={{ padding: '10px 16px', textAlign: 'right' }}>{r.qtd_plantao_plus}</td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700, color: '#059669' }}>{fmt(r.total_aprovado)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: '#059669', color: '#fff' }}>
                    <td style={{ padding: '10px 16px', fontWeight: 700 }}>TOTAL GERAL</td>
                    <td colSpan={3}></td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700 }}>{kpiDetalh.totalFolgas + kpiDetalh.totalPlus}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700 }}>{fmt(kpiDetalh.totalAprovado)}</td>
                  </tr>
                </tfoot>
              </table>
            )}

            {/* TAB 3: Folha por Servidor */}
            {activeTab === 'folha_servidor' && (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ background: '#7c3aed' }}>
                    {['Matrícula', 'Servidor', 'Cargo', 'Estabelecimento', 'Plant. Trab.', 'Folgas Ger.', 'Folgas Comp.', 'Plant. Plus', 'Vl. Folga Comp.', 'Vl. Plant. Plus', 'TOTAL A PAGAR'].map(h => (
                      <th key={h} style={{ padding: '10px 12px', color: '#fff', fontWeight: 600, fontSize: '10px', textTransform: 'uppercase', textAlign: ['Matrícula', 'Servidor', 'Cargo', 'Estabelecimento'].includes(h) ? 'left' : 'right', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {folhaFiltered.map((r, i) => (
                    <tr key={r.employee_id} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#faf5ff' }}>
                      <td style={{ padding: '9px 12px', fontWeight: 600, color: '#475569' }}>{r.matricula}</td>
                      <td style={{ padding: '9px 12px', fontWeight: 600 }}>{r.nome}</td>
                      <td style={{ padding: '9px 12px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: '4px', background: '#dbeafe', color: '#1e40af', fontWeight: 700, fontSize: '10px' }}>{r.cargo_codigo}</span>
                      </td>
                      <td style={{ padding: '9px 12px', color: '#475569', fontSize: '11px' }}>{r.nome_est}</td>
                      <td style={{ padding: '9px 12px', textAlign: 'right' }}>{r.plantoes_trabalhados}</td>
                      <td style={{ padding: '9px 12px', textAlign: 'right' }}>{r.folgas_geradas}</td>
                      <td style={{ padding: '9px 12px', textAlign: 'right', color: '#059669', fontWeight: 600 }}>{r.folgas_compradas_qtd}</td>
                      <td style={{ padding: '9px 12px', textAlign: 'right', color: '#7c3aed', fontWeight: 600 }}>{r.plantao_plus_qtd}</td>
                      <td style={{ padding: '9px 12px', textAlign: 'right' }}>{fmt(r.valor_folga_comp)}</td>
                      <td style={{ padding: '9px 12px', textAlign: 'right' }}>{fmt(r.valor_plantao_plus)}</td>
                      <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 700, color: '#059669', fontSize: '13px' }}>{fmt(r.total_a_pagar)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: '#7c3aed', color: '#fff' }}>
                    <td colSpan={4} style={{ padding: '10px 12px', fontWeight: 700 }}>TOTAL GERAL — {folhaFiltered.length} servidor(es)</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700 }}>{folhaFiltered.reduce((s, r) => s + r.plantoes_trabalhados, 0)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700 }}>{folhaFiltered.reduce((s, r) => s + r.folgas_geradas, 0)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700 }}>{folhaFiltered.reduce((s, r) => s + r.folgas_compradas_qtd, 0)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700 }}>{folhaFiltered.reduce((s, r) => s + r.plantao_plus_qtd, 0)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700 }}>{fmt(folhaFiltered.reduce((s, r) => s + r.valor_folga_comp, 0))}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700 }}>{fmt(folhaFiltered.reduce((s, r) => s + r.valor_plantao_plus, 0))}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, fontSize: '14px' }}>{fmt(kpiFolha.totalPagar)}</td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        )}
      </div>

    </div>
  );
};

// -------------------------------------------
// KPI CARD SUB-COMPONENTE
// -------------------------------------------
const KpiCard: React.FC<{ label: string; value: string; color: string; icon: React.ReactNode; highlight?: boolean }> = ({ label, value, color, icon, highlight }) => (
  <div style={{
    background: highlight ? color : '#fff',
    border: `1px solid ${highlight ? color : 'var(--color-divider)'}`,
    borderLeft: `4px solid ${color}`,
    borderRadius: '10px',
    padding: '14px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  }}>
    <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: highlight ? 'rgba(255,255,255,0.2)' : `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: highlight ? '#fff' : color, flexShrink: 0 }}>
      {icon}
    </div>
    <div>
      <div style={{ fontSize: '10px', fontWeight: 700, color: highlight ? 'rgba(255,255,255,0.8)' : '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>{label}</div>
      <div style={{ fontSize: '16px', fontWeight: 800, color: highlight ? '#fff' : '#1e293b', lineHeight: 1 }}>{value}</div>
    </div>
  </div>
);

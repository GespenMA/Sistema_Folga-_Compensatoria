import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { diasRestantesAte, tempoRestanteAte, diffDiasCalendario, hojeNoBrasil } from '../../lib/date';
import { useAuth } from '../../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { 
  Calendar, DollarSign, Users, FileText, CheckCircle, AlertCircle, Clock, ArrowRight,
  TrendingUp, Activity, BadgeAlert, Calculator, UserPlus, FilePlus,
  ChevronUp, ChevronDown, ChevronsUpDown,
  Wallet, Scale, Layers, Info
} from 'lucide-react';
import {
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend
} from 'recharts';

type DashboardTab = 'geral' | 'ranking';
type ServSortColumn = 'pos' | 'nome' | 'cargo' | 'qFolga' | 'qPlus' | 'qTotal' | 'vTotal';
type SortDirection = 'asc' | 'desc';

export const EstabelecimentoDashboard: React.FC = () => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<DashboardTab>('geral');
  const [activeCycle, setActiveCycle] = useState<any>(null);
  const [cycles, setCycles] = useState<any[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState<string>('');
  const [cycleEst, setCycleEst] = useState<any>(null);
  const [limits, setLimits] = useState<any[]>([]);
  const [purchaseRequests, setPurchaseRequests] = useState<any[]>([]);
  const [compensatoryDays, setCompensatoryDays] = useState<any[]>([]);
  const [estName, setEstName] = useState<string>('');
  const [totalUnitEmployees, setTotalUnitEmployees] = useState<number>(0);

  // Sorting para tabela de ranking por servidor
  const [servSortCol, setServSortCol] = useState<ServSortColumn | null>(null);
  const [servSortDir, setServSortDir] = useState<SortDirection>('desc');

  useEffect(() => {
    if (profile?.establishment_id) {
      void fetchDashboardData();
    }
  }, [profile]);

  const fetchDashboardData = async (targetCycleId?: string) => {
    setLoading(true);
    try {
      if (!profile?.establishment_id) return;
      const establishmentId = profile.establishment_id;

      // 1. Dados estruturais da unidade e lista de ciclos em paralelo
      const [estRes, cyclesRes, empsRes, pvsRes] = await Promise.all([
        supabase.from('establishments').select('nome').eq('id', establishmentId).single(),
        supabase.from('cycles').select('*').order('ano', { ascending: false }).order('mes', { ascending: false }),
        supabase.from('employees').select('id', { count: 'exact' }).eq('establishment_id', establishmentId),
        supabase.from('position_values').select('valor, position_id').is('vigencia_fim', null)
      ]);

      if (estRes.data) setEstName(estRes.data.nome);
      if (empsRes.count !== null && empsRes.count !== undefined) {
        setTotalUnitEmployees(empsRes.count);
      } else if (empsRes.data) {
        setTotalUnitEmployees(empsRes.data.length);
      }

      const list = cyclesRes.data || [];
      setCycles(list);

      let ciclo = null;
      const cId = targetCycleId || selectedCycleId;

      if (list.length > 0) {
        if (cId) {
          ciclo = list.find(c => c.id === cId);
        }
        if (!ciclo) {
          ciclo = list.find(c => c.status === 'ABERTO' || c.status === 'REABERTO') || list[0];
        }
      }

      setActiveCycle(ciclo);
      setSelectedCycleId(ciclo ? ciclo.id : '');

      const pvMap: Record<string, number> = {};
      if (pvsRes.data) {
        pvsRes.data.forEach((p: any) => { pvMap[p.position_id] = Number(p.valor); });
      }

      if (ciclo) {
        // 2. Consultas operacionais restritas à própria unidade em paralelo
        const [estDataRes, requestsRes, daysRes] = await Promise.all([
          supabase
            .from('cycle_establishments')
            .select('id, total_orcado, planning_limits ( quantidade_planejada, position_id, positions ( codigo, nome ) )')
            .eq('cycle_id', ciclo.id)
            .eq('establishment_id', establishmentId)
            .maybeSingle(),
          supabase
            .from('purchase_requests')
            .select('id, valor, status, requested_at, position_id, employee_id, tipo_solicitacao, positions (codigo, nome), employees (nome, matricula)')
            .eq('cycle_id', ciclo.id)
            .eq('establishment_id', establishmentId)
            .order('requested_at', { ascending: false }),
          supabase
            .from('compensatory_days')
            .select('id, status, quantidade_plantoes, periodo_inicio, generated_at, employee_id, employees!inner (establishment_id, nome, matricula, positions (codigo, nome))')
            .eq('cycle_id', ciclo.id)
            .eq('employees.establishment_id', establishmentId)
            .order('generated_at', { ascending: false })
        ]);

        if (estDataRes.data) {
          const estData = estDataRes.data;
          const limitsData = estData.planning_limits || [];
          setLimits(limitsData);

          let recalc = 0;
          limitsData.forEach((l: any) => {
            recalc += (l.quantidade_planejada || 0) * (pvMap[l.position_id] || 0);
          });
          if (recalc > 0) estData.total_orcado = recalc;
          setCycleEst(estData);
        } else {
          setCycleEst(null);
          setLimits([]);
        }

        if (requestsRes.data) {
          const processedReqs = (requestsRes.data as any[]).map(r => {
            if (r.position_id && pvMap[r.position_id]) r.valor = pvMap[r.position_id];
            return r;
          });
          setPurchaseRequests(processedReqs);
        } else {
          setPurchaseRequests([]);
        }

        setCompensatoryDays(daysRes.data || []);
      } else {
        setCycleEst(null);
        setLimits([]);
        setPurchaseRequests([]);
        setCompensatoryDays([]);
      }
    } catch (err: any) {
      console.error('Erro ao buscar dados do dashboard do estabelecimento:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCycleChange = (newCycleId: string) => {
    setSelectedCycleId(newCycleId);
    void fetchDashboardData(newCycleId);
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  const formatDateString = (dateStr: string) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
  };

  // Cálculos Gerais baseados no ciclo ativo/selecionado
  const totalOrcado = cycleEst?.total_orcado || 0;
  const reqAprovadas = purchaseRequests.filter(r => r.status === 'APROVADA');
  const reqPendentes = purchaseRequests.filter(r => r.status === 'SOLICITADA');
  const reqRejeitadas = purchaseRequests.filter(r => r.status === 'REJEITADA');
  
  const totalGasto = reqAprovadas.reduce((acc, curr) => acc + Number(curr.valor), 0);
  const totalReservado = reqPendentes.reduce((acc, curr) => acc + Number(curr.valor), 0);
  const saldoDisponivel = totalOrcado - totalGasto - totalReservado;
  const pctGasto = totalOrcado > 0 ? (totalGasto / totalOrcado) * 100 : 0;
  const pctReservado = totalOrcado > 0 ? (totalReservado / totalOrcado) * 100 : 0;
  const pctDisponivel = totalOrcado > 0 ? (saldoDisponivel / totalOrcado) * 100 : 0;

  let totalDias = 0;
  let diasRestantes = 0;
  let tempoRestante = { horas: 0, minutos: 0 };
  let pctCiclo = 0;

  if (activeCycle) {
    totalDias = diffDiasCalendario(activeCycle.data_inicio, activeCycle.data_fim);
    diasRestantes = diasRestantesAte(activeCycle.data_fim);
    tempoRestante = tempoRestanteAte(activeCycle.data_fim);
    if (totalDias > 0) {
      const diasPassados = diffDiasCalendario(activeCycle.data_inicio, hojeNoBrasil());
      pctCiclo = Math.min(100, Math.max(0, (diasPassados / totalDias) * 100));
    }
  }

  // Direitos
  const folgasGozadas = compensatoryDays.filter(d => d.status === 'USUFRUIDA').length;
  const folgasCompradas = reqAprovadas.filter(r => r.tipo_solicitacao === 'FOLGA_COMPENSATORIA').length;
  const plantaoPlusCompradas = reqAprovadas.filter(r => r.tipo_solicitacao === 'PLANTAO_PLUS').length;
  const aguardandoDecisao = reqPendentes.length;

  const getLimit = (codigo: string) => limits.find(lim => lim.positions?.codigo === codigo)?.quantidade_planejada || 0;
  const getConsumido = (codigo: string) => reqAprovadas.filter(r => r.positions?.codigo === codigo).length + reqPendentes.filter(r => r.positions?.codigo === codigo).length;

  // CÁLCULOS EXCLUSIVOS DE RANKING DA UNIDADE
  const rankingData = useMemo(() => {
    const aprovadas = purchaseRequests.filter(r => r.status === 'APROVADA');

    const rankServidores: Record<string, {
      id: string;
      nome: string;
      matricula: string;
      cargo: string;
      qFolga: number;
      qPlus: number;
      vFolga: number;
      vPlus: number;
      qTotal: number;
      vTotal: number;
    }> = {};

    const rankCargos: Record<string, {
      id: string;
      nome: string;
      qFolga: number;
      qPlus: number;
      vFolga: number;
      vPlus: number;
      qTotal: number;
      vTotal: number;
    }> = {};

    let totalGlobalFolga = 0;
    let totalGlobalPlus = 0;

    aprovadas.forEach(req => {
      const empName = req.employees?.nome || 'Servidor Desconhecido';
      const empMat = req.employees?.matricula || '';
      const empId = req.employee_id || empName;
      const posName = req.positions?.nome || req.positions?.codigo || 'Cargo Desconhecido';
      const posId = req.position_id || posName;
      const val = Number(req.valor) || 0;
      const isPlus = req.tipo_solicitacao === 'PLANTAO_PLUS';
      const isFolga = req.tipo_solicitacao === 'FOLGA_COMPENSATORIA';

      if (isPlus) totalGlobalPlus += val;
      if (isFolga) totalGlobalFolga += val;

      if (!rankServidores[empId]) {
        rankServidores[empId] = {
          id: empId,
          nome: empName,
          matricula: empMat,
          cargo: posName,
          qFolga: 0,
          qPlus: 0,
          vFolga: 0,
          vPlus: 0,
          qTotal: 0,
          vTotal: 0
        };
      }

      if (!rankCargos[posId]) {
        rankCargos[posId] = {
          id: posId,
          nome: posName,
          qFolga: 0,
          qPlus: 0,
          vFolga: 0,
          vPlus: 0,
          qTotal: 0,
          vTotal: 0
        };
      }

      const addStats = (obj: any) => {
        if (isPlus) { obj.qPlus++; obj.vPlus += val; }
        if (isFolga) { obj.qFolga++; obj.vFolga += val; }
        obj.qTotal++;
        obj.vTotal += val;
      };

      addStats(rankServidores[empId]);
      addStats(rankCargos[posId]);
    });

    const sortRanking = (record: any) => {
      const arr = Object.values(record).sort((a: any, b: any) => b.qTotal - a.qTotal || b.vTotal - a.vTotal) as any[];
      return arr.map((item, index) => ({ ...item, pos: index + 1 }));
    };

    const sortedServidores = sortRanking(rankServidores);
    const sortedCargos = sortRanking(rankCargos);
    const totalGlobal = totalGasto;
    const baseOrcamento = totalOrcado > 0 ? totalOrcado : totalGlobal;
    const gastoAprovado = totalGlobal;
    const saldoRestante = Math.max(0, baseOrcamento - gastoAprovado);
    const pctGasto = baseOrcamento > 0 ? Math.round((gastoAprovado / baseOrcamento) * 100) : 0;
    const pctSaldo = baseOrcamento > 0 ? Math.round((saldoRestante / baseOrcamento) * 100) : 0;

    // Pareto exclusivo da unidade
    let paretoMsg: string | null = null;
    let paretoRec: string | null = null;
    let paretoLevel: 'verde' | 'amarelo' | 'vermelho' | null = null;
    let paretoPct = 0;
    let paretoStats: { 
      efetivo: number; 
      compraram: number; 
      naoCompraram: number; 
      sliceReal: number;
      baseOrcamento: number;
      gastoAprovado: number;
      saldoRestante: number;
      pctGasto: number;
      pctSaldo: number;
      top20Sum: number;
      top20Qtd: number;
    } | null = null;

    if (totalUnitEmployees > 0 && baseOrcamento > 0 && sortedServidores.length > 0) {
      const top20Count = Math.max(1, Math.ceil(totalUnitEmployees * 0.2));
      const top20Slice = sortedServidores.slice(0, top20Count);
      const top20Sum = top20Slice.reduce((acc, s) => acc + s.vTotal, 0);
      const top20Qtd = top20Slice.reduce((acc, s) => acc + s.qTotal, 0);
      paretoPct = Math.round((top20Sum / baseOrcamento) * 100);

      const compraram = sortedServidores.length;
      const naoCompraram = Math.max(0, totalUnitEmployees - compraram);
      const sliceReal = top20Slice.length;
      paretoStats = { 
        efetivo: totalUnitEmployees, 
        compraram, 
        naoCompraram, 
        sliceReal,
        baseOrcamento,
        gastoAprovado,
        saldoRestante,
        pctGasto,
        pctSaldo,
        top20Sum,
        top20Qtd
      };

      if (paretoPct > 65) {
        paretoLevel = 'vermelho';
        paretoMsg = `Atenção: Os ${sliceReal} servidores no topo do ranking receberam juntos ${formatCurrency(top20Sum)} (${top20Qtd} solicitações), consumindo ${paretoPct}% de todo o orçamento da unidade (${formatCurrency(baseOrcamento)}). A maior parte da verba foi concentrada neste pequeno grupo. (Veja os ${sliceReal} servidores destacados com a tag Top 20% na tabela abaixo ⬇️)`;
        paretoRec = 'Recomenda-se uma revisão da distribuição das escalas extras desta unidade.';
      } else if (paretoPct > 50) {
        paretoLevel = 'amarelo';
        paretoMsg = `Os ${sliceReal} servidores no topo do ranking receberam juntos ${formatCurrency(top20Sum)} (${top20Qtd} solicitações), consumindo ${paretoPct}% do orçamento da unidade (${formatCurrency(baseOrcamento)}). A distribuição ainda é aceitável, mas começa a se concentrar. (Veja os ${sliceReal} servidores destacados com a tag Top 20% na tabela abaixo ⬇️)`;
        paretoRec = 'Vale monitorar se esse padrão se repete nos próximos ciclos e considerar uma distribuição mais equitativa das escalas.';
      } else {
        paretoLevel = 'verde';
        paretoMsg = `Os ${sliceReal} servidores no topo do ranking receberam juntos ${formatCurrency(top20Sum)} (${top20Qtd} solicitações), consumindo apenas ${paretoPct}% do orçamento da unidade (${formatCurrency(baseOrcamento)}). O restante da verba está bem distribuído e disponível para o efetivo. (Veja os ${sliceReal} servidores destacados com a tag Top 20% na tabela abaixo ⬇️)`;
        paretoRec = null;
      }
    }

    return {
      servidores: sortedServidores,
      cargos: sortedCargos,
      totalGlobal,
      totalGlobalFolga,
      totalGlobalPlus,
      paretoMsg,
      paretoRec,
      paretoLevel,
      paretoPct,
      paretoStats
    };
  }, [purchaseRequests, totalUnitEmployees, totalGasto, totalOrcado]);

  // Ordenação da tabela de ranking por servidor mantendo pos original
  const sortedRankingServidores = useMemo(() => {
    if (!servSortCol) return rankingData.servidores;
    const sorted = [...rankingData.servidores].sort((a, b) => {
      const valA = a[servSortCol];
      const valB = b[servSortCol];
      if (typeof valA === 'string' && typeof valB === 'string') {
        return valA.localeCompare(valB, 'pt-BR');
      }
      return (Number(valA) || 0) - (Number(valB) || 0);
    });
    return servSortDir === 'asc' ? sorted : sorted.reverse();
  }, [rankingData.servidores, servSortCol, servSortDir]);

  const handleServSort = (col: ServSortColumn) => {
    if (servSortCol === col) {
      setServSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setServSortCol(col);
      setServSortDir('desc');
    }
  };

  const renderSortHeader = (column: ServSortColumn, label: string, align: 'left' | 'right' | 'center' = 'left') => {
    const isActive = servSortCol === column;
    const Icon = isActive ? (servSortDir === 'asc' ? ChevronUp : ChevronDown) : ChevronsUpDown;
    return (
      <th
        style={{ padding: '12px 16px', textAlign: align, cursor: 'pointer', userSelect: 'none' }}
        onClick={() => handleServSort(column)}
        aria-sort={isActive ? (servSortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', justifyContent: align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start' }}>
          {label}
          <Icon size={14} aria-hidden="true" style={{ opacity: isActive ? 1 : 0.35, flexShrink: 0 }} />
        </span>
      </th>
    );
  };

  const renderProportionBar = (valorGasto: number, orcamentoTotal: number) => {
    if (orcamentoTotal <= 0) return null;
    const pct = ((valorGasto / orcamentoTotal) * 100).toFixed(1);
    const pctNumber = Number(pct);
    const barWidth = Math.min(Math.max(pctNumber, 0), 100);
    return (
      <div style={{ marginTop: '4px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '2px' }}>
          <span>{pct}% do orç.</span>
        </div>
        <div style={{ width: '100%', height: '4px', background: '#e2e8f0', borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{ width: `${barWidth}%`, height: '100%', background: '#3b82f6', borderRadius: '2px' }} />
        </div>
      </div>
    );
  };

  if (loading) return <div style={{ padding: 'var(--space-6)', textAlign: 'center' }}>Carregando painel corporativo...</div>;

  if (cycles.length === 0) {
    return (
      <div className="modern-dashboard">
         <div className="modern-card" style={{ textAlign: 'center', padding: '64px' }}>
            <AlertCircle size={48} color="var(--color-neutral-400)" style={{ margin: '0 auto var(--space-4)' }} />
            <h2 style={{ fontSize: '24px' }}>Nenhum Ciclo Cadastrado</h2>
            <p className="text-muted">No momento, não há nenhum ciclo cadastrado no sistema. Aguarde a liberação do Administrador Geral.</p>
         </div>
      </div>
    );
  }

  return (
    <div className="modern-dashboard">
      
      {/* HEADER */}
      <div className="modern-header" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
        <div style={{ flex: 1, minWidth: '300px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 700, margin: '0 0 4px 0', color: 'var(--color-text)' }}>
            Dashboard do Estabelecimento Penal - {estName}
          </h1>
          <p style={{ color: 'var(--color-neutral-600)', margin: 0, fontSize: '14px', marginBottom: '16px' }}>
            Acompanhe os principais indicadores, recursos e rankings da sua unidade.
          </p>

          {/* Seletor de Ciclo */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Visualizar Ciclo</label>
            <select
              className="input"
              value={selectedCycleId}
              onChange={e => handleCycleChange(e.target.value)}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: '1px solid var(--color-divider)',
                fontSize: '13px',
                background: '#fff',
                minWidth: '240px',
                width: 'fit-content',
                height: '38px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {cycles.map(c => (
                <option key={c.id} value={c.id}>
                  {c.nome} ({c.status})
                </option>
              ))}
            </select>
          </div>
        </div>
        
        {activeCycle && (
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <div className="modern-card" style={{ padding: '12px 20px', flexDirection: 'row', alignItems: 'center', gap: '16px', borderTop: activeCycle.status === 'ABERTO' || activeCycle.status === 'REABERTO' ? '3px solid #10b981' : '3px solid #64748b' }}>
              <Calendar size={24} color={activeCycle.status === 'ABERTO' || activeCycle.status === 'REABERTO' ? '#10b981' : '#64748b'} />
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: activeCycle.status === 'ABERTO' || activeCycle.status === 'REABERTO' ? '#047857' : '#475569', textTransform: 'uppercase' }}>
                  Ciclo {activeCycle.status}
                </div>
                <div style={{ fontSize: '15px', fontWeight: 600 }}>{activeCycle.nome}</div>
              </div>
              <div style={{ width: '1px', height: '30px', background: 'var(--color-divider)' }}></div>
              <div>
                 <div style={{ fontSize: '12px', color: '#ea580c', fontWeight: 600 }}>
                   {activeCycle.status === 'ABERTO' || activeCycle.status === 'REABERTO' 
                      ? `Restam ${diasRestantes} dias (${tempoRestante.horas}h ${tempoRestante.minutos}m)` 
                      : 'Ciclo Encerrado'}
                 </div>
                 <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                   {activeCycle.status === 'ABERTO' || activeCycle.status === 'REABERTO' ? 'para o encerramento' : `${formatDateString(activeCycle.data_inicio)} a ${formatDateString(activeCycle.data_fim)}`}
                 </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ABAS (TABS) SUPERIORES */}
      <div className="dashboard-tabs" role="tablist" aria-label="Seções do dashboard">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'geral'}
          className={`dashboard-tab${activeTab === 'geral' ? ' dashboard-tab--active' : ''}`}
          onClick={() => setActiveTab('geral')}
        >
          Visão Geral
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'ranking'}
          className={`dashboard-tab${activeTab === 'ranking' ? ' dashboard-tab--active' : ''}`}
          onClick={() => setActiveTab('ranking')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          🏆 Ranking da Unidade
        </button>
      </div>

      {activeCycle ? (
        <>
          {/* TAB 1: VISÃO GERAL */}
          {activeTab === 'geral' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
              {/* ROW 1: CARDS */}
              <div className="grid-4">
                
                {/* Orçamento */}
                <div className="modern-card">
                  <div className="modern-card-title">
                    <div style={{ background: '#dcfce7', padding: '6px', borderRadius: '50%' }}>
                       <DollarSign size={16} color="#166534" />
                    </div>
                    Orçamento Disponível
                  </div>
                  <div className="modern-card-value">{formatCurrency(saldoDisponivel)}</div>
                  
                  <div className="progress-bar-bg" style={{ marginBottom: '8px' }}>
                     <div className="progress-bar-fill" style={{ width: `${pctDisponivel}%`, background: '#22c55e' }}></div>
                  </div>
                  <div style={{ fontSize: '12px', color: '#166534', fontWeight: 600 }}>{pctDisponivel.toFixed(1)}% disponível</div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--color-divider)' }}>
                     <div>
                        <div style={{ fontSize: '11px', color: 'var(--color-neutral-500)' }}>Total</div>
                        <div style={{ fontSize: '12px', fontWeight: 600 }}>{formatCurrency(totalOrcado)}</div>
                     </div>
                     <div>
                        <div style={{ fontSize: '11px', color: 'var(--color-neutral-500)' }}>Gasto + Res.</div>
                        <div style={{ fontSize: '12px', fontWeight: 600 }}>{formatCurrency(totalGasto + totalReservado)}</div>
                     </div>
                  </div>
                </div>

                {/* Direitos */}
                <div className="modern-card">
                  <div className="modern-card-title">
                    <div style={{ background: '#dbeafe', padding: '6px', borderRadius: '50%' }}>
                       <Users size={16} color="#1e40af" />
                    </div>
                    Direitos Gerados
                  </div>
                  <div className="modern-card-value" style={{ marginBottom: '4px' }}>{compensatoryDays.length}</div>
                  <div style={{ fontSize: '11px', color: 'var(--color-neutral-500)', marginBottom: '12px', lineHeight: 1.4 }}>
                     Total de folgas adquiridas pelos servidores da unidade neste ciclo (1 folga de 12h a cada 21 plantões).
                  </div>
                  
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', marginBottom: '4px' }}>
                       <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }}></span>
                       {folgasCompradas} compradas (folgas)
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', marginBottom: '4px' }}>
                       <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#8b5cf6' }}></span>
                       {plantaoPlusCompradas} compradas (plantão plus)
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', marginBottom: '4px' }}>
                       <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3b82f6' }}></span>
                       {folgasGozadas} folgas gozadas
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                       <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b' }}></span>
                       {aguardandoDecisao} aguardando decisão
                    </div>
                  </div>
                  
                  <div style={{ marginTop: '16px' }}>
                     <Link to="/estabelecimento/folgas" style={{ fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        Ver direitos à folga <ArrowRight size={14} />
                     </Link>
                  </div>
                </div>

                {/* Solicitações */}
                <div className="modern-card">
                  <div className="modern-card-title">
                    <div style={{ background: '#fef3c7', padding: '6px', borderRadius: '50%' }}>
                       <FileText size={16} color="#b45309" />
                    </div>
                    Solicitações
                  </div>
                  <div className="modern-card-value">{purchaseRequests.length}</div>
                  
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', marginBottom: '4px' }}>
                       <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b' }}></span>
                       {reqPendentes.length} pendentes
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', marginBottom: '4px' }}>
                       <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }}></span>
                       {reqAprovadas.length} aprovadas
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                       <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444' }}></span>
                       {reqRejeitadas.length} rejeitadas
                    </div>
                  </div>
                  
                  <div style={{ marginTop: '16px' }}>
                     <Link to="/estabelecimento/solicitacoes" style={{ fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        Ver solicitações <ArrowRight size={14} />
                     </Link>
                  </div>
                </div>

                {/* Ciclo */}
                <div className="modern-card">
                  <div className="modern-card-title">
                    <div style={{ background: '#f3e8ff', padding: '6px', borderRadius: '50%' }}>
                       <Clock size={16} color="#7e22ce" />
                    </div>
                    Tempo do Ciclo
                  </div>
                  <div className="modern-card-value" style={{ display: 'flex', alignItems: 'baseline', gap: '6px', flexWrap: 'wrap' }}>
                    <span>{diasRestantes} dias</span>
                    <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-neutral-500)' }}>
                      ({tempoRestante.horas}h {tempoRestante.minutos}m)
                    </span>
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '16px' }}>para o encerramento</div>
                  
                  <div className="progress-bar-bg" style={{ marginBottom: '8px' }}>
                     <div className="progress-bar-fill" style={{ width: `${pctCiclo}%`, background: '#a855f7' }}></div>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--color-neutral-600)' }}>{pctCiclo.toFixed(0)}% do ciclo concluído</div>
                </div>

              </div>

              {/* ROW 2: PANELS */}
              <div className="grid-2">
                
                {/* Planejamento por cargo */}
                <div className="modern-card">
                  <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '24px' }}>Planejamento por Cargo (Cotas para Compra)</div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                     {['INSP', 'APT', 'ASP'].map(codigo => {
                        const limit = getLimit(codigo);
                        const consumido = getConsumido(codigo);
                        const pct = limit > 0 ? (consumido / limit) * 100 : 0;
                        const color = pct > 90 ? '#ef4444' : (pct > 70 ? '#f59e0b' : '#3b82f6');
                        const title = codigo === 'INSP' ? 'Inspetor de Polícia Penal' : (codigo === 'APT' ? 'Agente Penitenciário Temporário' : 'Auxiliar de Segurança Penitenciária');
                        
                        return (
                          <div key={codigo}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                              <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                 <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <BadgeAlert size={14} color="#64748b" />
                                 </span>
                                 {title}
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                 <span style={{ color: 'var(--color-neutral-500)', fontSize: '11px', marginRight: '8px' }}>Utilizado / Planejado</span>
                                 <span style={{ fontWeight: 700 }}>{consumido} / {limit}</span>
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <div className="progress-bar-bg" style={{ flex: 1 }}>
                                 <div className="progress-bar-fill" style={{ width: `${pct}%`, background: color }}></div>
                              </div>
                              <div style={{ width: '40px', textAlign: 'right', fontSize: '12px', fontWeight: 600, color: 'var(--color-neutral-600)' }}>
                                 {pct.toFixed(0)}%
                              </div>
                            </div>
                          </div>
                        );
                     })}
                  </div>
                  
                  <div style={{ marginTop: '24px', textAlign: 'center' }}>
                     <Link to="/estabelecimento/simulador" style={{ fontSize: '13px', fontWeight: 600 }}>Planejar no Simulador &rarr;</Link>
                  </div>
                </div>

                {/* Consumo do Orçamento */}
                <div className="modern-card">
                  <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '24px' }}>Orçamento da Unidade</div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '32px', height: '100%', padding: '0 24px' }}>
                     <div className="circle-chart" style={{ width: '140px', height: '140px', '--chart-color': '#10b981', '--chart-pct': `${pctGasto + pctReservado}%` } as any}>
                        <div className="circle-chart-text" style={{ fontSize: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                           {pctDisponivel.toFixed(1)}%
                           <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--color-neutral-500)' }}>Disponível</span>
                        </div>
                     </div>
                     
                     <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div>
                           <div style={{ fontSize: '12px', color: 'var(--color-neutral-500)' }}>Total Orçado</div>
                           <div style={{ fontSize: '16px', fontWeight: 700 }}>{formatCurrency(totalOrcado)}</div>
                        </div>
                        <div>
                           <div style={{ fontSize: '12px', color: 'var(--color-neutral-500)' }}>Valor Gasto</div>
                           <div style={{ fontSize: '16px', fontWeight: 700, color: '#ef4444' }}>{formatCurrency(totalGasto + totalReservado)}</div>
                        </div>
                        <div>
                           <div style={{ fontSize: '12px', color: 'var(--color-neutral-500)' }}>Disponível</div>
                           <div style={{ fontSize: '16px', fontWeight: 700, color: '#10b981' }}>{formatCurrency(saldoDisponivel)}</div>
                        </div>
                     </div>
                  </div>
                </div>

              </div>

              {/* ROW 3: AÇÕES E AVISOS */}
              <div className="grid-2">
                 
                 <div className="modern-card" style={{ background: 'transparent', border: 'none', padding: 0, boxShadow: 'none' }}>
                    <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                       <Activity size={18} color="#3b82f6" /> Ações Rápidas
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                       <Link className="action-btn-large" to="/estabelecimento/folgas" style={{ borderLeft: '4px solid #10b981', textDecoration: 'none' }}>
                          <Calendar size={20} color="#10b981" /> Registrar Plantões
                       </Link>
                       <Link className="action-btn-large" to="/estabelecimento/servidores" style={{ borderLeft: '4px solid #3b82f6', textDecoration: 'none' }}>
                          <UserPlus size={20} color="#3b82f6" /> Servidores
                       </Link>
                       <Link className="action-btn-large" to="/estabelecimento/solicitacoes" style={{ borderLeft: '4px solid #8b5cf6', textDecoration: 'none' }}>
                          <FilePlus size={20} color="#8b5cf6" /> Solicitar Compra
                       </Link>
                       <Link className="action-btn-large" to="/estabelecimento/simulador" style={{ borderLeft: '4px solid #f59e0b', textDecoration: 'none' }}>
                          <Calculator size={20} color="#f59e0b" /> Simular Compra
                       </Link>
                    </div>
                 </div>

                 <div className="modern-card" style={{ background: '#fffbeb', borderColor: '#fde68a' }}>
                    <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: '#b45309' }}>
                       <AlertCircle size={18} /> Avisos Importantes
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                       <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                          <Calendar color="#d97706" size={18} style={{ marginTop: '2px' }} />
                          <div>
                             <div style={{ fontSize: '13px', fontWeight: 600, color: '#92400e' }}>Prazo para solicitações: {formatDateString(activeCycle.data_fim)}</div>
                             <div style={{ fontSize: '12px', color: '#b45309' }}>
                               {activeCycle.status === 'ABERTO' || activeCycle.status === 'REABERTO' 
                                 ? `Restam ${diasRestantes} dias (${tempoRestante.horas}h ${tempoRestante.minutos}m).` 
                                 : 'Este ciclo já foi encerrado.'}
                             </div>
                          </div>
                       </div>
                       
                       {reqPendentes.length > 0 && (
                          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                             <CheckCircle color="#d97706" size={18} style={{ marginTop: '2px' }} />
                             <div>
                                <div style={{ fontSize: '13px', fontWeight: 600, color: '#92400e' }}>{reqPendentes.length} solicitações aguardam aprovação.</div>
                             </div>
                          </div>
                       )}
                       
                       <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                          <TrendingUp color="#d97706" size={18} style={{ marginTop: '2px' }} />
                          <div>
                             <div style={{ fontSize: '13px', fontWeight: 600, color: '#92400e' }}>Acompanhe o limite de cotas.</div>
                             <div style={{ fontSize: '12px', color: '#b45309' }}>Não ultrapasse o orçamento planejado para o ciclo.</div>
                          </div>
                       </div>
                    </div>
                 </div>

              </div>

              {/* ROW 4: TABELAS */}
              <div className="grid-2">
                 
                 <div className="modern-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                       <div style={{ fontSize: '15px', fontWeight: 700 }}>Direitos à Folga - Recentes</div>
                       <Link to="/estabelecimento/folgas" style={{ fontSize: '12px', fontWeight: 600 }}>Ver todos</Link>
                    </div>
                    <table className="table" style={{ fontSize: '13px' }}>
                       <thead>
                          <tr>
                             <th>Servidor</th>
                             <th>Cargo</th>
                             <th>Plantões</th>
                             <th>Status</th>
                          </tr>
                       </thead>
                       <tbody>
                          {compensatoryDays.slice(0, 4).map(day => (
                             <tr key={day.id}>
                                <td>
                                   <div style={{ fontWeight: 600 }}>{day.employees?.nome}</div>
                                   <div style={{ fontSize: '11px', color: 'var(--color-neutral-500)' }}>Matr. {day.employees?.matricula}</div>
                                </td>
                                <td>{day.employees?.positions?.nome || '-'}</td>
                                <td style={{ textAlign: 'center' }}>{day.quantidade_plantoes}</td>
                                <td>
                                   <span className={`badge ${
                                      day.status === 'GERADA' ? 'badge-blue' :
                                      day.status === 'USUFRUIDA' ? 'badge-gray' :
                                      day.status === 'INDENIZADA' ? 'badge-green' :
                                      'badge-yellow'
                                   }`}>
                                      {day.status.replace('_', ' ')}
                                   </span>
                                </td>
                             </tr>
                          ))}
                          {compensatoryDays.length === 0 && (
                             <tr><td colSpan={4} style={{ textAlign: 'center', padding: '24px', color: 'var(--color-neutral-500)' }}>Nenhum direito gerado.</td></tr>
                          )}
                       </tbody>
                    </table>
                 </div>

                 <div className="modern-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                       <div style={{ fontSize: '15px', fontWeight: 700 }}>Solicitações Pendentes</div>
                       <Link to="/estabelecimento/solicitacoes" style={{ fontSize: '12px', fontWeight: 600 }}>Ver todas</Link>
                    </div>
                    <table className="table" style={{ fontSize: '13px' }}>
                       <thead>
                          <tr>
                             <th>Servidor</th>
                             <th>Cargo</th>
                             <th>Valor</th>
                             <th>Status</th>
                          </tr>
                       </thead>
                       <tbody>
                          {reqPendentes.slice(0, 4).map(req => (
                             <tr key={req.id}>
                                <td>
                                   <div style={{ fontWeight: 600 }}>{req.employees?.nome}</div>
                                   <div style={{ fontSize: '11px', color: 'var(--color-neutral-500)' }}>Matr. {req.employees?.matricula}</div>
                                </td>
                                <td>{req.positions?.codigo}</td>
                                <td style={{ fontWeight: 600 }}>{formatCurrency(req.valor)}</td>
                                <td>
                                   <span className="badge badge-yellow">
                                      Pendente
                                   </span>
                                </td>
                             </tr>
                          ))}
                          {reqPendentes.length === 0 && (
                             <tr><td colSpan={4} style={{ textAlign: 'center', padding: '24px', color: 'var(--color-neutral-500)' }}>Nenhuma solicitação pendente.</td></tr>
                          )}
                       </tbody>
                    </table>
                 </div>

              </div>
            </div>
          )}

          {/* TAB 2: RANKING DA UNIDADE */}
          {activeTab === 'ranking' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
              
              {/* ALERTA DE PARETO DA UNIDADE */}
              {rankingData.paretoMsg && (() => {
                const level = rankingData.paretoLevel;
                const pct = rankingData.paretoPct;
                const stats = rankingData.paretoStats;
                const rec = rankingData.paretoRec;

                const statusConfig = {
                  verde: {
                    badgeBg: '#f0fdf4',
                    badgeBorder: '#bbf7d0',
                    badgeText: '#166534',
                    barColor: '#10b981',
                    label: 'Distribuição Regular'
                  },
                  amarelo: {
                    badgeBg: '#fffbeb',
                    badgeBorder: '#fde68a',
                    badgeText: '#92400e',
                    barColor: '#f59e0b',
                    label: 'Concentração Moderada'
                  },
                  vermelho: {
                    badgeBg: '#fff1f2',
                    badgeBorder: '#fecdd3',
                    badgeText: '#9f1239',
                    barColor: '#ef4444',
                    label: 'Alta Concentração'
                  }
                };
                const cfg = statusConfig[level as 'verde' | 'amarelo' | 'vermelho'];

                return (
                  <div 
                    className="modern-card" 
                    style={{ 
                      background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)', 
                      border: '1px solid #cbd5e1', 
                      borderTop: `4px solid ${cfg.barColor}`,
                      borderRadius: '12px', 
                      padding: '24px', 
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: '20px', 
                      boxShadow: '0 4px 16px -2px rgba(15, 23, 42, 0.07), 0 2px 6px -1px rgba(15, 23, 42, 0.04)' 
                    }}
                  >

                    {/* Header Corporativo */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px' }}>
                      <div>
                        <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: cfg.barColor, display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px' }}>
                          <Scale size={13} /> Diagnóstico Executivo da Unidade
                        </div>
                        <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#0f172a', letterSpacing: '-0.01em' }}>
                          Análise de Concentração Orçamentária (Princípio de Pareto)
                        </h3>
                        <div style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>
                          Monitoramento da distribuição de recursos indenizatórios sobre o efetivo lotado nesta unidade ({estName})
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ 
                          display: 'inline-flex', 
                          alignItems: 'center', 
                          gap: '6px', 
                          padding: '4px 12px', 
                          borderRadius: '20px', 
                          fontSize: '12px', 
                          fontWeight: 600, 
                          background: cfg.badgeBg, 
                          color: cfg.badgeText, 
                          border: `1px solid ${cfg.badgeBorder}` 
                        }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: cfg.barColor }} />
                          {cfg.label}
                        </span>
                        <span style={{ 
                          fontSize: '13px', 
                          fontWeight: 700, 
                          color: '#0f172a', 
                          background: '#ffffff', 
                          padding: '4px 10px', 
                          borderRadius: '6px', 
                          border: '1px solid #cbd5e1' 
                        }}>
                          Top 20%: {pct}%
                        </span>
                      </div>
                    </div>

                    {/* Grid Executivo: Efetivo vs Execução Orçamentária */}
                    {stats && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
                        {/* Bloco 1: Efetivo */}
                        <div style={{ background: '#ffffff', borderRadius: '8px', padding: '16px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                          <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Users size={15} color="#475569" /> Indicadores de Efetivo
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                            <div>
                              <div style={{ fontSize: '11px', color: '#64748b' }}>Efetivo Total</div>
                              <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>{stats.efetivo.toLocaleString('pt-BR')}</div>
                            </div>
                            <div>
                              <div style={{ fontSize: '11px', color: '#64748b' }}>Servidores Indenizados</div>
                              <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
                                {stats.compraram} <span style={{ fontSize: '12px', fontWeight: 500, color: '#64748b' }}>({Math.round((stats.compraram / stats.efetivo) * 100)}%)</span>
                              </div>
                            </div>
                            <div>
                              <div style={{ fontSize: '11px', color: '#64748b' }}>Sem Indenização</div>
                              <div style={{ fontSize: '18px', fontWeight: 700, color: '#64748b' }}>{stats.naoCompraram}</div>
                            </div>
                            <div>
                              <div style={{ fontSize: '11px', color: '#64748b' }}>Corte Top 20% (Amostra)</div>
                              <div style={{ fontSize: '18px', fontWeight: 700, color: cfg.badgeText }}>{stats.sliceReal} servidores</div>
                            </div>
                          </div>
                        </div>

                        {/* Bloco 2: Execução Financeira */}
                        <div style={{ background: '#ffffff', borderRadius: '8px', padding: '16px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                          <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Wallet size={15} color="#475569" /> Execução Financeira
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                            <div>
                              <div style={{ fontSize: '11px', color: '#64748b' }}>Orçamento da Unidade</div>
                              <div style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>{formatCurrency(stats.baseOrcamento)}</div>
                            </div>
                            <div>
                              <div style={{ fontSize: '11px', color: '#64748b' }}>Total Aprovado (Desembolso)</div>
                              <div style={{ fontSize: '16px', fontWeight: 700, color: cfg.barColor }}>
                                {formatCurrency(stats.gastoAprovado)} <span style={{ fontSize: '11px', fontWeight: 600 }}>({stats.pctGasto}%)</span>
                              </div>
                            </div>
                            <div>
                              <div style={{ fontSize: '11px', color: '#64748b' }}>Saldo Disponível</div>
                              <div style={{ fontSize: '16px', fontWeight: 700, color: stats.saldoRestante > 0 ? '#15803d' : '#b91c1c' }}>
                                {formatCurrency(stats.saldoRestante)} <span style={{ fontSize: '11px', fontWeight: 600 }}>({stats.pctSaldo}%)</span>
                              </div>
                            </div>
                            <div>
                              <div style={{ fontSize: '11px', color: '#64748b' }}>Desembolso Top 20%</div>
                              <div style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                                {formatCurrency(stats.top20Sum)} <span style={{ fontSize: '11px', fontWeight: 600, color: cfg.badgeText }}>({pct}% orç.)</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Barra de Distribuição de Pareto */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', fontSize: '12px' }}>
                        <span style={{ fontWeight: 600, color: '#334155' }}>Índice de Absorção Orçamentária pelo Top 20% do Efetivo</span>
                        <span style={{ fontWeight: 700, color: cfg.badgeText }}>{pct}% do orçamento consumido pelo grupo</span>
                      </div>
                      <div style={{ position: 'relative', width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px' }}>
                        <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: cfg.barColor, borderRadius: '4px', transition: 'width 0.4s ease' }} />
                        <div style={{ position: 'absolute', left: '50%', top: '-3px', width: '2px', height: '14px', background: '#f59e0b' }} title="Limite de Atenção (50%)" />
                        <div style={{ position: 'absolute', left: '65%', top: '-3px', width: '2px', height: '14px', background: '#ef4444' }} title="Limite Crítico (65%)" />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '11px', color: '#94a3b8', position: 'relative' }}>
                        <span>0%</span>
                        <span style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', color: '#d97706', fontWeight: 600 }}>50% Limiar de Atenção</span>
                        <span style={{ position: 'absolute', left: '65%', transform: 'translateX(-50%)', color: '#dc2626', fontWeight: 600 }}>65% Limiar Crítico</span>
                        <span>100%</span>
                      </div>
                    </div>

                    {/* Tabela Corporativa de Distribuição por Cargo */}
                    {rankingData.cargos && rankingData.cargos.length > 0 && (
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Layers size={16} color="#64748b" /> Distribuição Orçamentária por Cargo
                        </div>
                        <div className="table-responsive" style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                          <table className="table" style={{ margin: 0, width: '100%', fontSize: '13px' }}>
                            <thead>
                              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: '#475569' }}>Cargo</th>
                                <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600, color: '#475569' }}>Solicitações Aprovadas</th>
                                <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: '#475569' }}>Desembolso Aprovado</th>
                                <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: '#475569' }}>% do Orçamento</th>
                                <th style={{ padding: '10px 14px', textAlign: 'center', width: '180px', fontWeight: 600, color: '#475569' }}>Proporção</th>
                              </tr>
                            </thead>
                            <tbody>
                              {rankingData.cargos.map((cargo: any) => {
                                const pctOrc = stats?.baseOrcamento && stats.baseOrcamento > 0
                                  ? Number(((cargo.vTotal / stats.baseOrcamento) * 100).toFixed(1))
                                  : 0;
                                return (
                                  <tr key={cargo.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                    <td style={{ padding: '10px 14px', fontWeight: 600, color: '#1e293b' }}>{cargo.nome}</td>
                                    <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                                      {cargo.qTotal} <span style={{ fontSize: '11px', color: '#94a3b8' }}>({cargo.qFolga} folga / {cargo.qPlus} plus)</span>
                                    </td>
                                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: '#0f172a' }}>{formatCurrency(cargo.vTotal)}</td>
                                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: '#334155' }}>{pctOrc}%</td>
                                    <td style={{ padding: '10px 14px' }}>
                                      <div style={{ width: '100%', height: '6px', background: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' }}>
                                        <div style={{ width: `${Math.min(pctOrc, 100)}%`, height: '100%', background: '#3b82f6', borderRadius: '3px' }} />
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Nota Técnica de Auditoria */}
                    <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '12px 16px', border: '1px solid #e2e8f0', display: 'flex', gap: '10px', alignItems: 'flex-start', fontSize: '12px', color: '#475569' }}>
                      <Info size={16} color="#64748b" style={{ flexShrink: 0, marginTop: '2px' }} />
                      <div>
                        <strong>Nota Técnica:</strong> O corte amostral de 20% do efetivo ({stats?.sliceReal} servidores) absorveu {formatCurrency(stats?.top20Sum || 0)} ({pct}% do orçamento da unidade). Os servidores desse grupo estão identificados com a tag <code>Top 20%</code> na listagem nominal abaixo. {rec && <span style={{ marginLeft: '4px', color: '#92400e', fontWeight: 600 }}>{rec}</span>}
                      </div>
                    </div>

                    {/* Legenda de Classificação */}
                    <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', fontSize: '12px', color: '#64748b', borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
                        Até 50% — Distribuição Regular
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b' }} />
                        50% a 65% — Concentração Moderada
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444' }} />
                        Acima de 65% — Concentração Crítica
                      </span>
                    </div>

                  </div>
                );
              })()}

              {/* TABELA DE RANKING POR SERVIDORES DA UNIDADE */}
              <div className="modern-card" style={{ background: '#fff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                  <h3 style={{ margin: 0, color: 'var(--color-text-base)', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    🏆 Ranking por Servidores ({estName})
                  </h3>
                  <span style={{ fontSize: '13px', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                    {sortedRankingServidores.length} servidores com solicitações aprovadas
                  </span>
                </div>
                <div className="table-responsive">
                  <table className="table" style={{ width: '100%', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                        {renderSortHeader('pos', 'Pos', 'center')}
                        {renderSortHeader('nome', 'Nome do Servidor', 'left')}
                        {renderSortHeader('cargo', 'Cargo', 'left')}
                        {renderSortHeader('qFolga', 'Folgas', 'center')}
                        {renderSortHeader('qPlus', 'Plantões Plus', 'center')}
                        {renderSortHeader('qTotal', 'Total (Qtd)', 'center')}
                        {renderSortHeader('vTotal', 'Total (R$)', 'right')}
                      </tr>
                    </thead>
                    <tbody>
                      {sortedRankingServidores.map((s) => {
                        const pctOfUnit = totalOrcado > 0 ? ((s.vTotal / totalOrcado) * 100).toFixed(1) : '0';
                        return (
                          <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ textAlign: 'center', fontWeight: 600, color: '#64748b', width: '60px' }}>
                              {s.pos}º
                            </td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <div 
                                  style={{ fontWeight: 600, color: '#1e293b', cursor: 'help' }} 
                                  title={`Representa ${pctOfUnit}% do orçamento aprovado da unidade (${formatCurrency(totalOrcado)})`}
                                >
                                  {s.nome}
                                </div>
                                {s.pos <= (rankingData.paretoStats?.sliceReal || 0) && (
                                  <span style={{ display: 'inline-block', fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '10px', background: '#f3e8ff', color: '#7e22ce', border: '1px solid #d8b4fe' }}>Top 20%</span>
                                )}
                              </div>
                              {s.matricula && (
                                <div style={{ fontSize: '11px', color: '#94a3b8' }}>Matrícula: {s.matricula}</div>
                              )}
                            </td>
                            <td style={{ color: 'var(--color-text-muted)' }}>{s.cargo}</td>
                            <td style={{ textAlign: 'center' }}>{s.qFolga}</td>
                            <td style={{ textAlign: 'center' }}>{s.qPlus}</td>
                            <td style={{ textAlign: 'center', fontWeight: 600, color: '#3b82f6' }}>{s.qTotal}</td>
                            <td style={{ textAlign: 'right', minWidth: '130px' }}>
                              <div style={{ fontWeight: 600, color: '#0f172a' }}>{formatCurrency(s.vTotal)}</div>
                              {renderProportionBar(s.vTotal, totalOrcado)}
                            </td>
                          </tr>
                        );
                      })}
                      {sortedRankingServidores.length === 0 && (
                        <tr>
                          <td colSpan={7} style={{ textAlign: 'center', padding: '32px', color: 'var(--color-text-muted)' }}>
                            Nenhum servidor com solicitações aprovadas neste ciclo.
                          </td>
                        </tr>
                      )}
                    </tbody>
                    {sortedRankingServidores.length > 0 && (
                      <tfoot>
                        <tr style={{ background: '#f8fafc', borderTop: '2px solid #e2e8f0', fontWeight: 700 }}>
                          <td colSpan={3} style={{ padding: '12px 16px', color: '#0f172a' }}>
                            Total da Unidade ({sortedRankingServidores.length} servidores)
                          </td>
                          <td style={{ textAlign: 'center', color: '#0f172a' }}>
                            {sortedRankingServidores.reduce((acc, s) => acc + s.qFolga, 0)}
                          </td>
                          <td style={{ textAlign: 'center', color: '#0f172a' }}>
                            {sortedRankingServidores.reduce((acc, s) => acc + s.qPlus, 0)}
                          </td>
                          <td style={{ textAlign: 'center', color: '#3b82f6' }}>
                            {sortedRankingServidores.reduce((acc, s) => acc + s.qTotal, 0)}
                          </td>
                          <td style={{ textAlign: 'right', color: '#0f172a' }}>
                            <div style={{ fontWeight: 700 }}>
                              {formatCurrency(sortedRankingServidores.reduce((acc, s) => acc + s.vTotal, 0))}
                            </div>
                            {totalOrcado > 0 && (
                              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>
                                {((sortedRankingServidores.reduce((acc, s) => acc + s.vTotal, 0) / totalOrcado) * 100).toFixed(1)}% do orçamento
                              </div>
                            )}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>

              {/* GRÁFICOS RESUMO DA UNIDADE */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 'var(--space-6)' }}>
                {/* Gráfico Donut (Distribuição) */}
                <div className="modern-card" style={{ background: '#fff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                    <h3 style={{ margin: 0, color: 'var(--color-text-base)', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      🍩 Distribuição de Orçamento ({estName})
                    </h3>
                  </div>
                  <div style={{ height: '320px', marginTop: 'var(--space-4)' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Folga Compensatória', value: rankingData.totalGlobalFolga },
                            { name: 'Plantão Plus', value: rankingData.totalGlobalPlus }
                          ]}
                          cx="50%" cy="50%"
                          innerRadius={60}
                          outerRadius={110}
                          paddingAngle={5}
                          dataKey="value"
                          label={({ percent }) => `${((percent || 0) * 100).toFixed(0)}%`}
                          labelLine={false}
                        >
                          <Cell key="cell-0" fill="#3b82f6" />
                          <Cell key="cell-1" fill="#10b981" />
                        </Pie>
                        <RechartsTooltip formatter={(val: any) => formatCurrency(Number(val || 0))} />
                        <Legend verticalAlign="bottom" height={36} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Ranking por Cargo */}
                <div className="modern-card" style={{ background: '#fff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                    <h3 style={{ margin: 0, color: 'var(--color-text-base)', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      💼 Cargos que mais consumiram ({estName})
                    </h3>
                  </div>
                  <div style={{ height: '320px', marginTop: 'var(--space-4)' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={rankingData.cargos.slice(0, 10)} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" tickFormatter={(v) => formatCurrency(v).replace('R$', '').trim()} />
                        <YAxis dataKey="nome" type="category" width={160} tick={{ fontSize: 11, fill: '#475569' }} />
                        <RechartsTooltip formatter={(val: any) => formatCurrency(Number(val || 0))} />
                        <Legend verticalAlign="bottom" height={36} />
                        <Bar dataKey="vFolga" name="Folga Compensatória (R$)" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="vPlus" name="Plantão Plus (R$)" stackId="a" fill="#10b981" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

            </div>
          )}
        </>
      ) : (
        <div className="modern-card" style={{ textAlign: 'center', padding: '48px' }}>
          <AlertCircle size={32} color="var(--color-neutral-400)" style={{ margin: '0 auto 12px' }} />
          <p className="text-muted">Selecione um ciclo para visualizar os dados.</p>
        </div>
      )}

    </div>
  );
};

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  Wallet, FileText, Landmark, Building2, Calendar, Bell,
  Download, Eye,
  AlertTriangle, AlertCircle, Info, ArrowRight,
  ChevronUp, ChevronDown, ChevronsUpDown
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { useNavigate } from 'react-router-dom';

type DashboardTab = 'dashboard' | 'detalhamento';
type UnitStatusFilter = 'Todos' | 'Normal' | 'Atenção' | 'Crítico';
type LocationFilter = string;
type UnidadeSortColumn = 'nome' | 'loc' | 'orcamento' | 'consumoPct' | 'gasto' | 'saldo' | 'pendentes' | 'aprovadas' | 'rejeitadas' | 'valorAprov' | 'status';
type SortDirection = 'asc' | 'desc';

export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [activeCycle, setActiveCycle] = useState<any>(null);
  const [cycles, setCycles] = useState<any[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState<string>('');
  const [establishmentsCount, setEstablishmentsCount] = useState({ total: 0, capital: 0, interior: 0 });
  const [activeTab, setActiveTab] = useState<DashboardTab>('dashboard');
  const [globalSelectedUnits, setGlobalSelectedUnits] = useState<string[]>([]);
  const [globalLocations, setGlobalLocations] = useState<string[]>([]);
  const [globalSearchTerm, setGlobalSearchTerm] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isLocationDropdownOpen, setIsLocationDropdownOpen] = useState(false);
  const [searchUnit, setSearchUnit] = useState('');
  const [statusFilter, setStatusFilter] = useState<UnitStatusFilter>('Todos');
  const [locationFilter, setLocationFilter] = useState<LocationFilter>('Todos');
  const [sortColumn, setSortColumn] = useState<UnidadeSortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const tabRefs = useRef<Record<DashboardTab, HTMLButtonElement | null>>({ dashboard: null, detalhamento: null });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const locationDropdownRef = useRef<HTMLDivElement>(null);
  
  // Data lists
  const [requests, setRequests] = useState<any[]>([]);
  const [cycleEstablishments, setCycleEstablishments] = useState<any[]>([]);
  const [allEstablishments, setAllEstablishments] = useState<any[]>([]);
  const [positions, setPositions] = useState<any[]>([]);



  const fetchData = useCallback(async (targetCycleId?: string) => {
    setLoading(true);
    setErrorMessage(null);
    try {
        // 1. Carrega todos os ciclos
        const { data: cyclesList, error: cyclesError } = await supabase
          .from('cycles')
          .select('*')
          .order('ano', { ascending: false })
          .order('mes', { ascending: false });
        if (cyclesError) throw cyclesError;

        const list = cyclesList || [];
        setCycles(list);

        let ciclo = null;
        const cId = targetCycleId || selectedCycleId;

        if (list.length > 0) {
          if (cId) {
            ciclo = list.find(c => c.id === cId);
          }
          if (!ciclo) {
            // Tenta achar o ciclo Aberto ou Reaberto mais recente, senão o primeiro da lista
            ciclo = list.find(c => c.status === 'ABERTO' || c.status === 'REABERTO') || list[0];
          }
        }

        setActiveCycle(ciclo);
        setSelectedCycleId(ciclo ? ciclo.id : '');

        // 2. Estabelecimentos
        const { data: ests, error: establishmentsError } = await supabase
          .from('establishments')
          .select('id, nome, localizacao, ativo')
          .eq('ativo', true);
        if (establishmentsError) throw establishmentsError;

        if (ests) {
          setAllEstablishments(ests);
          const cap = ests.filter(e => e.localizacao?.toLowerCase() === 'capital').length;
          setEstablishmentsCount({
            total: ests.length,
            capital: cap,
            interior: ests.length - cap
          });
        }

        if (ciclo) {
          // 3. Solicitações de compra do ciclo. Paginado: o ciclo pode ter mais de
          // 1000 solicitações, e o Supabase corta silenciosamente sem o .range().
          let reqs: any[] = [];
          let reqsFrom = 0;
          const reqsStep = 1000;
          while (true) {
            const { data: reqsPage, error: requestsError } = await supabase
              .from('purchase_requests')
              .select(`
                id, valor, status, requested_at, establishment_id, position_id, tipo_solicitacao
              `)
              .eq('cycle_id', ciclo.id)
              .range(reqsFrom, reqsFrom + reqsStep - 1);
            if (requestsError) throw requestsError;
            if (!reqsPage || reqsPage.length === 0) break;
            reqs = reqs.concat(reqsPage);
            if (reqsPage.length < reqsStep) break;
            reqsFrom += reqsStep;
          }
          setRequests(reqs);

          // 4. Orçamentos por estabelecimento e Recálculo em tempo real
          const { data: pvs } = await supabase.from('position_values').select('valor, positions(codigo)').is('vigencia_fim', null);
          const pvMap: Record<string, number> = {};
          if (pvs) {
            pvs.forEach((p: any) => { if (p.positions?.codigo) pvMap[p.positions.codigo] = Number(p.valor); });
          }

          const { data: cEsts, error: cycleEstablishmentsError } = await supabase
            .from('cycle_establishments')
            .select('establishment_id, total_orcado, establishments(nome, localizacao), planning_limits(quantidade_planejada, positions(codigo))')
            .eq('cycle_id', ciclo.id);
          
          if (cycleEstablishmentsError) throw cycleEstablishmentsError;
          if (cEsts) {
            const recalced = cEsts.map((ce: any) => {
              if (ce.planning_limits && ce.planning_limits.length > 0) {
                let calc = 0;
                ce.planning_limits.forEach((pl: any) => {
                  const code = pl.positions?.codigo;
                  calc += (pl.quantidade_planejada || 0) * (pvMap[code] || 0);
                });
                if (calc > 0) ce.total_orcado = calc;
              }
              return ce;
            });
            setCycleEstablishments(recalced);
          }

          // 5. Cargos para o gráfico de pizza
          const { data: pos, error: positionsError } = await supabase.from('positions').select('id, nome, codigo');
          if (positionsError) throw positionsError;
          if (pos) setPositions(pos);
        } else {
          setRequests([]);
          setCycleEstablishments([]);
          setPositions([]);
        }
      } catch (err) {
        console.error("Erro ao buscar dados do dashboard:", err);
        setErrorMessage('Não foi possível carregar os dados do dashboard. Tente novamente.');
      } finally {
        setLoading(false);
      }
  }, [selectedCycleId]);

  useEffect(() => {
    void fetchData();
  }, []);

  const handleCycleChange = (newCycleId: string) => {
    setSelectedCycleId(newCycleId);
    void fetchData(newCycleId);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
      if (locationDropdownRef.current && !locationDropdownRef.current.contains(event.target as Node)) {
        setIsLocationDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // MÉTODOS E CÁLCULOS DERIVADOS
  const viewEstablishmentDetails = (unidade: any) => {
    navigate(`/admin/servidores?est_id=${unidade.id}`);
  };
  const today = new Date();
  
  const availableLocations = useMemo(() => {
    const locs = new Set(allEstablishments.map(e => e.localizacao).filter(Boolean));
    return Array.from(locs).sort();
  }, [allEstablishments]);

  const diasRestantes = useMemo(() => {
    if (!activeCycle) return 0;
    const end = new Date(activeCycle.data_fim);
    const diff = end.getTime() - today.getTime();
    const days = Math.ceil(diff / (1000 * 3600 * 24));
    return days < 0 ? 0 : days;
  }, [activeCycle]);

  const progressoCiclo = useMemo(() => {
    if (!activeCycle) return 0;
    const start = new Date(activeCycle.data_inicio).getTime();
    const end = new Date(activeCycle.data_fim).getTime();
    const now = today.getTime();
    if (now < start) return 0;
    if (now > end) return 100;
    return Math.round(((now - start) / (end - start)) * 100);
  }, [activeCycle]);

  const formatDateString = (dateStr: string) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
  };

  const getFormatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const filteredCycleEstablishments = useMemo(() => {
    let filtered = cycleEstablishments;
    
    if (globalLocations.length > 0) {
      filtered = filtered.filter(ce => globalLocations.includes(ce.establishments?.localizacao));
    }
    
    if (globalSelectedUnits.length > 0) {
      filtered = filtered.filter(ce => globalSelectedUnits.includes(ce.establishment_id));
    }
    return filtered;
  }, [cycleEstablishments, globalSelectedUnits, globalLocations]);

  const filteredRequests = useMemo(() => {
    let filtered = requests;
    
    if (globalLocations.length > 0) {
       const validIds = new Set(filteredCycleEstablishments.map(ce => ce.establishment_id));
       filtered = filtered.filter(r => validIds.has(r.establishment_id));
    }
    
    if (globalSelectedUnits.length > 0) {
      filtered = filtered.filter(r => globalSelectedUnits.includes(r.establishment_id));
    }
    return filtered;
  }, [requests, globalSelectedUnits, globalLocations, filteredCycleEstablishments]);

  // Totais
  const totalOrcado = useMemo(() => filteredCycleEstablishments.reduce((acc, curr) => acc + Number(curr.total_orcado || 0), 0), [filteredCycleEstablishments]);
  const valorReservado = useMemo(() => filteredRequests.filter(r => r.status === 'SOLICITADA').reduce((acc, r) => acc + Number(r.valor || 0), 0), [filteredRequests]);
  const valorAprovado = useMemo(() => filteredRequests.filter(r => r.status === 'APROVADA').reduce((acc, r) => acc + Number(r.valor || 0), 0), [filteredRequests]);
  const valoresPorTipo = useMemo(() => {
    const result = {
      plantaoPlus: { aprovado: 0, aAprovar: 0 },
      folgaComp: { aprovado: 0, aAprovar: 0 },
    };
    for (const r of filteredRequests) {
      const valor = Number(r.valor || 0);
      const bucket = r.tipo_solicitacao === 'PLANTAO_PLUS' ? result.plantaoPlus : result.folgaComp;
      if (r.status === 'APROVADA') bucket.aprovado += valor;
      else if (r.status === 'SOLICITADA') bucket.aAprovar += valor;
    }
    return result;
  }, [filteredRequests]);
  const folgasCompradasCount = useMemo(() => filteredRequests.filter(r => r.status === 'APROVADA').length, [filteredRequests]);
  const pendentesCount = useMemo(() => filteredRequests.filter(r => r.status === 'SOLICITADA').length, [filteredRequests]);

  const saldoDisponivel = totalOrcado - (valorReservado + valorAprovado);
  const percentualConsumido = totalOrcado > 0 ? ((valorReservado + valorAprovado) / totalOrcado) * 100 : 0;

  // Gráfico de Pizza (Consumo por Cargo)
  const pieData = useMemo(() => {
    const aprovedReqs = filteredRequests.filter(r => r.status === 'APROVADA');
    if (aprovedReqs.length === 0 || positions.length === 0) return [];

    const grouped = aprovedReqs.reduce((acc, req) => {
      acc[req.position_id] = (acc[req.position_id] || 0) + Number(req.valor);
      return acc;
    }, {} as Record<string, number>);

    const totalAprov = aprovedReqs.reduce((acc, r) => acc + Number(r.valor), 0);
    const colors = ['#16a34a', '#2563eb', '#d97706', '#9333ea', '#db2777'];

    return Object.keys(grouped).map((posId, idx) => {
      const posInfo = positions.find(p => p.id === posId);
      const val = grouped[posId];
      return {
        name: posInfo ? posInfo.nome : 'Outros',
        amount: val,
        amountFormatted: new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(val),
        value: totalAprov > 0 ? Math.round((val / totalAprov) * 100) : 0,
        color: colors[idx % colors.length]
      };
    }).sort((a, b) => b.amount - a.amount);
  }, [filteredRequests, positions]);

  // Tabela e Ranking de Unidades
  const unidades = useMemo(() => {
    return filteredCycleEstablishments.map(ce => {
      const uReqs = filteredRequests.filter(r => r.establishment_id === ce.establishment_id);
      
      const gasto = uReqs.filter(r => r.status === 'SOLICITADA' || r.status === 'APROVADA').reduce((acc, r) => acc + Number(r.valor), 0);
      const orc = Number(ce.total_orcado || 0);
      const saldo = orc - gasto;
      const consumoPct = orc > 0 ? Math.round((gasto / orc) * 100) : 0;

      const pendentes = uReqs.filter(r => r.status === 'SOLICITADA').length;
      const aprovadas = uReqs.filter(r => r.status === 'APROVADA').length;
      const rejeitadas = uReqs.filter(r => r.status === 'REJEITADA').length;
      const valorAprov = uReqs.filter(r => r.status === 'APROVADA').reduce((acc, r) => acc + Number(r.valor), 0);
      
      let status = 'Normal';
      let color = '#16a34a';
      if (consumoPct >= 80) { status = 'Crítico'; color = '#dc2626'; }
      else if (consumoPct >= 65) { status = 'Atenção'; color = '#ea580c'; }

      return {
        id: ce.establishment_id,
        nome: ce.establishments?.nome || 'Desconhecido',
        loc: ce.establishments?.localizacao || 'Interior',
        orcamento: orc,
        gasto,
        saldo,
        consumoPct,
        pendentes,
        aprovadas,
        rejeitadas,
        valorAprov,
        status,
        color
      };
    });
  }, [filteredCycleEstablishments, filteredRequests]);

  const filteredUnidades = useMemo(() => {
    const normalizedSearch = searchUnit.trim().toLocaleLowerCase('pt-BR');

    return unidades.filter((unidade) => {
      const matchesSearch = !normalizedSearch || unidade.nome.toLocaleLowerCase('pt-BR').includes(normalizedSearch);
      const matchesStatus = statusFilter === 'Todos' || unidade.status === statusFilter;
      const matchesLocation = locationFilter === 'Todos' || unidade.loc === locationFilter;
      return matchesSearch && matchesStatus && matchesLocation;
    });
  }, [locationFilter, searchUnit, statusFilter, unidades]);

  const sortedUnidades = useMemo(() => {
    if (!sortColumn) return filteredUnidades;
    const sorted = [...filteredUnidades].sort((a, b) => {
      const valA = a[sortColumn];
      const valB = b[sortColumn];
      if (typeof valA === 'string' && typeof valB === 'string') {
        return valA.localeCompare(valB, 'pt-BR');
      }
      return (valA as number) - (valB as number);
    });
    return sortDirection === 'asc' ? sorted : sorted.reverse();
  }, [filteredUnidades, sortColumn, sortDirection]);

  const handleSort = (column: UnidadeSortColumn) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const rankingUnidades = useMemo(() => {
    return [...unidades].sort((a, b) => b.consumoPct - a.consumoPct).slice(0, 5);
  }, [unidades]);

  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, tab: DashboardTab) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const nextTab = tab === 'dashboard' ? 'detalhamento' : 'dashboard';
    setActiveTab(nextTab);
    tabRefs.current[nextTab]?.focus();
  };

  const handleExport = () => {
    if (sortedUnidades.length === 0) {
      setActionMessage('Não há unidades para exportar com os filtros atuais.');
      return;
    }

    const headers = ['Unidade Penal', 'Localização', 'Orçamento', '% Consumido', 'Valor Consumido', 'Saldo Disponível', 'Pendentes', 'Aprovadas', 'Rejeitadas', 'Valor Aprovado', 'Status'];
    const escapeCsv = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
    const rows = sortedUnidades.map((unidade) => [
      unidade.nome,
      unidade.loc,
      getFormatCurrency(unidade.orcamento),
      `${unidade.consumoPct}%`,
      getFormatCurrency(unidade.gasto),
      getFormatCurrency(unidade.saldo),
      unidade.pendentes,
      unidade.aprovadas,
      unidade.rejeitadas,
      getFormatCurrency(unidade.valorAprov),
      unidade.status,
    ].map(escapeCsv).join(';'));

    const csv = ['\uFEFF' + headers.map(escapeCsv).join(';'), ...rows].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `unidades-penais-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setActionMessage(`${sortedUnidades.length} unidade(s) exportada(s) com sucesso.`);
  };

  // Alertas
  const alertas = useMemo(() => {
    const list = [];
    const criticUnits = unidades.filter(u => u.consumoPct >= 80).length;
    if (criticUnits > 0) {
      list.push({ type: 'danger', icon: <AlertTriangle size={18} color="#dc2626" />, text: <><span style={{fontWeight:600}}>{criticUnits} unidades</span> consumiram mais de 80% do orçamento.</> });
    }
    const inactiveUnits = unidades.filter(u => u.gasto === 0).length;
    if (inactiveUnits > 0) {
      list.push({ type: 'warning', icon: <AlertCircle size={18} color="#ea580c" />, text: <><span style={{fontWeight:600}}>{inactiveUnits} unidades</span> ainda não realizaram solicitações.</> });
    }
    const pendingRequests = filteredRequests.filter(r => r.status === 'SOLICITADA');
    if (pendingRequests.length > 0) {
       // simplificação para o alerta: qualquer pendente conta.
      list.push({ type: 'info', icon: <Info size={18} color="#2563eb" />, text: <><span style={{fontWeight:600}}>{pendingRequests.length} solicitações</span> aguardam análise.</> });
    }
    return list;
  }, [unidades, filteredRequests]);

  // Gráfico de Linha (Agrupamento por Data de solicitacao)
  const lineChartData = useMemo(() => {
    if (filteredRequests.length === 0) return [];
    
    // Simplificando o agrupamento por dia
    const map = new Map<string, { Reservado: number, Aprovado: number, Pago: number }>();
    
    const sorted = [...filteredRequests].sort((a, b) => new Date(a.requested_at).getTime() - new Date(b.requested_at).getTime());
    
    let accReservado = 0;
    let accAprovado = 0;
    
    for (const req of sorted) {
      const d = new Date(req.requested_at);
      const key = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth()+1).toString().padStart(2, '0')}`;
      if (!map.has(key)) map.set(key, { Reservado: accReservado, Aprovado: accAprovado, Pago: 0 }); // Pago zerado como especificado

      if (req.status === 'SOLICITADA') accReservado += Number(req.valor);
      if (req.status === 'APROVADA') accAprovado += Number(req.valor);
      
      const entry = map.get(key)!;
      entry.Reservado = accReservado;
      entry.Aprovado = accAprovado;
    }

    const data = Array.from(map.entries()).map(([date, vals]) => ({ date, ...vals }));
    // Se só tivermos 1 data, adiciona uma com 0 para o gráfico não ficar um ponto só, se quiser.
    return data;
  }, [filteredRequests]);


  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Crítico': return <span className="badge badge-red">{status}</span>;
      case 'Atenção': return <span className="badge badge-orange">{status}</span>;
      default: return <span className="badge badge-green">{status}</span>;
    }
  };

  const renderSortableHeader = (column: UnidadeSortColumn, label: string, align: 'left' | 'right' | 'center' = 'left') => {
    const isActive = sortColumn === column;
    const Icon = isActive ? (sortDirection === 'asc' ? ChevronUp : ChevronDown) : ChevronsUpDown;
    return (
      <th
        style={{ padding: '12px 16px', textAlign: align, cursor: 'pointer', userSelect: 'none' }}
        onClick={() => handleSort(column)}
        aria-sort={isActive ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', justifyContent: align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start' }}>
          {label}
          <Icon size={14} aria-hidden="true" style={{ opacity: isActive ? 1 : 0.35, flexShrink: 0 }} />
        </span>
      </th>
    );
  };

  if (loading) {
    return (
      <div className="dashboard-state" role="status" aria-live="polite">
        <div className="dashboard-spinner" aria-hidden="true"></div>
        <div>Carregando dados da Sede...</div>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="dashboard-state dashboard-state--error" role="alert">
        <AlertCircle size={28} aria-hidden="true" />
        <strong>Não foi possível carregar o dashboard</strong>
        <p>{errorMessage}</p>
        <button className="btn btn-secondary" type="button" onClick={() => fetchData()}>
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="modern-dashboard">
      
      {/* CABEÇALHO */}
      <div className="modern-header" style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '300px' }}>
          <h1 className="dashboard-title">Dashboard da Administração</h1>
          <p className="dashboard-description">Visão consolidada de todas as unidades penais do Estado.</p>
          
          <div style={{ display: 'flex', gap: '16px', marginTop: '16px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', textTransform: 'uppercase' }}>Visualizar Ciclo</label>
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
                  minWidth: '220px',
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
                {cycles.length === 0 && (
                  <option value="">Nenhum Ciclo Encontrado</option>
                )}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', position: 'relative' }} ref={dropdownRef}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', textTransform: 'uppercase' }}>Estabelecimento Penal</label>
              <input
                 type="text"
                 className="input"
                 style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--color-divider)', fontSize: '13px', background: '#fff', minWidth: '300px' }}
                 placeholder={globalSelectedUnits.length === 0 ? "Buscar Estabelecimento Penal..." : `${globalSelectedUnits.length} unidade(s) selecionada(s)`}
                 value={globalSearchTerm}
                 onClick={() => setIsDropdownOpen(true)}
                 onChange={e => {
                   setGlobalSearchTerm(e.target.value);
                   setIsDropdownOpen(true);
                 }}
              />
              

              {isDropdownOpen && (() => {
                 const visibleEsts = allEstablishments
                    .filter(est => globalLocations.length === 0 || globalLocations.includes(est.localizacao))
                    .filter(est => est.nome.toLowerCase().includes(globalSearchTerm.toLowerCase()));
                 const visibleIds = visibleEsts.map(e => e.id);
                 const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => globalSelectedUnits.includes(id));

                 return (
                   <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px', background: '#fff', border: '1px solid var(--color-divider)', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', maxHeight: '250px', overflowY: 'auto', zIndex: 50 }}>
                      <div 
                         style={{ padding: '8px 16px', fontSize: '13px', cursor: 'pointer', borderBottom: '1px solid var(--color-divider)', color: '#1e293b', background: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}
                         onClick={(e) => {
                            e.stopPropagation();
                            if (allVisibleSelected) {
                               setGlobalSelectedUnits(prev => prev.filter(id => !visibleIds.includes(id)));
                            } else {
                               setGlobalSelectedUnits(prev => {
                                  const next = [...prev];
                                  for (const id of visibleIds) {
                                     if (!next.includes(id)) next.push(id);
                                  }
                                  return next;
                               });
                            }
                         }}
                      >
                         <input type="checkbox" checked={allVisibleSelected} readOnly style={{ cursor: 'pointer' }} />
                         Selecionar Todas
                      </div>
                      
                      {visibleEsts.map(est => {
                         const isSelected = globalSelectedUnits.includes(est.id);
                         return (
                            <div 
                               key={est.id} 
                               style={{ padding: '8px 16px', fontSize: '13px', cursor: 'pointer', borderBottom: '1px solid var(--color-divider)', color: isSelected ? '#2563eb' : '#1e293b', background: isSelected ? '#eff6ff' : 'transparent', display: 'flex', alignItems: 'center', gap: '8px' }}
                               onClick={(e) => {
                                  e.stopPropagation();
                                  setGlobalSelectedUnits(prev => prev.includes(est.id) ? prev.filter(id => id !== est.id) : [...prev, est.id]);
                               }}
                               onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = '#f8fafc' }}
                               onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
                            >
                               <input type="checkbox" checked={isSelected} readOnly style={{ cursor: 'pointer' }} />
                               {est.nome}
                            </div>
                         )
                      })}
                      {visibleEsts.length === 0 && (
                         <div style={{ padding: '8px 16px', fontSize: '13px', color: '#64748b' }}>Nenhum estabelecimento encontrado.</div>
                      )}
                   </div>
                 );
              })()}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', position: 'relative' }} ref={locationDropdownRef}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', textTransform: 'uppercase' }}>Localização</label>
              
              <div
                 className="input"
                 style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--color-divider)', fontSize: '13px', background: '#fff', minWidth: '220px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                 onClick={() => setIsLocationDropdownOpen(true)}
              >
                 <span style={{ color: globalLocations.length === 0 ? '#94a3b8' : '#1e293b' }}>
                    {globalLocations.length === 0 ? "Todas as Regiões..." : `${globalLocations.length} região(ões) selecionada(s)`}
                 </span>
                 <span style={{ fontSize: '10px', color: '#94a3b8' }}>▼</span>
              </div>

              {isLocationDropdownOpen && (() => {
                 const allVisibleSelected = availableLocations.length > 0 && availableLocations.every(loc => globalLocations.includes(loc));

                 return (
                   <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px', background: '#fff', border: '1px solid var(--color-divider)', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', maxHeight: '250px', overflowY: 'auto', zIndex: 50 }}>
                      <div 
                         style={{ padding: '8px 16px', fontSize: '13px', cursor: 'pointer', borderBottom: '1px solid var(--color-divider)', color: '#1e293b', background: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}
                         onClick={(e) => {
                            e.stopPropagation();
                            if (allVisibleSelected) {
                               setGlobalLocations([]);
                            } else {
                               setGlobalLocations([...availableLocations]);
                            }
                         }}
                      >
                         <input type="checkbox" checked={allVisibleSelected} readOnly style={{ cursor: 'pointer' }} />
                         Selecionar Todas
                      </div>

                      {availableLocations.map(loc => {
                          const isSelected = globalLocations.includes(loc);
                          return (
                            <div 
                              key={loc} 
                              style={{ padding: '8px 16px', fontSize: '13px', cursor: 'pointer', borderBottom: '1px solid var(--color-divider)', color: isSelected ? '#2563eb' : '#1e293b', background: isSelected ? '#eff6ff' : 'transparent', display: 'flex', alignItems: 'center', gap: '8px' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setGlobalLocations(prev => prev.includes(loc) ? prev.filter(l => l !== loc) : [...prev, loc]);
                              }}
                              onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = '#f8fafc' }}
                              onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
                            >
                              <input type="checkbox" checked={isSelected} readOnly style={{ cursor: 'pointer' }} />
                              {loc}
                            </div>
                          )
                      })}
                   </div>
                 );
              })()}
            </div>
          </div>
        </div>

        <div className="dashboard-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          
          {activeCycle && (
            <div style={{ 
              padding: '6px 16px', 
              borderRadius: '8px', 
              background: activeCycle.status === 'ABERTO' || activeCycle.status === 'REABERTO' ? '#ecfdf5' : '#f1f5f9', 
              border: activeCycle.status === 'ABERTO' || activeCycle.status === 'REABERTO' ? '1px solid #10b981' : '1px solid #cbd5e1', 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              justifyContent: 'center',
              height: '38px'
            }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: activeCycle.status === 'ABERTO' || activeCycle.status === 'REABERTO' ? '#047857' : '#475569', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: activeCycle.status === 'ABERTO' || activeCycle.status === 'REABERTO' ? '#10b981' : '#64748b', display: 'inline-block' }}></span>
                Ciclo {activeCycle.status}
              </div>
              <div style={{ fontSize: '11px', color: activeCycle.status === 'ABERTO' || activeCycle.status === 'REABERTO' ? '#065f46' : '#334155', marginTop: '2px', fontWeight: 500 }}>
                {formatDateString(activeCycle.data_inicio)} a {formatDateString(activeCycle.data_fim)}
              </div>
            </div>
          )}

          <button
            type="button"
            className="dashboard-notification-button"
            onClick={() => setActionMessage(pendentesCount > 0 ? `${pendentesCount} solicitação(ões) aguardam análise.` : 'Não há novas solicitações pendentes.')}
            aria-label={`Notificações${pendentesCount > 0 ? `: ${pendentesCount} pendentes` : ''}`}
          >
            <Bell size={20} aria-hidden="true" />
            {pendentesCount > 0 && (
              <span className="dashboard-notification-badge" aria-hidden="true">{pendentesCount}</span>
            )}
          </button>
        </div>
      </div>

      {/* ABAS (TABS) SUPERIORES */}
      <div className="dashboard-tabs" role="tablist" aria-label="Seções do dashboard">
        <button
          ref={(element) => { tabRefs.current.dashboard = element; }}
          id="dashboard-tab"
          type="button"
          role="tab"
          aria-selected={activeTab === 'dashboard'}
          aria-controls="dashboard-panel"
          tabIndex={activeTab === 'dashboard' ? 0 : -1}
          className={`dashboard-tab${activeTab === 'dashboard' ? ' dashboard-tab--active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
          onKeyDown={(event) => handleTabKeyDown(event, 'dashboard')}
        >
          Visão Geral
        </button>
        <button
          ref={(element) => { tabRefs.current.detalhamento = element; }}
          id="detalhamento-tab"
          type="button"
          role="tab"
          aria-selected={activeTab === 'detalhamento'}
          aria-controls="detalhamento-panel"
          tabIndex={activeTab === 'detalhamento' ? 0 : -1}
          className={`dashboard-tab${activeTab === 'detalhamento' ? ' dashboard-tab--active' : ''}`}
          onClick={() => setActiveTab('detalhamento')}
          onKeyDown={(event) => handleTabKeyDown(event, 'detalhamento')}
        >
          Detalhamento
        </button>
      </div>
      {actionMessage && (
        <div className="dashboard-feedback" role="status" aria-live="polite">
          {actionMessage}
          <button type="button" className="dashboard-feedback__close" onClick={() => setActionMessage(null)} aria-label="Fechar mensagem">
            ×
          </button>
        </div>
      )}

      {activeTab === 'dashboard' && (
        <div id="dashboard-panel" role="tabpanel" aria-labelledby="dashboard-tab" tabIndex={0}>
          {/* LINHA 1: CARDS */}
          <div className="dashboard-metrics-grid" style={{ display: 'grid', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        
        {/* Card 1 */}
        <div className="modern-card" style={{ gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-neutral-600)', textTransform: 'uppercase' }}>Orçamento Global</div>
              <div style={{ fontSize: '26px', fontWeight: 700, color: '#111827', marginTop: '8px' }}>{getFormatCurrency(totalOrcado)}</div>
            </div>
            <div style={{ background: '#dcfce7', padding: '10px', borderRadius: '12px' }}>
               <Wallet size={24} color="#16a34a" />
            </div>
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600, color: '#111827', marginBottom: '6px' }}>
              <span>{percentualConsumido.toFixed(0)}% consumido</span>
            </div>
            <div
              className="dashboard-progress"
              role="progressbar"
              aria-label="Percentual do orçamento consumido"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.min(Math.max(percentualConsumido, 0), 100)}
              style={{ width: '100%', height: '6px', background: '#f3f4f6', borderRadius: '4px', overflow: 'hidden' }}
            >
              <div style={{ width: `${Math.min(percentualConsumido, 100)}%`, height: '100%', background: '#16a34a', borderRadius: '4px' }}></div>
            </div>
          </div>
          <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-muted)' }}>
            Saldo disponível: <span style={{ color: '#111827', fontWeight: 700 }}>{getFormatCurrency(saldoDisponivel)}</span>
          </div>
        </div>

        {/* Card 2 */}
        <div className="modern-card" style={{ gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-neutral-600)', textTransform: 'uppercase' }}>Folgas Compradas</div>
              <div style={{ fontSize: '26px', fontWeight: 700, color: '#111827', marginTop: '8px' }}>{folgasCompradasCount}</div>
            </div>
            <div style={{ background: '#ffedd5', padding: '10px', borderRadius: '12px' }}>
               <FileText size={24} color="#ea580c" />
            </div>
          </div>
          <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', flex: 1 }}>
            solicitações aprovadas no ciclo
          </div>
          <div style={{ background: '#fef3c7', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, color: '#92400e', display: 'inline-flex', alignItems: 'center', gap: '6px', alignSelf: 'flex-start' }}>
            <AlertCircle size={14} /> {pendentesCount} aguardando análise
          </div>
        </div>

        {/* Card 3 */}
        <div className="modern-card" style={{ gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-neutral-600)', textTransform: 'uppercase' }}>Valores Financeiros</div>
            </div>
            <div style={{ background: '#dbeafe', padding: '10px', borderRadius: '12px' }}>
               <Landmark size={24} color="#2563eb" />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, justifyContent: 'center' }}>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text)', marginBottom: '4px' }}>Plantão Plus</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Aprovado</span>
                <span style={{ fontWeight: 600, color: '#16a34a' }}>{getFormatCurrency(valoresPorTipo.plantaoPlus.aprovado)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>A Aprovar</span>
                <span style={{ fontWeight: 600, color: '#d97706' }}>{getFormatCurrency(valoresPorTipo.plantaoPlus.aAprovar)}</span>
              </div>
            </div>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text)', marginBottom: '4px' }}>Folga Compensatória</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Aprovado</span>
                <span style={{ fontWeight: 600, color: '#16a34a' }}>{getFormatCurrency(valoresPorTipo.folgaComp.aprovado)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>A Aprovar</span>
                <span style={{ fontWeight: 600, color: '#d97706' }}>{getFormatCurrency(valoresPorTipo.folgaComp.aAprovar)}</span>
              </div>
            </div>
            <div style={{ borderTop: '1px solid var(--color-divider)', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span style={{ fontWeight: 700 }}>Total</span>
              <span style={{ fontWeight: 700 }}>{getFormatCurrency(valorAprovado + valorReservado)}</span>
            </div>
          </div>
        </div>

        {/* Card 4 */}
        <div className="modern-card" style={{ gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-neutral-600)', textTransform: 'uppercase' }}>Unidades Penais</div>
              <div style={{ fontSize: '26px', fontWeight: 700, color: '#111827', marginTop: '8px' }}>{establishmentsCount.total}</div>
            </div>
            <div style={{ background: '#e0e7ff', padding: '10px', borderRadius: '12px' }}>
               <Building2 size={24} color="#4f46e5" />
            </div>
          </div>
          <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', flex: 1 }}>
            Total de unidades ativas
          </div>
          <div style={{ display: 'flex', gap: '16px', fontSize: '13px', fontWeight: 600, color: '#111827' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#4f46e5' }}></span>{establishmentsCount.capital} Capital</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }}></span>{establishmentsCount.interior} Interior</span>
          </div>
        </div>

        {/* Card 5 */}
        <div className="modern-card" style={{ gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-neutral-600)', textTransform: 'uppercase' }}>Dias Restantes</div>
              <div style={{ fontSize: '26px', fontWeight: 700, color: '#111827', marginTop: '8px' }}>{diasRestantes} dias</div>
            </div>
            <div style={{ background: '#ffedd5', padding: '10px', borderRadius: '12px' }}>
               <Calendar size={24} color="#ea580c" />
            </div>
          </div>
          <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
            Encerramento em <span style={{ fontWeight: 600, color: '#111827' }}>{activeCycle ? formatDateString(activeCycle.data_fim) : '-'}</span>
          </div>
          <div style={{ marginTop: 'auto' }}>
            <div
              className="dashboard-progress"
              role="progressbar"
              aria-label="Progresso do ciclo atual"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.min(Math.max(progressoCiclo, 0), 100)}
              style={{ width: '100%', height: '6px', background: '#f3f4f6', borderRadius: '4px', overflow: 'hidden', marginBottom: '6px' }}
            >
              <div style={{ width: `${Math.min(progressoCiclo, 100)}%`, height: '100%', background: '#ea580c', borderRadius: '4px' }}></div>
            </div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#111827' }}>{progressoCiclo}% do ciclo concluído</div>
          </div>
        </div>

      </div>

      {/* LINHA 2: GRÁFICOS E FLUXO */}
      <div className="dashboard-charts-grid" style={{ display: 'grid', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        
        {/* Painel 1: Gráfico de Linha */}
        <div className="modern-card">
          <div style={{ marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--color-neutral-600)' }}>Consumo Orçamentário Global</h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--color-text-muted)' }}>Evolução durante o ciclo atual</p>
          </div>
          <div style={{ height: '240px', width: '100%' }}>
            {lineChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={lineChartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} tickFormatter={(value) => `${value / 1000}k`} />
                  <RechartsTooltip formatter={(value) => value == null ? '-' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value))} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '13px', paddingTop: '10px' }} />
                  <Line type="monotone" dataKey="Reservado" stroke="#ea580c" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="Aprovado" stroke="#16a34a" strokeWidth={3} dot={false} />
                  <Line type="monotone" dataKey="Pago" stroke="#2563eb" strokeWidth={3} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)' }}>Sem dados de evolução</div>
            )}
          </div>
        </div>

        {/* Painel 2: Consumo por Cargo */}
        <div className="modern-card">
          <div style={{ marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--color-neutral-600)' }}>Consumo por Cargo</h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--color-text-muted)' }}>Distribuição do valor aprovado</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'center', paddingBottom: '20px' }}>
            {pieData.length > 0 ? (
              <>
                <div style={{ height: '140px', width: '100%', position: 'relative' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={70}
                        paddingAngle={2}
                        dataKey="value"
                        stroke="none"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip formatter={(value) => value == null ? '-' : `${value}%`} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px', padding: '0 10px' }}>
                  {pieData.map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: item.color }}></div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '13px', fontWeight: 600 }}>{item.name}</span>
                          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>R$ {item.amountFormatted}</span>
                        </div>
                      </div>
                      <span style={{ fontSize: '14px', fontWeight: 700 }}>{item.value}%</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>Nenhuma folga aprovada.</div>
            )}
          </div>
        </div>

        {/* Painel 3: Fluxo de Solicitações */}
        <div className="modern-card">
          <div style={{ marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--color-neutral-600)' }}>Fluxo das Solicitações</h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--color-text-muted)' }}>Resumo das etapas no ciclo</p>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%', padding: '10px 0 20px 0' }}>
            
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ background: '#e0e7ff', padding: '8px', borderRadius: '50%' }}><FileText size={18} color="#4f46e5" /></div>
                <span style={{ fontSize: '13px', fontWeight: 600 }}>Recebidas</span>
              </div>
              <span style={{ fontSize: '16px', fontWeight: 700 }}>{requests.length}</span>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'center', margin: '4px 0' }}><ArrowRight size={16} color="#cbd5e1" style={{ transform: 'rotate(90deg)' }} /></div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ background: '#ffedd5', padding: '8px', borderRadius: '50%' }}><Eye size={18} color="#ea580c" /></div>
                <span style={{ fontSize: '13px', fontWeight: 600 }}>Em Análise</span>
              </div>
              <span style={{ fontSize: '16px', fontWeight: 700 }}>{pendentesCount}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', margin: '4px 0' }}><ArrowRight size={16} color="#cbd5e1" style={{ transform: 'rotate(90deg)' }} /></div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#ecfdf5', padding: '12px 8px', borderRadius: '8px', border: '1px solid #a7f3d0' }}>
                 <div style={{ fontSize: '18px', fontWeight: 700, color: '#047857' }}>{folgasCompradasCount}</div>
                 <div style={{ fontSize: '11px', fontWeight: 600, color: '#065f46', marginTop: '4px' }}>Aprovadas</div>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#fef2f2', padding: '12px 8px', borderRadius: '8px', border: '1px solid #fecaca' }}>
                 <div style={{ fontSize: '18px', fontWeight: 700, color: '#b91c1c' }}>{requests.filter(r => r.status === 'REJEITADA').length}</div>
                 <div style={{ fontSize: '11px', fontWeight: 600, color: '#991b1b', marginTop: '4px' }}>Rejeitadas</div>
              </div>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'center', margin: '8px 0' }}><ArrowRight size={16} color="#cbd5e1" style={{ transform: 'rotate(90deg)' }} /></div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f0fdf4', padding: '12px', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ background: '#dcfce7', padding: '8px', borderRadius: '50%' }}><Landmark size={18} color="#16a34a" /></div>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#065f46', opacity: 0.5 }}>Enviadas p/ Folha</span>
              </div>
              <span style={{ fontSize: '16px', fontWeight: 700, color: '#047857', opacity: 0.5 }}>0</span>
            </div>

          </div>
        </div>

      </div>

      {/* LINHA 3: TABELAS MENORES E ALERTAS */}
      <div className="dashboard-support-grid" style={{ display: 'grid', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        
        {/* Painel 1: Ranking */}
        <div className="modern-card">
          <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--color-neutral-600)' }}>Ranking das Unidades</h3>
            <button type="button" className="dashboard-inline-action" onClick={() => setActiveTab('detalhamento')}>Ver completo &rarr;</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {rankingUnidades.length > 0 ? rankingUnidades.map((unidade, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '24px', fontSize: '13px', fontWeight: 700, color: 'var(--color-text-muted)', textAlign: 'center' }}>{idx + 1}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{unidade.nome}</span>
                    <span style={{ fontSize: '13px', fontWeight: 700 }}>{unidade.consumoPct}%</span>
                  </div>
                  <div style={{ width: '100%', height: '6px', background: '#f3f4f6', borderRadius: '3px' }}>
                    <div style={{ width: `${Math.min(unidade.consumoPct, 100)}%`, height: '100%', background: unidade.color, borderRadius: '3px' }}></div>
                  </div>
                </div>
              </div>
            )) : <div style={{ color: 'var(--color-text-muted)' }}>Sem dados</div>}
          </div>
        </div>

        {/* Painel 2: Resumo Financeiro */}
        <div className="modern-card">
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--color-neutral-600)' }}>Resumo Financeiro do Ciclo</h3>
          </div>
          <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td style={{ padding: '12px 0', borderBottom: '1px solid var(--color-divider)', color: 'var(--color-text)' }}>Orçamento Total</td>
                <td style={{ padding: '12px 0', borderBottom: '1px solid var(--color-divider)', textAlign: 'right', fontWeight: 700 }}>{getFormatCurrency(totalOrcado)}</td>
              </tr>
              <tr>
                <td style={{ padding: '12px 0', borderBottom: '1px solid var(--color-divider)', color: 'var(--color-text)' }}>Valor Reservado</td>
                <td style={{ padding: '12px 0', borderBottom: '1px solid var(--color-divider)', textAlign: 'right', fontWeight: 600, color: '#ea580c' }}>{getFormatCurrency(valorReservado)}</td>
              </tr>
              <tr>
                <td style={{ padding: '12px 0', borderBottom: '1px solid var(--color-divider)', color: 'var(--color-text)' }}>Valor Aprovado</td>
                <td style={{ padding: '12px 0', borderBottom: '1px solid var(--color-divider)', textAlign: 'right', fontWeight: 600, color: '#16a34a' }}>{getFormatCurrency(valorAprovado)}</td>
              </tr>
              <tr style={{ opacity: 0.5 }}>
                <td style={{ padding: '12px 0', borderBottom: '1px solid var(--color-divider)', color: 'var(--color-text)' }}>Valor Pago</td>
                <td style={{ padding: '12px 0', borderBottom: '1px solid var(--color-divider)', textAlign: 'right', fontWeight: 600, color: '#2563eb' }}>R$ 0,00</td>
              </tr>
              <tr>
                <td style={{ padding: '12px 0', color: 'var(--color-text)', fontWeight: 600 }}>Saldo Disponível</td>
                <td style={{ padding: '12px 0', textAlign: 'right', fontWeight: 700, color: '#16a34a' }}>{getFormatCurrency(saldoDisponivel)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Painel 3: Alertas */}
        <div className="modern-card">
          <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--color-neutral-600)' }}>Alertas Importantes</h3>
            <button type="button" className="dashboard-inline-action" onClick={() => setActionMessage(alertas.length > 0 ? `${alertas.length} alerta(s) em destaque no painel.` : 'Nenhum alerta ativo no momento.')}>Ver todos &rarr;</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {alertas.length > 0 ? alertas.map((alert, idx) => (
              <div key={idx} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <div style={{ marginTop: '2px' }}>{alert.icon}</div>
                <div style={{ fontSize: '13px', color: 'var(--color-text)' }}>
                  {alert.text}
                </div>
              </div>
            )) : <div style={{ color: 'var(--color-text-muted)' }}>Nenhum alerta.</div>}
          </div>
        </div>

      </div>
      </div>
      )}

      {/* LINHA 4: TABELA GERAL (AGORA NA ABA DETALHAMENTO) */}
      {activeTab === 'detalhamento' && (
      <div id="detalhamento-panel" role="tabpanel" aria-labelledby="detalhamento-tab" tabIndex={0} className="modern-card" style={{ padding: '0', overflow: 'hidden' }}>
        
        {/* Toolbar da Tabela */}
        <div className="dashboard-table-toolbar" style={{ padding: '20px', borderBottom: '1px solid var(--color-divider)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, textTransform: 'uppercase' }}>Estabelecimentos Penais - Visão Geral</h3>
            <p className="dashboard-table-count">{filteredUnidades.length} de {unidades.length} unidades</p>
          </div>
          <div className="dashboard-table-filters">
            <input
              type="search"
              placeholder="Pesquisar unidade..."
              aria-label="Pesquisar unidade"
              className="input dashboard-search-input"
              value={searchUnit}
              onChange={(event) => setSearchUnit(event.target.value)}
            />
            <select
              className="input dashboard-filter-select"
              aria-label="Filtrar por status"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as UnitStatusFilter)}
            >
              <option value="Todos">Status (Todos)</option>
              <option value="Normal">Normal</option>
              <option value="Atenção">Atenção</option>
              <option value="Crítico">Crítico</option>
            </select>
            <select
              className="input dashboard-filter-select"
              aria-label="Filtrar por localização"
              value={locationFilter}
              onChange={(event) => setLocationFilter(event.target.value)}
            >
              <option value="Todos">Local (Todos)</option>
              {availableLocations.map(loc => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>
            <button className="btn btn-secondary" type="button" onClick={handleExport} style={{ fontSize: '13px' }}>
              <Download size={16} aria-hidden="true" /> Exportar
            </button>
          </div>
        </div>

        {/* Corpo da Tabela */}
        <div className="table-responsive">
          <table className="modern-table" style={{ whiteSpace: 'nowrap', width: '100%', minWidth: '1200px' }}>
            <thead>
              <tr>
                {renderSortableHeader('nome', 'Estabelecimento Penal')}
                {renderSortableHeader('loc', 'Localização')}
                {renderSortableHeader('orcamento', 'Orçamento', 'right')}
                {renderSortableHeader('consumoPct', '% Consumido', 'center')}
                {renderSortableHeader('gasto', 'Valor Consumido', 'right')}
                {renderSortableHeader('saldo', 'Saldo Disponível', 'right')}
                {renderSortableHeader('pendentes', 'Pendentes', 'center')}
                {renderSortableHeader('aprovadas', 'Aprovadas', 'center')}
                {renderSortableHeader('rejeitadas', 'Rejeitadas', 'center')}
                {renderSortableHeader('valorAprov', 'Valor Aprov.', 'right')}
                {renderSortableHeader('status', 'Status')}
                <th style={{ textAlign: 'center', padding: '12px 16px' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {sortedUnidades.map(u => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 600, padding: '12px 16px' }}>{u.nome}</td>
                  <td style={{ padding: '12px 16px' }}>{u.loc}</td>
                  <td style={{ textAlign: 'right', padding: '12px 16px' }}>{getFormatCurrency(u.orcamento)}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '100px', justifyContent: 'center' }}>
                      <span style={{ fontSize: '12px', fontWeight: 600 }}>{u.consumoPct}%</span>
                      <div style={{ flex: 1, height: '6px', background: '#f3f4f6', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ 
                          width: `${Math.min(u.consumoPct, 100)}%`, 
                          height: '100%', 
                          background: u.color,
                          borderRadius: '3px'
                        }} />
                      </div>
                    </div>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 500, padding: '12px 16px' }}>{getFormatCurrency(u.gasto)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600, color: u.saldo < 0 ? '#dc2626' : (u.saldo < 5000 ? '#ea580c' : '#16a34a'), padding: '12px 16px' }}>{getFormatCurrency(u.saldo)}</td>
                  <td style={{ textAlign: 'center', padding: '12px 16px' }}>{u.pendentes}</td>
                  <td style={{ textAlign: 'center', padding: '12px 16px' }}>{u.aprovadas}</td>
                  <td style={{ textAlign: 'center', padding: '12px 16px' }}>{u.rejeitadas}</td>
                  <td style={{ textAlign: 'right', fontWeight: 500, padding: '12px 16px' }}>{getFormatCurrency(u.valorAprov)}</td>
                  <td style={{ padding: '12px 16px' }}>{getStatusBadge(u.status)}</td>
                  <td style={{ textAlign: 'center', padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                      <button className="btn-ghost" type="button" title="Visualizar Servidores" aria-label={`Visualizar servidores de ${u.nome}`} onClick={() => viewEstablishmentDetails(u)} style={{ padding: '4px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b' }}><Eye size={16} aria-hidden="true" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredUnidades.length === 0 && (
                <tr>
                  <td colSpan={12} style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>
                    {unidades.length === 0 ? 'Nenhuma unidade encontrada.' : 'Nenhuma unidade corresponde aos filtros atuais.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        </div>
      )}

    </div>
  );
};

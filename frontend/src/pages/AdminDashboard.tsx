import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase, fetchAll } from '../lib/supabase';
import { diasRestantesAte, tempoRestanteAte, diffDiasCalendario, hojeNoBrasil } from '../lib/date';
import {
  Wallet, FileText, Landmark, Building2, Calendar, Bell,
  Download, Eye,
  AlertTriangle, AlertCircle, Info, ArrowRight,
  ChevronUp, ChevronDown, ChevronsUpDown,
  Users, Scale, Layers, TrendingUp
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar
} from 'recharts';
import { useNavigate } from 'react-router-dom';

type DashboardTab = 'dashboard' | 'detalhamento' | 'ranking';
type UnitStatusFilter = 'Todos' | 'Normal' | 'Atenção' | 'Crítico' | 'Sem Solicitações';
type LocationFilter = string;
type UnidadeSortColumn = 'nome' | 'loc' | 'orcamento' | 'consumoPct' | 'gasto' | 'saldo' | 'pendentes' | 'aprovadas' | 'rejeitadas' | 'valorAprov' | 'status';
type RankSortColumn = 'nome' | 'cargo' | 'estabelecimento' | 'qFolga' | 'qPlus' | 'qTotal' | 'vTotal';
type SortDirection = 'asc' | 'desc';

// Cache em memória na sessão para carregamento instantâneo (SWR)
interface DashboardMemoryCache {
  cycles?: any[];
  establishments?: any[];
  establishmentsCount?: { total: number; breakdown: Record<string, number> };
  positions?: any[];
  pvMap?: Record<string, number>;
  totalEmployees?: number;
  employeeCountByEst?: Record<string, number>;
  activeCycle?: any;
  selectedCycleId?: string;
  cycleData?: Record<string, {
    requests: any[];
    cycleEstablishments: any[];
  }>;
}

const dashboardMemoryCache: DashboardMemoryCache = {};

export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState<boolean>(() => !dashboardMemoryCache.cycles?.length);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [activeCycle, setActiveCycle] = useState<any>(() => dashboardMemoryCache.activeCycle || null);
  const [cycles, setCycles] = useState<any[]>(() => dashboardMemoryCache.cycles || []);
  const [selectedCycleId, setSelectedCycleId] = useState<string>(() => dashboardMemoryCache.selectedCycleId || '');
  const [establishmentsCount, setEstablishmentsCount] = useState<{ total: number; breakdown: Record<string, number> }>(
    () => dashboardMemoryCache.establishmentsCount || { total: 0, breakdown: {} }
  );
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
  
  const [rankUniSortCol, setRankUniSortCol] = useState<RankSortColumn | null>(null);
  const [rankUniSortDir, setRankUniSortDir] = useState<SortDirection>('desc');
  
  const [rankServSortCol, setRankServSortCol] = useState<RankSortColumn | null>(null);
  const [rankServSortDir, setRankServSortDir] = useState<SortDirection>('desc');
  const tabRefs = useRef<Record<DashboardTab, HTMLButtonElement | null>>({ dashboard: null, detalhamento: null, ranking: null });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const locationDropdownRef = useRef<HTMLDivElement>(null);
  
  // Data lists inicializadas com cache se disponível
  const [requests, setRequests] = useState<any[]>(() => {
    const cId = dashboardMemoryCache.selectedCycleId;
    return (cId && dashboardMemoryCache.cycleData?.[cId]?.requests) || [];
  });
  const [cycleEstablishments, setCycleEstablishments] = useState<any[]>(() => {
    const cId = dashboardMemoryCache.selectedCycleId;
    return (cId && dashboardMemoryCache.cycleData?.[cId]?.cycleEstablishments) || [];
  });
  const [allEstablishments, setAllEstablishments] = useState<any[]>(() => dashboardMemoryCache.establishments || []);
  const [positions, setPositions] = useState<any[]>(() => dashboardMemoryCache.positions || []);
  const [totalEmployees, setTotalEmployees] = useState<number>(() => dashboardMemoryCache.totalEmployees || 0);
  const [employeeCountByEst, setEmployeeCountByEst] = useState<Record<string, number>>(() => dashboardMemoryCache.employeeCountByEst || {});

  const fetchData = useCallback(async (targetCycleId?: string, forceRefresh = false) => {
    const hasCache = !!dashboardMemoryCache.cycles?.length;
    if (!hasCache) {
      setLoading(true);
    }
    setErrorMessage(null);

    try {
      // 1. Execução paralela de dados estruturais e lista de ciclos
      const cyclesPromise = supabase
        .from('cycles')
        .select('*')
        .order('ano', { ascending: false })
        .order('mes', { ascending: false });

      const estsPromise = (!dashboardMemoryCache.establishments || forceRefresh)
        ? supabase.from('establishments').select('id, nome, localizacao, ativo').eq('ativo', true)
        : Promise.resolve({ data: dashboardMemoryCache.establishments, error: null });

      const posPromise = (!dashboardMemoryCache.positions || forceRefresh)
        ? supabase.from('positions').select('id, nome, codigo')
        : Promise.resolve({ data: dashboardMemoryCache.positions, error: null });

      const pvsPromise = (!dashboardMemoryCache.pvMap || forceRefresh)
        ? supabase.from('position_values').select('valor, positions(codigo)').is('vigencia_fim', null)
        : Promise.resolve({ data: null, error: null });

      const empCountPromise = (dashboardMemoryCache.totalEmployees === undefined || forceRefresh)
        ? supabase.from('employees').select('id', { count: 'exact', head: true })
        : Promise.resolve({ count: dashboardMemoryCache.totalEmployees, error: null });

      const empByEstPromise = (!dashboardMemoryCache.employeeCountByEst || forceRefresh)
        ? fetchAll(supabase.from('employees').select('establishment_id'))
        : Promise.resolve(null);

      // Dispara todas as consultas simultaneamente
      const [
        { data: cyclesList, error: cyclesError },
        { data: ests, error: establishmentsError },
        { data: pos, error: positionsError },
        { data: pvs },
        empCountRes,
        empCountsRaw
      ] = await Promise.all([
        cyclesPromise,
        estsPromise,
        posPromise,
        pvsPromise,
        empCountPromise,
        empByEstPromise
      ]);

      if (cyclesError) throw cyclesError;
      if (establishmentsError) throw establishmentsError;
      if (positionsError) throw positionsError;

      const list = cyclesList || [];
      dashboardMemoryCache.cycles = list;
      setCycles(list);

      if (ests) {
        dashboardMemoryCache.establishments = ests;
        setAllEstablishments(ests);
        const breakdown: Record<string, number> = {};
        ests.forEach((e: any) => {
          const loc = e.localizacao || 'Interior';
          breakdown[loc] = (breakdown[loc] || 0) + 1;
        });
        const estObj = { total: ests.length, breakdown };
        dashboardMemoryCache.establishmentsCount = estObj;
        setEstablishmentsCount(estObj);
      }

      if (pos) {
        dashboardMemoryCache.positions = pos;
        setPositions(pos);
      }

      let pvMap = dashboardMemoryCache.pvMap;
      if (pvs) {
        pvMap = {};
        pvs.forEach((p: any) => { if (p.positions?.codigo) pvMap![p.positions.codigo] = Number(p.valor); });
        dashboardMemoryCache.pvMap = pvMap;
      }

      if (empCountRes?.count !== undefined && empCountRes.count !== null) {
        dashboardMemoryCache.totalEmployees = empCountRes.count;
        setTotalEmployees(empCountRes.count);
      }

      if (empCountsRaw) {
        const countMap: Record<string, number> = {};
        empCountsRaw.forEach((e: any) => {
          if (e.establishment_id) countMap[e.establishment_id] = (countMap[e.establishment_id] || 0) + 1;
        });
        dashboardMemoryCache.employeeCountByEst = countMap;
        setEmployeeCountByEst(countMap);
      }

      // 2. Determina o ciclo ativo
      let ciclo = null;
      const cId = targetCycleId || selectedCycleId || dashboardMemoryCache.selectedCycleId;
      if (list.length > 0) {
        if (cId) {
          ciclo = list.find(c => c.id === cId);
        }
        if (!ciclo) {
          ciclo = list.find(c => c.status === 'ABERTO' || c.status === 'REABERTO') || list[0];
        }
      }

      dashboardMemoryCache.activeCycle = ciclo;
      dashboardMemoryCache.selectedCycleId = ciclo ? ciclo.id : '';
      setActiveCycle(ciclo);
      setSelectedCycleId(ciclo ? ciclo.id : '');

      if (ciclo) {
        // 3. Consultas operacionais do ciclo em paralelo
        const reqsQuery = supabase
          .from('purchase_requests')
          .select(`
            id, valor, status, requested_at, establishment_id, position_id, employee_id, tipo_solicitacao,
            employees(nome),
            positions(nome),
            establishments(nome, localizacao, complexidade)
          `)
          .eq('cycle_id', ciclo.id);

        const cycleEstsQuery = supabase
          .from('cycle_establishments')
          .select('establishment_id, total_orcado, establishments(nome, localizacao), planning_limits(quantidade_planejada, positions(codigo))')
          .eq('cycle_id', ciclo.id);

        const [reqs, { data: cEsts, error: cycleEstablishmentsError }] = await Promise.all([
          fetchAll(reqsQuery),
          cycleEstsQuery
        ]);

        if (cycleEstablishmentsError) throw cycleEstablishmentsError;

        setRequests(reqs);

        let recalced: any[] = [];
        if (cEsts) {
          const currentPvMap = pvMap || dashboardMemoryCache.pvMap || {};
          recalced = cEsts.map((ce: any) => {
            if (ce.planning_limits && ce.planning_limits.length > 0) {
              let calc = 0;
              ce.planning_limits.forEach((pl: any) => {
                const code = pl.positions?.codigo;
                calc += (pl.quantidade_planejada || 0) * (currentPvMap[code] || 0);
              });
              if (calc > 0) ce.total_orcado = calc;
            }
            return ce;
          });
          setCycleEstablishments(recalced);
        }

        if (!dashboardMemoryCache.cycleData) dashboardMemoryCache.cycleData = {};
        dashboardMemoryCache.cycleData[ciclo.id] = {
          requests: reqs,
          cycleEstablishments: recalced
        };
      } else {
        setRequests([]);
        setCycleEstablishments([]);
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
  const availableLocations = useMemo(() => {
    const locs = new Set(allEstablishments.map(e => e.localizacao).filter(Boolean));
    return Array.from(locs).sort();
  }, [allEstablishments]);

  // Calculado em dias de calendário no horário de Brasília (não em diferença bruta de
  // instantes) — ver frontend/src/lib/date.ts para o porquê: uma conta ingênua com
  // `new Date()`/`new Date(dataFim)` diverge ao longo do dia por causa do fuso horário.
  const diasRestantes = useMemo(() => {
    if (!activeCycle) return 0;
    return diasRestantesAte(activeCycle.data_fim);
  }, [activeCycle]);

  const tempoRestante = useMemo(() => {
    if (!activeCycle) return { horas: 0, minutos: 0 };
    return tempoRestanteAte(activeCycle.data_fim);
  }, [activeCycle]);

  const progressoCiclo = useMemo(() => {
    if (!activeCycle) return 0;
    const totalDias = diffDiasCalendario(activeCycle.data_inicio, activeCycle.data_fim);
    if (totalDias <= 0) return 100;
    const diasPassados = diffDiasCalendario(activeCycle.data_inicio, hojeNoBrasil());
    return Math.round(Math.min(100, Math.max(0, (diasPassados / totalDias) * 100)));
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
  const folgasCompradasStats = useMemo(() => {
    const aprovadas = filteredRequests.filter(r => r.status === 'APROVADA');
    const total = aprovadas.length;
    const folgaCount = aprovadas.filter(r => r.tipo_solicitacao === 'FOLGA_COMPENSATORIA').length;
    const plusCount = aprovadas.filter(r => r.tipo_solicitacao === 'PLANTAO_PLUS').length;
    return {
      total,
      folgaCount,
      plusCount,
      folgaPct: total > 0 ? ((folgaCount / total) * 100).toFixed(0) : '0',
      plusPct: total > 0 ? ((plusCount / total) * 100).toFixed(0) : '0'
    };
  }, [filteredRequests]);
  const pendentesCount = useMemo(() => filteredRequests.filter(r => r.status === 'SOLICITADA').length, [filteredRequests]);

  const saldoDisponivel = totalOrcado - (valorReservado + valorAprovado);
  const percentualConsumido = totalOrcado > 0 ? ((valorReservado + valorAprovado) / totalOrcado) * 100 : 0;

  // Gráfico de Pizza (Consumo por Cargo)
  const pieData = useMemo(() => {
    const aprovedReqs = filteredRequests.filter(r => r.status === 'APROVADA');
    if (aprovedReqs.length === 0 || positions.length === 0) return [];

    const grouped = aprovedReqs.reduce((acc, req) => {
      if (!acc[req.position_id]) {
        acc[req.position_id] = { valor: 0, count: 0, folga: 0, plus: 0 };
      }
      acc[req.position_id].valor += Number(req.valor);
      acc[req.position_id].count += 1;
      if (req.tipo_solicitacao === 'FOLGA_COMPENSATORIA') {
        acc[req.position_id].folga += 1;
      } else if (req.tipo_solicitacao === 'PLANTAO_PLUS') {
        acc[req.position_id].plus += 1;
      }
      return acc;
    }, {} as Record<string, { valor: number; count: number; folga: number; plus: number }>);

    const totalAprov = aprovedReqs.reduce((acc, r) => acc + Number(r.valor), 0);
    const colors = ['#16a34a', '#2563eb', '#d97706', '#9333ea', '#db2777'];

    return Object.keys(grouped).map((posId, idx) => {
      const posInfo = positions.find(p => p.id === posId);
      const data = grouped[posId];
      return {
        name: posInfo ? posInfo.nome : 'Outros',
        amount: data.valor,
        count: data.count,
        folgaCount: data.folga,
        plusCount: data.plus,
        amountFormatted: new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(data.valor),
        value: totalAprov > 0 ? Math.round((data.valor / totalAprov) * 100) : 0,
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
      if (gasto === 0) { status = 'Sem Solicitações'; color = '#94a3b8'; }
      else if (consumoPct >= 80) { status = 'Crítico'; color = '#dc2626'; }
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

  const rankingData = useMemo(() => {
    const aprovadas = filteredRequests.filter(r => r.status === 'APROVADA');

    const orcamentoMap: Record<string, number> = {};
    filteredCycleEstablishments.forEach(ce => {
      orcamentoMap[ce.establishment_id] = Number(ce.total_orcado || 0);
    });

    const rankUnidades: Record<string, { id: string, nome: string, complexidade: string, qFolga: number, qPlus: number, vFolga: number, vPlus: number, qTotal: number, vTotal: number }> = {};
    const rankServidores: Record<string, { id: string, nome: string, cargo: string, estabelecimento: string, orcamentoEst: number, qFolga: number, qPlus: number, vFolga: number, vPlus: number, qTotal: number, vTotal: number }> = {};
    const rankCargos: Record<string, { id: string, nome: string, qFolga: number, qPlus: number, vFolga: number, vPlus: number, qTotal: number, vTotal: number }> = {};

    let totalGlobalFolga = 0;
    let totalGlobalPlus = 0;

    aprovadas.forEach(req => {
       const empName = req.employees?.nome || 'Servidor Desconhecido';
       const empId = req.employee_id || empName;
       const posName = req.positions?.nome || 'Cargo Desconhecido';
       const posId = req.position_id || posName;
       const estName = req.establishments?.nome || 'Unidade Desconhecida';
       const estComp = req.establishments?.complexidade || 'Sem Complexidade';
       const estId = req.establishment_id || estName;

       const val = Number(req.valor) || 0;
       const isPlus = req.tipo_solicitacao === 'PLANTAO_PLUS';
       const isFolga = req.tipo_solicitacao === 'FOLGA_COMPENSATORIA';
       if (isPlus) totalGlobalPlus += val;
       if (isFolga) totalGlobalFolga += val;

       if (!rankUnidades[estId]) rankUnidades[estId] = { id: estId, nome: estName, complexidade: estComp, qFolga: 0, qPlus: 0, vFolga: 0, vPlus: 0, qTotal: 0, vTotal: 0 };
       if (!rankServidores[empId]) rankServidores[empId] = { id: empId, nome: empName, cargo: posName, estabelecimento: estName, orcamentoEst: orcamentoMap[estId] || 0, qFolga: 0, qPlus: 0, vFolga: 0, vPlus: 0, qTotal: 0, vTotal: 0 };
       if (!rankCargos[posId]) rankCargos[posId] = { id: posId, nome: posName, qFolga: 0, qPlus: 0, vFolga: 0, vPlus: 0, qTotal: 0, vTotal: 0 };

       const addStats = (obj: any) => {
         if (isPlus) { obj.qPlus++; obj.vPlus += val; }
         if (isFolga) { obj.qFolga++; obj.vFolga += val; }
         obj.qTotal++;
         obj.vTotal += val;
       };

       addStats(rankUnidades[estId]);
       addStats(rankServidores[empId]);
       addStats(rankCargos[posId]);
    });

    const sortRanking = (record: any) => {
      const arr = Object.values(record).sort((a: any, b: any) => b.qTotal - a.qTotal || b.vTotal - a.vTotal) as any[];
      return arr.map((item, index) => ({ ...item, pos: index + 1 }));
    };

    const sortedUnidades = sortRanking(rankUnidades);
    
    const unidadesByLoc = sortedUnidades.reduce((acc, curr) => {
      const comp = curr.complexidade;
      if (!acc[comp]) acc[comp] = [];
      curr.posGroup = acc[comp].length + 1;
      acc[comp].push(curr);
      return acc;
    }, {} as Record<string, any[]>);

    const totalGlobal = aprovadas.reduce((sum, r) => sum + (Number(r.valor) || 0), 0);
    const sortedServidores = sortRanking(rankServidores) as any[];

    // Determina o total de servidores relevante para o contexto atual do filtro
    const totalContextoServidores = (() => {
      if (globalSelectedUnits.length > 0) {
        return globalSelectedUnits.reduce((sum, estId) => sum + (employeeCountByEst[estId] || 0), 0);
      }
      if (globalLocations.length > 0) {
        return filteredCycleEstablishments.reduce((sum, ce) => sum + (employeeCountByEst[ce.establishment_id] || 0), 0);
      }
      return totalEmployees;
    })();
    const contextLabel = globalSelectedUnits.length > 0 || globalLocations.length > 0
      ? 'nos estabelecimentos filtrados'
      : 'na base da SEAP';

     const baseOrcamento = totalOrcado > 0 ? totalOrcado : totalGlobal;
     const gastoAprovado = totalGlobal;
     const saldoRestante = Math.max(0, baseOrcamento - gastoAprovado);
     const pctGasto = baseOrcamento > 0 ? Math.round((gastoAprovado / baseOrcamento) * 100) : 0;
     const pctSaldo = baseOrcamento > 0 ? Math.round((saldoRestante / baseOrcamento) * 100) : 0;

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
     } | null = null;

     if (totalContextoServidores > 0 && baseOrcamento > 0 && sortedServidores.length > 0) {
        const top20Count = Math.max(1, Math.ceil(totalContextoServidores * 0.2));
        const top20Slice = sortedServidores.slice(0, top20Count);
        const top20Sum = top20Slice.reduce((acc, s) => acc + s.vTotal, 0);
        const top20Qtd = top20Slice.reduce((acc, s) => acc + s.qTotal, 0);
        paretoPct = Math.round((top20Sum / baseOrcamento) * 100);

        const compraram = sortedServidores.length;
        const naoCompraram = Math.max(0, totalContextoServidores - compraram);
        const sliceReal = top20Slice.length;
        paretoStats = { 
          efetivo: totalContextoServidores, 
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
           paretoMsg = `Atenção: Os ${sliceReal} servidores no topo do ranking receberam juntos ${getFormatCurrency(top20Sum)} (${top20Qtd} solicitações), consumindo ${paretoPct}% de todo o orçamento planejado (${getFormatCurrency(baseOrcamento)}). A maior parte da verba foi concentrada neste pequeno grupo. (Veja os ${sliceReal} servidores destacados com a tag Top 20% na tabela abaixo ⬇️)`;
           paretoRec = 'Recomenda-se uma revisão da distribuição das escalas extras.';
        } else if (paretoPct > 50) {
           paretoLevel = 'amarelo';
           paretoMsg = `Os ${sliceReal} servidores no topo do ranking receberam juntos ${getFormatCurrency(top20Sum)} (${top20Qtd} solicitações), consumindo ${paretoPct}% de todo o orçamento planejado (${getFormatCurrency(baseOrcamento)}). A distribuição ainda é aceitável, mas começa a se concentrar. (Veja os ${sliceReal} servidores destacados com a tag Top 20% na tabela abaixo ⬇️)`;
           paretoRec = 'Vale monitorar se esse padrão se repete nos próximos ciclos e considerar uma distribuição mais equitativa das escalas.';
        } else {
           paretoLevel = 'verde';
           paretoMsg = `Os ${sliceReal} servidores no topo do ranking receberam juntos ${getFormatCurrency(top20Sum)} (${top20Qtd} solicitações), consumindo apenas ${paretoPct}% do orçamento planejado (${getFormatCurrency(baseOrcamento)}). A verba está bem distribuída e disponível para o efetivo. (Veja os ${sliceReal} servidores destacados com a tag Top 20% na tabela abaixo ⬇️)`;
           paretoRec = null;
        }
     }

     return {
       servidores: sortedServidores,
       cargos: sortRanking(rankCargos) as any[],
       totalGlobal,
       totalGlobalFolga,
       totalGlobalPlus,
       unidades: unidadesByLoc,
       paretoMsg,
       paretoRec,
       paretoLevel,
       paretoPct,
       paretoStats,
       paretoContextLabel: contextLabel
     };
  }, [filteredRequests, filteredCycleEstablishments, totalEmployees, employeeCountByEst, globalSelectedUnits, globalLocations, totalOrcado]);

  const sortedRankingUnidades = useMemo(() => {
    if (!rankUniSortCol) return rankingData.unidades;
    
    const sorted = { ...rankingData.unidades };
    Object.keys(sorted).forEach(comp => {
      sorted[comp] = [...sorted[comp]].sort((a, b) => {
        let valA = a[rankUniSortCol];
        let valB = b[rankUniSortCol];
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();
        if (valA < valB) return rankUniSortDir === 'asc' ? -1 : 1;
        if (valA > valB) return rankUniSortDir === 'asc' ? 1 : -1;
        return 0;
      });
    });
    return sorted;
  }, [rankingData.unidades, rankUniSortCol, rankUniSortDir]);

  const sortedRankingServidores = useMemo(() => {
    if (!rankServSortCol) return rankingData.servidores;
    return [...rankingData.servidores].sort((a, b) => {
      let valA = a[rankServSortCol];
      let valB = b[rankServSortCol];
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();
      if (valA < valB) return rankServSortDir === 'asc' ? -1 : 1;
      if (valA > valB) return rankServSortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [rankingData.servidores, rankServSortCol, rankServSortDir]);

  const renderRankHeader = (
    column: RankSortColumn, 
    label: string, 
    table: 'unidades' | 'servidores',
    align: 'left' | 'right' | 'center' = 'left'
  ) => {
    const isActive = table === 'unidades' ? rankUniSortCol === column : rankServSortCol === column;
    const direction = table === 'unidades' ? rankUniSortDir : rankServSortDir;

    const handleSort = () => {
      if (table === 'unidades') {
        if (rankUniSortCol === column) setRankUniSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
        else { setRankUniSortCol(column); setRankUniSortDir('asc'); }
      } else {
        if (rankServSortCol === column) setRankServSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
        else { setRankServSortCol(column); setRankServSortDir('asc'); }
      }
    };

    return (
      <th 
        onClick={handleSort}
        style={{ 
          cursor: 'pointer', 
          textAlign: align,
          userSelect: 'none',
          padding: '12px 16px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start', gap: '4px' }}>
          {label}
          <div style={{ display: 'flex', flexDirection: 'column', opacity: isActive ? 1 : 0.2 }}>
            <ChevronUp size={12} color={isActive && direction === 'asc' ? 'var(--color-primary)' : 'currentColor'} />
            <ChevronDown size={12} color={isActive && direction === 'desc' ? 'var(--color-primary)' : 'currentColor'} style={{ margin: '-4px 0 0 0' }} />
          </div>
        </div>
      </th>
    );
  };

  const renderProportionBar = (value: number, total: number) => {
    if (total === 0) return null;
    const pct = Math.round((value / total) * 100);
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
        <div style={{ width: '60px', height: '6px', background: 'var(--color-surface)', borderRadius: '3px', overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: 'var(--color-primary)', borderRadius: '3px' }} />
        </div>
        <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', minWidth: '28px', textAlign: 'right' }}>{pct}%</span>
      </div>
    );
  };



  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, tab: DashboardTab) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const order: DashboardTab[] = ['dashboard', 'detalhamento', 'ranking'];
    const idx = order.indexOf(tab);
    let nextIdx = event.key === 'ArrowRight' ? idx + 1 : idx - 1;
    if (nextIdx >= order.length) nextIdx = 0;
    if (nextIdx < 0) nextIdx = order.length - 1;
    const nextTab = order[nextIdx];
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
      list.push({ type: 'danger', icon: <AlertTriangle size={18} color="#dc2626" />, text: <><span style={{fontWeight:600}}>{criticUnits} unidades</span> consumiram mais de 80% do orçamento.</>, action: () => { setActiveTab('detalhamento'); setStatusFilter('Crítico'); document.getElementById('detalhamento-panel')?.scrollIntoView({ behavior: 'smooth' }); } });
    }
    const inactiveUnits = unidades.filter(u => u.gasto === 0).length;
    if (inactiveUnits > 0) {
      list.push({ type: 'warning', icon: <AlertCircle size={18} color="#ea580c" />, text: <><span style={{fontWeight:600}}>{inactiveUnits} unidades</span> ainda não realizaram solicitações.</>, action: () => { setActiveTab('detalhamento'); setStatusFilter('Sem Solicitações'); document.getElementById('detalhamento-panel')?.scrollIntoView({ behavior: 'smooth' }); } });
    }
    const pendingRequests = filteredRequests.filter(r => r.status === 'SOLICITADA');
    if (pendingRequests.length > 0) {
      list.push({ type: 'info', icon: <Info size={18} color="#2563eb" />, text: <><span style={{fontWeight:600}}>{pendingRequests.length} solicitações</span> aguardam análise.</>, action: () => navigate('/admin/solicitacoes') });
    }
    return list;
  }, [unidades, filteredRequests, navigate]);

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
        <button
          ref={(element) => { tabRefs.current.ranking = element; }}
          id="ranking-tab"
          type="button"
          role="tab"
          aria-selected={activeTab === 'ranking'}
          aria-controls="ranking-panel"
          tabIndex={activeTab === 'ranking' ? 0 : -1}
          className={`dashboard-tab${activeTab === 'ranking' ? ' dashboard-tab--active' : ''}`}
          onClick={() => setActiveTab('ranking')}
          onKeyDown={(event) => handleTabKeyDown(event, 'ranking')}
        >
          🏆 Ranking
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
            Saldo disponível: <span style={{ color: '#111827', fontWeight: 700 }}>{getFormatCurrency(saldoDisponivel)} ({Math.max(0, 100 - percentualConsumido).toFixed(0)}%)</span>
          </div>
        </div>

        {/* Card 2 */}
        <div className="modern-card" style={{ gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-neutral-600)', textTransform: 'uppercase' }}>Folgas Compradas</div>
              <div style={{ fontSize: '26px', fontWeight: 700, color: '#111827', marginTop: '8px' }}>{folgasCompradasStats.total}</div>
            </div>
            <div style={{ background: '#ffedd5', padding: '10px', borderRadius: '12px' }}>
               <FileText size={24} color="#ea580c" />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, marginTop: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span style={{ color: 'var(--color-text-muted)' }}>Folga Compensatória:</span>
              <span style={{ fontWeight: 600, color: '#3b82f6' }}>{folgasCompradasStats.folgaCount} ({folgasCompradasStats.folgaPct}%)</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span style={{ color: 'var(--color-text-muted)' }}>Plantão Plus:</span>
              <span style={{ fontWeight: 600, color: '#10b981' }}>{folgasCompradasStats.plusCount} ({folgasCompradasStats.plusPct}%)</span>
            </div>
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px 16px', fontSize: '13px', fontWeight: 600, color: '#111827' }}>
            {Object.entries(establishmentsCount.breakdown).sort(([a], [b]) => a.localeCompare(b)).map(([loc, count], idx) => {
              const colors = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
              return (
                <span key={loc} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: colors[idx % colors.length] }}></span>
                  {count} {loc}
                </span>
              );
            })}
          </div>
        </div>

        {/* Card 5 */}
        <div className="modern-card" style={{ gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-neutral-600)', textTransform: 'uppercase' }}>Dias Restantes</div>
              <div style={{ fontSize: '26px', fontWeight: 700, color: '#111827', marginTop: '8px', display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                {diasRestantes} dias
                <span style={{ fontSize: '16px', fontWeight: 500, color: 'var(--color-neutral-500)' }}>
                  ({tempoRestante.horas}h {tempoRestante.minutos}m)
                </span>
              </div>
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
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: item.color, flexShrink: 0 }}></div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '13px', fontWeight: 600 }}>{item.name}</span>
                          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                            R$ {item.amountFormatted} • <strong style={{ color: '#334155', fontWeight: 600 }}>{item.count} {item.count === 1 ? 'folga' : 'folgas'}</strong>
                          </span>
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
                 <div style={{ fontSize: '18px', fontWeight: 700, color: '#047857' }}>{folgasCompradasStats.total}</div>
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
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#065f46', opacity: activeCycle?.status === 'FECHADO' ? 1 : 0.5 }}>Enviadas p/ Folha</span>
              </div>
              <span style={{ fontSize: '16px', fontWeight: 700, color: '#047857', opacity: activeCycle?.status === 'FECHADO' ? 1 : 0.5 }}>
                {activeCycle?.status === 'FECHADO' ? folgasCompradasStats.total : 0}
              </span>
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
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {alertas.length > 0 ? alertas.map((alert, idx) => (
              <div 
                key={idx} 
                style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', cursor: alert.action ? 'pointer' : 'default', padding: '8px', borderRadius: '8px', transition: 'background-color 0.2s', marginLeft: '-8px', marginRight: '-8px' }}
                onClick={alert.action}
                onMouseEnter={(e) => alert.action && (e.currentTarget.style.backgroundColor = 'var(--color-neutral-100)')}
                onMouseLeave={(e) => alert.action && (e.currentTarget.style.backgroundColor = 'transparent')}
              >
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
              <option value="Sem Solicitações">Sem Solicitações</option>
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

      {activeTab === 'ranking' && (
        <div 
          id="ranking-panel"
          role="tabpanel"
          aria-labelledby="ranking-tab"
          className="dashboard-panel"
          style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}
        >
          {rankingData.paretoMsg && (() => {
            const level = rankingData.paretoLevel;
            const pct = rankingData.paretoPct;
            const stats = rankingData.paretoStats;
            const rec = rankingData.paretoRec;
            const ctxLabel = rankingData.paretoContextLabel;

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
                className="dashboard-card" 
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
                      <Scale size={13} /> Diagnóstico Executivo de Distribuição
                    </div>
                    <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#0f172a', letterSpacing: '-0.01em' }}>
                      Análise de Concentração Orçamentária (Princípio de Pareto)
                    </h3>
                    <div style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>
                      Monitoramento da distribuição de recursos indenizatórios sobre o efetivo {ctxLabel}
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
                          <div style={{ fontSize: '11px', color: '#64748b' }}>Orçamento Planejado</div>
                          <div style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>{getFormatCurrency(stats.baseOrcamento)}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>Total Aprovado (Desembolso)</div>
                          <div style={{ fontSize: '16px', fontWeight: 700, color: cfg.barColor }}>
                            {getFormatCurrency(stats.gastoAprovado)} <span style={{ fontSize: '11px', fontWeight: 600 }}>({stats.pctGasto}%)</span>
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>Saldo Disponível</div>
                          <div style={{ fontSize: '16px', fontWeight: 700, color: stats.saldoRestante > 0 ? '#15803d' : '#b91c1c' }}>
                            {getFormatCurrency(stats.saldoRestante)} <span style={{ fontSize: '11px', fontWeight: 600 }}>({stats.pctSaldo}%)</span>
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>Desembolso Top 20%</div>
                          <div style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                            {getFormatCurrency(stats.top20Sum)} <span style={{ fontSize: '11px', fontWeight: 600, color: cfg.badgeText }}>({pct}% orç.)</span>
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
                                <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: '#0f172a' }}>{getFormatCurrency(cargo.vTotal)}</td>
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
                    <strong>Nota Técnica:</strong> O corte amostral de 20% do efetivo ({stats?.sliceReal} servidores) absorveu {getFormatCurrency(stats?.top20Sum || 0)} ({pct}% do orçamento planejado). Os servidores desse grupo estão identificados com a tag <code>Top 20%</code> na listagem nominal abaixo. {rec && <span style={{ marginLeft: '4px', color: '#92400e', fontWeight: 600 }}>{rec}</span>}
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

          {/* Tabela de Ranking por Unidade (Agrupado por Complexidade) */}
          {Object.entries(sortedRankingUnidades).map(([comp, units]) => (
            <div key={comp} className="dashboard-card" style={{ background: '#fff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                <h3 style={{ margin: 0, color: 'var(--color-text-base)', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  🏢 Unidades - {comp}
                </h3>
              </div>
              <div className="table-responsive">
                <table className="table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '12px 16px' }}>Pos</th>
                      {renderRankHeader('nome', 'Unidade', 'unidades')}
                      {renderRankHeader('qFolga', 'Folgas', 'unidades', 'center')}
                      {renderRankHeader('qPlus', 'Plantões Plus', 'unidades', 'center')}
                      {renderRankHeader('qTotal', 'Total (Qtd)', 'unidades', 'center')}
                      {renderRankHeader('vTotal', 'Total (R$)', 'unidades', 'right')}
                    </tr>
                  </thead>
                  <tbody>
                    {units.map((u, i) => (
                      <tr key={u.id}>
                        <td style={{ padding: '12px 16px' }}>{u.posGroup}º</td>
                        <td style={{ fontWeight: 600 }}>{u.nome}</td>
                        <td style={{ textAlign: 'center' }}>{u.qFolga}</td>
                        <td style={{ textAlign: 'center' }}>{u.qPlus}</td>
                        <td style={{ textAlign: 'center', fontWeight: 600, color: '#3b82f6' }}>{u.qTotal}</td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 600, color: '#0f172a' }}>{getFormatCurrency(u.vTotal)}</div>
                          {renderProportionBar(u.vTotal, rankingData.totalGlobal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {units.length > 0 && (
                    <tfoot>
                      <tr style={{ background: '#f8fafc', borderTop: '2px solid #e2e8f0', fontWeight: 700 }}>
                        <td colSpan={2} style={{ padding: '12px 16px', color: '#0f172a' }}>
                          Total ({units.length} unidades)
                        </td>
                        <td style={{ textAlign: 'center', color: '#0f172a' }}>
                          {units.reduce((acc, u) => acc + u.qFolga, 0)}
                        </td>
                        <td style={{ textAlign: 'center', color: '#0f172a' }}>
                          {units.reduce((acc, u) => acc + u.qPlus, 0)}
                        </td>
                        <td style={{ textAlign: 'center', color: '#3b82f6' }}>
                          {units.reduce((acc, u) => acc + u.qTotal, 0)}
                        </td>
                        <td style={{ textAlign: 'right', color: '#0f172a' }}>
                          {getFormatCurrency(units.reduce((acc, u) => acc + u.vTotal, 0))}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          ))}

          {/* Ranking por Servidor */}
          <div className="dashboard-card" style={{ background: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <h3 style={{ margin: 0, color: 'var(--color-text-base)', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                🧑‍⚖️ Ranking por Servidores
              </h3>
            </div>
            <div className="table-responsive" style={{ maxHeight: '400px', overflowY: 'auto' }}>
              <table className="table" style={{ width: '100%' }}>
                <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 1 }}>
                  <tr>
                    <th style={{ padding: '12px 16px' }}>Pos</th>
                    {renderRankHeader('nome', 'Servidor', 'servidores')}
                    {renderRankHeader('cargo', 'Cargo', 'servidores')}
                    {renderRankHeader('estabelecimento', 'Estabelecimento', 'servidores')}
                    {renderRankHeader('qFolga', 'Folgas', 'servidores', 'center')}
                    {renderRankHeader('qPlus', 'Plantões Plus', 'servidores', 'center')}
                    {renderRankHeader('qTotal', 'Total (Qtd)', 'servidores', 'center')}
                    {renderRankHeader('vTotal', 'Total (R$)', 'servidores', 'right')}
                  </tr>
                </thead>
                <tbody>
                  {sortedRankingServidores.map((s, i) => (
                    <tr key={s.id}>
                      <td style={{ padding: '12px 16px' }}>{s.pos}º</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span 
                            style={{ fontWeight: 600, cursor: 'help' }} 
                            title={`Este servidor consumiu ${s.orcamentoEst > 0 ? Math.round((s.vTotal / s.orcamentoEst) * 100) : 0}% do orçamento de ${s.estabelecimento} (Orçamento Total: ${getFormatCurrency(s.orcamentoEst)})`}
                          >
                            {s.nome}
                          </span>
                          {s.pos <= (rankingData.paretoStats?.sliceReal || 0) && (
                            <span style={{ display: 'inline-block', fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '10px', background: '#f3e8ff', color: '#7e22ce', border: '1px solid #d8b4fe' }}>Top 20%</span>
                          )}
                        </div>
                      </td>
                      <td style={{ color: 'var(--color-text-muted)' }}>{s.cargo}</td>
                      <td style={{ color: 'var(--color-text-muted)' }}>{s.estabelecimento}</td>
                      <td style={{ textAlign: 'center' }}>{s.qFolga}</td>
                      <td style={{ textAlign: 'center' }}>{s.qPlus}</td>
                      <td style={{ textAlign: 'center', fontWeight: 600, color: '#3b82f6' }}>{s.qTotal}</td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 600, color: '#0f172a' }}>{getFormatCurrency(s.vTotal)}</div>
                        {renderProportionBar(s.vTotal, s.orcamentoEst)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {sortedRankingServidores.length > 0 && (
                  <tfoot style={{ position: 'sticky', bottom: 0, background: '#f8fafc', zIndex: 1 }}>
                    <tr style={{ borderTop: '2px solid #e2e8f0', fontWeight: 700 }}>
                      <td colSpan={4} style={{ padding: '12px 16px', color: '#0f172a' }}>
                        Total Geral ({sortedRankingServidores.length} servidores)
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
                        {getFormatCurrency(sortedRankingServidores.reduce((acc, s) => acc + s.vTotal, 0))}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 'var(--space-6)' }}>
            {/* Gráfico Donut (Distribuição) */}
            <div className="dashboard-card" style={{ background: '#fff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                <h3 style={{ margin: 0, color: 'var(--color-text-base)', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  🍩 Distribuição de Orçamento
                </h3>
              </div>
              <div style={{ height: '350px', marginTop: 'var(--space-4)' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Folga Compensatória', value: rankingData.totalGlobalFolga, fill: '#3b82f6' },
                        { name: 'Plantão Plus', value: rankingData.totalGlobalPlus, fill: '#10b981' }
                      ]}
                      cx="50%" cy="50%"
                      innerRadius={60}
                      outerRadius={110}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      <Cell key="cell-0" fill="#3b82f6" />
                      <Cell key="cell-1" fill="#10b981" />
                    </Pie>
                    <RechartsTooltip formatter={(val: number) => getFormatCurrency(val)} />
                    <Legend verticalAlign="bottom" height={36} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Ranking por Cargo */}
            <div className="dashboard-card" style={{ background: '#fff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                <h3 style={{ margin: 0, color: 'var(--color-text-base)', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  💼 Cargos que mais consumiram (Top 10)
                </h3>
              </div>
              <div style={{ height: '350px', marginTop: 'var(--space-4)' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={rankingData.cargos.slice(0, 10)} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tickFormatter={(v) => getFormatCurrency(v).replace('R$', '').trim()} />
                    <YAxis dataKey="nome" type="category" width={180} tick={{ fontSize: 11, fill: '#475569' }} />
                    <RechartsTooltip formatter={(val: number) => getFormatCurrency(val)} />
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

    </div>
  );
};

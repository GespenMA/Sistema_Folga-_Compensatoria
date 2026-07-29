import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Wallet, FileText, Landmark, Building2, Calendar, Bell, 
  Download, FileSpreadsheet, Eye, FilePieChart, 
  AlertTriangle, AlertCircle, Info, XCircle, ArrowRight
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';

export const AdminDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [activeCycle, setActiveCycle] = useState<any>(null);
  const [establishmentsCount, setEstablishmentsCount] = useState({ total: 0, capital: 0, interior: 0 });
  const [activeTab, setActiveTab] = useState<'dashboard' | 'detalhamento'>('dashboard');
  
  // Data lists
  const [requests, setRequests] = useState<any[]>([]);
  const [cycleEstablishments, setCycleEstablishments] = useState<any[]>([]);
  const [positions, setPositions] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // 1. Ciclo Ativo
        const { data: ciclos } = await supabase
          .from('cycles')
          .select('*')
          .eq('status', 'ABERTO')
          .order('data_inicio', { ascending: false })
          .limit(1);
        
        const ciclo = ciclos && ciclos.length > 0 ? ciclos[0] : null;
        setActiveCycle(ciclo);

        // 2. Estabelecimentos
        const { data: ests } = await supabase
          .from('establishments')
          .select('id, nome, localizacao, ativo')
          .eq('ativo', true);

        if (ests) {
          const cap = ests.filter(e => e.localizacao?.toLowerCase() === 'capital').length;
          setEstablishmentsCount({
            total: ests.length,
            capital: cap,
            interior: ests.length - cap
          });
        }

        if (ciclo) {
          // 3. Solicitações de compra do ciclo
          const { data: reqs } = await supabase
            .from('purchase_requests')
            .select(`
              id, valor, status, requested_at, establishment_id, position_id
            `)
            .eq('cycle_id', ciclo.id);
          if (reqs) setRequests(reqs);

          // 4. Orçamentos por estabelecimento
          const { data: cEsts } = await supabase
            .from('cycle_establishments')
            .select('establishment_id, total_orcado, establishments(nome, localizacao)')
            .eq('cycle_id', ciclo.id);
          if (cEsts) setCycleEstablishments(cEsts);

          // 5. Cargos para o gráfico de pizza
          const { data: pos } = await supabase.from('positions').select('id, nome, codigo');
          if (pos) setPositions(pos);
        }
      } catch (err) {
        console.error("Erro ao buscar dados do dashboard:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // MÉTODOS E CÁLCULOS DERIVADOS
  const today = new Date();
  
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

  // Totais
  const totalOrcado = useMemo(() => cycleEstablishments.reduce((acc, curr) => acc + Number(curr.total_orcado || 0), 0), [cycleEstablishments]);
  const valorReservado = useMemo(() => requests.filter(r => r.status === 'SOLICITADA').reduce((acc, r) => acc + Number(r.valor || 0), 0), [requests]);
  const valorAprovado = useMemo(() => requests.filter(r => r.status === 'APROVADA').reduce((acc, r) => acc + Number(r.valor || 0), 0), [requests]);
  const folgasCompradasCount = useMemo(() => requests.filter(r => r.status === 'APROVADA').length, [requests]);
  const pendentesCount = useMemo(() => requests.filter(r => r.status === 'SOLICITADA').length, [requests]);

  const saldoDisponivel = totalOrcado - (valorReservado + valorAprovado);
  const percentualConsumido = totalOrcado > 0 ? ((valorReservado + valorAprovado) / totalOrcado) * 100 : 0;

  // Gráfico de Pizza (Consumo por Cargo)
  const pieData = useMemo(() => {
    const aprovedReqs = requests.filter(r => r.status === 'APROVADA');
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
  }, [requests, positions]);

  // Tabela e Ranking de Unidades
  const unidades = useMemo(() => {
    return cycleEstablishments.map(ce => {
      const uReqs = requests.filter(r => r.establishment_id === ce.establishment_id);
      
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
  }, [cycleEstablishments, requests]);

  const rankingUnidades = useMemo(() => {
    return [...unidades].sort((a, b) => b.consumoPct - a.consumoPct).slice(0, 5);
  }, [unidades]);

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
    const pendingRequests = requests.filter(r => r.status === 'SOLICITADA');
    if (pendingRequests.length > 0) {
       // simplificação para o alerta: qualquer pendente conta.
      list.push({ type: 'info', icon: <Info size={18} color="#2563eb" />, text: <><span style={{fontWeight:600}}>{pendingRequests.length} solicitações</span> aguardam análise.</> });
    }
    return list;
  }, [unidades, requests]);

  // Gráfico de Linha (Agrupamento por Data de solicitacao)
  const lineChartData = useMemo(() => {
    if (requests.length === 0) return [];
    
    // Simplificando o agrupamento por dia
    const map = new Map<string, { Reservado: number, Aprovado: number, Pago: number }>();
    
    const sorted = [...requests].sort((a, b) => new Date(a.requested_at).getTime() - new Date(b.requested_at).getTime());
    
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
  }, [requests]);


  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Crítico': return <span className="badge badge-red">{status}</span>;
      case 'Atenção': return <span className="badge badge-orange">{status}</span>;
      default: return <span className="badge badge-green">{status}</span>;
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
        <div style={{ display: 'inline-block', width: '24px', height: '24px', border: '3px solid var(--color-divider)', borderTopColor: 'var(--color-primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        <div style={{ marginTop: 'var(--space-4)' }}>Carregando dados da Sede...</div>
      </div>
    );
  }

  return (
    <div className="modern-dashboard" style={{ fontFamily: 'Inter, sans-serif' }}>
      
      {/* CABEÇALHO */}
      <div className="modern-header" style={{ marginBottom: 'var(--space-6)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '28px', margin: '0 0 var(--space-2) 0', color: 'var(--color-text)', fontWeight: 700, fontFamily: 'Inter, sans-serif' }}>Dashboard da Administração</h1>
          <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '15px' }}>Visão consolidada de todas as unidades penais do Estado.</p>
        </div>

        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          
          <div style={{ padding: '10px 16px', border: '1px solid var(--color-divider)', borderRadius: '8px', background: '#fff', fontSize: '14px', fontWeight: 600, display: 'flex', gap: '8px', alignItems: 'center' }}>
            <Calendar size={18} color="var(--color-text-muted)" />
            {activeCycle ? activeCycle.nome : 'Nenhum Ciclo Aberto'}
          </div>

          {activeCycle && (
            <div style={{ padding: '8px 16px', borderRadius: '8px', background: '#ecfdf5', border: '1px solid #10b981', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#047857', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span>
                Ciclo Aberto
              </div>
              <div style={{ fontSize: '12px', color: '#065f46', marginTop: '2px' }}>{formatDateString(activeCycle.data_inicio)} até {formatDateString(activeCycle.data_fim)}</div>
            </div>
          )}

          <div style={{ position: 'relative', cursor: 'pointer', background: '#fff', border: '1px solid var(--color-divider)', padding: '12px', borderRadius: '8px' }}>
            <Bell size={20} color="var(--color-text)" />
            {pendentesCount > 0 && (
              <span style={{ position: 'absolute', top: '-6px', right: '-6px', background: '#ef4444', color: '#fff', fontSize: '11px', fontWeight: 'bold', padding: '2px 6px', borderRadius: '12px' }}>{pendentesCount}</span>
            )}
          </div>
        </div>
      </div>

      {/* ABAS (TABS) SUPERIORES */}
      <div style={{ display: 'flex', gap: '32px', borderBottom: '1px solid var(--color-divider)', marginBottom: 'var(--space-6)' }}>
        <div 
          onClick={() => setActiveTab('dashboard')} 
          style={{ paddingBottom: '12px', cursor: 'pointer', fontSize: '15px', fontWeight: activeTab === 'dashboard' ? 600 : 500, color: activeTab === 'dashboard' ? '#2563eb' : 'var(--color-text-muted)', borderBottom: activeTab === 'dashboard' ? '2px solid #2563eb' : '2px solid transparent', transition: 'all 0.2s' }}
        >
          Visão Geral
        </div>
        <div 
          onClick={() => setActiveTab('detalhamento')} 
          style={{ paddingBottom: '12px', cursor: 'pointer', fontSize: '15px', fontWeight: activeTab === 'detalhamento' ? 600 : 500, color: activeTab === 'detalhamento' ? '#2563eb' : 'var(--color-text-muted)', borderBottom: activeTab === 'detalhamento' ? '2px solid #2563eb' : '2px solid transparent', transition: 'all 0.2s' }}
        >
          Detalhamento
        </div>
      </div>

      {activeTab === 'dashboard' && (
        <>
          {/* LINHA 1: CARDS */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        
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
            <div style={{ width: '100%', height: '6px', background: '#f3f4f6', borderRadius: '4px', overflow: 'hidden' }}>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, justifyContent: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-text-muted)' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#d97706' }}></span>Reservado</span>
              <span style={{ fontWeight: 600 }}>{getFormatCurrency(valorReservado)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-text-muted)' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#16a34a' }}></span>Aprovado</span>
              <span style={{ fontWeight: 600 }}>{getFormatCurrency(valorAprovado)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', opacity: 0.5 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-text-muted)' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#2563eb' }}></span>Pago</span>
              <span style={{ fontWeight: 600 }}>R$ 0,00</span>
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
            <div style={{ width: '100%', height: '6px', background: '#f3f4f6', borderRadius: '4px', overflow: 'hidden', marginBottom: '6px' }}>
              <div style={{ width: `${Math.min(progressoCiclo, 100)}%`, height: '100%', background: '#ea580c', borderRadius: '4px' }}></div>
            </div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#111827' }}>{progressoCiclo}% do ciclo concluído</div>
          </div>
        </div>

      </div>

      {/* LINHA 2: GRÁFICOS E FLUXO */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        
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
                  <RechartsTooltip formatter={(value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)} />
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
                      <RechartsTooltip formatter={(value: number) => `${value}%`} />
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
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        
        {/* Painel 1: Ranking */}
        <div className="modern-card">
          <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--color-neutral-600)' }}>Ranking das Unidades</h3>
            <span style={{ fontSize: '12px', color: '#2563eb', fontWeight: 600, cursor: 'pointer' }}>Ver completo &rarr;</span>
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
            <span style={{ fontSize: '12px', color: '#2563eb', fontWeight: 600, cursor: 'pointer' }}>Ver todos &rarr;</span>
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
      </>
      )}

      {/* LINHA 4: TABELA GERAL (AGORA NA ABA DETALHAMENTO) */}
      {activeTab === 'detalhamento' && (
      <div className="modern-card" style={{ padding: '0', overflow: 'hidden' }}>
        
        {/* Toolbar da Tabela */}
        <div style={{ padding: '20px', borderBottom: '1px solid var(--color-divider)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, textTransform: 'uppercase' }}>Unidades Penais - Visão Geral</h3>
          </div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <input type="text" placeholder="Pesquisar unidade..." className="input" style={{ width: '220px', fontSize: '13px' }} />
            <select className="input" style={{ width: '140px', fontSize: '13px' }}>
              <option>Status (Todos)</option>
              <option>Normal</option>
              <option>Atenção</option>
              <option>Crítico</option>
            </select>
            <select className="input" style={{ width: '150px', fontSize: '13px' }}>
              <option>Local (Todos)</option>
              <option>Capital</option>
              <option>Interior</option>
            </select>
            <button className="btn btn-secondary" style={{ fontSize: '13px' }}>
              <Download size={16} /> Exportar
            </button>
          </div>
        </div>

        {/* Corpo da Tabela */}
        <div className="table-responsive">
          <table className="modern-table" style={{ whiteSpace: 'nowrap', width: '100%', minWidth: '1200px' }}>
            <thead>
              <tr>
                <th style={{ padding: '12px 16px' }}>Unidade Penal</th>
                <th style={{ padding: '12px 16px' }}>Localização</th>
                <th style={{ textAlign: 'right', padding: '12px 16px' }}>Orçamento</th>
                <th style={{ textAlign: 'center', padding: '12px 16px' }}>% Consumido</th>
                <th style={{ textAlign: 'right', padding: '12px 16px' }}>Valor Consumido</th>
                <th style={{ textAlign: 'right', padding: '12px 16px' }}>Saldo Disponível</th>
                <th style={{ textAlign: 'center', padding: '12px 16px' }}>Pendentes</th>
                <th style={{ textAlign: 'center', padding: '12px 16px' }}>Aprovadas</th>
                <th style={{ textAlign: 'center', padding: '12px 16px' }}>Rejeitadas</th>
                <th style={{ textAlign: 'right', padding: '12px 16px' }}>Valor Aprov.</th>
                <th style={{ padding: '12px 16px' }}>Status</th>
                <th style={{ textAlign: 'center', padding: '12px 16px' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {unidades.map(u => (
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
                      <button className="btn-ghost" title="Visualizar Detalhes" style={{ padding: '4px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b' }}><Eye size={16} /></button>
                      <button className="btn-ghost" title="Relatório" style={{ padding: '4px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b' }}><FileSpreadsheet size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {unidades.length === 0 && (
                <tr>
                  <td colSpan={12} style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>Nenhuma unidade encontrada.</td>
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

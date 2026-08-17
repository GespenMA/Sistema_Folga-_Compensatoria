import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { diasRestantesAte, diffDiasCalendario, hojeNoBrasil } from '../../lib/date';
import { useAuth } from '../../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { 
  Calendar, DollarSign, Users, FileText, CheckCircle, AlertCircle, Clock, ArrowRight,
  TrendingUp, Activity, BadgeAlert, Calculator, UserPlus, FilePlus
} from 'lucide-react';

export const EstabelecimentoDashboard: React.FC = () => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeCycle, setActiveCycle] = useState<any>(null);
  const [cycles, setCycles] = useState<any[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState<string>('');
  const [cycleEst, setCycleEst] = useState<any>(null);
  const [limits, setLimits] = useState<any[]>([]);
  const [purchaseRequests, setPurchaseRequests] = useState<any[]>([]);
  const [compensatoryDays, setCompensatoryDays] = useState<any[]>([]);
  const [estName, setEstName] = useState<string>('');

  useEffect(() => {
    if (profile?.establishment_id) {
      void fetchDashboardData();
    }
  }, [profile]);

  const fetchDashboardData = async (targetCycleId?: string) => {
    setLoading(true);
    try {
      // 1. Informações do Estabelecimento
      const { data: estInfo } = await supabase
        .from('establishments')
        .select('nome')
        .eq('id', profile!.establishment_id)
        .single();
        
      if (estInfo) setEstName(estInfo.nome);

      // 2. Todos os ciclos
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

      if (ciclo) {
        // 3. Orçamento da unidade para este ciclo
        const { data: estData, error: estError } = await supabase
          .from('cycle_establishments')
          .select('id, total_orcado')
          .eq('cycle_id', ciclo.id)
          .eq('establishment_id', profile!.establishment_id)
          .maybeSingle();

        if (estError) throw estError;

        const { data: pvs } = await supabase.from('position_values').select('valor, position_id').is('vigencia_fim', null);
        const pvMap: Record<string, number> = {};
        if (pvs) pvs.forEach((p: any) => pvMap[p.position_id] = Number(p.valor));

        if (estData) {
          setCycleEst(estData);

          // 4. Limites planejados
          const { data: limitsData } = await supabase
            .from('planning_limits')
            .select('quantidade_planejada, position_id, positions ( codigo, nome )')
            .eq('cycle_establishment_id', estData.id);
            
          if (limitsData) {
            setLimits(limitsData);
            let recalc = 0;
            limitsData.forEach((l: any) => {
               recalc += (l.quantidade_planejada || 0) * (pvMap[l.position_id] || 0);
            });
            if (recalc > 0) estData.total_orcado = recalc;
          }
          else setLimits([]);
          
          setCycleEst(estData);
        } else {
          setCycleEst(null);
          setLimits([]);
        }
        
        // 5. Solicitações de compra do ciclo para esta unidade
        const { data: requests } = await supabase
          .from('purchase_requests')
          .select('id, valor, status, requested_at, position_id, tipo_solicitacao, positions (codigo, nome), employees (nome, matricula)')
          .eq('cycle_id', ciclo.id)
          .eq('establishment_id', profile!.establishment_id)
          .order('requested_at', { ascending: false });
          
        if (requests) {
          const processedReqs = (requests as any[]).map(r => {
            if (r.position_id && pvMap[r.position_id]) r.valor = pvMap[r.position_id];
            return r;
          });
          setPurchaseRequests(processedReqs);
        }
        else setPurchaseRequests([]);

        // 6. Direitos à folga gerados para servidores desta unidade
        const { data: employees } = await supabase
           .from('employees')
           .select('id')
           .eq('establishment_id', profile!.establishment_id);
        
        if (employees && employees.length > 0) {
           const empIds = employees.map(e => e.id);
           const { data: days } = await supabase
             .from('compensatory_days')
             .select('id, status, quantidade_plantoes, periodo_inicio, generated_at, employees (nome, matricula, positions (codigo, nome))')
             .eq('cycle_id', ciclo.id)
             .in('employee_id', empIds)
             .order('generated_at', { ascending: false });
           if (days) setCompensatoryDays(days);
           else setCompensatoryDays([]);
        } else {
           setCompensatoryDays([]);
        }
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

  // Dias do Ciclo Selecionado — em dias de calendário no horário de Brasília, não em
  // diferença bruta de instantes (ver frontend/src/lib/date.ts: uma conta com `new Date()`/
  // `Math.ceil` sobre milissegundos diverge ao longo do dia por causa do fuso horário e do
  // arredondamento em dobro entre "dias passados" e "total de dias").
  let totalDias = 0;
  let diasRestantes = 0;
  let pctCiclo = 0;

  if (activeCycle) {
    totalDias = diffDiasCalendario(activeCycle.data_inicio, activeCycle.data_fim);
    diasRestantes = diasRestantesAte(activeCycle.data_fim);
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

  return (
    <div className="modern-dashboard">
      
      {/* HEADER */}
      <div className="modern-header" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ flex: 1, minWidth: '300px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 700, margin: '0 0 4px 0', color: 'var(--color-text)' }}>
            Dashboard do Estabelecimento Penal - {estName}
          </h1>
          <p style={{ color: 'var(--color-neutral-600)', margin: 0, fontSize: '14px', marginBottom: '16px' }}>
            Acompanhe os principais indicadores e recursos liberados para sua unidade.
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
                   {activeCycle.status === 'ABERTO' || activeCycle.status === 'REABERTO' ? `Restam ${diasRestantes} dias` : 'Ciclo Encerrado'}
                 </div>
                 <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                   {activeCycle.status === 'ABERTO' || activeCycle.status === 'REABERTO' ? 'para o encerramento' : `${formatDateString(activeCycle.data_inicio)} a ${formatDateString(activeCycle.data_fim)}`}
                 </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {activeCycle ? (
        <>
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
              <div className="modern-card-value">{diasRestantes} dias</div>
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
                             ? `Restam apenas ${diasRestantes} dias.` 
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

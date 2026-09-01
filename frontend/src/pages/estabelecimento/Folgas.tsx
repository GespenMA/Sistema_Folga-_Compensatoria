import React, { useEffect, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { roundCents } from '../../lib/money';

type Employee = {
  id: string;
  nome: string;
  matricula: string;
  saldo_plantoes: number;
  saldo_minutos?: number;
  position_id: string;
  positions?: { nome: string; codigo: string };
  compensatory_days?: { id: string; status: string }[];
  folgasDisponiveis?: number;
  schedule_type_id?: string | null;
  schedule_types?: { permite_carga_horaria: boolean } | null;
};

// Metadados visuais (rótulo, cor) de cada status de compensatory_days — usado na aba Folgas
// e para cruzar, na aba Plantões, se aquele lançamento já fechou alguma folga e o que
// aconteceu com ela (disponível / em aprovação / indenizada / usufruída).
const folgaStatusMeta = (status: string) => {
  switch (status) {
    case 'GERADA': return { label: '✅ Disponível para uso', bg: 'rgba(16,185,129,0.1)', color: '#10b981' };
    case 'INDENIZACAO_SOLICITADA': return { label: '⏳ Indenização em aprovação', bg: 'rgba(234,179,8,0.1)', color: '#eab308' };
    case 'INDENIZADA': return { label: '💰 Indenizada', bg: 'rgba(59,130,246,0.1)', color: '#3b82f6' };
    case 'USUFRUIDA': return { label: '🏖️ Usufruída', bg: 'rgba(239,68,68,0.1)', color: '#ef4444' };
    default: return { label: status, bg: 'rgba(239,68,68,0.1)', color: '#ef4444' };
  }
};

// Uma pessoa escalada num dia do ciclo — Plantão Plus (turno extra) ou Folga Comprada
// (indenização de folga já ganha), com solicitação Aprovada ou Aguardando Aprovação.
type EscaladoNoDia = {
  nome: string;
  matricula: string;
  cargo: string;
  tipo: 'PLANTAO_PLUS' | 'FOLGA_COMPENSATORIA';
  status: string;
};

// Grade de dias alinhada por semana (domingo a sábado) cobrindo o período do ciclo, com dias
// de fora do ciclo nas pontas pra completar as semanas — como um calendário normal.
const getCalendarGridDays = (dataInicio: string, dataFim: string): Date[] => {
  const start = new Date(dataInicio + 'T12:00:00');
  const end = new Date(dataFim + 'T12:00:00');
  const gridStart = new Date(start);
  gridStart.setDate(gridStart.getDate() - gridStart.getDay());
  const gridEnd = new Date(end);
  gridEnd.setDate(gridEnd.getDate() + (6 - gridEnd.getDay()));
  const days: Date[] = [];
  const cur = new Date(gridStart);
  while (cur <= gridEnd) {
    days.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
};

const toDateKey = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const Folgas: React.FC = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [activeCycle, setActiveCycle] = useState<any>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal Detalhes Servidor
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [detailShifts, setDetailShifts] = useState<any[]>([]);
  const [detailFolgas, setDetailFolgas] = useState<any[]>([]);
  const [detailPlusRequests, setDetailPlusRequests] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [detailTab, setDetailTab] = useState<'folgas' | 'plantoes' | 'plus'>('folgas');

  // Modal Plantão Plus
  const [isPlusModalOpen, setIsPlusModalOpen] = useState(false);
  const [plusEmployeeId, setPlusEmployeeId] = useState('');
  const [plusSearchTerm, setPlusSearchTerm] = useState('');
  const [plusDataPlantao, setPlusDataPlantao] = useState('');
  const [plusJustificativa, setPlusJustificativa] = useState('');
  const [isSubmittingPlus, setIsSubmittingPlus] = useState(false);
  const [plusValorPreview, setPlusValorPreview] = useState<number | null>(null);

  // Orçamento da unidade (para bloquear o lançamento quando não houver orçamento
  // suficiente já considerando o que está Aprovado + Aguardando Aprovação — mesmo
  // cálculo que o banco usa para liberar a CRIAÇÃO de uma solicitação)
  const [totalOrcado, setTotalOrcado] = useState(0);
  const [totalAprovado, setTotalAprovado] = useState(0);
  const [totalPendente, setTotalPendente] = useState(0);
  const orcamentoDisponivel = roundCents(totalOrcado - totalAprovado - totalPendente);

  // Filtros e busca
  const [busca, setBusca] = useState('');
  const [ordemSaldos, setOrdemSaldos] = useState('nome_asc');
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'com_folga' | 'acumulando'>('todos');
  const [filtroCargoId, setFiltroCargoId] = useState('');

  // Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 24;

  useEffect(() => {
    setCurrentPage(1);
  }, [busca, filtroCargoId, filtroStatus, ordemSaldos]);

  // Toast de notificação
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'warning' } | null>(null);
  const toastTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Plantões Plus pendentes por employee (para badge nos cards)
  const [plusPendentes, setPlusPendentes] = useState<Record<string, number>>({});

  // Calendário de Escalas: quem já está Aprovado ou Aguardando Aprovação em cada dia do
  // ciclo (Plantão Plus ou Folga Comprada), pra evitar escalar alguém a mais no mesmo dia.
  // É uma visão alternativa à lista de servidores, não um painel que abre por cima —
  // por isso um modo de visualização (troca o conteúdo), não um accordion que empurra tudo.
  const [viewMode, setViewMode] = useState<'lista' | 'calendario'>('lista');
  const [escalaPorDia, setEscalaPorDia] = useState<Map<string, EscaladoNoDia[]>>(new Map());
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<string | null>(null);



  const showToast = useCallback((msg: string, type: 'success' | 'error' | 'warning' = 'success') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ msg, type });
    toastTimerRef.current = setTimeout(() => setToast(null), 4000);
  }, []);

  // Fechar modais com ESC
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsDetailsModalOpen(false);
        setIsPlusModalOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (profile?.establishment_id) {
      fetchInitialData();
    }
  }, [profile?.establishment_id]);

  // Prévia do valor do lançamento assim que o servidor é escolhido no modal de Plantão Plus
  useEffect(() => {
    if (!plusEmployeeId) { setPlusValorPreview(null); return; }
    const emp = employees.find(e => e.id === plusEmployeeId);
    if (!emp || !emp.position_id) { setPlusValorPreview(null); return; }

    let cancelado = false;
    supabase
      .from('position_values')
      .select('valor')
      .eq('position_id', emp.position_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelado) setPlusValorPreview(data ? Number(data.valor) : null);
      });

    return () => { cancelado = true; };
  }, [plusEmployeeId, employees]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const { data: cycleData } = await supabase
        .from('cycles')
        .select('*')
        .in('status', ['ABERTO', 'REABERTO'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cycleData) {
        setActiveCycle(cycleData);
        await Promise.all([fetchEmployees(), fetchOrcamento(cycleData.id)]);
      } else {
        setLoading(false);
      }
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  // Retorna o disponível recém-calculado (não só atualiza o estado) para que quem chama
  // possa validar contra o valor mais fresco possível, sem depender do último render —
  // fecha a janela entre "checar" e "gravar" o máximo que dá do lado do cliente. O
  // trigger do banco continua sendo a autoridade final, isso é reforço, não substituição.
  const fetchOrcamento = async (cycleId: string): Promise<number> => {
    try {
      const [{ data: ceData }, { data: comprometidos }] = await Promise.all([
        supabase
          .from('cycle_establishments')
          .select('total_orcado')
          .eq('cycle_id', cycleId)
          .eq('establishment_id', profile!.establishment_id)
          .maybeSingle(),
        supabase
          .from('purchase_requests')
          .select('valor, status, data_plantao, tipo_solicitacao, employees(nome, matricula, positions(nome, codigo))')
          .eq('cycle_id', cycleId)
          .eq('establishment_id', profile!.establishment_id)
          .in('status', ['SOLICITADA', 'APROVADA']),
      ]);

      const orcado = Number(ceData?.total_orcado || 0);
      const aprovado = (comprometidos || []).filter((r: any) => r.status === 'APROVADA').reduce((acc, r: any) => acc + Number(r.valor), 0);
      const pendente = (comprometidos || []).filter((r: any) => r.status === 'SOLICITADA').reduce((acc, r: any) => acc + Number(r.valor), 0);

      setTotalOrcado(orcado);
      setTotalAprovado(aprovado);
      setTotalPendente(pendente);

      // Mesma consulta alimenta o Calendário de Escalas: agrupa por data_plantao quem já
      // está Aprovado ou Aguardando Aprovação naquele dia.
      const porDia = new Map<string, EscaladoNoDia[]>();
      (comprometidos || []).forEach((r: any) => {
        if (!r.data_plantao) return;
        const lista = porDia.get(r.data_plantao) || [];
        lista.push({
          nome: r.employees?.nome || '—',
          matricula: r.employees?.matricula || '—',
          cargo: r.employees?.positions?.nome || '—',
          tipo: r.tipo_solicitacao,
          status: r.status,
        });
        porDia.set(r.data_plantao, lista);
      });
      setEscalaPorDia(porDia);

      return roundCents(orcado - aprovado - pendente);
    } catch (err) {
      console.error(err);
      return orcamentoDisponivel;
    }
  };

  const fetchEmployees = async () => {
    try {
      const [{ data: empData }, { data: plusData }] = await Promise.all([
        supabase
          .from('employees')
          .select('id, nome, matricula, saldo_plantoes, saldo_minutos, position_id, positions(nome, codigo), compensatory_days(id, status), schedule_types(permite_carga_horaria)')
          .eq('establishment_id', profile!.establishment_id)
          .eq('ativo', true)
          .order('nome'),
        supabase
          .from('purchase_requests')
          .select('employee_id')
          .eq('establishment_id', profile!.establishment_id)
          .eq('tipo_solicitacao', 'PLANTAO_PLUS')
          .eq('status', 'SOLICITADA'),
      ]);

      if (empData) {
        const parsed = (empData as any[]).map(emp => ({
          ...emp,
          folgasDisponiveis: emp.compensatory_days?.filter((f: any) => f.status === 'GERADA').length || 0
        }));
        setEmployees(parsed as Employee[]);
      }

      if (plusData) {
        const counts: Record<string, number> = {};
        (plusData as any[]).forEach(p => {
          counts[p.employee_id] = (counts[p.employee_id] || 0) + 1;
        });
        setPlusPendentes(counts);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  const openDetailsModal = async (emp: Employee) => {
    setSelectedEmployee(emp);
    setDetailTab('plantoes');
    setDetailShifts([]);
    setDetailFolgas([]);
    setDetailPlusRequests([]);
    setIsDetailsModalOpen(true);
    setLoadingHistory(true);
    try {
      // Busca plantões do servidor (todas as entradas de saldo)
      const { data: shiftsData } = await supabase
        .from('shifts')
        .select('id, cycle_id, periodo_inicio, periodo_fim, quantidade_plantoes, observacao, created_at, minutos_residuais, cycles(nome)')
        .eq('employee_id', emp.id)
        .order('created_at', { ascending: false });
      if (shiftsData) setDetailShifts(shiftsData);

      // Busca folgas geradas
      const { data: folgasData } = await supabase
        .from('compensatory_days')
        .select('id, status, cycle_id, periodo_inicio, periodo_fim, quantidade_plantoes, generated_at, used_at, cycles(nome), purchase_requests(data_plantao)')
        .eq('employee_id', emp.id)
        .order('generated_at', { ascending: false });
      if (folgasData) setDetailFolgas(folgasData);

      // Busca Plantão Plus
      const { data: plusData } = await supabase
        .from('purchase_requests')
        .select('id, tipo_solicitacao, data_plantao, valor, status, justificativa, requested_at')
        .eq('employee_id', emp.id)
        .eq('tipo_solicitacao', 'PLANTAO_PLUS')
        .order('requested_at', { ascending: false });
      if (plusData) setDetailPlusRequests(plusData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const openPlusModal = (empId?: string) => {
    setPlusEmployeeId(empId || '');
    setPlusSearchTerm('');
    setPlusDataPlantao('');
    setPlusJustificativa('');
    setIsPlusModalOpen(true);
  };

  const handleSavePlus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.establishment_id || !activeCycle) return;

    if (plusDataPlantao < activeCycle.data_inicio || plusDataPlantao > activeCycle.data_fim) {
      showToast(`A data do plantão precisa estar dentro do ciclo vigente (${new Date(activeCycle.data_inicio + 'T12:00:00').toLocaleDateString('pt-BR')} a ${new Date(activeCycle.data_fim + 'T12:00:00').toLocaleDateString('pt-BR')}).`, 'warning');
      return;
    }
    if (plusJustificativa.length < 50) {
      showToast('A justificativa precisa ter pelo menos 50 caracteres.', 'warning');
      return;
    }
    if (plusValorPreview !== null) {
      const orcamentoFresco = await fetchOrcamento(activeCycle.id);
      if (plusValorPreview > orcamentoFresco) {
        showToast(`Orçamento insuficiente — faltam R$ ${(plusValorPreview - orcamentoFresco).toFixed(2)}.`, 'error');
        return;
      }
    }

    setIsSubmittingPlus(true);

    try {
      const emp = employees.find(e => e.id === plusEmployeeId);
      if (!emp || !emp.position_id) throw new Error("Cargo do servidor não encontrado.");

      const { data: posVal } = await supabase
        .from('position_values')
        .select('id, valor')
        .eq('position_id', emp.position_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
        
      if (!posVal) throw new Error("Não há valor financeiro configurado para o cargo deste servidor.");

      // VERIFICAÇÃO DE DATA DUPLICADA: Impede compra na mesma data
      const { data: existingPlus } = await supabase
        .from('purchase_requests')
        .select('id')
        .eq('employee_id', emp.id)
        .eq('data_plantao', plusDataPlantao)
        .neq('status', 'REJEITADA')
        .neq('status', 'CANCELADA')
        .limit(1);

      if (existingPlus && existingPlus.length > 0) {
        showToast('Este servidor já possui uma solicitação de plantão para esta mesma data.', 'warning');
        setIsSubmittingPlus(false);
        return;
      }

      const { error } = await supabase.from('purchase_requests')
        .insert([{
          tipo_solicitacao: 'PLANTAO_PLUS',
          data_plantao: plusDataPlantao,
          establishment_id: profile.establishment_id,
          cycle_id: activeCycle.id,
          employee_id: emp.id,
          position_id: emp.position_id,
          valor: posVal.valor,
          valor_historico_id: posVal.id,
          justificativa: plusJustificativa,
          requested_by: profile.id
        }]);
      
      if (error) {
         if (error.message.includes('financeiro insuficiente')) {
             showToast('Orçamento insuficiente para lançar este Plantão Plus.', 'error');
         } else if (error.message.includes('Limite quantitativo')) {
             showToast('O limite planejado de plantões extras/folgas para este cargo já foi atingido.', 'error');
         } else {
             throw error;
         }
         return;
      }

      setIsPlusModalOpen(false);
      showToast('Plantão Plus registrado e enviado para aprovação!', 'success');
      await fetchEmployees(); // Refetch para atualizar badges e dados
    } catch (err: any) {
      showToast(err.message || 'Erro ao registrar Plantão Plus.', 'error');
    } finally {
      setIsSubmittingPlus(false);
    }
  };

  // Métricas KPI
  const totalServidores = employees.length;
  const folgasProntas = employees.filter(e => (e.folgasDisponiveis || 0) > 0).length;
  const proximos = employees.filter(e => {
    if (e.schedule_types?.permite_carga_horaria === false) return false;
    const min = (e.saldo_plantoes * 720) + (e.saldo_minutos || 0);
    return min >= (120 * 60) && (e.folgasDisponiveis || 0) === 0; // >= 120h
  }).length;

  const permiteCargaHorariaDetail = selectedEmployee?.schedule_types?.permite_carga_horaria !== false;
  const totalFolgas = employees.reduce((acc, e) => acc + (e.folgasDisponiveis || 0), 0);

  // Lista única de cargos para o filtro
  const cargosDisponiveis = Array.from(
    new Map(employees
      .filter(e => e.position_id && e.positions?.nome)
      .map(e => [e.position_id, { id: e.position_id, nome: e.positions!.nome! }])
    ).values()
  ).sort((a, b) => a.nome.localeCompare(b.nome));

  // Aplicar filtros
  let filtered = employees.filter(emp =>
    (emp.nome || '').toLowerCase().includes(busca.toLowerCase()) ||
    (emp.matricula || '').includes(busca)
  );
  if (filtroStatus === 'com_folga') filtered = filtered.filter(e => (e.folgasDisponiveis || 0) > 0);
  if (filtroStatus === 'acumulando') filtered = filtered.filter(e => (e.folgasDisponiveis || 0) === 0);
  if (filtroCargoId) filtered = filtered.filter(e => e.position_id === filtroCargoId);

  if (ordemSaldos === 'saldo_desc') {
    filtered = filtered.sort((a, b) => {
      const minA = (a.saldo_plantoes * 720) + (a.saldo_minutos || 0);
      const minB = (b.saldo_plantoes * 720) + (b.saldo_minutos || 0);
      return minB - minA;
    });
  } else if (ordemSaldos === 'folgas_desc') {
    filtered = filtered.sort((a, b) => (b.folgasDisponiveis || 0) - (a.folgasDisponiveis || 0));
  } else {
    filtered = filtered.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginatedFiltered = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', gap: '16px', color: 'var(--color-text-muted)' }}>
      <div style={{ width: '36px', height: '36px', border: '3px solid var(--color-divider)', borderTopColor: 'var(--color-primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <span style={{ fontSize: '14px' }}>Carregando dados da unidade...</span>
    </div>
  );

  return (
    <div style={{ position: 'relative' }}>

      {/* ─── Toast de Notificação ──────────────────────── */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: '28px', right: '28px', zIndex: 9999,
          padding: '14px 20px', borderRadius: '10px', maxWidth: '380px',
          display: 'flex', alignItems: 'center', gap: '10px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
          animation: 'slideInRight 0.25s ease',
          background: toast.type === 'success' ? '#10b981' : toast.type === 'error' ? '#ef4444' : '#eab308',
          color: 'white',
        }}>
          <span style={{ fontSize: '18px', flexShrink: 0 }}>
            {toast.type === 'success' ? '✅' : toast.type === 'error' ? '❌' : '⚠️'}
          </span>
          <span style={{ fontSize: '13px', fontWeight: 600, lineHeight: 1.4 }}>{toast.msg}</span>
          <button
            onClick={() => setToast(null)}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '16px', opacity: 0.8, flexShrink: 0 }}
          >×</button>
        </div>
      )}

      <style>{`
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(40px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div style={{ marginBottom: 'var(--space-5)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ margin: 0 }}>Lançamento de Plantões</h2>
          <p className="text-muted" style={{ margin: 0 }}>
            {activeCycle
              ? `Ciclo ativo: ${activeCycle.nome} — o sistema gera 1 folga a cada 252 horas acumuladas (21 plantões de 12h).`
              : 'Nenhum ciclo ativo no momento.'}
          </p>
        </div>
        {activeCycle && (
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={() => setViewMode(v => v === 'calendario' ? 'lista' : 'calendario')}
              style={{
                padding: '0 16px', background: viewMode === 'calendario' ? 'var(--color-primary)' : 'var(--color-surface)',
                color: viewMode === 'calendario' ? '#fff' : 'var(--color-text)', border: `1px solid ${viewMode === 'calendario' ? 'var(--color-primary)' : 'var(--color-divider)'}`,
                borderRadius: '4px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                transition: 'all 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
              }}
            >
              <span style={{ fontSize: '16px' }}>{viewMode === 'calendario' ? '👥' : '📅'}</span>
              {viewMode === 'calendario' ? 'Ver Lista de Servidores' : 'Calendário de Escalas'}
            </button>
            <button
              onClick={() => navigate('/estabelecimento/solicitacoes')}
              style={{ padding: '0 16px', background: 'var(--color-surface)', color: 'var(--color-text)', border: '1px solid var(--color-divider)', borderRadius: '4px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.color = 'var(--color-primary)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-divider)'; e.currentTarget.style.color = 'var(--color-text)'; }}
            >
              <span style={{ fontSize: '16px' }}>🛒</span> Solicitar Compra
            </button>
            <button className="btn btn-primary blueprint" onClick={() => openPlusModal()}>
              <i className="corner tl"></i><i className="corner tr"></i><i className="corner bl"></i><i className="corner br"></i>
              + Plantão Plus
            </button>
          </div>
        )}
      </div>

      {!activeCycle ? (
        <div className="blueprint card" style={{ padding: 'var(--space-6)', textAlign: 'center', background: 'var(--color-surface)' }}>
          <div style={{ fontSize: '48px', marginBottom: 'var(--space-4)' }}>🔒</div>
          <h3 style={{ margin: '0 0 var(--space-2) 0' }}>Ciclo Fechado ou Inexistente</h3>
          <p className="text-muted">Não há nenhum ciclo aberto no momento para registrar plantões.</p>
        </div>
      ) : (
        <>
          {/* KPIs - 5 cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '32px' }}>
            <div className="blueprint card elev-sm" style={{ padding: '14px 18px', background: 'var(--color-surface)' }}>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 600 }}>Total de Servidores</div>
              <div style={{ fontSize: '28px', fontWeight: 800, marginTop: '4px' }}>{totalServidores}</div>
            </div>
            <div className="blueprint card elev-sm" style={{ padding: '14px 18px', background: 'rgba(16,185,129,0.06)', borderLeft: '3px solid #10b981' }}>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#10b981', fontWeight: 600 }}>🎉 Com Folga Pronta</div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: '#10b981', marginTop: '4px' }}>{folgasProntas}</div>
            </div>
            <div className="blueprint card elev-sm" style={{ padding: '14px 18px', background: 'rgba(234,179,8,0.06)', borderLeft: '3px solid #eab308' }}>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#eab308', fontWeight: 600 }}>⏳ Próximos (≥120h)</div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: '#eab308', marginTop: '4px' }}>{proximos}</div>
            </div>
            <div className="blueprint card elev-sm" style={{ padding: '14px 18px', background: 'rgba(59,130,246,0.06)', borderLeft: '3px solid var(--color-primary)' }}>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-primary)', fontWeight: 600 }}>📦 Total de Folgas</div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--color-primary)', marginTop: '4px' }}>{totalFolgas}</div>
            </div>
            <div className="blueprint card elev-sm" style={{
              padding: '14px 18px',
              background: orcamentoDisponivel > 0 ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)',
              borderLeft: `3px solid ${orcamentoDisponivel > 0 ? '#10b981' : 'var(--color-danger)'}`
            }}>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', color: orcamentoDisponivel > 0 ? '#10b981' : 'var(--color-danger)', fontWeight: 600 }}>💰 Disponível p/ Lançamento</div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: orcamentoDisponivel > 0 ? '#10b981' : 'var(--color-danger)', marginTop: '4px' }}>
                R$ {orcamentoDisponivel.toFixed(2)}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                já descontando Aprovado + Aguardando Aprovação
              </div>
            </div>
          </div>

          {/* Calendário de Escalas: visão do ciclo inteiro, dia a dia, com quem já está
              Aprovado ou Aguardando Aprovação (Plantão Plus ou Folga Comprada) — pra não
              escalar alguém a mais no mesmo dia sem perceber. */}
          {viewMode === 'calendario' && (
            <div className="blueprint card elev-sm" style={{ padding: 'var(--space-5)', marginBottom: '24px', background: 'var(--color-surface)' }}>
              <i className="corner tl"></i><i className="corner tr"></i><i className="corner bl"></i><i className="corner br"></i>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                <h3 style={{ margin: 0 }}>📅 Calendário de Escalas — {activeCycle.nome}</h3>
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                  Conta solicitações <strong>Aprovadas</strong> e <strong>Aguardando Aprovação</strong>
                </div>
              </div>

              {/* Detalhe do dia selecionado: lista com nome, cargo, tipo e status de cada
                  servidor escalado — fica acima da grade, não precisa rolar pra ver. */}
              {selectedCalendarDay && (
                <div style={{ marginBottom: '16px', padding: '14px 16px', borderRadius: '8px', background: 'var(--color-bg)', border: '1px solid var(--color-divider)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <strong style={{ fontSize: '13px' }}>
                      {new Date(selectedCalendarDay + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
                    </strong>
                    <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: '12px' }} onClick={() => setSelectedCalendarDay(null)}>Fechar</button>
                  </div>
                  {(escalaPorDia.get(selectedCalendarDay) || []).length === 0 ? (
                    <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Ninguém escalado neste dia ainda.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {(escalaPorDia.get(selectedCalendarDay) || []).map((e, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: 'var(--color-surface)', borderRadius: '6px', fontSize: '13px' }}>
                          <div>
                            <strong>{e.nome}</strong> <span style={{ color: 'var(--color-text-muted)' }}>({e.matricula})</span>
                            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{e.cargo}</div>
                          </div>
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <span style={{ fontSize: '11px', fontWeight: 600, color: e.tipo === 'PLANTAO_PLUS' ? 'var(--color-primary)' : '#10b981' }}>
                              {e.tipo === 'PLANTAO_PLUS' ? '⚡ Plantão Plus' : '🎉 Folga Comprada'}
                            </span>
                            <span style={{
                              fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px',
                              background: e.status === 'APROVADA' ? 'rgba(16,185,129,0.15)' : 'rgba(234,179,8,0.15)',
                              color: e.status === 'APROVADA' ? '#10b981' : '#b45309'
                            }}>
                              {e.status === 'APROVADA' ? 'Aprovada' : 'Aguardando'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px', marginBottom: '6px' }}>
                {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
                  <div key={d} style={{ textAlign: 'center', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', padding: '4px 0' }}>{d}</div>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px' }}>
                {(() => {
                  const hojeKey = toDateKey(new Date());
                  return getCalendarGridDays(activeCycle.data_inicio, activeCycle.data_fim).map(d => {
                    const key = toDateKey(d);
                    const dentroDoCiclo = key >= activeCycle.data_inicio && key <= activeCycle.data_fim;
                    const escalados = escalaPorDia.get(key) || [];
                    const temEscalados = dentroDoCiclo && escalados.length > 0;
                    const isSelected = selectedCalendarDay === key;
                    const ehHoje = key === hojeKey;
                    return (
                      <button
                        key={key}
                        onClick={() => dentroDoCiclo && setSelectedCalendarDay(prev => prev === key ? null : key)}
                        disabled={!dentroDoCiclo}
                        style={{
                          minHeight: '58px',
                          border: `1px solid ${isSelected ? 'var(--color-primary)' : temEscalados ? '#10b981' : 'var(--color-divider)'}`,
                          borderRadius: '6px', padding: '4px',
                          background: !dentroDoCiclo ? 'transparent' : isSelected ? 'rgba(59,130,246,0.15)' : temEscalados ? 'rgba(16,185,129,0.15)' : 'var(--color-bg)',
                          boxShadow: ehHoje ? 'inset 0 0 0 2px var(--color-primary)' : 'none',
                          cursor: dentroDoCiclo ? 'pointer' : 'default', opacity: dentroDoCiclo ? 1 : 0.25,
                          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px'
                        }}
                      >
                        <span style={{ fontSize: '12px', fontWeight: ehHoje ? 800 : 600, color: ehHoje ? 'var(--color-primary)' : 'var(--color-text)' }}>
                          {d.getDate()}
                        </span>
                        {temEscalados && (
                          <span style={{
                            fontSize: '10px', fontWeight: 700, padding: '0 6px', borderRadius: '10px',
                            background: '#10b981', color: '#fff'
                          }}>
                            {escalados.length}
                          </span>
                        )}
                      </button>
                    );
                  });
                })()}
              </div>
            </div>
          )}

          {viewMode === 'lista' && (
          <>
          {/* Busca + Filtros Rápidos + Cargo + Ordenação */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="text"
              className="input"
              placeholder="🔍 Buscar por nome ou matrícula..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
              style={{ flex: 1, minWidth: '180px' }}
            />
            <select
              className="input"
              style={{ width: '200px' }}
              value={filtroCargoId}
              onChange={(e) => setFiltroCargoId(e.target.value)}
            >
              <option value="">Todos os cargos</option>
              {cargosDisponiveis.map(c => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
            <div style={{ display: 'flex', gap: '6px' }}>
              {([['todos', 'Todos', 'var(--color-text-muted)'], ['com_folga', '🎉 Com Folga', '#10b981'], ['acumulando', '⏳ Acumulando', '#eab308']] as const).map(([val, label, cor]) => (
                <button
                  key={val}
                  onClick={() => setFiltroStatus(val)}
                  style={{
                    padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', border: 'none',
                    background: filtroStatus === val ? cor : 'var(--color-surface)',
                    color: filtroStatus === val ? (val === 'todos' ? 'var(--color-text)' : 'white') : cor,
                    outline: filtroStatus === val ? `2px solid ${cor}` : '1px solid var(--color-divider)',
                    transition: 'all 0.15s'
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <select
              className="input"
              style={{ width: '150px' }}
              value={ordemSaldos}
              onChange={(e) => setOrdemSaldos(e.target.value)}
            >
              <option value="nome_asc">Nome (A-Z)</option>
              <option value="saldo_desc">Maior Saldo</option>
              <option value="folgas_desc">Mais Folgas</option>
            </select>
          </div>

          {/* Contador de resultados */}
          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '12px' }}>
            Exibindo <strong>{paginatedFiltered.length}</strong> de <strong>{filtered.length}</strong> servidor{filtered.length !== 1 ? 'es' : ''} filtrado{filtered.length !== 1 ? 's' : ''} (Total: {totalServidores})
            {(busca || filtroCargoId || filtroStatus !== 'todos') && (
              <button
                onClick={() => { setBusca(''); setFiltroCargoId(''); setFiltroStatus('todos'); }}
                style={{ marginLeft: '10px', fontSize: '11px', color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
              >
                Limpar filtros
              </button>
            )}
          </div>

          {/* Grid de Cards */}
          {paginatedFiltered.length === 0 ? (
            <div className="blueprint card" style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>🔍</div>
              <p style={{ margin: 0 }}>Nenhum servidor encontrado com os filtros aplicados.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 'var(--space-3)' }}>
              {paginatedFiltered.map((emp, idx) => {
                const permiteCarga = emp.schedule_types?.permite_carga_horaria !== false;
                const temFolga = (emp.folgasDisponiveis || 0) > 0;
                const totalMinutos = (emp.saldo_plantoes * 720) + (emp.saldo_minutos || 0);
                const horas = Math.floor(totalMinutos / 60);
                const minutosStr = String(totalMinutos % 60).padStart(2, '0');

                const proximo = permiteCarga && !temFolga && horas >= 120;
                const pct = Math.min((totalMinutos / 15120) * 100, 100); // 15120 = 252h = 21 plantoes
                const corBorda = temFolga ? '#10b981' : proximo ? '#eab308' : 'var(--color-divider)';
                const plusPendente = plusPendentes[emp.id] || 0;
                return (
                  <div
                    key={emp.id}
                    className="blueprint card"
                    style={{
                      padding: '16px', cursor: 'pointer',
                      transition: 'transform 0.15s, box-shadow 0.15s',
                      background: 'var(--color-surface)',
                      borderLeft: `4px solid ${corBorda}`,
                      animation: `fadeInUp 0.25s ease both`,
                      animationDelay: `${idx * 30}ms`,
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 20px rgba(0,0,0,0.15)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = ''; }}
                    onClick={() => openDetailsModal(emp)}
                  >
                    {/* Cabeçalho do Card */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: '13px', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {emp.nome}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {emp.positions?.nome || emp.positions?.codigo} &bull; Mat: {emp.matricula}
                        </div>
                      </div>
                      <button
                        title="Lançar Plantão Plus"
                        onClick={e => { e.stopPropagation(); openPlusModal(emp.id); }}
                        style={{
                          marginLeft: '8px', flexShrink: 0, padding: '4px 10px', borderRadius: '14px',
                          border: '1px solid rgba(59,130,246,0.3)', background: 'rgba(59,130,246,0.05)', color: 'var(--color-primary)',
                          cursor: 'pointer', fontSize: '11px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px',
                          transition: 'background 0.2s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(59,130,246,0.15)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(59,130,246,0.05)'}
                      >
                        <span>⚡</span> Lançar Plus
                      </button>
                    </div>

                    {/* Saldo + Barra — só pra quem tem escala habilitada pra carga horária */}
                    {permiteCarga ? (
                      <div style={{ marginBottom: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
                          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Saldo para próxima folga</span>
                          <span style={{ fontWeight: 800, fontSize: '16px', color: temFolga ? '#10b981' : 'var(--color-text)' }}>
                            {horas}h {minutosStr}m<span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--color-text-muted)' }}>/252h</span>
                          </span>
                        </div>
                        <div style={{ height: '8px', background: 'var(--color-divider)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{
                            height: '100%', borderRadius: '4px', transition: 'width 0.4s ease',
                            width: `${pct}%`,
                            background: temFolga
                              ? 'linear-gradient(90deg, #10b981, #34d399)'
                              : proximo
                                ? 'linear-gradient(90deg, #eab308, #f59e0b)'
                                : 'linear-gradient(90deg, #3b82f6, #60a5fa)'
                          }} />
                        </div>
                      </div>
                    ) : (
                      <div style={{ marginBottom: '10px', padding: '8px 10px', background: 'var(--color-bg)', borderRadius: '6px', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                        ⚡ Escala só Plantão Plus — não acumula carga horária
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {temFolga && (
                        <span style={{
                          fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '12px',
                          background: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.25)'
                        }}>
                          🎉 {emp.folgasDisponiveis} Folga{emp.folgasDisponiveis! > 1 ? 's' : ''} disponível
                        </span>
                      )}
                      {permiteCarga && proximo && (
                        <span style={{
                          fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '12px',
                          background: 'rgba(234,179,8,0.12)', color: '#eab308', border: '1px solid rgba(234,179,8,0.25)'
                        }}>
                          ⏳ Próximo da folga
                        </span>
                      )}
                      {permiteCarga && !temFolga && !proximo && (
                        <span style={{
                          fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '12px',
                          background: 'var(--color-bg)', color: 'var(--color-text-muted)', border: '1px solid var(--color-divider)'
                        }}>
                          Acumulando
                        </span>
                      )}
                      {plusPendente > 0 && (
                        <span style={{
                          fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '12px',
                          background: 'rgba(59,130,246,0.12)', color: 'var(--color-primary)', border: '1px solid rgba(59,130,246,0.25)'
                        }}>
                          ⚡ {plusPendente} Pl. Plus pendente{plusPendente > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Controles de Paginação */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginTop: '32px' }}>
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                style={{ padding: '6px 12px', borderRadius: '4px', border: '1px solid var(--color-divider)', background: 'var(--color-surface)', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', opacity: currentPage === 1 ? 0.5 : 1 }}
              >
                Anterior
              </button>
              
              <div style={{ display: 'flex', gap: '4px' }}>
                {Array.from({ length: totalPages }).map((_, i) => {
                  const page = i + 1;
                  // Exibir apenas páginas próximas ou extremidades (lógica simplificada para não poluir caso tenha muitas páginas)
                  if (page === 1 || page === totalPages || (page >= currentPage - 2 && page <= currentPage + 2)) {
                    return (
                      <button 
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        style={{ 
                          width: '32px', height: '32px', borderRadius: '4px', border: '1px solid',
                          borderColor: currentPage === page ? 'var(--color-primary)' : 'var(--color-divider)',
                          background: currentPage === page ? 'var(--color-primary)' : 'var(--color-surface)',
                          color: currentPage === page ? 'white' : 'var(--color-text)',
                          cursor: 'pointer', fontWeight: currentPage === page ? 700 : 500
                        }}
                      >
                        {page}
                      </button>
                    );
                  }
                  if (page === currentPage - 3 || page === currentPage + 3) {
                    return <span key={page} style={{ padding: '0 4px', color: 'var(--color-text-muted)' }}>...</span>;
                  }
                  return null;
                })}
              </div>

              <button 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                style={{ padding: '6px 12px', borderRadius: '4px', border: '1px solid var(--color-divider)', background: 'var(--color-surface)', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', opacity: currentPage === totalPages ? 0.5 : 1 }}
              >
                Próxima
              </button>
            </div>
          )}

          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '16px', textAlign: 'center' }}>
            ℹ️ Clique em um servidor para ver o extrato completo. Use ⚡ para lançar Plantão Plus direto do card.
          </div>
          </>
          )}
        </>
      )}



      {isPlusModalOpen && (
        <div
          onClick={() => { setIsPlusModalOpen(false); openPlusModal(); /* limpa o form */ }}
          style={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
            background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
          }}
        >
          <div
            className="blueprint card elev-md"
            onClick={e => e.stopPropagation()}
            style={{ width: '500px', padding: 'var(--space-6)', background: 'var(--color-surface)' }}
          >
            <i className="corner tl"></i><i className="corner tr"></i><i className="corner bl"></i><i className="corner br"></i>
            <h3 style={{ marginTop: 0, marginBottom: 'var(--space-4)' }}>
              Lançar Plantão Plus (Indenização)
            </h3>

            <div style={{ marginBottom: '20px', padding: '12px 16px', background: 'rgba(239,68,68,0.05)', borderRadius: '8px', borderLeft: '4px solid var(--color-danger)', fontSize: '13px', color: 'var(--color-text)', lineHeight: 1.5, textAlign: 'justify' }}>
              <strong>⚠️ ATENÇÃO:</strong> O lançamento de <strong>Plantão Plus</strong> é passível de rigorosa auditoria pelos órgãos de controle. Ao registrar este plantão, a direção do estabelecimento penal está atestando e se responsabilizando integralmente de que o servidor realmente prestou o serviço suplementar nas datas e condições informadas.
            </div>
            
            <form onSubmit={handleSavePlus}>
              <div className="field" style={{ marginBottom: 'var(--space-3)' }}>
                <label>Servidor *</label>
                <input 
                  type="text" 
                  className="input" 
                  placeholder="Pesquisar por nome ou matrícula..." 
                  value={plusSearchTerm}
                  onChange={(e) => setPlusSearchTerm(e.target.value)}
                  style={{ marginBottom: '8px' }}
                />
                <select 
                  className="input" 
                  value={plusEmployeeId} 
                  onChange={(e) => setPlusEmployeeId(e.target.value)}
                  required
                >
                  <option value="">Selecione o servidor...</option>
                  {employees
                    .filter(emp => (emp.nome + emp.matricula).toLowerCase().includes(plusSearchTerm.toLowerCase()))
                    .map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.nome} - Mat: {emp.matricula}
                    </option>
                  ))}
                </select>
              </div>

              {plusValorPreview !== null && (
                plusValorPreview > orcamentoDisponivel ? (
                  <div style={{
                    marginBottom: 'var(--space-3)', padding: '10px 14px', borderRadius: '8px', fontSize: '13px',
                    background: 'rgba(239,68,68,0.08)', borderLeft: '4px solid var(--color-danger)', color: 'var(--color-danger)'
                  }}>
                    <div style={{ fontWeight: 700 }}>
                      🚫 Orçamento insuficiente — faltam R$ {(plusValorPreview - orcamentoDisponivel).toFixed(2)}
                    </div>
                    <div style={{ marginTop: '4px' }}>
                      Este lançamento (R$ {plusValorPreview.toFixed(2)}) não cabe no disponível (R$ {orcamentoDisponivel.toFixed(2)}).
                    </div>
                    <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: '1px dashed rgba(239,68,68,0.25)' }}>
                      💡 Aprove ou rejeite solicitações pendentes em "Solicitar Compra" para liberar orçamento.
                    </div>
                  </div>
                ) : (
                  <div style={{
                    marginBottom: 'var(--space-3)', padding: '10px 14px', borderRadius: '8px', fontSize: '13px',
                    background: 'rgba(16,185,129,0.08)', borderLeft: '4px solid #10b981', color: '#0d7a56'
                  }}>
                    Valor deste lançamento: <strong>R$ {plusValorPreview.toFixed(2)}</strong> — Disponível p/ lançamento: <strong>R$ {orcamentoDisponivel.toFixed(2)}</strong>
                  </div>
                )
              )}

              <div className="field" style={{ marginBottom: 'var(--space-3)' }}>
                <label>Data do Plantão Extraordinário *</label>
                <input
                  className="input"
                  type="date"
                  value={plusDataPlantao}
                  min={activeCycle?.data_inicio}
                  max={activeCycle?.data_fim}
                  onChange={(e) => setPlusDataPlantao(e.target.value)}
                  required
                />
              </div>

              <div className="field" style={{ marginBottom: 'var(--space-4)' }}>
                <label>Justificativa (Mín. 50 caracteres) *</label>
                <textarea 
                  className="input" 
                  value={plusJustificativa} 
                  onChange={(e) => setPlusJustificativa(e.target.value)} 
                  rows={4}
                  required
                  placeholder="Justifique detalhadamente o motivo do plantão extraordinário..."
                  minLength={50}
                  maxLength={1000}
                />
                <div style={{ fontSize: '11px', color: plusJustificativa.length < 50 ? 'var(--color-danger)' : 'var(--color-primary)', marginTop: '4px', textAlign: 'right' }}>
                  {plusJustificativa.length}/1000 caracteres (mínimo 50)
                </div>
              </div>

              <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setIsPlusModalOpen(false)}>Cancelar</button>
                <button
                  type="submit"
                  className="btn btn-primary blueprint"
                  disabled={isSubmittingPlus || (plusValorPreview !== null && plusValorPreview > orcamentoDisponivel)}
                >
                  <i className="corner tl"></i><i className="corner tr"></i><i className="corner bl"></i><i className="corner br"></i>
                  {isSubmittingPlus ? 'Enviando...' : 'Solicitar Pagamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isDetailsModalOpen && selectedEmployee && (
        <div
          onClick={() => setIsDetailsModalOpen(false)}
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '16px', textTransform: 'uppercase' }}>{selectedEmployee.nome}</div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                    {selectedEmployee.positions?.nome || selectedEmployee.positions?.codigo} &bull; Mat: {selectedEmployee.matricula}
                  </div>
                </div>
                <button className="btn btn-ghost" style={{ padding: '4px 8px' }} onClick={() => setIsDetailsModalOpen(false)}>✕</button>
              </div>

              {/* Cards de Resumo */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                <div style={{ background: 'var(--color-bg)', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                  <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 600, marginBottom: '4px' }}>Saldo</div>
                  {permiteCargaHorariaDetail ? (
                    <>
                      <div style={{ fontSize: '20px', fontWeight: 800 }}>
                        {Math.floor(((selectedEmployee.saldo_plantoes * 720) + (selectedEmployee.saldo_minutos || 0)) / 60)}h
                        <span style={{ fontSize: '14px', marginLeft: '2px' }}>
                          {String(((selectedEmployee.saldo_plantoes * 720) + (selectedEmployee.saldo_minutos || 0)) % 60).padStart(2, '0')}m
                        </span>
                      </div>
                      <div style={{ height: '4px', background: 'var(--color-divider)', borderRadius: '2px', marginTop: '6px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', background: 'var(--color-primary)', width: `${Math.min((((selectedEmployee.saldo_plantoes * 720) + (selectedEmployee.saldo_minutos || 0)) / 15120) * 100, 100)}%` }}></div>
                      </div>
                    </>
                  ) : (
                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-muted)', marginTop: '10px' }}>⚡ Só Plus</div>
                  )}
                </div>
                <div style={{ background: 'rgba(16,185,129,0.08)', borderRadius: '8px', padding: '10px', textAlign: 'center', border: '1px solid rgba(16,185,129,0.2)' }}>
                  <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#10b981', fontWeight: 600, marginBottom: '4px' }}>Folgas</div>
                  <div style={{ fontSize: '22px', fontWeight: 800, color: '#10b981' }}>{detailFolgas.filter(f => f.status === 'GERADA').length}</div>
                  <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '4px' }}>disponíveis</div>
                </div>
                <div style={{ background: 'rgba(59,130,246,0.08)', borderRadius: '8px', padding: '10px', textAlign: 'center', border: '1px solid rgba(59,130,246,0.2)' }}>
                  <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--color-primary)', fontWeight: 600, marginBottom: '4px' }}>Pl. Plus</div>
                  <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--color-primary)' }}>{detailPlusRequests.length}</div>
                  <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '4px' }}>lançado(s)</div>
                </div>
              </div>
            </div>

            {/* Abas */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--color-divider)', flexShrink: 0 }}>
              {([['plantoes', '📋 Plantões'], ['folgas', '🎉 Folgas'], ['plus', '⚡ Plantão Plus']] as const).map(([tab, label]) => (
                <button
                  key={tab}
                  onClick={() => setDetailTab(tab)}
                  style={{
                    flex: 1, padding: '12px 8px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600,
                    background: 'transparent',
                    color: detailTab === tab ? 'var(--color-primary)' : 'var(--color-text-muted)',
                    borderBottom: detailTab === tab ? '2px solid var(--color-primary)' : '2px solid transparent',
                    transition: 'all 0.2s'
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Conteúdo da Aba */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
              {loadingHistory ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0', gap: '16px', color: 'var(--color-text-muted)' }}>
                  <div style={{ width: '28px', height: '28px', border: '3px solid var(--color-divider)', borderTopColor: 'var(--color-primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  <span style={{ fontSize: '13px' }}>Carregando histórico...</span>
                </div>
              ) : (
                <>
                  {/* ABA: Folgas */}
                  {detailTab === 'folgas' && (
                    <div>
                      <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(59,130,246,0.05)', borderRadius: '8px', border: '1px solid rgba(59,130,246,0.1)', fontSize: '12px', color: 'var(--color-text)', lineHeight: 1.5, textAlign: 'justify' }}>
                        {permiteCargaHorariaDetail
                          ? 'Aqui estão listadas todas as folgas adquiridas pelo servidor. O sistema gera uma nova folga automaticamente a cada ciclo concluído, ou seja, sempre que o saldo acumulado atinge a marca de 21 plantões inteiros (252 horas)'
                          : 'Este servidor está em escala só-Plantão Plus e não acumula carga horária nova. As folgas listadas abaixo (se houver) foram geradas antes dessa configuração e continuam válidas normalmente.'}
                      </div>
                      {detailFolgas.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '32px', color: 'var(--color-text-muted)' }}>Nenhuma folga gerada ainda.</div>
                      ) : detailFolgas.map((f: any) => {
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
                  {detailTab === 'plantoes' && (
                    !permiteCargaHorariaDetail ? (
                      <div style={{ textAlign: 'center', padding: '32px', color: 'var(--color-text-muted)' }}>
                        ⚡ Este servidor está em escala só-Plantão Plus — não acumula carga horária compensatória.
                      </div>
                    ) : (
                    <div>
                      <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(59,130,246,0.05)', borderRadius: '8px', border: '1px solid rgba(59,130,246,0.1)', fontSize: '12px', color: 'var(--color-text)', lineHeight: 1.5, textAlign: 'justify' }}>
                        Este painel detalha as horas contempladas dentro do ciclo atual do servidor. Cada carga horária lançada é somada ao saldo geral, acumulando o tempo exigido para a liberação da próxima folga.
                      </div>
                      {detailShifts.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '32px', color: 'var(--color-text-muted)' }}>Nenhum plantão registrado.</div>
                      ) : (() => {
                        // O banco recalcula o saldo do ZERO a cada importação (soma histórica de
                        // plantões menos folgas já geradas × 21) — não é um acúmulo lançamento a
                        // lançamento. Pra mostrar corretamente "quantos plantões sobraram depois
                        // deste lançamento específico", reconstruímos essa mesma conta aqui,
                        // andando pelos lançamentos em ordem cronológica real.
                        const chronoAsc = [...detailShifts].sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
                        const saldoAposShift = new Map<string, { plantoesRestantes: number; folgasGeradas: any[] }>();
                        let cumulativoPlantoes = 0;
                        let folgasContadas = 0;
                        const proximoCicloNome = new Map<string, string>();
                        chronoAsc.forEach((s: any, i: number) => {
                          cumulativoPlantoes += s.quantidade_plantoes;
                          const folgasDesteCiclo = detailFolgas.filter((f: any) => f.cycle_id === s.cycle_id);
                          folgasContadas += folgasDesteCiclo.length;
                          saldoAposShift.set(s.id, { plantoesRestantes: cumulativoPlantoes - (folgasContadas * 21), folgasGeradas: folgasDesteCiclo });
                          if (i < chronoAsc.length - 1) proximoCicloNome.set(s.id, chronoAsc[i + 1].cycles?.nome || 'o lançamento seguinte');
                        });

                        return (
                        <div style={{ position: 'relative', paddingLeft: '22px' }}>
                          {/* Fio conectando os lançamentos: a "sobra" de um mês é literalmente
                              parte do total do próximo — o fio deixa esse encadeamento visível,
                              em vez de cada card parecer um evento isolado. */}
                          {detailShifts.length > 1 && (
                            <div style={{ position: 'absolute', left: '3px', top: '14px', bottom: '14px', width: '2px', background: 'var(--color-divider)' }} />
                          )}
                          {detailShifts.map((s: any, idx: number) => {
                            const workedTotalMinutes = (s.quantidade_plantoes * 720) + (s.minutos_residuais || 0);
                            const workedHours = Math.floor(workedTotalMinutes / 60);
                            const workedMinutes = workedTotalMinutes % 60;
                            const ehMaisRecente = idx === 0;
                            const info = saldoAposShift.get(s.id)!;
                            // Pro lançamento mais recente, usa o saldo AO VIVO gravado no
                            // servidor (fonte da verdade) em vez da reconstrução — os dois batem,
                            // mas o valor ao vivo não depende de nenhum cálculo feito aqui.
                            const plantoesRestantes = ehMaisRecente ? (selectedEmployee?.saldo_plantoes || 0) : info.plantoesRestantes;
                            const minutosRestantes = ehMaisRecente ? (selectedEmployee?.saldo_minutos || 0) : (s.minutos_residuais || 0);
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

                                {/* Equação de entrada: horas consideradas (novas + o que já
                                    vinha acumulado) → quantos plantões inteiros isso fechou.
                                    O que aconteceu com esses plantões e o que sobrou viram
                                    blocos separados logo abaixo, em vez de tudo na mesma linha. */}
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

                                {/* Dois blocos lado a lado: (1) o que aconteceu com os plantões
                                    dessa entrada — cruzando com a aba Folgas pelo mesmo cycle_id
                                    — e (2) o que sobrou e segue acumulando pro próximo ciclo. São
                                    as duas perguntas que o operador faz e que antes ficavam
                                    misturadas numa única linha de texto. */}
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
                  {detailTab === 'plus' && (
                    <div>
                      <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(59,130,246,0.05)', borderRadius: '8px', border: '1px solid rgba(59,130,246,0.1)', fontSize: '12px', color: 'var(--color-text)', lineHeight: 1.5, textAlign: 'justify' }}>
                        O Plantão Plus refere-se aos plantões remunerados realizados de forma suplementar, ou seja, turnos cumpridos pelo servidor que não fazem parte de sua escala obrigatória
                      </div>
                      {detailPlusRequests.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '32px', color: 'var(--color-text-muted)' }}>Nenhum Plantão Plus lançado.</div>
                      ) : detailPlusRequests.map(p => (
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
      )}

    </div>
  );
};

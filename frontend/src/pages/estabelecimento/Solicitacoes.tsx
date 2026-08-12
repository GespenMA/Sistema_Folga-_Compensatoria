import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';

type SortColumnSol = 'servidor' | 'tipo' | 'data_plantao' | 'valor' | 'status';
type SortColumnUsufruida = 'servidor' | 'data_usufruto';
type SortDirection = 'asc' | 'desc';

type FolgaDisponivel = {
  id: string;
  periodo_inicio: string;
  periodo_fim: string;
  quantidade_plantoes: number;
  status: string;
  employees: {
    id: string;
    nome: string;
    matricula: string;
    positions: { id: string; nome: string; codigo: string };
  };
};

type Solicitacao = {
  id: string;
  valor: number;
  status: string;
  justificativa: string;
  requested_at: string;
  tipo_solicitacao: string;
  data_plantao?: string;
  compensatory_days?: {
    periodo_inicio: string;
    periodo_fim: string;
    quantidade_plantoes: number;
  };
  employees: {
    nome: string;
    matricula: string;
    positions: { nome: string; codigo: string };
  };
};

export const Solicitacoes: React.FC = () => {
  const { profile } = useAuth();
  const [activeCycle, setActiveCycle] = useState<any>(null);
  const [folgasDisponiveis, setFolgasDisponiveis] = useState<FolgaDisponivel[]>([]);
  const [folgasUsufruidas, setFolgasUsufruidas] = useState<any[]>([]);
  const [activeRightTab, setActiveRightTab] = useState<'FINANCEIRO' | 'USUFRUIDAS'>('FINANCEIRO');
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  // const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isUsufrutoModalOpen, setIsUsufrutoModalOpen] = useState(false);
  const [selectedFolga, setSelectedFolga] = useState<any>(null);
  const [dataPlantao, setDataPlantao] = useState('');
  const [justificativa, setJustificativa] = useState('');
  const [dataUsufruto, setDataUsufruto] = useState('');
  const [valorUnitario, setValorUnitario] = useState(0);
  const [valorHistoricoId, setValorHistoricoId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filtros para Folgas
  const [buscaFolga, setBuscaFolga] = useState('');
  const [filtroCargoFolga, setFiltroCargoFolga] = useState('');

  // Modal de Confirmação Genérico
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
  } | null>(null);

  // Status de Limite
  const [totalOrcado, setTotalOrcado] = useState(0);
  const [totalGasto, setTotalGasto] = useState(0);
  const [totalEmpenhado, setTotalEmpenhado] = useState(0);
  const [orcamentoDisponivel, setOrcamentoDisponivel] = useState(0);

  // Valores dos Cargos (para mostrar no card antes do modal)
  const [positionValues, setPositionValues] = useState<Record<string, number>>({});

  // Aprovação em lote (Lado Direito)
  const [selectedRequests, setSelectedRequests] = useState<string[]>([]);
  
  // Solicitação em lote (Lado Esquerdo)
  const [selectedFolgas, setSelectedFolgas] = useState<string[]>([]);

  // Paginação
  const [currentPageFolgas, setCurrentPageFolgas] = useState(1);
  const [currentPageSolicitacoes, setCurrentPageSolicitacoes] = useState(1);
  const ITEMS_PER_PAGE = 24;

  const [sortColumnSol, setSortColumnSol] = useState<SortColumnSol | null>(null);
  const [sortDirectionSol, setSortDirectionSol] = useState<SortDirection>('asc');
  
  const [sortColumnUsufruida, setSortColumnUsufruida] = useState<SortColumnUsufruida | null>(null);
  const [sortDirectionUsufruida, setSortDirectionUsufruida] = useState<SortDirection>('asc');

  useEffect(() => {
    setCurrentPageFolgas(1);
  }, [buscaFolga, filtroCargoFolga]);

  useEffect(() => {
    if (profile?.establishment_id) {
      fetchData(true);
    }
  }, [profile?.establishment_id]);

  const fetchData = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      // 1. Pega o Ciclo Ativo
      const { data: cycleData } = await supabase
        .from('cycles')
        .select('*')
        .in('status', ['ABERTO', 'REABERTO'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cycleData) {
        setActiveCycle(cycleData);
        
        // 2. Busca folgas disponíveis (GERADAS)
        const { data: folgas } = await supabase
          .from('compensatory_days')
          .select(`
            id, periodo_inicio, periodo_fim, quantidade_plantoes, status,
            employees (
              id, nome, matricula,
              positions (id, nome, codigo)
            )
          `)
          .eq('cycle_id', cycleData.id)
          .eq('status', 'GERADA')
          .order('generated_at', { ascending: false });
        
        if (folgas) setFolgasDisponiveis(folgas as unknown as FolgaDisponivel[]);

        // 2b. Busca folgas usufruidas
        const { data: usufruidas } = await supabase
          .from('compensatory_days')
          .select(`
            id, used_at, quantidade_plantoes, status,
            employees (
              id, nome, matricula,
              positions (id, nome, codigo)
            )
          `)
          .eq('cycle_id', cycleData.id)
          .eq('status', 'USUFRUIDA')
          .order('used_at', { ascending: false });
        
        if (usufruidas) setFolgasUsufruidas(usufruidas);

        // 3. Busca valores atualizados dos cargos PRIMEIRO para poder recalcular tudo
        const { data: posVals } = await supabase
          .from('position_values')
          .select('position_id, valor')
          .is('vigencia_fim', null);
        
        const vals: Record<string, number> = {};
        if (posVals) {
          posVals.forEach(v => vals[v.position_id] = Number(v.valor));
          setPositionValues(vals);
        }

        // 4. Busca solicitações já feitas no ciclo
        const { data: sols } = await supabase
          .from('purchase_requests')
          .select(`
            id, valor, status, justificativa, requested_at, tipo_solicitacao, data_plantao, position_id,
            compensatory_days (periodo_inicio, periodo_fim, quantidade_plantoes),
            employees (nome, matricula, positions(nome, codigo))
          `)
          .eq('cycle_id', cycleData.id)
          .eq('establishment_id', profile!.establishment_id)
          .order('requested_at', { ascending: false });
          
        if (sols) {
          // Atualiza as solicitações com o valor mais recente!
          const mappedSols = (sols as any[]).map(s => {
            if (s.position_id && vals[s.position_id]) {
              s.valor = vals[s.position_id];
            }
            return s;
          });
          setSolicitacoes(mappedSols as unknown as Solicitacao[]);
        }

        // 5. Calcular saldo do orçamento disponível recálculado
        const { data: ceData } = await supabase
          .from('cycle_establishments')
          .select('total_orcado, planning_limits(quantidade_planejada, position_id)')
          .eq('cycle_id', cycleData.id)
          .eq('establishment_id', profile!.establishment_id)
          .maybeSingle();

        let orcado = 0;
        if (ceData && ceData.planning_limits) {
          ceData.planning_limits.forEach((pl: any) => {
             orcado += (pl.quantidade_planejada || 0) * (vals[pl.position_id] || 0);
          });
        }

        const solsList = (sols || []) as any[];
        const consumido = solsList
          .filter(s => s.status === 'APROVADA')
          .reduce((acc, curr) => acc + Number(vals[curr.position_id] || curr.valor), 0);

        const empenhado = solsList
          .filter(s => s.status === 'SOLICITADA')
          .reduce((acc, curr) => acc + Number(vals[curr.position_id] || curr.valor), 0);
          
        setTotalOrcado(orcado);
        setTotalGasto(consumido);
        setTotalEmpenhado(empenhado);
        setOrcamentoDisponivel(orcado - consumido);
      }

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const openCompraModal = async (folga: FolgaDisponivel | any) => {
    try {
      setSelectedFolga(folga);
      setJustificativa('');
      setDataPlantao('');
      
      // Buscar o valor atual do cargo para calcular
      const positionId = folga.employees?.positions?.id;
      if (!positionId) {
        alert("Erro: O cargo deste servidor não foi encontrado.");
        return;
      }

      const { data: posVal, error } = await supabase
        .from('position_values')
        .select('id, valor')
        .eq('position_id', positionId)
        .order('vigencia_inicio', { ascending: false })
        .limit(1)
        .maybeSingle();
        
      if (error) {
        alert("Erro no banco de dados: " + error.message);
        return;
      }

      if (posVal) {
        setValorUnitario(posVal.valor);
        setValorHistoricoId(posVal.id);
      } else {
        alert("Erro: O cargo deste servidor não possui valor configurado. Entre em contato com o gestor.");
        return;
      }

      setIsModalOpen(true);
    } catch (err: any) {
      alert("Erro inesperado: " + err.message);
    }
  };

  const handleComprar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFolga || !profile || !activeCycle) return;
    
    const valorTotal = valorUnitario * selectedFolga.quantidade_plantoes;

    // Antiga trava de orçamento (removida): o frontend não bloqueia a CRIAÇÃO da solicitação (Fila). 
    // O bloqueio real de limite de orçamento ocorre no Banco de Dados (Trigger) no momento da APROVAÇÃO.

    if (dataPlantao > activeCycle.data_fim) {
      alert(`A data do plantão não pode ultrapassar o encerramento do ciclo atual.`);
      return;
    }

    setIsSubmitting(true);
    try {
      // Verificar duplicidade de data
      const { data: existingPlus } = await supabase
        .from('purchase_requests')
        .select('id')
        .eq('employee_id', selectedFolga.employees.id)
        .eq('data_plantao', dataPlantao)
        .neq('status', 'REJEITADA')
        .neq('status', 'CANCELADA')
        .limit(1);

      if (existingPlus && existingPlus.length > 0) {
        alert('Este servidor já possui uma solicitação ou compra de plantão para esta mesma data.');
        setIsSubmitting(false);
        return;
      }

      // 1. Criar ou Atualizar purchase_request (evita erro 409 de unique constraint)
      const { error: reqError } = await supabase
        .from('purchase_requests')
        .upsert([{
          compensatory_day_id: selectedFolga.id,
          establishment_id: profile.establishment_id,
          cycle_id: activeCycle.id,
          employee_id: selectedFolga.employees.id,
          position_id: selectedFolga.employees.positions.id,
          valor: valorTotal,
          valor_historico_id: valorHistoricoId,
          justificativa: justificativa,
          data_plantao: dataPlantao,
          status: 'SOLICITADA',
          requested_by: profile.id,
          analyzed_by: null,
          analyzed_at: null,
          rejection_reason: null,
          cancelled_by: null,
          cancelled_at: null,
          cancellation_reason: null
        }], { onConflict: 'compensatory_day_id' });

      if (reqError) throw reqError;

      // 2. Atualizar folga para INDENIZACAO_SOLICITADA
      const { error: updError } = await supabase
        .from('compensatory_days')
        .update({ status: 'INDENIZACAO_SOLICITADA' })
        .eq('id', selectedFolga.id);

      if (updError) throw updError;

      setIsModalOpen(false);
      fetchData(false); // Recarrega tudo para atualizar saldos e tabelas, sem loading na tela toda
    } catch (err: any) {
      alert(err.message || "Erro ao solicitar compra da folga.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openUsufrutoModal = (folga: any) => {
    setSelectedFolga(folga);
    setDataUsufruto(folga.used_at || '');
    setIsUsufrutoModalOpen(true);
  };

  const handleRegistrarUsufruto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFolga || !dataUsufruto) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('compensatory_days')
        .update({
          status: 'USUFRUIDA',
          used_at: dataUsufruto,
          usage_registered_by: profile?.id
        })
        .eq('id', selectedFolga.id);

      if (error) throw error;

      setIsUsufrutoModalOpen(false);
      fetchData(false);
    } catch (err: any) {
      alert(err.message || "Erro ao registrar usufruto.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDesfazerUsufruto = (folga: any) => {
    setConfirmAction({
      title: 'Excluir Registro de Gozo',
      message: `Tem certeza que deseja excluir o registro de gozo de ${folga.employees?.nome}? A folga voltará para "Folgas Disponíveis para Compra" — o plantão que a gerou não é perdido.`,
      confirmText: 'Sim, Excluir',
      onConfirm: () => {
        setConfirmAction(null);
        executeDesfazerUsufruto(folga);
      }
    });
  };

  const executeDesfazerUsufruto = async (folga: any) => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('compensatory_days')
        .update({
          status: 'GERADA',
          used_at: null,
          usage_registered_by: null
        })
        .eq('id', folga.id);

      if (error) throw error;

      fetchData(false);
    } catch (err: any) {
      alert(err.message || "Erro ao excluir o registro de gozo.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openBulkCompraModal = () => {
    if (selectedFolgas.length === 0) return;
    setSelectedFolga(null);
    setJustificativa('');
    setDataPlantao('');
    setIsModalOpen(true);
  };

  const handleBulkComprarForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedFolgas.length === 0 || !profile || !activeCycle || !dataPlantao) return;
    
    if (dataPlantao > activeCycle.data_fim) {
      alert(`A data do plantão não pode ultrapassar o encerramento do ciclo atual.`);
      return;
    }

    if (justificativa.length < 50) {
      alert("A justificativa precisa ter pelo menos 50 caracteres.");
      return;
    }

    setIsSubmitting(true);
    let erroredCount = 0;
    
    const folgasToBuy = folgasDisponiveis.filter(f => selectedFolgas.includes(f.id));

    for (const folga of folgasToBuy) {
      try {
        const positionId = folga.employees.positions.id;

        // Verificação de duplicidade da data
        const { data: existingPlus } = await supabase
          .from('purchase_requests')
          .select('id')
          .eq('employee_id', folga.employees.id)
          .eq('data_plantao', dataPlantao)
          .neq('status', 'REJEITADA')
          .neq('status', 'CANCELADA')
          .limit(1);

        if (existingPlus && existingPlus.length > 0) {
           console.error(`Servidor ${folga.employees.nome} já possui compra para o dia ${dataPlantao}.`);
           erroredCount++;
           continue;
        }

        const { data: posVal } = await supabase
          .from('position_values')
          .select('id, valor')
          .eq('position_id', positionId)
          .order('vigencia_inicio', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!posVal) throw new Error("Cargo sem valor configurado");

        const valorUnitario = posVal.valor;
        const valorTotalFolga = valorUnitario * folga.quantidade_plantoes;

        const { error: reqError } = await supabase
          .from('purchase_requests')
          .upsert([{
            compensatory_day_id: folga.id,
            establishment_id: profile.establishment_id,
            cycle_id: activeCycle.id,
            employee_id: folga.employees.id,
            position_id: folga.employees.positions.id,
            valor: valorTotalFolga,
            valor_historico_id: posVal.id,
            justificativa: justificativa,
            data_plantao: dataPlantao,
            status: 'SOLICITADA',
            requested_by: profile.id
          }], { onConflict: 'compensatory_day_id' });

        if (reqError) throw reqError;

        const { error: updError } = await supabase
          .from('compensatory_days')
          .update({ status: 'INDENIZACAO_SOLICITADA' })
          .eq('id', folga.id);

        if (updError) throw updError;
      } catch (err) {
        console.error(err);
        erroredCount++;
      }
    }

    setIsSubmitting(false);
    setIsModalOpen(false);
    setSelectedFolgas([]);
    if (erroredCount > 0) {
      alert(`Ocorreu um erro ou bloqueio de duplicidade em ${erroredCount} folga(s). As demais foram solicitadas com sucesso.`);
    }
    fetchData(false);
  };

  const handleCancelRequest = (solicitacao: Solicitacao) => {
    if (solicitacao.status !== 'SOLICITADA' && solicitacao.status !== 'APROVADA') {
      alert('Apenas solicitações aguardando aprovação ou aprovadas podem ser canceladas.');
      return;
    }
    
    setConfirmAction({
      title: 'Cancelar Solicitação',
      message: 'Tem certeza que deseja cancelar? O orçamento será devolvido e a folga voltará a ficar disponível.',
      confirmText: 'Sim, Cancelar',
      onConfirm: () => {
        setConfirmAction(null);
        executeCancelRequest(solicitacao);
      }
    });
  };

  const executeCancelRequest = async (solicitacao: Solicitacao) => {
    try {
      // 1. Atualizar a solicitação para CANCELADA
      const { error: reqError } = await supabase
        .from('purchase_requests')
        .update({ 
          status: 'CANCELADA',
          cancelled_by: profile?.id,
          cancelled_at: new Date().toISOString(),
          cancellation_reason: 'Cancelado pela unidade'
        })
        .eq('id', solicitacao.id);

      if (reqError) throw reqError;

      // 2. Voltar a folga compensatória para GERADA
      // Precisamos do compensatory_day_id. Como a query original não trouxe o ID, vamos buscar.
      const { data: reqData } = await supabase.from('purchase_requests').select('compensatory_day_id').eq('id', solicitacao.id).single();
      
      if (reqData && reqData.compensatory_day_id) {
        const { error: updError } = await supabase
          .from('compensatory_days')
          .update({ status: 'GERADA' })
          .eq('id', reqData.compensatory_day_id);
          
        if (updError) throw updError;
      }

      fetchData(false); // Recarrega tudo
    } catch (err: any) {
      alert(err.message || "Erro ao cancelar solicitação.");
    }
  };

  const handleBulkApprove = () => {
    if (selectedRequests.length === 0) return;
    setConfirmAction({
      title: 'Aprovar Solicitações',
      message: `Tem certeza que deseja APROVAR as ${selectedRequests.length} solicitações selecionadas? O valor será debitado do orçamento permanentemente.`,
      confirmText: 'Sim, Aprovar',
      onConfirm: () => {
        setConfirmAction(null);
        executeBulkApprove();
      }
    });
  };

  const executeBulkApprove = async () => {
    setIsSubmitting(true);
    let errorCount = 0;
    
    for (const id of selectedRequests) {
      try {
        const { error: reqError } = await supabase
          .from('purchase_requests')
          .update({ 
            status: 'APROVADA',
            analyzed_by: profile?.id,
            analyzed_at: new Date().toISOString()
          })
          .eq('id', id);
  
        if (reqError) throw reqError;
  
        const { data: reqData } = await supabase.from('purchase_requests').select('compensatory_day_id').eq('id', id).single();
        if (reqData && reqData.compensatory_day_id) {
          const { error: updError } = await supabase
            .from('compensatory_days')
            .update({ status: 'INDENIZADA', decided_by: profile?.id, decided_at: new Date().toISOString() })
            .eq('id', reqData.compensatory_day_id);
          if (updError) throw updError;
        }
      } catch (err: any) {
        if (err.message?.includes('ORCAMENTO_EXCEDIDO')) {
          alert(err.message.replace('ORCAMENTO_EXCEDIDO: ', '🚫 BLOQUEIO DO SISTEMA (Orçamento Excedido):\n\n') + `\n\n(Parando a aprovação em lote nas demais solicitações)`);
          break; // Stop bulk processing if budget exceeded
        } else {
          console.error(err);
          errorCount++;
        }
      }
    }
    
    if (errorCount > 0) {
      alert(`Houve erro ao aprovar ${errorCount} solicitação(ões). As demais foram processadas.`);
    }
    
    setSelectedRequests([]);
    setIsSubmitting(false);
    fetchData(false);
  };

  const handleApproveRequest = (solicitacao: Solicitacao) => {
    setConfirmAction({
      title: 'Aprovar Compra',
      message: 'Tem certeza que deseja APROVAR esta compra? O valor será debitado do orçamento permanentemente.',
      confirmText: 'Sim, Aprovar',
      onConfirm: () => {
        setConfirmAction(null);
        executeApproveRequest(solicitacao);
      }
    });
  };

  const executeApproveRequest = async (solicitacao: Solicitacao) => {
    try {
      const { error: reqError } = await supabase
        .from('purchase_requests')
        .update({ 
          status: 'APROVADA',
          analyzed_by: profile?.id,
          analyzed_at: new Date().toISOString()
        })
        .eq('id', solicitacao.id);

      if (reqError) throw reqError;

      const { data: reqData } = await supabase.from('purchase_requests').select('compensatory_day_id').eq('id', solicitacao.id).single();
      if (reqData && reqData.compensatory_day_id) {
        const { error: updError } = await supabase
          .from('compensatory_days')
          .update({ status: 'INDENIZADA', decided_by: profile?.id, decided_at: new Date().toISOString() })
          .eq('id', reqData.compensatory_day_id);
        if (updError) throw updError;
      }
      fetchData(false);
    } catch (err: any) {
      if (err.message?.includes('ORCAMENTO_EXCEDIDO')) {
        alert(err.message.replace('ORCAMENTO_EXCEDIDO: ', '🚫 BLOQUEIO DO SISTEMA:\n\n'));
      } else {
        alert(err.message || "Erro ao aprovar.");
      }
    }
  };

  const handleRejectRequest = async (solicitacao: Solicitacao) => {
    const reason = window.prompt('Qual o motivo da rejeição? (O orçamento será devolvido e a folga voltará a ficar disponível)');
    if (!reason) return; // cancelou o prompt

    try {
      const { error: reqError } = await supabase
        .from('purchase_requests')
        .update({ 
          status: 'REJEITADA',
          analyzed_by: profile?.id,
          analyzed_at: new Date().toISOString(),
          rejection_reason: reason
        })
        .eq('id', solicitacao.id);

      if (reqError) throw reqError;

      const { data: reqData } = await supabase.from('purchase_requests').select('compensatory_day_id').eq('id', solicitacao.id).single();
      if (reqData && reqData.compensatory_day_id) {
        const { error: updError } = await supabase
          .from('compensatory_days')
          .update({ status: 'GERADA', decided_by: profile?.id, decided_at: new Date().toISOString() })
          .eq('id', reqData.compensatory_day_id);
        if (updError) throw updError;
      }
      fetchData(false);
    } catch (err: any) {
      alert(err.message || "Erro ao rejeitar.");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SOLICITADA': return <span className="tag" style={{ background: '#d97706', color: 'white' }}>AGUARDANDO APROVAÇÃO</span>;
      case 'APROVADA': return <span className="tag" style={{ background: '#059669', color: 'white' }}>APROVADA (INDENIZADA)</span>;
      case 'REJEITADA': return <span className="tag" style={{ background: '#dc2626', color: 'white' }}>REJEITADA</span>;
      default: return <span className="tag">{status}</span>;
    }
  };
  const sortedSolicitacoes = React.useMemo(() => {
    if (!sortColumnSol) return solicitacoes;
    const sorted = [...solicitacoes].sort((a, b) => {
      if (sortColumnSol === 'servidor') {
        return (a.employees?.nome || '').localeCompare(b.employees?.nome || '', 'pt-BR');
      }
      if (sortColumnSol === 'tipo') {
        const valA = a.tipo_solicitacao === 'PLANTAO_PLUS' ? 'Plantão Plus' : 'Folga';
        const valB = b.tipo_solicitacao === 'PLANTAO_PLUS' ? 'Plantão Plus' : 'Folga';
        return valA.localeCompare(valB, 'pt-BR');
      }
      if (sortColumnSol === 'data_plantao') {
        return (a.data_plantao || '').localeCompare(b.data_plantao || '');
      }
      if (sortColumnSol === 'valor') {
        return (a.valor || 0) - (b.valor || 0);
      }
      if (sortColumnSol === 'status') {
        return (a.status || '').localeCompare(b.status || '', 'pt-BR');
      }
      return 0;
    });
    return sortDirectionSol === 'asc' ? sorted : sorted.reverse();
  }, [solicitacoes, sortColumnSol, sortDirectionSol]);

  const sortedFolgasUsufruidas = React.useMemo(() => {
    if (!sortColumnUsufruida) return folgasUsufruidas;
    const sorted = [...folgasUsufruidas].sort((a, b) => {
      if (sortColumnUsufruida === 'servidor') {
        return (a.employees?.nome || '').localeCompare(b.employees?.nome || '', 'pt-BR');
      }
      if (sortColumnUsufruida === 'data_usufruto') {
        return (a.used_at || '').localeCompare(b.used_at || '');
      }
      return 0;
    });
    return sortDirectionUsufruida === 'asc' ? sorted : sorted.reverse();
  }, [folgasUsufruidas, sortColumnUsufruida, sortDirectionUsufruida]);

  const totalPagesSolicitacoes = Math.ceil(sortedSolicitacoes.length / ITEMS_PER_PAGE);
  const paginatedSolicitacoes = React.useMemo(() => {
    return sortedSolicitacoes.slice((currentPageSolicitacoes - 1) * ITEMS_PER_PAGE, currentPageSolicitacoes * ITEMS_PER_PAGE);
  }, [sortedSolicitacoes, currentPageSolicitacoes]);

  const handleSortSol = (column: SortColumnSol) => {
    if (sortColumnSol === column) {
      setSortDirectionSol(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumnSol(column);
      setSortDirectionSol('asc');
    }
  };

  const renderSortableHeaderSol = (column: SortColumnSol, label: string, align: 'left' | 'right' | 'center' = 'left') => {
    const isActive = sortColumnSol === column;
    const Icon = isActive ? (sortDirectionSol === 'asc' ? ChevronUp : ChevronDown) : ChevronsUpDown;
    return (
      <th
        style={{ padding: 'var(--space-3)', textAlign: align, cursor: 'pointer', userSelect: 'none' }}
        onClick={() => handleSortSol(column)}
        aria-sort={isActive ? (sortDirectionSol === 'asc' ? 'ascending' : 'descending') : 'none'}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', justifyContent: align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start' }}>
          {label}
          <Icon size={14} aria-hidden="true" style={{ opacity: isActive ? 1 : 0.35, flexShrink: 0 }} />
        </span>
      </th>
    );
  };

  const handleSortUsufruida = (column: SortColumnUsufruida) => {
    if (sortColumnUsufruida === column) {
      setSortDirectionUsufruida(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumnUsufruida(column);
      setSortDirectionUsufruida('asc');
    }
  };

  const renderSortableHeaderUsufruida = (column: SortColumnUsufruida, label: string, align: 'left' | 'right' | 'center' = 'left') => {
    const isActive = sortColumnUsufruida === column;
    const Icon = isActive ? (sortDirectionUsufruida === 'asc' ? ChevronUp : ChevronDown) : ChevronsUpDown;
    return (
      <th
        style={{ padding: 'var(--space-3)', textAlign: align, cursor: 'pointer', userSelect: 'none' }}
        onClick={() => handleSortUsufruida(column)}
        aria-sort={isActive ? (sortDirectionUsufruida === 'asc' ? 'ascending' : 'descending') : 'none'}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', justifyContent: align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start' }}>
          {label}
          <Icon size={14} aria-hidden="true" style={{ opacity: isActive ? 1 : 0.35, flexShrink: 0 }} />
        </span>
      </th>
    );
  };

  if (loading) return <div>Carregando...</div>;

  if (!activeCycle) {
    return (
      <div className="blueprint card" style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: 'var(--space-4)' }}>🔒</div>
        <h3>Ciclo Fechado</h3>
        <p className="text-muted">Não é possível realizar compras de folgas no momento.</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <h2 style={{ margin: 0 }}>Comprar Folgas</h2>
        <p className="text-muted" style={{ margin: 0 }}>
          Selecione os plantões gerados e envie solicitações de compra para a Secretaria.
        </p>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-6)' }}>
        {/* Lado Esquerdo: Saldo e Folgas Disponíveis */}
        <div style={{ flex: '1 1 300px', minWidth: 0 }}>
          <div className="blueprint card elev-sm" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-4)', background: 'var(--color-surface)' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
               <div style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>Total Orçado</div>
               <div style={{ fontWeight: 600 }}>R$ {totalOrcado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
             </div>
             <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
               <div style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>Total Aprovado (Gasto)</div>
               <div style={{ fontWeight: 600 }}>R$ {totalGasto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
             </div>
             <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', borderBottom: '1px solid var(--color-divider)', paddingBottom: '8px' }}>
               <div style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>Aguardando Aprovação</div>
               <div style={{ fontWeight: 600, color: '#f59e0b' }}>R$ {totalEmpenhado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
             </div>
             <h4 style={{ margin: '0 0 var(--space-2) 0' }}>Orçamento Disponível</h4>
             <div style={{ fontSize: '24px', fontWeight: 700, color: orcamentoDisponivel > 0 ? '#10b981' : '#ef4444' }}>
               R$ {orcamentoDisponivel.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
             </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
            <h3 style={{ margin: 0 }}>Folgas Disponíveis para Compra ou Gozo</h3>
            {selectedFolgas.length > 0 && (
              <button 
                className="btn btn-primary" 
                onClick={openBulkCompraModal} 
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Solicitando...' : `Solicitar Selecionadas (${selectedFolgas.length})`}
              </button>
            )}
          </div>
          
          {(() => {
            const cargosFolga = Array.from(
              new Map(folgasDisponiveis.map(f => [f.employees.positions.id, f.employees.positions])).values()
            ).sort((a, b) => a.nome.localeCompare(b.nome));

            const folgasFiltradas = folgasDisponiveis
              .filter(f => 
                ((f.employees.nome || '').toLowerCase().includes(buscaFolga.toLowerCase()) ||
                (f.employees.matricula || '').includes(buscaFolga)) &&
                (filtroCargoFolga === '' || f.employees.positions.id === filtroCargoFolga)
              )
              .sort((a, b) => (a.employees.nome || '').localeCompare(b.employees.nome || ''));

            const totalPagesFolgas = Math.ceil(folgasFiltradas.length / ITEMS_PER_PAGE);
            const paginatedFolgas = folgasFiltradas.slice((currentPageFolgas - 1) * ITEMS_PER_PAGE, currentPageFolgas * ITEMS_PER_PAGE);

            return (
              <>
                {folgasDisponiveis.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '16px', alignItems: 'center' }}>
                    <div style={{ marginRight: '8px', display: 'flex', alignItems: 'center' }}>
                      <input 
                        type="checkbox"
                        checked={paginatedFolgas.length > 0 && selectedFolgas.length >= paginatedFolgas.length && paginatedFolgas.every(f => selectedFolgas.includes(f.id))}
                        onChange={(e) => {
                          if (e.target.checked) {
                            const newSelection = [...selectedFolgas];
                            paginatedFolgas.forEach(f => {
                              if (!newSelection.includes(f.id)) newSelection.push(f.id);
                            });
                            setSelectedFolgas(newSelection);
                          } else {
                            setSelectedFolgas(selectedFolgas.filter(id => !paginatedFolgas.some(f => f.id === id)));
                          }
                        }}
                        title="Selecionar folgas desta página"
                      />
                    </div>
                    <input
                      type="text"
                      className="input"
                      placeholder="🔍 Buscar por nome ou matrícula..."
                      value={buscaFolga}
                      onChange={e => setBuscaFolga(e.target.value)}
                      style={{ flex: 1 }}
                    />
                    <select
                      className="input"
                      style={{ flex: '1 1 150px', minWidth: '150px' }}
                      value={filtroCargoFolga}
                      onChange={e => setFiltroCargoFolga(e.target.value)}
                    >
                      <option value="">Todos os cargos</option>
                      {cargosFolga.map(c => (
                        <option key={c.id} value={c.id}>{c.nome}</option>
                      ))}
                    </select>
                  </div>
                )}

                {folgasDisponiveis.length === 0 ? (
                  <div className="blueprint card" style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                    Nenhuma folga nova gerada neste ciclo. Vá na tela de "Banco de Folgas" para lançar os plantões.
                  </div>
                ) : folgasFiltradas.length === 0 ? (
                  <div className="blueprint card" style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                    Nenhuma folga encontrada para os filtros aplicados.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                    {paginatedFolgas.map(f => (
                  <div key={f.id} className="blueprint card" style={{ padding: 'var(--space-3)', border: selectedFolgas.includes(f.id) ? '1px solid var(--color-primary)' : '' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <input 
                          type="checkbox" 
                          checked={selectedFolgas.includes(f.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedFolgas(prev => [...prev, f.id]);
                            } else {
                              setSelectedFolgas(prev => prev.filter(id => id !== f.id));
                            }
                          }}
                        />
                        <div>
                          <strong>{f.employees.nome} ({f.employees.matricula})</strong>
                          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                            {f.employees.positions.nome} | {f.quantidade_plantoes} plantões
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                        <strong style={{ color: 'var(--color-text)', fontSize: '15px' }}>
                          R$ {((positionValues[f.employees.positions.id] || 0) * f.quantidade_plantoes).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </strong>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button className="btn btn-primary" style={{ padding: '4px 12px', fontSize: '12px' }} onClick={() => openCompraModal(f)}>
                            Comprar Folga
                          </button>
                          <button className="btn" style={{ padding: '4px 12px', fontSize: '12px', background: 'var(--color-surface)', border: '1px solid var(--color-divider)' }} onClick={() => openUsufrutoModal(f)}>
                            Registrar Gozo
                          </button>
                        </div>
                      </div>
                    </div>
                 </div>
                    ))}

                    {totalPagesFolgas > 1 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-3) 0', borderTop: '1px solid var(--color-divider)' }}>
                        <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                          Mostrando {(currentPageFolgas - 1) * ITEMS_PER_PAGE + 1} até {Math.min(currentPageFolgas * ITEMS_PER_PAGE, folgasFiltradas.length)} de {folgasFiltradas.length} folgas
                        </span>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: '12px' }} disabled={currentPageFolgas === 1} onClick={() => setCurrentPageFolgas(p => p - 1)}>
                            Anterior
                          </button>
                          <button className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: '12px' }} disabled={currentPageFolgas === totalPagesFolgas} onClick={() => setCurrentPageFolgas(p => p + 1)}>
                            Próxima
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            );
          })()}


        </div>

            <div style={{ flex: '2 1 500px', minWidth: 0 }}>
          <div style={{ display: 'flex', gap: '16px', marginBottom: 'var(--space-4)', borderBottom: '1px solid var(--color-divider)' }}>
            <button 
              style={{ background: 'none', border: 'none', padding: '8px 16px', fontSize: '15px', fontWeight: 600, color: activeRightTab === 'FINANCEIRO' ? 'var(--color-primary)' : 'var(--color-text-muted)', borderBottom: activeRightTab === 'FINANCEIRO' ? '2px solid var(--color-primary)' : '2px solid transparent', cursor: 'pointer' }}
              onClick={() => setActiveRightTab('FINANCEIRO')}
            >
              Solicitações do Ciclo
            </button>
            <button 
              style={{ background: 'none', border: 'none', padding: '8px 16px', fontSize: '15px', fontWeight: 600, color: activeRightTab === 'USUFRUIDAS' ? 'var(--color-primary)' : 'var(--color-text-muted)', borderBottom: activeRightTab === 'USUFRUIDAS' ? '2px solid var(--color-primary)' : '2px solid transparent', cursor: 'pointer' }}
              onClick={() => setActiveRightTab('USUFRUIDAS')}
            >
              Folgas Usufruídas ({folgasUsufruidas.length})
            </button>
          </div>

          {activeRightTab === 'FINANCEIRO' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                <h3 style={{ margin: 0, visibility: 'hidden' }}>Solicitações do Ciclo</h3>
                {selectedRequests.length > 0 && (
                  <button 
                    className="btn btn-primary" 
                    onClick={handleBulkApprove} 
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Aprovando...' : `Aprovar Selecionadas (${selectedRequests.length})`}
                  </button>
                )}
              </div>
              <div style={{ marginBottom: 'var(--space-4)', padding: '12px 16px', background: '#fffbeb', borderLeft: '4px solid #f59e0b', borderRadius: '4px', color: '#92400e', fontSize: '13px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '2px' }}>
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
              <path d="M12 9v4" />
              <path d="M12 17h.01" />
            </svg>
            <div>
              <strong style={{ display: 'block', marginBottom: '4px', fontSize: '14px' }}>Atenção aos Pagamentos</strong>
              Apenas as solicitações com status de <strong>"Aprovada"</strong> serão processadas para pagamento na folha. Compete à <strong>Direção do Estabelecimento Penal</strong> realizar essa aprovação das pendências na tabela abaixo.
            </div>
          </div>
          <div className="blueprint card elev-sm" style={{ overflowX: 'auto' }}>
            <table className="responsive-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-divider)' }}>
                  <th style={{ padding: 'var(--space-3)', width: '40px' }}>
                    <input 
                      type="checkbox" 
                      checked={solicitacoes.filter(s => s.status === 'SOLICITADA').length > 0 && selectedRequests.length === solicitacoes.filter(s => s.status === 'SOLICITADA').length}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedRequests(solicitacoes.filter(s => s.status === 'SOLICITADA').map(s => s.id));
                        } else {
                          setSelectedRequests([]);
                        }
                      }}
                    />
                  </th>
                  {renderSortableHeaderSol('servidor', 'Servidor', 'left')}
                  {renderSortableHeaderSol('tipo', 'Tipo / Qtd.', 'left')}
                  {renderSortableHeaderSol('data_plantao', 'Data do Plantão', 'left')}
                  {renderSortableHeaderSol('valor', 'Valor Solicitado', 'left')}
                  {renderSortableHeaderSol('status', 'Status', 'left')}
                  <th style={{ padding: 'var(--space-3)', textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {solicitacoes.length === 0 ? (
                  <tr>
                    <td colSpan={7} data-label="" style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                      Nenhuma solicitação de compra feita neste ciclo.
                    </td>
                  </tr>
                ) : paginatedSolicitacoes.map(sol => (
                  <tr key={sol.id} style={{ borderBottom: '1px solid var(--color-divider)' }}>
                    <td data-label="" style={{ padding: 'var(--space-3)' }}>
                      {sol.status === 'SOLICITADA' && (
                        <input 
                          type="checkbox" 
                          checked={selectedRequests.includes(sol.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedRequests(prev => [...prev, sol.id]);
                            } else {
                              setSelectedRequests(prev => prev.filter(id => id !== sol.id));
                            }
                          }}
                        />
                      )}
                    </td>
                    <td data-label="Servidor" style={{ padding: 'var(--space-3)' }}>
                      <div style={{ fontWeight: 500 }}>{sol.employees?.nome} ({sol.employees?.matricula})</div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{sol.employees?.positions?.nome}</div>
                    </td>
                    <td data-label="Tipo / Qtd." style={{ padding: 'var(--space-3)' }}>
                      {sol.tipo_solicitacao === 'PLANTAO_PLUS' ? (
                        <span style={{ fontSize: '11px', background: 'var(--color-primary)', color: 'white', padding: '2px 6px', borderRadius: '4px' }}>
                          Plantão Plus
                        </span>
                      ) : (
                        <span>{sol.compensatory_days?.quantidade_plantoes + ' folga(s)'}</span>
                      )}
                    </td>
                    <td data-label="Data do Plantão" style={{ padding: 'var(--space-3)', color: 'var(--color-text-muted)', fontSize: '13px' }}>
                      {sol.data_plantao ? new Date(sol.data_plantao + 'T12:00:00Z').toLocaleDateString('pt-BR') : '—'}
                    </td>
                    <td data-label="Valor" style={{ padding: 'var(--space-3)', fontWeight: 600 }}>R$ {Number(sol.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    <td data-label="Status" style={{ padding: 'var(--space-3)' }}>{getStatusBadge(sol.status)}</td>
                    <td data-label="Ações" style={{ padding: 'var(--space-3)', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                        {sol.status === 'SOLICITADA' && (
                          <>
                            <button className="btn btn-primary" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={() => handleApproveRequest(sol)}>
                              ✔️ Aprovar
                            </button>
                            <button className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: '11px', color: 'var(--color-danger)' }} onClick={() => handleRejectRequest(sol)}>
                              ❌ Rejeitar
                            </button>
                          </>
                        )}
                        {(sol.status === 'SOLICITADA' || sol.status === 'APROVADA') && (
                          <button className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={() => handleCancelRequest(sol)} title="Cancelar Solicitação/Compra">
                            🗑️
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {totalPagesSolicitacoes > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-3) var(--space-4)', borderTop: '1px solid var(--color-divider)' }}>
                <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                  Mostrando {(currentPageSolicitacoes - 1) * ITEMS_PER_PAGE + 1} até {Math.min(currentPageSolicitacoes * ITEMS_PER_PAGE, solicitacoes.length)} de {solicitacoes.length} solicitações
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: '12px' }} disabled={currentPageSolicitacoes === 1} onClick={() => setCurrentPageSolicitacoes(p => p - 1)}>
                    Anterior
                  </button>
                  <button className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: '12px' }} disabled={currentPageSolicitacoes === totalPagesSolicitacoes} onClick={() => setCurrentPageSolicitacoes(p => p + 1)}>
                    Próxima
                  </button>
                </div>
              </div>
            )}
          </div>
            </>
          )}

          {activeRightTab === 'USUFRUIDAS' && (
            <div className="blueprint card elev-sm" style={{ padding: 0, background: 'var(--color-surface)', overflowX: 'auto' }}>
              <table className="responsive-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-divider)' }}>
                    {renderSortableHeaderUsufruida('servidor', 'Servidor', 'left')}
                    {renderSortableHeaderUsufruida('data_usufruto', 'Data de Usufruto', 'left')}
                    <th style={{ padding: 'var(--space-3)', textAlign: 'right' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedFolgasUsufruidas.length === 0 ? (
                    <tr>
                      <td colSpan={3} style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                        Nenhuma folga usufruída registrada neste ciclo.
                      </td>
                    </tr>
                  ) : sortedFolgasUsufruidas.map(f => (
                    <tr key={f.id} style={{ borderBottom: '1px solid var(--color-divider)' }}>
                      <td style={{ padding: 'var(--space-3)' }}>
                        <div style={{ fontWeight: 500 }}>{f.employees?.nome} ({f.employees?.matricula})</div>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{f.employees?.positions?.nome}</div>
                      </td>
                      <td style={{ padding: 'var(--space-3)' }}>
                        <span style={{ background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: '12px', fontWeight: 600, fontSize: '11px', display: 'inline-block', marginBottom: '4px' }}>
                          Usufruída
                        </span>
                        <div style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>
                          Em: {f.used_at ? new Date(f.used_at + 'T12:00:00Z').toLocaleDateString('pt-BR') : '--'}
                        </div>
                      </td>
                      <td style={{ padding: 'var(--space-3)', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            className="btn"
                            style={{ padding: '4px 10px', fontSize: '11px', background: 'var(--color-surface)', border: '1px solid var(--color-divider)' }}
                            onClick={() => openUsufrutoModal(f)}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className="btn"
                            style={{ padding: '4px 10px', fontSize: '11px', background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' }}
                            onClick={() => handleDesfazerUsufruto(f)}
                          >
                            Excluir
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Compra */}
      {isModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="blueprint card elev-md" style={{ width: '500px', padding: 'var(--space-6)', background: 'var(--color-surface)' }}>
            <h3 style={{ marginTop: 0, marginBottom: 'var(--space-4)' }}>Solicitar Compra de Folga</h3>
            
            {selectedFolga ? (
              <div style={{ background: 'var(--color-bg)', padding: 'var(--space-3)', borderRadius: '4px', marginBottom: 'var(--space-4)' }}>
                <div><strong>Servidor:</strong> {selectedFolga.employees.nome}</div>
                <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Quantidade: <strong>{selectedFolga.quantidade_plantoes}</strong></span>
                  <span>Valor Base: <strong>R$ {valorUnitario.toFixed(2)}</strong></span>
                </div>
                <hr style={{ borderTop: '1px dashed var(--color-divider)', margin: '12px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: 'bold' }}>
                  <span>Valor Total Solicitado:</span>
                  <span style={{ color: 'var(--color-primary)' }}>
                    R$ {(valorUnitario * selectedFolga.quantidade_plantoes).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            ) : (
              <div style={{ background: 'var(--color-bg)', padding: 'var(--space-3)', borderRadius: '4px', marginBottom: 'var(--space-4)' }}>
                <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '8px' }}>Solicitação em Lote</div>
                <div><strong>Folgas Selecionadas:</strong> {selectedFolgas.length}</div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                  O mesmo motivo e data de plantão serão aplicados para todas as folgas.
                </div>
              </div>
            )}

            <form onSubmit={selectedFolga ? handleComprar : handleBulkComprarForm}>
              <div className="field" style={{ marginBottom: 'var(--space-4)' }}>
                <label>Informe a data efetiva em que o servidor prestou o plantão que está sendo comprado. *</label>
                <input 
                  type="date"
                  className="input"
                  required
                  value={dataPlantao}
                  onChange={e => setDataPlantao(e.target.value)}
                  max={activeCycle.data_fim}
                />
              </div>

              <div className="field" style={{ marginBottom: 'var(--space-4)' }}>
                <label>Justificativa Administrativa (Mínimo 50 caracteres) *</label>
                <textarea 
                  className="input" 
                  value={justificativa} 
                  onChange={(e) => setJustificativa(e.target.value)} 
                  rows={4}
                  minLength={50}
                  maxLength={2000}
                  required
                  placeholder="Explique a necessidade operacional que motivou a compra desta folga..."
                />
                <div style={{ fontSize: '11px', color: justificativa.length < 50 ? 'var(--color-danger)' : 'var(--color-text-muted)', marginTop: '4px', textAlign: 'right' }}>
                  {justificativa.length} / 2000
                </div>
              </div>

              <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                <button 
                  type="submit" 
                  className="btn btn-primary blueprint" 
                  disabled={isSubmitting || justificativa.length < 50}
                >
                  <i className="corner tl"></i><i className="corner tr"></i><i className="corner bl"></i><i className="corner br"></i>
                  {isSubmitting ? 'Enviando...' : 'Confirmar Solicitação'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmação Genérico */}
      {confirmAction && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="blueprint card elev-md" style={{ width: '400px', padding: 'var(--space-6)', background: 'var(--color-surface)' }}>
            <h3 style={{ marginTop: 0, marginBottom: 'var(--space-4)' }}>{confirmAction.title}</h3>
            <p style={{ color: 'var(--color-text)', marginBottom: 'var(--space-5)', lineHeight: 1.5 }}>
              {confirmAction.message}
            </p>
            <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setConfirmAction(null)}>Cancelar</button>
              <button 
                className="btn btn-primary blueprint" 
                onClick={confirmAction.onConfirm}
              >
                <i className="corner tl"></i><i className="corner tr"></i><i className="corner bl"></i><i className="corner br"></i>
                {confirmAction.confirmText || 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Usufruto */}
      {isUsufrutoModalOpen && selectedFolga && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="blueprint card elev-md" style={{ width: '400px', padding: 'var(--space-6)', background: 'var(--color-surface)' }}>
            <h3 style={{ marginTop: 0, marginBottom: 'var(--space-4)' }}>{selectedFolga.status === 'USUFRUIDA' ? 'Editar Gozo' : 'Registrar Gozo'}</h3>
            
            <div style={{ background: 'var(--color-bg)', padding: 'var(--space-3)', borderRadius: '4px', marginBottom: 'var(--space-4)' }}>
              <div><strong>Servidor:</strong> {selectedFolga.employees?.nome}</div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                O registro de gozo baixa a folga do sistema sem gerar solicitação financeira.
              </div>
            </div>

            <div style={{ marginBottom: 'var(--space-4)', padding: '12px', background: '#fffbeb', borderLeft: '4px solid #f59e0b', borderRadius: '4px', color: '#92400e', fontSize: '12px' }}>
              <strong>⚠️ Responsabilidade da Direção</strong><br/>
              Ao confirmar o gozo, a direção atesta e garante que esta mesma folga foi ou será devidamente registrada no <strong>Sistema de Ponto Eletrônico</strong> do servidor.
            </div>

            <form onSubmit={handleRegistrarUsufruto}>
              <div className="field" style={{ marginBottom: 'var(--space-4)' }}>
                <label>Data de Descanso do Servidor *</label>
                <input 
                  type="date"
                  className="input"
                  required
                  value={dataUsufruto}
                  onChange={e => setDataUsufruto(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setIsUsufrutoModalOpen(false)} disabled={isSubmitting}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Salvando...' : (selectedFolga.status === 'USUFRUIDA' ? 'Salvar Alteração' : 'Confirmar Gozo')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

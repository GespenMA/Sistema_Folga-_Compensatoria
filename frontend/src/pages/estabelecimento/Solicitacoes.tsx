import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

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
  compensatory_days: {
    periodo_inicio: string;
    periodo_fim: string;
    quantidade_plantoes: number;
  };
  employees: {
    nome: string;
    matricula: string;
    positions: { codigo: string };
  };
};

export const Solicitacoes: React.FC = () => {
  const { profile } = useAuth();
  const [activeCycle, setActiveCycle] = useState<any>(null);
  const [folgasDisponiveis, setFolgasDisponiveis] = useState<FolgaDisponivel[]>([]);
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal de Compra
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedFolga, setSelectedFolga] = useState<FolgaDisponivel | null>(null);
  const [justificativa, setJustificativa] = useState('');
  const [valorUnitario, setValorUnitario] = useState(0);
  const [valorHistoricoId, setValorHistoricoId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Status de Limite
  const [totalOrcado, setTotalOrcado] = useState(0);
  const [totalGasto, setTotalGasto] = useState(0);
  const [orcamentoDisponivel, setOrcamentoDisponivel] = useState(0);

  useEffect(() => {
    if (profile?.establishment_id) {
      fetchData();
    }
  }, [profile]);

  const fetchData = async () => {
    setLoading(true);
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

        // 3. Busca solicitações já feitas no ciclo (PENDENTE, APROVADA, REJEITADA)
        const { data: sols } = await supabase
          .from('purchase_requests')
          .select(`
            id, valor, status, justificativa, requested_at,
            compensatory_days (periodo_inicio, periodo_fim, quantidade_plantoes),
            employees (nome, matricula, positions(codigo))
          `)
          .eq('cycle_id', cycleData.id)
          .eq('establishment_id', profile!.establishment_id)
          .order('requested_at', { ascending: false });
          
        if (sols) setSolicitacoes(sols as unknown as Solicitacao[]);

        // 4. Calcular saldo do orçamento disponível
        const { data: ceData } = await supabase
          .from('cycle_establishments')
          .select('total_orcado')
          .eq('cycle_id', cycleData.id)
          .eq('establishment_id', profile!.establishment_id)
          .maybeSingle();

        const orcado = ceData?.total_orcado || 0;
        const consumido = (sols || [])
          .filter(s => s.status !== 'REJEITADA' && s.status !== 'CANCELADA')
          .reduce((acc, curr) => acc + Number(curr.valor), 0);
          
        setTotalOrcado(orcado);
        setTotalGasto(consumido);
        setOrcamentoDisponivel(orcado - consumido);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const openCompraModal = async (folga: FolgaDisponivel) => {
    setSelectedFolga(folga);
    setJustificativa('');
    
    // Buscar o valor atual do cargo para calcular
    const positionId = folga.employees.positions.id;
    const { data: posVal } = await supabase
      .from('position_values')
      .select('id, valor')
      .eq('position_id', positionId)
      .order('vigencia_inicio', { ascending: false })
      .limit(1)
      .maybeSingle();
      
    if (posVal) {
      setValorUnitario(posVal.valor);
      setValorHistoricoId(posVal.id);
    } else {
      alert("Erro: O cargo deste servidor não possui valor configurado. Entre em contato com o gestor.");
      return;
    }

    setIsModalOpen(true);
  };

  const handleComprar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFolga || !profile || !activeCycle) return;
    
    const valorTotal = valorUnitario * selectedFolga.quantidade_plantoes;

    // Trava de orçamento frontend
    if (valorTotal > orcamentoDisponivel) {
      alert(`Orçamento insuficiente! O valor solicitado (R$ ${valorTotal.toFixed(2)}) ultrapassa o saldo disponível (R$ ${orcamentoDisponivel.toFixed(2)}).`);
      return;
    }

    setIsSubmitting(true);
    try {
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

      // 2. Atualizar folga para AGUARDANDO_DECISAO
      const { error: updError } = await supabase
        .from('compensatory_days')
        .update({ status: 'AGUARDANDO_DECISAO' })
        .eq('id', selectedFolga.id);

      if (updError) throw updError;

      setIsModalOpen(false);
      fetchData(); // Recarrega tudo para atualizar saldos e tabelas
    } catch (err: any) {
      alert(err.message || "Erro ao solicitar compra da folga.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelRequest = async (solicitacao: Solicitacao) => {
    if (solicitacao.status !== 'SOLICITADA' && solicitacao.status !== 'APROVADA') {
      alert('Apenas solicitações aguardando aprovação ou aprovadas podem ser canceladas.');
      return;
    }
    
    if (!window.confirm('Tem certeza que deseja cancelar? O orçamento será devolvido e a folga voltará a ficar disponível.')) return;
    
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
      
      if (reqData) {
        const { error: updError } = await supabase
          .from('compensatory_days')
          .update({ status: 'GERADA' })
          .eq('id', reqData.compensatory_day_id);
          
        if (updError) throw updError;
      }

      fetchData(); // Recarrega tudo
    } catch (err: any) {
      alert(err.message || "Erro ao cancelar solicitação.");
    }
  };

  const handleApproveRequest = async (solicitacao: Solicitacao) => {
    if (!window.confirm('Tem certeza que deseja APROVAR esta compra? O valor será debitado do orçamento permanentemente.')) return;
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
      if (reqData) {
        const { error: updError } = await supabase
          .from('compensatory_days')
          .update({ status: 'COMPRADA', decided_by: profile?.id, decided_at: new Date().toISOString() })
          .eq('id', reqData.compensatory_day_id);
        if (updError) throw updError;
      }
      fetchData();
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
      if (reqData) {
        const { error: updError } = await supabase
          .from('compensatory_days')
          .update({ status: 'GERADA', decided_by: profile?.id, decided_at: new Date().toISOString() })
          .eq('id', reqData.compensatory_day_id);
        if (updError) throw updError;
      }
      fetchData();
    } catch (err: any) {
      alert(err.message || "Erro ao rejeitar.");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SOLICITADA': return <span className="tag" style={{ background: '#d97706', color: 'white' }}>AGUARDANDO APROVAÇÃO</span>;
      case 'APROVADA': return <span className="tag" style={{ background: '#059669', color: 'white' }}>APROVADA (COMPRADA)</span>;
      case 'REJEITADA': return <span className="tag" style={{ background: '#dc2626', color: 'white' }}>REJEITADA</span>;
      default: return <span className="tag">{status}</span>;
    }
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 'var(--space-6)' }}>
        {/* Lado Esquerdo: Saldo e Folgas Disponíveis */}
        <div>
          <div className="blueprint card elev-sm" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-4)', background: 'var(--color-surface)' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
               <div style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>Total Orçado</div>
               <div style={{ fontWeight: 600 }}>R$ {totalOrcado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
             </div>
             <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', borderBottom: '1px solid var(--color-divider)', paddingBottom: '8px' }}>
               <div style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>Total Gasto</div>
               <div style={{ fontWeight: 600 }}>R$ {totalGasto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
             </div>
             <h4 style={{ margin: '0 0 var(--space-2) 0' }}>Orçamento Disponível</h4>
             <div style={{ fontSize: '24px', fontWeight: 700, color: orcamentoDisponivel > 0 ? '#10b981' : '#ef4444' }}>
               R$ {orcamentoDisponivel.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
             </div>
          </div>

          <h3 style={{ marginBottom: 'var(--space-3)' }}>Folgas Disponíveis para Compra</h3>
          {folgasDisponiveis.length === 0 ? (
            <div className="blueprint card" style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
              Nenhuma folga nova gerada neste ciclo. Vá na tela de "Banco de Folgas" para lançar os plantões.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {folgasDisponiveis.map(f => (
                <div key={f.id} className="blueprint card" style={{ padding: 'var(--space-3)' }}>
                   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                     <div>
                       <strong>{f.employees.nome}</strong>
                       <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                         {f.employees.positions.codigo} | {f.quantidade_plantoes} plantões
                       </div>
                     </div>
                     <button className="btn btn-primary" style={{ padding: '4px 12px', fontSize: '12px' }} onClick={() => openCompraModal(f)}>
                       Solicitar Compra
                     </button>
                   </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Lado Direito: Solicitações Realizadas */}
        <div>
          <h3 style={{ marginBottom: 'var(--space-3)' }}>Solicitações do Ciclo</h3>
          <div className="blueprint card elev-sm" style={{ overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-divider)' }}>
                  <th style={{ padding: 'var(--space-3)' }}>Servidor</th>
                  <th style={{ padding: 'var(--space-3)' }}>Qtd. Folgas</th>
                  <th style={{ padding: 'var(--space-3)' }}>Valor Solicitado</th>
                  <th style={{ padding: 'var(--space-3)' }}>Status</th>
                  <th style={{ padding: 'var(--space-3)', textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {solicitacoes.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                      Nenhuma solicitação de compra feita neste ciclo.
                    </td>
                  </tr>
                ) : solicitacoes.map(sol => (
                  <tr key={sol.id} style={{ borderBottom: '1px solid var(--color-divider)' }}>
                    <td style={{ padding: 'var(--space-3)' }}>
                      <div style={{ fontWeight: 500 }}>{sol.employees?.nome}</div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{sol.employees?.positions?.codigo}</div>
                    </td>
                    <td style={{ padding: 'var(--space-3)' }}>{sol.compensatory_days?.quantidade_plantoes}</td>
                    <td style={{ padding: 'var(--space-3)', fontWeight: 600 }}>R$ {Number(sol.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    <td style={{ padding: 'var(--space-3)' }}>{getStatusBadge(sol.status)}</td>
                    <td style={{ padding: 'var(--space-3)', textAlign: 'right' }}>
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
          </div>
        </div>
      </div>

      {/* Modal de Compra */}
      {isModalOpen && selectedFolga && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="blueprint card elev-md" style={{ width: '500px', padding: 'var(--space-6)', background: 'var(--color-surface)' }}>
            <h3 style={{ marginTop: 0, marginBottom: 'var(--space-4)' }}>Solicitar Compra de Folga</h3>
            
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

            <form onSubmit={handleComprar}>
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

    </div>
  );
};

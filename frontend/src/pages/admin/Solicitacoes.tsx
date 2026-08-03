import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { CheckCircle, XCircle, AlertCircle, Filter, ShoppingCart, Clock } from 'lucide-react';

type PurchaseRequest = {
  id: string;
  tipo_solicitacao: string;
  data_plantao: string | null;
  valor: number;
  status: string;
  justificativa: string;
  requested_at: string;
  rejection_reason: string | null;
  compensatory_day_id: string | null;
  employees: {
    nome: string;
    matricula: string;
    positions: {
      nome: string;
    };
  };
  establishments: {
    nome: string;
  };
  cycles: {
    nome: string;
  };
};

type Cycle = { id: string; nome: string; status: string };
type Establishment = { id: string; nome: string };

export const Solicitacoes: React.FC = () => {
  const { profile } = useAuth();
  
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  
  const [selectedCycle, setSelectedCycle] = useState('');
  const [selectedEst, setSelectedEst] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('SOLICITADA'); // Default show pending
  
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    loadFilters();
  }, []);

  useEffect(() => {
    if (selectedCycle) {
      loadRequests();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCycle, selectedEst, selectedStatus]);

  const loadFilters = async () => {
    const [{ data: cData }, { data: eData }] = await Promise.all([
      supabase.from('cycles').select('id, nome, status').order('ano', { ascending: false }).order('mes', { ascending: false }),
      supabase.from('establishments').select('id, nome').eq('ativo', true).order('nome')
    ]);
    
    setCycles(cData || []);
    setEstablishments(eData || []);
    
    const aberto = (cData || []).find(c => c.status === 'ABERTO' || c.status === 'REABERTO');
    if (aberto) setSelectedCycle(aberto.id);
    else if (cData && cData.length > 0) setSelectedCycle(cData[0].id);
  };

  const loadRequests = async () => {
    setLoading(true);
    try {
      let q = supabase
        .from('purchase_requests')
        .select(`
          id, tipo_solicitacao, data_plantao, valor, status, justificativa, requested_at, rejection_reason, compensatory_day_id,
          employees ( nome, matricula, positions ( nome ) ),
          establishments ( nome ),
          cycles ( nome )
        `)
        .eq('cycle_id', selectedCycle)
        .order('requested_at', { ascending: false });

      if (selectedEst) q = q.eq('establishment_id', selectedEst);
      if (selectedStatus) q = q.eq('status', selectedStatus);

      const { data, error } = await q;
      if (error) throw error;
      setRequests(data as unknown as PurchaseRequest[]);
    } catch (e: any) {
      alert('Erro ao carregar solicitações: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (req: PurchaseRequest) => {
    if (!window.confirm('Tem certeza que deseja APROVAR esta solicitação?')) return;
    setProcessingId(req.id);
    try {
      // Atualiza a solicitação
      const { error: reqErr } = await supabase
        .from('purchase_requests')
        .update({
          status: 'APROVADA',
          analyzed_by: profile!.id,
          analyzed_at: new Date().toISOString()
        })
        .eq('id', req.id);
        
      if (reqErr) throw reqErr;

      // Se for folga compensatória, atualiza o status do dia gerado
      if (req.compensatory_day_id) {
        const { error: compErr } = await supabase
          .from('compensatory_days')
          .update({ status: 'COMPRADA' })
          .eq('id', req.compensatory_day_id);
        if (compErr) throw compErr;
      }

      // Atualiza lista localmente
      setRequests(requests.filter(r => r.id !== req.id || selectedStatus === ''));
      if (selectedStatus === '') {
        setRequests(requests.map(r => r.id === req.id ? { ...r, status: 'APROVADA' } : r));
      }

    } catch (e: any) {
      alert('Erro ao aprovar: ' + e.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (req: PurchaseRequest) => {
    const reason = window.prompt('Informe o motivo da rejeição (obrigatório):');
    if (reason === null) return; // cancelou
    if (reason.trim().length < 5) {
      alert('Por favor, informe um motivo válido para a rejeição.');
      return;
    }

    setProcessingId(req.id);
    try {
      // Atualiza a solicitação
      const { error: reqErr } = await supabase
        .from('purchase_requests')
        .update({
          status: 'REJEITADA',
          rejection_reason: reason.trim(),
          analyzed_by: profile!.id,
          analyzed_at: new Date().toISOString()
        })
        .eq('id', req.id);
        
      if (reqErr) throw reqErr;

      // Se for folga, libera o dia gerado
      if (req.compensatory_day_id) {
        const { error: compErr } = await supabase
          .from('compensatory_days')
          .update({ status: 'GERADA' })
          .eq('id', req.compensatory_day_id);
        if (compErr) throw compErr;
      }

      // Atualiza lista localmente
      setRequests(requests.filter(r => r.id !== req.id || selectedStatus === ''));
      if (selectedStatus === '') {
        setRequests(requests.map(r => r.id === req.id ? { ...r, status: 'REJEITADA', rejection_reason: reason.trim() } : r));
      }

    } catch (e: any) {
      alert('Erro ao rejeitar: ' + e.message);
    } finally {
      setProcessingId(null);
    }
  };

  const fmtCurrency = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
  const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR');
  const fmtDateTime = (d: string) => new Date(d).toLocaleString('pt-BR');

  return (
    <div style={{ padding: 'var(--space-6)', maxWidth: '1400px', margin: '0 auto' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
        <div>
          <h1 style={{ margin: '0 0 var(--space-2) 0', fontSize: '24px', color: 'var(--color-text-base)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShoppingCart size={28} color="#2563eb" />
            Solicitações de Compra
          </h1>
          <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>Analise as solicitações de Folga Compensatória e Plantão Plus enviadas pelas unidades.</p>
        </div>
      </div>

      {/* Filtros */}
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

        <div style={{ flex: '2 1 250px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '6px' }}>
            Unidade Penal
          </label>
          <select 
            value={selectedEst} 
            onChange={e => setSelectedEst(e.target.value)}
            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--color-border)', outline: 'none', background: '#fff' }}
          >
            <option value="">Todas as Unidades</option>
            {establishments.map(e => (
              <option key={e.id} value={e.id}>{e.nome}</option>
            ))}
          </select>
        </div>

        <div style={{ flex: '1 1 150px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '6px' }}>
            Status
          </label>
          <select 
            value={selectedStatus} 
            onChange={e => setSelectedStatus(e.target.value)}
            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--color-border)', outline: 'none', background: '#fff' }}
          >
            <option value="">Todos os Status</option>
            <option value="SOLICITADA">Pendentes (Solicitadas)</option>
            <option value="APROVADA">Aprovadas</option>
            <option value="REJEITADA">Rejeitadas</option>
            <option value="CANCELADA">Canceladas</option>
          </select>
        </div>
      </div>

      {/* Lista de Solicitações */}
      <div style={{ background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Carregando solicitações...</div>
        ) : requests.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            <AlertCircle size={32} />
            Nenhuma solicitação encontrada para os filtros aplicados.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569', textAlign: 'left' }}>
                  <th style={{ padding: '16px', fontWeight: 600 }}>Unidade / Data Req.</th>
                  <th style={{ padding: '16px', fontWeight: 600 }}>Servidor</th>
                  <th style={{ padding: '16px', fontWeight: 600 }}>Tipo da Compra</th>
                  <th style={{ padding: '16px', fontWeight: 600 }}>Justificativa</th>
                  <th style={{ padding: '16px', fontWeight: 600, textAlign: 'right' }}>Valor (R$)</th>
                  <th style={{ padding: '16px', fontWeight: 600, textAlign: 'center' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {requests.map(req => (
                  <tr key={req.id} style={{ borderBottom: '1px solid #e2e8f0', background: '#fff' }}>
                    
                    <td style={{ padding: '16px' }}>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>{req.establishments.nome}</div>
                      <div style={{ fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                        <Clock size={12} /> {fmtDateTime(req.requested_at)}
                      </div>
                    </td>
                    
                    <td style={{ padding: '16px' }}>
                      <div style={{ fontWeight: 500, color: '#334155' }}>{req.employees.nome}</div>
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Mat: {req.employees.matricula} | {req.employees.positions.nome}</div>
                    </td>
                    
                    <td style={{ padding: '16px' }}>
                      <div style={{ display: 'inline-flex', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, background: req.tipo_solicitacao === 'PLANTAO_PLUS' ? '#f0fdfa' : '#eff6ff', color: req.tipo_solicitacao === 'PLANTAO_PLUS' ? '#0f766e' : '#1d4ed8', border: `1px solid ${req.tipo_solicitacao === 'PLANTAO_PLUS' ? '#ccfbf1' : '#dbeafe'}` }}>
                        {req.tipo_solicitacao === 'PLANTAO_PLUS' ? 'Plantão Plus' : 'Folga Compensatória'}
                      </div>
                      {req.data_plantao && (
                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                          Data: {fmtDate(req.data_plantao)}
                        </div>
                      )}
                    </td>

                    <td style={{ padding: '16px', maxWidth: '300px' }}>
                      <div style={{ color: '#475569', fontSize: '12px', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        "{req.justificativa}"
                      </div>
                      {req.status === 'REJEITADA' && req.rejection_reason && (
                        <div style={{ color: '#ef4444', fontSize: '11px', marginTop: '8px', fontWeight: 500 }}>
                          <strong>Motivo da Rejeição:</strong> {req.rejection_reason}
                        </div>
                      )}
                    </td>
                    
                    <td style={{ padding: '16px', textAlign: 'right', fontWeight: 600, color: '#0f172a', fontSize: '14px' }}>
                      {fmtCurrency(req.valor)}
                    </td>
                    
                    <td style={{ padding: '16px', textAlign: 'center' }}>
                      {req.status === 'SOLICITADA' ? (
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                          <button 
                            onClick={() => handleApprove(req)}
                            disabled={processingId === req.id}
                            title="Aprovar Solicitação"
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', borderRadius: '8px', border: 'none', background: '#ecfdf5', color: '#10b981', cursor: processingId === req.id ? 'not-allowed' : 'pointer', transition: 'all 0.2s', opacity: processingId === req.id ? 0.5 : 1 }}
                            onMouseOver={e => e.currentTarget.style.background = '#d1fae5'}
                            onMouseOut={e => e.currentTarget.style.background = '#ecfdf5'}
                          >
                            <CheckCircle size={20} />
                          </button>
                          
                          <button 
                            onClick={() => handleReject(req)}
                            disabled={processingId === req.id}
                            title="Rejeitar Solicitação"
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', borderRadius: '8px', border: 'none', background: '#fef2f2', color: '#ef4444', cursor: processingId === req.id ? 'not-allowed' : 'pointer', transition: 'all 0.2s', opacity: processingId === req.id ? 0.5 : 1 }}
                            onMouseOver={e => e.currentTarget.style.background = '#fee2e2'}
                            onMouseOut={e => e.currentTarget.style.background = '#fef2f2'}
                          >
                            <XCircle size={20} />
                          </button>
                        </div>
                      ) : (
                        <span style={{ 
                          padding: '6px 12px', 
                          borderRadius: '20px', 
                          fontSize: '11px', 
                          fontWeight: 700, 
                          color: req.status === 'APROVADA' ? '#065f46' : (req.status === 'REJEITADA' ? '#991b1b' : '#475569'),
                          background: req.status === 'APROVADA' ? '#d1fae5' : (req.status === 'REJEITADA' ? '#fee2e2' : '#e2e8f0') 
                        }}>
                          {req.status}
                        </span>
                      )}
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};

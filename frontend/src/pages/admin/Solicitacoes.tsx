import React, { useEffect, useState, useMemo, useRef } from 'react';
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
  position_id?: string;
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
type Position = { id: string; nome: string };

export const Solicitacoes: React.FC = () => {
  const { profile } = useAuth();
  
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  
  const [selectedCycle, setSelectedCycle] = useState('');
  const [selectedEst, setSelectedEst] = useState('');
  const [selectedStatus, setSelectedStatus] = useState(''); // Default show all
  
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;
  
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Custom Dropdown State for Estabelecimento Penal
  const [isEstDropdownOpen, setIsEstDropdownOpen] = useState(false);
  const [estSearch, setEstSearch] = useState('');
  const estDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (estDropdownRef.current && !estDropdownRef.current.contains(event.target as Node)) {
        setIsEstDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredEsts = useMemo(() => {
    return establishments.filter(e => e.nome.toLowerCase().includes(estSearch.toLowerCase()));
  }, [establishments, estSearch]);

  useEffect(() => {
    loadFilters();
  }, []);

  useEffect(() => {
    if (selectedCycle) {
      loadRequests();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCycle, selectedEst]); // removed selectedStatus because filtering is now client-side

  const loadFilters = async () => {
    const [{ data: cData }, { data: eData }, { data: pData }] = await Promise.all([
      supabase.from('cycles').select('id, nome, status').order('ano', { ascending: false }).order('mes', { ascending: false }),
      supabase.from('establishments').select('id, nome').eq('ativo', true).order('nome'),
      supabase.from('positions').select('id, nome').eq('ativo', true).order('nome')
    ]);
    
    setCycles(cData || []);
    setEstablishments(eData || []);
    setPositions(pData || []);
    
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
          id, tipo_solicitacao, data_plantao, valor, status, justificativa, requested_at, rejection_reason, compensatory_day_id, position_id,
          employees ( nome, matricula, positions ( nome ) ),
          establishments ( nome ),
          cycles ( nome )
        `)
        .eq('cycle_id', selectedCycle)
        .order('requested_at', { ascending: false });

      if (selectedEst) q = q.eq('establishment_id', selectedEst);
      // Status filter is now client-side so stats can be computed accurately

      const { data, error } = await q;
      if (error) throw error;
      
      const { data: pvs } = await supabase.from('position_values').select('valor, position_id').is('vigencia_fim', null);
      const pvMap: Record<string, number> = {};
      if (pvs) pvs.forEach((p: any) => pvMap[p.position_id] = Number(p.valor));

      const processedData = (data as unknown as PurchaseRequest[]).map(r => {
        if (r.position_id && pvMap[r.position_id]) {
          r.valor = pvMap[r.position_id]; // Sobrescreve com o valor de hoje!
        }
        return r;
      });

      setRequests(processedData);
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
          .update({ status: 'INDENIZADA' })
          .eq('id', req.compensatory_day_id);
        if (compErr) throw compErr;
      }

      // Atualiza lista localmente (mantendo ela na memória principal para não quebrar stats)
      setRequests(requests.map(r => r.id === req.id ? { ...r, status: 'APROVADA' } : r));

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
      setRequests(requests.map(r => r.id === req.id ? { ...r, status: 'REJEITADA', rejection_reason: reason.trim() } : r));

    } catch (e: any) {
      alert('Erro ao rejeitar: ' + e.message);
    } finally {
      setProcessingId(null);
    }
  };

  const fmtCurrency = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
  const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR');
  const fmtDateTime = (d: string) => new Date(d).toLocaleString('pt-BR');

  // Cálculos das Estatísticas
  const statsStatus = { SOLICITADA: 0, APROVADA: 0, REJEITADA: 0, CANCELADA: 0 };
  const gastoPorCargo: Record<string, number> = {};

  // Inicializa todos os cargos ativos com gasto 0
  positions.forEach(p => {
    gastoPorCargo[p.nome] = 0;
  });

  requests.forEach(r => {
    if (r.status in statsStatus) {
      statsStatus[r.status as keyof typeof statsStatus]++;
    }
    // Soma valor gasto apenas se APROVADA
    if (r.status === 'APROVADA') {
      const cargo = r.employees.positions.nome;
      gastoPorCargo[cargo] = (gastoPorCargo[cargo] || 0) + r.valor;
    }
  });

  const filteredRequests = selectedStatus ? requests.filter(r => r.status === selectedStatus) : requests;

  // Reseta a página para 1 sempre que os filtros mudam
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCycle, selectedEst, selectedStatus, estSearch]);

  const totalPages = Math.ceil(filteredRequests.length / ITEMS_PER_PAGE);
  const paginatedRequests = filteredRequests.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  return (
    <div style={{ width: '100%' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
        <div>
          <h1 style={{ margin: '0 0 var(--space-2) 0', fontSize: '24px', color: 'var(--color-text-base)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShoppingCart size={28} color="#2563eb" />
            Solicitações de Compra
          </h1>
          <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>Analise as solicitações de Folga Compensatória e Plantão Plus enviadas pelas unidades.</p>
        </div>
      </div>

      {/* Cards de Estatística */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        <div className="modern-card" style={{ padding: 'var(--space-4)', borderLeft: '4px solid #f59e0b' }}>
          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Pendentes</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text-base)', marginTop: '4px' }}>{statsStatus.SOLICITADA}</div>
        </div>
        <div className="modern-card" style={{ padding: 'var(--space-4)', borderLeft: '4px solid #10b981' }}>
          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Aprovadas</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text-base)', marginTop: '4px' }}>{statsStatus.APROVADA}</div>
        </div>
        <div className="modern-card" style={{ padding: 'var(--space-4)', borderLeft: '4px solid #ef4444' }}>
          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Rejeitadas</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text-base)', marginTop: '4px' }}>{statsStatus.REJEITADA}</div>
        </div>
        
        {Object.entries(gastoPorCargo).sort((a, b) => b[1] - a[1]).map(([cargo, valor]) => (
          <div key={cargo} className="modern-card" style={{ padding: 'var(--space-4)', borderLeft: '4px solid #3b82f6' }}>
            <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', lineHeight: '1.4' }} title={cargo}>
              Gasto: {cargo}
            </div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-text-base)', marginTop: '4px' }}>{fmtCurrency(valor)}</div>
          </div>
        ))}
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

        <div style={{ flex: '2 1 250px', position: 'relative' }} ref={estDropdownRef}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '6px' }}>
            Unidade Penal
          </label>
          
          <div 
            onClick={() => { setIsEstDropdownOpen(true); setEstSearch(''); }}
            style={{ width: '100%', height: '38px', padding: '0 10px', borderRadius: '8px', border: '1px solid var(--color-border)', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
          >
            {isEstDropdownOpen ? (
              <input 
                autoFocus
                type="text" 
                value={estSearch}
                onChange={e => setEstSearch(e.target.value)}
                placeholder="Buscar unidade..."
                style={{ border: 'none', outline: 'none', width: '100%', fontSize: '14px', background: 'transparent', padding: 0 }}
              />
            ) : (
              <span style={{ color: selectedEst ? 'var(--color-text-base)' : 'var(--color-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '14px' }}>
                {selectedEst ? establishments.find(e => e.id === selectedEst)?.nome : 'Todas as Unidades'}
              </span>
            )}
          </div>

          {isEstDropdownOpen && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px', background: '#fff', border: '1px solid var(--color-border)', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', zIndex: 10, maxHeight: '250px', overflowY: 'auto' }}>
              <div 
                onClick={() => { setSelectedEst(''); setIsEstDropdownOpen(false); }}
                style={{ padding: '10px 12px', fontSize: '14px', cursor: 'pointer', background: selectedEst === '' ? 'var(--color-bg-elevated)' : 'transparent', borderBottom: '1px solid var(--color-border)', fontWeight: selectedEst === '' ? 600 : 400 }}
              >
                Todas as Unidades
              </div>
              {filteredEsts.map(e => (
                <div 
                  key={e.id}
                  onClick={() => { setSelectedEst(e.id); setIsEstDropdownOpen(false); }}
                  style={{ padding: '10px 12px', fontSize: '14px', cursor: 'pointer', background: selectedEst === e.id ? 'var(--color-bg-elevated)' : 'transparent', borderBottom: '1px solid var(--color-border)', fontWeight: selectedEst === e.id ? 600 : 400 }}
                  onMouseEnter={ev => ev.currentTarget.style.background = 'var(--color-bg-elevated)'}
                  onMouseLeave={ev => ev.currentTarget.style.background = selectedEst === e.id ? 'var(--color-bg-elevated)' : 'transparent'}
                >
                  {e.nome}
                </div>
              ))}
              {filteredEsts.length === 0 && (
                <div style={{ padding: '10px 12px', fontSize: '14px', color: 'var(--color-text-muted)', textAlign: 'center' }}>Nenhuma unidade encontrada</div>
              )}
            </div>
          )}
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
        ) : filteredRequests.length === 0 ? (
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
                {paginatedRequests.map(req => (
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
            
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', borderTop: '1px solid var(--color-border)', background: '#fff' }}>
                <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                  Mostrando {(currentPage - 1) * ITEMS_PER_PAGE + 1} até {Math.min(currentPage * ITEMS_PER_PAGE, filteredRequests.length)} de {filteredRequests.length} solicitações
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: '12px' }} disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>
                    Anterior
                  </button>
                  <button className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: '12px' }} disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>
                    Próxima
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
};

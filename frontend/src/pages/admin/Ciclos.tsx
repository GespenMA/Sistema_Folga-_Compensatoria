import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

type Cycle = {
  id: string;
  nome: string;
  mes: number;
  ano: number;
  data_inicio: string;
  data_fim: string;
  status: string;
  created_at: string;
};

export const Ciclos: React.FC = () => {
  const { profile } = useAuth();
  const [ciclos, setCiclos] = useState<Cycle[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal Novo/Editar Ciclo
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState<string | null>(null);
  const [nome, setNome] = useState('');
  const [mes, setMes] = useState(new Date().getMonth() + 1);
  const [ano, setAno] = useState(new Date().getFullYear());
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal Customizado de Confirmação
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    isLoading?: boolean;
    confirmText?: string;
    confirmColor?: string;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  useEffect(() => {
    fetchCiclos();
  }, []);

  const fetchCiclos = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('cycles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) setCiclos(data as Cycle[]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const openModal = (ciclo?: Cycle) => {
    if (ciclo) {
      setEditId(ciclo.id);
      setEditStatus(ciclo.status);
      setNome(ciclo.nome);
      setMes(ciclo.mes);
      setAno(ciclo.ano);
      setDataInicio(ciclo.data_inicio);
      setDataFim(ciclo.data_fim);
    } else {
      setEditId(null);
      setEditStatus(null);
      setNome('');
      setMes(new Date().getMonth() + 1);
      setAno(new Date().getFullYear());
      setDataInicio('');
      setDataFim('');
    }
    setIsModalOpen(true);
  };

  const handleSaveCycle = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Validação de Conflito de Datas (Overlap)
    const startTime = new Date(dataInicio + 'T12:00:00Z').getTime();
    const endTime = new Date(dataFim + 'T12:00:00Z').getTime();

    const overlappingCycle = ciclos.find(c => {
      if (editId && c.id === editId) return false;
      const cStart = new Date(c.data_inicio + 'T12:00:00Z').getTime();
      const cEnd = new Date(c.data_fim + 'T12:00:00Z').getTime();
      return startTime <= cEnd && cStart <= endTime;
    });

    if (overlappingCycle) {
      const nextDate = new Date(overlappingCycle.data_fim + 'T12:00:00Z');
      nextDate.setUTCDate(nextDate.getUTCDate() + 1);
      alert(`Não é possível criar este ciclo. O período conflita com o ciclo "${overlappingCycle.nome}". Você só poderá iniciar um ciclo a partir do dia ${nextDate.toLocaleDateString('pt-BR', { timeZone: 'UTC' })}.`);
      setIsSubmitting(false);
      return;
    }

    try {
      if (editId) {
        const updateData: any = { nome, mes, ano };
        if (editStatus === 'RASCUNHO') {
          updateData.data_inicio = dataInicio;
          updateData.data_fim = dataFim;
        }
        const { error } = await supabase.from('cycles').update(updateData).eq('id', editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('cycles').insert([
          {
            nome,
            mes,
            ano,
            data_inicio: dataInicio,
            data_fim: dataFim,
            status: 'RASCUNHO'
          }
        ]);
        if (error) throw error;
      }
      
      setIsModalOpen(false);
      fetchCiclos();
    } catch (err: any) {
      alert(err.message || 'Erro ao salvar ciclo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (ciclo: Cycle) => {
    if (ciclo.status !== 'RASCUNHO') {
      alert('Apenas ciclos em RASCUNHO podem ser excluídos.');
      return;
    }
    
    setConfirmModal({
      isOpen: true,
      title: 'Excluir Ciclo',
      message: `Tem certeza que deseja excluir o ciclo "${ciclo.nome}"? Esta ação não pode ser desfeita.`,
      confirmText: 'Excluir',
      confirmColor: 'var(--color-danger)',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isLoading: true }));
        try {
          const { error } = await supabase.from('cycles').delete().eq('id', ciclo.id);
          if (error) {
            if (error.code === '23503') throw new Error('Não é possível excluir pois já existem dados atrelados a este ciclo.');
            throw error;
          }
          fetchCiclos();
          setConfirmModal(prev => ({ ...prev, isOpen: false, isLoading: false }));
        } catch (err: any) {
          alert(err.message || 'Erro ao excluir ciclo.');
          setConfirmModal(prev => ({ ...prev, isLoading: false }));
        }
      }
    });
  };

  const handleCloneBudget = (newCycleId: string) => {
    const oldCycle = ciclos.find(c => c.id !== newCycleId);
    if (!oldCycle) {
      alert('Não há nenhum ciclo anterior para clonar os limites.');
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'Clonar Orçamentos',
      message: `Deseja clonar os orçamentos e limites do ciclo "${oldCycle.nome}" para este ciclo? Isso irá substituir limites vazios.`,
      confirmText: 'Clonar Regras',
      confirmColor: 'var(--color-primary)',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isLoading: true }));
        try {
          const { error } = await supabase.rpc('clone_cycle_budget', {
            p_new_cycle_id: newCycleId,
            p_old_cycle_id: oldCycle.id
          });
          if (error) throw error;
          
          fetchCiclos();
          setConfirmModal(prev => ({ ...prev, isOpen: false, isLoading: false }));
        } catch (err: any) {
          alert(err.message || 'Erro ao clonar orçamentos.');
          console.error(err);
          setConfirmModal(prev => ({ ...prev, isLoading: false }));
        }
      }
    });
  };

  const handleOpenCycle = (cycleId: string) => {
    const openCycle = ciclos.find(c => c.status === 'ABERTO' || c.status === 'REABERTO');
    if (openCycle && openCycle.id !== cycleId) {
      alert(`Você não pode abrir este ciclo porque o ciclo "${openCycle.nome}" já está em andamento. Feche-o primeiro.`);
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'Abrir Ciclo',
      message: 'Ao ABRIR o ciclo, as unidades penais poderão iniciar as solicitações de compras de folga. Deseja continuar?',
      confirmText: 'Sim, Abrir Ciclo',
      confirmColor: '#059669', // Verde
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isLoading: true }));
        try {
          const { error } = await supabase
            .from('cycles')
            .update({
              status: 'ABERTO',
              opened_at: new Date().toISOString(),
              opened_by: profile?.id
            })
            .eq('id', cycleId);

          if (error) throw error;
          fetchCiclos();
          setConfirmModal(prev => ({ ...prev, isOpen: false, isLoading: false }));
        } catch (err: any) {
          alert(err.message || 'Erro ao abrir ciclo.');
          setConfirmModal(prev => ({ ...prev, isLoading: false }));
        }
      }
    });
  };

  const handleReopenCycle = (cycleId: string) => {
    const openCycle = ciclos.find(c => c.status === 'ABERTO' || c.status === 'REABERTO');
    if (openCycle) {
      alert(`Você não pode reabrir este ciclo porque o ciclo "${openCycle.nome}" já está em andamento. Feche-o primeiro.`);
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'Reabrir Ciclo',
      message: 'Atenção: Você está REABRINDO um ciclo encerrado. Unidades poderão fazer novos lançamentos retroativos. Deseja continuar?',
      confirmText: 'Sim, Reabrir',
      confirmColor: '#d97706', // Laranja
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isLoading: true }));
        try {
          const { error } = await supabase
            .from('cycles')
            .update({
              status: 'REABERTO',
              reopened_at: new Date().toISOString(),
              reopened_by: profile?.id
            })
            .eq('id', cycleId);

          if (error) throw error;
          fetchCiclos();
          setConfirmModal(prev => ({ ...prev, isOpen: false, isLoading: false }));
        } catch (err: any) {
          alert(err.message || 'Erro ao reabrir ciclo.');
          setConfirmModal(prev => ({ ...prev, isLoading: false }));
        }
      }
    });
  };

  const handleCloseCycle = (cycleId: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Encerrar Ciclo',
      message: 'Ao FECHAR o ciclo, as unidades penais não poderão mais solicitar folgas. As solicitações não analisadas serão reprovadas. Deseja continuar?',
      confirmText: 'Encerrar Ciclo',
      confirmColor: '#dc2626', // Vermelho
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isLoading: true }));
        try {
          const { error } = await supabase
            .from('cycles')
            .update({
              status: 'FECHADO',
              closed_at: new Date().toISOString(),
              closed_by: profile?.id
            })
            .eq('id', cycleId);

          if (error) throw error;
          fetchCiclos();
          setConfirmModal(prev => ({ ...prev, isOpen: false, isLoading: false }));
        } catch (err: any) {
          alert(err.message || 'Erro ao fechar ciclo.');
          setConfirmModal(prev => ({ ...prev, isLoading: false }));
        }
      }
    });
  };

  const getStatusTag = (status: string) => {
    switch(status) {
      case 'RASCUNHO': return <span className="tag" style={{ background: '#4b5563', color: 'white', fontWeight: 600, letterSpacing: '0.5px' }}>RASCUNHO</span>;
      case 'ABERTO': return <span className="tag" style={{ background: '#059669', color: 'white', fontWeight: 600, letterSpacing: '0.5px' }}>ABERTO</span>;
      case 'FECHADO': return <span className="tag" style={{ background: '#dc2626', color: 'white', fontWeight: 600, letterSpacing: '0.5px' }}>FECHADO</span>;
      case 'REABERTO': return <span className="tag" style={{ background: '#d97706', color: 'white', fontWeight: 600, letterSpacing: '0.5px' }}>REABERTO</span>;
      default: return <span className="tag">{status}</span>;
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 'var(--space-6)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0 }}>Gestão de Ciclos</h2>
          <p className="text-muted" style={{ margin: 0 }}>
            Crie, abra e encerre os ciclos mensais de compra de folgas.
          </p>
        </div>
        <button className="btn btn-primary blueprint" onClick={() => openModal()}>
          <i className="corner tl"></i><i className="corner tr"></i><i className="corner bl"></i><i className="corner br"></i>
          + Novo Ciclo
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 'var(--space-5)' }}>
        {loading ? (
          <div>Carregando ciclos...</div>
        ) : ciclos.length === 0 ? (
          <div className="text-muted">Nenhum ciclo encontrado.</div>
        ) : (
          ciclos.map(ciclo => {
            const isAberto = ciclo.status === 'ABERTO' || ciclo.status === 'REABERTO';
            const isRascunho = ciclo.status === 'RASCUNHO';
            const isFechado = ciclo.status === 'FECHADO';

            return (
              <div 
                key={ciclo.id} 
                className="blueprint card" 
                style={{ 
                  padding: 'var(--space-5)', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: 'var(--space-4)',
                  background: 'var(--color-surface)',
                  border: isAberto ? (ciclo.status === 'REABERTO' ? '1px solid #d97706' : '1px solid #059669') : '1px solid var(--color-border)',
                  boxShadow: isAberto ? (ciclo.status === 'REABERTO' ? '0 4px 20px rgba(217, 119, 6, 0.15)' : '0 4px 20px rgba(5, 150, 105, 0.15)') : 'none',
                  transition: 'all 0.2s ease-in-out'
                }}
              >
                <i className="corner tl"></i><i className="corner tr"></i><i className="corner bl"></i><i className="corner br"></i>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ margin: '0 0 4px 0', fontSize: '20px', color: isAberto ? (ciclo.status === 'REABERTO' ? '#d97706' : '#059669') : 'var(--color-text)' }}>
                      {ciclo.status === 'ABERTO' ? '🟢 ' : ciclo.status === 'REABERTO' ? '🟠 ' : isRascunho ? '📝 ' : '🔒 '}
                      {ciclo.nome}
                    </h3>
                  </div>
                  {getStatusTag(ciclo.status)}
                </div>

                <div style={{ 
                  fontSize: '14px', 
                  color: 'var(--color-text-muted)', 
                  background: 'var(--color-bg)', 
                  padding: 'var(--space-3)', 
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '16px' }}>📅</span>
                    <span><strong>Vigência:</strong> {new Date(ciclo.data_inicio + 'T12:00:00Z').toLocaleDateString('pt-BR')} a {new Date(ciclo.data_fim + 'T12:00:00Z').toLocaleDateString('pt-BR')}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '16px' }}>📊</span>
                    <span><strong>Competência:</strong> Mês {ciclo.mes} / {ciclo.ano}</span>
                  </div>
                </div>

                {/* BOTÕES SECUNDÁRIOS: EDITAR / EXCLUIR */}
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '-8px' }}>
                  {!isFechado && (
                    <button className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: '12px' }} onClick={() => openModal(ciclo)}>✏️ Editar</button>
                  )}
                  {isRascunho && (
                    <button className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: '12px', color: 'var(--color-danger)' }} onClick={() => handleDelete(ciclo)}>🗑️ Excluir</button>
                  )}
                </div>

                <div style={{ 
                  marginTop: 'auto', 
                  display: 'flex', 
                  gap: '12px', 
                  flexWrap: 'wrap', 
                  paddingTop: 'var(--space-4)', 
                  borderTop: '1px solid var(--color-divider)' 
                }}>
                  
                  {ciclo.status === 'RASCUNHO' && (
                    <>
                      <button 
                        className="btn btn-ghost" 
                        style={{ flex: 1, fontSize: '13px', border: '1px solid var(--color-border)' }} 
                        onClick={() => handleCloneBudget(ciclo.id)}
                      >
                        📋 Clonar Regras
                      </button>
                      <button 
                        className="btn btn-primary" 
                        style={{ flex: 1, fontSize: '13px', background: '#059669', borderColor: '#059669' }} 
                        onClick={() => handleOpenCycle(ciclo.id)}
                      >
                        Abrir Ciclo
                      </button>
                    </>
                  )}

                  {(ciclo.status === 'ABERTO' || ciclo.status === 'REABERTO') && (
                    <button 
                      className="btn" 
                      style={{ flex: 1, fontSize: '13px', background: '#dc2626', color: 'white', fontWeight: 600, border: 'none' }} 
                      onClick={() => handleCloseCycle(ciclo.id)}
                    >
                      🔴 Encerrar Ciclo
                    </button>
                  )}
                  
                  {ciclo.status === 'FECHADO' && (
                    <button 
                      className="btn btn-ghost" 
                      style={{ flex: 1, fontSize: '13px', color: '#d97706', border: '1px solid #d97706' }} 
                      onClick={() => handleReopenCycle(ciclo.id)}
                    >
                      🔓 Reabrir Ciclo
                    </button>
                  )}

                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal Novo/Editar Ciclo */}
      {isModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="blueprint card elev-md" style={{ width: '500px', padding: 'var(--space-6)', background: 'var(--color-surface)' }}>
            <i className="corner tl"></i><i className="corner tr"></i><i className="corner bl"></i><i className="corner br"></i>
            <h3 style={{ marginTop: 0, marginBottom: 'var(--space-4)' }}>{editId ? 'Editar Ciclo' : 'Criar Novo Ciclo'}</h3>
            
            <form onSubmit={handleSaveCycle}>
              <div className="field" style={{ marginBottom: 'var(--space-3)' }}>
                <label>Nome do Ciclo (ex: Julho/2026) *</label>
                <input 
                  className="input" 
                  type="text" 
                  value={nome} 
                  onChange={(e) => setNome(e.target.value)} 
                  required 
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                <div className="field">
                  <label>Mês Referência *</label>
                  <input className="input" type="number" min="1" max="12" value={mes} onChange={(e) => setMes(Number(e.target.value))} required />
                </div>
                <div className="field">
                  <label>Ano Referência *</label>
                  <input className="input" type="number" min="2020" max="2100" value={ano} onChange={(e) => setAno(Number(e.target.value))} required />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                <div className="field">
                  <label>Data de Início *</label>
                  <input 
                    className="input" 
                    type="date" 
                    value={dataInicio} 
                    onChange={(e) => {
                      setDataInicio(e.target.value);
                      if (e.target.value) {
                        const d = new Date(e.target.value + 'T12:00:00Z');
                        d.setUTCDate(d.getUTCDate() + 30);
                        setDataFim(d.toISOString().split('T')[0]);
                      }
                    }} 
                    required 
                    disabled={editId !== null && editStatus !== 'RASCUNHO'}
                    style={{ opacity: editId !== null && editStatus !== 'RASCUNHO' ? 0.6 : 1 }}
                  />
                </div>
                <div className="field">
                  <label>Data de Fim * (Calculada em 30 dias)</label>
                  <input 
                    className="input" 
                    type="date" 
                    value={dataFim} 
                    onChange={(e) => setDataFim(e.target.value)} 
                    required 
                    disabled={true}
                    style={{ opacity: 0.6, cursor: 'not-allowed' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary blueprint" disabled={isSubmitting}>
                  <i className="corner tl"></i><i className="corner tr"></i><i className="corner bl"></i><i className="corner br"></i>
                  {isSubmitting ? 'Salvando...' : (editId ? 'Salvar Alterações' : 'Criar Ciclo')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmação Customizado */}
      {confirmModal.isOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
        }}>
          <div className="blueprint card elev-md" style={{ width: '400px', padding: 'var(--space-6)', background: 'var(--color-surface)', textAlign: 'center' }}>
            <i className="corner tl"></i><i className="corner tr"></i><i className="corner bl"></i><i className="corner br"></i>
            
            <h3 style={{ marginTop: 0, marginBottom: 'var(--space-3)', fontSize: '20px' }}>{confirmModal.title}</h3>
            
            <p style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-5)', lineHeight: '1.5' }}>
              {confirmModal.message}
            </p>
            
            <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center' }}>
              <button 
                className="btn btn-ghost" 
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                disabled={confirmModal.isLoading}
              >
                Cancelar
              </button>
              <button 
                className="btn" 
                style={{ 
                  background: confirmModal.confirmColor || 'var(--color-primary)', 
                  color: 'white', 
                  border: 'none', 
                  fontWeight: 600,
                  opacity: confirmModal.isLoading ? 0.7 : 1
                }} 
                onClick={confirmModal.onConfirm}
                disabled={confirmModal.isLoading}
              >
                {confirmModal.isLoading ? 'Processando...' : (confirmModal.confirmText || 'Confirmar')}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

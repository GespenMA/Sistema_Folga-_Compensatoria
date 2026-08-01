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
  
  // Filtros
  const [filterMes, setFilterMes] = useState<string>('');
  const [filterAno, setFilterAno] = useState<string>('');

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
      // Ordenação cronológica crescente (Julho antes de Agosto)
      const { data, error } = await supabase
        .from('cycles')
        .select('*')
        .order('ano', { ascending: true })
        .order('mes', { ascending: true });

      if (error) throw error;
      if (data) setCiclos(data as Cycle[]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getMonthName = (monthNum: number) => {
    const months = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    return months[monthNum - 1] || '';
  };

  // Extrair meses e anos únicos EXISTENTES no banco
  const uniqueMonths = Array.from(new Set(ciclos.map(c => c.mes))).sort((a, b) => a - b);
  const uniqueYears = Array.from(new Set(ciclos.map(c => c.ano))).sort((a, b) => a - b);

  // Filtragem em memória
  const filteredCiclos = ciclos.filter(ciclo => {
    const matchesMes = filterMes ? ciclo.mes === parseInt(filterMes) : true;
    const matchesAno = filterAno ? ciclo.ano === parseInt(filterAno) : true;
    return matchesMes && matchesAno;
  });

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
          { nome, mes, ano, data_inicio: dataInicio, data_fim: dataFim, status: 'RASCUNHO' }
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
      case 'RASCUNHO': return <span className="tag" style={{ background: '#475569', color: 'white', fontWeight: 600, letterSpacing: '0.5px' }}>RASCUNHO</span>;
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

      {/* Filtros horizontais limpos e alinhados */}
      <div style={{ 
        display: 'flex', 
        flexDirection: 'row', 
        alignItems: 'center', 
        gap: '16px', 
        marginBottom: '24px', 
        padding: '16px', 
        background: '#ffffff',
        border: '1px solid #cbd5e1',
        borderRadius: '6px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        width: '100%'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#475569' }}>
          <span style={{ fontSize: '18px' }}>🔍</span>
          <span style={{ fontWeight: 600, fontSize: '14px' }}>Filtrar Ciclos:</span>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <select 
            className="input" 
            value={filterMes} 
            onChange={e => setFilterMes(e.target.value)} 
            style={{ 
              minWidth: '200px', 
              height: '38px',
              padding: '0 12px',
              background: '#f8fafc', 
              borderColor: '#cbd5e1',
              borderRadius: '6px',
              fontSize: '14px'
            }}
          >
            <option value="">Todos os Meses</option>
            {uniqueMonths.map(m => (
              <option key={m} value={m}>
                {m.toString().padStart(2, '0')} - {getMonthName(m).toUpperCase()}
              </option>
            ))}
          </select>

          <select 
            className="input" 
            value={filterAno} 
            onChange={e => setFilterAno(e.target.value)} 
            style={{ 
              minWidth: '140px', 
              height: '38px',
              padding: '0 12px',
              background: '#f8fafc', 
              borderColor: '#cbd5e1',
              borderRadius: '6px',
              fontSize: '14px'
            }}
          >
            <option value="">Todos os Anos</option>
            {uniqueYears.map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>

          {(filterMes || filterAno) && (
            <button 
              className="btn btn-ghost" 
              onClick={() => { setFilterMes(''); setFilterAno(''); }}
              style={{ fontSize: '13px', color: '#ef4444', fontWeight: 600, cursor: 'pointer', padding: '0 8px' }}
            >
              Limpar Filtros
            </button>
          )}
        </div>
      </div>

      {/* Grid de Cards com Espaçamento Correto (24px) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '24px' }}>
        {loading ? (
          <div>Carregando ciclos...</div>
        ) : filteredCiclos.length === 0 ? (
          <div className="text-muted" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 'var(--space-8)' }}>
            Nenhum ciclo encontrado com os filtros atuais.
          </div>
        ) : (
          filteredCiclos.map(ciclo => {
            const isAberto = ciclo.status === 'ABERTO' || ciclo.status === 'REABERTO';
            const isRascunho = ciclo.status === 'RASCUNHO';
            const isFechado = ciclo.status === 'FECHADO';

            return (
              <div 
                key={ciclo.id} 
                className="blueprint card" 
                style={{ 
                  padding: '24px', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '16px',
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderLeft: isAberto 
                    ? (ciclo.status === 'REABERTO' ? '6px solid #d97706' : '6px solid #059669') 
                    : isFechado ? '6px solid #dc2626' : '6px solid #475569',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
                  transition: 'all 0.2s ease-in-out',
                  minHeight: '280px',
                  borderRadius: '4px'
                }}
              >
                <i className="corner tl"></i><i className="corner tr"></i><i className="corner bl"></i><i className="corner br"></i>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0, fontSize: '20px', display: 'flex', alignItems: 'center', gap: '8px', color: '#1e293b' }}>
                    {ciclo.status === 'ABERTO' ? '🟢 ' : ciclo.status === 'REABERTO' ? '🟠 ' : isRascunho ? '📝 ' : '🔒 '}
                    {ciclo.nome}
                  </h3>
                  {getStatusTag(ciclo.status)}
                </div>

                <div style={{ 
                  fontSize: '14px', 
                  color: 'var(--color-text-muted)', 
                  background: '#f8fafc', 
                  padding: '12px', 
                  borderRadius: '6px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  border: '1px solid #e2e8f0'
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

                {/* AÇÕES DE EDIÇÃO/EXCLUSÃO */}
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-start' }}>
                  {!isFechado && (
                    <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={() => openModal(ciclo)}>
                      ✏️ Editar
                    </button>
                  )}
                  {isRascunho && (
                    <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: '13px', color: 'var(--color-danger)', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={() => handleDelete(ciclo)}>
                      🗑️ Excluir
                    </button>
                  )}
                </div>

                {/* BOTÕES DE AÇÃO DE FLUXO */}
                <div style={{ 
                  marginTop: 'auto', 
                  display: 'grid', 
                  gridTemplateColumns: '1fr 1fr',
                  gap: '8px', 
                  paddingTop: '16px', 
                  borderTop: '1px solid #e2e8f0' 
                }}>
                  
                  {ciclo.status === 'RASCUNHO' && (
                    <>
                      <button 
                        className="btn btn-ghost" 
                        style={{ fontSize: '13px', border: '1px solid #cbd5e1', borderRadius: '4px', width: '100%', justifyContent: 'center' }} 
                        onClick={() => handleCloneBudget(ciclo.id)}
                      >
                        📋 Clonar Regras
                      </button>
                      <button 
                        className="btn btn-primary" 
                        style={{ fontSize: '13px', background: '#059669', borderColor: '#059669', color: '#ffffff', borderRadius: '4px', width: '100%', justifyContent: 'center' }} 
                        onClick={() => handleOpenCycle(ciclo.id)}
                      >
                        🔓 Abrir Ciclo
                      </button>
                    </>
                  )}

                  {(ciclo.status === 'ABERTO' || ciclo.status === 'REABERTO') && (
                    <button 
                      className="btn" 
                      style={{ gridColumn: 'span 2', fontSize: '13px', background: '#dc2626', color: 'white', fontWeight: 600, border: 'none', borderRadius: '4px', width: '100%', padding: '10px', justifyContent: 'center' }} 
                      onClick={() => handleCloseCycle(ciclo.id)}
                    >
                      🔒 Encerrar Ciclo
                    </button>
                  )}
                  
                  {ciclo.status === 'FECHADO' && (
                    <button 
                      className="btn btn-ghost" 
                      style={{ gridColumn: 'span 2', fontSize: '13px', color: '#d97706', border: '1px solid #d97706', borderRadius: '4px', width: '100%', padding: '10px', justifyContent: 'center' }} 
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

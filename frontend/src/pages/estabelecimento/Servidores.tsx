import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

type Position = {
  id: string;
  nome: string;
  codigo: string;
};

type Employee = {
  id: string;
  matricula: string;
  nome: string;
  data_admissao: string;
  position_id: string;
  ativo: boolean;
  positions?: Position;
};

export const Servidores: React.FC = () => {
  const { profile } = useAuth();
  const [servidores, setServidores] = useState<Employee[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [matricula, setMatricula] = useState('');
  const [nome, setNome] = useState('');
  const [dataAdmissao, setDataAdmissao] = useState('');
  const [positionId, setPositionId] = useState('');
  const [ativo, setAtivo] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (profile?.establishment_id) {
      fetchInitialData();
    }
  }, [profile]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      // Busca Cargos
      const { data: posData } = await supabase.from('positions').select('id, nome, codigo').eq('ativo', true).order('nome');
      if (posData) setPositions(posData);

      // Busca Servidores da Unidade
      await fetchServidores();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchServidores = async () => {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select(`
          *,
          positions (id, nome, codigo)
        `)
        .eq('establishment_id', profile!.establishment_id)
        .order('nome');
      
      if (error) throw error;
      if (data) setServidores(data as Employee[]);
    } catch (err) {
      console.error('Erro ao buscar servidores:', err);
    }
  };

  const openModal = (emp?: Employee) => {
    if (emp) {
      setEditId(emp.id);
      setMatricula(emp.matricula);
      setNome(emp.nome);
      setDataAdmissao(emp.data_admissao);
      setPositionId(emp.position_id);
      setAtivo(emp.ativo);
    } else {
      setEditId(null);
      setMatricula('');
      setNome('');
      setDataAdmissao('');
      setPositionId('');
      setAtivo(true);
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.establishment_id) return;
    setIsSubmitting(true);

    try {
      if (editId) {
        const { error } = await supabase
          .from('employees')
          .update({
            matricula,
            nome,
            data_admissao: dataAdmissao,
            position_id: positionId,
            ativo
          })
          .eq('id', editId);
        
        if (error) {
          if (error.code === '23505') throw new Error('Já existe um servidor com esta matrícula nesta unidade.');
          throw error;
        }
      } else {
        const { error } = await supabase
          .from('employees')
          .insert([{
            establishment_id: profile.establishment_id,
            matricula,
            nome,
            data_admissao: dataAdmissao,
            position_id: positionId,
            ativo
          }]);
        
        if (error) {
          if (error.code === '23505') throw new Error('Já existe um servidor com esta matrícula nesta unidade.');
          throw error;
        }
      }

      setIsModalOpen(false);
      fetchServidores();
    } catch (err: any) {
      alert(err.message || 'Erro ao salvar servidor.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este servidor? A exclusão falhará se ele já tiver folgas lançadas.')) return;
    
    try {
      const { error } = await supabase.from('employees').delete().eq('id', id);
      if (error) {
        if (error.code === '23503') throw new Error('Este servidor possui histórico de folgas e não pode ser excluído. Em vez disso, altere o status para Inativo.');
        throw error;
      }
      fetchServidores();
    } catch (err: any) {
      alert(err.message || 'Erro ao excluir.');
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 'var(--space-6)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0 }}>Quadro de Servidores</h2>
          <p className="text-muted" style={{ margin: 0 }}>
            Gerencie os inspetores, agentes e auxiliares da sua unidade.
          </p>
        </div>
        <button className="btn btn-primary blueprint" onClick={() => openModal()}>
          <i className="corner tl"></i><i className="corner tr"></i><i className="corner bl"></i><i className="corner br"></i>
          + Novo Servidor
        </button>
      </div>

      <div className="blueprint card elev-sm" style={{ overflow: 'hidden' }}>
        <i className="corner tl"></i><i className="corner tr"></i><i className="corner bl"></i><i className="corner br"></i>
        
        {loading ? (
          <div style={{ padding: 'var(--space-6)', textAlign: 'center' }}>Carregando dados...</div>
        ) : servidores.length === 0 ? (
          <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            Nenhum servidor cadastrado na sua unidade.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-divider)' }}>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text-muted)' }}>Matrícula</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text-muted)' }}>Nome Completo</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text-muted)' }}>Cargo</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text-muted)' }}>Data Admissão</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text-muted)' }}>Status</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text-muted)', textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {servidores.map(emp => (
                  <tr key={emp.id} style={{ borderBottom: '1px solid var(--color-divider)' }}>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', fontFamily: 'monospace' }}>{emp.matricula}</td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 500 }}>{emp.nome}</td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                      <span className="tag" style={{ background: 'var(--color-surface)' }}>{emp.positions?.nome || 'N/A'}</span>
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                      {new Date(emp.data_admissao + 'T12:00:00Z').toLocaleDateString('pt-BR')}
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                      {emp.ativo 
                        ? <span className="tag" style={{ background: '#059669', color: 'white' }}>Ativo</span> 
                        : <span className="tag" style={{ background: '#4b5563', color: 'white' }}>Inativo</span>}
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: '12px' }} onClick={() => openModal(emp)}>✏️ Editar</button>
                      <button className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: '12px', color: 'var(--color-danger)' }} onClick={() => handleDelete(emp.id)}>🗑️ Excluir</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="blueprint card elev-md" style={{ width: '500px', padding: 'var(--space-6)', background: 'var(--color-surface)' }}>
            <i className="corner tl"></i><i className="corner tr"></i><i className="corner bl"></i><i className="corner br"></i>
            <h3 style={{ marginTop: 0, marginBottom: 'var(--space-4)' }}>
              {editId ? 'Editar Servidor' : 'Novo Servidor'}
            </h3>
            
            <form onSubmit={handleSave}>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                <div className="field">
                  <label>Matrícula *</label>
                  <input 
                    className="input" 
                    type="text" 
                    value={matricula} 
                    onChange={(e) => setMatricula(e.target.value)} 
                    required 
                    placeholder="Ex: 12345-6"
                  />
                </div>
                <div className="field">
                  <label>Data de Admissão *</label>
                  <input 
                    className="input" 
                    type="date" 
                    value={dataAdmissao} 
                    onChange={(e) => setDataAdmissao(e.target.value)} 
                    required 
                  />
                </div>
              </div>

              <div className="field" style={{ marginBottom: 'var(--space-3)' }}>
                <label>Nome Completo *</label>
                <input 
                  className="input" 
                  type="text" 
                  value={nome} 
                  onChange={(e) => setNome(e.target.value)} 
                  required 
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                <div className="field">
                  <label>Cargo *</label>
                  <select 
                    className="input" 
                    value={positionId} 
                    onChange={(e) => setPositionId(e.target.value)}
                    required
                  >
                    <option value="">Selecione o cargo...</option>
                    {positions.map(pos => (
                      <option key={pos.id} value={pos.id}>{pos.nome} ({pos.codigo})</option>
                    ))}
                  </select>
                </div>

                <div className="field" style={{ display: 'flex', flexDirection: 'column' }}>
                  <label>Status</label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={ativo} 
                      onChange={(e) => setAtivo(e.target.checked)} 
                      style={{ width: '18px', height: '18px' }}
                    />
                    {ativo ? 'Ativo' : 'Inativo'}
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary blueprint" disabled={isSubmitting}>
                  <i className="corner tl"></i><i className="corner tr"></i><i className="corner bl"></i><i className="corner br"></i>
                  {isSubmitting ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

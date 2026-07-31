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

  // Modal removido pois os dados vêm da importação da planilha

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



  return (
    <div>
      <div style={{ marginBottom: 'var(--space-6)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0 }}>Quadro de Servidores</h2>
          <p className="text-muted" style={{ margin: 0 }}>
            Listagem do efetivo importado pela administração central.
          </p>
        </div>
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

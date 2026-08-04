import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { ArrowLeft, Building2 } from 'lucide-react';

export const DetalhamentoEstabelecimento: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [estabelecimento, setEstabelecimento] = useState<any>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        if (!id) throw new Error('ID do estabelecimento não fornecido.');

        // Busca detalhes do estabelecimento
        const { data: estData, error: estError } = await supabase
          .from('establishments')
          .select('*')
          .eq('id', id)
          .single();

        if (estError) throw estError;
        setEstabelecimento(estData);

        // Busca servidores
        const { data: empData, error: empError } = await supabase
          .from('employees')
          .select(`
            id, matricula, nome,
            positions (nome)
          `)
          .eq('establishment_id', id)
          .order('nome');

        if (empError) throw empError;
        setEmployees(empData || []);
      } catch (err: any) {
        console.error(err);
        setError('Não foi possível carregar os detalhes. Tente novamente.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  if (loading) {
    return <div style={{ padding: 'var(--space-6)', textAlign: 'center' }}>Carregando dados do estabelecimento...</div>;
  }

  if (error || !estabelecimento) {
    return (
      <div style={{ padding: 'var(--space-6)', maxWidth: '1400px', margin: '0 auto' }}>
        <button className="btn btn-ghost" onClick={() => navigate(-1)} style={{ marginBottom: 'var(--space-4)', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          <ArrowLeft size={18} /> Voltar
        </button>
        <div className="alert alert-error">{error || 'Estabelecimento não encontrado.'}</div>
      </div>
    );
  }

  return (
    <div style={{ padding: 'var(--space-6)', maxWidth: '1400px', margin: '0 auto' }}>
      
      {/* Botão Voltar */}
      <button 
        className="btn btn-ghost" 
        onClick={() => navigate('/admin')} 
        style={{ marginBottom: 'var(--space-4)', display: 'inline-flex', alignItems: 'center', gap: '8px', padding: 0 }}
      >
        <ArrowLeft size={18} /> Voltar para o Dashboard
      </button>

      {/* Cabeçalho */}
      <div style={{ marginBottom: 'var(--space-6)', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ background: 'var(--color-primary-100)', color: 'var(--color-primary)', padding: '16px', borderRadius: '12px' }}>
          <Building2 size={32} />
        </div>
        <div>
          <h1 style={{ margin: '0 0 var(--space-2) 0', fontSize: '28px', color: 'var(--color-text-base)' }}>
            {estabelecimento.nome}
          </h1>
          <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '14px' }}>
            <span style={{ fontWeight: 500 }}>{estabelecimento.tipo || 'Unidade prisional'}</span> &bull; {estabelecimento.localizacao} &bull; {estabelecimento.complexidade || 'Complexidade N/A'}
          </p>
        </div>
      </div>

      {/* Tabela de Servidores */}
      <div className="blueprint card elev-sm" style={{ overflow: 'hidden' }}>
        <i className="corner tl"></i><i className="corner tr"></i><i className="corner bl"></i><i className="corner br"></i>
        
        <div style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--color-divider)' }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>Servidores Alocados ({employees.length})</h2>
        </div>

        {employees.length === 0 ? (
          <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            Nenhum servidor encontrado para este estabelecimento.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
              <thead style={{ background: 'var(--color-surface)' }}>
                <tr style={{ borderBottom: '1px solid var(--color-divider)' }}>
                  <th style={{ padding: 'var(--space-4)', color: 'var(--color-text-muted)', fontWeight: 600 }}>Matrícula</th>
                  <th style={{ padding: 'var(--space-4)', color: 'var(--color-text-muted)', fontWeight: 600 }}>Nome do Servidor</th>
                  <th style={{ padding: 'var(--space-4)', color: 'var(--color-text-muted)', fontWeight: 600 }}>Cargo</th>
                </tr>
              </thead>
              <tbody>
                {employees.map(emp => (
                  <tr key={emp.id} style={{ borderBottom: '1px solid var(--color-divider)' }}>
                    <td style={{ padding: 'var(--space-3) var(--space-4)' }}>{emp.matricula || '-'}</td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 500, color: 'var(--color-text-base)' }}>{emp.nome}</td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                      <span className="tag" style={{ background: 'var(--color-surface)', color: 'var(--color-text-base)', fontSize: '12px', fontWeight: 600 }}>
                        {emp.positions?.nome || 'N/A'}
                      </span>
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

import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Search } from 'lucide-react';

// Remove caracteres com significado especial na sintaxe de filtro do PostgREST
// (vírgula separa condições, ponto separa coluna.operador.valor, parênteses
// agrupam) antes de montar a string do .or() — nome e matrícula nunca usam
// esses caracteres legitimamente, então isso não muda nenhuma busca real.
const sanitizeFilterTerm = (term: string) => term.replace(/[,.()]/g, '');

type Position = {
  id: string;
  nome: string;
  codigo: string;
};

type Cycle = {
  id: string;
  nome: string;
  mes: number;
  ano: number;
  status: string;
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
  const [loading, setLoading] = useState(true);

  const [positions, setPositions] = useState<Position[]>([]);
  const [cycles, setCycles] = useState<Cycle[]>([]);

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPos, setSelectedPos] = useState('');
  const [selectedCycleId, setSelectedCycleId] = useState('');

  // Busca única dos combos (Cargos e Ciclos)
  useEffect(() => {
    const fetchCombos = async () => {
      try {
        const { data: posData } = await supabase.from('positions').select('id, nome, codigo').eq('ativo', true).order('nome');
        if (posData) setPositions(posData);

        const { data: cyclesData } = await supabase
          .from('cycles')
          .select('id, nome, mes, ano, status')
          .order('ano', { ascending: false })
          .order('mes', { ascending: false });
        if (cyclesData) setCycles(cyclesData);
      } catch (err) {
        console.error(err);
      }
    };
    fetchCombos();
  }, []);

  // Filtro de Ciclo: restringe aos servidores com plantão importado (shifts) naquele ciclo,
  // já que employees não tem vínculo direto com cycle_id — a lista de servidores "daquele
  // ciclo" é quem de fato apareceu na planilha importada para o período.
  const fetchServidores = useCallback(async () => {
    if (!profile?.establishment_id) return;
    setLoading(true);
    try {
      let employeeIds: string[] | null = null;

      if (selectedCycleId) {
        const { data: shiftsData, error: shiftsError } = await supabase
          .from('shifts')
          .select('employee_id')
          .eq('cycle_id', selectedCycleId)
          .eq('establishment_id', profile.establishment_id);

        if (shiftsError) throw shiftsError;

        employeeIds = Array.from(new Set((shiftsData || []).map((s: any) => s.employee_id)));
        if (employeeIds.length === 0) {
          setServidores([]);
          return;
        }
      }

      let query = supabase
        .from('employees')
        .select(`
          *,
          positions (id, nome, codigo)
        `)
        .eq('establishment_id', profile.establishment_id)
        .order('nome');

      if (employeeIds) {
        query = query.in('id', employeeIds);
      }
      if (selectedPos) {
        query = query.eq('position_id', selectedPos);
      }
      if (searchTerm) {
        const term = sanitizeFilterTerm(searchTerm);
        query = query.or(`nome.ilike.%${term}%,matricula.ilike.%${term}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      setServidores((data || []) as Employee[]);
    } catch (err) {
      console.error('Erro ao buscar servidores:', err);
    } finally {
      setLoading(false);
    }
  }, [profile, selectedCycleId, selectedPos, searchTerm]);

  // Debounce para a busca por termo (mesmo padrão da Consulta Global de Servidores do Admin)
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchServidores();
    }, 300);
    return () => clearTimeout(timer);
  }, [fetchServidores]);

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

      {/* Barra de Filtros */}
      <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-divider)', borderRadius: 'var(--radius-lg, 8px)', padding: 'var(--space-4)', marginBottom: 'var(--space-6)', display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: '1 1 240px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '6px' }}>
            Buscar Servidor
          </label>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', left: '12px', color: 'var(--color-text-muted)' }} />
            <input
              type="text"
              className="input"
              placeholder="Buscar por nome ou matrícula..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: '100%', padding: '10px 10px 10px 36px' }}
            />
          </div>
        </div>

        <div style={{ flex: '1 1 200px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '6px' }}>
            Cargo
          </label>
          <select
            className="input"
            value={selectedPos}
            onChange={(e) => setSelectedPos(e.target.value)}
            style={{ width: '100%', padding: '10px' }}
          >
            <option value="">Todos os Cargos</option>
            {positions.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        </div>

        <div style={{ flex: '1 1 200px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '6px' }}>
            Ciclo
          </label>
          <select
            className="input"
            value={selectedCycleId}
            onChange={(e) => setSelectedCycleId(e.target.value)}
            style={{ width: '100%', padding: '10px' }}
          >
            <option value="">Todos os Ciclos</option>
            {cycles.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>
      </div>

      <div className="blueprint card elev-sm" style={{ overflow: 'hidden' }}>
        <i className="corner tl"></i><i className="corner tr"></i><i className="corner bl"></i><i className="corner br"></i>

        {loading && servidores.length === 0 ? (
          <div style={{ padding: 'var(--space-6)', textAlign: 'center' }}>Carregando dados...</div>
        ) : servidores.length === 0 ? (
          <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            Nenhum servidor encontrado para os filtros aplicados.
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
                  <tr key={emp.id} style={{ borderBottom: '1px solid var(--color-divider)', opacity: loading ? 0.5 : 1 }}>
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

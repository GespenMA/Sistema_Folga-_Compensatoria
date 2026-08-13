import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { supabase, fetchAll } from '../../lib/supabase';
import { useSearchParams } from 'react-router-dom';
import { BadgeCheck, ChevronLeft, ChevronRight, Search } from 'lucide-react';

type Position = {
  id: string;
  nome: string;
};

type Establishment = {
  id: string;
  nome: string;
};

type Employee = {
  id: string;
  matricula: string;
  nome: string;
  data_admissao: string;
  ativo: boolean;
  positions?: Position;
  establishments?: Establishment;
};

const ITEMS_PER_PAGE = 20;

export const Servidores: React.FC = () => {
  const [servidores, setServidores] = useState<Employee[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [loading, setLoading] = useState(true);
  
  // Combos
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);

  const [searchParams] = useSearchParams();

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEst, setSelectedEst] = useState(searchParams.get('est_id') || '');
  const [selectedPos, setSelectedPos] = useState('');
  
  // Paginação
  const [page, setPage] = useState(1);
  
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
  
  // Estatísticas
  const [stats, setStats] = useState<Record<string, number>>({});

  // Busca inicial das listas de filtros
  useEffect(() => {
    const fetchCombos = async () => {
      try {
        const { data: estData } = await supabase.from('establishments').select('id, nome').eq('ativo', true).order('nome');
        if (estData) setEstablishments(estData);

        const { data: posData } = await supabase.from('positions').select('id, nome').eq('ativo', true).order('nome');
        if (posData) setPositions(posData);
      } catch (err) {
        console.error(err);
      }
    };
    fetchCombos();
  }, []);

  // Quando mudar filtros (term, est, pos), reseta a paginação
  useEffect(() => {
    setPage(1);
  }, [searchTerm, selectedEst, selectedPos]);

  // Busca os dados da tabela
  const fetchServidores = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('employees')
        .select(`
          id, matricula, nome, data_admissao, ativo,
          positions (id, nome),
          establishments (id, nome)
        `, { count: 'exact' });

      // Aplica filtros
      if (selectedEst) {
        query = query.eq('establishment_id', selectedEst);
      }
      if (selectedPos) {
        query = query.eq('position_id', selectedPos);
      }
      if (searchTerm) {
        query = query.or(`nome.ilike.%${searchTerm}%,matricula.ilike.%${searchTerm}%`);
      }

      // Ordenação e Paginação
      query = query.order('nome');
      
      const from = (page - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;
      
      if (error) throw error;
      
      setServidores(data as any[]);
      setTotalRecords(count || 0);

    } catch (err) {
      console.error('Erro ao buscar servidores:', err);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, selectedEst, selectedPos, page]);

  const fetchEstatisticas = useCallback(async () => {
    try {
      let query = supabase.from('employees').select('position_id');
      if (selectedEst) query = query.eq('establishment_id', selectedEst);
      if (selectedPos) query = query.eq('position_id', selectedPos);
      if (searchTerm) query = query.or(`nome.ilike.%${searchTerm}%,matricula.ilike.%${searchTerm}%`);

      const data = await fetchAll(query);

      const counts: Record<string, number> = {};
      data?.forEach(d => {
        if (d.position_id) {
          counts[d.position_id] = (counts[d.position_id] || 0) + 1;
        }
      });
      setStats(counts);
    } catch (err) {
      console.error('Erro ao buscar estatísticas:', err);
    }
  }, [searchTerm, selectedEst, selectedPos]);

  useEffect(() => {
    // Debounce para a busca por termo
    const timer = setTimeout(() => {
      fetchServidores();
      fetchEstatisticas();
    }, 300);
    return () => clearTimeout(timer);
  }, [fetchServidores, fetchEstatisticas]);


  const totalPages = Math.max(1, Math.ceil(totalRecords / ITEMS_PER_PAGE));

  return (
    <div style={{ paddingBottom: '40px' }}>
      
      <div style={{ marginBottom: 'var(--space-6)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BadgeCheck size={28} style={{ color: 'var(--color-primary)' }} />
            Consulta Global de Servidores
          </h2>
          <p className="text-muted" style={{ margin: '8px 0 0 0' }}>
            Visão consolidada de todo o efetivo estadual.
          </p>
        </div>
      </div>

      {/* Cards de Estatística */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        <div className="modern-card" style={{ padding: 'var(--space-4)', borderLeft: '4px solid var(--color-primary)' }}>
          <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Total de Servidores</div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--color-text-base)', marginTop: '4px' }}>{totalRecords}</div>
        </div>
        
        {Object.entries(stats).sort((a, b) => b[1] - a[1]).map(([posId, count]) => {
          const posName = positions.find(p => p.id === posId)?.nome || 'Sem Cargo';
          return (
            <div key={posId} className="modern-card" style={{ padding: 'var(--space-4)', borderLeft: '4px solid #64748b' }}>
              <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={posName}>{posName}</div>
              <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--color-text-base)', marginTop: '4px' }}>{count}</div>
            </div>
          )
        })}
      </div>

      {/* Barra de Filtros */}
      <div style={{ background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)', marginBottom: 'var(--space-6)', display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        
        <div style={{ flex: '1 1 250px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '6px' }}>
            Buscar Servidor
          </label>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', left: '12px', color: 'var(--color-text-muted)' }} />
            <input 
              type="text" 
              placeholder="Buscar por nome ou matrícula..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: '100%', padding: '10px 10px 10px 36px', borderRadius: '8px', border: '1px solid var(--color-border)', outline: 'none', background: '#fff' }}
            />
          </div>
        </div>

        <div style={{ flex: '1 1 200px', position: 'relative' }} ref={estDropdownRef}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '6px' }}>
            Estabelecimento Penal
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
                {selectedEst ? establishments.find(e => e.id === selectedEst)?.nome : 'Todos os Estabelecimentos'}
              </span>
            )}
          </div>

          {isEstDropdownOpen && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px', background: '#fff', border: '1px solid var(--color-border)', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', zIndex: 10, maxHeight: '250px', overflowY: 'auto' }}>
              <div 
                onClick={() => { setSelectedEst(''); setIsEstDropdownOpen(false); }}
                style={{ padding: '10px 12px', fontSize: '14px', cursor: 'pointer', background: selectedEst === '' ? 'var(--color-bg-elevated)' : 'transparent', borderBottom: '1px solid var(--color-border)', fontWeight: selectedEst === '' ? 600 : 400 }}
              >
                Todos os Estabelecimentos
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

        <div style={{ flex: '1 1 200px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '6px' }}>
            Cargo
          </label>
          <select 
            value={selectedPos} 
            onChange={(e) => setSelectedPos(e.target.value)} 
            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--color-border)', outline: 'none', background: '#fff' }}
          >
            <option value="">Todos os Cargos</option>
            {positions.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
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
                  <th style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text-muted)' }}>Estabelecimento Penal</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text-muted)' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {servidores.map(emp => (
                  <tr key={emp.id} style={{ borderBottom: '1px solid var(--color-divider)', opacity: loading ? 0.5 : 1 }}>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', fontFamily: 'monospace' }}>{emp.matricula || '-'}</td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 500, color: 'var(--color-text-base)' }}>{emp.nome}</td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                      <span className="tag" style={{ background: 'var(--color-surface)', color: 'var(--color-text-base)' }}>{emp.positions?.nome || 'N/A'}</span>
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text-base)' }}>
                      {emp.establishments?.nome || '-'}
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
        
        {/* Paginação */}
        {totalRecords > 0 && (
          <div style={{ padding: 'var(--space-4)', borderTop: '1px solid var(--color-divider)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '14px', color: 'var(--color-text-muted)' }}>
              Mostrando {Math.min((page - 1) * ITEMS_PER_PAGE + 1, totalRecords)} a {Math.min(page * ITEMS_PER_PAGE, totalRecords)} de {totalRecords} registros
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                className="btn btn-secondary" 
                disabled={page === 1} 
                onClick={() => setPage(p => Math.max(1, p - 1))}
                style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <ChevronLeft size={16} /> Anterior
              </button>
              <div style={{ display: 'flex', alignItems: 'center', padding: '0 12px', fontSize: '14px', fontWeight: 600 }}>
                {page} / {totalPages}
              </div>
              <button 
                className="btn btn-secondary" 
                disabled={page >= totalPages} 
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                Próxima <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

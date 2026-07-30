import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

type RelatorioItem = {
  id: string;
  requested_at: string;
  valor: number;
  status: string;
  employee_id: string;
  establishment_id: string;
  cycle_id: string;
  employees: { nome: string; matricula?: string } | null;
  positions: { codigo: string; nome: string } | null;
  establishments: { nome: string } | null;
  cycles: { nome: string; mes: number; ano: number } | null;
};

export const Relatorios: React.FC = () => {
  const [items, setItems] = useState<RelatorioItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Filtros
  const [ciclos, setCiclos] = useState<any[]>([]);
  const [estabelecimentos, setEstabelecimentos] = useState<any[]>([]);
  
  const [selectedCycle, setSelectedCycle] = useState<string>('');
  const [selectedEst, setSelectedEst] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('APROVADA'); // Começa filtrando APROVADA por padrão

  useEffect(() => {
    fetchFiltros();
  }, []);

  useEffect(() => {
    if (selectedCycle) {
      fetchRelatorio();
    } else {
      setItems([]);
    }
  }, [selectedCycle, selectedEst, selectedStatus]);

  const fetchFiltros = async () => {
    // Busca ciclos
    const { data: cData } = await supabase.from('cycles').select('id, nome, status').order('data_inicio', { ascending: false });
    if (cData) {
      setCiclos(cData);
      // Auto-selecionar o ciclo aberto se houver
      const aberto = cData.find(c => c.status === 'ABERTO' || c.status === 'REABERTO');
      if (aberto) setSelectedCycle(aberto.id);
      else if (cData.length > 0) setSelectedCycle(cData[0].id);
    }

    // Busca estabelecimentos
    const { data: eData } = await supabase.from('establishments').select('id, nome').eq('ativo', true).order('nome');
    if (eData) setEstabelecimentos(eData);
  };

  const fetchRelatorio = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      let query = supabase
        .from('purchase_requests')
        .select(`
          id, requested_at, valor, status,
          employees ( nome, matricula ),
          positions ( codigo, nome ),
          establishments ( nome ),
          cycles ( nome, mes, ano )
        `)
        .eq('cycle_id', selectedCycle);

      if (selectedStatus) {
        query = query.eq('status', selectedStatus);
      }

      if (selectedEst) {
        query = query.eq('establishment_id', selectedEst);
      }

      const { data, error } = await query;
      if (error) {
        setErrorMsg(error.message || 'Erro desconhecido ao buscar dados');
        throw error;
      }
      
      setItems((data ?? []) as unknown as RelatorioItem[]);
    } catch (error) {
      console.error('Erro ao buscar relatório:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    if (items.length === 0) return;

    // Cabeçalhos
    const headers = ['Servidor', 'Matrícula', 'Cargo', 'Unidade Penal', 'Ciclo', 'Data Solicitação', 'Status', 'Valor a Pagar (R$)'];
    
    // Linhas
    const rows = items.map(item => [
      `"${item.employees?.nome || 'Sem Nome'}"`,
      `"${item.employees?.matricula || ''}"`,
      `"${item.positions?.nome || item.positions?.codigo || ''}"`,
      `"${item.establishments?.nome || ''}"`,
      `"${item.cycles?.nome || ''}"`,
      `"${new Date(item.requested_at).toLocaleDateString('pt-BR')}"`,
      `"${item.status}"`,
      `"${item.valor.toFixed(2).replace('.', ',')}"`
    ]);

    const csvContent = [headers.join(';'), ...rows.join('\n')].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' }); // \uFEFF para Excel ler acentos
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Folha_Pagamento_Folgas_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalGeral = items.reduce((acc, curr) => acc + Number(curr.valor), 0);

  return (
    <div>
      <div style={{ marginBottom: 'var(--space-6)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ margin: 0 }}>Relatórios e Folha de Pagamento</h2>
          <p className="text-muted" style={{ margin: 0 }}>
            Exporte as compras de folgas APROVADAS para o setor financeiro.
          </p>
        </div>
        <button 
          className="btn btn-primary blueprint" 
          onClick={exportToCSV}
          disabled={items.length === 0}
          style={{ background: '#059669', borderColor: '#059669' }}
        >
          <i className="corner tl"></i><i className="corner tr"></i><i className="corner bl"></i><i className="corner br"></i>
          📥 Exportar CSV (Excel)
        </button>
      </div>

      {/* Filtros */}
      <div className="blueprint card elev-sm" style={{ padding: 'var(--space-5)', marginBottom: 'var(--space-6)', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-4)', background: 'var(--color-surface)' }}>
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>
            Filtrar por Ciclo *
          </label>
          <select className="input" value={selectedCycle} onChange={e => setSelectedCycle(e.target.value)}>
            {ciclos.map(c => (
              <option key={c.id} value={c.id}>{c.nome} {c.status === 'ABERTO' ? '(Aberto)' : ''}</option>
            ))}
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>
            Filtrar por Status
          </label>
          <select className="input" value={selectedStatus} onChange={e => setSelectedStatus(e.target.value)}>
            <option value="">Todos os Status</option>
            <option value="SOLICITADA">Solicitada (Pendente)</option>
            <option value="APROVADA">Aprovada (Comprada)</option>
            <option value="REJEITADA">Rejeitada</option>
            <option value="CANCELADA">Cancelada</option>
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>
            Filtrar por Unidade Penal
          </label>
          <select className="input" value={selectedEst} onChange={e => setSelectedEst(e.target.value)}>
            <option value="">Todas as Unidades (Estado Todo)</option>
            {estabelecimentos.map(e => (
              <option key={e.id} value={e.id}>{e.nome}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabela */}
      <div className="blueprint card elev-sm" style={{ overflow: 'hidden', background: 'var(--color-surface)' }}>
        <div style={{ padding: 'var(--space-4)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-divider)' }}>
          <h3 style={{ margin: 0, fontSize: '16px' }}>Listagem Consolidada ({items.length} registros)</h3>
          <div style={{ fontWeight: 600, color: 'var(--color-accent-700)', fontSize: '18px' }}>
            Total Geral: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalGeral)}
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--color-text-muted)' }}>Gerando relatório...</div>
        ) : errorMsg ? (
          <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--color-danger)' }}>
            Erro: {errorMsg}
          </div>
        ) : items.length === 0 ? (
          <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            Nenhum registro encontrado para estes filtros.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-divider)', background: 'rgba(0,0,0,0.02)' }}>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text-muted)' }}>Servidor</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text-muted)' }}>Matrícula</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text-muted)' }}>Cargo</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text-muted)' }}>Unidade</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text-muted)' }}>Data Aprovação</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text-muted)' }}>Status</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text-muted)', textAlign: 'right' }}>Valor a Pagar (R$)</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--color-divider)' }}>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 500 }}>{item.employees?.nome}</td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)' }}>{item.employees?.matricula}</td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)' }}>{item.positions?.codigo}</td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)' }}>{item.establishments?.nome}</td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)' }}>{new Date(item.requested_at).toLocaleDateString('pt-BR')}</td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                      {item.status === 'APROVADA' && <span className="tag" style={{ background: '#059669', color: 'white' }}>APROVADA</span>}
                      {item.status === 'SOLICITADA' && <span className="tag" style={{ background: '#d97706', color: 'white' }}>PENDENTE</span>}
                      {item.status === 'REJEITADA' && <span className="tag" style={{ background: '#dc2626', color: 'white' }}>REJEITADA</span>}
                      {item.status === 'CANCELADA' && <span className="tag" style={{ background: '#6b7280', color: 'white' }}>CANCELADA</span>}
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right', fontWeight: 600, color: item.status === 'APROVADA' ? '#059669' : 'var(--color-text-muted)' }}>
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.valor)}
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

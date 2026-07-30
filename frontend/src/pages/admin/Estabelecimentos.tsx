import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

type PlanningLimit = {
  quantidade_planejada: number;
  position_id: string;
  positions: {
    codigo: string;
  };
};

type CycleData = {
  id: string;
  cycle_id: string;
  total_orcado: number;
  cycles: { status: string };
  planning_limits: PlanningLimit[];
};

type Estabelecimento = {
  id: string;
  nome: string;
  tipo: string;
  localizacao: string;
  complexidade: string;
  ativo: boolean;
  cycle_establishments?: CycleData[];
};

type BasePosition = {
  id: string;
  codigo: string;
};

export const Estabelecimentos: React.FC = () => {
  const [estabelecimentos, setEstabelecimentos] = useState<Estabelecimento[]>([]);
  const [basePositions, setBasePositions] = useState<BasePosition[]>([]);
  const [activeCycleId, setActiveCycleId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Estados do Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState('Unidade prisional');
  const [localizacao, setLocalizacao] = useState('');
  const [complexidade, setComplexidade] = useState('');
  
  // Limites Planejados no Modal
  const [qtdInsp, setQtdInsp] = useState<number>(0);
  const [qtdAgt, setQtdAgt] = useState<number>(0);
  const [qtdAux, setQtdAux] = useState<number>(0);
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      // Pega IDs dos cargos base para sabermos em qual inserir
      const { data: posData } = await supabase.from('positions').select('id, codigo');
      if (posData) setBasePositions(posData);

      // Pega o Ciclo Ativo mais relevante (RASCUNHO, ABERTO ou REABERTO)
      const { data: cycleData } = await supabase
        .from('cycles')
        .select('id, status')
        .in('status', ['RASCUNHO', 'ABERTO', 'REABERTO'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cycleData) setActiveCycleId(cycleData.id);

      await fetchEstabelecimentos();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchEstabelecimentos = async () => {
    try {
      const { data, error } = await supabase
        .from('establishments')
        .select(`
          *,
          cycle_establishments (
            id,
            cycle_id,
            total_orcado,
            cycles ( status ),
            planning_limits (
              position_id,
              quantidade_planejada,
              positions ( codigo )
            )
          )
        `)
        .order('nome');

      if (error) throw error;
      if (data) setEstabelecimentos(data as Estabelecimento[]);
    } catch (err) {
      console.error('Erro ao buscar estabelecimentos:', err);
    }
  };

  const openNewModal = () => {
    setEditId(null);
    setNome('');
    setTipo('Unidade prisional');
    setLocalizacao('');
    setComplexidade('');
    setQtdInsp(0);
    setQtdAgt(0);
    setQtdAux(0);
    setIsModalOpen(true);
  };

  const openEditModal = (est: Estabelecimento) => {
    setEditId(est.id);
    setNome(est.nome);
    setTipo(est.tipo || 'Unidade prisional');
    setLocalizacao(est.localizacao || '');
    setComplexidade(est.complexidade || '');
    
    // Carrega qtd do ciclo ativo
    const currentCycleData = est.cycle_establishments?.find(ce => ce.cycle_id === activeCycleId);
    
    const getLimit = (codigo: string) => {
      const limit = currentCycleData?.planning_limits?.find(pl => pl.positions?.codigo === codigo);
      return limit ? limit.quantidade_planejada : 0;
    };

    setQtdInsp(getLimit('INSP'));
    setQtdAgt(getLimit('APT'));
    setQtdAux(getLimit('ASP'));

    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este estabelecimento? Ele será bloqueado se houver histórico atrelado.')) return;
    
    try {
      const { error } = await supabase.from('establishments').delete().eq('id', id);
      if (error) {
        if (error.code === '23503') {
           alert('Não é possível excluir. Este estabelecimento já possui histórico financeiro (Ciclos) ou usuários atrelados.');
        } else {
           throw error;
        }
      } else {
        fetchEstabelecimentos();
      }
    } catch (err: any) {
      alert(err.message || 'Erro ao excluir.');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !tipo.trim()) return;

    setIsSubmitting(true);
    try {
      let estId = editId;

      if (editId) {
        // Atualizar Estabelecimento
        const { error } = await supabase
          .from('establishments')
          .update({ nome, tipo, localizacao, complexidade })
          .eq('id', editId);
        if (error) throw error;
      } else {
        // Criar Estabelecimento
        const { data, error } = await supabase.from('establishments').insert([
          { nome, tipo, localizacao, complexidade }
        ]).select('id').single();
        if (error) throw error;
        estId = data.id;
      }
      
      // Salvar os limites se houver um ciclo ativo
      if (activeCycleId && estId) {
        // Verifica se já existe cycle_establishments
        const estData = estabelecimentos.find(e => e.id === estId);
        const currentCycleData = estData?.cycle_establishments?.find(ce => ce.cycle_id === activeCycleId);
        
        let cycleEstId = currentCycleData?.id;

        if (!cycleEstId) {
          // Cria o vínculo financeiro para este ciclo com orçamento zerado (ou manteremos o q for passado futuramente)
          const { data: ceData, error: ceError } = await supabase.from('cycle_establishments').insert([
            { cycle_id: activeCycleId, establishment_id: estId, total_orcado: 0 }
          ]).select('id').single();
          
          if (ceError) throw ceError;
          cycleEstId = ceData.id;
        }

        // Helpers
        const getPosId = (codigo: string) => basePositions.find(p => p.codigo === codigo)?.id;
        const inspId = getPosId('INSP');
        const aptId = getPosId('APT');
        const aspId = getPosId('ASP');

        // Upsert limits (Se houver conflito na UK cycle_establishment_id + position_id)
        if (cycleEstId) {
          const limitsToUpsert = [];
          if (inspId) limitsToUpsert.push({ cycle_establishment_id: cycleEstId, position_id: inspId, quantidade_planejada: Number(qtdInsp) });
          if (aptId) limitsToUpsert.push({ cycle_establishment_id: cycleEstId, position_id: aptId, quantidade_planejada: Number(qtdAgt) });
          if (aspId) limitsToUpsert.push({ cycle_establishment_id: cycleEstId, position_id: aspId, quantidade_planejada: Number(qtdAux) });

          if (limitsToUpsert.length > 0) {
            const { error: plError } = await supabase.from('planning_limits').upsert(limitsToUpsert, {
              onConflict: 'cycle_establishment_id, position_id'
            });
            if (plError) throw plError;
          }
        }
      }

      setIsModalOpen(false);
      fetchEstabelecimentos();
    } catch (err: any) {
      alert(err.message || 'Ocorreu um erro ao salvar.');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 'var(--space-6)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0 }}>Estabelecimentos</h2>
          <p className="text-muted" style={{ margin: 0 }}>
            Gerencie as unidades penais e ajuste os limites planejados para o ciclo atual.
          </p>
        </div>
        <button className="btn btn-primary" onClick={openNewModal}>
          Novo Estabelecimento
        </button>
      </div>

      <div className="blueprint card elev-sm" style={{ overflow: 'hidden' }}>
        <i className="corner tl"></i><i className="corner tr"></i><i className="corner bl"></i><i className="corner br"></i>
        
        {loading ? (
          <div style={{ padding: 'var(--space-6)', textAlign: 'center' }}>Carregando dados...</div>
        ) : estabelecimentos.length === 0 ? (
          <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            Nenhum estabelecimento encontrado.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-divider)' }}>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text-muted)' }}>Estabelecimento Penal</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text-muted)' }}>Tipo</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text-muted)' }}>Localização</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text-muted)' }}>Complexidade</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text-muted)' }}>Total Orçado</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text-muted)', textAlign: 'center' }}>Inspetores</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text-muted)', textAlign: 'center' }}>Agentes (APT)</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text-muted)', textAlign: 'center' }}>Auxiliares (ASP)</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text-muted)', textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {estabelecimentos.map(est => {
                  // Pega os dados orçamentários do ciclo ativo correspondente
                  const currentCycleData = est.cycle_establishments?.find(ce => ce.cycle_id === activeCycleId);
                  
                  // Helper para achar limite por código do cargo
                  const getLimit = (codigo: string) => {
                    const limit = currentCycleData?.planning_limits?.find(pl => pl.positions?.codigo === codigo);
                    return limit ? limit.quantidade_planejada : 0;
                  };

                  return (
                    <tr key={est.id} style={{ borderBottom: '1px solid var(--color-divider)' }}>
                      <td style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 500 }}>{est.nome}</td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        <span className="tag" style={{ background: est.tipo === 'Unidade de apoio' ? '#1e3a8a' : '#4b5563', color: 'white' }}>
                          {est.tipo || 'Unidade prisional'}
                        </span>
                      </td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)' }}>{est.localizacao}</td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        <span className="tag" style={{ background: 'var(--color-surface)' }}>{est.complexidade || 'N/A'}</span>
                      </td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 600, color: 'var(--color-accent-700)' }}>
                        {currentCycleData?.total_orcado !== undefined 
                          ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(currentCycleData.total_orcado)
                          : '-'}
                      </td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'center' }}>{getLimit('INSP')}</td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'center' }}>{getLimit('APT')}</td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'center' }}>{getLimit('ASP')}</td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: '12px' }} onClick={() => openEditModal(est)}>✏️ Editar</button>
                        <button className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: '12px', color: 'var(--color-danger)' }} onClick={() => handleDelete(est.id)}>🗑️ Excluir</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal para criar/editar estabelecimento */}
      {isModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="blueprint card elev-md" style={{ width: '600px', padding: 'var(--space-6)', background: 'var(--color-surface)' }}>
            <i className="corner tl"></i><i className="corner tr"></i><i className="corner bl"></i><i className="corner br"></i>
            <h3 style={{ marginTop: 0, marginBottom: 'var(--space-4)' }}>
              {editId ? 'Editar Estabelecimento' : 'Novo Estabelecimento'}
            </h3>
            
            <form onSubmit={handleSave}>
              <div className="field" style={{ marginBottom: 'var(--space-3)' }}>
                <label>Nome do Estabelecimento *</label>
                <input 
                  className="input" 
                  type="text" 
                  value={nome} 
                  onChange={(e) => setNome(e.target.value)} 
                  required 
                  placeholder="Ex: Penitenciária XYZ"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                <div className="field">
                  <label>Tipo *</label>
                  <select 
                    className="input" 
                    value={tipo} 
                    onChange={(e) => setTipo(e.target.value)}
                    required
                  >
                    <option value="Unidade prisional">Unidade prisional</option>
                    <option value="Unidade de apoio">Unidade de apoio</option>
                  </select>
                </div>
                <div className="field">
                  <label>Localização</label>
                  <select 
                    className="input" 
                    value={localizacao} 
                    onChange={(e) => setLocalizacao(e.target.value)}
                  >
                    <option value="">Selecione...</option>
                    <option value="Capital">Capital</option>
                    <option value="Capital - Complexo">Capital - Complexo</option>
                    <option value="Capital - Apoio">Capital - Apoio</option>
                    <option value="Interior">Interior</option>
                  </select>
                </div>
              </div>

              <div className="field" style={{ marginBottom: 'var(--space-4)' }}>
                <label>Complexidade</label>
                <select 
                  className="input" 
                  value={complexidade} 
                  onChange={(e) => setComplexidade(e.target.value)}
                >
                  <option value="">Selecione...</option>
                  <option value="Baixa Complexidade">Baixa Complexidade</option>
                  <option value="Média Complexidade">Média Complexidade</option>
                  <option value="Média Alta Complexidade">Média Alta Complexidade</option>
                  <option value="Alta Complexidade">Alta Complexidade</option>
                  <option value="Especial">Especial</option>
                  <option value="Apoio">Apoio</option>
                </select>
              </div>

              <div style={{ borderTop: '1px solid var(--color-divider)', margin: 'var(--space-4) 0', paddingTop: 'var(--space-4)' }}>
                <h4 style={{ margin: '0 0 var(--space-3) 0' }}>Limites do Ciclo Atual</h4>
                <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)' }}>
                  Ajuste a quantidade máxima permitida de folgas por cargo para este estabelecimento.
                </p>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
                  <div className="field">
                    <label style={{ fontSize: '11px' }}>Qtd. Inspetor</label>
                    <input 
                      className="input" 
                      type="number" 
                      min="0"
                      value={qtdInsp} 
                      onChange={(e) => setQtdInsp(Number(e.target.value))} 
                    />
                  </div>
                  <div className="field">
                    <label style={{ fontSize: '11px' }}>Qtd. Agente (APT)</label>
                    <input 
                      className="input" 
                      type="number" 
                      min="0"
                      value={qtdAgt} 
                      onChange={(e) => setQtdAgt(Number(e.target.value))} 
                    />
                  </div>
                  <div className="field">
                    <label style={{ fontSize: '11px' }}>Qtd. Aux. (ASP)</label>
                    <input 
                      className="input" 
                      type="number" 
                      min="0"
                      value={qtdAux} 
                      onChange={(e) => setQtdAux(Number(e.target.value))} 
                    />
                  </div>
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

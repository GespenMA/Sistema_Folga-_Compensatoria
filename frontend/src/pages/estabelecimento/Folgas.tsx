import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

type Employee = {
  id: string;
  nome: string;
  matricula: string;
  saldo_plantoes: number;
  positions?: { nome: string; codigo: string };
};

type Shift = {
  id: string;
  periodo_inicio: string;
  periodo_fim: string;
  quantidade_plantoes: number;
  observacao: string;
  employees: {
    id: string;
    nome: string;
    matricula: string;
    positions: { codigo: string };
  };
};

export const Folgas: React.FC = () => {
  const { profile } = useAuth();
  const [activeCycle, setActiveCycle] = useState<any>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [employeeId, setEmployeeId] = useState('');
  const [periodoInicio, setPeriodoInicio] = useState('');
  const [periodoFim, setPeriodoFim] = useState('');
  const [quantidadePlantoes, setQuantidadePlantoes] = useState<number>('');
  const [observacao, setObservacao] = useState('');
  const [shiftEdicao, setShiftEdicao] = useState<Shift | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [buscaServidor, setBuscaServidor] = useState('');

  // Busca nas tabelas
  const [buscaTabelaServidor, setBuscaTabelaServidor] = useState('');
  const [buscaTabelaPlantao, setBuscaTabelaPlantao] = useState('');

  useEffect(() => {
    if (profile?.establishment_id) {
      fetchInitialData();
    }
  }, [profile]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const { data: cycleData } = await supabase
        .from('cycles')
        .select('*')
        .in('status', ['ABERTO', 'REABERTO'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cycleData) {
        setActiveCycle(cycleData);
        await fetchData(cycleData.id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchData = async (cycleId: string) => {
    try {
      // 1. Funcionários e seus Saldos
      const { data: empData } = await supabase
        .from('employees')
        .select('id, nome, matricula, saldo_plantoes, positions(nome, codigo)')
        .eq('establishment_id', profile!.establishment_id)
        .eq('ativo', true)
        .order('nome');
        
      if (empData) setEmployees(empData as unknown as Employee[]);

      // 2. Plantões Lançados neste Ciclo
      const { data: shiftData } = await supabase
        .from('shifts')
        .select(`
          id, periodo_inicio, periodo_fim, quantidade_plantoes, observacao,
          employees (id, nome, matricula, positions(codigo))
        `)
        .eq('cycle_id', cycleId)
        .order('created_at', { ascending: false });

      if (shiftData) setShifts(shiftData as unknown as Shift[]);
    } catch (err) {
      console.error(err);
    }
  };

  const openModal = () => {
    setShiftEdicao(null);
    setEmployeeId('');
    setPeriodoInicio('');
    setPeriodoFim('');
    setQuantidadePlantoes('');
    setObservacao('');
    setBuscaServidor('');
    setIsModalOpen(true);
  };

  const openEditModal = (shift: Shift) => {
    setShiftEdicao(shift);
    setEmployeeId(shift.employees.id);
    setPeriodoInicio(shift.periodo_inicio);
    setPeriodoFim(shift.periodo_fim);
    setQuantidadePlantoes(shift.quantidade_plantoes);
    setObservacao(shift.observacao || '');
    setBuscaServidor('');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.establishment_id || !activeCycle) return;

    if (periodoFim > activeCycle.data_fim) {
      alert(`O Período Fim não pode ultrapassar o encerramento do ciclo atual (${new Date(activeCycle.data_fim + 'T12:00:00Z').toLocaleDateString('pt-BR')}).`);
      return;
    }

    setIsSubmitting(true);

    try {
      if (shiftEdicao) {
        const { error } = await supabase.from('shifts')
          .update({
            employee_id: employeeId,
            periodo_inicio: periodoInicio,
            periodo_fim: periodoFim,
            quantidade_plantoes: Number(quantidadePlantoes),
            observacao
          })
          .eq('id', shiftEdicao.id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase.from('shifts')
          .insert([{
            employee_id: employeeId,
            cycle_id: activeCycle.id,
            periodo_inicio: periodoInicio,
            periodo_fim: periodoFim,
            quantidade_plantoes: Number(quantidadePlantoes),
            observacao,
            created_by: profile.id
          }]);
        
        if (error) throw error;
      }

      setIsModalOpen(false);
      fetchData(activeCycle.id); // Recarrega para trazer os novos saldos atualizados pela Trigger
    } catch (err: any) {
      alert(err.message || 'Erro ao salvar plantão. Pode haver conflito de datas.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelShift = async (shift: Shift) => {
    if (!window.confirm('Tem certeza que deseja cancelar este registro de plantões? O saldo do servidor será reduzido.')) return;
    
    try {
      const { error } = await supabase.from('shifts').delete().eq('id', shift.id);
      if (error) {
        if (error.message.includes('folgas ativas que dependem')) {
           alert('Ação negada: O servidor já consumiu folgas que dependem destes plantões (Saldo ficaria negativo). Para excluir este plantão, cancele a solicitação de compra da folga antes.');
        } else {
           throw error;
        }
      } else {
        fetchData(activeCycle.id);
      }
    } catch (err: any) {
      console.error("ERRO COMPLETO:", err);
      alert(`Erro detalhado: ${JSON.stringify(err, null, 2)} \n\n${err.message || 'Erro ao cancelar plantão.'}`);
    }
  };

  // Calculando estatísticas dos cards
  const totalServidores = employees.length;
  const totalPlantoesLancados = shifts.reduce((acc, curr) => acc + curr.quantidade_plantoes, 0);
  const folgasProntas = employees.filter(emp => emp.saldo_plantoes >= 21).length;

  // Filtrando tabelas
  const filteredEmployeesTable = employees.filter(emp => 
    (emp.nome || '').toLowerCase().includes(buscaTabelaServidor.toLowerCase()) || 
    (emp.matricula || '').includes(buscaTabelaServidor)
  );
  
  const filteredShiftsTable = shifts.filter(shift => 
    (shift.employees?.nome || '').toLowerCase().includes(buscaTabelaPlantao.toLowerCase()) || 
    (shift.employees?.matricula || '').includes(buscaTabelaPlantao)
  );

  if (loading) return <div>Carregando banco de plantões...</div>;

  return (
    <div>
      <div style={{ marginBottom: 'var(--space-6)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0 }}>Lançamento de Plantões</h2>
          <p className="text-muted" style={{ margin: 0 }}>
            Registre os dias trabalhados. O sistema acumulará o saldo e gerará 1 folga automaticamente a cada 21 plantões.
          </p>
        </div>
        {activeCycle && (
          <button className="btn btn-primary blueprint" onClick={openModal}>
            <i className="corner tl"></i><i className="corner tr"></i><i className="corner bl"></i><i className="corner br"></i>
            + Lançar Plantão
          </button>
        )}
      </div>

      {!activeCycle ? (
        <div className="blueprint card" style={{ padding: 'var(--space-6)', textAlign: 'center', background: 'var(--color-surface)' }}>
          <div style={{ fontSize: '48px', marginBottom: 'var(--space-4)' }}>🔒</div>
          <h3 style={{ margin: '0 0 var(--space-2) 0' }}>Ciclo Fechado ou Inexistente</h3>
          <p className="text-muted">Não há nenhum ciclo aberto no momento para registrar plantões.</p>
        </div>
      ) : (
        <>
          {/* Cards de Resumo */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
            <div className="blueprint card elev-sm" style={{ padding: '12px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--color-surface)' }}>
              <span style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 600 }}>Total de Servidores</span>
              <span style={{ fontSize: '32px', fontWeight: 800, color: 'var(--color-text)', marginTop: '4px' }}>{totalServidores}</span>
            </div>
            <div className="blueprint card elev-sm" style={{ padding: '12px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--color-surface)' }}>
              <span style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 600 }}>Plantões Lançados (Ciclo)</span>
              <span style={{ fontSize: '32px', fontWeight: 800, color: 'var(--color-text)', marginTop: '4px' }}>{totalPlantoesLancados}</span>
            </div>
            <div className="blueprint card elev-sm" style={{ padding: '12px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--color-surface)' }}>
              <span style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 600 }}>Folgas Prontas para Compra</span>
              <span style={{ fontSize: '32px', fontWeight: 800, color: 'var(--color-primary)', marginTop: '4px' }}>{folgasProntas}</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 'var(--space-6)' }}>
            {/* Lado Esquerdo: Saldos */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                <h3 style={{ margin: 0 }}>Saldos da Unidade</h3>
              </div>
              <input 
                type="text" 
                className="input" 
                placeholder="Buscar servidor..." 
                value={buscaTabelaServidor}
                onChange={(e) => setBuscaTabelaServidor(e.target.value)}
                style={{ marginBottom: 'var(--space-3)' }}
              />
              <div className="blueprint card elev-sm" style={{ overflow: 'hidden' }}>
                {filteredEmployeesTable.length === 0 ? (
                  <div style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                    Nenhum servidor encontrado.
                  </div>
                ) : (
                  <div>
                    {filteredEmployeesTable.map(emp => (
                      <div key={emp.id} style={{ padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--color-divider)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '13px', textTransform: 'uppercase' }}>{emp.nome}</div>
                            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{emp.positions?.codigo} ({emp.matricula})</div>
                          </div>
                          <div style={{ textAlign: 'right', fontWeight: 600, fontSize: '14px', color: emp.saldo_plantoes >= 21 ? 'var(--color-primary)' : 'inherit' }}>
                            {emp.saldo_plantoes} <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>/21</span>
                          </div>
                        </div>
                        {/* Barra de Progresso */}
                        <div style={{ height: '6px', background: 'var(--color-divider)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ 
                            height: '100%', 
                            background: emp.saldo_plantoes >= 21 ? 'var(--color-primary)' : '#3b82f6', 
                            width: `${Math.min((emp.saldo_plantoes / 21) * 100, 100)}%`,
                            transition: 'width 0.3s ease'
                          }}></div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '8px' }}>
                ℹ️ Ao atingir 21 plantões no saldo, o sistema desconta 21 pontos e envia 1 Folga para a tela de "Comprar Folgas".
              </div>
            </div>

            {/* Lado Direito: Lançamentos */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                <h3 style={{ margin: 0 }}>Plantões Lançados no Ciclo ({activeCycle?.nome})</h3>
              </div>
              <input 
                type="text" 
                className="input" 
                placeholder="Buscar por servidor ou matrícula..." 
                value={buscaTabelaPlantao}
                onChange={(e) => setBuscaTabelaPlantao(e.target.value)}
                style={{ marginBottom: 'var(--space-3)' }}
              />
              <div className="blueprint card elev-sm" style={{ overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--color-divider)', background: 'var(--color-surface)' }}>
                      <th style={{ padding: 'var(--space-3)' }}>Servidor</th>
                      <th style={{ padding: 'var(--space-3)' }}>Período Trabalhado</th>
                      <th style={{ padding: 'var(--space-3)', textAlign: 'center' }}>Qtd. Plantões</th>
                      <th style={{ padding: 'var(--space-3)', textAlign: 'right' }}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredShiftsTable.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                          Nenhum plantão registrado ou encontrado neste ciclo.
                        </td>
                      </tr>
                    ) : filteredShiftsTable.map(shift => (
                      <tr key={shift.id} style={{ borderBottom: '1px solid var(--color-divider)' }}>
                        <td style={{ padding: 'var(--space-3)' }}>
                          <div style={{ fontWeight: 500 }}>{shift.employees?.nome}</div>
                          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{shift.employees?.positions?.codigo}</div>
                        </td>
                        <td style={{ padding: 'var(--space-3)' }}>
                          {new Date(shift.periodo_inicio + 'T12:00:00Z').toLocaleDateString('pt-BR')} a {new Date(shift.periodo_fim + 'T12:00:00Z').toLocaleDateString('pt-BR')}
                        </td>
                        <td style={{ padding: 'var(--space-3)', textAlign: 'center', fontWeight: 700, color: 'var(--color-primary)' }}>
                          +{shift.quantidade_plantoes}
                        </td>
                        <td style={{ padding: 'var(--space-3)', textAlign: 'right' }}>
                          <button className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: '12px', marginRight: '4px' }} onClick={() => openEditModal(shift)}>
                            ✏️
                          </button>
                          <button className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: '12px', color: 'var(--color-danger)' }} onClick={() => handleCancelShift(shift)}>
                            🗑️
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
            </div>
          </div>
        </div>
      </>
      )}

      {isModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="blueprint card elev-md" style={{ width: '500px', padding: 'var(--space-6)', background: 'var(--color-surface)' }}>
            <i className="corner tl"></i><i className="corner tr"></i><i className="corner bl"></i><i className="corner br"></i>
            <h3 style={{ marginTop: 0, marginBottom: 'var(--space-4)' }}>
              {shiftEdicao ? 'Editar Lançamento' : 'Registrar Plantões Trabalhados'}
            </h3>
            
            <form onSubmit={handleSave}>
              <div className="field" style={{ marginBottom: 'var(--space-3)' }}>
                <label>Servidor *</label>
                <input 
                  type="text" 
                  className="input" 
                  placeholder="Buscar por nome ou matrícula..." 
                  value={buscaServidor}
                  onChange={(e) => setBuscaServidor(e.target.value)}
                  style={{ marginBottom: '8px' }}
                />
                <select 
                  className="input" 
                  value={employeeId} 
                  onChange={(e) => setEmployeeId(e.target.value)}
                  required
                >
                  <option value="">Selecione o servidor...</option>
                  {employees.filter(emp => 
                    (emp.nome || '').toLowerCase().includes((buscaServidor || '').toLowerCase()) || 
                    (emp.matricula || '').includes(buscaServidor || '')
                  ).map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.nome} - Mat: {emp.matricula} ({emp.positions?.codigo}) (Saldo atual: {emp.saldo_plantoes})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                <div className="field">
                  <label>Período Início *</label>
                  <input 
                    className="input" 
                    type="date" 
                    value={periodoInicio} 
                    onChange={(e) => setPeriodoInicio(e.target.value)} 
                    required 
                  />
                </div>
                <div className="field">
                  <label>Período Fim *</label>
                  <input 
                    className="input" 
                    type="date" 
                    value={periodoFim} 
                    max={activeCycle?.data_fim}
                    onChange={(e) => setPeriodoFim(e.target.value)} 
                    required 
                  />
                </div>
              </div>
              
              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: 'var(--space-4)', background: 'var(--color-bg)', padding: '10px', borderRadius: '4px', borderLeft: '3px solid var(--color-primary)' }}>
                <strong>ℹ️ Dica de Preenchimento:</strong><br/>
                <strong>Período Início:</strong> O dia em que o servidor iniciou este bloco de plantões.<br/>
                <strong>Período Fim:</strong> O dia do último plantão trabalhado (lembrando que não pode ultrapassar a data de encerramento do ciclo atual).
              </div>

              <div className="field" style={{ marginBottom: 'var(--space-3)' }}>
                <label>Qtd. de Plantões Trabalhados *</label>
                <input 
                  className="input" 
                  type="number" 
                  min="1"
                  value={quantidadePlantoes} 
                  onChange={(e) => setQuantidadePlantoes(Number(e.target.value))} 
                  required 
                />
              </div>

              <div className="field" style={{ marginBottom: 'var(--space-4)' }}>
                <label>Observação (Opcional)</label>
                <textarea 
                  className="input" 
                  value={observacao} 
                  onChange={(e) => setObservacao(e.target.value)} 
                  rows={2}
                />
              </div>

              <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary blueprint" disabled={isSubmitting}>
                  <i className="corner tl"></i><i className="corner tr"></i><i className="corner bl"></i><i className="corner br"></i>
                  {isSubmitting ? 'Salvando...' : 'Salvar Plantões'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

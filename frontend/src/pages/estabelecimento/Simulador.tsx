import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

type Cargo = {
  id: string;
  nome: string;
  codigo: string;
  valorFolga: number;
};

export const Simulador: React.FC = () => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [totalOrcado, setTotalOrcado] = useState(0);
  const [totalComprometido, setTotalComprometido] = useState(0);
  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [activeCycle, setActiveCycle] = useState<any>(null);

  // Mapa de quantidades de folgas desejadas por cargo: { [cargo_id]: number }
  const [quantidades, setQuantidades] = useState<Record<string, number>>({});

  useEffect(() => {
    if (profile?.establishment_id) {
      fetchData();
    }
  }, [profile]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Obter ciclo ativo
      const { data: cycleData } = await supabase
        .from('cycles')
        .select('*')
        .in('status', ['ABERTO', 'REABERTO'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cycleData) {
        setActiveCycle(cycleData);
        
        // 2. Obter Cargos e Valores Ativos
        const { data: pvData } = await supabase
          .from('position_values')
          .select('valor, position_id, positions(id, nome, codigo)')
          .is('vigencia_fim', null);
          
        const pvMap: Record<string, number> = {};
        if (pvData) {
          const cargosMapeados = pvData.map((pv: any) => {
            pvMap[pv.position_id || pv.positions?.id] = Number(pv.valor);
            return {
              id: pv.positions.id,
              nome: pv.positions.nome,
              codigo: pv.positions.codigo,
              valorFolga: Number(pv.valor)
            };
          }).sort((a, b) => a.nome.localeCompare(b.nome));
          
          setCargos(cargosMapeados);
        }

        // 3. Obter limite orçamentário
        const { data: ceData } = await supabase
          .from('cycle_establishments')
          .select('total_orcado, planning_limits(quantidade_planejada, position_id)')
          .eq('cycle_id', cycleData.id)
          .eq('establishment_id', profile!.establishment_id)
          .maybeSingle();

        if (ceData && ceData.planning_limits) {
          let recalc = 0;
          ceData.planning_limits.forEach((pl: any) => {
            recalc += (pl.quantidade_planejada || 0) * (pvMap[pl.position_id] || 0);
          });
          setTotalOrcado(recalc);
        }

        // Orçamento já comprometido (Aprovado + Aguardando Aprovação) neste ciclo, para que o
        // simulador projete a partir do saldo real, não do teto planejado original.
        const { data: comprometidosData } = await supabase
          .from('purchase_requests')
          .select('valor')
          .eq('cycle_id', cycleData.id)
          .eq('establishment_id', profile!.establishment_id)
          .in('status', ['SOLICITADA', 'APROVADA']);

        const comprometido = (comprometidosData || []).reduce((acc: number, r: any) => acc + Number(r.valor), 0);
        setTotalComprometido(comprometido);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleQuantidadeChange = (id: string, qtd: string) => {
    const val = parseInt(qtd, 10);
    setQuantidades(prev => ({
      ...prev,
      [id]: isNaN(val) || val < 0 ? 0 : val
    }));
  };

  const handleZerar = () => setQuantidades({});

  const handleMax = (id: string, valorFolga: number) => {
    const custoAtualSimulado = cargos.reduce((acc, cargo) => {
      const qtd = quantidades[cargo.id] || 0;
      return acc + (qtd * cargo.valorFolga);
    }, 0);
    
    const saldoAtual = (totalOrcado - totalComprometido) - custoAtualSimulado;
    if (saldoAtual <= 0) return; // Não há saldo

    const maxAdicional = Math.floor(saldoAtual / valorFolga);
    if (maxAdicional > 0) {
      setQuantidades(prev => ({
        ...prev,
        [id]: (prev[id] || 0) + maxAdicional
      }));
    }
  };

  if (loading) {
    return <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--color-text-muted)' }}>Carregando simulador...</div>;
  }

  if (!activeCycle) {
    return (
      <div style={{ width: '100%' }}>
        <div className="blueprint card" style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
          <h3>Nenhum ciclo aberto</h3>
          <p className="text-muted">Não é possível simular sem um ciclo ativo.</p>
        </div>
      </div>
    );
  }

  const custoTotalSimulado = cargos.reduce((acc, cargo) => {
    const qtd = quantidades[cargo.id] || 0;
    return acc + (qtd * cargo.valorFolga);
  }, 0);

  const totalFolgasCenario = cargos.reduce((acc, cargo) => {
    return acc + (quantidades[cargo.id] || 0);
  }, 0);

  // Saldo real disponível para simular: teto planejado menos o que já está Aprovado ou
  // Aguardando Aprovação — evita que o simulador ofereça um poder de compra que não existe mais.
  const disponivelReal = totalOrcado - totalComprometido;

  const saldoRestante = disponivelReal - custoTotalSimulado;
  const isEstourado = saldoRestante < 0;

  // Cores dinâmicas para o gráfico de barra
  const colorPalette = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f43f5e'];

  return (
    <div style={{ width: '100%' }}>
      <div style={{ marginBottom: 'var(--space-6)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ margin: '0 0 var(--space-2) 0' }}>Simulador Orçamentário</h2>
          <p className="text-muted" style={{ margin: 0 }}>
            Simule o remanejamento do seu orçamento para planejar a compra de folgas. 
            Altere a quantidade de folgas por cargo para ver o impacto no saldo.
          </p>
        </div>
        <button className="btn btn-secondary" onClick={handleZerar} disabled={totalFolgasCenario === 0}>
          🗑️ Zerar Simulação
        </button>
      </div>

      {/* Gráfico de Distribuição */}
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)' }}>Distribuição do Orçamento</span>
          <span style={{ fontSize: '13px', fontWeight: 600, color: isEstourado ? '#dc2626' : 'var(--color-text)' }}>
            {((custoTotalSimulado / disponivelReal) * 100).toFixed(1)}% Comprometido
          </span>
        </div>
        <div style={{ width: '100%', height: '24px', background: 'var(--color-divider)', borderRadius: '12px', overflow: 'hidden', display: 'flex' }}>
          {cargos.map((cargo, index) => {
            const qtd = quantidades[cargo.id] || 0;
            const gasto = qtd * cargo.valorFolga;
            if (gasto === 0) return null;
            const widthPct = (gasto / Math.max(disponivelReal, custoTotalSimulado)) * 100;
            return (
              <div 
                key={cargo.id} 
                title={`${cargo.nome}: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(gasto)}`}
                style={{ width: `${widthPct}%`, background: colorPalette[index % colorPalette.length], height: '100%', transition: 'width 0.3s ease' }}
              />
            );
          })}
          {/* Espaço vazio se não estourou e não gastou tudo */}
          {!isEstourado && custoTotalSimulado < totalOrcado && (
            <div style={{ flex: 1, background: 'var(--color-divider)' }} />
          )}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginTop: '12px' }}>
          {cargos.filter(c => quantidades[c.id] > 0).map((cargo, index) => (
            <div key={cargo.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 500 }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: colorPalette[index % colorPalette.length] }} />
              {cargo.nome} ({quantidades[cargo.id]})
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        <div className="blueprint card elev-md" style={{ padding: 'var(--space-5)', textAlign: 'center', background: 'var(--color-surface)' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Orçamento Disponível</div>
          <div style={{ fontSize: '28px', fontWeight: 800 }}>
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(disponivelReal)}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
            de {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalOrcado)} orçado
            {totalComprometido > 0 && <> · {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalComprometido)} já comprometido</>}
          </div>
        </div>
        
        <div className="blueprint card elev-md" style={{ padding: 'var(--space-5)', textAlign: 'center', background: 'var(--color-surface)' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Custo Simulado</div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: custoTotalSimulado > 0 ? 'var(--color-warning)' : 'var(--color-text)' }}>
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(custoTotalSimulado)}
          </div>
        </div>

        <div className="blueprint card elev-md" style={{ padding: 'var(--space-5)', textAlign: 'center', background: 'var(--color-surface)' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Total de Folgas</div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--color-primary)' }}>
            {totalFolgasCenario}
          </div>
        </div>

        <div className="blueprint card elev-md" style={{ padding: 'var(--space-5)', textAlign: 'center', background: isEstourado ? '#fef2f2' : '#f0fdf4', border: isEstourado ? '1px solid #fca5a5' : '1px solid #bbf7d0' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: isEstourado ? '#b91c1c' : '#15803d', textTransform: 'uppercase', marginBottom: '8px' }}>Saldo Remanescente</div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: isEstourado ? '#dc2626' : '#16a34a' }}>
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(saldoRestante)}
          </div>
        </div>
      </div>

      <div className="blueprint card elev-sm" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: 'var(--color-surface)', borderBottom: '1px solid var(--color-divider)' }}>
              <th style={{ padding: 'var(--space-4)', fontSize: '13px' }}>Cargo</th>
              <th style={{ padding: 'var(--space-4)', fontSize: '13px' }}>Valor (1 Folga)</th>
              <th style={{ padding: 'var(--space-4)', fontSize: '13px', textAlign: 'center' }}>Poder Máximo de Compra*</th>
              <th style={{ padding: 'var(--space-4)', fontSize: '13px', width: '200px' }}>Simular Qtd. de Folgas</th>
              <th style={{ padding: 'var(--space-4)', fontSize: '13px', textAlign: 'right' }}>Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {cargos.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--color-text-muted)' }}>Nenhum cargo encontrado.</td>
              </tr>
            ) : cargos.map((cargo) => {
              const qtd = quantidades[cargo.id] || 0;
              const subtotal = qtd * cargo.valorFolga;
              const poderDeCompra = cargo.valorFolga > 0 ? Math.floor(Math.max(disponivelReal, 0) / cargo.valorFolga) : 0;

              return (
                <tr key={cargo.id} style={{ borderBottom: '1px solid var(--color-divider)' }}>
                  <td style={{ padding: 'var(--space-4)' }}>
                    <div style={{ fontWeight: 600 }}>{cargo.nome}</div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{cargo.codigo}</div>
                  </td>
                  <td style={{ padding: 'var(--space-4)', fontWeight: 600 }}>
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cargo.valorFolga)}
                  </td>
                  <td style={{ padding: 'var(--space-4)', textAlign: 'center' }}>
                    <span style={{ background: 'var(--color-bg)', padding: '4px 8px', borderRadius: '4px', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                      {poderDeCompra} folgas
                    </span>
                  </td>
                  <td style={{ padding: 'var(--space-4)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input 
                        type="number" 
                        className="input" 
                        min="0"
                        value={qtd || ''}
                        onChange={(e) => handleQuantidadeChange(cargo.id, e.target.value)}
                        placeholder="0"
                        style={{ textAlign: 'center', fontWeight: 600, fontSize: '16px', width: '80px' }}
                      />
                      <button 
                        className="btn" 
                        style={{ padding: '4px 8px', fontSize: '11px', background: '#e0e7ff', color: '#4f46e5', border: 'none', fontWeight: 700 }}
                        onClick={() => handleMax(cargo.id, cargo.valorFolga)}
                        title="Preencher com o máximo de folgas que o saldo restante permite"
                      >
                        MÁX
                      </button>
                    </div>
                  </td>
                  <td style={{ padding: 'var(--space-4)', textAlign: 'right', fontWeight: 700, color: qtd > 0 ? 'var(--color-text)' : 'var(--color-text-muted)' }}>
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(subtotal)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: 'var(--space-3)', textAlign: 'right' }}>
        * O <strong>Poder Máximo de Compra</strong> indica quantas folgas poderiam ser compradas caso o saldo disponível da unidade (já descontando o que está Aprovado ou Aguardando Aprovação) fosse direcionado apenas para este cargo.
      </div>
    </div>
  );
};

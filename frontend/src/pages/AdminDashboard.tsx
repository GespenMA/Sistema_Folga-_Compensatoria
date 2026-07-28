import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

type DashboardData = {
  estabelecimentosCount: number;
  cicloAtual: string;
  folgasCompradas: number;
  valorTotalAprovado: number;
  consumoUnidades: any[];
};

export const AdminDashboard: React.FC = () => {
  const [data, setData] = useState<DashboardData>({
    estabelecimentosCount: 0,
    cicloAtual: 'Nenhum ciclo aberto',
    folgasCompradas: 0,
    valorTotalAprovado: 0,
    consumoUnidades: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        // Busca contagem de estabelecimentos ativos
        const { count: estCount } = await supabase
          .from('establishments')
          .select('*', { count: 'exact', head: true })
          .eq('ativo', true);

        // Busca ciclo atual (ABERTO)
        const { data: ciclos } = await supabase
          .from('cycles')
          .select('id, nome')
          .eq('status', 'ABERTO')
          .order('data_inicio', { ascending: false })
          .limit(1);
          
        const activeCycle = ciclos && ciclos.length > 0 ? ciclos[0] : null;

        let totalCompradas = 0;
        let valorTotal = 0;
        let consumoUnidades: any[] = [];

        if (activeCycle) {
          // Busca folgas compradas no ciclo ativo
          const { data: requests } = await supabase
            .from('purchase_requests')
            .select('valor, establishment_id')
            .eq('cycle_id', activeCycle.id)
            .in('status', ['SOLICITADA', 'APROVADA']); // Considerando gastos reais e pendentes

          if (requests) {
            totalCompradas = requests.length;
            valorTotal = requests.reduce((acc, req) => acc + Number(req.valor), 0);
          }

          // Busca orçamentos das unidades para o ciclo ativo
          const { data: cycleEst } = await supabase
            .from('cycle_establishments')
            .select(`
              total_orcado,
              establishment_id,
              establishments ( nome )
            `)
            .eq('cycle_id', activeCycle.id);

          if (cycleEst) {
            consumoUnidades = cycleEst.map((est: any) => {
              const estRequests = requests?.filter(r => r.establishment_id === est.establishment_id) || [];
              const gasto = estRequests.reduce((acc, req) => acc + Number(req.valor), 0);
              return {
                id: est.establishment_id,
                nome: est.establishments?.nome || 'Desconhecido',
                orcado: est.total_orcado,
                gasto: gasto,
                saldo: est.total_orcado - gasto,
                percentual: est.total_orcado > 0 ? (gasto / est.total_orcado) * 100 : 0
              };
            });
            // Ordenar por maior % de consumo
            consumoUnidades.sort((a, b) => b.percentual - a.percentual);
          }
        }

        setData({
          estabelecimentosCount: estCount || 0,
          cicloAtual: activeCycle ? activeCycle.nome : 'Nenhum ciclo aberto',
          folgasCompradas: totalCompradas,
          valorTotalAprovado: valorTotal,
          consumoUnidades
        });
      } catch (error) {
        console.error('Erro ao buscar dados do dashboard:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, []);

  return (
    <div>
      <h2 style={{ marginBottom: 0 }}>Dashboard da Administração</h2>
      <p className="text-muted" style={{ marginBottom: 'var(--space-6)' }}>
        Visão consolidada de todas as unidades
      </p>

      {loading ? (
        <div style={{ padding: 'var(--space-4)', color: 'var(--color-text-muted)' }}>
          Carregando dados reais do banco de dados...
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
          
          <div className="blueprint card elev-sm">
            <i className="corner tl"></i><i className="corner tr"></i><i className="corner bl"></i><i className="corner br"></i>
            <div className="card-kicker">Estabelecimentos</div>
            <div className="card-title" style={{ fontSize: '26px' }}>{data.estabelecimentosCount}</div>
          </div>

          <div className="blueprint card elev-sm">
            <i className="corner tl"></i><i className="corner tr"></i><i className="corner bl"></i><i className="corner br"></i>
            <div className="card-kicker">Ciclo Atual</div>
            <div className="card-title" style={{ fontSize: '26px' }}>{data.cicloAtual}</div>
          </div>

          <div className="blueprint card elev-sm">
            <i className="corner tl"></i><i className="corner tr"></i><i className="corner bl"></i><i className="corner br"></i>
            <div className="card-kicker">Folgas Compradas</div>
            <div className="card-title" style={{ fontSize: '26px' }}>{data.folgasCompradas}</div>
          </div>

          <div className="blueprint card elev-sm">
            <i className="corner tl"></i><i className="corner tr"></i><i className="corner bl"></i><i className="corner br"></i>
            <div className="card-kicker">Valor Total Aprovado / Pendente</div>
            <div className="card-title" style={{ fontSize: '26px' }}>
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(data.valorTotalAprovado)}
            </div>
          </div>

        </div>

        {data.cicloAtual !== 'Nenhum ciclo aberto' && (
          <div className="blueprint card elev-sm" style={{ padding: 'var(--space-6)', background: 'var(--color-surface)', overflow: 'hidden' }}>
            <h3 style={{ marginTop: 0, marginBottom: 'var(--space-4)' }}>Consumo Orçamentário por Unidade Penal</h3>
            
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-divider)' }}>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text-muted)' }}>Unidade Penal</th>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text-muted)', textAlign: 'right' }}>Orçado (R$)</th>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text-muted)', textAlign: 'right' }}>Gasto (R$)</th>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text-muted)', textAlign: 'right' }}>Saldo Restante (R$)</th>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text-muted)' }}>% Consumo</th>
                  </tr>
                </thead>
                <tbody>
                  {data.consumoUnidades.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                        Nenhum orçamento configurado para as unidades neste ciclo.
                      </td>
                    </tr>
                  ) : (
                    data.consumoUnidades.map((unidade) => (
                      <tr key={unidade.id} style={{ borderBottom: '1px solid var(--color-divider)' }}>
                        <td style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 500 }}>{unidade.nome}</td>
                        <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right' }}>
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(unidade.orcado)}
                        </td>
                        <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right', color: unidade.saldo < 0 ? 'var(--color-danger)' : 'inherit' }}>
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(unidade.gasto)}
                        </td>
                        <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right', fontWeight: 600, color: unidade.saldo < 0 ? 'var(--color-danger)' : 'var(--color-accent-700)' }}>
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(unidade.saldo)}
                        </td>
                        <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '100px', height: '8px', background: 'var(--color-bg)', borderRadius: '4px', overflow: 'hidden' }}>
                              <div style={{ 
                                width: `${Math.min(unidade.percentual, 100)}%`, 
                                height: '100%', 
                                background: unidade.percentual > 90 ? 'var(--color-danger)' : unidade.percentual > 75 ? '#d97706' : '#059669' 
                              }} />
                            </div>
                            <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{unidade.percentual.toFixed(1)}%</span>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
        </>
      )}
    </div>
  );
};

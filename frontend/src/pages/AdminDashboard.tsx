import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

type DashboardData = {
  estabelecimentosCount: number;
  cicloAtual: string;
  folgasCompradas: number;
  valorTotalAprovado: number;
};

export const AdminDashboard: React.FC = () => {
  const [data, setData] = useState<DashboardData>({
    estabelecimentosCount: 0,
    cicloAtual: 'Nenhum ciclo aberto',
    folgasCompradas: 0,
    valorTotalAprovado: 0
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
          .select('nome')
          .eq('status', 'ABERTO')
          .order('data_inicio', { ascending: false })
          .limit(1);
          
        const cicloAtualNome = ciclos && ciclos.length > 0 ? ciclos[0].nome : 'Nenhum ciclo aberto';

        // Aqui futuramente buscaremos as folgas compradas e o valor total 
        // a partir da tabela 'purchase_requests' com status APROVADA
        const { data: requests } = await supabase
          .from('purchase_requests')
          .select('valor')
          .eq('status', 'APROVADA');

        let totalCompradas = 0;
        let valorTotal = 0;

        if (requests) {
          totalCompradas = requests.length;
          valorTotal = requests.reduce((acc, req) => acc + Number(req.valor), 0);
        }

        setData({
          estabelecimentosCount: estCount || 0,
          cicloAtual: cicloAtualNome,
          folgasCompradas: totalCompradas,
          valorTotalAprovado: valorTotal
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
            <div className="card-kicker">Valor Total Aprovado</div>
            <div className="card-title" style={{ fontSize: '26px' }}>
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(data.valorTotalAprovado)}
            </div>
          </div>

        </div>
      )}
    </div>
  );
};

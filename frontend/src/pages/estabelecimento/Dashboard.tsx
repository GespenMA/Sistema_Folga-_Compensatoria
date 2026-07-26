import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

export const EstabelecimentoDashboard: React.FC = () => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeCycle, setActiveCycle] = useState<any>(null);
  const [cycleEst, setCycleEst] = useState<any>(null);
  const [limits, setLimits] = useState<any[]>([]);

  useEffect(() => {
    if (profile?.establishment_id) {
      fetchDashboardData();
    }
  }, [profile]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // 1. Check for open cycle
      const { data: cycleData, error: cycleError } = await supabase
        .from('cycles')
        .select('*')
        .eq('status', 'ABERTO')
        .single();

      if (cycleError && cycleError.code !== 'PGRST116') throw cycleError; // ignore 'no rows'

      if (cycleData) {
        setActiveCycle(cycleData);

        // 2. Fetch cycle_establishment for this unit
        const { data: estData, error: estError } = await supabase
          .from('cycle_establishments')
          .select('id, total_orcado')
          .eq('cycle_id', cycleData.id)
          .eq('establishment_id', profile!.establishment_id)
          .single();

        if (estError && estError.code !== 'PGRST116') throw estError;

        if (estData) {
          setCycleEst(estData);

          // 3. Fetch limits
          const { data: limitsData, error: limitsError } = await supabase
            .from('planning_limits')
            .select(`
              quantidade_planejada,
              positions ( codigo, nome )
            `)
            .eq('cycle_establishment_id', estData.id);

          if (limitsError) throw limitsError;
          if (limitsData) setLimits(limitsData);
        }
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getLimit = (codigo: string) => {
    const l = limits.find(lim => lim.positions?.codigo === codigo);
    return l ? l.quantidade_planejada : 0;
  };

  if (loading) return <div>Carregando painel...</div>;

  return (
    <div>
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <h2 style={{ margin: 0 }}>Dashboard da Unidade Penal</h2>
        <p className="text-muted" style={{ margin: 0 }}>
          Bem-vindo, {profile?.nome}. Acompanhe aqui os recursos liberados para sua unidade.
        </p>
      </div>

      {!activeCycle ? (
        <div className="blueprint card" style={{ padding: 'var(--space-6)', textAlign: 'center', background: 'var(--color-surface)' }}>
          <div style={{ fontSize: '48px', marginBottom: 'var(--space-4)' }}>🔒</div>
          <h3 style={{ margin: '0 0 var(--space-2) 0' }}>Nenhum Ciclo Aberto</h3>
          <p className="text-muted" style={{ margin: 0 }}>
            No momento, não há nenhum ciclo aberto para compras de folga. 
            Aguarde a liberação do Administrador Geral.
          </p>
        </div>
      ) : !cycleEst ? (
        <div className="blueprint card" style={{ padding: 'var(--space-6)', textAlign: 'center', background: 'var(--color-surface)', border: '1px solid var(--color-danger)' }}>
          <h3 style={{ margin: '0 0 var(--space-2) 0', color: 'var(--color-danger)' }}>Unidade sem Orçamento</h3>
          <p className="text-muted" style={{ margin: 0 }}>
            O ciclo "{activeCycle.nome}" está aberto, mas não há orçamento cadastrado para a sua unidade. 
            Entre em contato com a gestão.
          </p>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
            
            {/* CARD ORÇAMENTO TOTAL */}
            <div className="blueprint card elev-md" style={{ padding: 'var(--space-5)', background: '#059669', color: 'white' }}>
              <i className="corner tl"></i><i className="corner tr"></i><i className="corner bl"></i><i className="corner br"></i>
              <div style={{ fontSize: '13px', opacity: 0.9, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
                Orçamento Liberado
              </div>
              <div style={{ fontSize: '32px', fontWeight: 600 }}>
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cycleEst.total_orcado)}
              </div>
              <div style={{ fontSize: '12px', marginTop: '8px', opacity: 0.8 }}>
                Ciclo: {activeCycle.nome}
              </div>
            </div>

            {/* CARD INSPETOR */}
            <div className="blueprint card elev-md" style={{ padding: 'var(--space-5)', background: 'var(--color-surface)' }}>
              <i className="corner tl"></i><i className="corner tr"></i><i className="corner bl"></i><i className="corner br"></i>
              <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
                Cota - Inspetores
              </div>
              <div style={{ fontSize: '32px', fontWeight: 600, color: 'var(--color-text)' }}>
                {getLimit('INSP')} <span style={{ fontSize: '16px', color: 'var(--color-text-muted)', fontWeight: 400 }}>folgas</span>
              </div>
            </div>

            {/* CARD AGENTE */}
            <div className="blueprint card elev-md" style={{ padding: 'var(--space-5)', background: 'var(--color-surface)' }}>
              <i className="corner tl"></i><i className="corner tr"></i><i className="corner bl"></i><i className="corner br"></i>
              <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
                Cota - Agentes (APT)
              </div>
              <div style={{ fontSize: '32px', fontWeight: 600, color: 'var(--color-text)' }}>
                {getLimit('APT')} <span style={{ fontSize: '16px', color: 'var(--color-text-muted)', fontWeight: 400 }}>folgas</span>
              </div>
            </div>

            {/* CARD AUXILIAR */}
            <div className="blueprint card elev-md" style={{ padding: 'var(--space-5)', background: 'var(--color-surface)' }}>
              <i className="corner tl"></i><i className="corner tr"></i><i className="corner bl"></i><i className="corner br"></i>
              <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
                Cota - Auxiliares (ASP)
              </div>
              <div style={{ fontSize: '32px', fontWeight: 600, color: 'var(--color-text)' }}>
                {getLimit('ASP')} <span style={{ fontSize: '16px', color: 'var(--color-text-muted)', fontWeight: 400 }}>folgas</span>
              </div>
            </div>

          </div>

          <div className="blueprint card elev-sm" style={{ padding: 'var(--space-6)', background: 'var(--color-surface)' }}>
            <h3 style={{ margin: '0 0 var(--space-4) 0' }}>Mural de Avisos</h3>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '14px', lineHeight: '1.6' }}>
              <strong>Atenção:</strong> As solicitações de compra de folgas devem ser realizadas até o final da vigência deste ciclo ({new Date(activeCycle.data_fim).toLocaleDateString('pt-BR')}).<br/>
              Acompanhe seu limite de cotas para não ultrapassar o orçamento planejado para a sua unidade.
            </p>
          </div>
        </>
      )}

    </div>
  );
};

import re

def patch_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Update Import
    content = content.replace(
        "import { supabase } from '../../lib/supabase';",
        "import { supabase, fetchAll } from '../../lib/supabase';"
    )

    # 2. Update DashboardTab
    content = content.replace(
        "type DashboardTab = 'geral' | 'ranking';",
        "type DashboardTab = 'geral' | 'evolucao_yoy' | 'ranking';"
    )

    # 3. Add states for YoY
    state_block = "  const [servSortDir, setServSortDir] = useState<SortDirection>('desc');"
    new_state_block = state_block + """
  
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [yoyData, setYoyData] = useState<any[]>([]);
  const [yoyLoading, setYoyLoading] = useState(false);
  const availableYears = useMemo(() => Array.from(new Set(cycles.map(c => c.ano))).sort((a: any, b: any) => b - a), [cycles]);
"""
    content = content.replace(state_block, new_state_block)

    # 4. Add fetchYoyData
    fetch_yoy_code = """
  const fetchYoyData = async (year: number) => {
    if (!profile?.establishment_id) return;
    setYoyLoading(true);
    try {
      const yearCycles = cycles.filter(c => c.ano === year).sort((a, b) => a.mes - b.mes);
      const cycleIds = yearCycles.map(c => c.id);
      if (cycleIds.length === 0) { setYoyData([]); return; }
      
      // Build a fresh pvMap directly to avoid caching issues
      const { data: pvs } = await supabase.from('position_values').select('valor, positions(codigo)').is('vigencia_fim', null);
      const pvMap: Record<string, number> = {};
      if (pvs) pvs.forEach((p: any) => { if (p.positions?.codigo) pvMap[p.positions.codigo] = Number(p.valor); });

      const cEstsQuery = supabase.from('cycle_establishments')
        .select('cycle_id, total_orcado, planning_limits(quantidade_planejada, positions(codigo))')
        .eq('establishment_id', profile.establishment_id)
        .in('cycle_id', cycleIds);

      const reqsQuery = supabase.from('purchase_requests')
        .select('cycle_id, valor, status, positions(codigo)')
        .eq('establishment_id', profile.establishment_id)
        .in('cycle_id', cycleIds)
        .in('status', ['APROVADA', 'SOLICITADA']);

      const [cEsts, reqs] = await Promise.all([
        fetchAll(cEstsQuery),
        fetchAll(reqsQuery)
      ]);
      
      const cycleData = yearCycles.map(c => {
        let orcado = 0; let gasto = 0;
        cEsts?.filter((ce: any) => ce.cycle_id === c.id).forEach((ce: any) => {
           let calc = 0;
           if (ce.planning_limits) ce.planning_limits.forEach((pl: any) => { 
               const code = pl.positions?.codigo;
               calc += (pl.quantidade_planejada || 0) * (pvMap[code] || 0); 
           });
           if (calc > 0) orcado += calc; else orcado += Number(ce.total_orcado || 0);
        });
        reqs?.filter((r: any) => r.cycle_id === c.id).forEach((r: any) => {
           let val = Number(r.valor);
           const code = r.positions?.codigo;
           if (!val && code && pvMap[code]) val = pvMap[code];
           gasto += val || 0;
        });
        let shortName = c.nome;
        if (shortName.includes('/')) shortName = shortName.split('/')[0];
        
        return { mes: shortName, nomeCompleto: c.nome, mesNum: c.mes, orcado, gasto, percentual: 0, variacao: null as number | null };
      });

      for (let i = 0; i < cycleData.length; i++) {
        const curr = cycleData[i];
        const prev = i > 0 ? cycleData[i - 1] : null;
        
        curr.percentual = curr.orcado > 0 ? (curr.gasto / curr.orcado) * 100 : 0;
        
        if (prev && prev.gasto > 0) {
          curr.variacao = ((curr.gasto - prev.gasto) / prev.gasto) * 100;
        } else if (prev && prev.gasto === 0 && curr.gasto > 0) {
          curr.variacao = 100;
        }
      }

      setYoyData(cycleData);
    } catch (e) { console.error('Erro ao buscar Evolução YoY:', e); } finally { setYoyLoading(false); }
  };

  useEffect(() => {
    if (activeTab === 'evolucao_yoy' && selectedYear && cycles.length > 0) {
      void fetchYoyData(selectedYear);
    }
  }, [activeTab, selectedYear, cycles]);
"""
    
    # Insert before useEffect for profile?.establishment_id
    content = content.replace("  useEffect(() => {\n    if (profile?.establishment_id) {", fetch_yoy_code + "\n  useEffect(() => {\n    if (profile?.establishment_id) {")

    # 5. Add Tab button
    search_tab = """        <button
          className={`dashboard-tab${activeTab === 'ranking' ? ' dashboard-tab--active' : ''}`}
          onClick={() => setActiveTab('ranking')}
        >
          🏆 Ranking da Unidade
        </button>"""
        
    replacement_tab = """        <button
          className={`dashboard-tab${activeTab === 'evolucao_yoy' ? ' dashboard-tab--active' : ''}`}
          onClick={() => setActiveTab('evolucao_yoy')}
        >
          Evolução YoY
        </button>
""" + search_tab
    content = content.replace(search_tab, replacement_tab)

    # 6. Formatting helper
    getFormatCurrency = "const getFormatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);"
    if "const getFormatCurrency =" not in content:
        content = content.replace("  const totalGlobal = aprovadas.reduce(", "  " + getFormatCurrency + "\n  const totalGlobal = aprovadas.reduce(")
        
    # Wait, getFormatCurrency may already exist in some form or we can just use new Intl.NumberFormat in YoY panel.
    
    # 7. Add Panel content
    panel_content = """      {activeTab === 'evolucao_yoy' && (
        <div id="evolucao-yoy-panel" className="dashboard-panel" role="tabpanel" tabIndex={0}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#111827', margin: 0 }}>Evolução Anual ({selectedYear})</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>Filtrar Ano:</label>
              <select className="input" value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
          
          {yoyLoading ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#64748b' }}>Carregando dados...</div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                <div className="modern-card" style={{ gap: '8px', padding: '16px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-neutral-600)', textTransform: 'uppercase' }}>Total Orçado no Período</div>
                  <div style={{ fontSize: '24px', fontWeight: 700, color: '#111827' }}>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(yoyData.reduce((acc, curr) => acc + curr.orcado, 0))}</div>
                </div>
                <div className="modern-card" style={{ gap: '8px', padding: '16px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-neutral-600)', textTransform: 'uppercase' }}>Total Gasto no Período</div>
                  <div style={{ fontSize: '24px', fontWeight: 700, color: '#111827' }}>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(yoyData.reduce((acc, curr) => acc + curr.gasto, 0))}</div>
                </div>
              </div>

              <div className="modern-card" style={{ minHeight: '400px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '16px', color: '#334155' }}>Orçado vs. Gasto (Mensal)</h4>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={yoyData} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                    <XAxis dataKey="mes" type="category" />
                    <YAxis type="number" width={60} tickFormatter={(value) => 'R$ ' + (value / 1000).toFixed(0) + 'k'} />
                    <RechartsTooltip content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        const variacaoCor = data.variacao > 0 ? '#ef4444' : (data.variacao < 0 ? '#10b981' : '#64748b');
                        return (
                          <div style={{ background: '#fff', padding: '12px', border: '1px solid #e2e8f0', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                            <p style={{ margin: '0 0 8px', fontWeight: 600, color: '#0f172a' }}>{data.nomeCompleto}</p>
                            <p style={{ margin: '4px 0', color: '#3b82f6', fontSize: '13px' }}>Orçado: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(data.orcado)}</p>
                            <p style={{ margin: '4px 0', color: '#10b981', fontSize: '13px' }}>Gasto: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(data.gasto)} <span style={{ color: '#64748b', fontSize: '11px' }}>({data.percentual.toFixed(1)}%)</span></p>
                            {data.variacao !== null && data.variacao !== undefined && (
                              <p style={{ margin: '8px 0 0', paddingTop: '8px', borderTop: '1px solid #e2e8f0', fontSize: '13px', color: '#475569' }}>
                                Variação p/ mês ant.: <strong style={{ color: variacaoCor }}>{data.variacao > 0 ? '+' : ''}{data.variacao.toFixed(1)}%</strong>
                              </p>
                            )}
                          </div>
                        );
                      }
                      return null;
                    }} />
                    <Legend />
                    <Bar dataKey="orcado" name="Orçado" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="gasto" name="Gasto" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              
              <div className="modern-card" style={{ marginTop: '24px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '16px', color: '#334155' }}>Detalhamento da Variação de Gastos (Ciclo a Ciclo)</h4>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#475569' }}>
                        <th style={{ padding: '12px 16px' }}>Ciclo</th>
                        <th style={{ padding: '12px 16px', textAlign: 'right' }}>Orçado</th>
                        <th style={{ padding: '12px 16px', textAlign: 'right' }}>Gasto</th>
                        <th style={{ padding: '12px 16px', textAlign: 'center' }}>% Consumido</th>
                        <th style={{ padding: '12px 16px', textAlign: 'right' }}>Variação (vs Anterior)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {yoyData.map((d, idx) => (
                        <tr key={d.nomeCompleto} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '12px 16px', fontWeight: 500 }}>{d.nomeCompleto}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', color: '#3b82f6' }}>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(d.orcado)}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', color: '#10b981', fontWeight: 500 }}>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(d.gasto)}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              <div style={{ width: '40px', height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                                <div style={{ width: `${Math.min(d.percentual, 100)}%`, height: '100%', background: d.percentual > 80 ? '#ef4444' : (d.percentual > 65 ? '#f59e0b' : '#10b981') }} />
                              </div>
                              <span style={{ fontSize: '11px', color: '#64748b' }}>{d.percentual.toFixed(0)}%</span>
                            </div>
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: d.variacao === null ? '#94a3b8' : (d.variacao > 0 ? '#ef4444' : '#10b981') }}>
                            {d.variacao === null ? '-' : `${d.variacao > 0 ? '+' : ''}${d.variacao.toFixed(1)}%`}
                          </td>
                        </tr>
                      ))}
                      {yoyData.length === 0 && (
                        <tr><td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>Nenhum dado encontrado para o ano selecionado.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'ranking' && ("""
      
    content = content.replace("      {activeTab === 'ranking' && (", panel_content)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

patch_file('src/pages/estabelecimento/Dashboard.tsx')

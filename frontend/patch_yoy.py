import re
import sys

def patch_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Update DashboardTab
    content = content.replace(
        "type DashboardTab = 'dashboard' | 'detalhamento' | 'ranking';",
        "type DashboardTab = 'dashboard' | 'evolucao_yoy' | 'detalhamento' | 'ranking';"
    )

    # 2. Add ref for evolucao_yoy
    content = content.replace(
        "const tabRefs = useRef<Record<DashboardTab, HTMLButtonElement | null>>({ dashboard: null, detalhamento: null, ranking: null });",
        "const tabRefs = useRef<Record<DashboardTab, HTMLButtonElement | null>>({ dashboard: null, evolucao_yoy: null, detalhamento: null, ranking: null });"
    )

    # 3. Add states
    state_block = """  const [rankServSortCol, setRankServSortCol] = useState<RankSortColumn | null>(null);
  const [rankServSortDir, setRankServSortDir] = useState<SortDirection>('desc');
  const tabRefs = useRef<Record<DashboardTab, HTMLButtonElement | null>>({ dashboard: null, evolucao_yoy: null, detalhamento: null, ranking: null });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const locationDropdownRef = useRef<HTMLDivElement>(null);"""

    new_state_block = state_block + """
  
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [yoyData, setYoyData] = useState<any[]>([]);
  const [yoyLoading, setYoyLoading] = useState(false);
  const availableYears = useMemo(() => Array.from(new Set(cycles.map((c: any) => c.ano))).sort((a: any, b: any) => b - a), [cycles]);
"""
    if state_block in content:
        content = content.replace(state_block, new_state_block)

    # 4. Add fetchYoyData
    fetch_yoy_code = """
  const fetchYoyData = useCallback(async (year: number) => {
    setYoyLoading(true);
    try {
      const yearCycles = cycles.filter(c => c.ano === year);
      const cycleIds = yearCycles.map(c => c.id);
      if (cycleIds.length === 0) { setYoyData([]); return; }
      const pvMap = dashboardMemoryCache.pvMap || {};
      const { data: cEsts } = await supabase.from('cycle_establishments').select('cycle_id, total_orcado, planning_limits(quantidade_planejada, position_id)').in('cycle_id', cycleIds);
      const { data: reqs } = await supabase.from('purchase_requests').select('cycle_id, valor, status, position_id').in('cycle_id', cycleIds).in('status', ['APROVADA', 'SOLICITADA']);
      const dataByMonth: Record<number, { orcado: number, gasto: number }> = {};
      for (let i = 1; i <= 12; i++) dataByMonth[i] = { orcado: 0, gasto: 0 };
      yearCycles.forEach(c => {
        let orcado = 0; let gasto = 0;
        cEsts?.filter((ce: any) => ce.cycle_id === c.id).forEach((ce: any) => {
           let calc = 0;
           if (ce.planning_limits) ce.planning_limits.forEach((pl: any) => { calc += (pl.quantidade_planejada || 0) * (pvMap[pl.position_id] || 0); });
           if (calc > 0) orcado += calc; else orcado += Number(ce.total_orcado || 0);
        });
        reqs?.filter((r: any) => r.cycle_id === c.id).forEach((r: any) => {
           let val = Number(r.valor);
           if (!val && r.position_id && pvMap[r.position_id]) val = pvMap[r.position_id];
           gasto += val || 0;
        });
        dataByMonth[c.mes] = { orcado, gasto };
      });
      const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      setYoyData(Object.keys(dataByMonth).map(m => ({ mes: months[Number(m) - 1], mesNum: Number(m), orcado: dataByMonth[Number(m)].orcado, gasto: dataByMonth[Number(m)].gasto })).sort((a, b) => a.mesNum - b.mesNum));
    } catch (e) { console.error('Erro ao buscar Evolução YoY:', e); } finally { setYoyLoading(false); }
  }, [cycles]);

  useEffect(() => {
    if (activeTab === 'evolucao_yoy' && selectedYear) void fetchYoyData(selectedYear);
  }, [activeTab, selectedYear, fetchYoyData]);
"""
    
    # insert before `const handleTabKeyDown`
    if "const handleTabKeyDown =" in content:
        content = content.replace("  const handleTabKeyDown =", fetch_yoy_code + "\n  const handleTabKeyDown =")

    # 5. Update handleTabKeyDown
    old_order = "const order: DashboardTab[] = ['dashboard', 'detalhamento', 'ranking'];"
    new_order = "const order: DashboardTab[] = ['dashboard', 'evolucao_yoy', 'detalhamento', 'ranking'];"
    content = content.replace(old_order, new_order)

    # 6. Add tab button
    old_tab_detalhamento = """        <button
          ref={(element) => { tabRefs.current.detalhamento = element; }}
          id="detalhamento-tab\""""
          
    new_tab_evolucao = """        <button
          ref={(element) => { tabRefs.current.evolucao_yoy = element; }}
          id="evolucao-yoy-tab"
          type="button"
          role="tab"
          aria-selected={activeTab === 'evolucao_yoy'}
          aria-controls="evolucao-yoy-panel"
          tabIndex={activeTab === 'evolucao_yoy' ? 0 : -1}
          className={`dashboard-tab${activeTab === 'evolucao_yoy' ? ' dashboard-tab--active' : ''}`}
          onClick={() => setActiveTab('evolucao_yoy')}
          onKeyDown={(event) => handleTabKeyDown(event, 'evolucao_yoy')}
        >
          Evolução YoY
        </button>
        <button
          ref={(element) => { tabRefs.current.detalhamento = element; }}
          id="detalhamento-tab\""""
    content = content.replace(old_tab_detalhamento, new_tab_evolucao)

    # 7. Add panel
    panel_code = """      {activeTab === 'evolucao_yoy' && (
        <div id="evolucao-yoy-panel" role="tabpanel" aria-labelledby="evolucao-yoy-tab" tabIndex={0}>
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
                  <div style={{ fontSize: '24px', fontWeight: 700, color: '#111827' }}>{getFormatCurrency(yoyData.reduce((acc, curr) => acc + curr.orcado, 0))}</div>
                </div>
                <div className="modern-card" style={{ gap: '8px', padding: '16px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-neutral-600)', textTransform: 'uppercase' }}>Total Gasto no Período</div>
                  <div style={{ fontSize: '24px', fontWeight: 700, color: '#111827' }}>{getFormatCurrency(yoyData.reduce((acc, curr) => acc + curr.gasto, 0))}</div>
                </div>
              </div>

              <div className="modern-card" style={{ minHeight: '400px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '16px', color: '#334155' }}>Orçado vs. Gasto (Mensal)</h4>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={yoyData} layout="vertical" margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                    <XAxis type="number" tickFormatter={(value) => 'R$ ' + (value / 1000).toFixed(0) + 'k'} />
                    <YAxis dataKey="mes" type="category" width={40} />
                    <RechartsTooltip formatter={(value) => getFormatCurrency(value as number)} />
                    <Legend />
                    <Bar dataKey="orcado" name="Orçado" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="gasto" name="Gasto" fill="#10b981" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </div>
      )}
"""
    
    old_detalhamento_panel = "{activeTab === 'detalhamento' && ("
    content = content.replace(old_detalhamento_panel, panel_code + "\n      " + old_detalhamento_panel)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

patch_file('src/pages/AdminDashboard.tsx')

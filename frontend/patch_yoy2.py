import re

def patch_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Find the YoY panel content
    search_str = """                    <RechartsTooltip formatter={(value) => getFormatCurrency(value as number)} />"""
    
    custom_tooltip_code = """                    <RechartsTooltip content={({ active, payload }) => {
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
                    }} />"""
                    
    content = content.replace(search_str, custom_tooltip_code)

    table_search_str = """              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'detalhamento' && ("""
      
    table_replacement = """              </div>

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
                          <td style={{ padding: '12px 16px', textAlign: 'right', color: '#3b82f6' }}>{getFormatCurrency(d.orcado)}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', color: '#10b981', fontWeight: 500 }}>{getFormatCurrency(d.gasto)}</td>
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

      {activeTab === 'detalhamento' && ("""
      
    content = content.replace(table_search_str, table_replacement)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

patch_file('src/pages/AdminDashboard.tsx')

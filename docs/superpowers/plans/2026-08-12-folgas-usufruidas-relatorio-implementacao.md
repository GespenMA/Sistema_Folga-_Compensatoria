# Relatório de Folgas Usufruídas — Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar uma nova seção de relatório — "Folgas Usufruídas" — nas telas de Relatórios do admin e do estabelecimento, listando cada folga com `status = 'USUFRUIDA'` (data de usufruto, ciclo, servidor, matrícula, lotação, cargo, quem registrou).

**Architecture:** Consulta direta a `compensatory_days` filtrada por `status = 'USUFRUIDA'` e `cycle_id` (mesmo critério de ciclo usado pelas outras abas/seções — o ciclo em que a folga foi **gerada**, não o período em que foi usufruída). No admin, entra como uma 4ª aba na estrutura de abas já existente em `admin/Relatorios.tsx` (mesmo padrão de "Detalhamento por Estabelecimento": lista plana, uma linha por evento). No estabelecimento, entra como uma nova seção/tabela abaixo de "Detalhamento da Folha de Pagamento" em `estabelecimento/Relatorios.tsx`, que não tem sistema de abas — sem a coluna "Estabelecimento" (redundante lá, mesma unidade sempre), seguindo o padrão já existente nesse arquivo (a tabela de Folha por Servidor de lá também já omite essa coluna).

**Tech Stack:** React + TypeScript + supabase-js, `xlsx` para Excel, `jspdf`/`jspdf-autotable` para PDF. Sem framework de testes automatizado no projeto.

## Global Constraints

- Filtro de ciclo usa `compensatory_days.cycle_id` (ciclo de origem/geração), não `used_at` — decisão explícita do usuário, documentada na spec.
- `compensatory_days.establishment_id` (coluna fixa, adicionada na feature de transferência de servidor desta mesma sessão) é a fonte correta da lotação — não usar `employees.establishment_id` (lotação atual, pode ter mudado depois).
- `usage_registered_by` referencia `profiles(id)`, mas `compensatory_days` tem **três** FKs distintas para `profiles` (`generated_by`, `decided_by`, `usage_registered_by`) — todo embed do Supabase precisa do hint explícito `profiles!usage_registered_by(nome)`, senão o PostgREST rejeita a query por ambiguidade.
- Sem suíte de testes automatizada — verificação é `npm run build` (type-check) e um script Node via service role key (mesmo padrão usado nesta sessão para a feature de transferência).
- Seguir os padrões já existentes em cada arquivo (abas no admin, seções empilhadas no estabelecimento) — não introduzir um sistema de abas novo em `estabelecimento/Relatorios.tsx`.

---

## Mapa de arquivos

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `frontend/src/pages/admin/Relatorios.tsx` | Modificar | Nova aba "Folgas Usufruídas": tipo, query, paginação, KPIs, tabela, exportação XLSX/PDF |
| `frontend/src/pages/estabelecimento/Relatorios.tsx` | Modificar | Nova seção "Folgas Usufruídas": tipo, query, tabela própria, exportação XLSX/PDF dedicada |

---

### Task 1: admin/Relatorios.tsx — nova aba "Folgas Usufruídas"

**Files:**
- Modify: `frontend/src/pages/admin/Relatorios.tsx`

**Interfaces:**
- Consumes: `compensatory_days.establishment_id` (coluna fixa, já existe desde a migration 17 desta sessão).
- Produces: nada consumido por outra task — mudança isolada neste arquivo.

- [ ] **Step 1: Importar o ícone novo**

De (linha 4):
```tsx
import { FileText, Download, FileSpreadsheet, Filter, Building2, Users, DollarSign, TrendingUp, AlertCircle } from 'lucide-react';
```
Para:
```tsx
import { FileText, Download, FileSpreadsheet, Filter, Building2, Users, DollarSign, TrendingUp, AlertCircle, CalendarCheck } from 'lucide-react';
```

- [ ] **Step 2: Adicionar o tipo `UsufrutoRow` e estender `ActiveTab`**

Logo depois do tipo `FolhaServidorRow` (antes de `type ActiveTab = ...`), adicionar:
```tsx
// Rel 4: Folgas Usufruídas
type UsufrutoRow = {
  id: string;
  establishment_id: string;
  nome_est: string;
  employee_id: string;
  matricula: string;
  nome_servidor: string;
  position_codigo: string;
  nome_cargo: string;
  ciclo_nome: string;
  data_usufruto: string;
  registrado_por: string;
};
```
E trocar:
```tsx
type ActiveTab = 'orcado_gasto' | 'detalhe_est' | 'folha_servidor';
```
Por:
```tsx
type ActiveTab = 'orcado_gasto' | 'detalhe_est' | 'folha_servidor' | 'folgas_usufruidas';
```

- [ ] **Step 3: Adicionar estado**

Depois de `const [folhaData, setFolhaData] = useState<FolhaServidorRow[]>([]);`, adicionar:
```tsx
  const [usufrutoData, setUsufrutoData] = useState<UsufrutoRow[]>([]);
```
Depois de `const [currentPageDetalh, setCurrentPageDetalh] = useState(1);`, adicionar:
```tsx
  const [currentPageUsufruto, setCurrentPageUsufruto] = useState(1);
```

- [ ] **Step 4: Adicionar `loadUsufruto` e ligar no dispatcher**

Trocar (dispatcher `loadData`):
```tsx
      if (tab === 'orcado_gasto') await loadOrcadoGasto();
      else if (tab === 'detalhe_est') await loadDetalhEstabelecimento();
      else await loadFolhaServidor();
```
Por:
```tsx
      if (tab === 'orcado_gasto') await loadOrcadoGasto();
      else if (tab === 'detalhe_est') await loadDetalhEstabelecimento();
      else if (tab === 'folha_servidor') await loadFolhaServidor();
      else await loadUsufruto();
```

Depois do fim da função `loadFolhaServidor` (depois do `setFolhaData(rows);` e do fechamento `};` dela), adicionar a nova função:
```tsx
  // -------------------------------------------
  // TAB 4: Folgas Usufruídas
  // -------------------------------------------
  const loadUsufruto = async () => {
    let q = supabase
      .from('compensatory_days')
      .select('id, used_at, establishment_id, cycle_id, employees!inner ( id, matricula, nome, position_id, positions ( codigo, nome ) ), establishments ( nome ), cycles ( nome ), profiles!usage_registered_by ( nome )')
      .eq('cycle_id', selectedCycle)
      .eq('status', 'USUFRUIDA');
    if (selectedEst) q = q.eq('establishment_id', selectedEst);
    if (selectedCargo) q = q.eq('employees.position_id', selectedCargo);
    const data = await fetchAll(q);

    const rows: UsufrutoRow[] = (data || []).map((row: any) => ({
      id: row.id,
      establishment_id: row.establishment_id,
      nome_est: row.establishments?.nome || '—',
      employee_id: row.employees?.id || '',
      matricula: row.employees?.matricula || '—',
      nome_servidor: row.employees?.nome || '—',
      position_codigo: row.employees?.positions?.codigo || '—',
      nome_cargo: row.employees?.positions?.nome || '—',
      ciclo_nome: row.cycles?.nome || '—',
      data_usufruto: row.used_at ? fmtDate(row.used_at) : '—',
      registrado_por: row.profiles?.nome || '—',
    }));
    rows.sort((a, b) => a.nome_est.localeCompare(b.nome_est) || a.nome_servidor.localeCompare(b.nome_servidor));
    setUsufrutoData(rows);
  };
```

- [ ] **Step 5: Paginação**

Depois do bloco de paginação de `detalhPaginated`/`totalPagesDetalh` (linhas 412-422 atuais), adicionar:
```tsx
  // Pagination Folgas Usufruídas
  useEffect(() => {
    setCurrentPageUsufruto(1);
  }, [usufrutoData]);

  const usufrutoPaginated = useMemo(() => {
    const startIndex = (currentPageUsufruto - 1) * itemsPerPage;
    return usufrutoData.slice(startIndex, startIndex + itemsPerPage);
  }, [usufrutoData, currentPageUsufruto]);

  const totalPagesUsufruto = Math.ceil(usufrutoData.length / itemsPerPage);
```

- [ ] **Step 6: KPI de Folgas Usufruídas**

Depois do `useMemo` de `kpiDetalh`, adicionar:
```tsx
  const kpiUsufruto = useMemo(() => {
    const totalUsufruidas = usufrutoData.length;
    const servidoresDistintos = new Set(usufrutoData.map(r => r.employee_id)).size;
    const unidadesComMovimento = new Set(usufrutoData.map(r => r.establishment_id)).size;
    return { totalUsufruidas, servidoresDistintos, unidadesComMovimento };
  }, [usufrutoData]);
```

- [ ] **Step 7: `currentEmpty` e `tabConfig`**

De:
```tsx
  const currentEmpty =
    (activeTab === 'orcado_gasto' && orcadoGastoData.length === 0) ||
    (activeTab === 'detalhe_est' && detalhEstData.length === 0) ||
    (activeTab === 'folha_servidor' && folhaFiltered.length === 0);

  const tabConfig: { key: ActiveTab; label: string; icon: React.ReactNode }[] = [
    { key: 'orcado_gasto', label: 'Orçado vs. Gasto', icon: <TrendingUp size={15} /> },
    { key: 'detalhe_est', label: 'Detalhamento por Unidade', icon: <Building2 size={15} /> },
    { key: 'folha_servidor', label: 'Folha por Servidor', icon: <Users size={15} /> },
  ];
```
Para:
```tsx
  const currentEmpty =
    (activeTab === 'orcado_gasto' && orcadoGastoData.length === 0) ||
    (activeTab === 'detalhe_est' && detalhEstData.length === 0) ||
    (activeTab === 'folha_servidor' && folhaFiltered.length === 0) ||
    (activeTab === 'folgas_usufruidas' && usufrutoData.length === 0);

  const tabConfig: { key: ActiveTab; label: string; icon: React.ReactNode }[] = [
    { key: 'orcado_gasto', label: 'Orçado vs. Gasto', icon: <TrendingUp size={15} /> },
    { key: 'detalhe_est', label: 'Detalhamento por Unidade', icon: <Building2 size={15} /> },
    { key: 'folha_servidor', label: 'Folha por Servidor', icon: <Users size={15} /> },
    { key: 'folgas_usufruidas', label: 'Folgas Usufruídas', icon: <CalendarCheck size={15} /> },
  ];
```

- [ ] **Step 8: KPI cards da nova aba**

Depois do bloco `{activeTab === 'folha_servidor' && (<>...</>)}` dentro de "KPI CARDS", adicionar:
```tsx
          {activeTab === 'folgas_usufruidas' && (<>
            <KpiCard label="Folgas Usufruídas" value={kpiUsufruto.totalUsufruidas.toString()} color="#0891b2" icon={<CalendarCheck size={18} />} />
            <KpiCard label="Servidores Distintos" value={kpiUsufruto.servidoresDistintos.toString()} color="#3b82f6" icon={<Users size={18} />} />
            <KpiCard label="Unidades com Movimento" value={kpiUsufruto.unidadesComMovimento.toString()} color="#8b5cf6" icon={<Building2 size={18} />} />
          </>)}
```

- [ ] **Step 9: Rótulo de contagem no cabeçalho da tabela**

De:
```tsx
            {activeTab === 'orcado_gasto' && `${orcadoGastoData.length} unidade(s) encontrada(s)`}
            {activeTab === 'detalhe_est' && `${detalhEstData.length} linha(s) de detalhamento`}
            {activeTab === 'folha_servidor' && `${folhaFiltered.length} servidor(es) na folha`}
```
Para:
```tsx
            {activeTab === 'orcado_gasto' && `${orcadoGastoData.length} unidade(s) encontrada(s)`}
            {activeTab === 'detalhe_est' && `${detalhEstData.length} linha(s) de detalhamento`}
            {activeTab === 'folha_servidor' && `${folhaFiltered.length} servidor(es) na folha`}
            {activeTab === 'folgas_usufruidas' && `${usufrutoData.length} folga(s) usufruída(s)`}
```

- [ ] **Step 10: Tabela da nova aba**

Imediatamente depois do fechamento do bloco `{/* TAB 3: Folha por Servidor */} {activeTab === 'folha_servidor' && (<>...</>)}` (a linha `)}` que fecha esse bloco, logo antes do `</div>` que fecha `{/* Conteúdo */}`), adicionar:
```tsx
            {/* TAB 4: Folgas Usufruídas */}
            {activeTab === 'folgas_usufruidas' && (
              <>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#0891b2' }}>
                      {['Estabelecimento', 'Servidor', 'Matrícula', 'Cargo', 'Ciclo', 'Data de Usufruto', 'Registrado por'].map(h => (
                        <th key={h} style={{ padding: '10px 16px', color: '#fff', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {usufrutoPaginated.map((r, i) => (
                      <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#ecfeff' }}>
                        <td style={{ padding: '10px 16px', fontWeight: 600 }}>{r.nome_est}</td>
                        <td style={{ padding: '10px 16px' }}>{r.nome_servidor}</td>
                        <td style={{ padding: '10px 16px', color: '#475569' }}>{r.matricula}</td>
                        <td style={{ padding: '10px 16px' }}><span style={{ padding: '2px 8px', borderRadius: '4px', background: '#dbeafe', color: '#1e40af', fontWeight: 700, fontSize: '11px' }}>{r.position_codigo}</span></td>
                        <td style={{ padding: '10px 16px' }}>{r.ciclo_nome}</td>
                        <td style={{ padding: '10px 16px', whiteSpace: 'nowrap', fontWeight: 600, color: '#0e7490' }}>{r.data_usufruto}</td>
                        <td style={{ padding: '10px 16px', color: '#475569' }}>{r.registrado_por}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: '#0891b2', color: '#fff' }}>
                      <td colSpan={7} style={{ padding: '10px 16px', fontWeight: 700 }}>TOTAL GERAL — {usufrutoData.length} folga(s) usufruída(s)</td>
                    </tr>
                  </tfoot>
                </table>

                {totalPagesUsufruto > 1 && (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', padding: '16px', background: '#fff' }}>
                    <button
                      onClick={() => setCurrentPageUsufruto(p => Math.max(1, p - 1))}
                      disabled={currentPageUsufruto === 1}
                      style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: currentPageUsufruto === 1 ? '#f1f5f9' : '#fff', cursor: currentPageUsufruto === 1 ? 'not-allowed' : 'pointer', color: currentPageUsufruto === 1 ? '#94a3b8' : '#334155' }}
                    >Anterior</button>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>
                      Página {currentPageUsufruto} de {totalPagesUsufruto}
                    </span>
                    <button
                      onClick={() => setCurrentPageUsufruto(p => Math.min(totalPagesUsufruto, p + 1))}
                      disabled={currentPageUsufruto === totalPagesUsufruto}
                      style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: currentPageUsufruto === totalPagesUsufruto ? '#f1f5f9' : '#fff', cursor: currentPageUsufruto === totalPagesUsufruto ? 'not-allowed' : 'pointer', color: currentPageUsufruto === totalPagesUsufruto ? '#94a3b8' : '#334155' }}
                    >Próxima</button>
                  </div>
                )}
              </>
            )}
```

- [ ] **Step 11: `exportXLSX` — nova planilha**

De:
```tsx
    } else {
      const rows = folhaFiltered.map(r => ({
        'Matrícula': r.matricula,
        'Nome do Servidor': r.nome,
        'Cargo': r.cargo_nome,
        'Estabelecimento Penal': r.nome_est,
        'Data(s) do Plantão': r.datas_plantao.length > 0 ? r.datas_plantao.map(d => fmtDate(d)).join(', ') : '',
        'Horas Trabalhadas': `${Math.floor(r.minutos_trabalhados / 60)}h${(r.minutos_trabalhados % 60).toString().padStart(2, '0')}`,
        'Plantões Trabalhados': r.plantoes_trabalhados,
        'Folgas Geradas': r.folgas_geradas,
        'Folgas Compradas': r.folgas_compradas_qtd,
        'Plantão Plus': r.plantao_plus_qtd,
        'Valor Folga Comp. (R$)': r.valor_folga_comp,
        'Valor Plantão Plus (R$)': r.valor_plantao_plus,
        'TOTAL A PAGAR (R$)': r.total_a_pagar,
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, 'Folha por Servidor');
    }

    const tabName = activeTab === 'orcado_gasto' ? 'OrcadoGasto' : activeTab === 'detalhe_est' ? 'DetalhEst' : 'FolhaServidor';
```
Para:
```tsx
    } else if (activeTab === 'folha_servidor') {
      const rows = folhaFiltered.map(r => ({
        'Matrícula': r.matricula,
        'Nome do Servidor': r.nome,
        'Cargo': r.cargo_nome,
        'Estabelecimento Penal': r.nome_est,
        'Data(s) do Plantão': r.datas_plantao.length > 0 ? r.datas_plantao.map(d => fmtDate(d)).join(', ') : '',
        'Horas Trabalhadas': `${Math.floor(r.minutos_trabalhados / 60)}h${(r.minutos_trabalhados % 60).toString().padStart(2, '0')}`,
        'Plantões Trabalhados': r.plantoes_trabalhados,
        'Folgas Geradas': r.folgas_geradas,
        'Folgas Compradas': r.folgas_compradas_qtd,
        'Plantão Plus': r.plantao_plus_qtd,
        'Valor Folga Comp. (R$)': r.valor_folga_comp,
        'Valor Plantão Plus (R$)': r.valor_plantao_plus,
        'TOTAL A PAGAR (R$)': r.total_a_pagar,
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, 'Folha por Servidor');
    } else {
      const rows = usufrutoData.map(r => ({
        'Estabelecimento Penal': r.nome_est,
        'Servidor': r.nome_servidor,
        'Matrícula': r.matricula,
        'Cargo': r.nome_cargo,
        'Ciclo': r.ciclo_nome,
        'Data de Usufruto': r.data_usufruto,
        'Registrado por': r.registrado_por,
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, 'Folgas Usufruídas');
    }

    const tabName = activeTab === 'orcado_gasto' ? 'OrcadoGasto' : activeTab === 'detalhe_est' ? 'DetalhEst' : activeTab === 'folha_servidor' ? 'FolhaServidor' : 'FolgasUsufruidas';
```

- [ ] **Step 12: `exportPDF` — rótulo, tabela e nome de arquivo**

De:
```tsx
      const tabLabel = activeTab === 'orcado_gasto'
        ? 'Relatório 1: Orçado vs. Gasto por Estabelecimento'
        : activeTab === 'detalhe_est'
        ? 'Relatório 2: Detalhamento por Estabelecimento'
        : 'Relatório 3: Folha de Pagamento por Servidor';
```
Para:
```tsx
      const tabLabel = activeTab === 'orcado_gasto'
        ? 'Relatório 1: Orçado vs. Gasto por Estabelecimento'
        : activeTab === 'detalhe_est'
        ? 'Relatório 2: Detalhamento por Estabelecimento'
        : activeTab === 'folha_servidor'
        ? 'Relatório 3: Folha de Pagamento por Servidor'
        : 'Relatório 4: Folgas Usufruídas';
```

De:
```tsx
      } else {
        const totalPagar = folhaFiltered.reduce((s, r) => s + r.total_a_pagar, 0);
        autoTable(doc, {
          startY: 36,
          head: [['Matrícula', 'Servidor', 'Cargo', 'Estabelecimento', 'Data(s) Plantão', 'Horas Trab.', 'Plant. Trab.', 'Folgas Ger.', 'Folgas Comp.', 'Plant. Plus', 'Vl. Folga Comp.', 'Vl. Plant. Plus', 'TOTAL A PAGAR']],
          body: [
            ...folhaFiltered.map(r => [
              r.matricula,
              r.nome,
              r.cargo_codigo,
              r.nome_est,
              r.datas_plantao.length > 0 ? r.datas_plantao.map(d => fmtDate(d)).join(', ') : '—',
              `${Math.floor(r.minutos_trabalhados / 60)}h${(r.minutos_trabalhados % 60).toString().padStart(2, '0')}`,
              r.plantoes_trabalhados.toString(),
              r.folgas_geradas.toString(),
              r.folgas_compradas_qtd.toString(),
              r.plantao_plus_qtd.toString(),
              fmt(r.valor_folga_comp),
              fmt(r.valor_plantao_plus),
              fmt(r.total_a_pagar),
            ]),
            ['', 'TOTAL GERAL', '', '', '', '', '', '', '', '', '', '', fmt(totalPagar)],
          ],
          headStyles: { fillColor: [124, 58, 237], textColor: 255, fontSize: 7, fontStyle: 'bold' },
          bodyStyles: { fontSize: 7 },
          alternateRowStyles: { fillColor: [245, 243, 255] },
          columnStyles: { 12: { fontStyle: 'bold', textColor: [5, 150, 105] } },
          didParseCell: (data) => {
            if (data.row.index === folhaFiltered.length) {
              data.cell.styles.fontStyle = 'bold';
              data.cell.styles.fillColor = [221, 214, 254];
            }
          },
        });
      }

      const tabName = activeTab === 'orcado_gasto' ? 'OrcadoGasto' : activeTab === 'detalhe_est' ? 'DetalhEst' : 'FolhaServidor';
```
Para:
```tsx
      } else if (activeTab === 'folha_servidor') {
        const totalPagar = folhaFiltered.reduce((s, r) => s + r.total_a_pagar, 0);
        autoTable(doc, {
          startY: 36,
          head: [['Matrícula', 'Servidor', 'Cargo', 'Estabelecimento', 'Data(s) Plantão', 'Horas Trab.', 'Plant. Trab.', 'Folgas Ger.', 'Folgas Comp.', 'Plant. Plus', 'Vl. Folga Comp.', 'Vl. Plant. Plus', 'TOTAL A PAGAR']],
          body: [
            ...folhaFiltered.map(r => [
              r.matricula,
              r.nome,
              r.cargo_codigo,
              r.nome_est,
              r.datas_plantao.length > 0 ? r.datas_plantao.map(d => fmtDate(d)).join(', ') : '—',
              `${Math.floor(r.minutos_trabalhados / 60)}h${(r.minutos_trabalhados % 60).toString().padStart(2, '0')}`,
              r.plantoes_trabalhados.toString(),
              r.folgas_geradas.toString(),
              r.folgas_compradas_qtd.toString(),
              r.plantao_plus_qtd.toString(),
              fmt(r.valor_folga_comp),
              fmt(r.valor_plantao_plus),
              fmt(r.total_a_pagar),
            ]),
            ['', 'TOTAL GERAL', '', '', '', '', '', '', '', '', '', '', fmt(totalPagar)],
          ],
          headStyles: { fillColor: [124, 58, 237], textColor: 255, fontSize: 7, fontStyle: 'bold' },
          bodyStyles: { fontSize: 7 },
          alternateRowStyles: { fillColor: [245, 243, 255] },
          columnStyles: { 12: { fontStyle: 'bold', textColor: [5, 150, 105] } },
          didParseCell: (data) => {
            if (data.row.index === folhaFiltered.length) {
              data.cell.styles.fontStyle = 'bold';
              data.cell.styles.fillColor = [221, 214, 254];
            }
          },
        });
      } else {
        autoTable(doc, {
          startY: 36,
          head: [['Estabelecimento', 'Servidor', 'Matrícula', 'Cargo', 'Ciclo', 'Data de Usufruto', 'Registrado por']],
          body: [
            ...usufrutoData.map(r => [
              r.nome_est,
              r.nome_servidor,
              r.matricula,
              r.position_codigo,
              r.ciclo_nome,
              r.data_usufruto,
              r.registrado_por,
            ]),
            ['TOTAL GERAL', `${usufrutoData.length} registro(s)`, '', '', '', '', ''],
          ],
          headStyles: { fillColor: [8, 145, 178], textColor: 255, fontSize: 8, fontStyle: 'bold' },
          bodyStyles: { fontSize: 8 },
          alternateRowStyles: { fillColor: [236, 254, 255] },
          didParseCell: (data) => {
            if (data.row.index === usufrutoData.length) {
              data.cell.styles.fontStyle = 'bold';
              data.cell.styles.fillColor = [165, 243, 252];
            }
          },
        });
      }

      const tabName = activeTab === 'orcado_gasto' ? 'OrcadoGasto' : activeTab === 'detalhe_est' ? 'DetalhEst' : activeTab === 'folha_servidor' ? 'FolhaServidor' : 'FolgasUsufruidas';
```

- [ ] **Step 13: Type-check**

Run: `cd frontend && npm run build`
Expected: build sem erros de TypeScript.

- [ ] **Step 14: `detect_changes` e commit**

Rodar `mcp__gitnexus__detect_changes` (scope `unstaged`) e conferir que só os símbolos esperados em `admin/Relatorios.tsx` aparecem, risco `low`.

```bash
git add frontend/src/pages/admin/Relatorios.tsx
git commit -m "feat: adiciona aba Folgas Usufruidas no relatorio admin"
```

---

### Task 2: estabelecimento/Relatorios.tsx — nova seção "Folgas Usufruídas"

**Files:**
- Modify: `frontend/src/pages/estabelecimento/Relatorios.tsx`

**Interfaces:**
- Consumes: `compensatory_days.establishment_id` (mesma coluna da Task 1).
- Produces: nada consumido por outra task.

- [ ] **Step 1: Importar o ícone novo**

De (linha 5):
```tsx
import { FileText, FileSpreadsheet, Filter, Users, DollarSign, Building2, TrendingUp, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
```
Para:
```tsx
import { FileText, FileSpreadsheet, Filter, Users, DollarSign, Building2, TrendingUp, AlertCircle, ChevronLeft, ChevronRight, CalendarCheck } from 'lucide-react';
```

- [ ] **Step 2: Adicionar o tipo `UsufrutoRow`**

Depois do tipo `FolhaServidorRow` (antes do bloco `// HELPERS`), adicionar:
```tsx
type UsufrutoRow = {
  id: string;
  employee_id: string;
  matricula: string;
  nome_servidor: string;
  cargo_nome: string;
  ciclo_nome: string;
  data_usufruto: string;
  registrado_por: string;
};
```

- [ ] **Step 3: Adicionar estado**

Depois de `const [folhaData, setFolhaData] = useState<FolhaServidorRow[]>([]);`, adicionar:
```tsx
  const [usufrutoData, setUsufrutoData] = useState<UsufrutoRow[]>([]);
```
Depois de `const [currentPage, setCurrentPage] = useState(1);`, adicionar:
```tsx
  const [currentPageUsufruto, setCurrentPageUsufruto] = useState(1);
```

- [ ] **Step 4: Adicionar `loadUsufruto` e ligar no `loadData`**

De:
```tsx
      await Promise.all([
        loadResumoCiclo(),
        loadFolhaServidor()
      ]);
```
Para:
```tsx
      await Promise.all([
        loadResumoCiclo(),
        loadFolhaServidor(),
        loadUsufruto()
      ]);
```

Depois do fim de `loadFolhaServidor` (depois do `setFolhaData(rows);` e do fechamento `};` dela), adicionar:
```tsx
  const loadUsufruto = async () => {
    const estId = profile!.establishment_id!;

    let q = supabase
      .from('compensatory_days')
      .select('id, used_at, cycle_id, employees!inner ( id, matricula, nome, position_id, positions ( nome ) ), cycles ( nome ), profiles!usage_registered_by ( nome )')
      .eq('cycle_id', selectedCycle)
      .eq('establishment_id', estId)
      .eq('status', 'USUFRUIDA');
    if (selectedCargo) q = q.eq('employees.position_id', selectedCargo);

    const { data, error } = await q;
    if (error) throw error;

    const rows: UsufrutoRow[] = (data || []).map((row: any) => ({
      id: row.id,
      employee_id: row.employees?.id || '',
      matricula: row.employees?.matricula || '—',
      nome_servidor: row.employees?.nome || '—',
      cargo_nome: row.employees?.positions?.nome || '—',
      ciclo_nome: row.cycles?.nome || '—',
      data_usufruto: row.used_at ? fmtDate(row.used_at) : '—',
      registrado_por: row.profiles?.nome || '—',
    }));
    rows.sort((a, b) => a.nome_servidor.localeCompare(b.nome_servidor));
    setUsufrutoData(rows);
  };
```

- [ ] **Step 5: Paginação e exportação**

Depois do bloco `totFolha` (`}, [filteredFolha]);`), adicionar:
```tsx
  const totalPagesUsufruto = Math.ceil(usufrutoData.length / itemsPerPage);
  const paginatedUsufruto = useMemo(() => {
    const startIndex = (currentPageUsufruto - 1) * itemsPerPage;
    return usufrutoData.slice(startIndex, startIndex + itemsPerPage);
  }, [usufrutoData, currentPageUsufruto]);

  const exportUsufrutoExcel = () => {
    const data = usufrutoData.map(r => ({
      'Servidor': r.nome_servidor,
      'Matrícula': r.matricula,
      'Cargo': r.cargo_nome,
      'Ciclo': r.ciclo_nome,
      'Data de Usufruto': r.data_usufruto,
      'Registrado por': r.registrado_por,
    }));
    if (data.length === 0) return alert('Nenhum dado para exportar.');
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Folgas Usufruidas");
    XLSX.writeFile(wb, `Folgas_Usufruidas_${getSelectedCycleObj()?.nome || 'Ciclo'}.xlsx`);
  };

  const exportUsufrutoPDF = () => {
    if (usufrutoData.length === 0) return alert('Nenhum dado para exportar.');
    setExportingPdf(true);
    try {
      const doc = new jsPDF('l', 'mm', 'a4');
      const cycleObj = getSelectedCycleObj();

      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text('SEAP — Compensa+', 14, 16);
      doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 282, 16, { align: 'right' });

      doc.setFontSize(16);
      doc.setTextColor(40);
      doc.text(`Folgas Usufruídas - Unidade`, 14, 26);
      doc.setFontSize(11);
      doc.text(`Ciclo: ${cycleObj?.nome || 'Não definido'}`, 14, 32);

      autoTable(doc, {
        startY: 40,
        head: [['Servidor', 'Matrícula', 'Cargo', 'Ciclo', 'Data de Usufruto', 'Registrado por']],
        body: usufrutoData.map(r => [r.nome_servidor, r.matricula, r.cargo_nome, r.ciclo_nome, r.data_usufruto, r.registrado_por]),
        theme: 'striped',
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [8, 145, 178], textColor: [255, 255, 255], fontStyle: 'bold' },
      });

      doc.save(`Folgas_Usufruidas_${cycleObj?.nome || 'Ciclo'}.pdf`);
    } finally {
      setExportingPdf(false);
    }
  };
```

- [ ] **Step 6: Nova seção na tela**

Imediatamente depois do `</div>` que fecha o bloco `{/* TABELA: FOLHA POR SERVIDOR */}` (o `</div>` seguido de `</>` e `)}`), adicionar uma nova seção, antes do `</>` de fechamento do `loading ? (...) : (<>...</>)`:
```tsx
          {/* TABELA: FOLGAS USUFRUÍDAS */}
          <div style={{ background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginTop: '24px' }}>

            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, color: 'var(--color-text-base)' }}>
                <CalendarCheck size={18} color="#0891b2" />
                Folgas Usufruídas
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={exportUsufrutoExcel}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#16a34a', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 500 }}
                >
                  <FileSpreadsheet size={16} /> Excel
                </button>
                <button
                  onClick={exportUsufrutoPDF}
                  disabled={exportingPdf}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#dc2626', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 500, opacity: exportingPdf ? 0.7 : 1 }}
                >
                  <FileText size={16} /> {exportingPdf ? 'Gerando...' : 'PDF'}
                </button>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #e2e8f0', color: '#475569', textAlign: 'left' }}>
                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>Servidor</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>Matrícula</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>Cargo</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>Ciclo</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>Data de Usufruto</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>Registrado por</th>
                  </tr>
                </thead>
                <tbody>
                  {usufrutoData.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>
                        Nenhuma folga usufruída registrada para os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    paginatedUsufruto.map(r => (
                      <tr key={r.id} style={{ borderBottom: '1px solid #e2e8f0', background: '#fff' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 500, color: '#0f172a' }}>{r.nome_servidor}</td>
                        <td style={{ padding: '12px 16px', color: '#64748b' }}>{r.matricula}</td>
                        <td style={{ padding: '12px 16px' }}>{r.cargo_nome}</td>
                        <td style={{ padding: '12px 16px' }}>{r.ciclo_nome}</td>
                        <td style={{ padding: '12px 16px', fontWeight: 600, color: '#0e7490' }}>{r.data_usufruto}</td>
                        <td style={{ padding: '12px 16px', color: '#64748b' }}>{r.registrado_por}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              {totalPagesUsufruto > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderTop: '1px solid var(--color-border)', background: '#f8fafc' }}>
                  <div style={{ fontSize: '13px', color: '#64748b' }}>
                    Mostrando {(currentPageUsufruto - 1) * itemsPerPage + 1} até {Math.min(currentPageUsufruto * itemsPerPage, usufrutoData.length)} de {usufrutoData.length} registros
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => setCurrentPageUsufruto(p => Math.max(1, p - 1))}
                      disabled={currentPageUsufruto === 1}
                      style={{ padding: '6px 12px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: currentPageUsufruto === 1 ? 'not-allowed' : 'pointer', opacity: currentPageUsufruto === 1 ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: '#334155' }}
                    >
                      <ChevronLeft size={16} /> Anterior
                    </button>
                    <button
                      onClick={() => setCurrentPageUsufruto(p => Math.min(totalPagesUsufruto, p + 1))}
                      disabled={currentPageUsufruto === totalPagesUsufruto}
                      style={{ padding: '6px 12px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: currentPageUsufruto === totalPagesUsufruto ? 'not-allowed' : 'pointer', opacity: currentPageUsufruto === totalPagesUsufruto ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: '#334155' }}
                    >
                      Próxima <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
```

- [ ] **Step 7: Type-check**

Run: `cd frontend && npm run build`
Expected: build sem erros de TypeScript.

- [ ] **Step 8: `detect_changes` e commit**

```bash
git add frontend/src/pages/estabelecimento/Relatorios.tsx
git commit -m "feat: adiciona secao Folgas Usufruidas no relatorio do estabelecimento"
```

---

### Task 3: Verificação

**Files:** nenhum arquivo novo — execução manual + script de leitura.

- [ ] **Step 1: Encontrar (ou criar) uma folga usufruída de teste**

Rodar via service role key (reaproveitando o padrão já usado nesta sessão) para checar se já existe alguma `compensatory_days` com `status = 'USUFRUIDA'` no ciclo atual:
```bash
node -e "
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const env = {};
fs.readFileSync('frontend/.env.local', 'utf-8').split('\n').forEach(l => { const m = l.match(/^([A-Z_]+)=(.*)\$/); if (m) env[m[1]] = m[2].trim(); });
const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
(async () => {
  const { data, error } = await supabase
    .from('compensatory_days')
    .select('id, used_at, establishment_id, cycle_id, employees(nome, matricula), profiles!usage_registered_by(nome)')
    .eq('status', 'USUFRUIDA')
    .limit(5);
  console.log(JSON.stringify(data, null, 2), error);
})();
"
```
Se não houver nenhuma, registrar uma manualmente pelo app (estabelecimento → Solicitações → aba Usufruídas → "Registrar Usufruto" numa folga com status `GERADA`), ou simular via update direto (mesmo padrão de teste usado na feature de transferência): escolher um `id` de `compensatory_days` com `status = 'GERADA'` e nenhuma `purchase_request` vinculada, e rodar
```bash
node -e "
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const env = {};
fs.readFileSync('frontend/.env.local', 'utf-8').split('\n').forEach(l => { const m = l.match(/^([A-Z_]+)=(.*)\$/); if (m) env[m[1]] = m[2].trim(); });
const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
(async () => {
  const { data: candidatos } = await supabase.from('compensatory_days').select('id, employee_id, cycle_id').eq('status', 'GERADA').limit(1);
  console.log('Candidato para teste:', candidatos);
})();
"
```
e então atualizar esse registro com `status: 'USUFRUIDA', used_at: '<data qualquer dentro do ciclo>', usage_registered_by: '<um id de profiles existente>'`. **Reverter esse update ao final do teste** (voltar para `status: 'GERADA', used_at: null, usage_registered_by: null`), já que é dado real, não um registro descartável.

- [ ] **Step 2: Conferir a query da Task 1/2 direto**

```bash
node -e "
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const env = {};
fs.readFileSync('frontend/.env.local', 'utf-8').split('\n').forEach(l => { const m = l.match(/^([A-Z_]+)=(.*)\$/); if (m) env[m[1]] = m[2].trim(); });
const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
(async () => {
  const { data, error } = await supabase
    .from('compensatory_days')
    .select('id, used_at, establishment_id, cycle_id, employees!inner ( id, matricula, nome, position_id, positions ( codigo, nome ) ), establishments ( nome ), cycles ( nome ), profiles!usage_registered_by ( nome )')
    .eq('status', 'USUFRUIDA');
  console.log(JSON.stringify(data, null, 2));
  if (error) console.error('ERRO (provavel ambiguidade de FK ou nome de coluna errado):', error);
})();
"
```
Expected: sem erro, e cada linha com `establishments.nome`, `cycles.nome`, `profiles.nome` (via `usage_registered_by`) preenchidos — confirma que o hint `profiles!usage_registered_by` resolveu a ambiguidade das 3 FKs corretamente.

- [ ] **Step 3: Conferência manual na tela (pede ajuda do usuário)**

Pedir para o usuário: logar como admin, ir em Relatórios → aba "Folgas Usufruídas", conferir que a folga de teste aparece com a data/ciclo/lotação corretos; logar como o usuário ESTABELECIMENTO da mesma unidade, ir em Relatórios, conferir a nova seção "Folgas Usufruídas" no fim da página. Trocar o filtro de ciclo (se houver mais de um) e confirmar que a linha some quando o ciclo selecionado não é o dela.

- [ ] **Step 4: Reverter dado de teste**

Se um registro real foi alterado no Step 1 só para teste, reverter para o estado original (`status: 'GERADA'`, `used_at: null`, `usage_registered_by: null`).

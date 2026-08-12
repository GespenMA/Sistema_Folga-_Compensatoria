# Editar/Excluir Folga Usufruída — Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Na tela `estabelecimento/Solicitacoes.tsx` ("Comprar Folgas" → aba "Folgas Usufruídas"), permitir editar a data de uma folga já registrada como usufruída, e excluir (reverter para `GERADA`) um registro feito por engano — sem nunca apagar a linha do banco e sem afetar o saldo de plantões do servidor.

**Architecture:** Reaproveita o modal e o handler "Registrar Gozo" já existentes para editar (mesma operação, só passa a pré-preencher a data). Excluir é um novo handler que reverte `status`/`used_at`/`usage_registered_by` para o estado "disponível" — não deleta a linha, então o saldo (calculado por contagem de linhas, não por status) nunca é afetado. A trava de ciclo fechado já existe em dois níveis (query só traz o ciclo aberto; trigger de banco bloqueia UPDATE em ciclo fechado) — nada novo a implementar ali.

**Tech Stack:** React + TypeScript (Vite), supabase-js. Sem framework de testes automatizado no projeto.

## Global Constraints

- Excluir NUNCA apaga a linha de `compensatory_days` — só reverte `status` para `GERADA` e limpa `used_at`/`usage_registered_by`. Decisão explícita do usuário.
- O saldo do servidor (`employees.saldo_plantoes`) não deve mudar quando uma folga é excluída — isso já é garantido pelo modelo (trigger `trg_recalculate_shift_balance` só reage a mudanças em `shifts`, e conta linhas de `compensatory_days` sem filtrar por status — ver spec seção 3.3), então a implementação não precisa (e não deve) tentar ajustar saldo manualmente.
- Não implementar nenhuma verificação de "ciclo aberto?" no frontend — a lista já só mostra folgas do ciclo aberto por construção da query, e o trigger `check_cycle_status()` já bloqueia no banco.
- Único arquivo tocado: `frontend/src/pages/estabelecimento/Solicitacoes.tsx`. Nenhuma migration, nenhuma mudança de RLS.

---

## Mapa de arquivos

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `frontend/src/pages/estabelecimento/Solicitacoes.tsx` | Modificar | Reaproveita modal de gozo para editar; novo handler para excluir (reverter); botões na lista |

---

### Task 1: Editar e Excluir folga usufruída

**Files:**
- Modify: `frontend/src/pages/estabelecimento/Solicitacoes.tsx`

**Interfaces:**
- Consumes: nada de outra task.
- Produces: nada consumido por outra task — mudança isolada e completa neste arquivo.

GitNexus `impact(openUsufrutoModal, upstream)` e `impact(handleRegistrarUsufruto, upstream)` devem ser rodados antes de editar, por exigência do CLAUDE.md deste projeto.

- [ ] **Step 1: Pré-preencher a data ao abrir o modal (habilita reaproveitar para editar)**

De ([Solicitacoes.tsx:335-339](../../../frontend/src/pages/estabelecimento/Solicitacoes.tsx#L335-L339)):
```tsx
  const openUsufrutoModal = (folga: any) => {
    setSelectedFolga(folga);
    setDataUsufruto('');
    setIsUsufrutoModalOpen(true);
  };
```
Para:
```tsx
  const openUsufrutoModal = (folga: any) => {
    setSelectedFolga(folga);
    setDataUsufruto(folga.used_at || '');
    setIsUsufrutoModalOpen(true);
  };
```

- [ ] **Step 2: Novo handler `handleDesfazerUsufruto`**

Imediatamente depois do fim de `handleRegistrarUsufruto` ([Solicitacoes.tsx:341-365](../../../frontend/src/pages/estabelecimento/Solicitacoes.tsx#L341-L365), depois do `};` que a fecha), adicionar:
```tsx

  const handleDesfazerUsufruto = async (folga: any) => {
    if (!window.confirm(`Tem certeza que deseja excluir o registro de gozo de ${folga.employees?.nome}? A folga voltará para "Folgas Disponíveis para Compra" — o plantão que a gerou não é perdido.`)) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('compensatory_days')
        .update({
          status: 'GERADA',
          used_at: null,
          usage_registered_by: null
        })
        .eq('id', folga.id);

      if (error) throw error;

      fetchData(false);
    } catch (err: any) {
      alert(err.message || "Erro ao excluir o registro de gozo.");
    } finally {
      setIsSubmitting(false);
    }
  };
```

- [ ] **Step 3: Botões "Editar" e "Excluir" na lista de folgas usufruídas**

De ([Solicitacoes.tsx:1010-1025](../../../frontend/src/pages/estabelecimento/Solicitacoes.tsx#L1010-L1025)):
```tsx
                ) : folgasUsufruidas.map(f => (
                  <div key={f.id} style={{ padding: 'var(--space-3)', border: '1px solid var(--color-divider)', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                    <div>
                      <strong>{f.employees?.nome} ({f.employees?.matricula})</strong>
                      <div style={{ color: 'var(--color-text-muted)', marginTop: '2px' }}>{f.employees?.positions?.nome}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: '12px', fontWeight: 600, fontSize: '11px' }}>
                        Usufruída
                      </span>
                      <div style={{ color: 'var(--color-text-muted)', marginTop: '4px', fontSize: '12px' }}>
                        Em: {f.used_at ? new Date(f.used_at + 'T12:00:00Z').toLocaleDateString('pt-BR') : '--'}
                      </div>
                    </div>
                  </div>
                ))}
```
Para:
```tsx
                ) : folgasUsufruidas.map(f => (
                  <div key={f.id} style={{ padding: 'var(--space-3)', border: '1px solid var(--color-divider)', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                    <div>
                      <strong>{f.employees?.nome} ({f.employees?.matricula})</strong>
                      <div style={{ color: 'var(--color-text-muted)', marginTop: '2px' }}>{f.employees?.positions?.nome}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: '12px', fontWeight: 600, fontSize: '11px' }}>
                        Usufruída
                      </span>
                      <div style={{ color: 'var(--color-text-muted)', marginTop: '4px', fontSize: '12px' }}>
                        Em: {f.used_at ? new Date(f.used_at + 'T12:00:00Z').toLocaleDateString('pt-BR') : '--'}
                      </div>
                      <div style={{ display: 'flex', gap: '6px', marginTop: '6px', justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          className="btn"
                          style={{ padding: '4px 10px', fontSize: '11px', background: 'var(--color-surface)', border: '1px solid var(--color-divider)' }}
                          onClick={() => openUsufrutoModal(f)}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className="btn"
                          style={{ padding: '4px 10px', fontSize: '11px', background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' }}
                          onClick={() => handleDesfazerUsufruto(f)}
                        >
                          Excluir
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
```

- [ ] **Step 4: Modal dinâmico — título e texto do botão mudam quando é edição**

De ([Solicitacoes.tsx:1146](../../../frontend/src/pages/estabelecimento/Solicitacoes.tsx#L1146)):
```tsx
            <h3 style={{ marginTop: 0, marginBottom: 'var(--space-4)' }}>Registrar Gozo</h3>
```
Para:
```tsx
            <h3 style={{ marginTop: 0, marginBottom: 'var(--space-4)' }}>{selectedFolga.status === 'USUFRUIDA' ? 'Editar Gozo' : 'Registrar Gozo'}</h3>
```

De ([Solicitacoes.tsx:1174-1176](../../../frontend/src/pages/estabelecimento/Solicitacoes.tsx#L1174-L1176)):
```tsx
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Registrando...' : 'Confirmar Gozo'}
                </button>
```
Para:
```tsx
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Salvando...' : (selectedFolga.status === 'USUFRUIDA' ? 'Salvar Alteração' : 'Confirmar Gozo')}
                </button>
```

- [ ] **Step 5: Type-check**

Run: `cd frontend && npm run build`
Expected: build sem erros de TypeScript.

- [ ] **Step 6: `detect_changes` e commit**

Rodar `mcp__gitnexus__detect_changes` (scope `unstaged`, com o parâmetro `worktree` se estiver rodando num worktree) e conferir que só os símbolos esperados em `Solicitacoes.tsx` aparecem, risco não HIGH/CRITICAL.

```bash
git add frontend/src/pages/estabelecimento/Solicitacoes.tsx
git commit -m "feat: permite editar e excluir folga usufruida (ciclo aberto)"
```

---

### Task 2: Verificação

**Files:** nenhum arquivo novo — script de leitura via service role key.

- [ ] **Step 1: Confirmar que o saldo não muda ao excluir**

Encontrar uma folga com `status = 'GERADA'` de teste (ou usar uma real com cautela, revertendo depois), simular o ciclo: registrar gozo (UPDATE para USUFRUIDA) → conferir `employees.saldo_plantoes` → excluir (UPDATE para GERADA) → conferir `employees.saldo_plantoes` de novo. Os dois valores devem ser idênticos.

```bash
node -e "
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const env = {};
fs.readFileSync('frontend/.env.local', 'utf-8').split('\n').forEach(l => { const m = l.match(/^([A-Z_]+)=(.*)\$/); if (m) env[m[1]] = m[2].trim(); });
const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
(async () => {
  const { data: cd } = await supabase.from('compensatory_days').select('id, employee_id, status').eq('status', 'GERADA').limit(1);
  if (!cd || cd.length === 0) { console.log('Nenhuma folga GERADA disponivel para teste'); return; }
  const folgaId = cd[0].id, empId = cd[0].employee_id;

  const before = await supabase.from('employees').select('saldo_plantoes').eq('id', empId).single();
  console.log('saldo ANTES (folga ainda GERADA):', before.data.saldo_plantoes);

  await supabase.from('compensatory_days').update({ status: 'USUFRUIDA', used_at: '2026-08-12', usage_registered_by: null }).eq('id', folgaId);
  const during = await supabase.from('employees').select('saldo_plantoes').eq('id', empId).single();
  console.log('saldo DEPOIS de registrar gozo:', during.data.saldo_plantoes);

  await supabase.from('compensatory_days').update({ status: 'GERADA', used_at: null, usage_registered_by: null }).eq('id', folgaId);
  const after = await supabase.from('employees').select('saldo_plantoes').eq('id', empId).single();
  console.log('saldo DEPOIS de excluir (reverter):', after.data.saldo_plantoes);

  console.log(before.data.saldo_plantoes === during.data.saldo_plantoes && during.data.saldo_plantoes === after.data.saldo_plantoes ? 'OK: saldo nunca mudou' : 'ATENCAO: saldo mudou em algum passo');
})();
"
```
Expected: os três valores de `saldo_plantoes` idênticos, e a linha final "OK: saldo nunca mudou".

- [ ] **Step 2: Conferência manual na tela (pede ajuda do usuário)**

Pedir para o usuário: como diretor de unidade, abrir "Comprar Folgas" → aba "Folgas Usufruídas", clicar em "Editar" numa folga e mudar a data, confirmar que salva; clicar em "Excluir", confirmar que a folga some dessa lista e reaparece em "Folgas Disponíveis para Compra" na aba ao lado.

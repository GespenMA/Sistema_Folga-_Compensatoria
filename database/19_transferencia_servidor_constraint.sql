-- =====================================================================================
-- 19. TRANSFERÊNCIA DE SERVIDOR — Passo 3/4: matrícula única globalmente
-- APLICAR SOMENTE DEPOIS que Configuracoes.tsx novo (busca por matrícula global,
-- sem depender de onConflict) já estiver em produção.
-- =====================================================================================
-- Migração autoprotegida: se já existir matrícula duplicada entre estabelecimentos,
-- o ADD CONSTRAINT falha explicitamente, sem apagar nada. A primeira tentativa
-- (2026-08-11) falhou: a auditoria anterior só tinha lido as primeiras 1000 linhas
-- de employees (limite padrão do PostgREST, sem paginação) — o total real era 3241.
-- Com paginação correta apareceram 2 matrículas de fato duplicadas (mesma pessoa
-- importada por engano tanto na unidade de origem quanto no GTE, no mesmo ciclo).
-- Confirmado com o usuário que os registros do GTE eram os corretos; os 2 registros
-- errados (e seus shifts/folgas em cascata) foram apagados manualmente antes de
-- reaplicar esta migration. Reauditoria final: 3239 employees, 3239 matrículas
-- distintas, zero duplicatas.

DO $$
DECLARE
  v_conname TEXT;
BEGIN
  SELECT conname INTO v_conname
  FROM pg_constraint
  WHERE conrelid = 'employees'::regclass
    AND contype = 'u'
    AND conname <> 'employees_matricula_key';

  IF v_conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE employees DROP CONSTRAINT %I', v_conname);
  END IF;
END $$;

ALTER TABLE employees ADD CONSTRAINT employees_matricula_key UNIQUE (matricula);

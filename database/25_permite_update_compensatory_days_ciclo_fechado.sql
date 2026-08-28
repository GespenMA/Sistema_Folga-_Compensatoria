-- =====================================================================================
-- Corrige um problema introduzido pelo recurso de comprar folgas de ciclos anteriores
-- (backlog, ver commit da correção em Solicitacoes.tsx que remove o filtro cycle_id da
-- busca de folgas disponíveis).
--
-- compensatory_days.cycle_id é fixo no ciclo de ORIGEM da folga (quando ela foi gerada) e
-- nunca muda depois — não representa mais uma janela de edição, é só metadado histórico.
-- A migração 24 já abriu uma exceção pontual (permitir UPDATE para status = 'GERADA' mesmo
-- com o ciclo de origem FECHADO, usada no fluxo de rejeitar/cancelar/auto-rejeitar). Só que
-- comprar uma folga de backlog precisa marcar o compensatory_day como
-- INDENIZACAO_SOLICITADA e, depois de aprovada, como INDENIZADA — exatamente os status que
-- a função anterior ainda bloqueava (por não serem 'GERADA'), fazendo a segunda etapa dessas
-- transações falhar silenciosamente: a purchase_request avança de status normalmente
-- (SOLICITADA/APROVADA), mas o compensatory_day fica preso em GERADA — a folga continua
-- aparecendo como "disponível para compra" mesmo já tendo uma solicitação aprovada, com
-- risco real de ser comprada em duplicidade.
--
-- Solução: UPDATE em compensatory_days deixa de ser bloqueado por ciclo fechado, para
-- qualquer status (não só 'GERADA') — o cycle_id da linha é histórico, não uma trava de
-- edição. INSERT continua exigindo ciclo aberto (gerar uma folga nova ainda precisa do
-- ciclo aberto — isso já acontece hoje como efeito colateral do INSERT em shifts, que
-- continua bloqueado).
-- =====================================================================================

CREATE OR REPLACE FUNCTION public.check_cycle_status()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_status ciclo_status_enum;
BEGIN
  IF TG_TABLE_NAME = 'purchase_requests' THEN
    SELECT status INTO v_status FROM cycles WHERE id = NEW.cycle_id;
    IF v_status = 'FECHADO' THEN
      IF TG_OP = 'UPDATE' AND NEW.status::text IN ('REJEITADA', 'CANCELADA') THEN
        RETURN NEW;
      END IF;
      RAISE EXCEPTION 'O ciclo está FECHADO e não permite novos lançamentos ou alterações.';
    END IF;
  ELSIF TG_TABLE_NAME = 'compensatory_days' THEN
    -- UPDATE nunca é bloqueado por ciclo fechado: cycle_id aqui é só o registro histórico de
    -- quando a folga foi gerada, não uma janela de edição. INSERT (geração de folga nova)
    -- continua exigindo ciclo aberto.
    IF TG_OP = 'INSERT' THEN
      SELECT status INTO v_status FROM cycles WHERE id = NEW.cycle_id;
      IF v_status = 'FECHADO' THEN
        RAISE EXCEPTION 'O ciclo está FECHADO e não permite novos lançamentos ou alterações.';
      END IF;
    END IF;
  ELSIF TG_TABLE_NAME = 'shifts' THEN
    SELECT status INTO v_status FROM cycles WHERE id = NEW.cycle_id;
    IF v_status = 'FECHADO' THEN
      RAISE EXCEPTION 'O ciclo está FECHADO e não permite novos lançamentos ou alterações.';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

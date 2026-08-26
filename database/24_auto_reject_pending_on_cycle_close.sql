-- 24_auto_reject_pending_on_cycle_close.sql
-- Automação no encerramento de ciclos:
-- 1. Permite rejeitar/cancelar solicitações e devolver direitos mesmo quando o ciclo está FECHADO.
-- 2. Trigger automático para rejeitar solicitações 'SOLICITADA' e devolver compensatory_days para 'GERADA' ao fechar qualquer ciclo.

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
    SELECT status INTO v_status FROM cycles WHERE id = NEW.cycle_id;
    IF v_status = 'FECHADO' THEN
      IF TG_OP = 'UPDATE' AND NEW.status::text = 'GERADA' THEN
        RETURN NEW;
      END IF;
      RAISE EXCEPTION 'O ciclo está FECHADO e não permite novos lançamentos ou alterações.';
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

CREATE OR REPLACE FUNCTION public.on_cycle_closed_reject_pending()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  IF NEW.status = 'FECHADO' AND (OLD.status IS DISTINCT FROM 'FECHADO') THEN
    -- 1. Devolver status de compensatory_days de solicitações pendentes deste ciclo
    UPDATE public.compensatory_days cd
    SET status = 'GERADA'
    FROM public.purchase_requests pr
    WHERE pr.cycle_id = NEW.id
      AND pr.status = 'SOLICITADA'
      AND pr.compensatory_day_id = cd.id;

    -- 2. Rejeitar todas as solicitações pendentes deste ciclo
    UPDATE public.purchase_requests
    SET status = 'REJEITADA',
        rejection_reason = 'Rejeitada automaticamente por encerramento do ciclo',
        analyzed_at = NOW()
    WHERE cycle_id = NEW.id
      AND status = 'SOLICITADA';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_on_cycle_closed ON public.cycles;
CREATE TRIGGER trg_on_cycle_closed
AFTER UPDATE OF status ON public.cycles
FOR EACH ROW
EXECUTE FUNCTION public.on_cycle_closed_reject_pending();

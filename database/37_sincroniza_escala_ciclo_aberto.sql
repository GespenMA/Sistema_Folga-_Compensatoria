-- =====================================================================================
-- 37_sincroniza_escala_ciclo_aberto.sql
--
-- Problema:
-- Escalas inéditas na planilha nascem sempre com permite_carga_horaria = TRUE durante a
-- importação (Configuracoes.tsx), inserindo os shifts daquele ciclo aberto com
-- conta_para_saldo = TRUE antes que o administrador possa ir até a aba
-- "Escalas de Trabalho" e mudar a chave para "Só Plantão Plus".
--
-- Solução:
-- Quando o administrador alterar permite_carga_horaria de uma escala (schedule_types),
-- sincroniza automaticamente conta_para_saldo dos shifts pertencentes ao ciclo vigente
-- (ABERTO ou REABERTO dentro da vigência), preservando ciclos FECHADOS intactos
-- (não-retroativo para ciclos encerrados).
-- =====================================================================================

CREATE OR REPLACE FUNCTION public.trg_sync_schedule_type_active_cycle()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    r_shift RECORD;
BEGIN
    IF NEW.permite_carga_horaria IS NOT DISTINCT FROM OLD.permite_carga_horaria THEN
        RETURN NEW;
    END IF;

    FOR r_shift IN
        SELECT s.id, s.employee_id, s.minutos_residuais, s.conta_para_saldo
        FROM public.shifts s
        JOIN public.employees e ON e.id = s.employee_id
        JOIN public.cycles c ON c.id = s.cycle_id
        WHERE e.schedule_type_id = NEW.id
          AND c.status IN ('ABERTO', 'REABERTO')
          AND c.opened_at IS NOT NULL
          AND clock_timestamp() >= c.opened_at
          AND (clock_timestamp() AT TIME ZONE 'America/Fortaleza')::date BETWEEN c.data_inicio AND c.data_fim
    LOOP
        IF NEW.permite_carga_horaria = FALSE AND r_shift.conta_para_saldo = TRUE THEN
            -- Reverte os minutos residuais adicionados neste ciclo aberto e desativa a contagem do shift
            UPDATE public.employees
            SET saldo_minutos = GREATEST(0, COALESCE(saldo_minutos, 0) - COALESCE(r_shift.minutos_residuais, 0))
            WHERE id = r_shift.employee_id;

            UPDATE public.shifts
            SET conta_para_saldo = FALSE,
                minutos_residuais = 0
            WHERE id = r_shift.id;
        ELSIF NEW.permite_carga_horaria = TRUE AND r_shift.conta_para_saldo = FALSE THEN
            UPDATE public.shifts
            SET conta_para_saldo = TRUE
            WHERE id = r_shift.id;
        END IF;
    END LOOP;

    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_after_update_schedule_type_sync ON public.schedule_types;
CREATE TRIGGER trg_after_update_schedule_type_sync
AFTER UPDATE OF permite_carga_horaria ON public.schedule_types
FOR EACH ROW
EXECUTE FUNCTION public.trg_sync_schedule_type_active_cycle();


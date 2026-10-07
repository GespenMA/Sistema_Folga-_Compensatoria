-- =====================================================================================
-- 32_bloqueia_alteracao_gozo_ciclo_fechado.sql
--
-- Protege os registros de gozo de folga (compensatory_days):
-- 1. Exige que novo registro de usufruto (ou alteração de data) pertença a ciclo ABERTO ou REABERTO.
-- 2. Bloqueia qualquer modificação ou exclusão de usufruto cujo ciclo já esteja FECHADO.
-- 3. Mantém liberado o fluxo de compra/rejeição/cancelamento de folgas de backlog (migração 25/31).
-- =====================================================================================

CREATE OR REPLACE FUNCTION public.check_cycle_status()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  v_status ciclo_status_enum;
  v_data_inicio date;
  v_data_fim date;
  v_opened_at timestamptz;
  v_cycle_gozo_status ciclo_status_enum;
BEGIN
  IF TG_TABLE_NAME = 'purchase_requests' THEN
    SELECT status, data_inicio, data_fim, opened_at
      INTO v_status, v_data_inicio, v_data_fim, v_opened_at
    FROM public.cycles
    WHERE id = NEW.cycle_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Ciclo informado não existe.';
    END IF;

    IF TG_OP = 'INSERT' THEN
      IF v_status NOT IN ('ABERTO', 'REABERTO') THEN
        RAISE EXCEPTION 'Novos lançamentos exigem um ciclo ABERTO ou REABERTO.';
      END IF;

      IF v_opened_at IS NULL OR clock_timestamp() < v_opened_at THEN
        RAISE EXCEPTION 'O ciclo ainda não foi efetivamente aberto.';
      END IF;

      IF (clock_timestamp() AT TIME ZONE 'America/Fortaleza')::date < v_data_inicio
         OR (clock_timestamp() AT TIME ZONE 'America/Fortaleza')::date > v_data_fim THEN
        RAISE EXCEPTION 'O lançamento só pode ocorrer durante a vigência do ciclo (% a %).', v_data_inicio, v_data_fim;
      END IF;

      IF NEW.data_plantao IS NULL OR NEW.data_plantao < v_data_inicio OR NEW.data_plantao > v_data_fim THEN
        RAISE EXCEPTION 'A data do evento precisa estar dentro da vigência do ciclo (% a %).', v_data_inicio, v_data_fim;
      END IF;

      NEW.requested_at := clock_timestamp();
      IF auth.uid() IS NOT NULL THEN
        NEW.requested_by := auth.uid();
      END IF;

      IF NEW.requested_by IS NULL THEN
        RAISE EXCEPTION 'Não foi possível identificar o usuário responsável pelo lançamento.';
      END IF;

      RETURN NEW;
    END IF;

    IF NEW.cycle_id IS DISTINCT FROM OLD.cycle_id
       OR NEW.employee_id IS DISTINCT FROM OLD.employee_id
       OR NEW.establishment_id IS DISTINCT FROM OLD.establishment_id
       OR NEW.position_id IS DISTINCT FROM OLD.position_id
       OR NEW.compensatory_day_id IS DISTINCT FROM OLD.compensatory_day_id
       OR NEW.tipo_solicitacao IS DISTINCT FROM OLD.tipo_solicitacao
       OR NEW.data_plantao IS DISTINCT FROM OLD.data_plantao
       OR NEW.valor IS DISTINCT FROM OLD.valor
       OR NEW.valor_historico_id IS DISTINCT FROM OLD.valor_historico_id
       OR NEW.justificativa IS DISTINCT FROM OLD.justificativa
       OR NEW.requested_by IS DISTINCT FROM OLD.requested_by
       OR NEW.requested_at IS DISTINCT FROM OLD.requested_at THEN
      RAISE EXCEPTION 'Os dados históricos do lançamento são imutáveis; cancele e crie uma nova solicitação.';
    END IF;

    IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'Uma solicitação existente só pode ser alterada por uma transição de status.';
    END IF;

    -- Encerramento automático e cancelamentos continuam permitidos após o fechamento.
    IF v_status = 'FECHADO' AND NEW.status::text NOT IN ('REJEITADA', 'CANCELADA') THEN
      RAISE EXCEPTION 'O ciclo está FECHADO e não permite novos lançamentos ou alterações.';
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status THEN
      IF OLD.status::text <> 'SOLICITADA'
         OR NEW.status::text NOT IN ('APROVADA', 'REJEITADA', 'CANCELADA') THEN
        RAISE EXCEPTION 'Transição de status inválida: % para %.', OLD.status, NEW.status;
      END IF;

      IF NEW.status::text = 'APROVADA' THEN
        IF v_status NOT IN ('ABERTO', 'REABERTO')
           OR (clock_timestamp() AT TIME ZONE 'America/Fortaleza')::date < v_data_inicio
           OR (clock_timestamp() AT TIME ZONE 'America/Fortaleza')::date > v_data_fim THEN
          RAISE EXCEPTION 'A aprovação só pode ocorrer durante a vigência de um ciclo ABERTO ou REABERTO.';
        END IF;
      END IF;

      IF NEW.status::text IN ('APROVADA', 'REJEITADA') THEN
        NEW.analyzed_at := clock_timestamp();
        IF auth.uid() IS NOT NULL THEN
          NEW.analyzed_by := auth.uid();
        END IF;
      ELSIF NEW.status::text = 'CANCELADA' THEN
        NEW.cancelled_at := clock_timestamp();
        IF auth.uid() IS NOT NULL THEN
          NEW.cancelled_by := auth.uid();
        END IF;
      END IF;
    END IF;

  ELSIF TG_TABLE_NAME = 'compensatory_days' THEN
    IF TG_OP = 'INSERT' THEN
      SELECT status INTO v_status FROM public.cycles WHERE id = NEW.cycle_id;
      IF v_status NOT IN ('ABERTO', 'REABERTO') THEN
        RAISE EXCEPTION 'Novas folgas exigem um ciclo ABERTO ou REABERTO.';
      END IF;
    ELSIF TG_OP = 'UPDATE' THEN
      -- 1. Se a folga já estava usufruída (OLD.status = 'USUFRUIDA'):
      IF OLD.status = 'USUFRUIDA' THEN
        -- Verifica o status do ciclo ao qual a data do gozo anterior pertencia
        SELECT status INTO v_cycle_gozo_status
        FROM public.cycles
        WHERE OLD.used_at >= data_inicio AND OLD.used_at <= data_fim
        ORDER BY created_at DESC
        LIMIT 1;

        -- Fallback pelo cycle_id de origem se não casou com período
        IF v_cycle_gozo_status IS NULL THEN
          SELECT status INTO v_cycle_gozo_status FROM public.cycles WHERE id = OLD.cycle_id;
        END IF;

        IF v_cycle_gozo_status = 'FECHADO' THEN
          IF NEW.status <> 'USUFRUIDA' OR NEW.used_at IS DISTINCT FROM OLD.used_at THEN
            RAISE EXCEPTION 'Não é permitido alterar ou excluir o registro de gozo de um ciclo encerrado (FECHADO).';
          END IF;
        END IF;
      END IF;

      -- 2. Se a folga está sendo marcada como usufruída ou tendo a data alterada:
      IF NEW.status = 'USUFRUIDA' AND (OLD.status <> 'USUFRUIDA' OR NEW.used_at IS DISTINCT FROM OLD.used_at) THEN
        IF NEW.used_at IS NULL THEN
          RAISE EXCEPTION 'A data do gozo da folga é obrigatória.';
        END IF;

        SELECT status INTO v_cycle_gozo_status
        FROM public.cycles
        WHERE NEW.used_at >= data_inicio AND NEW.used_at <= data_fim
        ORDER BY created_at DESC
        LIMIT 1;

        IF v_cycle_gozo_status IS NULL OR v_cycle_gozo_status NOT IN ('ABERTO', 'REABERTO') THEN
          RAISE EXCEPTION 'A data de gozo (%) precisa pertencer a um ciclo ABERTO ou REABERTO.', NEW.used_at;
        END IF;
      END IF;
    END IF;

  ELSIF TG_TABLE_NAME = 'shifts' THEN
    SELECT status, data_inicio, data_fim, opened_at
      INTO v_status, v_data_inicio, v_data_fim, v_opened_at
    FROM public.cycles
    WHERE id = NEW.cycle_id;

    IF v_status NOT IN ('ABERTO', 'REABERTO') THEN
      RAISE EXCEPTION 'Lançamentos de plantão exigem um ciclo ABERTO ou REABERTO.';
    END IF;

    IF v_opened_at IS NULL OR clock_timestamp() < v_opened_at
       OR (clock_timestamp() AT TIME ZONE 'America/Fortaleza')::date < v_data_inicio
       OR (clock_timestamp() AT TIME ZONE 'America/Fortaleza')::date > v_data_fim THEN
      RAISE EXCEPTION 'O lançamento só pode ocorrer durante a vigência do ciclo (% a %).', v_data_inicio, v_data_fim;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.check_cycle_status() IS
  'Protege lançamentos por status, vigência, imutabilidade histórica de solicitações e bloqueia alteração/exclusão de gozo de folgas de ciclos encerrados.';

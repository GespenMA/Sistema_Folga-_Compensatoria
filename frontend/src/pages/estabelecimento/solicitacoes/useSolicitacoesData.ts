import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { formatBRL } from '../../../utils/format';
import type {
  ActionResult,
  ActiveCycle,
  Budget,
  FolgaDisponivel,
  FolgaUsufruida,
  PositionValues,
  Solicitacao,
} from './types';

const FOLGA_SELECT = `
  id, periodo_inicio, periodo_fim, quantidade_plantoes, status,
  employees ( id, nome, matricula, positions (id, nome, codigo) )
`;

const USUFRUIDA_SELECT = `
  id, used_at, quantidade_plantoes, status,
  employees ( id, nome, matricula, positions (id, nome, codigo) )
`;

const SOLICITACAO_SELECT = `
  id, valor, status, justificativa, requested_at, tipo_solicitacao, data_plantao,
  compensatory_day_id,
  compensatory_days (quantidade_plantoes),
  employees (nome, matricula, positions (id, nome, codigo))
`;

/** Supabase rejects with plain objects, not Error instances — handle both. */
const errorMessageOf = (error: unknown): string => {
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: unknown }).message ?? '');
  }
  return '';
};

const readableError = (error: unknown, fallback: string): string => {
  const message = errorMessageOf(error).replace('ORCAMENTO_EXCEDIDO: ', '');
  return message || fallback;
};

const isBudgetError = (error: unknown): boolean =>
  errorMessageOf(error).includes('ORCAMENTO_EXCEDIDO');

export type SolicitacoesData = {
  loading: boolean;
  error: string | null;
  reload: () => void;
  activeCycle: ActiveCycle | null;
  folgasDisponiveis: FolgaDisponivel[];
  folgasUsufruidas: FolgaUsufruida[];
  solicitacoes: Solicitacao[];
  positionValues: PositionValues;
  budget: Budget;
  valorDaFolga: (folga: FolgaDisponivel) => number;
  fetchValorCargo: (positionId: string) => Promise<{ id: string; valor: number } | null>;
  solicitarCompra: (input: {
    folga: FolgaDisponivel;
    dataPlantao: string;
    justificativa: string;
    valorUnitario: number;
    valorHistoricoId: string;
  }) => Promise<ActionResult>;
  solicitarCompraEmLote: (input: {
    folgas: FolgaDisponivel[];
    dataPlantao: string;
    justificativa: string;
  }) => Promise<ActionResult>;
  registrarGozo: (folgaId: string, dataUsufruto: string) => Promise<ActionResult>;
  desfazerGozo: (folgaId: string) => Promise<ActionResult>;
  aprovar: (solicitacao: Solicitacao) => Promise<ActionResult>;
  aprovarEmLote: (solicitacoes: Solicitacao[]) => Promise<ActionResult>;
  rejeitar: (solicitacao: Solicitacao, motivo: string) => Promise<ActionResult>;
  cancelar: (solicitacao: Solicitacao) => Promise<ActionResult>;
};

/**
 * All Supabase access for the "Solicitar Compra" screen. The page stays a view:
 * it renders state and forwards intent, and every mutation answers with an
 * ActionResult instead of throwing or calling alert().
 */
export const useSolicitacoesData = (establishmentId?: string, userId?: string): SolicitacoesData => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCycle, setActiveCycle] = useState<ActiveCycle | null>(null);
  const [folgasDisponiveis, setFolgasDisponiveis] = useState<FolgaDisponivel[]>([]);
  const [folgasUsufruidas, setFolgasUsufruidas] = useState<FolgaUsufruida[]>([]);
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([]);
  const [positionValues, setPositionValues] = useState<PositionValues>({});
  const [orcado, setOrcado] = useState(0);

  // Guards against a stale response overwriting a newer one when the
  // establishment changes or a reload lands out of order.
  const requestIdRef = useRef(0);

  const fetchAll = useCallback(
    async (showLoading: boolean) => {
      if (!establishmentId) return;
      requestIdRef.current += 1;
      const requestId = requestIdRef.current;
      const isCurrent = () => requestId === requestIdRef.current;

      if (showLoading) setLoading(true);
      setError(null);

      try {
        const { data: cycleData, error: cycleError } = await supabase
          .from('cycles')
          .select('id, nome, data_inicio, data_fim, status')
          .in('status', ['ABERTO', 'REABERTO'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (cycleError) throw cycleError;
        if (!isCurrent()) return;

        if (!cycleData) {
          setActiveCycle(null);
          setFolgasDisponiveis([]);
          setFolgasUsufruidas([]);
          setSolicitacoes([]);
          setOrcado(0);
          return;
        }

        const cycle = cycleData as ActiveCycle;
        setActiveCycle(cycle);

        const [folgasRes, usufruidasRes, posValsRes, solsRes, ceRes] = await Promise.all([
          supabase
            .from('compensatory_days')
            .select(FOLGA_SELECT)
            .eq('cycle_id', cycle.id)
            .eq('status', 'GERADA')
            .order('generated_at', { ascending: false }),
          supabase
            .from('compensatory_days')
            .select(USUFRUIDA_SELECT)
            .eq('cycle_id', cycle.id)
            .eq('status', 'USUFRUIDA')
            .order('used_at', { ascending: false }),
          supabase.from('position_values').select('position_id, valor').is('vigencia_fim', null),
          supabase
            .from('purchase_requests')
            .select(SOLICITACAO_SELECT)
            .eq('cycle_id', cycle.id)
            .eq('establishment_id', establishmentId)
            .order('requested_at', { ascending: false }),
          supabase
            .from('cycle_establishments')
            .select('total_orcado')
            .eq('cycle_id', cycle.id)
            .eq('establishment_id', establishmentId)
            .maybeSingle(),
        ]);

        const firstError =
          folgasRes.error ?? usufruidasRes.error ?? posValsRes.error ?? solsRes.error ?? ceRes.error;
        if (firstError) throw firstError;
        if (!isCurrent()) return;

        setFolgasDisponiveis((folgasRes.data ?? []) as unknown as FolgaDisponivel[]);
        setFolgasUsufruidas((usufruidasRes.data ?? []) as unknown as FolgaUsufruida[]);
        setSolicitacoes((solsRes.data ?? []) as unknown as Solicitacao[]);

        const values: PositionValues = {};
        (posValsRes.data ?? []).forEach((row) => {
          values[row.position_id as string] = Number(row.valor);
        });
        setPositionValues(values);

        // The budget ceiling always comes from the stored total_orcado — the same
        // number the DB triggers use — never from a recompute with current prices.
        setOrcado(Number(ceRes.data?.total_orcado ?? 0));
      } catch (err) {
        if (!isCurrent()) return;
        setError(
          readableError(err, 'Falha de comunicação com o servidor. Verifique sua conexão.'),
        );
      } finally {
        if (isCurrent()) setLoading(false);
      }
    },
    [establishmentId],
  );

  useEffect(() => {
    if (!establishmentId) return;
    void fetchAll(true);
  }, [establishmentId, fetchAll]);

  const reload = useCallback(() => {
    void fetchAll(true);
  }, [fetchAll]);

  const refreshQuietly = useCallback(() => fetchAll(false), [fetchAll]);

  const budget = useMemo<Budget>(() => {
    const aprovado = solicitacoes
      .filter((item) => item.status === 'APROVADA')
      .reduce((total, item) => total + Number(item.valor), 0);
    const empenhado = solicitacoes
      .filter((item) => item.status === 'SOLICITADA')
      .reduce((total, item) => total + Number(item.valor), 0);

    return {
      orcado,
      aprovado,
      empenhado,
      disponivelParaAprovacao: orcado - aprovado,
      disponivelParaLancamento: orcado - aprovado - empenhado,
    };
  }, [orcado, solicitacoes]);

  const valorDaFolga = useCallback(
    (folga: FolgaDisponivel) =>
      (positionValues[folga.employees?.positions?.id] ?? 0) * folga.quantidade_plantoes,
    [positionValues],
  );

  const fetchValorCargo = useCallback(async (positionId: string) => {
    const { data, error: valorError } = await supabase
      .from('position_values')
      .select('id, valor')
      .eq('position_id', positionId)
      .order('vigencia_inicio', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (valorError || !data) return null;
    return { id: data.id as string, valor: Number(data.valor) };
  }, []);

  const hasConflictingRequest = useCallback(async (employeeId: string, dataPlantao: string) => {
    const { data } = await supabase
      .from('purchase_requests')
      .select('id')
      .eq('employee_id', employeeId)
      .eq('data_plantao', dataPlantao)
      .neq('status', 'REJEITADA')
      .neq('status', 'CANCELADA')
      .limit(1);

    return Boolean(data && data.length > 0);
  }, []);

  const solicitarCompra = useCallback<SolicitacoesData['solicitarCompra']>(
    async ({ folga, dataPlantao, justificativa, valorUnitario, valorHistoricoId }) => {
      if (!activeCycle || !establishmentId || !userId) {
        return { ok: false, message: 'Sessão inválida. Recarregue a página e tente novamente.' };
      }

      try {
        if (await hasConflictingRequest(folga.employees.id, dataPlantao)) {
          return {
            ok: false,
            message: `${folga.employees.nome} já possui uma solicitação ou compra de plantão nesta data.`,
          };
        }

        const { error: requestError } = await supabase.from('purchase_requests').upsert(
          [
            {
              compensatory_day_id: folga.id,
              establishment_id: establishmentId,
              cycle_id: activeCycle.id,
              employee_id: folga.employees.id,
              position_id: folga.employees.positions.id,
              valor: valorUnitario * folga.quantidade_plantoes,
              valor_historico_id: valorHistoricoId,
              justificativa,
              data_plantao: dataPlantao,
              status: 'SOLICITADA',
              requested_by: userId,
              analyzed_by: null,
              analyzed_at: null,
              rejection_reason: null,
              cancelled_by: null,
              cancelled_at: null,
              cancellation_reason: null,
            },
          ],
          { onConflict: 'compensatory_day_id' },
        );
        if (requestError) throw requestError;

        const { error: updateError } = await supabase
          .from('compensatory_days')
          .update({ status: 'INDENIZACAO_SOLICITADA' })
          .eq('id', folga.id);
        if (updateError) throw updateError;

        await refreshQuietly();
        return { ok: true };
      } catch (err) {
        return { ok: false, message: readableError(err, 'Erro ao solicitar a compra da folga.') };
      }
    },
    [activeCycle, establishmentId, userId, hasConflictingRequest, refreshQuietly],
  );

  const solicitarCompraEmLote = useCallback<SolicitacoesData['solicitarCompraEmLote']>(
    async ({ folgas, dataPlantao, justificativa }) => {
      if (!activeCycle || !establishmentId || !userId) {
        return { ok: false, message: 'Sessão inválida. Recarregue a página e tente novamente.' };
      }

      const failures: string[] = [];

      for (const folga of folgas) {
        try {
          if (await hasConflictingRequest(folga.employees.id, dataPlantao)) {
            failures.push(`${folga.employees.nome} — já possui plantão nesta data`);
            continue;
          }

          const posVal = await fetchValorCargo(folga.employees.positions.id);
          if (!posVal) {
            failures.push(`${folga.employees.nome} — cargo sem valor configurado`);
            continue;
          }

          const { error: requestError } = await supabase.from('purchase_requests').upsert(
            [
              {
                compensatory_day_id: folga.id,
                establishment_id: establishmentId,
                cycle_id: activeCycle.id,
                employee_id: folga.employees.id,
                position_id: folga.employees.positions.id,
                valor: posVal.valor * folga.quantidade_plantoes,
                valor_historico_id: posVal.id,
                justificativa,
                data_plantao: dataPlantao,
                status: 'SOLICITADA',
                requested_by: userId,
              },
            ],
            { onConflict: 'compensatory_day_id' },
          );
          if (requestError) throw requestError;

          const { error: updateError } = await supabase
            .from('compensatory_days')
            .update({ status: 'INDENIZACAO_SOLICITADA' })
            .eq('id', folga.id);
          if (updateError) throw updateError;
        } catch (err) {
          failures.push(`${folga.employees.nome} — ${readableError(err, 'erro inesperado')}`);
        }
      }

      await refreshQuietly();

      if (failures.length === 0) return { ok: true };
      return {
        ok: false,
        message:
          failures.length === folgas.length
            ? 'Nenhuma folga pôde ser solicitada.'
            : `${folgas.length - failures.length} de ${folgas.length} folgas foram solicitadas. As seguintes falharam:`,
        details: failures,
      };
    },
    [activeCycle, establishmentId, userId, hasConflictingRequest, fetchValorCargo, refreshQuietly],
  );

  const registrarGozo = useCallback<SolicitacoesData['registrarGozo']>(
    async (folgaId, dataUsufruto) => {
      try {
        const { error: updateError } = await supabase
          .from('compensatory_days')
          .update({ status: 'USUFRUIDA', used_at: dataUsufruto, usage_registered_by: userId })
          .eq('id', folgaId);
        if (updateError) throw updateError;

        await refreshQuietly();
        return { ok: true };
      } catch (err) {
        return { ok: false, message: readableError(err, 'Erro ao registrar o gozo da folga.') };
      }
    },
    [userId, refreshQuietly],
  );

  const desfazerGozo = useCallback<SolicitacoesData['desfazerGozo']>(
    async (folgaId) => {
      try {
        const { error: updateError } = await supabase
          .from('compensatory_days')
          .update({ status: 'GERADA', used_at: null, usage_registered_by: null })
          .eq('id', folgaId);
        if (updateError) throw updateError;

        await refreshQuietly();
        return { ok: true };
      } catch (err) {
        return { ok: false, message: readableError(err, 'Erro ao excluir o registro de gozo.') };
      }
    },
    [refreshQuietly],
  );

  /**
   * Approval writes the request first and then the compensatory day. There is no
   * transaction available from the client, so a half-applied approval is reported
   * explicitly instead of failing silently.
   */
  const approveOne = useCallback(
    async (solicitacao: Solicitacao): Promise<ActionResult> => {
      const { error: requestError } = await supabase
        .from('purchase_requests')
        .update({
          status: 'APROVADA',
          analyzed_by: userId,
          analyzed_at: new Date().toISOString(),
        })
        .eq('id', solicitacao.id);
      if (requestError) throw requestError;

      if (solicitacao.compensatory_day_id) {
        const { error: dayError } = await supabase
          .from('compensatory_days')
          .update({ status: 'INDENIZADA', decided_by: userId, decided_at: new Date().toISOString() })
          .eq('id', solicitacao.compensatory_day_id);
        if (dayError) {
          return {
            ok: false,
            message: `A solicitação de ${solicitacao.employees?.nome} foi aprovada, mas a folga não foi baixada. Recarregue e verifique antes de repetir.`,
          };
        }
      }

      return { ok: true };
    },
    [userId],
  );

  const aprovar = useCallback<SolicitacoesData['aprovar']>(
    async (solicitacao) => {
      try {
        const result = await approveOne(solicitacao);
        await refreshQuietly();
        return result;
      } catch (err) {
        await refreshQuietly();
        return { ok: false, message: readableError(err, 'Erro ao aprovar a solicitação.') };
      }
    },
    [approveOne, refreshQuietly],
  );

  const aprovarEmLote = useCallback<SolicitacoesData['aprovarEmLote']>(
    async (items) => {
      const failures: string[] = [];
      let budgetBlocked = false;

      for (const item of items) {
        try {
          const result = await approveOne(item);
          if (!result.ok) failures.push(result.message);
        } catch (err) {
          failures.push(`${item.employees?.nome} — ${readableError(err, 'erro inesperado')}`);
          // A budget rejection from the DB stops the batch: every remaining item
          // would fail for the same reason.
          if (isBudgetError(err)) {
            budgetBlocked = true;
            break;
          }
        }
      }

      await refreshQuietly();

      if (failures.length === 0) return { ok: true };
      return {
        ok: false,
        message: budgetBlocked
          ? 'A aprovação em lote foi interrompida porque o orçamento foi excedido.'
          : `${items.length - failures.length} de ${items.length} solicitações foram aprovadas. As seguintes falharam:`,
        details: failures,
      };
    },
    [approveOne, refreshQuietly],
  );

  const rejeitar = useCallback<SolicitacoesData['rejeitar']>(
    async (solicitacao, motivo) => {
      try {
        const { error: requestError } = await supabase
          .from('purchase_requests')
          .update({
            status: 'REJEITADA',
            analyzed_by: userId,
            analyzed_at: new Date().toISOString(),
            rejection_reason: motivo,
          })
          .eq('id', solicitacao.id);
        if (requestError) throw requestError;

        if (solicitacao.compensatory_day_id) {
          const { error: dayError } = await supabase
            .from('compensatory_days')
            .update({ status: 'GERADA', decided_by: userId, decided_at: new Date().toISOString() })
            .eq('id', solicitacao.compensatory_day_id);
          if (dayError) throw dayError;
        }

        await refreshQuietly();
        return { ok: true };
      } catch (err) {
        await refreshQuietly();
        return { ok: false, message: readableError(err, 'Erro ao rejeitar a solicitação.') };
      }
    },
    [userId, refreshQuietly],
  );

  const cancelar = useCallback<SolicitacoesData['cancelar']>(
    async (solicitacao) => {
      try {
        const { error: requestError } = await supabase
          .from('purchase_requests')
          .update({
            status: 'CANCELADA',
            cancelled_by: userId,
            cancelled_at: new Date().toISOString(),
            cancellation_reason: 'Cancelado pela unidade',
          })
          .eq('id', solicitacao.id);
        if (requestError) throw requestError;

        if (solicitacao.compensatory_day_id) {
          const { error: dayError } = await supabase
            .from('compensatory_days')
            .update({ status: 'GERADA' })
            .eq('id', solicitacao.compensatory_day_id);
          if (dayError) throw dayError;
        }

        await refreshQuietly();
        return { ok: true };
      } catch (err) {
        await refreshQuietly();
        return { ok: false, message: readableError(err, 'Erro ao cancelar a solicitação.') };
      }
    },
    [userId, refreshQuietly],
  );

  return {
    loading,
    error,
    reload,
    activeCycle,
    folgasDisponiveis,
    folgasUsufruidas,
    solicitacoes,
    positionValues,
    budget,
    valorDaFolga,
    fetchValorCargo,
    solicitarCompra,
    solicitarCompraEmLote,
    registrarGozo,
    desfazerGozo,
    aprovar,
    aprovarEmLote,
    rejeitar,
    cancelar,
  };
};

export const formatBudgetGap = (missing: number): string => formatBRL(Math.max(0, missing));

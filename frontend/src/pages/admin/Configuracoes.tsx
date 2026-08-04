import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import * as XLSX from 'xlsx';

type Position = {
  id: string;
  nome: string;
  codigo: string;
  ativo: boolean;
  valorAtual: number;
};

type ProfileUser = {
  id: string;
  nome: string;
  email: string;
  perfil: string;
  ativo: boolean;
};

export const Configuracoes: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'usuarios' | 'cargos' | 'importacao' | 'tutoriais'>('usuarios');
  
  // Estados para Usuários
  const [usuarios, setUsuarios] = useState<ProfileUser[]>([]);
  const [estabelecimentos, setEstabelecimentos] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  // Estados para Modal Usuário
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [userNome, setUserNome] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userSenha, setUserSenha] = useState('');
  const [userPerfil, setUserPerfil] = useState('ESTABELECIMENTO');
  const [userEstId, setUserEstId] = useState('');
  const [isSubmittingUser, setIsSubmittingUser] = useState(false);

  // Estados para Cargos
  const [cargos, setCargos] = useState<Position[]>([]);
  const [loadingCargos, setLoadingCargos] = useState(true);
  
  const [isCargoModalOpen, setIsCargoModalOpen] = useState(false);
  const [cargoEditId, setCargoEditId] = useState<string | null>(null);
  const [cargoNome, setCargoNome] = useState('');
  const [cargoCodigo, setCargoCodigo] = useState('');
  const [cargoValor, setCargoValor] = useState('');
  const [isSubmittingCargo, setIsSubmittingCargo] = useState(false);

  // Estados para Tutoriais
  const [tutoriais, setTutoriais] = useState<any[]>([]);
  const [loadingTutoriais, setLoadingTutoriais] = useState(false);
  const [isTutorialModalOpen, setIsTutorialModalOpen] = useState(false);
  const [tutorialEditId, setTutorialEditId] = useState<string | null>(null);
  const [tutorialTitulo, setTutorialTitulo] = useState('');
  const [tutorialDescricao, setTutorialDescricao] = useState('');
  const [tutorialUrl, setTutorialUrl] = useState('');
  const [isSubmittingTutorial, setIsSubmittingTutorial] = useState(false);

  // Estados para Alertas/Confirm
  const [confirmResetEmail, setConfirmResetEmail] = useState<string | null>(null);
  const [alertMessage, setAlertMessage] = useState<{title: string, msg: string, type: 'success' | 'error'} | null>(null);

  // =============================================
  // Estados para Importação Mensal
  // =============================================
  type PreviewRow = { matricula: string; nome: string; cargo: string; dataAdmissao: string; estabelecimento: string; trabalhadas: string; minutosNovos: number; plantoes: number; minutosResiduo: number; erros: string[] };
  type ImportResult = { importados: number; atualizados: number; shiftsInseridos: number; erros: string[] };

  const [activeCycleForImport, setActiveCycleForImport] = useState<{ id: string; nome: string; data_inicio: string; data_fim: string } | null>(null);
  const [loadingImportCycle, setLoadingImportCycle] = useState(false);
  const [importPreview, setImportPreview] = useState<PreviewRow[]>([]);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importStep, setImportStep] = useState<'idle' | 'preview' | 'importing' | 'done'>('idle');
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number; currentName: string }>({ current: 0, total: 0, currentName: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (activeTab === 'usuarios') {
      fetchUsuarios();
      fetchEstabelecimentos();
    } else if (activeTab === 'cargos') {
      fetchCargos();
    } else if (activeTab === 'importacao') {
      fetchActiveCycleForImport();
    } else if (activeTab === 'tutoriais') {
      fetchTutoriais();
    }
  }, [activeTab]);

  const fetchActiveCycleForImport = async () => {
    setLoadingImportCycle(true);
    try {
      const { data } = await supabase
        .from('cycles')
        .select('id, nome, data_inicio, data_fim')
        .in('status', ['ABERTO', 'REABERTO'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      setActiveCycleForImport(data || null);
    } finally {
      setLoadingImportCycle(false);
    }
  };

  const fetchTutoriais = async () => {
    setLoadingTutoriais(true);
    try {
      const { data, error } = await supabase.from('tutorials').select('*').order('created_at', { ascending: false });
      if (error && error.code !== '42P01') throw error; // Ignora se tabela não existe ainda
      if (data) setTutoriais(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingTutoriais(false);
    }
  };

  const openNewTutorialModal = () => {
    setTutorialEditId(null);
    setTutorialTitulo('');
    setTutorialDescricao('');
    setTutorialUrl('');
    setIsTutorialModalOpen(true);
  };

  const openEditTutorialModal = (tut: any) => {
    setTutorialEditId(tut.id);
    setTutorialTitulo(tut.titulo);
    setTutorialDescricao(tut.descricao || '');
    setTutorialUrl(tut.youtube_url);
    setIsTutorialModalOpen(true);
  };

  const handleDeleteTutorial = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este tutorial?')) return;
    try {
      const { error } = await supabase.from('tutorials').delete().eq('id', id);
      if (error) throw error;
      fetchTutoriais();
    } catch (err: any) {
      alert(err.message || 'Erro ao excluir tutorial.');
    }
  };

  const handleSaveTutorial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tutorialTitulo.trim() || !tutorialUrl.trim()) return;

    setIsSubmittingTutorial(true);
    try {
      const payload = {
        titulo: tutorialTitulo,
        descricao: tutorialDescricao,
        youtube_url: tutorialUrl
      };

      if (tutorialEditId) {
        const { error } = await supabase.from('tutorials').update(payload).eq('id', tutorialEditId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('tutorials').insert([payload]);
        if (error) throw error;
      }
      setIsTutorialModalOpen(false);
      fetchTutoriais();
    } catch (err: any) {
      alert(err.message || 'Erro ao salvar tutorial.');
    } finally {
      setIsSubmittingTutorial(false);
    }
  };

  // Converte "HH:MM" para minutos totais
  const parseHorasMinutos = (str: string | number): number => {
    if (!str) return 0;
    
    // Se for um número (ou string numérica sem ':'), o Excel enviou como fração de dias
    if (!String(str).includes(':') && !isNaN(Number(str))) {
      const days = parseFloat(String(str));
      return Math.round(days * 24 * 60);
    }
    
    const parts = String(str).trim().split(':');
    if (parts.length < 2) return 0;
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  };

  const fetchEstabelecimentos = async () => {
    const { data } = await supabase.from('establishments').select('id, nome').order('nome');
    if (data) setEstabelecimentos(data);
  };

  const fetchUsuarios = async () => {
    setLoadingUsers(true);
    try {
      const { data } = await supabase.from('profiles').select('*').order('nome');
      if (data) setUsuarios(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchCargos = async () => {
    setLoadingCargos(true);
    try {
      const { data, error } = await supabase
        .from('positions')
        .select(`
          id, nome, codigo, ativo,
          position_values (
            valor, vigencia_fim
          )
        `)
        .order('nome');
      
      if (error) throw error;

      if (data) {
        const formatCargos = data.map((pos: any) => {
          const activeValue = pos.position_values?.find((v: any) => !v.vigencia_fim);
          return {
            id: pos.id,
            nome: pos.nome,
            codigo: pos.codigo,
            ativo: pos.ativo,
            valorAtual: activeValue ? activeValue.valor : 0
          };
        });
        setCargos(formatCargos);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingCargos(false);
    }
  };

  const openUserModal = () => {
    setUserNome('');
    setUserEmail('');
    setUserSenha('');
    setUserPerfil('ESTABELECIMENTO');
    setUserEstId('');
    setIsUserModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (userPerfil === 'ESTABELECIMENTO' && !userEstId) {
      alert('Selecione o estabelecimento penal.');
      return;
    }
    if (userSenha.length < 6) {
      alert('A senha deve ter no mínimo 6 caracteres.');
      return;
    }

    setIsSubmittingUser(true);
    try {
      // Usamos um cliente temporário sem persistência para não deslogar o admin atual
      const { createClient } = await import('@supabase/supabase-js');
      const tempClient = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY,
        { auth: { persistSession: false, autoRefreshToken: false } }
      );

      const { data: authData, error: authError } = await tempClient.auth.signUp({
        email: userEmail,
        password: userSenha,
      });

      if (authError) throw authError;

      const userId = authData.user?.id;
      if (!userId) throw new Error('Falha ao gerar ID do usuário.');

      // Faz um upsert porque a trigger do BD pode já ter criado a linha vazia no profiles
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: userId,
        nome: userNome,
        email: userEmail,
        perfil: userPerfil,
        establishment_id: userPerfil === 'ESTABELECIMENTO' ? userEstId : null,
      });

      if (profileError) throw profileError;

      setIsUserModalOpen(false);
      fetchUsuarios();
    } catch (err: any) {
      alert(err.message || 'Erro ao cadastrar usuário.');
    } finally {
      setIsSubmittingUser(false);
    }
  };

  const handleResetPassword = (email: string) => {
    setConfirmResetEmail(email);
  };

  const executeResetPassword = async () => {
    if (!confirmResetEmail) return;
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(confirmResetEmail);
      if (error) throw error;
      setAlertMessage({ title: 'Sucesso', msg: `E-mail de redefinição enviado com sucesso para ${confirmResetEmail}!`, type: 'success' });
    } catch (err: any) {
      setAlertMessage({ title: 'Erro', msg: err.message || 'Erro ao enviar e-mail de redefinição.', type: 'error' });
    } finally {
      setConfirmResetEmail(null);
    }
  };

  const openNewCargoModal = () => {
    setCargoEditId(null);
    setCargoNome('');
    setCargoCodigo('');
    setCargoValor('');
    setIsCargoModalOpen(true);
  };

  const openEditCargoModal = (cargo: Position) => {
    setCargoEditId(cargo.id);
    setCargoNome(cargo.nome);
    setCargoCodigo(cargo.codigo);
    setCargoValor(cargo.valorAtual.toString());
    setIsCargoModalOpen(true);
  };

  const handleDeleteCargo = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este cargo? Se houver servidores vinculados, a exclusão será bloqueada.')) return;
    
    try {
      const { error } = await supabase.from('positions').delete().eq('id', id);
      if (error) {
        if (error.code === '23503') {
           alert('Não é possível excluir. Existem registros dependentes (ex: planejamento ou servidores). Tente inativá-lo futuramente.');
        } else {
           throw error;
        }
      } else {
        fetchCargos();
      }
    } catch (err: any) {
      alert(err.message || 'Erro ao excluir cargo.');
    }
  };

  const handleSaveCargo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cargoNome.trim() || !cargoCodigo.trim() || !cargoValor) return;

    setIsSubmittingCargo(true);
    try {
      const parsedValor = parseFloat(cargoValor.toString().replace(',', '.'));

      if (cargoEditId) {
        const { error: posError } = await supabase
          .from('positions')
          .update({ nome: cargoNome, codigo: cargoCodigo })
          .eq('id', cargoEditId);
        
        if (posError) throw posError;

        const currentCargo = cargos.find(c => c.id === cargoEditId);
        if (currentCargo && currentCargo.valorAtual !== parsedValor) {
          await supabase.from('position_values')
            .update({ vigencia_fim: new Date().toISOString().split('T')[0] })
            .eq('position_id', cargoEditId)
            .is('vigencia_fim', null);
          
          await supabase.from('position_values')
            .insert([{ 
              position_id: cargoEditId, 
              valor: parsedValor,
              vigencia_inicio: new Date().toISOString().split('T')[0]
            }]);
        }
      } else {
        const { data: posData, error: posError } = await supabase
          .from('positions')
          .insert([{ nome: cargoNome, codigo: cargoCodigo }])
          .select('id')
          .single();

        if (posError) throw posError;
        
        const { error: valError } = await supabase
          .from('position_values')
          .insert([{ 
            position_id: posData.id, 
            valor: parsedValor,
            vigencia_inicio: new Date().toISOString().split('T')[0]
          }]);
          
        if (valError) throw valError;
      }
      
      setIsCargoModalOpen(false);
      fetchCargos();
    } catch (err: any) {
      alert(err.message || 'Erro ao salvar cargo.');
    } finally {
      setIsSubmittingCargo(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);
    setImportStep('idle');
    setImportResult(null);

    // Ler o arquivo e gerar preview (saldo_minutos do banco será somado na confirmação)
    const reader = new FileReader();
    reader.onload = (ev) => {
      const data = new Uint8Array(ev.target?.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: 'array' });
      const ws = wb.Sheets['Base_Geral'];
      if (!ws) { alert('Aba "Base_Geral" não encontrada no arquivo.'); return; }
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
      // rows[0] é o cabeçalho
      const MINUTOS_POR_PLANTAO = 720; // 12h
      const preview: PreviewRow[] = rows.slice(1).filter(r => r[0]).map(r => {
        const rawTrabalhadas = r[5] !== undefined ? r[5] : '0:00';
        const trabalhadas = String(rawTrabalhadas);
        const minutosNovos = parseHorasMinutos(rawTrabalhadas);
        // O preview mostra o cálculo só das horas novas (sem saldo anterior)
        // O saldo anterior é buscado individualmente na confirmação
        const plantoes = Math.floor(minutosNovos / MINUTOS_POR_PLANTAO);
        const minutosResiduo = minutosNovos % MINUTOS_POR_PLANTAO;
        
        let dataAdmissao = activeCycleForImport?.data_inicio || new Date().toISOString().split('T')[0];
        if (r[3]) {
          if (typeof r[3] === 'number') {
            const date = new Date(Math.round((r[3] - 25569) * 86400 * 1000));
            dataAdmissao = date.toISOString().split('T')[0];
          } else if (typeof r[3] === 'string') {
            const parts = r[3].split('/');
            if (parts.length === 3) dataAdmissao = `${parts[2]}-${parts[1]}-${parts[0]}`;
            else dataAdmissao = r[3];
          }
        }

        const erros: string[] = [];
        if (!r[0]) erros.push('Matrícula vazia');
        if (!r[1]) erros.push('Nome vazio');
        if (!r[2]) erros.push('Cargo vazio');
        if (!r[4]) erros.push('Estabelecimento vazio');
        return {
          matricula: String(r[0] || ''),
          nome: String(r[1] || ''),
          cargo: String(r[2] || ''),
          dataAdmissao,
          estabelecimento: String(r[4] || ''),
          trabalhadas,
          minutosNovos,
          plantoes,
          minutosResiduo,
          erros
        };
      });
      setImportPreview(preview);
      setImportStep('preview');
    };
    reader.readAsArrayBuffer(file);
  };

  const handleConfirmImport = async (forceOverwrite = false) => {
    if (!activeCycleForImport || importPreview.length === 0) return;

    // Normaliza strings: remove acentos, converte para minúsculo
    const normalizeStr = (s: string) =>
      s.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // -----------------------------------------------------------------------
    // 1. VERIFICAR SE JA EXISTEM LANÇAMENTOS NESTE CICLO (antes de iniciar)
    // -----------------------------------------------------------------------
    if (!forceOverwrite) {
      const { count } = await supabase
        .from('shifts')
        .select('id', { count: 'exact', head: true })
        .eq('cycle_id', activeCycleForImport.id);

      if (count && count > 0) {
        const confirmMsg =
          `⚠️ ATENÇÃO: Já existem ${count} lançamentos de plantões para o ciclo "${activeCycleForImport.nome}".\n\n` +
          `Ao confirmar, os dados atuais serão SUBSTITUÍDOS pelos da nova planilha.\n\n` +
          `Tem certeza que deseja sobrescrever?`;

        if (!window.confirm(confirmMsg)) return;
        // Chama novamente com flag de sobrescrita confirmada
        return handleConfirmImport(true);
      }
    }

    setImportStep('importing');
    setImportProgress({ current: 0, total: importPreview.length, currentName: '' });

    try {
      const { data: ests } = await supabase.from('establishments').select('id, nome');
      const { data: positions } = await supabase.from('positions').select('id, nome, codigo');

      const estMap = new Map<string, string>();
      ests?.forEach(e => estMap.set(normalizeStr(e.nome), e.id));

      const posMap = new Map<string, string>();
      positions?.forEach(p => posMap.set(normalizeStr(p.nome), p.id));

      const MINUTOS_POR_PLANTAO = 720;
      let importados = 0, atualizados = 0, shiftsInseridos = 0;
      const erros: string[] = [];

      for (let i = 0; i < importPreview.length; i++) {
        const row = importPreview[i];
        setImportProgress({ current: i + 1, total: importPreview.length, currentName: row.nome });
        await new Promise(resolve => setTimeout(resolve, 0));

        if (row.erros.length > 0) {
          erros.push(`Linha ignorada (${row.matricula} - ${row.nome}): ${row.erros.join(', ')}`);
          continue;
        }

        const estId = estMap.get(normalizeStr(row.estabelecimento));
        const posId = posMap.get(normalizeStr(row.cargo));

        if (!estId) { erros.push(`Estabelecimento não encontrado: "${row.estabelecimento}" (${row.nome})`); continue; }
        if (!posId) { erros.push(`Cargo não encontrado: "${row.cargo}" (${row.nome})`); continue; }

        // Buscar servidor existente com saldo de minutos atual
        const { data: existingEmp } = await supabase
          .from('employees')
          .select('id, saldo_minutos')
          .eq('establishment_id', estId)
          .eq('matricula', row.matricula)
          .maybeSingle();

        let saldoMinutosBase = existingEmp?.saldo_minutos ?? 0;

        // -----------------------------------------------------------------------
        // 2. SE É SOBRESCRITA: reverter o saldo_minutos de TODOS os shifts
        //    anteriores deste servidor neste ciclo (pode haver duplicatas)
        // -----------------------------------------------------------------------
        if (forceOverwrite && existingEmp) {
          // Buscar TODOS os shifts deste servidor neste ciclo (não apenas um)
          const { data: oldShifts } = await supabase
            .from('shifts')
            .select('id, minutos_residuais')
            .eq('employee_id', existingEmp.id)
            .eq('cycle_id', activeCycleForImport.id);

          if (oldShifts && oldShifts.length > 0) {
            // Somar os minutos residuais de todos os shifts anteriores
            const totalResiduaisAntigos = oldShifts.reduce(
              (acc: number, s: any) => acc + (s.minutos_residuais ?? 0),
              0
            );
            // Reverter: saldo antes deste ciclo = saldo_atual - soma dos residuais antigos
            saldoMinutosBase = Math.max(0, saldoMinutosBase - totalResiduaisAntigos);
            // Deletar TODOS os shifts antigos de uma vez
            const oldIds = oldShifts.map((s: any) => s.id);
            await supabase.from('shifts').delete().in('id', oldIds);
          }
        }

        // Calcular plantões com saldo base correto
        const totalMinutos = row.minutosNovos + saldoMinutosBase;
        const plantoesTotal = Math.floor(totalMinutos / MINUTOS_POR_PLANTAO);
        const novoSaldoMinutos = totalMinutos % MINUTOS_POR_PLANTAO;

        // Upsert do servidor com novo saldo_minutos
        const { data: empData, error: empError } = await supabase
          .from('employees')
          .upsert(
            {
              establishment_id: estId,
              matricula: row.matricula,
              nome: row.nome,
              position_id: posId,
              ativo: true,
              data_admissao: row.dataAdmissao,
              saldo_minutos: novoSaldoMinutos
            },
            { onConflict: 'establishment_id,matricula', ignoreDuplicates: false }
          )
          .select('id')
          .single();

        const empId = empData?.id ?? existingEmp?.id;
        if (!empId) { erros.push(`Erro ao salvar servidor ${row.nome}: ${empError?.message}`); continue; }

        if (!existingEmp) importados++;
        else atualizados++;

        // Inserir shift — seguro pois os shifts antigos foram deletados acima
        if (plantoesTotal > 0) {
          const { error: shiftErr } = await supabase.from('shifts').insert({
            employee_id: empId,
            cycle_id: activeCycleForImport.id,
            periodo_inicio: activeCycleForImport.data_inicio,
            periodo_fim: activeCycleForImport.data_fim,
            quantidade_plantoes: plantoesTotal,
            minutos_residuais: novoSaldoMinutos,
          });
          if (!shiftErr) shiftsInseridos++;
          else erros.push(`Erro ao inserir plantões de ${row.nome}: ${shiftErr.message}`);
        }
      }

      setImportResult({ importados, atualizados, shiftsInseridos, erros });
      setImportStep('done');
    } catch (err: any) {
      alert('Erro durante a importação: ' + (err.message || err));
      setImportStep('preview');
    }
  };

  const handleResetImport = () => {
    setImportStep('idle');
    setImportFile(null);
    setImportPreview([]);
    setImportResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div>
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <h2 style={{ margin: 0 }}>Configurações do Sistema</h2>
        <p className="text-muted" style={{ margin: 0 }}>
          Gerencie usuários, permissões e os cargos estruturais.
        </p>
      </div>

      <div className="seg" style={{ marginBottom: 'var(--space-6)', width: 'fit-content' }}>
        <label className="seg-opt" style={{ padding: 'var(--space-2) var(--space-4)' }}>
          <input type="radio" name="config-tab" checked={activeTab === 'usuarios'} onChange={() => setActiveTab('usuarios')} />
          Usuários e Permissões
        </label>
        <label className="seg-opt" style={{ padding: 'var(--space-2) var(--space-4)' }}>
          <input type="radio" name="config-tab" checked={activeTab === 'cargos'} onChange={() => setActiveTab('cargos')} />
          Cargos e Valores
        </label>
        <label className="seg-opt" style={{ padding: 'var(--space-2) var(--space-4)' }}>
          <input type="radio" name="config-tab" checked={activeTab === 'importacao'} onChange={() => setActiveTab('importacao')} />
          📥 Importação Mensal
        </label>
        <label className="seg-opt" style={{ padding: 'var(--space-2) var(--space-4)' }}>
          <input type="radio" name="config-tab" checked={activeTab === 'tutoriais'} onChange={() => setActiveTab('tutoriais')} />
          📺 Tutoriais
        </label>
      </div>

      {activeTab === 'usuarios' && (
        <div className="blueprint card elev-sm" style={{ overflow: 'hidden' }}>
          <i className="corner tl"></i><i className="corner tr"></i><i className="corner bl"></i><i className="corner br"></i>
          
          <div style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--color-divider)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 600 }}>Usuários Cadastrados</div>
            <button className="btn btn-primary" onClick={openUserModal}>
              + Novo usuário
            </button>
          </div>

          {loadingUsers ? (
            <div style={{ padding: 'var(--space-4)' }}>Carregando...</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-divider)' }}>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text-muted)' }}>Nome</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text-muted)' }}>E-mail</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text-muted)' }}>Perfil</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text-muted)' }}>Status</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text-muted)', textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map(user => (
                  <tr key={user.id} style={{ borderBottom: '1px solid var(--color-divider)' }}>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 500 }}>{user.nome}</td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)' }}>{user.email}</td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                      <span className="tag" style={{ background: 'var(--color-surface)' }}>{user.perfil}</span>
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                      {user.ativo ? <span className="tag" style={{ background: 'var(--color-accent-500)', color: 'white' }}>Ativo</span> : <span className="tag tag-outline">Inativo</span>}
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right' }}>
                      <button className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: '12px' }} onClick={() => handleResetPassword(user.email)}>📧 Redefinir Senha</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === 'cargos' && (
        <div className="blueprint card elev-sm" style={{ overflow: 'hidden' }}>
          <i className="corner tl"></i><i className="corner tr"></i><i className="corner bl"></i><i className="corner br"></i>
          
          <div style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--color-divider)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 600 }}>Estrutura de Cargos e Valores</div>
            <button className="btn btn-primary" onClick={openNewCargoModal}>
              Novo Cargo
            </button>
          </div>

          {loadingCargos ? (
            <div style={{ padding: 'var(--space-4)' }}>Carregando...</div>
          ) : cargos.length === 0 ? (
             <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
              Nenhum cargo cadastrado no momento.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-divider)' }}>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text-muted)' }}>Nome do Cargo</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text-muted)' }}>Código</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text-muted)' }}>Valor Atual (R$)</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text-muted)' }}>Status</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text-muted)', textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {cargos.map(cargo => (
                  <tr key={cargo.id} style={{ borderBottom: '1px solid var(--color-divider)' }}>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 500 }}>{cargo.nome}</td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)' }}>{cargo.codigo}</td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-accent-700)', fontWeight: 600 }}>
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cargo.valorAtual)}
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                      {cargo.ativo ? <span className="tag" style={{ background: 'var(--color-accent-500)', color: 'white' }}>Ativo</span> : <span className="tag tag-outline">Inativo</span>}
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: '12px' }} onClick={() => openEditCargoModal(cargo)}>✏️ Editar</button>
                      <button className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: '12px', color: 'var(--color-danger)' }} onClick={() => handleDeleteCargo(cargo.id)}>🗑️ Excluir</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === 'importacao' && (
        <div className="blueprint card elev-sm" style={{ overflow: 'hidden' }}>
          <i className="corner tl"></i><i className="corner tr"></i><i className="corner bl"></i><i className="corner br"></i>

          <div style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--color-divider)' }}>
            <div style={{ fontWeight: 700, fontSize: '15px' }}>Importação Mensal de Servidores</div>
            <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
              Carregue a planilha <strong>Base_Geral</strong> para importar os servidores e calcular os plantões do ciclo ativo.
            </div>
          </div>

          <div style={{ padding: 'var(--space-5)' }}>

            {/* Ciclo ativo */}
            {loadingImportCycle ? (
              <div style={{ padding: '16px', textAlign: 'center' }}>Verificando ciclo ativo...</div>
            ) : !activeCycleForImport ? (
              <div style={{ padding: '20px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#dc2626', fontWeight: 600 }}>
                ⚠️ Nenhum ciclo ABERTO encontrado. Abra um ciclo antes de importar.
              </div>
            ) : (
              <>
                {/* Banner do ciclo */}
                <div style={{ padding: '12px 16px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '8px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '20px' }}>📅</span>
                  <div>
                    <div style={{ fontWeight: 700, color: '#15803d' }}>Ciclo Ativo: {activeCycleForImport.nome}</div>
                    <div style={{ fontSize: '12px', color: '#166534' }}>
                      {new Date(activeCycleForImport.data_inicio + 'T00:00:00').toLocaleDateString('pt-BR')} a{' '}
                      {new Date(activeCycleForImport.data_fim + 'T00:00:00').toLocaleDateString('pt-BR')}
                    </div>
                  </div>
                </div>

                {/* Etapa 1: Upload */}
                {importStep === 'idle' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ fontSize: '14px', color: 'var(--color-text)' }}>
                      <strong>Guía esperada:</strong> <code>Base_Geral</code> &nbsp;| 
                      <strong>Colunas:</strong> Matrícula, Funcionário, Cargo, Data admissão, Estabelecimento penal, Trabalhadas
                    </div>
                    <div>
                      <label className="btn btn-primary" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                        📂 Selecionar Planilha (.xlsx)
                        <input ref={fileInputRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleFileChange} />
                      </label>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                      ℹ️ A importação é segura: servidores já existentes serão atualizados (sem duplicação). Os plantões serão inseridos e o banco calculará automaticamente as folgas a cada 21 plantões acumulados.
                    </div>
                  </div>
                )}

                {/* Etapa 2: Preview */}
                {importStep === 'preview' && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '15px' }}>Preview — {importPreview.length} registros encontrados</div>
                        <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Arquivo: {importFile?.name}</div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn btn-ghost" onClick={handleResetImport}>Cancelar</button>
                        <button className="btn btn-primary blueprint" onClick={() => handleConfirmImport()}>
                          <i className="corner tl"></i><i className="corner tr"></i><i className="corner bl"></i><i className="corner br"></i>
                          ✅ Confirmar Importação
                        </button>
                      </div>
                    </div>

                    <div style={{ maxHeight: '360px', overflowY: 'auto', border: '1px solid var(--color-divider)', borderRadius: '8px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                        <thead style={{ background: '#f8fafc', position: 'sticky', top: 0 }}>
                          <tr>
                            {['Matrícula','Nome','Cargo','Estabelecimento','Trabalhadas','Plantões','Saldo Residual'].map(h => (
                              <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-divider)' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {importPreview.map((row, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid var(--color-divider)', background: row.erros.length > 0 ? '#fef2f2' : 'transparent' }}>
                              <td style={{ padding: '7px 12px' }}>{row.matricula}</td>
                              <td style={{ padding: '7px 12px' }}>{row.nome}</td>
                              <td style={{ padding: '7px 12px', fontSize: '11px' }}>{row.cargo}</td>
                              <td style={{ padding: '7px 12px', fontSize: '11px' }}>{row.estabelecimento}</td>
                              <td style={{ padding: '7px 12px', textAlign: 'center' }}>{row.trabalhadas}</td>
                              <td style={{ padding: '7px 12px', textAlign: 'center', fontWeight: 700 }}>
                                {row.erros.length > 0 ? <span style={{ color: '#dc2626' }}>⚠️ {row.erros[0]}</span> : row.plantoes}
                              </td>
                              <td style={{ padding: '7px 12px', textAlign: 'center', color: '#92400e', fontWeight: 600, fontSize: '11px' }}>
                                {row.erros.length > 0 ? '' : `${Math.floor(row.minutosResiduo / 60)}h${String(row.minutosResiduo % 60).padStart(2,'0')}min`}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Etapa 3: Importando com barra de progresso */}
                {importStep === 'importing' && (() => {
                  const pct = importProgress.total > 0 ? Math.round((importProgress.current / importProgress.total) * 100) : 0;
                  return (
                    <div style={{ padding: '32px 16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--color-text)' }}>
                          ⏳ Importando servidores...
                        </div>
                        <div style={{ fontWeight: 800, fontSize: '18px', color: '#2563eb' }}>{pct}%</div>
                      </div>

                      {/* Barra de progresso */}
                      <div style={{ width: '100%', height: '14px', background: '#e2e8f0', borderRadius: '99px', overflow: 'hidden', marginBottom: '12px' }}>
                        <div style={{
                          height: '100%',
                          width: `${pct}%`,
                          background: 'linear-gradient(90deg, #2563eb, #7c3aed)',
                          borderRadius: '99px',
                          transition: 'width 0.1s ease'
                        }} />
                      </div>

                      {/* Contagem e nome atual */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                        <div>
                          Processando: <strong style={{ color: 'var(--color-text)', maxWidth: '400px', display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'bottom' }}>
                            {importProgress.currentName || '...'}
                          </strong>
                        </div>
                        <div>{importProgress.current} / {importProgress.total} registros</div>
                      </div>
                    </div>
                  );
                })()}

                {/* Etapa 4: Resultado */}
                {importStep === 'done' && importResult && (
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '16px', marginBottom: '20px' }}>✅ Importação Concluída!</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
                      <div style={{ padding: '16px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '8px', textAlign: 'center' }}>
                        <div style={{ fontSize: '28px', fontWeight: 800, color: '#16a34a' }}>{importResult.importados}</div>
                        <div style={{ fontSize: '12px', color: '#15803d', marginTop: '4px' }}>Servidores Novos</div>
                      </div>
                      <div style={{ padding: '16px', background: '#eff6ff', border: '1px solid #93c5fd', borderRadius: '8px', textAlign: 'center' }}>
                        <div style={{ fontSize: '28px', fontWeight: 800, color: '#2563eb' }}>{importResult.atualizados}</div>
                        <div style={{ fontSize: '12px', color: '#1d4ed8', marginTop: '4px' }}>Servidores Atualizados</div>
                      </div>
                      <div style={{ padding: '16px', background: '#fefce8', border: '1px solid #fde047', borderRadius: '8px', textAlign: 'center' }}>
                        <div style={{ fontSize: '28px', fontWeight: 800, color: '#ca8a04' }}>{importResult.shiftsInseridos}</div>
                        <div style={{ fontSize: '12px', color: '#a16207', marginTop: '4px' }}>Registros de Plantões</div>
                      </div>
                    </div>

                    {importResult.erros.length > 0 && (
                      <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '16px', marginBottom: '20px' }}>
                        <div style={{ fontWeight: 700, color: '#dc2626', marginBottom: '8px' }}>⚠️ {importResult.erros.length} linha(s) com problema:</div>
                        <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                          {importResult.erros.map((e, i) => <div key={i} style={{ fontSize: '12px', color: '#b91c1c', marginBottom: '4px' }}>• {e}</div>)}
                        </div>
                      </div>
                    )}

                    <button className="btn btn-ghost" onClick={handleResetImport}>🔄 Nova Importação</button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {activeTab === 'tutoriais' && (
        <div className="blueprint card elev-sm" style={{ overflow: 'hidden' }}>
          <i className="corner tl"></i><i className="corner tr"></i><i className="corner bl"></i><i className="corner br"></i>
          
          <div style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--color-divider)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 600 }}>Tutoriais em Vídeo</div>
            <button className="btn btn-primary" onClick={openNewTutorialModal}>
              + Novo Tutorial
            </button>
          </div>

          {loadingTutoriais ? (
            <div style={{ padding: 'var(--space-4)' }}>Carregando tutoriais...</div>
          ) : tutoriais.length === 0 ? (
             <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
              Nenhum tutorial cadastrado.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-divider)' }}>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text-muted)' }}>Título</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text-muted)' }}>Descrição</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text-muted)', textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {tutoriais.map(tut => (
                  <tr key={tut.id} style={{ borderBottom: '1px solid var(--color-divider)' }}>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 500 }}>{tut.titulo}</td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)' }}>{tut.descricao}</td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: '12px' }} onClick={() => openEditTutorialModal(tut)}>✏️ Editar</button>
                      <button className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: '12px', color: 'var(--color-danger)' }} onClick={() => handleDeleteTutorial(tut.id)}>🗑️ Excluir</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Modal Usuário */}
      {isUserModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="blueprint card elev-md" style={{ width: '450px', padding: 'var(--space-6)', background: 'var(--color-surface)' }}>
            <i className="corner tl"></i><i className="corner tr"></i><i className="corner bl"></i><i className="corner br"></i>
            <h3 style={{ marginTop: 0, marginBottom: 'var(--space-4)' }}>Cadastrar Novo Usuário</h3>
            
            <form onSubmit={handleSaveUser}>
              <div className="field" style={{ marginBottom: 'var(--space-3)' }}>
                <label>Nome Completo *</label>
                <input className="input" type="text" value={userNome} onChange={e => setUserNome(e.target.value)} required />
              </div>

              <div className="field" style={{ marginBottom: 'var(--space-3)' }}>
                <label>E-mail *</label>
                <input className="input" type="email" value={userEmail} onChange={e => setUserEmail(e.target.value)} required />
              </div>

              <div className="field" style={{ marginBottom: 'var(--space-3)' }}>
                <label>Senha (mín. 6 caracteres) *</label>
                <input className="input" type="password" value={userSenha} onChange={e => setUserSenha(e.target.value)} minLength={6} required />
              </div>

              <div className="field" style={{ marginBottom: 'var(--space-3)' }}>
                <label>Perfil de Acesso *</label>
                <select className="input" value={userPerfil} onChange={e => setUserPerfil(e.target.value)} required>
                  <option value="ESTABELECIMENTO">Estabelecimento (Diretor/Escalante)</option>
                  <option value="ADMIN">Administrador Geral</option>
                  <option value="GESTAO">Gestão (Apenas Leitura)</option>
                </select>
              </div>

              {userPerfil === 'ESTABELECIMENTO' && (
                <div className="field" style={{ marginBottom: 'var(--space-3)' }}>
                  <label>Vincular a qual Unidade Penal? *</label>
                  <select className="input" value={userEstId} onChange={e => setUserEstId(e.target.value)} required>
                    <option value="">Selecione a unidade...</option>
                    {estabelecimentos.map(est => (
                      <option key={est.id} value={est.id}>{est.nome}</option>
                    ))}
                  </select>
                </div>
              )}

              <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end', marginTop: 'var(--space-4)' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setIsUserModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary blueprint" disabled={isSubmittingUser}>
                  <i className="corner tl"></i><i className="corner tr"></i><i className="corner bl"></i><i className="corner br"></i>
                  {isSubmittingUser ? 'Criando...' : 'Cadastrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Cargo */}
      {isCargoModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="blueprint card elev-md" style={{ width: '400px', padding: 'var(--space-6)', background: 'var(--color-surface)' }}>
            <i className="corner tl"></i><i className="corner tr"></i><i className="corner bl"></i><i className="corner br"></i>
            <h3 style={{ marginTop: 0, marginBottom: 'var(--space-4)' }}>
              {cargoEditId ? 'Editar Cargo' : 'Novo Cargo'}
            </h3>
            
            <form onSubmit={handleSaveCargo}>
              <div className="field" style={{ marginBottom: 'var(--space-3)' }}>
                <label>Nome do Cargo *</label>
                <input 
                  className="input" 
                  type="text" 
                  value={cargoNome} 
                  onChange={(e) => setCargoNome(e.target.value)} 
                  required 
                  placeholder="Ex: Agente Penitenciário"
                />
              </div>

              <div className="field" style={{ marginBottom: 'var(--space-3)' }}>
                <label>Código (Sigla) *</label>
                <input 
                  className="input" 
                  type="text" 
                  value={cargoCodigo} 
                  onChange={(e) => setCargoCodigo(e.target.value.toUpperCase())} 
                  required 
                  placeholder="Ex: AGPEN"
                />
              </div>

              <div className="field" style={{ marginBottom: 'var(--space-4)' }}>
                <label>Valor da Compra da Folga (R$) *</label>
                <input 
                  className="input" 
                  type="number" 
                  step="0.01"
                  min="0"
                  value={cargoValor} 
                  onChange={(e) => setCargoValor(e.target.value)} 
                  required 
                  placeholder="Ex: 291.57"
                />
              </div>

              <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setIsCargoModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary blueprint" disabled={isSubmittingCargo}>
                  <i className="corner tl"></i><i className="corner tr"></i><i className="corner bl"></i><i className="corner br"></i>
                  {isSubmittingCargo ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Tutorial */}
      {isTutorialModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="blueprint card elev-md" style={{ width: '450px', padding: 'var(--space-6)', background: 'var(--color-surface)' }}>
            <i className="corner tl"></i><i className="corner tr"></i><i className="corner bl"></i><i className="corner br"></i>
            <h3 style={{ marginTop: 0, marginBottom: 'var(--space-4)' }}>
              {tutorialEditId ? 'Editar Tutorial' : 'Novo Tutorial'}
            </h3>
            
            <form onSubmit={handleSaveTutorial}>
              <div className="field" style={{ marginBottom: 'var(--space-3)' }}>
                <label>Título *</label>
                <input 
                  className="input" 
                  type="text" 
                  value={tutorialTitulo} 
                  onChange={(e) => setTutorialTitulo(e.target.value)} 
                  required 
                  placeholder="Ex: Como lançar plantões extras"
                />
              </div>

              <div className="field" style={{ marginBottom: 'var(--space-3)' }}>
                <label>Descrição</label>
                <textarea 
                  className="input" 
                  value={tutorialDescricao} 
                  onChange={(e) => setTutorialDescricao(e.target.value)} 
                  placeholder="Breve descrição do tutorial"
                  rows={3}
                />
              </div>

              <div className="field" style={{ marginBottom: 'var(--space-4)' }}>
                <label>URL do YouTube *</label>
                <input 
                  className="input" 
                  type="url" 
                  value={tutorialUrl} 
                  onChange={(e) => setTutorialUrl(e.target.value)} 
                  required 
                  placeholder="Ex: https://youtube.com/watch?v=..."
                />
              </div>

              <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setIsTutorialModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary blueprint" disabled={isSubmittingTutorial}>
                  <i className="corner tl"></i><i className="corner tr"></i><i className="corner bl"></i><i className="corner br"></i>
                  {isSubmittingTutorial ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Confirm Reset Password */}
      {confirmResetEmail && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000
        }}>
          <div className="blueprint card elev-md" style={{ width: '400px', padding: 'var(--space-6)', background: 'var(--color-surface)', textAlign: 'center' }}>
            <i className="corner tl"></i><i className="corner tr"></i><i className="corner bl"></i><i className="corner br"></i>
            <h3 style={{ marginTop: 0, marginBottom: 'var(--space-3)' }}>Redefinir Senha</h3>
            <p style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-5)' }}>
              Tem certeza que deseja enviar um e-mail com link de redefinição para <strong>{confirmResetEmail}</strong>?
            </p>
            <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center' }}>
              <button type="button" className="btn btn-ghost" onClick={() => setConfirmResetEmail(null)}>Cancelar</button>
              <button type="button" className="btn btn-primary blueprint" onClick={executeResetPassword}>
                <i className="corner tl"></i><i className="corner tr"></i><i className="corner bl"></i><i className="corner br"></i>
                Sim, Enviar E-mail
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Alert (Success/Error) */}
      {alertMessage && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000
        }}>
          <div className="blueprint card elev-md" style={{ width: '400px', padding: 'var(--space-6)', background: 'var(--color-surface)', textAlign: 'center' }}>
            <i className="corner tl"></i><i className="corner tr"></i><i className="corner bl"></i><i className="corner br"></i>
            <div style={{ fontSize: '32px', marginBottom: 'var(--space-3)' }}>
              {alertMessage.type === 'success' ? '✅' : '⚠️'}
            </div>
            <h3 style={{ marginTop: 0, marginBottom: 'var(--space-3)', color: alertMessage.type === 'error' ? 'var(--color-danger)' : 'var(--color-accent-600)' }}>
              {alertMessage.title}
            </h3>
            <p style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-5)' }}>
              {alertMessage.msg}
            </p>
            <button type="button" className="btn btn-primary blueprint" onClick={() => setAlertMessage(null)}>
              <i className="corner tl"></i><i className="corner tr"></i><i className="corner bl"></i><i className="corner br"></i>
              OK
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

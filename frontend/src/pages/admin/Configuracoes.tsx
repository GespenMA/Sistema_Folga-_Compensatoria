import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

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
  const [activeTab, setActiveTab] = useState<'usuarios' | 'cargos'>('usuarios');
  
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

  useEffect(() => {
    if (activeTab === 'usuarios') {
      fetchUsuarios();
      fetchEstabelecimentos();
    }
    else fetchCargos();
  }, [activeTab]);

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

    </div>
  );
};

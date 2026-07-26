import React from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export const EstabelecimentoLayout: React.FC = () => {
  const { signOut, profile } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--color-bg)' }}>
      
      {/* SIDEBAR */}
      <div style={{ width: '250px', background: 'var(--color-surface)', borderRight: '1px solid var(--color-divider)', padding: 'var(--space-4)', display: 'flex', flexDirection: 'column' }}>
        
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <h2 style={{ fontSize: '16px', margin: '0 0 var(--space-1) 0', color: 'var(--color-text)' }}>Folga Compensatória</h2>
          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Módulo da Unidade</div>
        </div>

        <nav style={{ flex: 1 }}>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)' }}>Navegação</div>
          
          <Link to="/estabelecimento" style={{ display: 'block', padding: 'var(--space-3) 0', color: 'var(--color-text)', textDecoration: 'none', borderBottom: '1px solid var(--color-divider)' }}>📊 Dashboard</Link>
          <Link to="/estabelecimento/servidores" style={{ display: 'block', padding: 'var(--space-3) 0', color: 'var(--color-text)', textDecoration: 'none', borderBottom: '1px solid var(--color-divider)' }}>👮 Servidores</Link>
          <Link to="/estabelecimento/folgas" style={{ display: 'block', padding: 'var(--space-3) 0', color: 'var(--color-text)', textDecoration: 'none', borderBottom: '1px solid var(--color-divider)' }}>📅 Banco de Folgas</Link>
          <Link to="/estabelecimento/solicitacoes" style={{ display: 'block', padding: 'var(--space-3) 0', color: 'var(--color-text)', textDecoration: 'none', borderBottom: '1px solid var(--color-divider)' }}>🛒 Comprar Folga</Link>
        </nav>

        <div style={{ paddingTop: 'var(--space-4)', borderTop: '1px solid var(--color-divider)' }}>
           <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>{profile?.nome}</div>
           <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)' }}>Diretor / Escalante</div>
           <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center' }} onClick={handleLogout}>Sair do Sistema</button>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div style={{ flex: 1, padding: 'var(--space-6)', overflowY: 'auto' }}>
        <Outlet />
      </div>

    </div>
  );
};

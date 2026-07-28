import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export const AdminLayout: React.FC = () => {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const baseNavItems = [
    { path: '/admin', label: '📊 Dashboard' },
    { path: '/admin/estabelecimentos', label: '🏢 Estabelecimentos' },
    { path: '/admin/ciclos', label: '🔄 Ciclos' },
    { path: '/admin/relatorios', label: '💰 Folha Pagamento' }
  ];

  const navItems = profile?.perfil === 'ADMIN' 
    ? [...baseNavItems, { path: '/admin/configuracoes', label: '⚙️ Configurações' }] 
    : baseNavItems;

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-body)', color: 'var(--color-text)', background: 'var(--color-bg)' }}>
      {/* Topbar */}
      <div className="nav" style={{ background: 'var(--color-surface)', borderBottom: '1px solid var(--color-divider)' }}>
        <div className="nav-brand">Gestão de Folga Compensatória</div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
          <span style={{ fontSize: '14px', fontWeight: 500 }}>{profile?.nome} ({profile?.perfil})</span>
          <button className="btn btn-ghost" onClick={handleLogout}>Sair</button>
        </div>
      </div>

      <div style={{ flex: '1 1 auto', display: 'flex', minHeight: 0 }}>
        {/* Sidebar */}
        <div style={{ width: '240px', flex: '0 0 auto', background: 'var(--color-surface)', borderRight: '1px solid var(--color-divider)', padding: 'var(--space-4) var(--space-2)', display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden' }}>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-accent-700)', padding: '0 var(--space-3) var(--space-2)', whiteSpace: 'nowrap' }}>
            Navegação
          </div>
          
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/admin'}
              style={({ isActive }) => ({
                textAlign: 'left',
                textDecoration: 'none',
                display: 'block',
                padding: 'var(--space-2) var(--space-3)',
                borderRadius: 'var(--radius-md)',
                fontFamily: 'var(--font-heading)',
                fontWeight: 600,
                fontSize: '16px',
                letterSpacing: '0.01em',
                background: isActive ? 'var(--color-bg)' : 'transparent',
                color: isActive ? 'var(--color-text)' : 'var(--color-neutral-600)',
                whiteSpace: 'nowrap'
              })}
            >
              {item.label}
            </NavLink>
          ))}
        </div>

        {/* Main Content */}
        <div style={{ flex: '1 1 auto', overflowY: 'auto', padding: 'var(--space-8)' }}>
          <Outlet />
        </div>
      </div>
    </div>
  );
};

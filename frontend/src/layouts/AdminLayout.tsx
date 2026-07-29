import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LayoutDashboard, Building2, Landmark, WalletCards, FileBadge, CalendarClock, BarChart3, Settings, LogOut, ChevronLeft, ChevronRight, Menu, ShieldAlert, X } from 'lucide-react';

export const AdminLayout: React.FC = () => {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const getLinkStyle = ({ isActive }: { isActive: boolean }) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: isCollapsed ? 'center' : 'flex-start',
    gap: isCollapsed ? '0' : '12px',
    padding: '12px var(--space-4)',
    margin: isCollapsed ? '0 auto' : '0 calc(-1 * var(--space-4))',
    color: isActive ? '#ffffff' : '#94a3b8',
    background: isActive ? '#2563eb' : 'transparent',
    borderLeft: isActive ? '4px solid #60a5fa' : '4px solid transparent',
    textDecoration: 'none',
    fontWeight: isActive ? 600 : 500,
    marginBottom: '4px',
    borderRadius: isCollapsed ? '8px' : '0 8px 8px 0',
    transition: 'all 0.2s ease',
    fontSize: '14px',
    width: isCollapsed ? '48px' : 'auto'
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--color-bg)' }}>
      
      {/* MOBILE HEADER BAR */}
      <div className="mobile-header-bar" style={{ background: '#0f172a', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'white', zIndex: 30 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <ShieldAlert size={24} color="#60a5fa" />
          <h2 style={{ fontSize: '15px', margin: 0, fontWeight: 700 }}>SIFOC</h2>
        </div>
        <button onClick={() => setIsMobileMenuOpen(true)} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', padding: 0 }}>
          <Menu size={24} />
        </button>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        
        {/* MOBILE BACKDROP */}
        {isMobileMenuOpen && (
          <div className="app-sidebar-backdrop" onClick={() => setIsMobileMenuOpen(false)}></div>
        )}

        {/* SIDEBAR - TEMA ESCURO */}
        <div className={`app-sidebar ${!isMobileMenuOpen ? 'mobile-hidden' : ''}`} style={{ position: 'relative', width: isCollapsed ? '80px' : '260px', background: '#0f172a', borderRight: '1px solid #1e293b', padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', color: '#f8fafc', transition: 'width 0.2s ease' }}>
          
          {/* Toggle Button (Desktop only) */}
          <button 
            className="desktop-only"
            onClick={() => setIsCollapsed(!isCollapsed)}
            style={{ position: 'absolute', top: '24px', right: '-12px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10 }}
          >
            {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>

          {/* Close Button (Mobile only) */}
          <button 
            className="mobile-only"
            onClick={() => setIsMobileMenuOpen(false)}
            style={{ position: 'absolute', top: '20px', right: '16px', background: 'transparent', color: '#94a3b8', border: 'none', padding: '4px', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10 }}
          >
            <X size={24} />
          </button>

          <div style={{ marginBottom: '32px', display: 'flex', alignItems: 'center', justifyContent: isCollapsed ? 'center' : 'flex-start', gap: '12px' }}>
            <div style={{ background: '#ffffff', borderRadius: '8px', padding: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
               <ShieldAlert size={28} color="#0f172a" />
            </div>
            {!isCollapsed && (
              <div>
                <h2 style={{ fontSize: '15px', margin: '0 0 2px 0', color: '#f8fafc', lineHeight: 1.2 }}>SIFOC</h2>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>Sistema Integrado de Folga Compensatória</div>
              </div>
            )}
          </div>

          <nav style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', paddingRight: isCollapsed ? '0' : '4px' }}>
            
            <NavLink end to="/admin" style={getLinkStyle} title="Dashboard">
              <LayoutDashboard size={20} /> {!isCollapsed && "Dashboard"}
            </NavLink>

            {!isCollapsed && <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: '#64748b', marginTop: '24px', marginBottom: '12px', fontWeight: 600 }}>Operação</div>}
            <NavLink to="/admin/estabelecimentos" style={getLinkStyle} title="Estabelecimentos">
              <Building2 size={20} /> {!isCollapsed && "Estabelecimentos"}
            </NavLink>
            
            {!isCollapsed && <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: '#64748b', marginTop: '24px', marginBottom: '12px', fontWeight: 600 }}>Solicitações</div>}
            <NavLink to="/admin/solicitacoes" style={getLinkStyle} title="Solicitações">
              <FileBadge size={20} /> {!isCollapsed && "Solicitações"}
            </NavLink>

            {!isCollapsed && <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: '#64748b', marginTop: '24px', marginBottom: '12px', fontWeight: 600 }}>Gestão</div>}
            <NavLink to="/admin/relatorios" style={getLinkStyle} title="Relatórios">
              <BarChart3 size={20} /> {!isCollapsed && "Relatórios"}
            </NavLink>
            
            {profile?.perfil === 'ADMIN' && (
              <NavLink to="/admin/configuracoes" style={getLinkStyle} title="Configurações">
                <Settings size={20} /> {!isCollapsed && "Configurações"}
              </NavLink>
            )}

          </nav>

          <div style={{ paddingTop: '24px', marginTop: '16px', borderTop: '1px solid #1e293b', display: 'flex', alignItems: 'center', justifyContent: isCollapsed ? 'center' : 'flex-start', gap: '12px' }}>
             <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f8fafc', fontWeight: 700 }}>
               {profile?.nome?.charAt(0) || 'A'}
             </div>
             {!isCollapsed && (
               <div style={{ flex: 1, minWidth: 0 }}>
                 <div style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Administrador</div>
                 <div style={{ fontSize: '11px', color: '#94a3b8' }}>Administração Central</div>
               </div>
             )}
          </div>
          <button onClick={handleLogout} style={{ marginTop: '16px', background: 'transparent', border: 'none', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: isCollapsed ? 'center' : 'flex-start', gap: '8px', cursor: 'pointer', padding: '8px 0', fontSize: '13px' }} title="Sair do Sistema">
            <LogOut size={16} /> {!isCollapsed && "Sair do Sistema"}
          </button>

        </div>

        {/* MAIN CONTENT */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-6)', background: 'var(--color-bg)' }}>
          <Outlet />
        </div>
      </div>
    </div>
  );
};


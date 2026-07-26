import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Login } from './pages/Login';

import { AdminLayout } from './layouts/AdminLayout';
import { AdminDashboard } from './pages/AdminDashboard';

import { Estabelecimentos } from './pages/admin/Estabelecimentos';
import { Configuracoes } from './pages/admin/Configuracoes';
import { Ciclos } from './pages/admin/Ciclos';

// Importações do módulo Estabelecimento
import { EstabelecimentoLayout } from './layouts/EstabelecimentoLayout';
import { EstabelecimentoDashboard } from './pages/estabelecimento/Dashboard';
import { Servidores } from './pages/estabelecimento/Servidores';

// Componente para rotas protegidas
const ProtectedRoute = ({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: ('ADMIN' | 'ESTABELECIMENTO' | 'GESTAO')[] }) => {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Carregando sessão...</div>;
  }

  if (!user || !profile) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(profile.perfil)) {
    return <Navigate to="/" replace />; // Ou para uma página de "Acesso Negado"
  }

  return <>{children}</>;
};

// Switcher da página inicial baseado no perfil
const HomeSwitcher = () => {
  const { user, profile, loading } = useAuth();

  if (loading) return <div>Carregando...</div>;
  if (!user || !profile) return <Navigate to="/login" replace />;

  if (profile.perfil === 'ADMIN' || profile.perfil === 'GESTAO') {
    return <Navigate to="/admin" replace />;
  } else {
    return <Navigate to="/estabelecimento" replace />;
  }
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          <Route path="/" element={<HomeSwitcher />} />

          <Route 
            path="/admin" 
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'GESTAO']}>
                <AdminLayout />
              </ProtectedRoute>
            } 
          >
            <Route index element={<AdminDashboard />} />
            <Route path="ciclos" element={<Ciclos />} />
            <Route path="estabelecimentos" element={<Estabelecimentos />} />
            <Route 
              path="configuracoes" 
              element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <Configuracoes />
                </ProtectedRoute>
              } 
            />
            {/* Outras rotas administrativas entrarão aqui */}
          </Route>

          <Route 
            path="/estabelecimento" 
            element={
              <ProtectedRoute allowedRoles={['ESTABELECIMENTO']}>
                <EstabelecimentoLayout />
              </ProtectedRoute>
            } 
          >
            <Route index element={<EstabelecimentoDashboard />} />
            <Route path="servidores" element={<Servidores />} />
            <Route path="folgas" element={<div style={{padding: '2rem'}}>Tela de Folgas em construção</div>} />
            <Route path="solicitacoes" element={<div style={{padding: '2rem'}}>Tela de Solicitações em construção</div>} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;

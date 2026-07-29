import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';

export const Login: React.FC = () => {
  const { user, profile } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        throw authError;
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao fazer login. Verifique suas credenciais.');
    } finally {
      setLoading(false);
    }
  };

  if (user && profile) {
    if (profile.perfil === 'ADMIN' || profile.perfil === 'GESTAO') return <Navigate to="/admin" replace />;
    return <Navigate to="/estabelecimento" replace />;
  }

  return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-body)', color: 'var(--color-text)', background: 'var(--color-bg)' }}>
      <div className="blueprint card elev-md" style={{ width: '380px', padding: 'var(--space-6)' }}>
        <i className="corner tl"></i><i className="corner tr"></i><i className="corner bl"></i><i className="corner br"></i>
        
        <div className="card-kicker">Sistema de Gestão</div>
        <h2 style={{ margin: '0 0 var(--space-1)' }}>SIFOC - Sistema Integrado de Folga Compensatória</h2>
        <p className="text-muted" style={{ fontSize: '13px', marginBottom: 'var(--space-4)' }}>
          Entre para acessar o painel da sua unidade ou da Administração.
        </p>

        <form onSubmit={handleLogin}>
          <div className="field" style={{ marginBottom: 'var(--space-3)' }}>
            <label>E-mail</label>
            <input 
              className="input" 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              placeholder="nome@seap.gov.br" 
              required
            />
          </div>

          <div className="field">
            <label>Senha</label>
            <input 
              className="input" 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              placeholder="••••••••" 
              required
            />
          </div>

          {error && (
            <div style={{ fontSize: '12.5px', color: 'var(--color-neutral-900)', marginBottom: 'var(--space-2)' }}>
              {error}
            </div>
          )}

          <button 
            type="submit" 
            className="btn btn-primary btn-block blueprint" 
            disabled={loading}
            style={{ justifyContent: 'center', marginTop: 'var(--space-2)' }}
          >
            <i className="corner tl"></i><i className="corner tr"></i><i className="corner bl"></i><i className="corner br"></i>
            {loading ? 'Carregando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
};

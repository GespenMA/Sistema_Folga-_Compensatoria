import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { Lock, Mail, ArrowRight, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import seapLogo from '../assets/seap-logo.png';

const loginStyles = `
  @keyframes slideUpFade {
    0% { opacity: 0; transform: translateY(30px); }
    100% { opacity: 1; transform: translateY(0); }
  }
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    20%, 60% { transform: translateX(-5px); }
    40%, 80% { transform: translateX(5px); }
  }
  .animate-slide-up {
    animation: slideUpFade 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }
  .animate-shake {
    animation: shake 0.5s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
  }
  
  /* Responsividade para Mobile */
  @media (max-width: 820px) {
    .login-left-pane {
      display: none !important;
    }
    .login-card-container {
      margin: 16px !important;
      border-radius: 20px !important;
      max-width: 100% !important;
    }
    .login-right-pane {
      padding: 48px 24px !important;
    }
  }
`;

export const Login: React.FC = () => {
  const { user, profile } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);

  // Se houver erro, aciona a animação de shake
  useEffect(() => {
    if (error) {
      setShake(true);
      const timer = setTimeout(() => setShake(false), 500);
      return () => clearTimeout(timer);
    }
  }, [error]);

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
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      fontFamily: '"Inter", "Barlow", system-ui, sans-serif',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      position: 'relative',
      padding: '20px'
    }}>
      <style>{loginStyles}</style>
      
      {/* Elementos decorativos no fundo */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        backgroundImage: 'radial-gradient(circle at 15% 50%, rgba(37, 99, 235, 0.15), transparent 25%), radial-gradient(circle at 85% 30%, rgba(56, 189, 248, 0.1), transparent 25%)',
        pointerEvents: 'none'
      }}></div>

      {/* Cartão Central (Animado) */}
      <div 
        className={`login-card-container animate-slide-up ${shake ? 'animate-shake' : ''}`}
        style={{
          display: 'flex',
          flexDirection: 'row',
          flexWrap: 'wrap',
          width: '100%',
          maxWidth: '960px',
          background: '#ffffff',
          borderRadius: '24px',
          overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          position: 'relative',
          zIndex: 10,
          opacity: 0 // Começa invisível e a animação revela
        }}
      >
        
        {/* Lado Esquerdo do Cartão - Brasão e Títulos */}
        <div className="login-left-pane" style={{
          flex: '1 1 400px',
          background: '#ffffff',
          padding: '60px 40px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          borderRight: '1px solid #f1f5f9'
        }}>
          <img 
            src={seapLogo} 
            alt="Brasão SEAP" 
            style={{ 
              width: '190px',
              height: 'auto',
              marginBottom: '32px',
              mixBlendMode: 'multiply'
            }} 
          />
          
          <div style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            gap: '8px', 
            background: '#eff6ff', 
            color: '#1d4ed8', 
            padding: '6px 16px', 
            borderRadius: '999px',
            fontSize: '13px',
            fontWeight: 600,
            marginBottom: '16px'
          }}>
            <ShieldCheck size={16} />
            Acesso Restrito
          </div>

          <h2 style={{ margin: '0 0 8px 0', fontSize: '26px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
            Compensa+
          </h2>
          <p style={{ margin: '0 0 24px 0', fontSize: '15px', color: '#64748b', lineHeight: 1.5 }}>
            Sistema Integrado de Gestão<br/>de Folgas Compensatórias
          </p>
        </div>

        {/* Lado Direito do Cartão - Formulário */}
        <div className="login-right-pane" style={{
          flex: '1 1 400px',
          background: '#f8fafc',
          padding: '60px 48px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center'
        }}>
          
          <div style={{ marginBottom: '32px' }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '24px', fontWeight: 700, color: '#0f172a', letterSpacing: '-0.02em' }}>
              Entrar na sua conta
            </h3>
            <p style={{ margin: 0, fontSize: '14px', color: '#64748b' }}>
              Insira seu e-mail institucional e senha para continuar.
            </p>
          </div>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                E-mail Institucional
              </label>
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>
                  <Mail size={18} />
                </div>
                <input 
                  type="email" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  placeholder="nome@seap.gov.br" 
                  required
                  style={{
                    width: '100%',
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    padding: '14px 14px 14px 44px',
                    color: '#0f172a',
                    fontSize: '15px',
                    outline: 'none',
                    transition: 'all 0.2s ease',
                    boxSizing: 'border-box',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                  }}
                  onFocus={(e) => { e.currentTarget.style.border = '1px solid #3b82f6'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.15)'; }}
                  onBlur={(e) => { e.currentTarget.style.border = '1px solid #e2e8f0'; e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.02)'; }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                Senha
              </label>
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>
                  <Lock size={18} />
                </div>
                <input 
                  type={showPassword ? "text" : "password"} 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  required
                  style={{
                    width: '100%',
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    padding: '14px 44px 14px 44px', // padding right for the eye icon
                    color: '#0f172a',
                    fontSize: '15px',
                    outline: 'none',
                    transition: 'all 0.2s ease',
                    boxSizing: 'border-box',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                  }}
                  onFocus={(e) => { e.currentTarget.style.border = '1px solid #3b82f6'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.15)'; }}
                  onBlur={(e) => { e.currentTarget.style.border = '1px solid #e2e8f0'; e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.02)'; }}
                />
                
                {/* Botão de Mostrar/Ocultar Senha */}
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'transparent',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '4px',
                    borderRadius: '6px'
                  }}
                  onMouseOver={(e) => { e.currentTarget.style.color = '#475569'; e.currentTarget.style.background = '#f1f5f9'; }}
                  onMouseOut={(e) => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.background = 'transparent'; }}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <div style={{ 
                background: '#fef2f2', 
                border: '1px solid #fecaca', 
                borderRadius: '8px', 
                padding: '12px', 
                color: '#ef4444', 
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                {error}
              </div>
            )}

            <button 
              type="submit" 
              disabled={loading}
              style={{
                width: '100%',
                background: '#2563eb',
                color: '#ffffff',
                border: 'none',
                borderRadius: '10px',
                padding: '14px',
                fontSize: '15px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                marginTop: '8px',
                transition: 'all 0.2s ease',
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)'
              }}
              onMouseOver={(e) => { if(!loading) e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(37, 99, 235, 0.3)'; e.currentTarget.style.background = '#1d4ed8'; }}
              onMouseOut={(e) => { if(!loading) e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(37, 99, 235, 0.2)'; e.currentTarget.style.background = '#2563eb'; }}
              onMouseDown={(e) => { if(!loading) e.currentTarget.style.transform = 'translateY(1px)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(37, 99, 235, 0.2)'; }}
              onMouseUp={(e) => { if(!loading) e.currentTarget.style.transform = 'translateY(-1px)'; }}
            >
              {loading ? (
                'Autenticando...'
              ) : (
                <>
                  Entrar no Sistema <ArrowRight size={18} />
                </>
              )}
            </button>
            


          </form>

        </div>
      </div>
      
      <div style={{ position: 'absolute', bottom: '24px', textAlign: 'center', width: '100%', color: '#94a3b8', fontSize: '12px' }}>
        &copy; {new Date().getFullYear()} SEAP-MA. Todos os direitos reservados.
      </div>
    </div>
  );
};

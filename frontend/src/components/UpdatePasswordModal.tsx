import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export const UpdatePasswordModal: React.FC = () => {
  const { isRecovery, clearRecovery, profile } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isRecovery && !profile?.must_change_password) return null;

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setError('A senha deve ter no mínimo 6 caracteres.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateError) throw updateError;

      if (profile?.must_change_password) {
        const { error: rpcError } = await supabase.rpc('mark_password_changed');
        if (rpcError) throw rpcError;
        setSuccess(true);
      } else {
        setSuccess(true);
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao atualizar a senha.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
        background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
      }}>
        <div className="blueprint card elev-md" style={{ width: '450px', padding: 'var(--space-6)', background: 'var(--color-surface)', textAlign: 'center' }}>
          <i className="corner tl"></i><i className="corner tr"></i><i className="corner bl"></i><i className="corner br"></i>
          
          <div style={{ fontSize: '48px', color: '#10b981', marginBottom: 'var(--space-3)' }}>
            ✓
          </div>
          
          <h3 style={{ marginTop: 0, marginBottom: 'var(--space-2)' }}>Senha Atualizada!</h3>
          <p style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-5)', fontSize: '15px' }}>
            Sua senha foi redefinida com sucesso. Você já tem acesso total ao sistema.
          </p>
          
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button 
              type="button" 
              className="btn btn-primary blueprint" 
              onClick={() => {
                if (profile?.must_change_password) {
                  window.location.reload();
                } else {
                  clearRecovery();
                  setSuccess(false);
                }
              }}
            >
              <i className="corner tl"></i><i className="corner tr"></i><i className="corner bl"></i><i className="corner br"></i>
              Acessar Sistema
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
      background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
    }}>
      <div className="blueprint card elev-md" style={{ width: '450px', padding: 'var(--space-6)', background: 'var(--color-surface)' }}>
        <i className="corner tl"></i><i className="corner tr"></i><i className="corner bl"></i><i className="corner br"></i>
        
        <h3 style={{ marginTop: 0, marginBottom: 'var(--space-2)' }}>Redefinir sua Senha</h3>
        <p style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-5)', fontSize: '14px' }}>
          Você solicitou a redefinição de senha. Digite sua nova senha abaixo.
        </p>
        
        <form onSubmit={handleUpdatePassword}>
          <div className="field" style={{ marginBottom: 'var(--space-4)' }}>
            <label>Nova Senha</label>
            <input 
              className="input" 
              type="password" 
              value={newPassword} 
              onChange={e => setNewPassword(e.target.value)} 
              required 
              placeholder="••••••••"
              minLength={6}
            />
          </div>

          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '12px', color: '#ef4444', fontSize: '13px', marginBottom: 'var(--space-4)' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="btn btn-primary blueprint" disabled={loading}>
              <i className="corner tl"></i><i className="corner tr"></i><i className="corner bl"></i><i className="corner br"></i>
              {loading ? 'Salvando...' : 'Salvar Nova Senha'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

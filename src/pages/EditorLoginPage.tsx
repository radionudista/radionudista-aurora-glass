import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { env } from '../config/env';
import { getSupabaseClient, isEditorAvailable } from '../lib/supabaseClient';
import { fetchEditorProfile } from '../services/editorProfileService';
import { FormContainer, FormField, FormInput, FormButton } from '../components/ui/FormComponents';
import { FALLBACK_LOGO } from '../hooks/useLiveProgram';

const HOME_HERO_LOGO = FALLBACK_LOGO;

const EditorLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isEditorAvailable()) {
    return (
      <div className="min-h-screen w-full bg-black flex items-center justify-center px-6">
        <p className="text-white/60 font-mono text-sm text-center max-w-md">
          Falta configurar VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.
        </p>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Ingresá email y contraseña.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        setError('Supabase no configurado.');
        return;
      }
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) {
        setError(signInError.message || 'Credenciales inválidas.');
        setPassword('');
        return;
      }
      const profile = await fetchEditorProfile();
      if (!profile) {
        await supabase.auth.signOut();
        setError('No tenés perfil de editor. Contactá a un administrador.');
        return;
      }
      if (profile.disabledAt) {
        await supabase.auth.signOut();
        setError('Tu cuenta de editor está desactivada.');
        return;
      }
      if (profile.role === 'editor' && profile.programId) {
        navigate(`/${env.DEFAULT_LANGUAGE}/programacion/${encodeURIComponent(profile.programId)}`, {
          replace: true,
        });
        return;
      }
      navigate(`/${env.DEFAULT_LANGUAGE}`, { replace: true });
    } catch {
      setError('Error inesperado. Reintentá.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full overflow-hidden relative bg-black">
      <div
        className="absolute inset-0 bg-black bg-no-repeat bg-center"
        style={{
          backgroundImage: `url(${HOME_HERO_LOGO})`,
          backgroundSize: 'cover',
        }}
        role="img"
        aria-label="Radio Nudista"
      />
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-black/65"
        aria-hidden
      />
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6">
        <div className="glass-card p-8 max-w-md w-full">
          <h2 className="text-2xl font-bold text-white mb-6 text-center font-['Space_Grotesk'] tracking-tight">
            Acceso Editor
          </h2>
          <FormContainer onSubmit={handleSubmit}>
            <FormField label="Email" error={error && !email.trim() ? error : undefined} required>
              <FormInput
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@radionudista.com"
                error={!!error && !email.trim()}
                autoFocus
                disabled={loading}
              />
            </FormField>
            <FormField label="Contraseña" error={error && email.trim() ? error : undefined} required>
              <FormInput
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                error={!!error && !!email.trim()}
                disabled={loading}
              />
            </FormField>
            <FormButton type="submit" fullWidth loading={loading}>
              Ingresar
            </FormButton>
          </FormContainer>
        </div>
      </div>
    </div>
  );
};

export default EditorLoginPage;

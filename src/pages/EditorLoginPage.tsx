import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { env } from '../config/env';
import { validatePassword, editorAuth, hashPassword } from '../utils/editorAuth';
import { devEditorAuth, devEditorService } from '../services/devEditorService';
import { FormContainer, FormField, FormInput, FormButton } from '../components/ui/FormComponents';
import { FALLBACK_LOGO } from '../hooks/useLiveProgram';

const HOME_HERO_LOGO = FALLBACK_LOGO;

const EditorLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!env.EDITOR_ENABLED || !env.EDITOR_PASSWORD_HASH || !env.EDITOR_SALT) {
    return (
      <div className="min-h-screen w-full bg-black flex items-center justify-center px-6">
        <p className="text-white/60 font-mono text-sm text-center max-w-md">
          El editor no está habilitado en este entorno.
        </p>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setError('Ingresá la contraseña.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const ok = await validatePassword(password, env.EDITOR_PASSWORD_HASH, env.EDITOR_SALT);
      if (!ok) {
        setError('Contraseña inválida.');
        setPassword('');
        setLoading(false);
        return;
      }
      editorAuth.createSession();
      const apiToken = await hashPassword(password, env.EDITOR_SALT);
      devEditorAuth.setToken(apiToken);
      try {
        await devEditorService.getStatus();
      } catch {
        editorAuth.clearSession();
        devEditorAuth.clearToken();
        setError('El backend del editor no responde. En prod configurá Cloudflare Functions + GitHub.');
        setPassword('');
        setLoading(false);
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
            <FormField label="Contraseña" error={error} required>
              <FormInput
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                error={!!error}
                autoFocus
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

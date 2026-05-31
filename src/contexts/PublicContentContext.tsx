import React from 'react';
import type { ContentIndexData, EditorialData } from '../editor/contracts';
import {
  fetchContentIndexFromSupabase,
  fetchEditorialFromSupabase,
  isSupabaseConfigured,
} from '../services/supabaseContentService';

interface PublicContentContextValue {
  loading: boolean;
  error: string | null;
  contentIndex: ContentIndexData;
  editorial: EditorialData | null;
  reload: (options?: { silent?: boolean }) => Promise<void>;
}

const PublicContentContext = React.createContext<PublicContentContextValue | null>(null);

export const PublicContentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [loading, setLoading] = React.useState(isSupabaseConfigured());
  const [error, setError] = React.useState<string | null>(null);
  const [contentIndex, setContentIndex] = React.useState<ContentIndexData>({});
  const [editorial, setEditorial] = React.useState<EditorialData | null>(null);

  const load = React.useCallback(async (options?: { silent?: boolean }) => {
    if (!isSupabaseConfigured()) {
      setError('Supabase no configurado (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).');
      setLoading(false);
      return;
    }

    if (!options?.silent) {
      setLoading(true);
    }
    setError(null);
    try {
      const [indexData, editorialData] = await Promise.all([
        fetchContentIndexFromSupabase(),
        fetchEditorialFromSupabase(),
      ]);
      if (!indexData) throw new Error('No hay contenido en Supabase.');
      setContentIndex(indexData);
      setEditorial(editorialData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar contenido.');
    } finally {
      if (!options?.silent) {
        setLoading(false);
      }
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    const onVisibilityChange = () => {
      if (!document.hidden) void load({ silent: true });
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [load]);

  const value: PublicContentContextValue = {
    loading,
    error,
    contentIndex,
    editorial,
    reload: load,
  };

  if (loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-black">
        <div className="text-white/70 font-mono text-sm">Cargando contenido…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-black px-6">
        <p className="text-red-300 font-mono text-sm text-center max-w-md">{error}</p>
      </div>
    );
  }

  return <PublicContentContext.Provider value={value}>{children}</PublicContentContext.Provider>;
};

export const usePublicContent = (): PublicContentContextValue => {
  const ctx = React.useContext(PublicContentContext);
  if (!ctx) throw new Error('usePublicContent must be used within PublicContentProvider');
  return ctx;
};

export const useOptionalPublicContent = (): PublicContentContextValue | null =>
  React.useContext(PublicContentContext);

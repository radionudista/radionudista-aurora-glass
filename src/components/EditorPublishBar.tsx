import React from 'react';
import { env } from '../config/env';
import { useOptionalEditor } from '../contexts/EditorContext';

/**
 * Solo local dev: git push tras guardar en disco.
 * En prod cada Aceptar ya commitea a GitHub; no hace falta este botón.
 */
interface EditorPublishBarProps {
  className?: string;
}

const isLocalDevEditor = import.meta.env.DEV && env.APP_ENVIRONMENT === 'local';

const EditorPublishBar: React.FC<EditorPublishBarProps> = ({ className = '' }) => {
  const editor = useOptionalEditor();

  if (!isLocalDevEditor || !editor?.enabled || editor.loading) return null;

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={() => void editor.publish()}
        disabled={editor.saving}
        className="h-8 shrink-0 border border-lime-400/70 bg-black/90 px-3 text-[10px] uppercase tracking-widest text-lime-300 transition hover:border-lime-300 disabled:opacity-50"
      >
        {editor.saving ? 'Publicando…' : 'Publicar GitHub'}
      </button>
      {editor.message && (
        <p
          className="hidden max-w-[12rem] truncate text-[10px] leading-snug text-white/60 xl:block"
          title={editor.message}
        >
          {editor.message}
        </p>
      )}
    </div>
  );
};

export default EditorPublishBar;

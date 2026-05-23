import React from 'react';
import { useOptionalEditor } from '../contexts/EditorContext';

/**
 * Solo dev: atajo para commit+push de contenido JSON ya guardado en disco.
 * La edición ocurre inline en cada página; no hay panel lateral.
 */
interface EditorPublishBarProps {
  className?: string;
}

const EditorPublishBar: React.FC<EditorPublishBarProps> = ({ className = '' }) => {
  const editor = useOptionalEditor();

  if (!editor?.enabled || editor.loading) return null;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={() => void editor.publish()}
        disabled={editor.saving}
        className="h-8 border border-lime-400/70 bg-black/90 px-3 text-[10px] uppercase tracking-widest text-lime-300 transition hover:border-lime-300 disabled:opacity-50"
      >
        {editor.saving ? 'Publicando…' : 'Publicar GitHub'}
      </button>
      {editor.message && (
        <p className="max-w-[15rem] truncate text-[10px] leading-snug text-white/60" title={editor.message}>
          {editor.message}
        </p>
      )}
    </div>
  );
};

export default EditorPublishBar;

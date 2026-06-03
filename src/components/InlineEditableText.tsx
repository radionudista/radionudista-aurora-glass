import React from 'react';
import { Check, Pencil, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useOptionalEditor } from '../contexts/EditorContext';
import type { EditorLanguage } from '../editor/contracts';
import { buildLocalizedDraft } from '../utils/editorialText';

type LocalizedTextValues = Record<EditorLanguage, string>;

export interface InlineEditableTextProps {
  value: string;
  displayValue?: React.ReactNode;
  className?: string;
  multiline?: boolean;
  onCommit: (nextValue: string) => Promise<void> | void;
  onCommitLocalized?: (nextValues: LocalizedTextValues) => Promise<void> | void;
  localizedValues?: Partial<LocalizedTextValues>;
  language?: EditorLanguage;
  /**
   * sm: metadatos (horario, duración…)
   * lg: titulares grandes (evita input de una línea aplastado junto a display enorme)
   */
  size?: 'sm' | 'lg';
  /** Clases tipográficas del texto mostrado; se reutilizan en el textarea al editar */
  textClassName?: string;
  /** Contenedor semántico en modo lectura */
  as?: 'span' | 'div' | 'h1' | 'h3';
  /** Alineación del texto + lápiz (p. ej. bloques centrados en Home) */
  align?: 'start' | 'center';
  /** Hook opcional para reaccionar cuando se pulsa el lápiz */
  onStartEdit?: () => void;
}

const InlineEditableText: React.FC<InlineEditableTextProps> = ({
  value,
  displayValue,
  className = '',
  multiline = false,
  onCommit,
  onCommitLocalized,
  localizedValues,
  language = 'es',
  size = 'sm',
  textClassName = '',
  as: Tag = 'span',
  align = 'start',
  onStartEdit,
}) => {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(value);
  const [activeLangTab, setActiveLangTab] = React.useState<EditorLanguage>(language);
  const [localizedDraft, setLocalizedDraft] = React.useState<LocalizedTextValues>(() =>
    buildLocalizedDraft(localizedValues, value)
  );
  const [saving, setSaving] = React.useState(false);
  const [translating, setTranslating] = React.useState(false);
  const [translateMessage, setTranslateMessage] = React.useState<string | null>(null);
  const editor = useOptionalEditor();
  const useLocalizedEditor = Boolean(onCommitLocalized);

  const isLarge = size === 'lg';

  React.useEffect(() => {
    if (!editing) {
      setDraft(value);
      setLocalizedDraft(buildLocalizedDraft(localizedValues, value));
      setActiveLangTab(language);
      setTranslateMessage(null);
    }
  }, [editing, value, localizedValues, language]);

  const handleAccept = async () => {
    setSaving(true);
    try {
      if (useLocalizedEditor && onCommitLocalized) {
        await onCommitLocalized(localizedDraft);
      } else {
        await onCommit(draft);
      }
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setDraft(value);
    setLocalizedDraft(buildLocalizedDraft(localizedValues, value));
    setActiveLangTab(language);
    setTranslateMessage(null);
    setEditing(false);
  };

  const handleTranslate = async () => {
    if (!editor?.enabled) return;
    if (!localizedDraft.es.trim()) {
      setTranslateMessage('Escribe primero un texto base en ES.');
      return;
    }
    setTranslating(true);
    setTranslateMessage(null);
    try {
      const result = await editor.translateText(localizedDraft.es);
      setLocalizedDraft((prev) => ({
        ...prev,
        en: result.translated.en || prev.en,
        pt: result.translated.pt || prev.pt,
      }));
      setActiveLangTab('en');
      setTranslateMessage(null);
    } catch (error) {
      setTranslateMessage(error instanceof Error ? error.message : 'No se pudo traducir el texto.');
    } finally {
      setTranslating(false);
    }
  };

  const pencilSize = isLarge ? 22 : 14;
  const pencilPad = isLarge ? 'p-2.5' : 'p-1.5';

  const editTextareaClass = cn(
    'w-full resize-y border border-white/25 bg-black/80 text-white placeholder:text-white/35',
    'focus:border-white/50 focus:outline-none focus:ring-1 focus:ring-white/20',
    isLarge
      ? cn(
          'min-h-[6rem] px-3 py-3',
          textClassName ||
            "font-['Space_Grotesk'] text-4xl font-black uppercase tracking-tighter leading-[0.95] sm:text-5xl md:text-6xl lg:text-7xl"
        )
      : multiline
        ? cn('min-h-[10rem] px-3 py-3 text-sm leading-relaxed md:text-base', textClassName)
        : cn('min-h-[3.25rem] px-3 py-2.5 text-sm md:text-base', textClassName)
  );

  if (editing) {
    const activeDraftValue = useLocalizedEditor ? localizedDraft[activeLangTab] : draft;
    const setActiveDraftValue = (nextValue: string) => {
      if (useLocalizedEditor) {
        setLocalizedDraft((prev) => ({ ...prev, [activeLangTab]: nextValue }));
      } else {
        setDraft(nextValue);
      }
    };

    return (
      <div className={cn('w-full max-w-full space-y-3', className)}>
        {useLocalizedEditor && (
          <div className="flex flex-wrap gap-1.5">
            {(['es', 'en', 'pt'] as const).map((langCode) => (
              <button
                key={langCode}
                type="button"
                onClick={() => setActiveLangTab(langCode)}
                className={cn(
                  'border px-2 py-1 text-[10px] uppercase tracking-[0.18em] transition',
                  activeLangTab === langCode
                    ? 'border-white bg-white text-black'
                    : 'border-white/25 text-white/75 hover:border-white/50'
                )}
              >
                {langCode}
              </button>
            ))}
          </div>
        )}
        <textarea
          value={activeDraftValue}
          onChange={(event) => setActiveDraftValue(event.target.value)}
          className={editTextareaClass}
          rows={isLarge ? 3 : multiline ? 8 : 3}
          spellCheck
        />
        <div className="flex flex-wrap items-center gap-2">
          {useLocalizedEditor && (
            <button
              type="button"
              onClick={() => void handleTranslate()}
              disabled={saving || translating}
              className="inline-flex items-center gap-1 border border-sky-400/70 px-3 py-2 text-xs uppercase tracking-widest text-sky-300 disabled:opacity-50"
            >
              {translating ? 'Traduciendo...' : 'Traducir'}
            </button>
          )}
          <button
            type="button"
            onClick={() => void handleAccept()}
            disabled={saving}
            className="inline-flex items-center gap-1 border border-emerald-400/70 px-3 py-2 text-xs uppercase tracking-widest text-emerald-300 disabled:opacity-50"
          >
            <Check size={14} />
            Aceptar
          </button>
          <button
            type="button"
            onClick={handleCancel}
            disabled={saving}
            className="inline-flex items-center gap-1 border border-white/30 px-3 py-2 text-xs uppercase tracking-widest text-white/80"
          >
            <X size={14} />
            Cancelar
          </button>
        </div>
        {translateMessage && (
          <p className="text-[11px] text-white/65">{translateMessage}</p>
        )}
      </div>
    );
  }

  const viewRowClass = cn(
    'w-full max-w-full',
    isLarge
      ? 'flex flex-wrap items-start gap-3'
      : multiline
        ? 'flex items-start gap-2'
        : 'inline-flex max-w-full items-center gap-2 align-middle',
    align === 'center' && 'justify-center'
  );

  const textSpan = (
    <span
      className={cn(
        'min-w-0 flex-1 break-words',
        multiline && 'whitespace-pre-wrap',
        textClassName
      )}
    >
      {displayValue ?? value}
    </span>
  );

  const editBtn = (
    <button
      type="button"
      onClick={() => {
        onStartEdit?.();
        if (useLocalizedEditor) {
          setLocalizedDraft(buildLocalizedDraft(localizedValues, value));
          setActiveLangTab(language);
        } else {
          setDraft(value);
        }
        setTranslateMessage(null);
        setEditing(true);
      }}
      className={cn(
        'inline-flex shrink-0 items-center justify-center border border-white/35 bg-black/80 text-white/90 transition hover:border-white hover:bg-black',
        'self-center',
        pencilPad,
        isLarge && 'mt-1 md:mt-2'
      )}
      aria-label="Editar texto"
    >
      <Pencil size={pencilSize} strokeWidth={2} />
    </button>
  );

  if (Tag === 'span') {
    return (
      <span className={cn(viewRowClass, className)}>
        {textSpan}
        {editBtn}
      </span>
    );
  }

  return (
    <Tag className={cn(viewRowClass, className)}>
      {textSpan}
      {editBtn}
    </Tag>
  );
};

export default InlineEditableText;

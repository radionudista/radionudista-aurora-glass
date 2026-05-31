import React from 'react';
import InlineEditableText from './InlineEditableText';
import { editorSupabaseService } from '../services/editorSupabaseService';

export interface EditableImageFieldProps {
  label: string;
  previewSrc: string;
  /** Valor en JSON: nombre de logo (ej. 2.png) o ruta/URL de portada */
  valueForEdit: string;
  uploadScope: 'program-logo' | 'episode-cover' | 'home-hero';
  programId: string;
  episodeId?: string;
  onCommit: (nextValue: string) => Promise<void>;
  /** Tras subir archivo: DB ya actualizada en uploadImage; evita re-guardar todo el índice. */
  onAfterFileUpload?: (url: string, message: string) => Promise<void>;
  /** Muestra botón para volver al valor por defecto (p. ej. logo original del home). */
  canReset?: boolean;
  onReset?: () => Promise<void>;
  resetLabel?: string;
  helpText?: string;
}

const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('No se pudo leer el archivo'));
    r.readAsDataURL(file);
  });

const EditableImageField: React.FC<EditableImageFieldProps> = ({
  label,
  previewSrc,
  valueForEdit,
  uploadScope,
  programId,
  episodeId,
  onCommit,
  onAfterFileUpload,
  canReset = false,
  onReset,
  resetLabel = 'Restaurar original',
  helpText,
}) => {
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [previewOverride, setPreviewOverride] = React.useState<string | null>(null);

  React.useEffect(() => {
    setPreviewOverride(null);
  }, [previewSrc]);

  const displaySrc = previewOverride ?? previewSrc;

  const onPickFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setErr(null);
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setErr('Usa PNG, JPEG o WebP.');
      return;
    }

    const blobPreview = URL.createObjectURL(file);
    setPreviewOverride(blobPreview);
    setBusy(true);
    try {
      const dataBase64 = await fileToDataUrl(file);
      const res = await editorSupabaseService.uploadImage({
        scope: uploadScope,
        programId,
        episodeId,
        mimeType: file.type,
        dataBase64,
      });
      if (!res.coverPublicPath) throw new Error('No se recibió URL de la imagen.');
      if (onAfterFileUpload) {
        await onAfterFileUpload(res.coverPublicPath, res.message);
      } else {
        await onCommit(res.coverPublicPath);
      }
      setPreviewOverride(`${res.coverPublicPath}${res.coverPublicPath.includes('?') ? '&' : '?'}v=${Date.now()}`);
    } catch (er) {
      setPreviewOverride(null);
      setErr(er instanceof Error ? er.message : 'Error al subir');
    } finally {
      URL.revokeObjectURL(blobPreview);
      setBusy(false);
    }
  };

  const onClickReset = async () => {
    if (!onReset) return;
    setErr(null);
    setBusy(true);
    try {
      await onReset();
      setPreviewOverride(null);
    } catch (er) {
      setErr(er instanceof Error ? er.message : 'No se pudo restaurar');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2 border border-white/20 bg-black/80 p-3 text-white">
      <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/55">{label}</p>
      <div className="relative aspect-video w-full max-h-36 overflow-hidden border border-white/15 bg-black/50">
        <img
          key={displaySrc}
          src={displaySrc}
          alt=""
          className="h-full w-full object-contain object-center"
        />
      </div>
      <label className="block">
        <span className="sr-only">Subir imagen</span>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={busy}
          onChange={(ev) => void onPickFile(ev)}
          className="w-full text-[11px] text-white file:me-2 file:border file:border-white/30 file:bg-transparent file:px-2 file:py-1 file:text-[10px] file:uppercase file:tracking-wider"
        />
      </label>
      {canReset && onReset ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void onClickReset()}
          className="w-full border border-red-400/35 bg-red-500/10 px-2 py-1.5 font-mono text-[10px] uppercase tracking-wider text-red-200 transition hover:bg-red-500/20 disabled:opacity-50"
        >
          {resetLabel}
        </button>
      ) : null}
      <div className="text-[10px] text-white/45">
        <InlineEditableText
          multiline={uploadScope === 'episode-cover'}
          value={valueForEdit}
          textClassName="text-[11px] text-white/80 font-mono break-all"
          onCommit={async (next) => {
            await onCommit(next.trim());
          }}
        />
      </div>
      {helpText ? <p className="text-[10px] leading-snug text-white/35">{helpText}</p> : null}
      {err ? <p className="text-[10px] text-red-300">{err}</p> : null}
      {busy ? <p className="text-[10px] text-white/50">Subiendo…</p> : null}
    </div>
  );
};

export default EditableImageField;

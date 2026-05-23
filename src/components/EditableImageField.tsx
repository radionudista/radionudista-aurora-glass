import React from 'react';
import InlineEditableText from './InlineEditableText';
import { devEditorService } from '../services/devEditorService';

export interface EditableImageFieldProps {
  label: string;
  previewSrc: string;
  /** Valor en JSON: nombre de logo (ej. 2.png) o ruta/URL de portada */
  valueForEdit: string;
  uploadScope: 'program-logo' | 'episode-cover';
  programId: string;
  episodeId?: string;
  onCommit: (nextValue: string) => Promise<void>;
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
  helpText,
}) => {
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const onPickFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setErr(null);
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setErr('Usa PNG, JPEG o WebP.');
      return;
    }
    setBusy(true);
    try {
      const dataBase64 = await fileToDataUrl(file);
      const res = await devEditorService.uploadImage({
        scope: uploadScope,
        programId,
        episodeId,
        mimeType: file.type,
        dataBase64,
      });
      if (res.logoFileName) await onCommit(res.logoFileName);
      else if (res.coverPublicPath) await onCommit(res.coverPublicPath);
    } catch (er) {
      setErr(er instanceof Error ? er.message : 'Error al subir');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2 border border-white/20 bg-black/80 p-3 text-white">
      <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/55">{label}</p>
      <div className="relative aspect-video w-full max-h-36 overflow-hidden border border-white/15 bg-black/50">
        <img src={previewSrc} alt="" className="h-full w-full object-contain object-center" />
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

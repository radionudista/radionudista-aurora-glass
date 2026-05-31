import type { SupabaseClient } from '@supabase/supabase-js';
import {
  contentIndexToRows,
  episodeToRows,
  type SavePayload,
} from '../editor/contentMappers';
import {
  buildNewProgramIndexEntry,
  normalizeProgramId,
} from '../editor/programUtils';
import type { ContentIndexData } from '../editor/contracts';
import { getSupabaseClient } from '../lib/supabaseClient';

const MIME_TO_EXT: Record<string, string> = {  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
};

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const requireClient = (): SupabaseClient => {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase no configurado.');
  return client;
};

const decodeImageBase64 = (dataBase64: string): { buffer: Uint8Array; mimeType: string } => {
  const match = /^data:(image\/(?:png|jpeg|webp));base64,(.+)$/i.exec(dataBase64.trim());
  if (!match) throw new Error('Formato de imagen inválido.');
  const mimeType = match[1].toLowerCase();
  const binary = atob(match[2]);
  const buffer = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) buffer[i] = binary.charCodeAt(i);
  if (buffer.length > MAX_IMAGE_BYTES) throw new Error('Imagen demasiado grande (máx. 8 MB).');
  if (buffer.length < 32) throw new Error('Archivo vacío o corrupto.');
  return { buffer, mimeType };
};

const upsertRows = async (
  supabase: SupabaseClient,
  table: string,
  rows: Record<string, unknown>[],
  onConflict: string
) => {
  if (rows.length === 0) return;
  const { error } = await supabase.from(table).upsert(rows, { onConflict });
  if (error) throw new Error(error.message);
};

export const editorSupabaseService = {
  async savePayload(payload: SavePayload): Promise<{ message: string }> {
    const supabase = requireClient();

    if (payload.contentIndex) {
      const { items, translations } = contentIndexToRows(payload.contentIndex);
      await upsertRows(supabase, 'content_items', items, 'id');
      await upsertRows(supabase, 'content_item_translations', translations, 'content_item_id,lang');
    }

    if (payload.editorial) {
      const { error } = await supabase
        .from('site_editorial')
        .upsert({ id: 1, payload: payload.editorial }, { onConflict: 'id' });
      if (error) throw new Error(error.message);
    }

    if (payload.episodesByProgram) {
      const translationLang = payload.episodeTranslationLang ?? 'es';
      for (const [programId, program] of Object.entries(payload.episodesByProgram)) {
        const { episodeRows, translationRows } = episodeToRows(programId, program.episodes, {
          deleted: false,
          translationLang,
        });
        await upsertRows(supabase, 'episodes', episodeRows, 'id');
        await upsertRows(supabase, 'episode_translations', translationRows, 'episode_id,lang');
      }
    }

    if (payload.episodesTrashByProgram) {
      const translationLang = payload.episodeTranslationLang ?? 'es';
      for (const [programId, program] of Object.entries(payload.episodesTrashByProgram)) {
        const { episodeRows, translationRows } = episodeToRows(programId, program.episodes, {
          deleted: true,
          translationLang,
        });
        await upsertRows(supabase, 'episodes', episodeRows, 'id');
        await upsertRows(supabase, 'episode_translations', translationRows, 'episode_id,lang');
      }
    }

    return { message: 'Cambios guardados en Supabase.' };
  },

  async publish(payload: SavePayload): Promise<{ message: string }> {
    await this.savePayload(payload);
    return { message: 'Contenido publicado.' };
  },

  async createProgram(input: {
    id: string;
    titleEs: string;
    titlePt: string;
    schedule?: string;
    contentKind?: 'program' | 'event';
  }): Promise<{ programId: string; message: string }> {
    const supabase = requireClient();
    const id = normalizeProgramId(input.id);
    const titleEs = input.titleEs.trim();
    const titlePt = input.titlePt.trim();
    const schedule = (input.schedule || 'Horario por definir').trim();
    const contentKind = input.contentKind === 'event' ? 'event' : 'program';
    if (!titleEs) throw new Error('El título en español es obligatorio.');
    if (!titlePt) throw new Error('Falta el título en portugués.');

    const { data: existing } = await supabase.from('content_items').select('id').eq('id', id).maybeSingle();
    if (existing) throw new Error(`Ya existe un programa o página con el id "${id}".`);

    let program_order: number | null = null;
    if (contentKind === 'program') {
      const { data: orderRow } = await supabase
        .from('content_items')
        .select('program_order')
        .not('program_order', 'is', null)
        .order('program_order', { ascending: false })
        .limit(1)
        .maybeSingle();
      program_order = (orderRow?.program_order ?? 0) + 1;
    }

    const entryBase = { id, program_order, schedule, contentKind };
    const contentIndexNew: ContentIndexData = {
      [id]: {
        es: buildNewProgramIndexEntry({ lang: 'es', title: titleEs, ...entryBase }),
        pt: buildNewProgramIndexEntry({ lang: 'pt', title: titlePt, ...entryBase }),
        en: buildNewProgramIndexEntry({ lang: 'en', title: titleEs, ...entryBase }),
      },
    };

    const { items, translations } = contentIndexToRows(contentIndexNew);
    await upsertRows(supabase, 'content_items', items, 'id');
    await upsertRows(supabase, 'content_item_translations', translations, 'content_item_id,lang');

    const label = contentKind === 'event' ? 'Evento' : 'Programa';
    return {
      programId: id,
      program_order,
      contentIndexPatch: contentIndexNew,
      message: `${label} "${id}" creado.`,
    };
  },

  async deleteProgram(input: { id: string; confirmText: string }): Promise<{ programId: string; message: string }> {
    const supabase = requireClient();
    const id = normalizeProgramId(input.id);
    if (input.confirmText.trim().toLowerCase() !== 'eliminar') {
      throw new Error('Confirmación inválida. Escribe "eliminar".');
    }

    const { data: existing } = await supabase.from('content_items').select('id').eq('id', id).maybeSingle();
    if (!existing) throw new Error(`No se encontró el programa "${id}" para eliminar.`);

    await supabase.from('episodes').delete().eq('program_id', id);
    await supabase.from('content_item_translations').delete().eq('content_item_id', id);
    const { error } = await supabase.from('content_items').delete().eq('id', id);
    if (error) throw new Error(error.message);

    return { programId: id, message: `Programa "${id}" eliminado.` };
  },

  async purgeEpisode(programId: string, episodeId: string): Promise<void> {
    const supabase = requireClient();
    await supabase.from('episode_translations').delete().eq('episode_id', episodeId);
    const { error } = await supabase.from('episodes').delete().eq('id', episodeId).eq('program_id', programId);
    if (error) throw new Error(error.message);
  },

  async setEpisodeDeletedAt(
    programId: string,
    episodeId: string,
    deletedAt: string | null
  ): Promise<void> {
    const supabase = requireClient();
    const { error } = await supabase
      .from('episodes')
      .update({ deleted_at: deletedAt })
      .eq('id', episodeId)
      .eq('program_id', programId);
    if (error) throw new Error(error.message);
  },

  async uploadImage(input: {
    scope: 'program-logo' | 'episode-cover' | 'home-hero';
    programId: string;
    episodeId?: string;
    mimeType: string;
    dataBase64: string;
  }): Promise<{ logoFileName?: string; coverPublicPath?: string; message: string }> {
    const supabase = requireClient();
    const { buffer, mimeType } = decodeImageBase64(input.dataBase64);
    const ext = MIME_TO_EXT[mimeType];
    if (!ext) throw new Error('Tipo de imagen no permitido (usa PNG, JPEG o WebP).');

    const bucket =
      input.scope === 'program-logo'
        ? 'program-logos'
        : input.scope === 'home-hero'
          ? 'home-hero'
          : 'episode-covers';
    const ts = Date.now();
    const prog = input.programId.replace(/[^a-z0-9-]/gi, '-');
    const fileName =
      input.scope === 'home-hero'
        ? `hero-${ts}${ext}`
        : input.scope === 'program-logo'
          ? `${prog}-${ts}${ext}`
          : `${prog}-${(input.episodeId || 'ep').replace(/[^a-z0-9-]/gi, '-')}-${ts}${ext}`;

    const { error } = await supabase.storage.from(bucket).upload(fileName, buffer, {
      contentType: mimeType,
      upsert: true,
    });
    if (error) throw new Error(error.message);

    const { data: publicUrl } = supabase.storage.from(bucket).getPublicUrl(fileName);

    if (input.scope === 'home-hero') {
      return { coverPublicPath: publicUrl.publicUrl, message: 'Imagen del home guardada en Supabase Storage.' };
    }

    if (input.scope === 'program-logo') {
      await supabase.from('content_items').update({ logo_url: publicUrl.publicUrl }).eq('id', input.programId);
      return { coverPublicPath: publicUrl.publicUrl, message: 'Logo guardado en Supabase Storage.' };
    }

    const coverPublicPath = publicUrl.publicUrl;
    if (input.episodeId) {
      await supabase
        .from('episodes')
        .update({ cover_image_url: coverPublicPath })
        .eq('id', input.episodeId)
        .eq('program_id', input.programId);
    }
    return { coverPublicPath, message: 'Portada guardada en Supabase Storage.' };
  },
};

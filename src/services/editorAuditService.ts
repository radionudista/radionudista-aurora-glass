import { getSupabaseSession, isEditorAvailable } from '../lib/supabaseClient';
import { devEditorService } from './devEditorService';

export type EditorAuditPayload = {
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  summary?: string | null;
  metadata?: Record<string, unknown>;
};

/** Registra actividad en segundo plano (no bloquea la UI). */
export const recordEditorAction = (payload: EditorAuditPayload): void => {
  if (!isEditorAvailable()) return;
  void (async () => {
    try {
      const session = await getSupabaseSession();
      const userId = session?.user?.id;
      if (!userId) return;
      await devEditorService.recordAudit({
        actorUserId: userId,
        actorEmail: session.user.email ?? null,
        ...payload,
      });
    } catch {
      // ignorar fallos de auditoría
    }
  })();
};

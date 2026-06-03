import type { EditorAuthProfile } from '../editorAuth';
import type { SupabaseAuthEnv } from '../editorAuth';

export type AuditLogInsert = {
  actorUserId: string;
  actorEmail?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  summary?: string | null;
  metadata?: Record<string, unknown>;
};

const adminHeaders = (serviceKey: string) => ({
  Authorization: `Bearer ${serviceKey}`,
  apikey: serviceKey,
  'Content-Type': 'application/json',
  Prefer: 'return=minimal',
});

export const insertEditorAuditLog = async (
  env: Pick<SupabaseAuthEnv, 'SUPABASE_URL' | 'SUPABASE_SERVICE_ROLE_KEY'>,
  entry: AuditLogInsert
): Promise<void> => {
  const url = (env.SUPABASE_URL || '').trim();
  const serviceKey = (env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!url || !serviceKey || !entry.actorUserId || !entry.action) return;

  const row = {
    actor_user_id: entry.actorUserId,
    actor_email: entry.actorEmail ?? null,
    action: entry.action.slice(0, 120),
    target_type: entry.targetType?.slice(0, 64) ?? null,
    target_id: entry.targetId?.slice(0, 256) ?? null,
    summary: entry.summary?.slice(0, 500) ?? null,
    metadata: entry.metadata ?? {},
  };

  try {
    await fetch(`${url}/rest/v1/editor_audit_logs`, {
      method: 'POST',
      headers: adminHeaders(serviceKey),
      body: JSON.stringify(row),
    });
  } catch {
    // no bloquear la acción principal
  }
};

export const insertAuditFromProfile = async (
  env: Pick<SupabaseAuthEnv, 'SUPABASE_URL' | 'SUPABASE_SERVICE_ROLE_KEY'>,
  profile: EditorAuthProfile,
  actorEmail: string | undefined,
  entry: Omit<AuditLogInsert, 'actorUserId' | 'actorEmail'>
): Promise<void> => {
  await insertEditorAuditLog(env, {
    actorUserId: profile.userId,
    actorEmail: actorEmail ?? null,
    ...entry,
  });
};

export type AuditLogRow = {
  id: string;
  actorUserId: string | null;
  actorEmail: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  summary: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export const listEditorAuditLogs = async (
  env: Pick<SupabaseAuthEnv, 'SUPABASE_URL' | 'SUPABASE_SERVICE_ROLE_KEY'>,
  options: { userId?: string; limit?: number }
): Promise<AuditLogRow[]> => {
  const url = (env.SUPABASE_URL || '').trim();
  const serviceKey = (env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!url || !serviceKey) return [];

  const limit = Math.min(Math.max(options.limit ?? 200, 1), 500);
  const params = new URLSearchParams({
    select: 'id,actor_user_id,actor_email,action,target_type,target_id,summary,metadata,created_at',
    order: 'created_at.desc',
    limit: String(limit),
  });
  if (options.userId?.trim()) {
    params.set('actor_user_id', `eq.${options.userId.trim()}`);
  }

  const response = await fetch(`${url}/rest/v1/editor_audit_logs?${params}`, {
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      Accept: 'application/json',
    },
  });

  if (!response.ok) return [];

  const rows = (await response.json()) as Array<Record<string, unknown>>;
  if (!Array.isArray(rows)) return [];

  return rows.map((row) => ({
    id: String(row.id || ''),
    actorUserId: row.actor_user_id == null ? null : String(row.actor_user_id),
    actorEmail: row.actor_email == null ? null : String(row.actor_email),
    action: String(row.action || ''),
    targetType: row.target_type == null ? null : String(row.target_type),
    targetId: row.target_id == null ? null : String(row.target_id),
    summary: row.summary == null ? null : String(row.summary),
    metadata:
      row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : {},
    createdAt: row.created_at == null ? '' : String(row.created_at),
  }));
};

/** True si el log pertenece al programa (contenido, episodios, medios o admin.user.* con ese programId). */
export const auditLogMatchesProgram = (log: AuditLogRow, programId: string): boolean => {
  const pid = programId.trim();
  if (!pid) return false;

  const meta = log.metadata ?? {};
  const metaPid = meta.programId != null ? String(meta.programId).trim() : '';
  if (metaPid === pid) return true;

  if (log.targetType === 'program' && log.targetId === pid) return true;

  const targetId = log.targetId?.trim() ?? '';
  if (targetId === pid) return true;
  if (targetId.startsWith(`${pid}/`)) return true;

  if (log.action.startsWith('admin.user.') && metaPid === pid) return true;

  return false;
};

export const listEditorAuditLogsForProgram = async (
  env: Pick<SupabaseAuthEnv, 'SUPABASE_URL' | 'SUPABASE_SERVICE_ROLE_KEY'>,
  programId: string,
  options?: { limit?: number }
): Promise<AuditLogRow[]> => {
  const logs = await listEditorAuditLogs(env, { limit: options?.limit ?? 500 });
  return logs.filter((log) => auditLogMatchesProgram(log, programId));
};

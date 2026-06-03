import { jsonResponse, readBearerToken } from './supabaseJwtAuth';
import { isEditorMasterRole, isEditorStaffRole, type EditorRole } from './editorRoles';

export type { EditorRole };

export interface EditorAuthProfile {
  userId: string;
  role: EditorRole;
  programId: string | null;
  disabledAt: string | null;
}

export interface SupabaseAuthEnv {
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
}

const parseProfileRow = (row: Record<string, unknown>): EditorAuthProfile | null => {
  const role = String(row.role || '');
  if (role !== 'admin' && role !== 'editor' && role !== 'master') return null;
  return {
    userId: String(row.user_id || ''),
    role,
    programId: row.program_id == null ? null : String(row.program_id),
    disabledAt: row.disabled_at == null ? null : String(row.disabled_at),
  };
};

export const fetchAuthUserId = async (
  token: string,
  env: Pick<SupabaseAuthEnv, 'SUPABASE_URL' | 'SUPABASE_ANON_KEY'>
): Promise<string | null> => {
  const url = (env.SUPABASE_URL || '').trim();
  const anonKey = (env.SUPABASE_ANON_KEY || '').trim();
  if (!url || !anonKey || !token) return null;

  const response = await fetch(`${url}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: anonKey },
  });
  if (!response.ok) return null;
  const data = (await response.json()) as { id?: string };
  return data.id ? String(data.id) : null;
};

export const fetchEditorProfile = async (
  token: string,
  env: Pick<SupabaseAuthEnv, 'SUPABASE_URL' | 'SUPABASE_ANON_KEY'>,
  userId?: string
): Promise<EditorAuthProfile | null> => {
  const url = (env.SUPABASE_URL || '').trim();
  const anonKey = (env.SUPABASE_ANON_KEY || '').trim();
  if (!url || !anonKey || !token) return null;

  const resolvedUserId = userId ?? (await fetchAuthUserId(token, env));
  if (!resolvedUserId) return null;

  const response = await fetch(
    `${url}/rest/v1/editor_profiles?select=user_id,role,program_id,disabled_at&user_id=eq.${encodeURIComponent(resolvedUserId)}&limit=1`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: anonKey,
        Accept: 'application/json',
      },
    }
  );

  if (!response.ok) return null;
  const rows = (await response.json()) as Record<string, unknown>[];
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return parseProfileRow(rows[0]!);
};

export interface AssertEditorAuthOptions {
  requireAdmin?: boolean;
  requireMaster?: boolean;
  programId?: string;
}

export const assertEditorAuthorized = async (
  request: Request,
  env: Pick<SupabaseAuthEnv, 'SUPABASE_URL' | 'SUPABASE_ANON_KEY'>,
  options: AssertEditorAuthOptions = {}
): Promise<{ error: Response } | { profile: EditorAuthProfile; token: string }> => {
  const url = (env.SUPABASE_URL || '').trim();
  const anonKey = (env.SUPABASE_ANON_KEY || '').trim();
  const token = readBearerToken(request);

  if (!url || !anonKey) {
    return {
      error: jsonResponse(503, {
        ok: false,
        message: 'Faltan SUPABASE_URL o SUPABASE_ANON_KEY en el servidor.',
      }),
    };
  }

  if (!token) {
    return {
      error: jsonResponse(401, {
        ok: false,
        message: 'Sesión del editor inválida. Volvé a /editor-login.',
      }),
    };
  }

  const userId = await fetchAuthUserId(token, env);
  if (!userId) {
    return {
      error: jsonResponse(401, {
        ok: false,
        message: 'Sesión del editor inválida. Volvé a /editor-login.',
      }),
    };
  }

  const profile = await fetchEditorProfile(token, env, userId);
  if (!profile || profile.userId !== userId) {
    return {
      error: jsonResponse(403, {
        ok: false,
        message: 'No tenés perfil de editor. Contactá a un administrador.',
      }),
    };
  }

  if (profile.disabledAt) {
    return {
      error: jsonResponse(403, {
        ok: false,
        message: 'Tu cuenta de editor está desactivada.',
      }),
    };
  }

  if (profile.role === 'editor' && !profile.programId) {
    return {
      error: jsonResponse(403, {
        ok: false,
        message: 'Tu cuenta no tiene un programa asignado.',
      }),
    };
  }

  if (options.requireMaster && !isEditorMasterRole(profile.role)) {
    return {
      error: jsonResponse(403, {
        ok: false,
        message: 'Solo el usuario master puede realizar esta acción.',
      }),
    };
  }

  if (options.requireAdmin && !isEditorStaffRole(profile.role)) {
    return {
      error: jsonResponse(403, {
        ok: false,
        message: 'Solo administradores pueden realizar esta acción.',
      }),
    };
  }

  if (options.programId) {
    const allowed =
      isEditorStaffRole(profile.role) ||
      (profile.role === 'editor' && profile.programId === options.programId);
    if (!allowed) {
      return {
        error: jsonResponse(403, {
          ok: false,
          message: 'No tenés permiso para editar este programa.',
        }),
      };
    }
  }

  return { profile, token };
};

export const canAccessProgram = (profile: EditorAuthProfile, programId: string): boolean =>
  isEditorStaffRole(profile.role) || profile.programId === programId;

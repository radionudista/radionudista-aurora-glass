import { getSupabaseClient } from '../lib/supabaseClient';
import {
  isEditorStaffRole,
  type EditorRole,
} from '../lib/editorRoles';

export type { EditorRole };

export interface EditorProfile {
  userId: string;
  role: EditorRole;
  programId: string | null;
  disabledAt: string | null;
}

type EditorProfileRow = {
  user_id: string;
  role: EditorRole;
  program_id: string | null;
  disabled_at: string | null;
};

export const fetchEditorProfile = async (): Promise<EditorProfile | null> => {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user?.id;
  if (!userId) return null;

  const { data, error } = await supabase
    .from('editor_profiles')
    .select('user_id, role, program_id, disabled_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const row = data as EditorProfileRow;
  if (row.role !== 'admin' && row.role !== 'editor' && row.role !== 'master') return null;

  return {
    userId: row.user_id,
    role: row.role,
    programId: row.program_id,
    disabledAt: row.disabled_at,
  };
};

export const canEditProgram = (
  profile: EditorProfile | null,
  programId: string
): boolean => {
  if (!profile || profile.disabledAt) return false;
  if (isEditorStaffRole(profile.role)) return true;
  return profile.role === 'editor' && profile.programId === programId;
};

export const canEditEditorial = (profile: EditorProfile | null): boolean =>
  Boolean(profile && !profile.disabledAt && isEditorStaffRole(profile.role));

export const canManagePrograms = (profile: EditorProfile | null): boolean =>
  canEditEditorial(profile);

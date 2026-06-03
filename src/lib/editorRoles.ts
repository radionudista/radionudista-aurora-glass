export type EditorRole = 'admin' | 'editor' | 'master';

export const isEditorStaffRole = (role: EditorRole | null | undefined): boolean =>
  role === 'admin' || role === 'master';

export const isEditorMasterRole = (role: EditorRole | null | undefined): boolean => role === 'master';

export const isEditorAdminRole = (role: EditorRole | null | undefined): boolean => role === 'admin';

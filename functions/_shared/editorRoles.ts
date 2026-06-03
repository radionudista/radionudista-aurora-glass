export type EditorRole = 'admin' | 'editor' | 'master';

export const isEditorStaffRole = (role: EditorRole | string): boolean =>
  role === 'admin' || role === 'master';

export const isEditorMasterRole = (role: EditorRole | string): boolean => role === 'master';

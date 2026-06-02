import React from 'react';
import { Navigate } from 'react-router-dom';
import { useTranslation } from '../hooks/useTranslation';
import { useOptionalEditor } from '../contexts/EditorContext';
import { devEditorService, type AdminEditorUser } from '../services/devEditorService';
import { getSupabaseClient } from '../lib/supabaseClient';
import { FormButton, FormContainer, FormField, FormInput } from '../components/ui/FormComponents';
import { env } from '../config/env';

type ProgramOption = { id: string; title: string };

const AdminUsersPage: React.FC = () => {
  const { t } = useTranslation();
  const editor = useOptionalEditor();
  const [users, setUsers] = React.useState<AdminEditorUser[]>([]);
  const [programs, setPrograms] = React.useState<ProgramOption[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const [newEmail, setNewEmail] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [newRole, setNewRole] = React.useState<'admin' | 'editor'>('editor');
  const [newProgramId, setNewProgramId] = React.useState('');

  const loadUsers = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await devEditorService.listAdminUsers();
      setUsers(res.users ?? []);
      setMessage(res.message);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar usuarios.');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (!editor?.isAdmin) return;
    void loadUsers();
  }, [editor?.isAdmin, loadUsers]);

  React.useEffect(() => {
    if (!editor?.isAdmin) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;
    void supabase
      .from('content_items')
      .select('id, content_kind')
      .eq('content_kind', 'program')
      .then(async ({ data, error: itemsError }) => {
        if (itemsError || !data?.length) return;
        const ids = data.map((row) => row.id as string);
        const { data: translations } = await supabase
          .from('content_item_translations')
          .select('content_item_id, title, lang')
          .in('content_item_id', ids)
          .eq('lang', env.DEFAULT_LANGUAGE);
        const titleById = new Map(
          (translations ?? []).map((row) => [String(row.content_item_id), String(row.title)])
        );
        setPrograms(
          ids.map((id) => ({
            id,
            title: titleById.get(id) || id,
          }))
        );
      });
  }, [editor?.isAdmin]);

  if (!editor?.authenticated) {
    return <Navigate to="/editor-login" replace />;
  }

  if (!editor.isAdmin) {
    return <Navigate to={`/${env.DEFAULT_LANGUAGE}`} replace />;
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const res = await devEditorService.createAdminUser({
        email: newEmail.trim(),
        password: newPassword,
        role: newRole,
        programId: newRole === 'editor' ? newProgramId : null,
      });
      setMessage(res.message);
      setNewEmail('');
      setNewPassword('');
      setNewProgramId('');
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el usuario.');
    }
  };

  const handleToggleDisabled = async (user: AdminEditorUser) => {
    setError(null);
    try {
      const res = await devEditorService.updateAdminUser({
        userId: user.userId,
        disabled: !user.disabledAt,
      });
      setMessage(res.message);
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar el usuario.');
    }
  };

  const handleAssignProgram = async (user: AdminEditorUser, programId: string) => {
    setError(null);
    try {
      const res = await devEditorService.updateAdminUser({
        userId: user.userId,
        role: 'editor',
        programId: programId || null,
      });
      setMessage(res.message);
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo asignar el programa.');
    }
  };

  return (
    <div className="min-h-screen bg-black px-4 py-10 text-white md:px-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="font-['Space_Grotesk'] text-2xl font-bold tracking-tight md:text-3xl">
          {t('admin-users.title')}
        </h1>
        <p className="mt-2 font-mono text-xs uppercase tracking-[0.2em] text-white/50">
          {t('admin-users.subtitle')}
        </p>

        {message ? <p className="mt-4 text-sm text-lime-300/90">{message}</p> : null}
        {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}

        <section className="glass-card mt-8 p-6">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/60">
            {t('admin-users.create-title')}
          </h2>
          <FormContainer onSubmit={handleCreate} className="mt-4">
            <FormField label={t('admin-users.email')} required>
              <FormInput
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                disabled={loading}
              />
            </FormField>
            <FormField label={t('admin-users.password')} required>
              <FormInput
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={loading}
              />
            </FormField>
            <FormField label={t('admin-users.role')} required>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as 'admin' | 'editor')}
                className="w-full border border-white/20 bg-black/50 px-3 py-2 text-sm text-white"
              >
                <option value="editor">{t('admin-users.role-editor')}</option>
                <option value="admin">{t('admin-users.role-admin')}</option>
              </select>
            </FormField>
            {newRole === 'editor' ? (
              <FormField label={t('admin-users.program')} required>
                <select
                  value={newProgramId}
                  onChange={(e) => setNewProgramId(e.target.value)}
                  className="w-full border border-white/20 bg-black/50 px-3 py-2 text-sm text-white"
                >
                  <option value="">{t('admin-users.program-placeholder')}</option>
                  {programs.map((program) => (
                    <option key={program.id} value={program.id}>
                      {program.title} ({program.id})
                    </option>
                  ))}
                </select>
              </FormField>
            ) : null}
            <FormButton type="submit" loading={loading}>
              {t('admin-users.create-submit')}
            </FormButton>
          </FormContainer>
        </section>

        <section className="mt-8 overflow-x-auto border border-white/15">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-white/15 bg-white/5 font-mono text-[10px] uppercase tracking-[0.18em] text-white/55">
              <tr>
                <th className="px-4 py-3">{t('admin-users.col-email')}</th>
                <th className="px-4 py-3">{t('admin-users.col-role')}</th>
                <th className="px-4 py-3">{t('admin-users.col-program')}</th>
                <th className="px-4 py-3">{t('admin-users.col-status')}</th>
                <th className="px-4 py-3">{t('admin-users.col-actions')}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.userId} className="border-b border-white/10">
                  <td className="px-4 py-3">{user.email || user.userId}</td>
                  <td className="px-4 py-3 uppercase">{user.role}</td>
                  <td className="px-4 py-3">
                    {user.role === 'editor' ? (
                      <select
                        value={user.programId ?? ''}
                        onChange={(e) => void handleAssignProgram(user, e.target.value)}
                        className="max-w-[12rem] border border-white/20 bg-black/50 px-2 py-1 text-xs"
                      >
                        <option value="">{t('admin-users.program-placeholder')}</option>
                        {programs.map((program) => (
                          <option key={program.id} value={program.id}>
                            {program.id}
                          </option>
                        ))}
                      </select>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {user.disabledAt ? t('admin-users.status-disabled') : t('admin-users.status-active')}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => void handleToggleDisabled(user)}
                      className="border border-white/30 px-2 py-1 font-mono text-[10px] uppercase tracking-wider hover:bg-white/10"
                    >
                      {user.disabledAt
                        ? t('admin-users.action-enable')
                        : t('admin-users.action-disable')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && users.length === 0 ? (
            <p className="px-4 py-6 text-center text-white/50">{t('admin-users.empty')}</p>
          ) : null}
        </section>
      </div>
    </div>
  );
};

export default AdminUsersPage;

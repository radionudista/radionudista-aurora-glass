import React from 'react';
import { Navigate } from 'react-router-dom';
import { useTranslation } from '../hooks/useTranslation';
import { useOptionalEditor } from '../contexts/EditorContext';
import { devEditorService, type AdminEditorUser } from '../services/devEditorService';
import { getSupabaseClient, getSupabaseSession } from '../lib/supabaseClient';
import {
  collectMasterUserIds,
  filterAuditLogsHidingMasters,
  filterEditorUsersForPanel,
} from '../lib/editorUserVisibility';
import { FormButton, FormContainer, FormField, FormInput } from '../components/ui/FormComponents';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { env } from '../config/env';
import { DEFAULT_PROGRAM_LOGO, resolveProgramLogoSrc } from '../utils/programLogo';
import {
  Activity,
  Pencil,
  Power,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { formatActorInitials, formatActorName } from '../utils/auditActivityPresentation';
import { EditorActivityTimeline } from '../components/editor/EditorActivityTimeline';
import type { EditorAuditLogRow } from '../services/devEditorService';

const avatarGradient: Record<string, string> = {
  master: 'border-lime-400/30 text-lime-100',
  admin: 'border-white/18 text-white/85',
  editor: 'border-amber-300/25 text-amber-100/90',
};

type ProgramOption = { id: string; title: string; logo: string | null };

const selectClassName =
  'w-full border border-white/20 bg-black/50 px-3 py-2 text-sm text-white';

const AdminUsersPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const editor = useOptionalEditor();
  const [users, setUsers] = React.useState<AdminEditorUser[]>([]);
  const [programs, setPrograms] = React.useState<ProgramOption[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const [createOpen, setCreateOpen] = React.useState(false);
  const [newEmail, setNewEmail] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [newRole, setNewRole] = React.useState<'admin' | 'editor'>('editor');
  const [newProgramId, setNewProgramId] = React.useState('');

  const [editUser, setEditUser] = React.useState<AdminEditorUser | null>(null);
  const [editRole, setEditRole] = React.useState<'admin' | 'editor'>('editor');
  const [editProgramId, setEditProgramId] = React.useState('');

  const [selectedUserId, setSelectedUserId] = React.useState('');
  const [auditLogs, setAuditLogs] = React.useState<EditorAuditLogRow[]>([]);
  const [auditLoading, setAuditLoading] = React.useState(false);
  const [viewerUserId, setViewerUserId] = React.useState<string | null>(null);

  const programById = React.useMemo(
    () => new Map(programs.map((program) => [program.id, program])),
    [programs]
  );

  const programLabel = React.useCallback(
    (id: string | null | undefined) => {
      if (!id) return '—';
      const match = programById.get(id);
      return match?.title?.trim() || id;
    },
    [programById]
  );

  const userCardBackdrop = React.useCallback(
    (user: AdminEditorUser) => {
      if (user.role === 'master' || user.role === 'admin') {
        return DEFAULT_PROGRAM_LOGO;
      }
      if (user.programId) {
        return resolveProgramLogoSrc(programById.get(user.programId)?.logo);
      }
      return DEFAULT_PROGRAM_LOGO;
    },
    [programById]
  );

  const userProgramLine = React.useCallback(
    (user: AdminEditorUser) => {
      if (user.programId) return programLabel(user.programId);
      if (user.role === 'master') return t('admin-users.master-scope');
      if (user.role === 'admin') return t('admin-users.staff-scope');
      return '—';
    },
    [programLabel, t]
  );

  const roleBadge = (role: string) => {
    const key = String(role || '')
      .trim()
      .toLowerCase();
    const styles: Record<string, string> = {
      master: 'border-lime-400/55 bg-lime-400/10 text-lime-100',
      admin: 'border-white/20 text-white/70',
      editor: 'border-amber-300/25 text-amber-100/80',
    };
    const labels: Record<string, string> = {
      master: t('admin-users.role-master'),
      admin: t('admin-users.role-admin-short'),
      editor: t('admin-users.role-editor-short'),
    };
    const className = styles[key] ?? 'border-white/20 text-white/60';
    const label = labels[key] ?? role;
    return (
      <span
        className={`inline-flex shrink-0 items-center border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] ${className}`}
      >
        {label}
      </span>
    );
  };

  const viewer = React.useMemo(
    () => ({
      userId: viewerUserId,
      isMaster: Boolean(editor?.isMaster),
    }),
    [viewerUserId, editor?.isMaster]
  );

  const loadUsers = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await devEditorService.listAdminUsers();
      let list = filterEditorUsersForPanel(res.users ?? [], viewer);
      const roleOrder: Record<string, number> = { master: 0, admin: 1, editor: 2 };
      list.sort(
        (a, b) =>
          (roleOrder[String(a.role).toLowerCase()] ?? 9) -
            (roleOrder[String(b.role).toLowerCase()] ?? 9) ||
          (a.email || '').localeCompare(b.email || '', undefined, { sensitivity: 'base' })
      );
      setUsers(list);
      setSelectedUserId((prev) =>
        prev && list.some((user) => user.userId === prev) ? prev : ''
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar usuarios.');
    } finally {
      setLoading(false);
    }
  }, [viewer]);

  const loadAuditLogs = React.useCallback(async () => {
    if (!editor?.isAdmin) return;
    setAuditLoading(true);
    try {
      const res = await devEditorService.listAdminAuditLogs({
        userId: selectedUserId || undefined,
        limit: 150,
      });
      const masterIds = collectMasterUserIds(users);
      setAuditLogs(filterAuditLogsHidingMasters(res.logs ?? [], masterIds, viewer));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar actividad.');
      setAuditLogs([]);
    } finally {
      setAuditLoading(false);
    }
  }, [editor?.isAdmin, selectedUserId, users, viewer]);

  React.useEffect(() => {
    if (!editor?.isAdmin) return;
    void getSupabaseSession().then((session) => {
      setViewerUserId(session?.user?.id ?? null);
    });
  }, [editor?.isAdmin]);

  React.useEffect(() => {
    if (!editor?.isAdmin || !viewerUserId) return;
    void loadUsers();
  }, [editor?.isAdmin, viewerUserId, loadUsers]);

  React.useEffect(() => {
    if (!editor?.isAdmin) return;
    void loadAuditLogs();
  }, [editor?.isAdmin, loadAuditLogs]);

  React.useEffect(() => {
    if (!editor?.isAdmin) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;
    void supabase
      .from('content_items')
      .select('id, content_kind, logo_url')
      .eq('content_kind', 'program')
      .then(async ({ data, error: itemsError }) => {
        if (itemsError || !data?.length) return;
        const rows = data as Array<{ id: string; logo_url: string | null }>;
        const ids = rows.map((row) => row.id);
        const logoById = new Map(rows.map((row) => [row.id, row.logo_url]));
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
            logo: logoById.get(id) ?? null,
          }))
        );
      });
  }, [editor?.isAdmin]);

  const selectedUser = users.find((u) => u.userId === selectedUserId);

  const openEdit = (user: AdminEditorUser, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditUser(user);
    setEditRole(user.role === 'admin' || user.role === 'master' ? 'admin' : 'editor');
    setEditProgramId(user.programId ?? '');
    setError(null);
  };

  const closeEdit = () => {
    setEditUser(null);
    setEditProgramId('');
  };

  if (!editor) {
    return null;
  }

  if (editor.authInitializing || editor.profileLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white/60">
        <p className="font-mono text-xs uppercase tracking-[0.2em]">{t('common.loading')}</p>
      </div>
    );
  }

  if (!editor.authenticated) {
    return <Navigate to="/editor-login" state={{ from: '/admin/usuarios' }} replace />;
  }

  if (!editor.isAdmin) {
    return <Navigate to={`/${env.DEFAULT_LANGUAGE}`} replace />;
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
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
      setCreateOpen(false);
      await loadUsers();
      if (editor.isAdmin) await loadAuditLogs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el usuario.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUser) return;
    if (editRole === 'editor' && !editProgramId) {
      setError(t('admin-users.error-program-required'));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await devEditorService.updateAdminUser({
        userId: editUser.userId,
        role: editRole,
        programId: editRole === 'editor' ? editProgramId : null,
      });
      setMessage(res.message);
      closeEdit();
      await loadUsers();
      if (editor.isAdmin) await loadAuditLogs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar el usuario.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleDisabled = async (user: AdminEditorUser, e: React.MouseEvent) => {
    e.stopPropagation();
    setSaving(true);
    setError(null);
    try {
      const res = await devEditorService.updateAdminUser({
        userId: user.userId,
        disabled: !user.disabledAt,
      });
      setMessage(res.message);
      await loadUsers();
      if (editor.isAdmin) await loadAuditLogs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar el usuario.');
    } finally {
      setSaving(false);
    }
  };

  const programSelect = (
    value: string,
    onChange: (id: string) => void,
    required?: boolean
  ) => (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={selectClassName} required={required}>
      <option value="">{t('admin-users.program-placeholder')}</option>
      {programs.map((program) => (
        <option key={program.id} value={program.id}>
          {program.title}
        </option>
      ))}
    </select>
  );

  const roleSelect = (value: 'admin' | 'editor', onChange: (role: 'admin' | 'editor') => void) => (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as 'admin' | 'editor')}
      className={selectClassName}
    >
      <option value="editor">{t('admin-users.role-editor')}</option>
      <option value="admin">{t('admin-users.role-admin')}</option>
    </select>
  );

  const isDashboard = editor.isAdmin;

  const panelShell = 'border border-white/12 bg-black/95';

  return (
    <div className="relative min-h-screen overflow-hidden bg-black px-4 py-8 text-white md:px-8 lg:py-10">
      <div className={`relative ${isDashboard ? 'mx-auto w-full max-w-[1680px]' : 'mx-auto max-w-3xl'}`}>
        <header className="flex flex-wrap items-end justify-between gap-5 border-b border-white/10 pb-6">
          <div>
            <p className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-white/35">
              <Users className="h-3.5 w-3.5" aria-hidden />
              Admin
            </p>
            <h1 className="font-['Space_Grotesk'] text-2xl font-bold tracking-tight md:text-3xl">
              {t('admin-users.title')}
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/50">{t('admin-users.subtitle')}</p>
          </div>
          {editor.isMaster ? (
            <button
              type="button"
              onClick={() => {
                setError(null);
                setCreateOpen(true);
              }}
              className="inline-flex shrink-0 items-center gap-2 border border-lime-400/45 bg-black px-4 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-lime-300 transition hover:bg-lime-400/10"
            >
              <UserPlus className="h-4 w-4" aria-hidden />
              {t('admin-users.create-button')}
            </button>
          ) : null}
        </header>

        {message ? (
          <p className="mb-4 border border-lime-400/20 bg-black px-4 py-2.5 text-sm text-lime-200/90">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="mb-4 border border-red-400/25 bg-black px-4 py-2.5 text-sm text-red-200">
            {error}
          </p>
        ) : null}

        <div
          className={
            isDashboard
              ? 'mt-6 grid gap-5 lg:grid-cols-[minmax(320px,390px)_minmax(0,1fr)] lg:items-stretch xl:gap-6'
              : 'grid gap-5'
          }
        >
          <section
            className={`flex min-h-0 flex-col lg:min-h-[calc(100vh-12rem)] ${panelShell}`}
          >
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3.5">
              <h2 className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-white/55">
                <Users className="h-4 w-4 text-white/50" aria-hidden />
                {t('admin-users.panel-users')}
              </h2>
              <span className="border border-white/15 px-2 py-0.5 font-mono text-[10px] tabular-nums text-white/45">
                {users.length}
              </span>
            </div>
            <div className="scrollbar-minimal flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3 pr-2">
              {loading ? (
                <p className="py-8 text-center text-sm text-white/45">{t('common.loading')}</p>
              ) : null}
              {!loading && users.length === 0 ? (
                <p className="rounded-xl border border-dashed border-white/10 py-10 text-center text-sm text-white/45">
                  {t('admin-users.empty')}
                </p>
              ) : null}
              {users.map((user) => {
                const isSelected = isDashboard && selectedUserId === user.userId;
                const displayEmail = user.email || user.userId;
                const roleKey = String(user.role || '')
                  .trim()
                  .toLowerCase();
                const isMasterAccount = roleKey === 'master';
                const avatarStyle = avatarGradient[roleKey] ?? 'border-white/15 text-white/70';
                const backdropSrc = userCardBackdrop(user);
                const staffCard = roleKey === 'master' || roleKey === 'admin';
                const selectUserForActivity = () =>
                  setSelectedUserId(isSelected ? '' : user.userId);

                return (
                  <article
                    key={user.userId}
                    className={`relative shrink-0 overflow-hidden border bg-white/[0.07] transition-colors duration-200 ${
                      isSelected
                        ? 'border-lime-400/40 bg-white/[0.1]'
                        : isMasterAccount
                          ? 'border-lime-400/25 hover:border-lime-400/40'
                          : 'border-white/15 hover:border-white/25'
                    }`}
                  >
                    <div
                      className={`pointer-events-none absolute inset-0 bg-center bg-no-repeat transition-opacity duration-200 ${
                        staffCard
                          ? 'bg-[length:min(78%,12rem)] opacity-[0.28] brightness-0 invert'
                          : 'bg-cover opacity-[0.28]'
                      } ${isSelected ? (staffCard ? 'opacity-[0.34]' : 'opacity-[0.32]') : ''} ${
                        user.disabledAt ? 'grayscale' : ''
                      }`}
                      style={{ backgroundImage: `url(${backdropSrc})` }}
                      aria-hidden
                    />
                    <div
                      className={`pointer-events-none absolute inset-0 ${
                        staffCard
                          ? 'bg-[linear-gradient(to_bottom,rgba(0,0,0,0.28)_0%,rgba(0,0,0,0.42)_55%,rgba(0,0,0,0.58)_100%)]'
                          : 'bg-[linear-gradient(to_bottom,rgba(0,0,0,0.32)_0%,rgba(0,0,0,0.48)_50%,rgba(0,0,0,0.62)_100%)]'
                      }`}
                      aria-hidden
                    />
                    <div className="relative z-10 flex flex-col p-3.5">
                      <div
                        className={isDashboard ? 'cursor-pointer rounded-sm outline-none focus-visible:ring-1 focus-visible:ring-lime-400/50' : ''}
                        role={isDashboard ? 'button' : undefined}
                        tabIndex={isDashboard ? 0 : undefined}
                        onClick={isDashboard ? selectUserForActivity : undefined}
                        onKeyDown={
                          isDashboard
                            ? (e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  selectUserForActivity();
                                }
                              }
                            : undefined
                        }
                      >
                      <div className="flex items-start gap-3">
                        <span
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-black/70 font-mono text-xs font-semibold ${
                            user.disabledAt ? 'opacity-45 grayscale' : ''
                          } ${avatarStyle}`}
                          aria-hidden
                        >
                          {formatActorInitials(displayEmail)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="truncate text-sm font-medium leading-tight text-white">
                              {formatActorName(displayEmail)}
                            </p>
                            {roleBadge(roleKey)}
                          </div>
                          <p className="mt-0.5 truncate text-xs text-white/55">{displayEmail}</p>
                          <p className="mt-2 truncate text-xs text-white/70">
                            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/35">
                              {t('admin-users.col-program')}:{' '}
                            </span>
                            {userProgramLine(user)}
                          </p>
                          <p className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] text-white/55">
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                user.disabledAt ? 'bg-white/30' : 'bg-lime-300/80'
                              }`}
                              aria-hidden
                            />
                            {user.disabledAt
                              ? t('admin-users.status-disabled')
                              : t('admin-users.status-active')}
                          </p>
                        </div>
                      </div>
                      </div>

                      {!isMasterAccount ? (
                        <div className="relative z-20 mt-3 shrink-0 border-t border-white/10 pt-3">
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={(e) => openEdit(user, e)}
                              disabled={saving}
                              className="inline-flex min-h-10 items-center justify-center gap-1.5 border border-white/25 bg-transparent px-2 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-white/90 transition hover:border-white/40 hover:bg-white/[0.05] disabled:opacity-50"
                            >
                              <Pencil className="h-3.5 w-3.5 shrink-0" aria-hidden />
                              {t('admin-users.action-edit')}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => void handleToggleDisabled(user, e)}
                              disabled={saving}
                              className="inline-flex min-h-10 items-center justify-center gap-1.5 border border-white/25 bg-transparent px-2 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-white/90 transition hover:border-white/40 hover:bg-white/[0.05] disabled:opacity-50"
                            >
                              <Power className="h-3.5 w-3.5 shrink-0" aria-hidden />
                              {user.disabledAt
                                ? t('admin-users.action-enable')
                                : t('admin-users.action-disable')}
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          {isDashboard ? (
            <section className={`flex min-h-0 flex-col lg:min-h-[calc(100vh-12rem)] ${panelShell}`}>
              <div className="border-b border-white/10 px-4 py-3.5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-white/55">
                    <Activity className="h-4 w-4 text-white/50" aria-hidden />
                    {t('admin-users.panel-activity')}
                  </h2>
                  {!auditLoading ? (
                    <span className="border border-white/15 px-2 py-0.5 font-mono text-[10px] tabular-nums text-white/45">
                      {auditLogs.length}
                    </span>
                  ) : null}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedUserId('')}
                    className={`border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] transition ${
                      !selectedUserId
                        ? 'border-white/35 bg-white/[0.04] text-white/80'
                        : 'border-white/12 bg-black text-white/45 hover:border-white/25 hover:text-white/70'
                    }`}
                  >
                    {t('admin-users.activity-all')}
                  </button>
                  {selectedUser ? (
                    <span className="inline-flex items-center gap-1 border border-lime-400/25 py-1 pl-3 pr-1 font-mono text-[10px] uppercase tracking-[0.12em] text-lime-200/80">
                      {formatActorName(selectedUser.email || selectedUser.userId)}
                      <button
                        type="button"
                        onClick={() => setSelectedUserId('')}
                        className="p-0.5 hover:bg-lime-400/10"
                        aria-label={t('admin-users.activity-clear-filter')}
                      >
                        <X className="h-3 w-3" aria-hidden />
                      </button>
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="scrollbar-minimal min-h-0 flex-1 overflow-y-auto p-3 pr-2">
                <EditorActivityTimeline
                  logs={auditLogs}
                  loading={auditLoading}
                  programLabel={(id) => programLabel(id)}
                  showActor={!selectedUserId}
                  emptyTitle={t('admin-users.activity-empty')}
                  emptyHint={!selectedUserId ? t('admin-users.activity-hint') : undefined}
                  loadingLabel={t('common.loading')}
                  t={(key, opts) => t(key, opts)}
                  i18n={i18n}
                />
              </div>
            </section>
          ) : null}
        </div>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="border border-white/25 bg-[#0a0a0a] text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-['Space_Grotesk'] text-xl">{t('admin-users.create-title')}</DialogTitle>
          </DialogHeader>
          <FormContainer onSubmit={handleCreate} className="mt-2">
            <FormField label={t('admin-users.email')} required>
              <FormInput
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                disabled={saving}
              />
            </FormField>
            <FormField label={t('admin-users.password')} required>
              <FormInput
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={saving}
              />
            </FormField>
            <FormField label={t('admin-users.role')} required>
              {roleSelect(newRole, setNewRole)}
            </FormField>
            {newRole === 'editor' ? (
              <FormField label={t('admin-users.program')} required>
                {programSelect(newProgramId, setNewProgramId, true)}
              </FormField>
            ) : null}
            <DialogFooter className="mt-4 gap-2 sm:justify-end">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="border border-white/25 px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-white/70 hover:bg-white/5"
              >
                {t('admin-users.cancel')}
              </button>
              <FormButton type="submit" loading={saving}>
                {t('admin-users.create-submit')}
              </FormButton>
            </DialogFooter>
          </FormContainer>
        </DialogContent>
      </Dialog>

      <Dialog open={editUser != null} onOpenChange={(open) => !open && closeEdit()}>
        <DialogContent className="border border-white/25 bg-[#0a0a0a] text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-['Space_Grotesk'] text-xl">{t('admin-users.edit-title')}</DialogTitle>
          </DialogHeader>
          {editUser ? (
            <FormContainer onSubmit={handleSaveEdit} className="mt-2">
              <FormField label={t('admin-users.email')}>
                <p className="text-sm text-white/80">{editUser.email || editUser.userId}</p>
              </FormField>
              <FormField label={t('admin-users.role')} required>
                {roleSelect(editRole, setEditRole)}
              </FormField>
              {editRole === 'editor' ? (
                <FormField label={t('admin-users.program')} required>
                  {programSelect(editProgramId, setEditProgramId, true)}
                </FormField>
              ) : (
                <p className="text-xs text-white/50">{t('admin-users.admin-no-program-hint')}</p>
              )}
              <DialogFooter className="mt-4 gap-2 sm:justify-end">
                <button
                  type="button"
                  onClick={closeEdit}
                  className="border border-white/25 px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-white/70 hover:bg-white/5"
                >
                  {t('admin-users.cancel')}
                </button>
                <FormButton type="submit" loading={saving}>
                  {t('admin-users.save-changes')}
                </FormButton>
              </DialogFooter>
            </FormContainer>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminUsersPage;

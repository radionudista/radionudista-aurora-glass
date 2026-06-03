import React from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { Activity, ArrowLeft } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';
import { useRouteLanguage } from '../hooks/useRouteLanguage';
import { useOptionalEditor } from '../contexts/EditorContext';
import { useContentIndexData } from '../hooks/useEditorContent';
import { mapRouteToContentIndexLanguage, resolveContentIndexEntry } from '../utils/contentLanguage';
import { devEditorService, type EditorAuditLogRow } from '../services/devEditorService';
import { EditorActivityTimeline } from '../components/editor/EditorActivityTimeline';
import { PAGE_SCREEN_TITLE_CLASS } from '../constants/layoutConstants';
import { resolveProgramLogoSrc } from '../utils/programLogo';

const panelShell =
  'border border-white/10 bg-black/40 backdrop-blur-sm';

const EditorProgramActivityPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const routeLang = useRouteLanguage();
  const { programId: urlProgramId } = useParams<{ programId: string }>();
  const editor = useOptionalEditor();
  const { data: contentIndex } = useContentIndexData();
  const contentLang = mapRouteToContentIndexLanguage(routeLang);

  const [logs, setLogs] = React.useState<EditorAuditLogRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const assignedProgramId = editor?.assignedProgramId?.trim() || '';
  const programId = assignedProgramId;

  const programTitle = React.useMemo(() => {
    if (!programId) return '';
    const localized = contentIndex?.[programId] ?? editor?.contentIndex?.[programId];
    const entry = resolveContentIndexEntry<{ title?: string; logo?: string }>(localized, contentLang);
    return entry?.title?.trim() || programId;
  }, [contentIndex, contentLang, editor?.contentIndex, programId]);

  const programLogo = React.useMemo(() => {
    if (!programId) return null;
    const localized = contentIndex?.[programId] ?? editor?.contentIndex?.[programId];
    const entry = resolveContentIndexEntry<{ logo?: string }>(localized, contentLang);
    return entry?.logo ? resolveProgramLogoSrc(entry.logo) : null;
  }, [contentIndex, contentLang, editor?.contentIndex, programId]);

  const programLabel = React.useCallback(
    (id: string) => {
      if (id === programId) return programTitle || id;
      const localized = contentIndex?.[id] ?? editor?.contentIndex?.[id];
      const entry = resolveContentIndexEntry<{ title?: string }>(localized, contentLang);
      return entry?.title?.trim() || id;
    },
    [contentIndex, contentLang, editor?.contentIndex, programId, programTitle]
  );

  const loadLogs = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await devEditorService.listProgramAuditLogs();
      if (!res.ok) {
        setError(res.message || t('program-activity.load-error'));
        setLogs([]);
        return;
      }
      setLogs(Array.isArray(res.logs) ? res.logs : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('program-activity.load-error'));
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  React.useEffect(() => {
    if (!editor?.enabled || editor.role !== 'editor' || !assignedProgramId) return;
    void loadLogs();
  }, [assignedProgramId, editor?.enabled, editor?.role, loadLogs]);

  if (editor?.authInitializing || editor?.profileLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-white/50">{t('common.loading')}</p>
      </div>
    );
  }

  if (!editor?.enabled) {
    return <Navigate to="/editor-login" state={{ from: window.location.pathname }} replace />;
  }

  if (editor.role !== 'editor' || !assignedProgramId) {
    return <Navigate to={`/${routeLang}`} replace />;
  }

  if (urlProgramId && urlProgramId !== assignedProgramId) {
    return (
      <Navigate to={`/${routeLang}/programacion/${assignedProgramId}/actividad`} replace />
    );
  }

  const programPath = `/${routeLang}/programacion/${assignedProgramId}`;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <Link
        to={programPath}
        className="mb-6 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-white/50 transition hover:text-white/80"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
        {t('program-activity.back-to-program')}
      </Link>

      <header className="relative mb-8 overflow-hidden border border-white/10 bg-black/50">
        {programLogo ? (
          <div
            className="pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat opacity-[0.24]"
            style={{ backgroundImage: `url(${programLogo})` }}
            aria-hidden
          />
        ) : null}
        <div
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.6)_0%,rgba(0,0,0,0.78)_55%,rgba(0,0,0,0.92)_100%)]"
          aria-hidden
        />
        <div className="relative z-10 px-5 py-8 sm:px-8 sm:py-10">
          <h1 className={`${PAGE_SCREEN_TITLE_CLASS} text-white`}>{programTitle}</h1>
          <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.2em] text-amber-200/80">
            {t('program-activity.subtitle')}
          </p>
        </div>
      </header>

      {error ? (
        <p className="mb-4 text-sm text-red-300/90" role="alert">
          {error}
        </p>
      ) : null}

      <section className={panelShell}>
        <div className="border-b border-white/10 px-4 py-3.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-white/55">
              <Activity className="h-4 w-4 text-white/50" aria-hidden />
              {t('program-activity.panel-title')}
            </h2>
            {!loading ? (
              <span className="border border-white/15 px-2 py-0.5 font-mono text-[10px] tabular-nums text-white/45">
                {logs.length}
              </span>
            ) : null}
          </div>
        </div>

        <div className="scrollbar-minimal max-h-[min(70vh,640px)] overflow-y-auto p-3 pr-2">
          <EditorActivityTimeline
            logs={logs}
            loading={loading}
            programLabel={programLabel}
            showActor
            emptyTitle={t('program-activity.empty')}
            emptyHint={t('program-activity.hint')}
            loadingLabel={t('common.loading')}
            t={(key, opts) => t(key, opts)}
            i18n={i18n}
          />
        </div>
      </section>
    </div>
  );
};

export default EditorProgramActivityPage;

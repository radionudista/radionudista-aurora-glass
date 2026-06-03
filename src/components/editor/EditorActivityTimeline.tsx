import React from 'react';
import {
  Activity,
  FileText,
  ImageIcon,
  LogIn,
  LogOut,
  Radio,
  Shield,
  Sparkles,
} from 'lucide-react';
import type { i18n as I18nInstance } from 'i18next';
import type { EditorAuditLogRow } from '../../services/devEditorService';
import {
  formatActorName,
  formatRelativeTime,
  getAuditPresentation,
  toneIconClass,
  type AuditPresentation,
} from '../../utils/auditActivityPresentation';

const AuditIcon: React.FC<{ action: string; tone: AuditPresentation['tone'] }> = ({ action, tone }) => {
  const cls = 'h-4 w-4';
  if (action === 'auth.login') return <LogIn className={cls} aria-hidden />;
  if (action === 'auth.logout') return <LogOut className={cls} aria-hidden />;
  if (action.startsWith('admin.')) return <Shield className={cls} aria-hidden />;
  if (action.includes('media') || action.includes('hero') || action.includes('logo') || action.includes('cover')) {
    return <ImageIcon className={cls} aria-hidden />;
  }
  if (action.includes('episode') || action.includes('program')) return <Radio className={cls} aria-hidden />;
  if (action.includes('editorial') || action.includes('about') || action.includes('content')) {
    return <FileText className={cls} aria-hidden />;
  }
  if (tone === 'auth') return <LogIn className={cls} aria-hidden />;
  if (tone === 'admin') return <Shield className={cls} aria-hidden />;
  if (tone === 'media') return <ImageIcon className={cls} aria-hidden />;
  return <Sparkles className={cls} aria-hidden />;
};

export type EditorActivityTimelineProps = {
  logs: EditorAuditLogRow[];
  loading: boolean;
  programLabel: (id: string) => string;
  showActor: boolean;
  emptyTitle: string;
  emptyHint?: string;
  loadingLabel: string;
  t: (key: string, options?: Record<string, unknown>) => string;
  i18n: I18nInstance;
  className?: string;
};

export const EditorActivityTimeline: React.FC<EditorActivityTimelineProps> = ({
  logs,
  loading,
  programLabel,
  showActor,
  emptyTitle,
  emptyHint,
  loadingLabel,
  t,
  i18n,
  className = '',
}) => {
  if (loading) {
    return (
      <div className={`flex h-48 items-center justify-center ${className}`}>
        <p className="text-sm text-white/45">{loadingLabel}</p>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className={`flex h-48 flex-col items-center justify-center px-6 text-center ${className}`}>
        <Activity className="mb-3 h-8 w-8 text-white/20" aria-hidden />
        <p className="text-sm text-white/50">{emptyTitle}</p>
        {emptyHint ? (
          <p className="mt-2 max-w-xs text-xs leading-relaxed text-white/35">{emptyHint}</p>
        ) : null}
      </div>
    );
  }

  return (
    <ul className={`flex flex-col ${className}`}>
      {logs.map((log) => {
        const presentation = getAuditPresentation(log, {
          programLabel,
          t: (key, opts) => t(key, opts),
        });
        const actor = formatActorName(log.actorEmail);
        const iconRing = toneIconClass[presentation.tone];
        return (
          <li
            key={log.id}
            className="flex gap-3 border-b border-white/8 px-2 py-3 transition last:border-b-0 hover:bg-white/[0.025]"
          >
            <div
              className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-1 ring-inset ${iconRing}`}
            >
              <AuditIcon action={log.action} tone={presentation.tone} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium leading-snug text-white/90">{presentation.headline}</p>
                <time
                  className="shrink-0 whitespace-nowrap font-mono text-[10px] tabular-nums uppercase tracking-[0.08em] text-white/35"
                  dateTime={log.createdAt}
                  title={new Date(log.createdAt).toLocaleString(i18n.language)}
                >
                  {formatRelativeTime(log.createdAt, i18n.language)}
                </time>
              </div>
              {showActor || presentation.detail ? (
                <p className="mt-1 font-mono text-[11px] text-white/35">
                  {showActor ? <span className="text-white/50">{actor}</span> : null}
                  {showActor && presentation.detail ? <span className="text-white/25"> · </span> : null}
                  {presentation.detail ? <span>{presentation.detail}</span> : null}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
};

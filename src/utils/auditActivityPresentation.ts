export type AuditLogLike = {
  action: string;
  targetType: string | null;
  targetId: string | null;
  summary: string | null;
  metadata: Record<string, unknown>;
  actorEmail: string | null;
};

export type AuditPresentation = {
  headline: string;
  detail?: string;
  tone: 'auth' | 'admin' | 'content' | 'media' | 'neutral';
};

type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

const FIELD_I18N: Record<string, string> = {
  date: 'activity-field-date',
  title: 'activity-field-title',
  description: 'activity-field-description',
  duration: 'activity-field-duration',
  audioUrl: 'activity-field-audio',
  tags: 'activity-field-tags',
  schedule: 'activity-field-schedule',
};

const ACTION_I18N: Record<string, string> = {
  'auth.login': 'activity-auth-login',
  'auth.logout': 'activity-auth-logout',
  'admin.user.create': 'activity-admin-create',
  'admin.user.update': 'activity-admin-update',
  'editor.content.update': 'activity-content-update',
  'editor.episode.create': 'activity-episode-create',
  'editor.episode.update': 'activity-episode-update',
  'editor.episode.trash': 'activity-episode-trash',
  'editor.episode.restore': 'activity-episode-restore',
  'editor.episode.purge': 'activity-episode-purge',
  'editor.editorial.update': 'activity-editorial-update',
  'editor.about.update': 'activity-about-update',
  'editor.home.hero': 'activity-home-hero',
  'editor.home.hero_upload': 'activity-home-hero-upload',
  'editor.media.program_logo': 'activity-program-logo',
  'editor.media.episode_cover': 'activity-episode-cover',
  'editor.program.create': 'activity-program-create',
  'editor.program.delete': 'activity-program-delete',
  'editor.publish': 'activity-publish',
  'editor.translate': 'activity-translate',
  'editor.audio.prepare_upload': 'activity-audio-upload',
};

const looksTechnical = (text: string) =>
  /editor\.|auth\.|admin\.|eq\.|metadata|uuid|[a-f0-9]{8}-[a-f0-9]{4}-/i.test(text) ||
  /\b[a-z]+-\d{10,}\b/.test(text);

const parseProgramEpisode = (targetId: string | null): { programId?: string; episodeId?: string } => {
  if (!targetId) return {};
  const slash = targetId.indexOf('/');
  if (slash > 0) {
    return { programId: targetId.slice(0, slash), episodeId: targetId.slice(slash + 1) };
  }
  return { programId: targetId };
};

const au = (t: TranslateFn, key: string, options?: Record<string, unknown>) =>
  t(`admin-users.${key}`, options);

const programName = (id: string | undefined, label: (id: string) => string, t: TranslateFn) => {
  if (!id) return '';
  const name = label(id);
  return name !== id ? name : au(t, 'activity-program-unknown');
};

export const formatActorName = (email: string | null): string => {
  if (!email) return '—';
  const local = email.split('@')[0] ?? email;
  return local.replace(/[._-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};

export const formatActorInitials = (email: string | null): string => {
  const name = formatActorName(email);
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase() || '?';
};

export const formatRelativeTime = (iso: string, locale?: string): string => {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.round((then - now) / 1000);
  const abs = Math.abs(diffSec);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  if (abs < 60) return rtf.format(diffSec, 'second');
  const diffMin = Math.round(diffSec / 60);
  if (Math.abs(diffMin) < 60) return rtf.format(diffMin, 'minute');
  const diffHour = Math.round(diffMin / 60);
  if (Math.abs(diffHour) < 24) return rtf.format(diffHour, 'hour');
  const diffDay = Math.round(diffHour / 24);
  if (Math.abs(diffDay) < 7) return rtf.format(diffDay, 'day');
  try {
    return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(
      new Date(iso)
    );
  } catch {
    return iso;
  }
};

export const getAuditPresentation = (
  log: AuditLogLike,
  opts: { programLabel: (id: string) => string; t: TranslateFn }
): AuditPresentation => {
  const { programLabel, t } = opts;
  const meta = log.metadata ?? {};
  const programId =
    (typeof meta.programId === 'string' ? meta.programId : undefined) ??
    parseProgramEpisode(log.targetId).programId;
  const program = programName(programId, programLabel, t);
  const fieldKey = typeof meta.field === 'string' ? meta.field : undefined;
  const fieldLabel = fieldKey ? au(t, FIELD_I18N[fieldKey] ?? 'activity-field-generic') : undefined;

  if (log.action === 'editor.episode.update') {
    let headline: string;
    if (fieldLabel && program) {
      headline = au(t, 'activity-episode-update-program', { field: fieldLabel, program });
    } else if (fieldLabel) {
      headline = au(t, 'activity-episode-update', { field: fieldLabel });
    } else {
      headline = au(t, 'activity-episode-update-generic');
    }
    return { headline, detail: program && !fieldLabel ? program : undefined, tone: 'content' };
  }

  const i18nKey = ACTION_I18N[log.action];
  if (i18nKey) {
    const headline = au(t, i18nKey, {
      program: program || undefined,
      field: fieldLabel,
      email: typeof meta.email === 'string' ? meta.email : undefined,
    });
    const tone: AuditPresentation['tone'] = log.action.startsWith('auth.')
      ? 'auth'
      : log.action.startsWith('admin.')
        ? 'admin'
        : log.action.includes('media')
          ? 'media'
          : 'content';
    let detail: string | undefined;
    if (log.action === 'admin.user.create' && typeof meta.email === 'string') {
      detail = meta.email;
    } else if (program) {
      detail = program;
    }
    return { headline, detail, tone };
  }

  const rawSummary = log.summary?.trim();
  if (rawSummary && !looksTechnical(rawSummary)) {
    return {
      headline: rawSummary,
      detail: program || undefined,
      tone: 'neutral',
    };
  }

  return {
    headline: au(t, 'activity-generic'),
    detail: program || undefined,
    tone: 'neutral',
  };
};

export const toneIconClass: Record<AuditPresentation['tone'], string> = {
  auth: 'bg-white/[0.03] text-white/60 ring-white/12',
  admin: 'bg-white/[0.03] text-white/65 ring-white/12',
  content: 'bg-white/[0.03] text-lime-200/75 ring-white/12',
  media: 'bg-white/[0.03] text-white/65 ring-white/12',
  neutral: 'bg-white/[0.03] text-white/55 ring-white/12',
};

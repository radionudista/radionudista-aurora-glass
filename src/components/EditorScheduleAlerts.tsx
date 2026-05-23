import React from 'react';
import { useSchedule } from '../hooks/useSchedule';
import { useContentIndexData } from '../hooks/useEditorContent';
import {
  detectScheduleAnomalies,
  isProgramScheduleMeta,
  type ProgramScheduleMeta,
} from '../utils/programSchedule';

const STORAGE_KEY = 'editor-schedule-exceptions-v1';

const loadAlwaysIgnored = (): Set<string> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const arr = raw ? (JSON.parse(raw) as string[]) : [];
    return new Set(arr);
  } catch {
    return new Set();
  }
};

const saveAlwaysIgnored = (set: Set<string>) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(set)));
};

const EditorScheduleAlerts: React.FC = () => {
  const { events, isLoading, isError } = useSchedule();
  const contentIndex = useContentIndexData();
  const [alwaysIgnored, setAlwaysIgnored] = React.useState<Set<string>>(() => loadAlwaysIgnored());
  const [sessionIgnored, setSessionIgnored] = React.useState<Set<string>>(new Set());
  const [open, setOpen] = React.useState(true);

  const { anomalies, alwaysIgnoredCount } = React.useMemo(() => {
    const expectedByProgram: Record<string, ProgramScheduleMeta> = {};
    const titleToProgramId: Record<string, string> = {};

    Object.entries(contentIndex).forEach(([id, entry]) => {
      const es = entry.es as Record<string, unknown> | undefined;
      const pt = entry.pt as Record<string, unknown> | undefined;
      const source = es || pt;
      if (!source || source.component !== 'ProgramPage') return;
      const meta = source.schedule_meta;
      if (isProgramScheduleMeta(meta)) expectedByProgram[id.toLowerCase()] = meta;
      const title = String((source.title || '')).toLowerCase().trim();
      if (title) titleToProgramId[title] = id.toLowerCase();
    });

    const all = detectScheduleAnomalies({ events, expectedByProgram, titleToProgramId });
    const filtered = all.filter((a) => !alwaysIgnored.has(a.key) && !sessionIgnored.has(a.key));
    return { anomalies: filtered, alwaysIgnoredCount: alwaysIgnored.size };
  }, [contentIndex, events, alwaysIgnored, sessionIgnored]);

  React.useEffect(() => {
    if (!isLoading && !isError && anomalies.length > 0) setOpen(true);
  }, [isLoading, isError, anomalies.length]);

  if (isLoading || isError || anomalies.length === 0 || !open) return null;

  const onOmit = (key: string) => {
    const always = window.confirm('Quieres omitir esto siempre?');
    if (always) {
      setAlwaysIgnored((prev) => {
        const next = new Set(prev);
        next.add(key);
        saveAlwaysIgnored(next);
        return next;
      });
      return;
    }
    setSessionIgnored((prev) => new Set(prev).add(key));
  };

  return (
    <div className="mt-2 border border-amber-400/50 bg-black/95 p-3 text-xs text-amber-200">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="uppercase tracking-widest">Alertas de horario ({anomalies.length})</p>
        <button type="button" onClick={() => setOpen(false)} className="text-white/70 hover:text-white">
          cerrar
        </button>
      </div>
      <div className="space-y-2">
        {anomalies.slice(0, 6).map((a) => (
          <div key={a.key} className="flex items-center justify-between gap-2 border border-white/15 p-2">
            <span>{a.message}</span>
            <button
              type="button"
              onClick={() => onOmit(a.key)}
              className="border border-white/30 px-2 py-1 text-[10px] uppercase tracking-wide text-white/80 hover:bg-white/10"
            >
              Omitir
            </button>
          </div>
        ))}
      </div>
      {alwaysIgnoredCount > 0 ? (
        <p className="mt-2 text-[10px] text-white/55">Excepciones permanentes: {alwaysIgnoredCount}</p>
      ) : null}
    </div>
  );
};

export default EditorScheduleAlerts;


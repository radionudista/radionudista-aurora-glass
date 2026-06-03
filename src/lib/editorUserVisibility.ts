export const isMasterRole = (role: string): boolean =>
  String(role || '').trim().toLowerCase() === 'master';

/** Oculta cuentas master salvo la del viewer master (solo puede verse a sí mismo). */
export const filterEditorUsersForPanel = <T extends { userId: string; role: string }>(
  users: T[],
  viewer: { userId: string | null; isMaster: boolean }
): T[] =>
  users.filter((user) => {
    if (!isMasterRole(user.role)) return true;
    return Boolean(viewer.isMaster && viewer.userId && user.userId === viewer.userId);
  });

/** Oculta actividad de masters salvo la del viewer master. */
export const filterAuditLogsHidingMasters = <T extends { actorUserId: string | null }>(
  logs: T[],
  masterUserIds: ReadonlySet<string>,
  viewer: { userId: string | null; isMaster: boolean }
): T[] =>
  logs.filter((log) => {
    const actorId = log.actorUserId;
    if (!actorId || !masterUserIds.has(actorId)) return true;
    return Boolean(viewer.isMaster && viewer.userId && actorId === viewer.userId);
  });

export const collectMasterUserIds = (users: Array<{ userId: string; role: string }>): Set<string> =>
  new Set(users.filter((u) => isMasterRole(u.role)).map((u) => u.userId));

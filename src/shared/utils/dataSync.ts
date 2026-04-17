const DATA_SYNC_EVENT = 'wms:data-sync';
const DATA_SYNC_STORAGE_KEY = 'wms:data-sync';

export type DataSyncScope = 'tasks' | 'sessions' | 'users' | 'problems' | 'workdays' | 'references';

interface DataSyncPayload {
  scopes: DataSyncScope[];
  at: number;
}

const hasIntersection = (left: DataSyncScope[], right: DataSyncScope[]) => {
  return left.some((entry) => right.includes(entry));
};

export const emitDataSync = (scopes: DataSyncScope[]) => {
  if (typeof window === 'undefined') return;
  const payload: DataSyncPayload = { scopes, at: Date.now() };
  window.dispatchEvent(new CustomEvent<DataSyncPayload>(DATA_SYNC_EVENT, { detail: payload }));
  try {
    window.localStorage.setItem(DATA_SYNC_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore storage sync failures
  }
};

export const subscribeDataSync = (
  scopes: DataSyncScope[],
  callback: () => void
) => {
  if (typeof window === 'undefined') return () => undefined;

  const handleEvent = (event: Event) => {
    const detail = (event as CustomEvent<DataSyncPayload>).detail;
    if (!detail || !hasIntersection(detail.scopes, scopes)) return;
    callback();
  };

  const handleStorage = (event: StorageEvent) => {
    if (event.key !== DATA_SYNC_STORAGE_KEY || !event.newValue) return;
    try {
      const payload = JSON.parse(event.newValue) as DataSyncPayload;
      if (hasIntersection(payload.scopes, scopes)) {
        callback();
      }
    } catch {
      // ignore malformed payload
    }
  };

  window.addEventListener(DATA_SYNC_EVENT, handleEvent as EventListener);
  window.addEventListener('storage', handleStorage);

  return () => {
    window.removeEventListener(DATA_SYNC_EVENT, handleEvent as EventListener);
    window.removeEventListener('storage', handleStorage);
  };
};


import type { DataMode } from '../types/domain';

export const APP_TITLE = 'WMS Special Ops';

export const dataMode: DataMode =
  (import.meta.env.VITE_DATA_MODE as DataMode | undefined) ?? 'mock';

export const isFirebaseMode = dataMode === 'firebase';

export const SESSION_STORAGE_KEY = 'wms_session';
export const MOCK_DB_STORAGE_KEY = 'wms_mock_db_v1';

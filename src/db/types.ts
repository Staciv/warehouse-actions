export type Note = {
  id: string;
  text: string;
  createdAt: number;
  updatedAt: number;
  pinned: boolean;
  archived: boolean;
};

export type AppSettings = {
  id: 'main';
  installHintDismissed: boolean;
  updatedAt: number;
};

export type ExportPayload = {
  schemaVersion: 1;
  notes: Note[];
  settings: AppSettings;
};

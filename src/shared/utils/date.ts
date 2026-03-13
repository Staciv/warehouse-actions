export const toIsoNow = () => new Date().toISOString();

export const formatDate = (dateIso: string) => {
  if (!dateIso) return '—';
  return new Intl.DateTimeFormat('pl-PL', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date(dateIso));
};

export const formatDateTime = (dateIso: string) => {
  if (!dateIso) return '—';
  return new Intl.DateTimeFormat('pl-PL', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(dateIso));
};

export const formatMinutes = (minutes: number) => {
  if (!Number.isFinite(minutes) || minutes < 0) return '0 min';
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hrs === 0) return `${mins} min`;
  return `${hrs} h ${mins} min`;
};

export const toDateRangeBounds = (fromDate?: string, toDate?: string) => {
  const from = fromDate ? new Date(`${fromDate}T00:00:00`).toISOString() : undefined;
  const to = toDate ? new Date(`${toDate}T23:59:59`).toISOString() : undefined;
  return { from, to };
};

export const parseDateTimeLocal = (value: string) => new Date(value).toISOString();

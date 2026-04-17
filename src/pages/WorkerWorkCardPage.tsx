import { useEffect, useMemo, useState } from 'react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Field } from '../components/ui/Field';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { EmptyState, Loader } from '../components/ui/States';
import { Table } from '../components/ui/Table';
import { TextArea } from '../components/ui/TextArea';
import { Badge } from '../components/ui/Badge';
import { useAuth } from '../features/auth/AuthContext';
import { detectGaps, detectOverlaps, evaluateDayClose, hasActiveWorkEntry, toDateKey, toIsoByDateAndTime } from '../entities/workday';
import { getRepository } from '../services/repositories';
import { formatDate, formatDateTime, formatMinutes, toIsoNow } from '../shared/utils/date';
import { useI18n } from '../shared/i18n/I18nContext';
import type { AddManualWorkLogEntryPayload, StartWorkDayPayload, UpdateManualWorkLogEntryPayload } from '../services/repositories/types';
import type { WorkDay, WorkLogEntry, WorkTypeDictionary } from '../types/domain';
import styles from './workCard.module.css';

interface StartIntervalDraft {
  id: string;
  start: string;
  end: string;
  workTypeId: string;
  comment: string;
}

const createDraftId = () => Math.random().toString(36).slice(2, 11);

const extractTime = (iso: string) => {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return '';
  const hrs = String(dt.getHours()).padStart(2, '0');
  const mins = String(dt.getMinutes()).padStart(2, '0');
  return `${hrs}:${mins}`;
};

const renderCompactTime = (iso?: string) => {
  if (!iso) return '—';
  return extractTime(iso);
};

const todayDateKey = () => toDateKey(toIsoNow());
const fiveMinutesMs = 5 * 60 * 1000;
const isQuarterHourTime = (value: string) => /^([01]\d|2[0-3]):(00|15|30|45)$/.test(value);

export const WorkerWorkCardPage = () => {
  const { user } = useAuth();
  const { t } = useI18n();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [day, setDay] = useState<WorkDay | null>(null);
  const [entries, setEntries] = useState<WorkLogEntry[]>([]);
  const [workTypes, setWorkTypes] = useState<WorkTypeDictionary[]>([]);
  const [dateKey, setDateKey] = useState(todayDateKey());

  const [startAt, setStartAt] = useState('06:00');
  const [plannedEndAt, setPlannedEndAt] = useState('14:00');
  const [intervals, setIntervals] = useState<StartIntervalDraft[]>([]);

  const [showManualForm, setShowManualForm] = useState(false);
  const [manualEditEntryId, setManualEditEntryId] = useState<string | null>(null);
  const [manualWorkTypeId, setManualWorkTypeId] = useState('');
  const [manualStart, setManualStart] = useState('');
  const [manualEnd, setManualEnd] = useState('');
  const [manualComment, setManualComment] = useState('');

  const [showPlannedEndForm, setShowPlannedEndForm] = useState(false);
  const [plannedEndDraft, setPlannedEndDraft] = useState('');

  const [closeAt, setCloseAt] = useState(extractTime(toIsoNow()));
  const [closeWarningMinutes, setCloseWarningMinutes] = useState<number | null>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const repository = getRepository();
      const [types, dayRow] = await Promise.all([
        repository.getWorkTypes(),
        repository.getWorkDayByDate(user.id, dateKey, user)
      ]);
      setWorkTypes(types);
      if (types.length > 0 && !manualWorkTypeId) {
        setManualWorkTypeId(types[0].id);
      }
      setDay(dayRow);
      if (dayRow) {
        const logs = await repository.getWorkLogEntries(dayRow.id, user);
        setEntries(logs);
        setPlannedEndDraft(extractTime(dayRow.plannedEnd));
      } else {
        setEntries([]);
        setIntervals([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się załadować karty pracy');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [user?.id, dateKey]);

  const overlaps = useMemo(() => detectOverlaps(entries), [entries]);
  const gaps = useMemo(() => detectGaps(entries), [entries]);
  const activeEntry = useMemo(() => entries.find((entry) => !entry.endTime) ?? null, [entries]);
  const manualTypes = useMemo(() => workTypes.filter((entry) => entry.category !== 'system'), [workTypes]);
  const isDayActive = day?.status === 'active';
  const isTodayView = dateKey === todayDateKey();
  const getEntryStatusLabel = (entry: WorkLogEntry) => {
    if (!entry.endTime) return t('workCard.entryActive', 'W trakcie');
    if (entry.isAutoClosed) return t('workCard.entryAutoClosed', 'Zamkniete automatycznie');
    return t('workCard.entryDone', 'Zakonczone');
  };

  useEffect(() => {
    if (manualTypes.length === 0) return;
    if (!manualWorkTypeId || !manualTypes.some((entry) => entry.id === manualWorkTypeId)) {
      setManualWorkTypeId(manualTypes[0].id);
    }
  }, [manualTypes, manualWorkTypeId]);

  if (!user) return null;
  if (loading) return <Loader text={t('common.loading')} />;

  const onAddInterval = () => {
    const type = manualTypes.find((entry) => entry.category === 'pre_shift') ?? manualTypes[0];
    setIntervals((prev) => [...prev, { id: createDraftId(), start: '', end: '', workTypeId: type?.id ?? '', comment: '' }]);
  };

  const onRemoveInterval = (id: string) => {
    setIntervals((prev) => prev.filter((entry) => entry.id !== id));
  };

  const onStartDay = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (!isQuarterHourTime(startAt) || !isQuarterHourTime(plannedEndAt)) {
        throw new Error(t('workCard.halfHourValidation', 'Wybierz czas co 15 minut (np. 06:00, 06:15, 06:30, 06:45).'));
      }
      const actualStartIso = toIsoByDateAndTime(dateKey, startAt);
      const plannedEndIso = toIsoByDateAndTime(dateKey, plannedEndAt);
      const nowIso = toIsoNow();
      const nowMs = new Date(nowIso).getTime();

      const payload: StartWorkDayPayload = {
        workerId: user.id,
        date: dateKey,
        actualStart: actualStartIso,
        plannedEnd: plannedEndIso,
        preShiftIntervals: intervals
          .filter((entry) => entry.start && entry.end && entry.workTypeId)
          .map((entry) => {
            if (!isQuarterHourTime(entry.start) || !isQuarterHourTime(entry.end)) {
              throw new Error(t('workCard.halfHourValidation', 'Wybierz czas co 15 minut (np. 06:00, 06:15, 06:30, 06:45).'));
            }
            return entry;
          })
          .map((entry) => ({
            startTime: toIsoByDateAndTime(dateKey, entry.start),
            endTime: toIsoByDateAndTime(dateKey, entry.end),
            workTypeId: entry.workTypeId,
            comment: entry.comment || undefined
          }))
      };
      const createdDay = await getRepository().startWorkDay(payload, user);
      setNotice(
        t('workCard.dayStarted', 'Dzien pracy zostal rozpoczety')
      );

      if (dateKey === todayDateKey()) {
        const lastPreShiftEnd =
          payload.preShiftIntervals.length > 0
            ? [...payload.preShiftIntervals].sort((a, b) => b.endTime.localeCompare(a.endTime))[0].endTime
            : payload.actualStart;
        const lastPreShiftEndMs = new Date(lastPreShiftEnd).getTime();
        if (Number.isFinite(lastPreShiftEndMs) && nowMs - lastPreShiftEndMs > fiveMinutesMs) {
          setNotice(
            t(
              'workCard.fillGapAfterStart',
              'Dzien zostal rozpoczety. Uzupelnij prosze, co robiles od poczatku zmiany do momentu przyjscia na przyjecia.'
            )
          );
          setManualEditEntryId(null);
          setManualStart(extractTime(lastPreShiftEnd));
          setManualEnd(extractTime(nowIso));
          setManualComment('');
          const preShiftOrGapType =
            workTypes.find((entry) => entry.category === 'pre_shift') ??
            workTypes.find((entry) => entry.category === 'gap_fill') ??
            workTypes.find((entry) => entry.category !== 'system');
          if (preShiftOrGapType) {
            setManualWorkTypeId(preShiftOrGapType.id);
          }
          setShowManualForm(true);
          setDay(createdDay);
        }
      }

      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się rozpocząć dnia');
    } finally {
      setSaving(false);
    }
  };

  const openCreateManual = (fromIso?: string, toIso?: string) => {
    setManualEditEntryId(null);
    setManualStart(fromIso ? extractTime(fromIso) : '');
    setManualEnd(toIso ? extractTime(toIso) : '');
    setManualComment('');
    if (manualTypes[0]) setManualWorkTypeId(manualTypes[0].id);
    setShowManualForm(true);
  };

  const openEditManual = (entry: WorkLogEntry) => {
    setManualEditEntryId(entry.id);
    setManualWorkTypeId(entry.workTypeId);
    setManualStart(extractTime(entry.startTime));
    setManualEnd(extractTime(entry.endTime ?? entry.startTime));
    setManualComment(entry.comment ?? '');
    setShowManualForm(true);
  };

  const onSaveManual = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!day) return;
    setSaving(true);
    setError('');
    try {
      if (!isQuarterHourTime(manualStart) || !isQuarterHourTime(manualEnd)) {
        throw new Error(t('workCard.halfHourValidation', 'Wybierz czas co 15 minut (np. 06:00, 06:15, 06:30, 06:45).'));
      }
      const startIso = toIsoByDateAndTime(day.date, manualStart);
      const endIso = toIsoByDateAndTime(day.date, manualEnd);
      if (manualEditEntryId) {
        const payload: UpdateManualWorkLogEntryPayload = {
          workTypeId: manualWorkTypeId,
          startTime: startIso,
          endTime: endIso,
          comment: manualComment || undefined
        };
        await getRepository().updateManualWorkLogEntry(manualEditEntryId, payload, user);
      } else {
        const payload: AddManualWorkLogEntryPayload = {
          workDayId: day.id,
          workerId: user.id,
          workTypeId: manualWorkTypeId,
          startTime: startIso,
          endTime: endIso,
          comment: manualComment || undefined
        };
        await getRepository().addManualWorkLogEntry(payload, user);
      }
      setNotice(manualEditEntryId ? 'Wpis zaktualizowany' : 'Wpis dodany');
      setShowManualForm(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się zapisać wpisu');
    } finally {
      setSaving(false);
    }
  };

  const onUpdatePlannedEnd = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!day) return;
    setSaving(true);
    setError('');
    try {
      if (!isQuarterHourTime(plannedEndDraft)) {
        throw new Error(t('workCard.halfHourValidation', 'Wybierz czas co 15 minut (np. 06:00, 06:15, 06:30, 06:45).'));
      }
      await getRepository().updateWorkDayPlannedEnd(day.id, toIsoByDateAndTime(day.date, plannedEndDraft), user);
      setNotice('Planowane zakończenie zaktualizowane');
      setShowPlannedEndForm(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się zaktualizować grafiku');
    } finally {
      setSaving(false);
    }
  };

  const closeDay = async () => {
    if (!day) return;
    setSaving(true);
    setError('');
    try {
      await getRepository().closeWorkDay(day.id, toIsoByDateAndTime(day.date, closeAt), user);
      setNotice('Dzień pracy został zamknięty');
      setCloseWarningMinutes(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się zamknąć dnia');
    } finally {
      setSaving(false);
    }
  };

  const onTryCloseDay = async () => {
    if (!day) return;
    if (!isQuarterHourTime(closeAt)) {
      setError(t('workCard.halfHourValidation', 'Wybierz czas co 15 minut (np. 06:00, 06:15, 06:30, 06:45).'));
      return;
    }
    const actualEndIso = toIsoByDateAndTime(day.date, closeAt);
    const evalResult = evaluateDayClose(day.plannedEnd, actualEndIso);
    if (evalResult.earlyByMinutes > 15) {
      setCloseWarningMinutes(evalResult.earlyByMinutes);
      return;
    }
    await closeDay();
  };

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <div>
        <h1 className={styles.title}>{t('workCard.title', 'Moja karta pracy')}</h1>
        <div className={styles.subtitle}>
          {t('workCard.date', 'Data')}: {formatDate(`${dateKey}T00:00:00.000Z`)}
        </div>
        </div>
        <div className={styles.datePickerWrap}>
          <Field label={t('workCard.date', 'Data')}>
            <Input
              type="date"
              value={dateKey}
              max={todayDateKey()}
              onChange={(event) => {
                setNotice('');
                setError('');
                setShowManualForm(false);
                setShowPlannedEndForm(false);
                setCloseWarningMinutes(null);
                setDateKey(event.target.value);
              }}
            />
          </Field>
        </div>
      </div>

      {notice ? (
        <Card compact>
          <div className={styles.notice}>{notice}</div>
        </Card>
      ) : null}
      {error ? (
        <Card compact>
          <div className={styles.error}>{error}</div>
        </Card>
      ) : null}

      {!day ? (
        !isTodayView ? (
          <Card>
            <EmptyState text={t('workCard.noEntries', 'Brak wpisow')} />
          </Card>
        ) : (
        <Card>
          <h3 className="sectionTitle">{t('workCard.startDay', 'Rozpocznij dzien')}</h3>
          <form onSubmit={onStartDay} className="stack">
            <div className="formGrid">
              <Field label={t('workCard.actualStart', 'Faktyczny poczatek pracy')}>
                <Input type="time" step={900} value={startAt} onChange={(event) => setStartAt(event.target.value)} required />
              </Field>
              <Field label={t('workCard.plannedEnd', 'Planowane zakonczenie')}>
                <Input type="time" step={900} value={plannedEndAt} onChange={(event) => setPlannedEndAt(event.target.value)} required />
              </Field>
            </div>
            <div className={styles.infoBox}>
              {t(
                'workCard.startHint',
                'Jesli rozpoczynasz dzien pozniej na przyjeciach, system po starcie dnia poprosi Cie o uzupelnienie, co robiles od poczatku zmiany do momentu przyjscia tutaj.'
              )}
            </div>
            <div className="stack">
              <h4>{t('workCard.beforeReceiving', 'Co robiles przed przyjsciem na przyjecia')}</h4>
              {intervals.length === 0 ? (
                <div className={styles.subtleNote}>
                  {t(
                    'workCard.noIntervalsYet',
                    'Jesli chcesz, mozesz od razu dodac przedzialy pracy. Jesli nie, system zapyta o brakujacy czas po rozpoczeciu dnia.'
                  )}
                </div>
              ) : null}
              {intervals.map((entry, index) => (
                <Card key={entry.id} compact>
                  <div className={styles.intervalRow}>
                    <div className={styles.intervalTitle}>
                      {t('workCard.interval', 'Przedzial')} {index + 1}
                    </div>
                    {intervals.length > 1 ? (
                      <Button type="button" variant="danger" onClick={() => onRemoveInterval(entry.id)}>
                        {t('common.delete', 'Usun')}
                      </Button>
                    ) : null}
                  </div>
                  <div className="formGrid">
                    <Field label={t('workCard.timeFrom', 'Od')}>
                      <Input
                        type="time"
                        step={900}
                        value={entry.start}
                        onChange={(event) =>
                          setIntervals((prev) => prev.map((item) => (item.id === entry.id ? { ...item, start: event.target.value } : item)))
                        }
                        required
                      />
                    </Field>
                    <Field label={t('workCard.timeTo', 'Do')}>
                      <Input
                        type="time"
                        step={900}
                        value={entry.end}
                        onChange={(event) =>
                          setIntervals((prev) => prev.map((item) => (item.id === entry.id ? { ...item, end: event.target.value } : item)))
                        }
                        required
                      />
                    </Field>
                    <Field label={t('workCard.workType', 'Typ pracy')}>
                      <Select
                        value={entry.workTypeId}
                        onChange={(event) =>
                          setIntervals((prev) =>
                            prev.map((item) => (item.id === entry.id ? { ...item, workTypeId: event.target.value } : item))
                          )
                        }
                      >
                        {manualTypes.map((type) => (
                          <option key={type.id} value={type.id}>
                            {type.name}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  </div>
                </Card>
              ))}
              <div className="inlineActions rowActions">
                <Button type="button" variant="secondary" onClick={onAddInterval}>
                  {t('workCard.addInterval', 'Dodaj przedzial')}
                </Button>
              </div>
            </div>
            <div className="inlineActions rowActions">
              <Button type="submit" disabled={saving}>
                {saving ? t('common.saving', 'Zapisywanie...') : t('workCard.startDay', 'Rozpocznij dzien')}
              </Button>
            </div>
          </form>
        </Card>
        )
      ) : (
        <>
          <Card>
            <h3 className="sectionTitle">{t('workCard.daySummary', 'Podsumowanie dnia')}</h3>
            <div className="formGrid">
              <div>
                <div className="kpi">{t('workCard.start', 'Start')}</div>
                <div>{formatDateTime(day.actualStart)}</div>
              </div>
              <div>
                <div className="kpi">{t('workCard.plannedEndShort', 'Planowany koniec')}</div>
                <div>{formatDateTime(day.plannedEnd)}</div>
              </div>
              <div>
                <div className="kpi">{t('workCard.actualEnd', 'Faktyczny koniec')}</div>
                <div>{day.actualEnd ? formatDateTime(day.actualEnd) : '—'}</div>
              </div>
              <div>
                <div className="kpi">{t('workCard.dayStatus', 'Status dnia')}</div>
                <Badge
                  tone={day.status === 'active' ? 'warning' : 'success'}
                  text={day.status === 'active' ? t('workCard.dayOpen', 'Otwarty') : t('workCard.dayClosed', 'Zamkniety')}
                />
              </div>
              <div>
                <div className="kpi">{t('workCard.workedTime', 'Przepracowano')}</div>
                <div>{formatMinutes(day.totalWorkedMinutes)}</div>
              </div>
              <div>
                <div className="kpi">{t('workCard.gaps', 'Luki')}</div>
                <div>{formatMinutes(day.totalGapMinutes)}</div>
              </div>
            </div>
          </Card>

          {activeEntry ? (
            <Card compact>
              <div className={styles.activeTitle}>{t('workCard.currentActivity', 'Biezaca aktywnosc')}</div>
              <div className={styles.currentActivityGrid}>
                <div>
                  <div className="kpi">{t('workCard.table.type', 'Typ')}</div>
                  <div>{activeEntry.workTypeName}</div>
                </div>
                <div>
                  <div className="kpi">{t('workCard.table.source', 'Zrodlo')}</div>
                  <div>{activeEntry.source === 'action' ? t('workCard.sourceAction', 'Akcja') : t('workCard.sourceManual', 'Reczna')}</div>
                </div>
                <div>
                  <div className="kpi">{t('workCard.table.actionName', 'Akcja')}</div>
                  <div>{activeEntry.relatedActionType ?? t('workCard.manualWork', 'Praca reczna')}</div>
                </div>
                <div>
                  <div className="kpi">{t('workCard.table.vehicle', 'Pojazd')}</div>
                  <div>{activeEntry.relatedVehicleCode ?? '—'}</div>
                </div>
                <div>
                  <div className="kpi">{t('workCard.table.carrier', 'Przewoznik')}</div>
                  <div>{activeEntry.relatedCarrierName ?? '—'}</div>
                </div>
                <div>
                  <div className="kpi">{t('workCard.startedAt', 'Start')}</div>
                  <div>{formatDateTime(activeEntry.startTime)}</div>
                </div>
              </div>
            </Card>
          ) : null}

          {showManualForm ? (
            <Card>
              <h3 className="sectionTitle">
                {manualEditEntryId ? t('workCard.editEntry', 'Edytuj wpis') : t('workCard.addWork', 'Dodaj prace')}
              </h3>
              <form onSubmit={onSaveManual} className="stack">
                <div className="formGrid">
                  <Field label={t('workCard.workType', 'Typ pracy')}>
                    {manualTypes.length > 0 ? (
                      <Select value={manualWorkTypeId} onChange={(event) => setManualWorkTypeId(event.target.value)}>
                        {manualTypes.map((type) => (
                          <option key={type.id} value={type.id}>
                            {type.name}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      <Input value="Brak aktywnych typów pracy" readOnly />
                    )}
                  </Field>
                  <Field label={t('workCard.timeFrom', 'Od')}>
                    <Input type="time" step={900} value={manualStart} onChange={(event) => setManualStart(event.target.value)} required />
                  </Field>
                  <Field label={t('workCard.timeTo', 'Do')}>
                    <Input type="time" step={900} value={manualEnd} onChange={(event) => setManualEnd(event.target.value)} required />
                  </Field>
                </div>
                <Field label={t('workCard.comment', 'Komentarz')}>
                  <TextArea rows={3} value={manualComment} onChange={(event) => setManualComment(event.target.value)} />
                </Field>
                <div className="inlineActions rowActions">
                  <Button type="submit" disabled={saving}>
                    {saving ? t('common.saving', 'Zapisywanie...') : t('common.save', 'Zapisz')}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setShowManualForm(false);
                      setManualEditEntryId(null);
                    }}
                  >
                    {t('common.cancel', 'Anuluj')}
                  </Button>
                </div>
              </form>
            </Card>
          ) : null}

          {showPlannedEndForm ? (
            <Card compact>
              <form onSubmit={onUpdatePlannedEnd} className="inlineActions rowActions">
                <Field label={t('workCard.plannedEnd', 'Planowane zakonczenie')}>
                  <Input type="time" step={900} value={plannedEndDraft} onChange={(event) => setPlannedEndDraft(event.target.value)} required />
                </Field>
                <Button type="submit" disabled={saving}>
                  {t('common.update', 'Aktualizuj')}
                </Button>
                <Button type="button" variant="secondary" onClick={() => setShowPlannedEndForm(false)}>
                  {t('common.cancel', 'Anuluj')}
                </Button>
              </form>
            </Card>
          ) : null}

          {closeWarningMinutes !== null ? (
            <Card compact>
              <div className="stack">
                <div>
                  {t(
                    'workCard.earlyCloseWarning',
                    'Do planowanego zakonczenia pracy zostalo jeszcze'
                  )}{' '}
                  {closeWarningMinutes} {t('workCard.minutes', 'min')}.{' '}
                  {t('workCard.earlyCloseCheck', 'Sprawdz prosze, czy grafik na dzisiaj jest ustawiony poprawnie.')}
                </div>
                <div className="inlineActions rowActions">
                  <Button onClick={() => void closeDay()} disabled={saving}>
                    {t('workCard.endNow', 'Zakoncz prace teraz')}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setCloseWarningMinutes(null);
                      setShowPlannedEndForm(true);
                    }}
                  >
                    {t('workCard.changeSchedule', 'Zmien grafik')}
                  </Button>
                  <Button variant="secondary" onClick={() => setCloseWarningMinutes(null)}>
                    {t('common.cancel', 'Anuluj')}
                  </Button>
                </div>
              </div>
            </Card>
          ) : null}

          <Card>
            <div className={`inlineActions rowActions ${styles.dayActionsRow}`}>
              {isDayActive ? (
                <>
                  <Button type="button" onClick={() => openCreateManual()}>
                    {t('workCard.addWork', 'Dodaj prace')}
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => setShowPlannedEndForm((value) => !value)}>
                    {t('workCard.editPlannedEnd', 'Zmien planowane zakonczenie')}
                  </Button>
                  <div className={styles.closeTimeField}>
                    <Field label={t('workCard.closeAt', 'Zakoncz o')}>
                      <Input type="time" step={900} value={closeAt} onChange={(event) => setCloseAt(event.target.value)} />
                    </Field>
                  </div>
                  <Button type="button" variant="secondary" onClick={() => void onTryCloseDay()}>
                    {t('workCard.endDay', 'Zakoncz dzien')}
                  </Button>
                </>
              ) : (
                <div className="kpi">{t('workCard.dayClosedInfo', 'Dzien jest juz zamkniety. Edycja jest niedostepna.')}</div>
              )}
            </div>
          </Card>

          <Card>
            <h3 className="sectionTitle">{t('workCard.validationTitle', 'Walidacje i ostrzezenia')}</h3>
            {overlaps.length === 0 && gaps.length === 0 && !hasActiveWorkEntry(entries) ? (
              <EmptyState text={t('workCard.noProblems', 'Nie wykryto problemow')} />
            ) : (
              <div className="stack">
                {hasActiveWorkEntry(entries) ? (
                  <div className={styles.warning}>
                    {t(
                      'workCard.openActivityWarning',
                      'Istnieje niezamnieta aktywnosc. Zakoncz biezaca prace przed zamknieciem dnia.'
                    )}
                  </div>
                ) : null}
                {overlaps.map((overlap) => (
                  <div key={`${overlap.entryAId}-${overlap.entryBId}`} className={styles.error}>
                    {t('workCard.overlap', 'Nakladanie przedzialow')} : {formatDateTime(overlap.from)} - {formatDateTime(overlap.to)}
                  </div>
                ))}
                {gaps.map((gap, index) => (
                  <div key={`${gap.from}-${gap.to}-${index}`} className={styles.warning}>
                    {t('workCard.gapWarning', 'W karcie pracy jest przedzial bez wpisu')} : {formatDateTime(gap.from)} -{' '}
                    {formatDateTime(gap.to)} ({gap.minutes} {t('workCard.minutes', 'min')})
                    {isDayActive ? (
                      <div style={{ marginTop: 8 }}>
                        <Button variant="secondary" onClick={() => openCreateManual(gap.from, gap.to)}>
                          {t('workCard.fillGap', 'Uzupelnij przedzial')}
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <h3 className="sectionTitle">{t('workCard.timeline', 'Raport dnia')}</h3>
            {entries.length === 0 ? (
              <EmptyState text={t('workCard.noEntries', 'Brak wpisow')} />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <th>Lp.</th>
                    <th>{t('workCard.table.status', 'Status')}</th>
                    <th>{t('workCard.timeFrom', 'Od')}</th>
                    <th>{t('workCard.timeTo', 'Do')}</th>
                    <th>{t('workCard.table.type', 'Typ pracy')}</th>
                    <th>{t('workCard.table.source', 'Zrodlo')}</th>
                    <th>{t('workCard.table.actionName', 'Akcja specjalna')}</th>
                    <th>{t('workCard.table.vehicle', 'Pojazd')}</th>
                    <th>{t('workCard.table.carrier', 'Przewoznik')}</th>
                    <th>{t('workCard.table.pallets', 'Palety')}</th>
                    <th>{t('workCard.table.duration', 'Czas')}</th>
                    <th>{t('workCard.table.comment', 'Uwagi')}</th>
                    <th>{t('workCard.table.actions', 'Akcje')}</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry, index) => (
                    <tr key={entry.id}>
                      <td data-label="Lp.">{index + 1}</td>
                      <td data-label={t('workCard.table.status', 'Status')}>
                        <Badge
                          tone={!entry.endTime ? 'warning' : entry.isAutoClosed ? 'danger' : 'success'}
                          text={getEntryStatusLabel(entry)}
                        />
                      </td>
                      <td data-label={t('workCard.timeFrom', 'Od')}>{renderCompactTime(entry.startTime)}</td>
                      <td data-label={t('workCard.timeTo', 'Do')}>{renderCompactTime(entry.endTime)}</td>
                      <td data-label={t('workCard.table.type', 'Typ pracy')}>{entry.workTypeName}</td>
                      <td data-label={t('workCard.table.source', 'Zrodlo')}>
                        <Badge
                          tone={entry.source === 'action' ? 'warning' : 'default'}
                          text={entry.source === 'action' ? t('workCard.sourceAction', 'Akcja') : t('workCard.sourceManual', 'Reczna')}
                        />
                      </td>
                      <td data-label={t('workCard.table.actionName', 'Akcja')}>{entry.relatedActionType ?? '—'}</td>
                      <td data-label={t('workCard.table.vehicle', 'Pojazd')}>{entry.relatedVehicleCode ?? '—'}</td>
                      <td data-label={t('workCard.table.carrier', 'Przewoznik')}>{entry.relatedCarrierName ?? '—'}</td>
                      <td data-label={t('workCard.table.pallets', 'Palety')}>{entry.palletsCompleted ?? '—'}</td>
                      <td data-label={t('workCard.table.duration', 'Czas trwania')}>{formatMinutes(entry.durationMinutes)}</td>
                      <td data-label={t('workCard.table.comment', 'Komentarz')}>{entry.comment || '—'}</td>
                      <td data-label={t('workCard.table.actions', 'Akcje')}>
                        {isDayActive && entry.source === 'manual' ? (
                          <Button variant="secondary" onClick={() => openEditManual(entry)}>
                            {t('common.edit', 'Edytuj')}
                          </Button>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        </>
      )}
    </div>
  );
};

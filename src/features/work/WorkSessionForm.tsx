import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Field } from '../../components/ui/Field';
import { Input } from '../../components/ui/Input';
import { TextArea } from '../../components/ui/TextArea';
import type { ActionTask } from '../../types/domain';

interface Props {
  task: ActionTask;
  fixedStartedAt: string;
  onSubmit: (payload: {
    pallets: number;
    rampNumber: string;
    startedAt: string;
    endedAt: string;
    comment?: string;
  }) => Promise<void>;
}

const toLocalDateTimeValue = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

export const WorkSessionForm = ({ task, fixedStartedAt, onSubmit }: Props) => {
  const [pallets, setPallets] = useState('');
  const [rampNumber, setRampNumber] = useState('');
  const [endedAt, setEndedAt] = useState(toLocalDateTimeValue());
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    const numeric = Number(pallets);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      setError('Podaj poprawną liczbę palet.');
      return;
    }
    if (!rampNumber.trim()) {
      setError('Podaj numer rampy.');
      return;
    }

    setSaving(true);
    try {
      await onSubmit({
        pallets: numeric,
        rampNumber: rampNumber.trim(),
        startedAt: fixedStartedAt,
        endedAt: new Date(endedAt).toISOString(),
        comment
      });
      setPallets('');
      setRampNumber('');
      setComment('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się zapisać wykonania');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <form onSubmit={submit} className="stack">
        <h3>Dodaj wykonanie</h3>
        <div className="kpi">Pozostałe palety: {task.remainingPallets}</div>
        <div className="formGrid">
          <Field label="Ile palet wykonano">
            <Input type="number" min={1} max={task.remainingPallets} value={pallets} onChange={(e) => setPallets(e.target.value)} />
          </Field>
          <Field label="Numer rampy">
            <Input value={rampNumber} onChange={(e) => setRampNumber(e.target.value)} placeholder="Np. R-12" />
          </Field>
          <Field label="Czas rozpoczęcia (automatycznie)">
            <Input value={new Date(fixedStartedAt).toLocaleString('pl-PL')} readOnly />
          </Field>
          <Field label="Czas do">
            <Input type="datetime-local" value={endedAt} onChange={(e) => setEndedAt(e.target.value)} />
          </Field>
        </div>
        <Field label="Komentarz">
          <TextArea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} />
        </Field>
        {error ? <div style={{ color: '#c63d3d' }}>{error}</div> : null}
        <Button type="submit" disabled={saving || task.remainingPallets <= 0}>
          {saving ? 'Zapisywanie...' : 'Zapisz wykonanie'}
        </Button>
      </form>
    </Card>
  );
};

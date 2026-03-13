import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Field } from '../../components/ui/Field';
import { Input } from '../../components/ui/Input';
import { TextArea } from '../../components/ui/TextArea';
import type { ActionTask } from '../../types/domain';

interface Props {
  task: ActionTask;
  onSubmit: (payload: { pallets: number; startedAt: string; endedAt: string; comment?: string }) => Promise<void>;
}

const toLocalDateTimeValue = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

export const WorkSessionForm = ({ task, onSubmit }: Props) => {
  const [pallets, setPallets] = useState('');
  const [startedAt, setStartedAt] = useState(toLocalDateTimeValue());
  const [endedAt, setEndedAt] = useState(toLocalDateTimeValue());
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    const numeric = Number(pallets);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      setError('Укажите корректное количество палет.');
      return;
    }

    setSaving(true);
    try {
      await onSubmit({
        pallets: numeric,
        startedAt: new Date(startedAt).toISOString(),
        endedAt: new Date(endedAt).toISOString(),
        comment
      });
      setPallets('');
      setComment('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить выполнение');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <form onSubmit={submit} className="stack">
        <h3>Внести выполнение</h3>
        <div className="kpi">Осталось палет: {task.remainingPallets}</div>
        <div className="formGrid">
          <Field label="Сколько палет сделал">
            <Input type="number" min={1} max={task.remainingPallets} value={pallets} onChange={(e) => setPallets(e.target.value)} />
          </Field>
          <Field label="Время от">
            <Input type="datetime-local" value={startedAt} onChange={(e) => setStartedAt(e.target.value)} />
          </Field>
          <Field label="Время до">
            <Input type="datetime-local" value={endedAt} onChange={(e) => setEndedAt(e.target.value)} />
          </Field>
        </div>
        <Field label="Комментарий">
          <TextArea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} />
        </Field>
        {error ? <div style={{ color: '#c63d3d' }}>{error}</div> : null}
        <Button type="submit" disabled={saving || task.remainingPallets <= 0}>
          {saving ? 'Сохранение...' : 'Сохранить выполнение'}
        </Button>
      </form>
    </Card>
  );
};

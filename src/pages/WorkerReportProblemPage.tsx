import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Field } from '../components/ui/Field';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { TextArea } from '../components/ui/TextArea';
import { useAuth } from '../features/auth/AuthContext';
import { getRepository } from '../services/repositories';
import { PROBLEM_ISSUE_LABELS } from '../constants/problem-reports';
import type { ProblemIssueType } from '../types/domain';
import { ROUTES } from '../constants/routes';
import styles from './page.module.css';

export const WorkerReportProblemPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [issueType, setIssueType] = useState<ProblemIssueType>('missing_label');
  const [rampNumber, setRampNumber] = useState('');
  const [vehicleCode, setVehicleCode] = useState('');
  const [shortDescription, setShortDescription] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!user || user.role !== 'worker') return null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      await getRepository().createProblemReport(
        {
          issueType,
          rampNumber,
          vehicleCode,
          shortDescription,
          photoUrl: photoUrl || undefined
        },
        user
      );
      navigate(ROUTES.dashboard);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się wysłać zgłoszenia');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div>
        <h1 className={styles.title}>Zgłoś problem</h1>
        <div className={styles.subtitle}>Zgłoszenie niezależne od konkretnej akcji</div>
      </div>
      <Card>
        <form className="stack" onSubmit={submit}>
          <div className="formGrid">
            <Field label="Typ problemu">
              <Select value={issueType} onChange={(event) => setIssueType(event.target.value as ProblemIssueType)}>
                {Object.entries(PROBLEM_ISSUE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Rampa">
              <Input value={rampNumber} onChange={(event) => setRampNumber(event.target.value)} placeholder="np. R-05" required />
            </Field>
            <Field label="Maszyna / pojazd">
              <Input value={vehicleCode} onChange={(event) => setVehicleCode(event.target.value)} placeholder="np. PL-WA-1201" required />
            </Field>
            <Field label="Zdjęcie (URL, opcjonalnie)">
              <Input value={photoUrl} onChange={(event) => setPhotoUrl(event.target.value)} />
            </Field>
          </div>
          <Field label="Krótki opis">
            <TextArea rows={4} value={shortDescription} onChange={(event) => setShortDescription(event.target.value)} required />
          </Field>
          {error ? <div style={{ color: '#c63d3d' }}>{error}</div> : null}
          <div className="inlineActions rowActions">
            <Button type="submit" disabled={loading}>
              {loading ? 'Wysyłanie...' : 'Wyślij zgłoszenie'}
            </Button>
            <Button type="button" variant="secondary" onClick={() => navigate(ROUTES.dashboard)}>
              Anuluj
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

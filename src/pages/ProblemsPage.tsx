import { useEffect, useMemo, useState } from 'react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { EmptyState, Loader } from '../components/ui/States';
import { Field } from '../components/ui/Field';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { useAuth } from '../features/auth/AuthContext';
import { getRepository } from '../services/repositories';
import type { ProblemIssueType, ProblemReport, ProblemStatus } from '../types/domain';
import { PROBLEM_ISSUE_LABELS, PROBLEM_STATUS_LABELS } from '../constants/problem-reports';
import { useI18n } from '../shared/i18n/I18nContext';
import styles from './page.module.css';

export const ProblemsPage = () => {
  const { user } = useAuth();
  const { t } = useI18n();
  const [problemStatusFilter, setProblemStatusFilter] = useState<ProblemStatus | 'all'>('all');
  const [problemTypeFilter, setProblemTypeFilter] = useState<ProblemIssueType | 'all'>('all');
  const [problemRampFilter, setProblemRampFilter] = useState('');
  const [problemReports, setProblemReports] = useState<ProblemReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadProblemReports = async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const rows = await getRepository().getProblemReports(
        {
          status: problemStatusFilter,
          issueType: problemTypeFilter,
          rampNumber: problemRampFilter || undefined
        },
        user
      );
      setProblemReports(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się pobrać zgłoszeń');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadProblemReports();
  }, [user?.id, problemStatusFilter, problemTypeFilter, problemRampFilter]);

  const getSlaLabel = (createdAt: string, status: ProblemReport['status']) => {
    if (status === 'resolved' || status === 'rejected') return 'zamknięte';
    const ageMinutes = Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000));
    if (ageMinutes >= 120) return `SLA: ${Math.floor(ageMinutes / 60)}h ${ageMinutes % 60}m (krytyczne)`;
    if (ageMinutes >= 60) return `SLA: ${Math.floor(ageMinutes / 60)}h ${ageMinutes % 60}m`;
    return `SLA: ${ageMinutes} min`;
  };

  const canManage = user?.role === 'admin' || user?.role === 'superadmin';
  const openReports = useMemo(
    () => problemReports.filter((item) => item.status === 'new' || item.status === 'in_progress').length,
    [problemReports]
  );

  const updateProblemStatus = async (id: string, status: ProblemStatus) => {
    if (!user || !canManage) return;
    await getRepository().updateProblemReportStatus(id, status, user);
    await loadProblemReports();
  };

  if (!user) return null;

  return (
    <div className={styles.page}>
      <div className={styles.titleRow}>
        <h1 className={styles.title}>{t('page.problems.title')}</h1>
      </div>

      <Card>
        <div className="formGrid">
          <Field label="Status">
            <Select value={problemStatusFilter} onChange={(event) => setProblemStatusFilter(event.target.value as ProblemStatus | 'all')}>
              <option value="all">Wszystkie</option>
              {Object.entries(PROBLEM_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Typ problemu">
            <Select value={problemTypeFilter} onChange={(event) => setProblemTypeFilter(event.target.value as ProblemIssueType | 'all')}>
              <option value="all">Wszystkie</option>
              {Object.entries(PROBLEM_ISSUE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Rampa">
            <Input value={problemRampFilter} onChange={(event) => setProblemRampFilter(event.target.value)} placeholder="np. R-05" />
          </Field>
        </div>
      </Card>

      <Card>
        <div className="formGrid">
          <div>
            <div className="kpi">Wszystkie zgłoszenia</div>
            <strong>{problemReports.length}</strong>
          </div>
          <div>
            <div className="kpi">Otwarte</div>
            <strong>{openReports}</strong>
          </div>
        </div>
      </Card>

      {loading ? <Loader /> : null}
      {error ? <div style={{ color: '#c63d3d' }}>{error}</div> : null}
      {!loading && problemReports.length === 0 ? <EmptyState text="Brak zgłoszeń dla bieżących filtrów" /> : null}
      {!loading && problemReports.length > 0 ? (
        <div className="stack">
          {problemReports.map((report) => (
            <Card key={report.id} className={styles.problemItem}>
              <div className={styles.titleRow}>
                <strong>{PROBLEM_ISSUE_LABELS[report.issueType]}</strong>
                <span className="kpi">{PROBLEM_STATUS_LABELS[report.status]}</span>
              </div>
              <div className="kpi">
                {report.vehicleCode} · rampa {report.rampNumber} · {report.createdByUserName}
              </div>
              <div>{report.shortDescription}</div>
              <div className="kpi">{getSlaLabel(report.createdAt, report.status)}</div>
              {canManage && (report.status === 'new' || report.status === 'in_progress') ? (
                <div className="inlineActions rowActions">
                  {report.status === 'new' ? (
                    <Button variant="secondary" onClick={() => void updateProblemStatus(report.id, 'in_progress')}>
                      Weź do pracy
                    </Button>
                  ) : null}
                  <Button variant="secondary" onClick={() => void updateProblemStatus(report.id, 'resolved')}>
                    Oznacz jako rozwiązane
                  </Button>
                  <Button variant="danger" onClick={() => void updateProblemStatus(report.id, 'rejected')}>
                    Odrzuć
                  </Button>
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  );
};

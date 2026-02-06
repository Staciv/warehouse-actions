import { useState } from 'react';
import { db, now } from '../db/database';
import { usePwaInstall } from '../hooks/usePwaInstall';

type InstallHintProps = {
  dismissed: boolean;
  onDismissed: () => void;
};

export function InstallHint({ dismissed, onDismissed }: InstallHintProps) {
  const { canInstall, install, isIos, isStandalone } = usePwaInstall();
  const [busy, setBusy] = useState(false);

  if (dismissed || isStandalone) return null;

  async function dismiss() {
    await db.settings.put({ id: 'main', installHintDismissed: true, updatedAt: now() });
    onDismissed();
  }

  async function installNow() {
    if (!canInstall) return;
    setBusy(true);
    await install();
    setBusy(false);
  }

  return (
    <section className="install-hint glass-card">
      <h3>Установить приложение</h3>
      {canInstall && (
        <button className="primary-btn" disabled={busy} type="button" onClick={installNow}>
          Добавить на главный экран
        </button>
      )}
      {isIos && (
        <p className="muted">
          На iOS: откройте меню Поделиться в Safari, затем выберите «На экран Домой».
        </p>
      )}
      {!canInstall && !isIos && <p className="muted">Откройте меню браузера и выберите «Установить приложение».</p>}
      <button className="ghost-btn" type="button" onClick={dismiss}>
        Скрыть подсказку
      </button>
    </section>
  );
}

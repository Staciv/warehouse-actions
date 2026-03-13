import { Select } from './Select';
import { useI18n } from '../../shared/i18n/I18nContext';
import type { Locale } from '../../shared/i18n/translations';

export const LanguageSwitcher = () => {
  const { locale, setLocale, locales } = useI18n();

  return (
    <Select value={locale} onChange={(event) => setLocale(event.target.value as Locale)} aria-label="Language">
      {locales.map((item) => (
        <option key={item.value} value={item.value}>
          {item.label}
        </option>
      ))}
    </Select>
  );
};

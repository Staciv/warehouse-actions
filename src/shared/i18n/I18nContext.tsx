import { createContext, useContext, useMemo, useState } from 'react';
import { defaultLocale, i18nStorageKey, localeNames, translations, type Locale } from './translations';

interface I18nValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, fallback?: string) => string;
  locales: Array<{ value: Locale; label: string }>;
}

const I18nContext = createContext<I18nValue | undefined>(undefined);

const readStoredLocale = (): Locale => {
  const raw = localStorage.getItem(i18nStorageKey) as Locale | null;
  if (!raw) return defaultLocale;
  return raw in translations ? raw : defaultLocale;
};

export const I18nProvider = ({ children }: { children: React.ReactNode }) => {
  const [locale, setLocaleState] = useState<Locale>(readStoredLocale);

  const setLocale = (next: Locale) => {
    setLocaleState(next);
    localStorage.setItem(i18nStorageKey, next);
  };

  const t = (key: string, fallback?: string) =>
    translations[locale][key] ?? translations[defaultLocale][key] ?? fallback ?? key;

  const locales = useMemo(
    () =>
      (Object.keys(localeNames) as Locale[]).map((value) => ({
        value,
        label: localeNames[value]
      })),
    []
  );

  const value = useMemo<I18nValue>(() => ({ locale, setLocale, t, locales }), [locale, locales]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = () => {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n must be used inside I18nProvider');
  return context;
};

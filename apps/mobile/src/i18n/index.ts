import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import ko from './ko.json';

export type AppLocale = 'ko' | 'en';

export function deviceLocale(): AppLocale {
  return getLocales()[0]?.languageCode === 'ko' ? 'ko' : 'en';
}

export function initI18n(locale: AppLocale): void {
  if (i18n.isInitialized) return;
  i18n.use(initReactI18next).init({
    resources: { ko: { translation: ko }, en: { translation: en } },
    lng: locale,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  });
}

export function setLocale(locale: AppLocale): void {
  i18n.changeLanguage(locale);
}

export default i18n;

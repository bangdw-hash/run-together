import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Visibility } from '@run-together/shared';
import { deviceLocale, setLocale, type AppLocale } from '../i18n';
import type { Units } from '../lib/format';

interface SettingsState {
  locale: AppLocale;
  units: Units;
  nickname: string;
  paceSecPerKm: number;
  visibility: Visibility;
  serverUrl: string;
  setSettings(patch: Partial<Omit<SettingsState, 'setSettings'>>): void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      locale: deviceLocale(),
      units: deviceLocale() === 'ko' ? 'km' : 'mi',
      nickname: '',
      paceSecPerKm: 360,
      visibility: 'all',
      serverUrl: '',
      setSettings: (patch) => {
        if (patch.locale) setLocale(patch.locale);
        set(patch);
      },
    }),
    {
      name: 'run-together-settings',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

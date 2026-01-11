import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemePreference = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'theme_preference';

interface ThemeSettingsState {
  themePreference: ThemePreference;
  hydrated: boolean;
  setThemePreference: (preference: ThemePreference) => void;
  hydrate: () => Promise<void>;
}

export const useThemeSettings = create<ThemeSettingsState>((set) => ({
  themePreference: 'system',
  hydrated: false,
  setThemePreference: (preference) => {
    set({ themePreference: preference });
    AsyncStorage.setItem(STORAGE_KEY, preference);
  },
  hydrate: async () => {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      set({ themePreference: stored, hydrated: true });
      return;
    }
    set({ hydrated: true });
  },
}));

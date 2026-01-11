import { useEffect } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';
import { useThemeSettings } from '@/app/store/useThemeSettings';

export function useColorScheme() {
  const systemScheme = useRNColorScheme();
  const { themePreference, hydrate, hydrated } = useThemeSettings();

  useEffect(() => {
    if (!hydrated) {
      hydrate();
    }
  }, [hydrated, hydrate]);

  if (themePreference === 'light' || themePreference === 'dark') {
    return themePreference;
  }

  return systemScheme ?? 'light';
}

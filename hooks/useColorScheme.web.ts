import { useEffect, useState } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';
import { useThemeSettings } from '@/app/store/useThemeSettings';

/**
 * To support static rendering, this value needs to be re-calculated on the client side for web
 */
export function useColorScheme() {
  const [hasHydrated, setHasHydrated] = useState(false);
  const { themePreference, hydrate, hydrated } = useThemeSettings();
  const systemScheme = useRNColorScheme();

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) {
      hydrate();
    }
  }, [hydrated, hydrate]);

  if (!hasHydrated) {
    return 'light';
  }

  if (themePreference === 'light' || themePreference === 'dark') {
    return themePreference;
  }

  return systemScheme ?? 'light';
}

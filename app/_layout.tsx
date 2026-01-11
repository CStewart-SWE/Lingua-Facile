import React, { useEffect, useState, useCallback } from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import * as Speech from 'expo-speech';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '../utils/supabase';

import { useColorScheme } from '@/hooks/useColorScheme';
import LoginScreen from './LoginScreen';

// Subscription imports
import { initializeRevenueCat, setupPurchasesListener, logOutRevenueCat } from '../services/revenuecatService';
import { useSubscriptionStore } from './store/useSubscriptionStore';
import { useUsageStore } from './store/useUsageStore';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });
  const [authChecked, setAuthChecked] = useState(false);
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    const getSession = async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
      setAuthChecked(true);
    };
    getSession();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  // Fetch and store available voices on startup
  useEffect(() => {
    const fetchAndStoreVoices = async () => {
      try {
        const voices = await Speech.getAvailableVoicesAsync();
        await AsyncStorage.setItem('availableVoices', JSON.stringify(voices));
      } catch (e) {
        // Optionally handle error
      }
    };
    fetchAndStoreVoices();
  }, []);

  // Initialize subscription and usage tracking when user is authenticated
  useEffect(() => {
    if (!session?.user?.id) return;

    const userId = session.user.id;
    let cleanupListener: (() => void) | null = null;

    const initializeSubscription = async () => {
      try {
        // Ensure user profile exists in database
        await supabase
          .from('user_profiles')
          .upsert(
            { id: userId, email: session.user.email },
            { onConflict: 'id' }
          );

        // Initialize RevenueCat with Supabase user ID
        await initializeRevenueCat(userId);

        // Set up listener for subscription changes
        cleanupListener = setupPurchasesListener(userId);

        // Fetch subscription state from database
        await useSubscriptionStore.getState().fetchSubscription(userId);

        // Fetch usage (includes limits based on user's tier)
        await useUsageStore.getState().fetchUsage(userId);
      } catch (error) {
        console.error('Failed to initialize subscription:', error);
      }
    };

    initializeSubscription();

    return () => {
      if (cleanupListener) {
        cleanupListener();
      }
    };
  }, [session?.user?.id]);

  // Handle logout - clean up subscription state
  const handleLogout = useCallback(async () => {
    await logOutRevenueCat();
    useSubscriptionStore.getState().reset();
    useUsageStore.getState().reset();
  }, []);

  if (!loaded || !authChecked) {
    return null;
  }

  if (!session) {
    return <LoginScreen onLogin={() => {
      supabase.auth.getSession().then(({ data }) => setSession(data.session));
    }} />;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

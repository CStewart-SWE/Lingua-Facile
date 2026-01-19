import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HapticTab } from '@/components/HapticTab';
import { IconSymbol } from '@/components/ui/IconSymbol';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useRouter } from 'expo-router';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();

  return (
    <>
      <Tabs
        initialRouteName="CEFRChecker"
        screenOptions={{
          headerShown: true,
          header: ({ route, options }) => (
            <SafeAreaView edges={['top']} style={{ backgroundColor: Colors[colorScheme ?? 'light'].background }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8, backgroundColor: Colors[colorScheme ?? 'light'].background, zIndex: 10 }}>
                <View style={{ width: 22 }} />
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                  {typeof options.title === 'string' ? (
                    <Text style={{ fontSize: 20, fontWeight: '600', color: Colors[colorScheme ?? 'light'].text, textAlign: 'center' }}>
                      {options.title}
                    </Text>
                  ) : null}
                  {/* Only render fallback if title is missing or not a string */}
                  {typeof options.title !== 'string' && (
                    <Text style={{ fontSize: 20, fontWeight: '600', color: Colors[colorScheme ?? 'light'].text, textAlign: 'center' }}>
                      Lingua Facile
                    </Text>
                  )}
                </View>
                <View style={{ width: 40, alignItems: 'flex-end' }}>
                  <TouchableOpacity onPress={() => router.push('/Settings')}>
                    <Ionicons name="settings-outline" size={25} color={Colors[colorScheme ?? 'light'].icon} />
                  </TouchableOpacity>
                </View>
              </View>
            </SafeAreaView>
          ),
          tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
          tabBarInactiveTintColor: Colors[colorScheme ?? 'light'].icon,
          tabBarButton: HapticTab,
          tabBarBackground: TabBarBackground,
          tabBarStyle: Platform.select({
            ios: {
              // Use a transparent background on iOS to show the blur effect
              position: 'absolute',
              backgroundColor: Colors[colorScheme ?? 'light'].background,
            },
            default: {
              backgroundColor: Colors[colorScheme ?? 'light'].background,
            },
          }),
        }}
      >
        <Tabs.Screen
          name="translator"
          options={{
            title: 'Translator',
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="globe" color={color} />,
          }}
        />
        <Tabs.Screen
          name="CEFRChecker"
          options={{
            title: 'CEFR Checker',
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="text.book.closed.fill" color={color} />, // You can change the icon name as desired
          }}
        />
        <Tabs.Screen
          name="ChatScreen"
          options={{
            title: 'AI Tutor',
            tabBarIcon: ({ color }) => <Ionicons size={28} name="chatbubbles" color={color} />,
          }}
        />
      </Tabs>
    </>
  );
}

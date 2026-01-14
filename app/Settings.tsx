import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Switch,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  Modal,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCEFRSettings } from './store/useCEFRSettings';
import { useThemeSettings } from './store/useThemeSettings';
import { supabase } from '../utils/supabase';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useNavigation } from 'expo-router';

// Subscription imports
import { useSubscriptionStore } from './store/useSubscriptionStore';
import { useUsageStore } from './store/useUsageStore';
import { restorePurchases, logOutRevenueCat } from '../services/revenuecatService';
import { Paywall } from '../components/subscription/Paywall';

const THEME_OPTIONS = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export default function Settings() {
  const { selectedLevels, dynamicCheck, setSelectedLevels, setDynamicCheck, hydrate } = useCEFRSettings();
  const { themePreference, setThemePreference, hydrate: hydrateTheme } = useThemeSettings();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const router = useRouter();
  const navigation = useNavigation();

  // Subscription state
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [cefrModalVisible, setCefrModalVisible] = useState(false);
  const [themeModalVisible, setThemeModalVisible] = useState(false);
  const [restoringPurchases, setRestoringPurchases] = useState(false);
  const { isPremium, expiresAt } = useSubscriptionStore();

  // Configure navigation header
  useEffect(() => {
    if (navigation) {
      navigation.setOptions({
        headerTitle: 'Settings',
        headerBackTitle: 'Home',
        headerLargeTitle: true,
        headerStyle: { backgroundColor: '#F2F2F7' },
        headerShadowVisible: false,
      });
    }
  }, [navigation]);

  useEffect(() => {
    Promise.all([hydrate(), hydrateTheme()]);
    const fetchUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (data?.user) {
        setIsGuest((data.user as any).is_anonymous);
        setUserEmail(data.user.email ?? null);
      }
    };
    fetchUser();
  }, [hydrate, hydrateTheme]);

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await logOutRevenueCat();
            useSubscriptionStore.getState().reset();
            useUsageStore.getState().reset();
            await supabase.auth.signOut();
          },
        },
      ]
    );
  };

  const handleRestorePurchases = async () => {
    setRestoringPurchases(true);
    try {
      const customerInfo = await restorePurchases();
      if (customerInfo?.entitlements.active.premium) {
        Alert.alert('Success', 'Purchases restored successfully.');
      } else {
        Alert.alert('No Subscription', 'No active subscription found.');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setRestoringPurchases(false);
    }
  };

  const toggleLevel = (level: string) => {
    if (selectedLevels.includes(level)) {
      setSelectedLevels(selectedLevels.filter(l => l !== level));
    } else {
      setSelectedLevels([...selectedLevels, level]);
    }
  };

  const SettingItem = ({ icon, label, value, onPress, isDestructive = false, rightElement, hasChevron = true }: any) => (
    <TouchableOpacity
      style={[styles.itemContainer, { backgroundColor: theme.background }]}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.itemLeft}>
        <View style={[styles.iconBox, { backgroundColor: isDestructive ? '#FFEBEE' : '#F5F7FA' }]}>
          <Ionicons name={icon} size={20} color={isDestructive ? '#D32F2F' : '#1976FF'} />
        </View>
        <Text style={[styles.itemLabel, { color: isDestructive ? '#D32F2F' : theme.text }]}>{label}</Text>
      </View>
      <View style={styles.itemRight}>
        {value && <Text style={styles.itemValue}>{value}</Text>}
        {rightElement}
        {onPress && !rightElement && hasChevron && (
          <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
        )}
      </View>
    </TouchableOpacity>
  );

  const SectionHeader = ({ title }: { title: string }) => (
    <Text style={styles.sectionHeader}>{title}</Text>
  );

  return (
    <View style={[styles.container, { backgroundColor: '#F2F2F7' }]}>
      <Paywall visible={paywallVisible} onClose={() => setPaywallVisible(false)} />
      
      {/* CEFR Selection Modal */}
      <Modal visible={cefrModalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modalContainer, { backgroundColor: '#F2F2F7' }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select CEFR Levels</Text>
            <TouchableOpacity onPress={() => setCefrModalVisible(false)} style={styles.modalDoneBtn}>
              <Text style={styles.modalDoneText}>Done</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <View style={styles.sectionGroup}>
              {CEFR_LEVELS.map((level) => (
                <View key={level} style={[styles.itemContainer, { backgroundColor: theme.background }]}>
                  <Text style={[styles.itemLabel, { marginLeft: 0 }]}>{level}</Text>
                  <Switch
                    value={selectedLevels.includes(level)}
                    onValueChange={() => toggleLevel(level)}
                  />
                </View>
              ))}
            </View>
            <Text style={styles.modalHelperText}>
              Select the levels you want to include in the complexity analysis.
            </Text>
          </ScrollView>
        </View>
      </Modal>

      {/* Theme Selection Modal */}
      <Modal visible={themeModalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modalContainer, { backgroundColor: '#F2F2F7' }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Appearance</Text>
            <TouchableOpacity onPress={() => setThemeModalVisible(false)} style={styles.modalDoneBtn}>
              <Text style={styles.modalDoneText}>Done</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <View style={styles.sectionGroup}>
              {THEME_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  onPress={() => setThemePreference(option.value)}
                  style={[styles.itemContainer, { backgroundColor: theme.background }]}
                >
                  <Text style={[styles.itemLabel, { marginLeft: 0 }]}>{option.label}</Text>
                  {themePreference === option.value && (
                    <Ionicons name="checkmark" size={20} color="#1976FF" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>
      </Modal>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        contentInsetAdjustmentBehavior="automatic"
      >
        {/* Account Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
             <Text style={styles.avatarText}>
                {userEmail ? userEmail.charAt(0).toUpperCase() : 'G'}
             </Text>
          </View>
          <View style={styles.profileInfo}>
             <Text style={styles.profileName}>{isGuest ? 'Guest User' : userEmail}</Text>
             <Text style={styles.profilePlan}>{isPremium ? 'Premium Member' : 'Free Plan'}</Text>
          </View>
          {!isPremium && (
             <TouchableOpacity style={styles.upgradeBtn} onPress={() => setPaywallVisible(true)}>
                <Text style={styles.upgradeBtnText}>Upgrade</Text>
             </TouchableOpacity>
          )}
        </View>

        <SectionHeader title="PREFERENCES" />
        <View style={styles.sectionGroup}>
           <SettingItem
              icon="color-palette"
              label="Theme"
              value={themePreference.charAt(0).toUpperCase() + themePreference.slice(1)}
              onPress={() => setThemeModalVisible(true)}
           />
           <SettingItem
              icon="mic"
              label="Speech Voice"
              onPress={() => router.push({ pathname: '/voice-picker-screen', params: { langCode: 'en' } })}
           />
        </View>

        <SectionHeader title="LEARNING TOOLS" />
        <View style={styles.sectionGroup}>
           <SettingItem
              icon="speedometer"
              label="CEFR Levels"
              value={selectedLevels.join(', ')}
              onPress={() => setCefrModalVisible(true)}
           />
           <SettingItem
              icon="flash"
              label="Dynamic Analysis"
              rightElement={
                 <Switch value={dynamicCheck} onValueChange={setDynamicCheck} />
              }
           />
        </View>

        <SectionHeader title="SUBSCRIPTION" />
        <View style={styles.sectionGroup}>
           <SettingItem
              icon="cart"
              label="Restore Purchases"
              onPress={handleRestorePurchases}
              hasChevron={false}
           />
           {isPremium && (
              <SettingItem
                 icon="calendar"
                 label="Expires"
                 value={expiresAt ? new Date(expiresAt).toLocaleDateString() : 'Never'}
              />
           )}
        </View>

        <SectionHeader title="ACCOUNT" />
        <View style={styles.sectionGroup}>
           <SettingItem
              icon="log-out"
              label="Sign Out"
              isDestructive
              onPress={handleSignOut}
              hasChevron={false}
           />
        </View>
        
        <Text style={styles.versionText}>Version 1.0.0 (Build 1)</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: Platform.OS === 'android' ? 20 : 0, 
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
    marginBottom: 24,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#E1E1E1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#666',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 2,
  },
  profilePlan: {
    fontSize: 14,
    color: '#666',
  },
  upgradeBtn: {
    backgroundColor: '#1976FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  upgradeBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6D6D72',
    marginBottom: 8,
    marginLeft: 12,
    marginTop: 12,
  },
  sectionGroup: {
    backgroundColor: '#fff',
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 12,
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  itemLabel: {
    fontSize: 16,
    fontWeight: '400',
  },
  itemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  itemValue: {
    fontSize: 15,
    color: '#8E8E93',
  },
  versionText: {
    textAlign: 'center',
    color: '#8E8E93',
    fontSize: 13,
    marginTop: 20,
    marginBottom: 40,
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#C6C6C8',
    backgroundColor: '#fff', // Ensure header has background
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  modalDoneBtn: {
    padding: 8,
  },
  modalDoneText: {
    color: '#1976FF',
    fontSize: 17,
    fontWeight: '600',
  },
  modalContent: {
    padding: 24,
  },
  modalHelperText: {
    fontSize: 13,
    color: '#6D6D72',
    textAlign: 'center',
    marginTop: 16,
  },
});

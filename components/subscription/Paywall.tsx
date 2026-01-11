import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { PurchasesPackage } from 'react-native-purchases';
import { useThemeColor } from '@/hooks/useThemeColor';
import { getOfferings, purchasePackage, restorePurchases } from '../../services/revenuecatService';
import { useSubscriptionStore } from '../../app/store/useSubscriptionStore';
import { Ionicons } from '@expo/vector-icons';

interface PaywallProps {
  visible: boolean;
  onClose: () => void;
  feature?: string; // The feature user tried to access
}

interface FeatureItem {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  free: boolean;
  premium: boolean;
}

const FEATURES: FeatureItem[] = [
  {
    icon: 'language',
    title: 'Translations',
    description: '10/day vs Unlimited',
    free: true,
    premium: true,
  },
  {
    icon: 'school',
    title: 'CEFR Analysis',
    description: '5/day vs Unlimited',
    free: true,
    premium: true,
  },
  {
    icon: 'text',
    title: 'Verb Conjugation',
    description: '10/day vs Unlimited',
    free: true,
    premium: true,
  },
  {
    icon: 'chatbubbles',
    title: 'AI Chat Tutor',
    description: 'Practice conversations',
    free: false,
    premium: true,
  },
  {
    icon: 'refresh',
    title: 'Fresh Analysis',
    description: 'Bypass cache for latest results',
    free: false,
    premium: true,
  },
  {
    icon: 'cloud-upload',
    title: 'Cloud Sync',
    description: 'Sync settings across devices',
    free: false,
    premium: true,
  },
];

export const Paywall: React.FC<PaywallProps> = ({ visible, onClose, feature }) => {
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<PurchasesPackage | null>(null);

  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const tintColor = useThemeColor({}, 'tint');

  const { isPremium } = useSubscriptionStore();

  useEffect(() => {
    if (visible) {
      loadOfferings();
    }
  }, [visible]);

  const loadOfferings = async () => {
    setLoading(true);
    try {
      const offerings = await getOfferings();
      if (offerings?.current?.availablePackages) {
        setPackages(offerings.current.availablePackages);
        // Select the first package by default
        if (offerings.current.availablePackages.length > 0) {
          setSelectedPackage(offerings.current.availablePackages[0]);
        }
      }
    } catch (error) {
      console.error('Failed to load offerings:', error);
    }
    setLoading(false);
  };

  const handlePurchase = async () => {
    if (!selectedPackage) return;

    setPurchasing(true);
    try {
      const customerInfo = await purchasePackage(selectedPackage);
      if (customerInfo) {
        Alert.alert('Success', 'Thank you for subscribing!', [{ text: 'OK', onPress: onClose }]);
      }
    } catch (error: any) {
      if (!error.userCancelled) {
        Alert.alert('Purchase Failed', error.message || 'An error occurred during purchase.');
      }
    }
    setPurchasing(false);
  };

  const handleRestore = async () => {
    setPurchasing(true);
    try {
      const customerInfo = await restorePurchases();
      if (customerInfo) {
        const hasActive = Object.keys(customerInfo.entitlements.active).length > 0;
        if (hasActive) {
          Alert.alert('Restored', 'Your subscription has been restored!', [{ text: 'OK', onPress: onClose }]);
        } else {
          Alert.alert('No Subscription', 'No active subscription found to restore.');
        }
      }
    } catch (error: any) {
      Alert.alert('Restore Failed', error.message || 'An error occurred while restoring purchases.');
    }
    setPurchasing(false);
  };

  // If already premium, don't show paywall
  if (isPremium) {
    return null;
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={[styles.container, { backgroundColor }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={28} color={textColor} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: textColor }]}>Upgrade to Premium</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Feature the user tried to access */}
        {feature && (
          <View style={[styles.featurePrompt, { backgroundColor: tintColor + '20' }]}>
            <Ionicons name="lock-closed" size={20} color={tintColor} />
            <Text style={[styles.featurePromptText, { color: textColor }]}>
              {feature} requires Premium
            </Text>
          </View>
        )}

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Features comparison */}
          <View style={styles.featuresSection}>
            <Text style={[styles.sectionTitle, { color: textColor }]}>What's included</Text>

            {FEATURES.map((item, index) => (
              <View key={index} style={styles.featureRow}>
                <View style={styles.featureInfo}>
                  <Ionicons name={item.icon} size={24} color={tintColor} />
                  <View style={styles.featureText}>
                    <Text style={[styles.featureTitle, { color: textColor }]}>{item.title}</Text>
                    <Text style={[styles.featureDescription, { color: textColor + '80' }]}>
                      {item.description}
                    </Text>
                  </View>
                </View>
                <View style={styles.featureChecks}>
                  <Ionicons
                    name={item.free ? 'checkmark-circle' : 'close-circle'}
                    size={22}
                    color={item.free ? '#4CAF50' : '#9E9E9E'}
                  />
                  <Ionicons
                    name="checkmark-circle"
                    size={22}
                    color="#4CAF50"
                    style={styles.premiumCheck}
                  />
                </View>
              </View>
            ))}

            {/* Labels for columns */}
            <View style={styles.columnLabels}>
              <Text style={[styles.columnLabel, { color: textColor + '60' }]}>Free</Text>
              <Text style={[styles.columnLabel, styles.premiumLabel, { color: tintColor }]}>
                Premium
              </Text>
            </View>
          </View>

          {/* Packages */}
          {loading ? (
            <ActivityIndicator size="large" color={tintColor} style={styles.loader} />
          ) : (
            <View style={styles.packagesSection}>
              {packages.map((pkg) => (
                <TouchableOpacity
                  key={pkg.identifier}
                  style={[
                    styles.packageCard,
                    { borderColor: selectedPackage?.identifier === pkg.identifier ? tintColor : textColor + '20' },
                    selectedPackage?.identifier === pkg.identifier && { backgroundColor: tintColor + '10' },
                  ]}
                  onPress={() => setSelectedPackage(pkg)}
                >
                  <View style={styles.packageInfo}>
                    <Text style={[styles.packageTitle, { color: textColor }]}>
                      {pkg.product.title}
                    </Text>
                    <Text style={[styles.packagePrice, { color: tintColor }]}>
                      {pkg.product.priceString}
                    </Text>
                    {pkg.product.subscriptionPeriod && (
                      <Text style={[styles.packagePeriod, { color: textColor + '60' }]}>
                        per {pkg.product.subscriptionPeriod}
                      </Text>
                    )}
                  </View>
                  <View
                    style={[
                      styles.radioButton,
                      { borderColor: tintColor },
                      selectedPackage?.identifier === pkg.identifier && { backgroundColor: tintColor },
                    ]}
                  >
                    {selectedPackage?.identifier === pkg.identifier && (
                      <Ionicons name="checkmark" size={16} color="#fff" />
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>

        {/* Purchase button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.purchaseButton, { backgroundColor: tintColor }]}
            onPress={handlePurchase}
            disabled={purchasing || !selectedPackage}
          >
            {purchasing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.purchaseButtonText}>
                Subscribe Now
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.restoreButton} onPress={handleRestore} disabled={purchasing}>
            <Text style={[styles.restoreButtonText, { color: tintColor }]}>
              Restore Purchases
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  closeButton: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  placeholder: {
    width: 44,
  },
  featurePrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  featurePromptText: {
    fontSize: 14,
    fontWeight: '500',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  featuresSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E0E0E0',
  },
  featureInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '500',
  },
  featureDescription: {
    fontSize: 12,
    marginTop: 2,
  },
  featureChecks: {
    flexDirection: 'row',
    gap: 16,
  },
  premiumCheck: {
    marginLeft: 8,
  },
  columnLabels: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingTop: 8,
    paddingRight: 4,
  },
  columnLabel: {
    fontSize: 12,
    fontWeight: '500',
    width: 38,
    textAlign: 'center',
  },
  premiumLabel: {
    marginLeft: 8,
  },
  loader: {
    marginVertical: 32,
  },
  packagesSection: {
    gap: 12,
    marginBottom: 24,
  },
  packageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
  },
  packageInfo: {
    flex: 1,
  },
  packageTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  packagePrice: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 4,
  },
  packagePeriod: {
    fontSize: 12,
    marginTop: 2,
  },
  radioButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    paddingTop: 16,
    gap: 12,
  },
  purchaseButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  purchaseButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  restoreButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  restoreButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
});

export default Paywall;

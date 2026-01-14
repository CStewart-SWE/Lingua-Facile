import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { useThemeColor } from '@/hooks/useThemeColor';
import { getOfferings, purchasePackage, restorePurchases } from '../../services/revenuecatService';
import { PurchasesPackage } from 'react-native-purchases';
import { useSubscriptionStore } from '../../app/store/useSubscriptionStore';
import { Ionicons } from '@expo/vector-icons';

interface PaywallProps {
  visible: boolean;
  onClose: () => void;
  feature?: string;
}

interface FeatureItem {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
}

const PREMIUM_FEATURES: FeatureItem[] = [
  {
    icon: 'infinite',
    title: 'Unlimited Access',
    description: 'Unlimited translations and CEFR analysis',
  },
  {
    icon: 'chatbubbles',
    title: 'AI Tutor',
    description: 'Practice with an advanced AI language tutor',
  },
  {
    icon: 'sparkles',
    title: 'Smart Insights',
    description: 'Get tone, synonyms, and detailed context',
  },
  {
    icon: 'cloud-offline',
    title: 'Ad-Free Experience',
    description: 'Focus on learning without interruptions',
  },
];

export const Paywall: React.FC<PaywallProps> = ({ visible, onClose, feature }) => {
  const [purchasing, setPurchasing] = useState(false);
  const [pkg, setPkg] = useState<PurchasesPackage | null>(null);
  const [loadingOfferings, setLoadingOfferings] = useState(true);
  const { isPremium } = useSubscriptionStore();

  useEffect(() => {
    const fetchOfferings = async () => {
      if (!visible) return;
      
      setLoadingOfferings(true);
      try {
        const offerings = await getOfferings();
        if (offerings?.current && offerings.current.availablePackages.length > 0) {
          // Prefer monthly package, or fallback to first available
          const monthly = offerings.current.monthly;
          const available = monthly || offerings.current.availablePackages[0];
          setPkg(available);
        }
      } catch (e) {
        console.error('Error fetching offerings:', e);
      } finally {
        setLoadingOfferings(false);
      }
    };

    fetchOfferings();
  }, [visible]);

  const handlePurchase = async () => {
    if (!pkg) return;
    
    setPurchasing(true);
    try {
      const customerInfo = await purchasePackage(pkg);
      if (customerInfo?.entitlements.active.premium) {
        Alert.alert('Welcome to Premium!', 'Thank you for upgrading.', [{ text: 'OK', onPress: onClose }]);
      }
    } catch (e: any) {
      if (!e.userCancelled) {
        Alert.alert('Purchase Error', e.message);
      }
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setPurchasing(true);
    try {
      const customerInfo = await restorePurchases();
      if (customerInfo?.entitlements.active.premium) {
        Alert.alert('Restored', 'Your subscription has been restored!', [{ text: 'OK', onPress: onClose }]);
      } else {
        Alert.alert('No Subscription', 'No active subscription found.');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setPurchasing(false);
    }
  };

  if (isPremium) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#8E8E93" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.heroSection}>
            <View style={styles.iconBadge}>
              <Ionicons name="diamond" size={40} color="#1976FF" />
            </View>
            <Text style={styles.title}>Unlock Full Potential</Text>
            <Text style={styles.subtitle}>
              {feature 
                ? `Upgrade to access ${feature} and more.` 
                : 'Supercharge your language learning journey.'}
            </Text>
          </View>

          <View style={styles.featuresList}>
            {PREMIUM_FEATURES.map((item, index) => (
              <View key={index} style={styles.featureItem}>
                <View style={styles.featureIconBox}>
                  <Ionicons name={item.icon} size={22} color="#1976FF" />
                </View>
                <View style={styles.featureText}>
                  <Text style={styles.featureTitle}>{item.title}</Text>
                  <Text style={styles.featureDesc}>{item.description}</Text>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          {loadingOfferings ? (
            <ActivityIndicator style={{ marginBottom: 20 }} color="#1976FF" />
          ) : (
            <>
              <TouchableOpacity
                style={[styles.ctaButton, (!pkg || purchasing) && { opacity: 0.7 }]}
                onPress={handlePurchase}
                disabled={!pkg || purchasing}
              >
                {purchasing ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.ctaText}>
                    {pkg?.product.introPrice 
                      ? 'Start Free Trial' 
                      : `Subscribe for ${pkg?.product.priceString}`}
                  </Text>
                )}
              </TouchableOpacity>
              
              <Text style={styles.disclaimer}>
                {pkg?.product.introPrice 
                  ? `Then ${pkg.product.priceString}/month. Cancel anytime.`
                  : 'Cancel anytime.'}
              </Text>
            </>
          )}

          <View style={styles.footerLinks}>
            <TouchableOpacity onPress={handleRestore}>
              <Text style={styles.linkText}>Restore Purchases</Text>
            </TouchableOpacity>
            <Text style={styles.dot}>•</Text>
            <TouchableOpacity onPress={() => { /* Terms link */ }}>
              <Text style={styles.linkText}>Terms</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    padding: 16,
    alignItems: 'flex-end',
  },
  closeButton: {
    padding: 8,
    backgroundColor: '#F2F2F7',
    borderRadius: 20,
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  iconBadge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E6F0FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#000',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 22,
  },
  featuresList: {
    gap: 24,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featureIconBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#F5F7FA',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  featureDesc: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  footer: {
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: '#F2F2F7',
    backgroundColor: '#fff',
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  ctaButton: {
    backgroundColor: '#1976FF',
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#1976FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  ctaText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  disclaimer: {
    textAlign: 'center',
    fontSize: 13,
    color: '#8E8E93',
    marginBottom: 20,
  },
  footerLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  linkText: {
    fontSize: 13,
    color: '#8E8E93',
    fontWeight: '500',
  },
  dot: {
    color: '#C7C7CC',
  },
});

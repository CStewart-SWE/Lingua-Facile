// RevenueCat service for subscription management
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import Purchases, {
  CustomerInfo,
  PurchasesOfferings,
  PurchasesPackage,
  LOG_LEVEL,
} from 'react-native-purchases';
import PurchasesUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';
import { supabase } from '../utils/supabase';
import { useSubscriptionStore, SubscriptionTier, SubscriptionStatus } from '../app/store/useSubscriptionStore';

// API keys from environment
const REVENUECAT_IOS_KEY = Constants.expoConfig?.extra?.REVENUECAT_IOS_API_KEY;
const REVENUECAT_ANDROID_KEY = Constants.expoConfig?.extra?.REVENUECAT_ANDROID_API_KEY;

let isConfigured = false;

/**
 * Initialize RevenueCat SDK with the user's Supabase ID
 */
export const initializeRevenueCat = async (userId: string): Promise<void> => {
  const apiKey = Platform.OS === 'ios' ? REVENUECAT_IOS_KEY : REVENUECAT_ANDROID_KEY;

  if (!apiKey) {
    console.warn('RevenueCat API key not configured for platform:', Platform.OS);
    return;
  }

  try {
    if (isConfigured) {
      // Already configured, just log in with new user
      const { customerInfo } = await Purchases.logIn(userId);
      await syncSubscriptionToSupabase(userId, customerInfo);
      return;
    }

    // Set log level for debugging (remove in production)
    if (__DEV__) {
      Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    }

    // Configure RevenueCat with Supabase user ID as app user ID
    await Purchases.configure({
      apiKey,
      appUserID: userId,
    });

    isConfigured = true;

    // Get initial customer info and sync
    const customerInfo = await Purchases.getCustomerInfo();
    await syncSubscriptionToSupabase(userId, customerInfo);

    console.log('RevenueCat initialized for user:', userId);
  } catch (error) {
    console.error('Failed to initialize RevenueCat:', error);
  }
};

/**
 * Get the current customer info from RevenueCat
 */
export const getCustomerInfo = async (): Promise<CustomerInfo | null> => {
  try {
    return await Purchases.getCustomerInfo();
  } catch (error) {
    console.error('Failed to get customer info:', error);
    return null;
  }
};

/**
 * Get available subscription offerings
 */
export const getOfferings = async (): Promise<PurchasesOfferings | null> => {
  try {
    return await Purchases.getOfferings();
  } catch (error) {
    console.error('Failed to get offerings:', error);
    return null;
  }
};
export type PaywallOutcome = 'purchased' | 'restored' | 'cancelled' | 'error';

export const presentPaywall = async (
  requiredEntitlementIdentifier = 'premium'
): Promise<PaywallOutcome> => {
  try {
    const result = await PurchasesUI.presentPaywall({
      requiredEntitlementIdentifier,
    });

    switch (result) {
      case PAYWALL_RESULT.PURCHASED:
        return 'purchased';
      case PAYWALL_RESULT.RESTORED:
        return 'restored';
      case PAYWALL_RESULT.CANCELLED:
        return 'cancelled';
      default:
        return 'cancelled';
    }
  } catch (error) {
    console.error('Failed to present paywall:', error);
    return 'error';
  }
};


/**
 * Purchase a subscription package
 */
export const purchasePackage = async (
  packageToPurchase: PurchasesPackage
): Promise<CustomerInfo | null> => {
  try {
    const { customerInfo } = await Purchases.purchasePackage(packageToPurchase);

    // Get current user ID and sync
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      await syncSubscriptionToSupabase(data.user.id, customerInfo);
    }

    return customerInfo;
  } catch (error: any) {
    if (error.userCancelled) {
      console.log('User cancelled purchase');
      return null;
    }
    console.error('Purchase failed:', error);
    throw error;
  }
};

/**
 * Restore previous purchases
 */
export const restorePurchases = async (): Promise<CustomerInfo | null> => {
  try {
    const customerInfo = await Purchases.restorePurchases();

    // Get current user ID and sync
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      await syncSubscriptionToSupabase(data.user.id, customerInfo);
    }

    return customerInfo;
  } catch (error) {
    console.error('Restore purchases failed:', error);
    throw error;
  }
};

/**
 * Check if user has an active subscription
 */
export const isSubscriptionActive = (customerInfo: CustomerInfo): boolean => {
  // Check for any active entitlements
  return Object.keys(customerInfo.entitlements.active).length > 0;
};

/**
 * Get the user's subscription tier from CustomerInfo
 */
export const getSubscriptionTier = (customerInfo: CustomerInfo): SubscriptionTier => {
  // Check for premium entitlement
  if (customerInfo.entitlements.active['premium']) {
    return 'premium';
  }

  // Check for any active subscription as fallback
  if (Object.keys(customerInfo.entitlements.active).length > 0) {
    return 'premium';
  }

  return 'free';
};

/**
 * Get subscription status from CustomerInfo
 */
export const getSubscriptionStatus = (customerInfo: CustomerInfo): SubscriptionStatus => {
  const activeEntitlements = Object.values(customerInfo.entitlements.active);

  if (activeEntitlements.length === 0) {
    return 'none';
  }

  const entitlement = activeEntitlements[0];

  if (entitlement.willRenew) {
    return 'active';
  }

  if (entitlement.isActive && !entitlement.willRenew) {
    return 'cancelled';
  }

  return 'active';
};

/**
 * Sync subscription state from RevenueCat to Supabase
 */
export const syncSubscriptionToSupabase = async (
  userId: string,
  customerInfo: CustomerInfo
): Promise<void> => {
  try {
    const tier = getSubscriptionTier(customerInfo);
    const status = getSubscriptionStatus(customerInfo);
    const isActive = isSubscriptionActive(customerInfo);

    // Find expiration date from active subscriptions
    let expiresAt: string | null = null;
    const activeEntitlements = Object.values(customerInfo.entitlements.active);
    if (activeEntitlements.length > 0 && activeEntitlements[0].expirationDate) {
      expiresAt = activeEntitlements[0].expirationDate;
    }

    // Update Supabase user profile
    const { error } = await supabase
      .from('user_profiles')
      .update({
        subscription_tier: tier,
        subscription_status: status,
        subscription_expires_at: expiresAt,
        subscription_platform: Platform.OS as 'ios' | 'android',
        revenuecat_app_user_id: userId,
      })
      .eq('id', userId);

    if (error) {
      console.error('Failed to sync subscription to Supabase:', error);
      return;
    }

    // Update local store
    useSubscriptionStore.getState().setSubscription({
      tier,
      status,
      expiresAt,
      isLoading: false,
      isInitialized: true,
    });

    console.log(`Synced subscription: tier=${tier}, status=${status}`);
  } catch (error) {
    console.error('Sync subscription error:', error);
  }
};

/**
 * Set up listener for subscription changes
 */
export const setupPurchasesListener = (userId: string): (() => void) => {
  const listener = Purchases.addCustomerInfoUpdateListener((customerInfo) => {
    console.log('Customer info updated');
    syncSubscriptionToSupabase(userId, customerInfo);
  });

  // Return cleanup function
  return () => {
    listener.remove();
  };
};

/**
 * Log out from RevenueCat (call on user sign out)
 */
export const logOutRevenueCat = async (): Promise<void> => {
  try {
    await Purchases.logOut();
    useSubscriptionStore.getState().reset();
    console.log('Logged out of RevenueCat');
  } catch (error) {
    console.error('Failed to log out of RevenueCat:', error);
  }
};

// Feature access hook for subscription and usage gating
import { useCallback, useMemo } from 'react';
import { useSubscriptionStore } from '../app/store/useSubscriptionStore';
import { ActionType, useUsageStore } from '../app/store/useUsageStore';

// Features that require premium subscription
type PremiumFeature = 'chat' | 'force_fresh_analysis' | 'unlimited_usage' | 'story_mode';

// Features that are usage-gated
type UsageGatedFeature = ActionType;

interface FeatureAccessResult {
  // Subscription info
  tier: 'free' | 'premium';
  isPremium: boolean;
  isActive: boolean;
  isGrandfathered: boolean;
  grandfatheredUntil: string | null;
  expiresAt: string | null;

  // Loading states
  isLoading: boolean;

  // Feature checks
  hasFeature: (feature: PremiumFeature) => boolean;
  canPerformAction: (actionType: UsageGatedFeature) => boolean;
  getRemainingQuota: (actionType: UsageGatedFeature) => number;
  getUsageInfo: (actionType: UsageGatedFeature) => { used: number; limit: number; remaining: number };

  // Computed helpers
  shouldShowPaywall: boolean;
  shouldShowUpgradeBanner: boolean;
}

/**
 * Hook for checking feature access based on subscription and usage
 */
export const useFeatureAccess = (): FeatureAccessResult => {
  const {
    tier,
    status,
    isPremium,
    isActive,
    isGrandfathered,
    grandfatheredUntil,
    expiresAt,
    isLoading: subLoading,
    isInitialized,
  } = useSubscriptionStore();

  const {
    usage,
    isLoading: usageLoading,
    canPerformAction: checkAction,
    getRemainingQuota: getRemaining,
  } = useUsageStore();

  // Check if user has a premium feature
  const hasFeature = useCallback((feature: PremiumFeature): boolean => {
    switch (feature) {
      case 'chat':
        // Chat requires premium and active subscription
        return isPremium && isActive;

      case 'force_fresh_analysis':
        // Premium users can bypass cache
        return isPremium && isActive;

      case 'unlimited_usage':
        // Premium users have unlimited usage
        return isPremium && isActive;

      case 'story_mode':
        // Story mode is premium only
        return isPremium && isActive;

      default:
        return false;
    }
  }, [isPremium, isActive]);

  // Check if user can perform a usage-gated action
  const canPerformAction = useCallback((actionType: UsageGatedFeature): boolean => {
    // Premium users with active subscription have unlimited access
    if (isPremium && isActive) {
      return true;
    }

    // Check usage limits for free users
    return checkAction(actionType);
  }, [isPremium, isActive, checkAction]);

  // Get remaining quota for an action
  const getRemainingQuota = useCallback((actionType: UsageGatedFeature): number => {
    // Premium users have unlimited (-1 represents infinity)
    if (isPremium && isActive) {
      return Infinity;
    }

    return getRemaining(actionType);
  }, [isPremium, isActive, getRemaining]);

  // Get detailed usage info for an action
  const getUsageInfo = useCallback((actionType: UsageGatedFeature) => {
    const data = usage[actionType];

    if (isPremium && isActive) {
      return { used: 0, limit: -1, remaining: Infinity };
    }

    if (!data) {
      return { used: 0, limit: 0, remaining: 0 };
    }

    return {
      used: data.used,
      limit: data.dailyLimit,
      remaining: data.remaining,
    };
  }, [usage, isPremium, isActive]);

  // Should show paywall (user is on free tier)
  const shouldShowPaywall = useMemo(() => {
    return !isPremium || !isActive;
  }, [isPremium, isActive]);

  // Should show upgrade banner (user is close to limits or on free tier)
  const shouldShowUpgradeBanner = useMemo(() => {
    if (isPremium && isActive) {
      return false;
    }

    // Check if any quota is low (less than 20% remaining)
    const actionTypes: UsageGatedFeature[] = [
      'translation',
      'cefr_analysis',
      'verb_analysis',
      'verb_conjugation',
    ];

    return actionTypes.some((actionType) => {
      const data = usage[actionType];
      if (!data || data.dailyLimit <= 0) return false;
      return data.remaining <= data.dailyLimit * 0.2;
    });
  }, [isPremium, isActive, usage]);

  const isLoading = !isInitialized || subLoading || usageLoading;

  return {
    tier,
    isPremium,
    isActive,
    isGrandfathered,
    grandfatheredUntil,
    expiresAt,
    isLoading,
    hasFeature,
    canPerformAction,
    getRemainingQuota,
    getUsageInfo,
    shouldShowPaywall,
    shouldShowUpgradeBanner,
  };
};

export default useFeatureAccess;

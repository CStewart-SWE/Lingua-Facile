import { create } from 'zustand';
import { supabase } from '../../utils/supabase';

export type SubscriptionTier = 'free' | 'premium';
export type SubscriptionStatus = 'none' | 'active' | 'cancelled' | 'expired' | 'grace_period' | 'trial';

interface SubscriptionState {
  // Subscription info
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  expiresAt: string | null;
  isGrandfathered: boolean;
  grandfatheredUntil: string | null;

  // Loading state
  isLoading: boolean;
  isInitialized: boolean;

  // Computed helpers
  isPremium: boolean;
  isActive: boolean;

  // Actions
  setSubscription: (data: Partial<SubscriptionState>) => void;
  fetchSubscription: (userId: string) => Promise<void>;
  reset: () => void;
}

const initialState = {
  tier: 'free' as SubscriptionTier,
  status: 'none' as SubscriptionStatus,
  expiresAt: null,
  isGrandfathered: false,
  grandfatheredUntil: null,
  isLoading: true,
  isInitialized: false,
  isPremium: false,
  isActive: false,
};

export const useSubscriptionStore = create<SubscriptionState>((set, get) => ({
  ...initialState,

  setSubscription: (data) => {
    const newState = { ...get(), ...data };
    // Compute derived state
    const isPremium = newState.tier === 'premium';
    const isActive = ['active', 'trial', 'grace_period'].includes(newState.status);

    set({
      ...data,
      isPremium,
      isActive,
    });
  },

  fetchSubscription: async (userId: string) => {
    set({ isLoading: true });

    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('subscription_tier, subscription_status, subscription_expires_at, is_grandfathered, grandfathered_until')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Failed to fetch subscription:', error);
        set({ isLoading: false, isInitialized: true });
        return;
      }

      if (data) {
        const tier = (data.subscription_tier || 'free') as SubscriptionTier;
        const status = (data.subscription_status || 'none') as SubscriptionStatus;
        const isPremium = tier === 'premium';
        const isActive = ['active', 'trial', 'grace_period'].includes(status);

        // Check if grandfathered period has expired
        let actualTier = tier;
        let actualStatus = status;
        if (data.is_grandfathered && data.grandfathered_until) {
          const expiryDate = new Date(data.grandfathered_until);
          if (expiryDate < new Date()) {
            // Grandfathered period expired, revert to free
            actualTier = 'free';
            actualStatus = 'expired';
          }
        }

        set({
          tier: actualTier,
          status: actualStatus,
          expiresAt: data.subscription_expires_at,
          isGrandfathered: data.is_grandfathered || false,
          grandfatheredUntil: data.grandfathered_until,
          isPremium: actualTier === 'premium',
          isActive: ['active', 'trial', 'grace_period'].includes(actualStatus),
          isLoading: false,
          isInitialized: true,
        });
      } else {
        set({ isLoading: false, isInitialized: true });
      }
    } catch (error) {
      console.error('Subscription fetch error:', error);
      set({ isLoading: false, isInitialized: true });
    }
  },

  reset: () => set(initialState),
}));

import { create } from 'zustand';
import { supabase } from '../../utils/supabase';

export type ActionType =
  | 'translation'
  | 'cefr_analysis'
  | 'verb_analysis'
  | 'verb_conjugation'
  | 'language_detection'
  | 'chat_message';

interface UsageData {
  used: number;
  dailyLimit: number;
  remaining: number;
}

interface UsageState {
  // Usage data per action type
  usage: Record<ActionType, UsageData>;

  // Loading state
  isLoading: boolean;
  lastFetchDate: string | null;

  // Actions
  fetchUsage: (userId: string) => Promise<void>;
  canPerformAction: (actionType: ActionType) => boolean;
  getRemainingQuota: (actionType: ActionType) => number;
  incrementUsage: (actionType: ActionType) => void;
  logUsage: (userId: string, actionType: ActionType) => Promise<boolean>;
  reset: () => void;
}

const defaultUsage: UsageData = {
  used: 0,
  dailyLimit: 0,
  remaining: 0,
};

const initialUsage: Record<ActionType, UsageData> = {
  translation: { ...defaultUsage },
  cefr_analysis: { ...defaultUsage },
  verb_analysis: { ...defaultUsage },
  verb_conjugation: { ...defaultUsage },
  language_detection: { ...defaultUsage },
  chat_message: { ...defaultUsage },
};

export const useUsageStore = create<UsageState>((set, get) => ({
  usage: initialUsage,
  isLoading: true,
  lastFetchDate: null,

  fetchUsage: async (userId: string) => {
    const today = new Date().toISOString().split('T')[0];

    // Skip if already fetched today
    if (get().lastFetchDate === today && !get().isLoading) {
      return;
    }

    set({ isLoading: true });

    try {
      // Call the database function that returns all usage stats
      const { data, error } = await supabase.rpc('get_usage_summary', {
        p_user_id: userId,
      });

      if (error) {
        console.error('Failed to fetch usage:', error);
        set({ isLoading: false });
        return;
      }

      if (data && Array.isArray(data)) {
        const newUsage = { ...initialUsage };

        data.forEach((row: { action_type: ActionType; used: number; daily_limit: number; remaining: number }) => {
          if (row.action_type in newUsage) {
            newUsage[row.action_type] = {
              used: row.used,
              dailyLimit: row.daily_limit,
              remaining: row.remaining,
            };
          }
        });

        set({
          usage: newUsage,
          lastFetchDate: today,
          isLoading: false,
        });
      } else {
        set({ isLoading: false });
      }
    } catch (error) {
      console.error('Usage fetch error:', error);
      set({ isLoading: false });
    }
  },

  canPerformAction: (actionType: ActionType) => {
    const { usage } = get();
    const data = usage[actionType];

    if (!data) return false;

    // -1 means unlimited
    if (data.dailyLimit === -1) return true;

    // 0 means disabled
    if (data.dailyLimit === 0) return false;

    return data.used < data.dailyLimit;
  },

  getRemainingQuota: (actionType: ActionType) => {
    const { usage } = get();
    const data = usage[actionType];

    if (!data) return 0;

    // -1 means unlimited
    if (data.dailyLimit === -1) return Infinity;

    return data.remaining;
  },

  incrementUsage: (actionType: ActionType) => {
    set((state) => {
      const currentData = state.usage[actionType];
      if (!currentData) return state;

      const newUsed = currentData.used + 1;
      const newRemaining = currentData.dailyLimit === -1
        ? -1
        : Math.max(0, currentData.dailyLimit - newUsed);

      return {
        usage: {
          ...state.usage,
          [actionType]: {
            ...currentData,
            used: newUsed,
            remaining: newRemaining,
          },
        },
      };
    });
  },

  logUsage: async (userId: string, actionType: ActionType) => {
    try {
      // Call the database function that logs usage atomically
      const { data, error } = await supabase.rpc('log_usage', {
        p_user_id: userId,
        p_action_type: actionType,
        p_metadata: {},
      });

      if (error) {
        console.error('Failed to log usage:', error);
        return false;
      }

      if (data && data.length > 0) {
        const result = data[0];

        if (result.success) {
          // Update local state with server response
          set((state) => ({
            usage: {
              ...state.usage,
              [actionType]: {
                used: result.used,
                dailyLimit: result.daily_limit,
                remaining: result.remaining,
              },
            },
          }));
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error('Log usage error:', error);
      return false;
    }
  },

  reset: () => set({
    usage: initialUsage,
    isLoading: true,
    lastFetchDate: null,
  }),
}));

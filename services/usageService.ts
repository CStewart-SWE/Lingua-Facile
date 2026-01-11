// Usage tracking service for API limit enforcement
import { supabase } from '../utils/supabase';
import { useUsageStore, ActionType } from '../app/store/useUsageStore';

export { ActionType } from '../app/store/useUsageStore';

/**
 * Error thrown when usage limit is exceeded
 */
export class UsageLimitExceededError extends Error {
  actionType: ActionType;
  remaining: number;
  dailyLimit: number;

  constructor(actionType: ActionType, remaining: number, dailyLimit: number) {
    const message = dailyLimit === 0
      ? `${actionType} is not available on your current plan. Upgrade to Premium to unlock this feature.`
      : `Daily limit exceeded for ${actionType}. You've used all ${dailyLimit} allowed today.`;

    super(message);
    this.name = 'UsageLimitExceededError';
    this.actionType = actionType;
    this.remaining = remaining;
    this.dailyLimit = dailyLimit;
  }
}

/**
 * Check if an action can be performed (without logging)
 */
export const checkUsageLimit = async (
  userId: string,
  actionType: ActionType
): Promise<{ allowed: boolean; used: number; dailyLimit: number; remaining: number }> => {
  try {
    const { data, error } = await supabase.rpc('check_usage_limit', {
      p_user_id: userId,
      p_action_type: actionType,
    });

    if (error) {
      console.error('Failed to check usage limit:', error);
      // Default to allowed on error to not block users
      return { allowed: true, used: 0, dailyLimit: -1, remaining: -1 };
    }

    if (data && data.length > 0) {
      const result = data[0];
      return {
        allowed: result.allowed,
        used: result.used,
        dailyLimit: result.daily_limit,
        remaining: result.remaining,
      };
    }

    return { allowed: true, used: 0, dailyLimit: -1, remaining: -1 };
  } catch (error) {
    console.error('Check usage limit error:', error);
    return { allowed: true, used: 0, dailyLimit: -1, remaining: -1 };
  }
};

/**
 * Log usage and check limit atomically
 * Returns true if action was logged, false if limit exceeded
 */
export const logUsage = async (
  userId: string,
  actionType: ActionType,
  metadata?: Record<string, any>
): Promise<{ success: boolean; used: number; dailyLimit: number; remaining: number }> => {
  try {
    const { data, error } = await supabase.rpc('log_usage', {
      p_user_id: userId,
      p_action_type: actionType,
      p_metadata: metadata || {},
    });

    if (error) {
      console.error('Failed to log usage:', error);
      // Return success on error to not block users
      return { success: true, used: 0, dailyLimit: -1, remaining: -1 };
    }

    if (data && data.length > 0) {
      const result = data[0];

      // Update local store
      useUsageStore.getState().incrementUsage(actionType);

      return {
        success: result.success,
        used: result.used,
        dailyLimit: result.daily_limit,
        remaining: result.remaining,
      };
    }

    return { success: true, used: 0, dailyLimit: -1, remaining: -1 };
  } catch (error) {
    console.error('Log usage error:', error);
    return { success: true, used: 0, dailyLimit: -1, remaining: -1 };
  }
};

/**
 * Check and log usage - throws if limit exceeded
 * Use this before performing an action
 */
export const checkAndLogUsage = async (
  userId: string,
  actionType: ActionType,
  metadata?: Record<string, any>
): Promise<void> => {
  const result = await logUsage(userId, actionType, metadata);

  if (!result.success) {
    throw new UsageLimitExceededError(actionType, result.remaining, result.dailyLimit);
  }
};

/**
 * Wrapper function to add usage tracking to any service function
 * Use this to wrap existing service calls with usage tracking
 */
export const withUsageTracking = <TArgs extends any[], TResult>(
  actionType: ActionType,
  serviceFn: (...args: TArgs) => Promise<TResult>
) => {
  return async (userId: string, ...args: TArgs): Promise<TResult> => {
    await checkAndLogUsage(userId, actionType);
    return serviceFn(...args);
  };
};

/**
 * Get all usage stats for display
 */
export const getUsageSummary = async (userId: string) => {
  try {
    const { data, error } = await supabase.rpc('get_usage_summary', {
      p_user_id: userId,
    });

    if (error) {
      console.error('Failed to get usage summary:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Get usage summary error:', error);
    return null;
  }
};

/**
 * Refresh usage data in the store
 */
export const refreshUsage = async (userId: string): Promise<void> => {
  await useUsageStore.getState().fetchUsage(userId);
};

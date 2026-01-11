-- ============================================
-- LINGUA FACILE - COMPLETE DATABASE SCHEMA
-- ============================================
-- Run this in the Supabase SQL editor
-- This creates all tables for subscriptions, usage tracking, and user preferences

-- ===========================================
-- 1. USER_PROFILES TABLE
-- Core user data, subscription state, and RevenueCat linking
-- ===========================================
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- RevenueCat integration
  revenuecat_app_user_id TEXT UNIQUE,

  -- Subscription state (synced from RevenueCat via webhooks)
  subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'premium')),
  subscription_status TEXT DEFAULT 'none' CHECK (subscription_status IN ('none', 'active', 'cancelled', 'expired', 'grace_period', 'trial')),
  subscription_expires_at TIMESTAMPTZ,
  subscription_started_at TIMESTAMPTZ,
  subscription_platform TEXT CHECK (subscription_platform IN ('ios', 'android', 'web', NULL)),
  subscription_product_id TEXT,

  -- Grandfathering for existing users
  is_grandfathered BOOLEAN DEFAULT FALSE,
  grandfathered_until TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_revenuecat ON user_profiles(revenuecat_app_user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_subscription ON user_profiles(subscription_tier, subscription_status);

-- ===========================================
-- 2. USER_PREFERENCES TABLE
-- Synced settings (replaces AsyncStorage for cross-device sync)
-- ===========================================
CREATE TABLE IF NOT EXISTS public.user_preferences (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Language preferences
  native_language TEXT DEFAULT 'EN',
  target_language TEXT DEFAULT 'IT',

  -- CEFR settings
  cefr_levels_selected TEXT[] DEFAULT ARRAY['A1','A2','B1','B2','C1','C2'],
  cefr_dynamic_check BOOLEAN DEFAULT FALSE,

  -- Voice/TTS settings
  pronunciation_voice_map JSONB DEFAULT '{}'::jsonb,

  -- App preferences
  theme TEXT DEFAULT 'system' CHECK (theme IN ('light', 'dark', 'system')),
  haptics_enabled BOOLEAN DEFAULT TRUE,
  auto_detect_language BOOLEAN DEFAULT TRUE,

  -- Premium features
  force_fresh_analysis BOOLEAN DEFAULT FALSE, -- Premium: bypass cache

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================================
-- 3. USAGE_LOGS TABLE
-- Track API usage per user per day
-- ===========================================
CREATE TABLE IF NOT EXISTS public.usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (action_type IN (
    'translation',
    'cefr_analysis',
    'verb_analysis',
    'verb_conjugation',
    'language_detection',
    'chat_message'
  )),
  usage_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Optional metadata for analytics
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_usage_logs_daily ON usage_logs(user_id, action_type, usage_date);
CREATE INDEX IF NOT EXISTS idx_usage_logs_date ON usage_logs(usage_date);

-- ===========================================
-- 4. USAGE_LIMITS TABLE
-- Configurable limits per subscription tier
-- ===========================================
CREATE TABLE IF NOT EXISTS public.usage_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_tier TEXT NOT NULL,
  action_type TEXT NOT NULL,
  daily_limit INTEGER NOT NULL, -- -1 = unlimited, 0 = disabled
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(subscription_tier, action_type)
);

-- Seed free tier limits
INSERT INTO public.usage_limits (subscription_tier, action_type, daily_limit, description) VALUES
  ('free', 'translation', 10, 'Translations per day'),
  ('free', 'cefr_analysis', 5, 'CEFR analyses per day'),
  ('free', 'verb_analysis', 5, 'Verb analyses per day'),
  ('free', 'verb_conjugation', 10, 'Verb conjugations per day'),
  ('free', 'language_detection', 20, 'Language detections per day'),
  ('free', 'chat_message', 0, 'AI chat messages (disabled)')
ON CONFLICT (subscription_tier, action_type) DO UPDATE SET
  daily_limit = EXCLUDED.daily_limit,
  description = EXCLUDED.description,
  updated_at = NOW();

-- Seed premium tier limits (unlimited = -1)
INSERT INTO public.usage_limits (subscription_tier, action_type, daily_limit, description) VALUES
  ('premium', 'translation', -1, 'Unlimited translations'),
  ('premium', 'cefr_analysis', -1, 'Unlimited CEFR analyses'),
  ('premium', 'verb_analysis', -1, 'Unlimited verb analyses'),
  ('premium', 'verb_conjugation', -1, 'Unlimited verb conjugations'),
  ('premium', 'language_detection', -1, 'Unlimited language detection'),
  ('premium', 'chat_message', -1, 'Unlimited AI chat')
ON CONFLICT (subscription_tier, action_type) DO UPDATE SET
  daily_limit = EXCLUDED.daily_limit,
  description = EXCLUDED.description,
  updated_at = NOW();

-- ===========================================
-- 5. SUBSCRIPTION_EVENTS TABLE
-- Webhook audit log for RevenueCat events
-- ===========================================
CREATE TABLE IF NOT EXISTS public.subscription_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  revenuecat_app_user_id TEXT,
  event_type TEXT NOT NULL,
  event_data JSONB NOT NULL,
  event_id TEXT UNIQUE, -- RevenueCat event ID for idempotency
  processed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_events_user ON subscription_events(user_id);
CREATE INDEX IF NOT EXISTS idx_subscription_events_type ON subscription_events(event_type);
CREATE INDEX IF NOT EXISTS idx_subscription_events_date ON subscription_events(processed_at);

-- ===========================================
-- 6. GLOBAL CACHE TABLES (existing, keep as-is)
-- These remain global to save API costs
-- ===========================================

-- openai_cache already exists - no changes needed
-- verb_analysis already exists - no changes needed
-- verb_conjugations already exists - no changes needed

-- ===========================================
-- 7. ROW LEVEL SECURITY POLICIES
-- ===========================================

-- Enable RLS on all user tables
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for clean re-run)
DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can view own preferences" ON public.user_preferences;
DROP POLICY IF EXISTS "Users can update own preferences" ON public.user_preferences;
DROP POLICY IF EXISTS "Users can insert own preferences" ON public.user_preferences;
DROP POLICY IF EXISTS "Users can view own usage" ON public.usage_logs;
DROP POLICY IF EXISTS "Users can insert own usage" ON public.usage_logs;
DROP POLICY IF EXISTS "Anyone can view usage limits" ON public.usage_limits;

-- user_profiles policies
CREATE POLICY "Users can view own profile" ON public.user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.user_profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- user_preferences policies
CREATE POLICY "Users can view own preferences" ON public.user_preferences
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own preferences" ON public.user_preferences
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own preferences" ON public.user_preferences
  FOR INSERT WITH CHECK (auth.uid() = id);

-- usage_logs policies
CREATE POLICY "Users can view own usage" ON public.usage_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own usage" ON public.usage_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- usage_limits: public read access
CREATE POLICY "Anyone can view usage limits" ON public.usage_limits
  FOR SELECT USING (true);

-- subscription_events: service role only (no user access)
-- Handled by edge functions with service role key

-- ===========================================
-- 8. HELPER FUNCTIONS
-- ===========================================

-- Get user's current subscription tier (with fallback)
CREATE OR REPLACE FUNCTION public.get_user_tier(p_user_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (SELECT subscription_tier FROM public.user_profiles WHERE id = p_user_id),
    'free'
  );
$$;

-- Get daily usage count for a specific action
CREATE OR REPLACE FUNCTION public.get_daily_usage(
  p_user_id UUID,
  p_action_type TEXT,
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(COUNT(*)::INTEGER, 0)
  FROM public.usage_logs
  WHERE user_id = p_user_id
    AND action_type = p_action_type
    AND usage_date = p_date;
$$;

-- Check if user can perform an action (returns limit info)
CREATE OR REPLACE FUNCTION public.check_usage_limit(
  p_user_id UUID,
  p_action_type TEXT
)
RETURNS TABLE(
  allowed BOOLEAN,
  used INTEGER,
  daily_limit INTEGER,
  remaining INTEGER,
  tier TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_tier TEXT;
  v_limit INTEGER;
  v_used INTEGER;
BEGIN
  -- Get tier
  v_tier := public.get_user_tier(p_user_id);

  -- Get limit for this tier/action
  SELECT ul.daily_limit INTO v_limit
  FROM public.usage_limits ul
  WHERE ul.subscription_tier = v_tier
    AND ul.action_type = p_action_type;

  -- Default to 0 if not found
  v_limit := COALESCE(v_limit, 0);

  -- Get current usage
  v_used := public.get_daily_usage(p_user_id, p_action_type);

  RETURN QUERY SELECT
    CASE
      WHEN v_limit = -1 THEN TRUE  -- unlimited
      WHEN v_limit = 0 THEN FALSE  -- disabled
      ELSE v_used < v_limit        -- check limit
    END AS allowed,
    v_used AS used,
    v_limit AS daily_limit,
    CASE
      WHEN v_limit = -1 THEN -1    -- unlimited
      WHEN v_limit = 0 THEN 0      -- disabled
      ELSE GREATEST(0, v_limit - v_used)
    END AS remaining,
    v_tier AS tier;
END;
$$;

-- Log usage and return updated counts (atomic operation)
CREATE OR REPLACE FUNCTION public.log_usage(
  p_user_id UUID,
  p_action_type TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE(
  success BOOLEAN,
  used INTEGER,
  daily_limit INTEGER,
  remaining INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_check RECORD;
BEGIN
  -- Check limit first
  SELECT * INTO v_check FROM public.check_usage_limit(p_user_id, p_action_type);

  IF NOT v_check.allowed THEN
    RETURN QUERY SELECT
      FALSE AS success,
      v_check.used,
      v_check.daily_limit,
      v_check.remaining;
    RETURN;
  END IF;

  -- Log the usage
  INSERT INTO public.usage_logs (user_id, action_type, metadata)
  VALUES (p_user_id, p_action_type, p_metadata);

  -- Return updated counts
  RETURN QUERY SELECT
    TRUE AS success,
    v_check.used + 1 AS used,
    v_check.daily_limit,
    CASE
      WHEN v_check.daily_limit = -1 THEN -1
      ELSE GREATEST(0, v_check.daily_limit - v_check.used - 1)
    END AS remaining;
END;
$$;

-- Get all usage stats for a user (for dashboard display)
CREATE OR REPLACE FUNCTION public.get_usage_summary(p_user_id UUID)
RETURNS TABLE(
  action_type TEXT,
  used INTEGER,
  daily_limit INTEGER,
  remaining INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  WITH user_tier AS (
    SELECT public.get_user_tier(p_user_id) AS tier
  ),
  today_usage AS (
    SELECT ul.action_type, COUNT(*)::INTEGER AS used
    FROM public.usage_logs ul
    WHERE ul.user_id = p_user_id
      AND ul.usage_date = CURRENT_DATE
    GROUP BY ul.action_type
  )
  SELECT
    lim.action_type,
    COALESCE(tu.used, 0) AS used,
    lim.daily_limit,
    CASE
      WHEN lim.daily_limit = -1 THEN -1
      WHEN lim.daily_limit = 0 THEN 0
      ELSE GREATEST(0, lim.daily_limit - COALESCE(tu.used, 0))
    END AS remaining
  FROM public.usage_limits lim
  CROSS JOIN user_tier ut
  LEFT JOIN today_usage tu ON tu.action_type = lim.action_type
  WHERE lim.subscription_tier = ut.tier;
$$;

-- ===========================================
-- 9. TRIGGER: Auto-update updated_at
-- ===========================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS user_preferences_updated_at ON public.user_preferences;
CREATE TRIGGER user_preferences_updated_at
  BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ===========================================
-- 10. TRIGGER: Auto-create profile on user signup
-- ===========================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Create user profile
  INSERT INTO public.user_profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;

  -- Create user preferences with defaults
  INSERT INTO public.user_preferences (id)
  VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ===========================================
-- 11. MIGRATION: Create profiles for existing users
-- ===========================================
INSERT INTO public.user_profiles (id, email, subscription_tier, subscription_status, is_grandfathered, grandfathered_until)
SELECT
  id,
  email,
  'premium',  -- Give existing users premium
  'trial',
  TRUE,
  NOW() + INTERVAL '30 days'  -- 30-day trial
FROM auth.users
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_preferences (id)
SELECT id FROM auth.users
ON CONFLICT (id) DO NOTHING;

// supabase/functions/revenuecat-webhook/index.ts
// Handles RevenueCat webhook events and syncs subscription state to Supabase

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// RevenueCat webhook event types
type RevenueCatEventType =
  | 'INITIAL_PURCHASE'
  | 'RENEWAL'
  | 'CANCELLATION'
  | 'UNCANCELLATION'
  | 'EXPIRATION'
  | 'BILLING_ISSUE'
  | 'PRODUCT_CHANGE'
  | 'SUBSCRIBER_ALIAS'
  | 'SUBSCRIPTION_PAUSED'
  | 'SUBSCRIPTION_EXTENDED'
  | 'TRANSFER'
  | 'TEST';

interface RevenueCatWebhookPayload {
  api_version: string;
  event: {
    id: string;
    type: RevenueCatEventType;
    app_id: string;
    app_user_id: string;
    aliases: string[];
    original_app_user_id: string;
    product_id: string;
    entitlement_ids: string[];
    period_type: string;
    purchased_at_ms: number;
    expiration_at_ms: number | null;
    environment: string;
    store: string;
    is_trial_conversion?: boolean;
    cancel_reason?: string;
    price?: number;
    currency?: string;
    event_timestamp_ms: number;
  };
}

// Map product IDs to subscription tiers
function getSubscriptionTier(productId: string): 'free' | 'premium' {
  // Customize these based on your RevenueCat product IDs
  if (productId.includes('premium') || productId.includes('pro') || productId.includes('plus')) {
    return 'premium';
  }
  return 'free';
}

// Map event types to subscription status
function getSubscriptionStatus(
  eventType: RevenueCatEventType,
  currentStatus?: string
): 'none' | 'active' | 'cancelled' | 'expired' | 'grace_period' | 'trial' {
  switch (eventType) {
    case 'INITIAL_PURCHASE':
      return 'active';
    case 'RENEWAL':
    case 'UNCANCELLATION':
    case 'SUBSCRIPTION_EXTENDED':
      return 'active';
    case 'CANCELLATION':
      return 'cancelled'; // Still active until expiration
    case 'EXPIRATION':
      return 'expired';
    case 'BILLING_ISSUE':
      return 'grace_period';
    case 'SUBSCRIPTION_PAUSED':
      return 'cancelled';
    case 'PRODUCT_CHANGE':
      return 'active';
    default:
      return currentStatus as any || 'none';
  }
}

// Map store to platform
function getPlatform(store: string): 'ios' | 'android' | 'web' | null {
  switch (store.toLowerCase()) {
    case 'app_store':
    case 'mac_app_store':
      return 'ios';
    case 'play_store':
      return 'android';
    case 'stripe':
    case 'promotional':
      return 'web';
    default:
      return null;
  }
}

serve(async (req) => {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verify webhook authentication
    const authHeader = req.headers.get('Authorization');
    const webhookSecret = Deno.env.get('REVENUECAT_WEBHOOK_SECRET');

    if (webhookSecret && authHeader !== `Bearer ${webhookSecret}`) {
      console.error('Unauthorized webhook request');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse the webhook payload
    const payload: RevenueCatWebhookPayload = await req.json();
    const { event } = payload;

    console.log(`Processing RevenueCat event: ${event.type} for user: ${event.app_user_id}`);

    // Initialize Supabase client with service role (bypasses RLS)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Check for duplicate event (idempotency)
    const { data: existingEvent } = await supabase
      .from('subscription_events')
      .select('id')
      .eq('event_id', event.id)
      .maybeSingle();

    if (existingEvent) {
      console.log(`Event ${event.id} already processed, skipping`);
      return new Response(
        JSON.stringify({ success: true, message: 'Event already processed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // The app_user_id is the Supabase user ID
    const userId = event.app_user_id;

    // Determine subscription state from event
    const tier = event.type === 'EXPIRATION' ? 'free' : getSubscriptionTier(event.product_id);
    const status = getSubscriptionStatus(event.type);
    const platform = getPlatform(event.store);
    const expiresAt = event.expiration_at_ms
      ? new Date(event.expiration_at_ms).toISOString()
      : null;
    const startedAt = event.purchased_at_ms
      ? new Date(event.purchased_at_ms).toISOString()
      : null;

    // Update user profile
    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({
        subscription_tier: tier,
        subscription_status: status,
        subscription_expires_at: expiresAt,
        subscription_started_at: startedAt,
        subscription_platform: platform,
        subscription_product_id: event.product_id,
        revenuecat_app_user_id: userId,
        // Clear grandfathering when they purchase
        is_grandfathered: false,
        grandfathered_until: null,
      })
      .eq('id', userId);

    if (updateError) {
      console.error('Failed to update user profile:', updateError);
      // Don't fail the webhook - log the event anyway
    } else {
      console.log(`Updated user ${userId} to tier: ${tier}, status: ${status}`);
    }

    // Log the event for audit trail
    const { error: eventError } = await supabase
      .from('subscription_events')
      .insert({
        user_id: userId,
        revenuecat_app_user_id: event.app_user_id,
        event_type: event.type,
        event_data: payload,
        event_id: event.id,
      });

    if (eventError) {
      console.error('Failed to log subscription event:', eventError);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useFeatureAccess } from '../../hooks/useFeatureAccess';
import { Paywall } from '../../components/subscription/Paywall';

export default function ChatScreen() {
  const [paywallVisible, setPaywallVisible] = useState(false);
  const { hasFeature, isPremium, isLoading } = useFeatureAccess();

  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const tintColor = useThemeColor({}, 'tint');

  // Check if user has access to chat feature
  const hasAccess = hasFeature('chat');

  // Show loading state
  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor }]}>
        <Text style={[styles.loadingText, { color: textColor }]}>Loading...</Text>
      </View>
    );
  }

  // Show premium gate for free users
  if (!hasAccess) {
    return (
      <View style={[styles.container, { backgroundColor }]}>
        <Paywall
          visible={paywallVisible}
          onClose={() => setPaywallVisible(false)}
          feature="AI Chat Tutor"
        />

        <View style={styles.lockedContainer}>
          <View style={[styles.iconCircle, { backgroundColor: tintColor + '15' }]}>
            <Ionicons name="chatbubbles" size={64} color={tintColor} />
          </View>

          <Text style={[styles.title, { color: textColor }]}>AI Chat Tutor</Text>

          <Text style={[styles.description, { color: textColor + '80' }]}>
            Practice conversations with an AI tutor that adapts to your level and helps you improve your language skills.
          </Text>

          <View style={styles.featureList}>
            <FeatureItem icon="mic" text="Voice conversations" tintColor={tintColor} textColor={textColor} />
            <FeatureItem icon="school" text="Personalized lessons" tintColor={tintColor} textColor={textColor} />
            <FeatureItem icon="trending-up" text="Track your progress" tintColor={tintColor} textColor={textColor} />
            <FeatureItem icon="language" text="Multiple languages" tintColor={tintColor} textColor={textColor} />
          </View>

          <TouchableOpacity
            style={[styles.upgradeButton, { backgroundColor: tintColor }]}
            onPress={() => setPaywallVisible(true)}
          >
            <Ionicons name="star" size={20} color="#fff" />
            <Text style={styles.upgradeButtonText}>Upgrade to Premium</Text>
          </TouchableOpacity>

          <Text style={[styles.premiumNote, { color: textColor + '60' }]}>
            Unlock unlimited AI chat and all premium features
          </Text>
        </View>
      </View>
    );
  }

  // Premium user - show chat interface (placeholder for now)
  return (
    <View style={[styles.container, { backgroundColor }]}>
      <View style={styles.chatContainer}>
        <View style={[styles.comingSoonCard, { backgroundColor: tintColor + '10' }]}>
          <Ionicons name="construct" size={48} color={tintColor} />
          <Text style={[styles.comingSoonTitle, { color: textColor }]}>Coming Soon</Text>
          <Text style={[styles.comingSoonText, { color: textColor + '80' }]}>
            The AI Chat Tutor is being built. As a Premium member, you'll have full access when it launches!
          </Text>
        </View>
      </View>
    </View>
  );
}

interface FeatureItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  tintColor: string;
  textColor: string;
}

const FeatureItem: React.FC<FeatureItemProps> = ({ icon, text, tintColor, textColor }) => (
  <View style={styles.featureItem}>
    <Ionicons name={icon} size={20} color={tintColor} />
    <Text style={[styles.featureText, { color: textColor }]}>{text}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 100,
  },
  lockedContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  featureList: {
    width: '100%',
    marginBottom: 32,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  featureText: {
    fontSize: 16,
  },
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    marginBottom: 16,
  },
  upgradeButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  premiumNote: {
    fontSize: 14,
    textAlign: 'center',
  },
  chatContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  comingSoonCard: {
    alignItems: 'center',
    padding: 32,
    borderRadius: 16,
    width: '100%',
  },
  comingSoonTitle: {
    fontSize: 24,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  comingSoonText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
});

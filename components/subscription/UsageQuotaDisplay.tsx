import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useThemeColor } from '@/hooks/useThemeColor';
import { ActionType } from '../../app/store/useUsageStore';
import { useFeatureAccess } from '../../hooks/useFeatureAccess';
import { Ionicons } from '@expo/vector-icons';

interface UsageQuotaDisplayProps {
  actionType: ActionType;
  compact?: boolean;
  onUpgradePress?: () => void;
}

const ACTION_LABELS: Record<ActionType, string> = {
  translation: 'Translations',
  cefr_analysis: 'CEFR Analyses',
  verb_analysis: 'Verb Analyses',
  verb_conjugation: 'Conjugations',
  language_detection: 'Detections',
  chat_message: 'Chat Messages',
};

export const UsageQuotaDisplay: React.FC<UsageQuotaDisplayProps> = ({
  actionType,
  compact = false,
  onUpgradePress,
}) => {
  const textColor = useThemeColor({}, 'text');
  const tintColor = useThemeColor({}, 'tint');

  const { isPremium, getUsageInfo, isLoading } = useFeatureAccess();
  const { used, limit, remaining } = getUsageInfo(actionType);

  // Premium users have unlimited - show badge instead
  if (isPremium) {
    if (compact) {
      return (
        <View style={styles.premiumBadge}>
          <Ionicons name="infinite" size={16} color={tintColor} />
        </View>
      );
    }

    return (
      <View style={styles.container}>
        <View style={[styles.premiumBadgeFull, { backgroundColor: tintColor + '20' }]}>
          <Ionicons name="infinite" size={18} color={tintColor} />
          <Text style={[styles.premiumText, { color: tintColor }]}>Unlimited</Text>
        </View>
      </View>
    );
  }

  // Feature is disabled (limit = 0)
  if (limit === 0) {
    return (
      <TouchableOpacity
        style={[styles.lockedContainer, { backgroundColor: '#FF5722' + '15' }]}
        onPress={onUpgradePress}
      >
        <Ionicons name="lock-closed" size={16} color="#FF5722" />
        <Text style={[styles.lockedText, { color: '#FF5722' }]}>Premium Only</Text>
      </TouchableOpacity>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={[styles.progressBar, { backgroundColor: textColor + '10' }]}>
          <View style={[styles.progressFill, { width: '50%', backgroundColor: textColor + '20' }]} />
        </View>
      </View>
    );
  }

  // Calculate percentage
  const percentage = limit > 0 ? (used / limit) * 100 : 0;
  const isLow = percentage >= 80;
  const isExhausted = remaining === 0;

  // Determine color based on usage
  let progressColor = '#4CAF50'; // Green
  if (isExhausted) {
    progressColor = '#F44336'; // Red
  } else if (isLow) {
    progressColor = '#FF9800'; // Orange
  }

  if (compact) {
    return (
      <View style={styles.compactContainer}>
        <Text style={[styles.compactText, { color: isExhausted ? '#F44336' : textColor + '80' }]}>
          {remaining}/{limit}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.label, { color: textColor }]}>{ACTION_LABELS[actionType]}</Text>
        <Text style={[styles.count, { color: isExhausted ? '#F44336' : textColor }]}>
          {remaining} left today
        </Text>
      </View>

      <View style={[styles.progressBar, { backgroundColor: textColor + '15' }]}>
        <View
          style={[
            styles.progressFill,
            { width: `${Math.min(percentage, 100)}%`, backgroundColor: progressColor },
          ]}
        />
      </View>

      <View style={styles.footer}>
        <Text style={[styles.usageText, { color: textColor + '60' }]}>
          {used} of {limit} used
        </Text>

        {isExhausted && onUpgradePress && (
          <TouchableOpacity onPress={onUpgradePress}>
            <Text style={[styles.upgradeLink, { color: tintColor }]}>Upgrade for unlimited</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

interface UsageWarningBannerProps {
  actionType: ActionType;
  onUpgradePress?: () => void;
}

export const UsageWarningBanner: React.FC<UsageWarningBannerProps> = ({
  actionType,
  onUpgradePress,
}) => {
  const { isPremium, getUsageInfo } = useFeatureAccess();
  const { limit, remaining } = getUsageInfo(actionType);

  // Don't show for premium users or if not low on quota
  if (isPremium || limit <= 0 || remaining > limit * 0.2) {
    return null;
  }

  const isExhausted = remaining === 0;

  return (
    <TouchableOpacity
      style={[
        styles.warningBanner,
        { backgroundColor: isExhausted ? '#F44336' + '15' : '#FF9800' + '15' },
      ]}
      onPress={onUpgradePress}
    >
      <Ionicons
        name={isExhausted ? 'warning' : 'alert-circle'}
        size={20}
        color={isExhausted ? '#F44336' : '#FF9800'}
      />
      <Text style={[styles.warningText, { color: isExhausted ? '#F44336' : '#FF9800' }]}>
        {isExhausted
          ? `Daily ${ACTION_LABELS[actionType].toLowerCase()} limit reached`
          : `Only ${remaining} ${ACTION_LABELS[actionType].toLowerCase()} left today`}
      </Text>
      <Ionicons
        name="chevron-forward"
        size={16}
        color={isExhausted ? '#F44336' : '#FF9800'}
      />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
  },
  count: {
    fontSize: 14,
    fontWeight: '600',
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  usageText: {
    fontSize: 12,
  },
  upgradeLink: {
    fontSize: 12,
    fontWeight: '600',
  },
  compactContainer: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  compactText: {
    fontSize: 12,
    fontWeight: '500',
  },
  premiumBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  premiumBadgeFull: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  premiumText: {
    fontSize: 14,
    fontWeight: '600',
  },
  lockedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  lockedText: {
    fontSize: 14,
    fontWeight: '600',
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginVertical: 8,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
});

export default UsageQuotaDisplay;

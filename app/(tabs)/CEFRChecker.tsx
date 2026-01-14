import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, Keyboard, Pressable, TouchableOpacity } from 'react-native';
import { fetchCEFRLevels, CEFRResponse } from '../../services/cefrService';
import { getVerbData } from "@/services/getVerbData";
import { useCEFRSettings } from '../store/useCEFRSettings';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { MotiView } from 'moti';
import { CEFRInput } from '../../components/cefr/CEFRInput';
import { useClipboardWatcher } from '../../hooks/useClipboardWatcher';

// Usage tracking imports
import { supabase } from '../../utils/supabase';
import { useFeatureAccess } from '../../hooks/useFeatureAccess';
import { checkAndLogUsage, UsageLimitExceededError } from '../../services/usageService';
import { UsageWarningBanner } from '../../components/subscription/UsageQuotaDisplay';
import { Paywall } from '../../components/subscription/Paywall';

const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

const LEVEL_COLORS: Record<string, string> = {
  A1: '#2ecc71',
  A2: '#27ae60',
  B1: '#f1c40f',
  B2: '#e67e22',
  C1: '#e74c3c',
  C2: '#8e44ad',
};

export default function CEFRChecker() {
  const { selectedLevels, dynamicCheck, hydrate } = useCEFRSettings();
  const [input, setInput] = useState('');
  const [result, setResult] = useState<CEFRResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<CEFRResponse['analysis'] | null>(null);
  const [analyzedInput, setAnalyzedInput] = useState('');
  const [showAnalysis, setShowAnalysis] = useState(true);
  const [showResults, setShowResults] = useState(true);
  const [inputFocused, setInputFocused] = useState(false);

  // Usage tracking
  const [paywallVisible, setPaywallVisible] = useState(false);
  const { canPerformAction, isPremium } = useFeatureAccess();

  const hasClipboardContent = useClipboardWatcher();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const getNextLevel = (level: string) => {
    const idx = CEFR_LEVELS.indexOf(level);
    if (idx >= 0 && idx < CEFR_LEVELS.length - 1) {
      return [CEFR_LEVELS[idx + 1]];
    }
    return [];
  };

  const handleCheck = async () => {
    if (!isPremium && !canPerformAction('cefr_analysis')) {
      setPaywallVisible(true);
      return;
    }

    setShowAnalysis(true);
    setShowResults(true);
    setLoading(true);
    setError(null);
    setResult(null);
    setAnalysis(null);
    setAnalyzedInput('');

    try {
      if (!isPremium) {
        const { data: userData } = await supabase.auth.getUser();
        if (userData.user) {
          await checkAndLogUsage(userData.user.id, 'cefr_analysis', {
            textLength: input.length,
            dynamicCheck,
          });
        }
      }

      const res = await fetchCEFRLevels(input, selectedLevels, dynamicCheck);
      setResult(res);
      setAnalysis(res.analysis);
      setAnalyzedInput(input);
    } catch (e: any) {
      if (e instanceof UsageLimitExceededError) {
        setPaywallVisible(true);
        setLoading(false);
        return;
      }
      setError(e.message || 'An error occurred');
    } finally {
      setLoading(false);
    }

    console.log(await getVerbData(input));
  };

  const scrollRef = React.useRef<ScrollView>(null);

  return (
    <View style={styles.mainContainer}>
      <Paywall
        visible={paywallVisible}
        onClose={() => setPaywallVisible(false)}
        feature="CEFR Analysis"
      />

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {!isPremium && (
          <UsageWarningBanner
            actionType="cefr_analysis"
            onUpgradePress={() => setPaywallVisible(true)}
          />
        )}

        <Animated.View entering={FadeIn.duration(500)} style={styles.inputSection}>
          <CEFRInput
            input={input}
            setInput={setInput}
            loading={loading}
            onSubmit={() => {
              if (input.trim() && !loading) {
                Keyboard.dismiss();
                handleCheck();
              }
            }}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            inputFocused={inputFocused}
            hasClipboardContent={hasClipboardContent}
          />
          
          <Pressable
            style={({ pressed }) => [
              styles.checkButton,
              (!input.trim() || loading) && styles.checkButtonDisabled,
              pressed && styles.checkButtonPressed
            ]}
            onPress={() => {
              Keyboard.dismiss();
              handleCheck();
            }}
            disabled={loading || !input.trim()}
          >
            {loading ? (
                <Text style={styles.checkButtonText}>Analyzing...</Text>
            ) : (
                <>
                    <Ionicons name="sparkles" size={20} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={styles.checkButtonText}>Check Complexity</Text>
                </>
            )}
          </Pressable>
        </Animated.View>

        <View style={styles.settingsBadge}>
           <Ionicons name={dynamicCheck ? 'flash' : 'list'} size={14} color="#666" style={{ marginRight: 6 }} />
           <Text style={styles.settingsText}>
             {dynamicCheck ? 'Dynamic Level Detection' : `Target: ${selectedLevels.join(', ')}`}
           </Text>
        </View>

        {error && (
            <Animated.View entering={FadeIn} style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={24} color="#e74c3c" />
                <Text style={styles.errorText}>{error}</Text>
            </Animated.View>
        )}

        {analysis && showAnalysis && (
          <Animated.View
            entering={FadeIn.duration(600).springify()}
            exiting={FadeOut.duration(300)}
            style={styles.analysisCard}
          >
            <View style={styles.analysisHeader}>
                <Text style={styles.analysisTitle}>Overall Level</Text>
                <View style={[styles.levelBadgeBig, { backgroundColor: LEVEL_COLORS[analysis.level] || '#999' }]}>
                    <Text style={styles.levelBadgeTextBig}>{analysis.level}</Text>
                </View>
            </View>
            
            <View style={styles.divider} />
            
            <Text style={styles.analysisLabel}>Why this level?</Text>
            <Text style={styles.analysisText}>{analysis.justification}</Text>
            
            <Text style={styles.analysisLabel}>Analyzed Text</Text>
            <Text style={[styles.analysisText, { fontStyle: 'italic', opacity: 0.8 }]}>"{analyzedInput}"</Text>

            <TouchableOpacity onPress={() => setShowAnalysis(false)} style={styles.dismissButton}>
                <Text style={styles.dismissText}>Dismiss Analysis</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {result && showResults && (
          <View style={styles.resultsList}>
            <Text style={styles.sectionHeader}>Detailed Breakdown</Text>
            {(
              (dynamicCheck && analysis?.level)
                ? result.results.filter(r => r.level === getNextLevel(analysis.level)[0])
                : result.results.filter(r => selectedLevels.includes(r.level))
            ).map((r, idx) => (
              <MotiView
                key={idx}
                from={{ opacity: 0, translateY: 20 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'timing', duration: 500, delay: idx * 100 }}
                style={styles.resultCard}
              >
                <View style={[styles.cardHeader, { borderLeftColor: LEVEL_COLORS[r.level] || '#999' }]}>
                   <View style={[styles.miniBadge, { backgroundColor: LEVEL_COLORS[r.level] || '#999' }]}>
                      <Text style={styles.miniBadgeText}>{r.level}</Text>
                   </View>
                   <Text style={styles.cardTitle}>Suggested Improvement</Text>
                </View>
                
                <View style={styles.cardContent}>
                    <Text style={styles.sentenceLabel}>Original Sentence:</Text>
                    <Text style={styles.sentenceText}>&quot;{r.sentence}&quot;</Text>
                    
                    <View style={styles.explanationBox}>
                        <Ionicons name="information-circle-outline" size={20} color="#1976FF" style={{ marginTop: 2 }} />
                        <Text style={styles.explanationText}>{r.explanation}</Text>
                    </View>
                </View>
              </MotiView>
            ))}
          </View>
        )}

        {loading && (
          <View style={styles.loadingContainer}>
             {[1, 2, 3].map((i) => (
                <MotiView
                    key={i}
                    from={{ opacity: 0.3 }}
                    animate={{ opacity: 1 }}
                    transition={{ loop: true, type: 'timing', duration: 1000, delay: i * 200 }}
                    style={styles.skeletonCard}
                />
             ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: '#F6F7FB',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 16,
    paddingBottom: 100,
  },
  inputSection: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  checkButton: {
    flexDirection: 'row',
    backgroundColor: '#1976FF',
    width: '100%',
    maxWidth: 500,
    paddingVertical: 16,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1976FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  checkButtonDisabled: {
    backgroundColor: '#A6C1EE',
    shadowOpacity: 0,
    elevation: 0,
  },
  checkButtonPressed: {
    transform: [{ scale: 0.98 }],
  },
  checkButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  settingsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#E8ECEF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 24,
  },
  settingsText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '600',
  },
  errorContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#FDEDEC',
      padding: 16,
      borderRadius: 16,
      marginBottom: 24,
  },
  errorText: {
      color: '#e74c3c',
      marginLeft: 12,
      flex: 1,
  },
  analysisCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 6,
  },
  analysisHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  analysisTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#11181C',
  },
  levelBadgeBig: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  levelBadgeTextBig: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 20,
  },
  divider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginBottom: 16,
  },
  analysisLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#666',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  analysisText: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
    marginBottom: 20,
  },
  dismissButton: {
    alignSelf: 'center',
    padding: 8,
  },
  dismissText: {
    color: '#999',
    fontSize: 14,
    fontWeight: '600',
  },
  sectionHeader: {
      fontSize: 18,
      fontWeight: '700',
      color: '#11181C',
      marginBottom: 16,
      marginLeft: 4,
  },
  resultsList: {
      marginBottom: 40,
  },
  resultCard: {
      backgroundColor: '#fff',
      borderRadius: 20,
      marginBottom: 16,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2,
  },
  cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: '#f7f7f7',
      borderLeftWidth: 6, 
  },
  miniBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
      marginRight: 12,
  },
  miniBadgeText: {
      color: '#fff',
      fontWeight: '700',
      fontSize: 12,
  },
  cardTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: '#11181C',
  },
  cardContent: {
      padding: 16,
  },
  sentenceLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: '#999',
      marginBottom: 4,
  },
  sentenceText: {
      fontSize: 16,
      color: '#333',
      fontStyle: 'italic',
      marginBottom: 16,
  },
  explanationBox: {
      flexDirection: 'row',
      backgroundColor: '#F0F7FF',
      padding: 12,
      borderRadius: 12,
      gap: 10,
  },
  explanationText: {
      fontSize: 14,
      color: '#1976FF',
      lineHeight: 20,
      flex: 1,
  },
  loadingContainer: {
      marginTop: 20,
  },
  skeletonCard: {
      height: 120,
      backgroundColor: '#E8ECEF',
      borderRadius: 20,
      marginBottom: 16,
  },
});

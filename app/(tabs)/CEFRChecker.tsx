import React, { useState, useEffect } from 'react';
import { View, Text, Button, ActivityIndicator, ScrollView, StyleSheet, Modal, TouchableOpacity, Keyboard, Pressable } from 'react-native';
import { fetchCEFRLevels, CEFRResponse } from '../../services/cefrService';
import {getVerbData} from "@/services/getVerbData";
import { useCEFRSettings } from '../store/useCEFRSettings';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import Animated, { FadeIn, FadeOut, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { MotiView } from 'moti';
import * as Clipboard from 'expo-clipboard';
import { CEFRInput } from '../../components/cefr/CEFRInput';
import { useClipboardWatcher } from '../../hooks/useClipboardWatcher';

// Usage tracking imports
import { supabase } from '../../utils/supabase';
import { useFeatureAccess } from '../../hooks/useFeatureAccess';
import { checkAndLogUsage, UsageLimitExceededError } from '../../services/usageService';
import { UsageWarningBanner } from '../../components/subscription/UsageQuotaDisplay';
import { Paywall } from '../../components/subscription/Paywall';

const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export default function CEFRChecker() {
  const { selectedLevels, dynamicCheck, setSelectedLevels, hydrate } = useCEFRSettings();
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

  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  // Use custom clipboard watcher hook
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
    // Check usage limit before analyzing (for free users)
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
      // Log usage for non-premium users
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
      setAnalyzedInput(input); // Save the input that was analyzed
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
  // Add a ref for the ScrollView
  const scrollRef = React.useRef<ScrollView>(null);

  return (
    <View style={{ flex: 1, backgroundColor: '#F6F7FB' }}>
      {/* Paywall Modal */}
      <Paywall
        visible={paywallVisible}
        onClose={() => setPaywallVisible(false)}
        feature="CEFR Analysis"
      />

      <ScrollView ref={scrollRef} contentContainerStyle={[styles.container, { backgroundColor: '#F6F7FB' }]} keyboardShouldPersistTaps="handled">
        {/* Usage Warning Banner (only for free users when low on quota) */}
        {!isPremium && (
          <UsageWarningBanner
            actionType="cefr_analysis"
            onUpgradePress={() => setPaywallVisible(true)}
          />
        )}

        <Animated.View entering={FadeIn.duration(500)}>
          <View style={{ alignItems: 'center', width: '100%' }}>
            {/* Use CEFRInput component */}
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
            {/* Paste from clipboard button removed, now inside CEFRInput */}
            <Animated.View entering={FadeIn.delay(200).duration(500)} style={{ width: '100%', maxWidth: 500 }}>
              <Pressable
                style={({ pressed }) => [
                  {
                    marginTop: 4,
                    marginBottom: 18,
                    borderRadius: 16,
                    paddingVertical: 16,
                    paddingHorizontal: 24,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: (!input.trim() || loading)
                      ? '#D6E4FF'
                      : (pressed ? '#1976FFcc' : '#1976FF'),
                    shadowColor: '#1976FF',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.12,
                    shadowRadius: 6,
                    elevation: 2,
                    opacity: (!input.trim() || loading) ? 0.6 : 1,
                    borderWidth: 0,
                    width: '100%',
                  },
                ]}
                onPress={() => {
                  Keyboard.dismiss();
                  handleCheck();
                }}
                disabled={loading || !input.trim()}
                android_ripple={{ color: '#1976FF22' }}
              >
                <Text style={{ color: (!input.trim() || loading) ? '#1976FF' : '#fff', fontWeight: 'bold', fontSize: 18, letterSpacing: 0.5 }}>
                  {loading ? 'Checking...' : 'Check CEFR Levels'}
                </Text>
              </Pressable>
            </Animated.View>
          </View>
        </Animated.View>
        <Animated.View entering={FadeIn.delay(100).duration(400)} style={{ alignItems: 'center', marginBottom: 18 }}>
          <View style={{
            backgroundColor: '#E6F0FF',
            borderRadius: 18,
            paddingVertical: 9,
            paddingHorizontal: 22,
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 2,
            borderWidth: 0,
            shadowColor: '#1976FF',
            shadowOpacity: 0.10,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 2 },
            elevation: 2,
            minWidth: 220,
            maxWidth: '90%',
            alignSelf: 'center',
            justifyContent: 'center',
          }}>
            <Ionicons name={dynamicCheck ? 'flash-outline' : 'list-outline'} size={20} color={'#1976FF'} style={{ marginRight: 10 }} />
            <Text style={{ color: '#1976FF', fontWeight: 'bold', fontSize: 16, letterSpacing: 0.2, textAlign: 'center' }}>
              {dynamicCheck
                ? 'Dynamic Check: Next Highest Level'
                : `Levels: ${selectedLevels.join(', ')}`}
            </Text>
          </View>
        </Animated.View>
        {error && <Animated.Text entering={FadeIn.duration(400)} style={[styles.error, { color: '#e74c3c' }]}>{error}</Animated.Text>}
        {analysis && showAnalysis && (
          <Animated.View
            entering={FadeIn.duration(500)}
            exiting={FadeOut.duration(350)}
            style={[styles.analysisContainer, { marginTop: 7 }]}
          >
            <Text style={[styles.analysisTitle, { color: theme.text }]}>Overall CEFR Level: <Text style={styles.analysisLevel}>{analysis.level}</Text></Text>
            <Text style={[styles.analysisJustificationLabel, { color: theme.icon }]}>Justification:</Text>
            <Text style={[styles.analysisJustification, { color: theme.text }]}>{analysis.justification}</Text>
            <Text style={[styles.analysisInputLabel, { color: theme.icon }]}>Input Analyzed:</Text>
            <Text style={[styles.analysisInput, { color: theme.text }]}>{analyzedInput}</Text>
            <Pressable
              style={({ pressed }) => [
                styles.prettyButton,
                {
                  flexDirection: 'row', // Ensure icon is left of text
                  backgroundColor: pressed ? '#cd6053' : '#ff4d4f', // Tint red
                  marginTop: 18,
                  borderWidth: 1.5,
                  borderColor: '#cd6053',
                  shadowColor: '#cd6053',
                },
              ]}
              onPress={() => {
                setShowAnalysis(false);
                setShowResults(false);
                setInput(''); // Clear input when hiding analysis
              }}
              android_ripple={{ color: '#e74c3c22' }}
            >
              <Ionicons name="close-circle-outline" size={18} color={theme.background} style={{ marginRight: 7 }} />
              <Text style={[styles.prettyButtonText, { color: theme.background, fontWeight: 'bold', fontSize: 16 }]}>Clear</Text>
            </Pressable>
          </Animated.View>
        )}
        {result && showResults && (
          <Animated.View
            entering={FadeIn.duration(500)}
            exiting={FadeOut.duration(350)}
            style={{ marginTop: 24, marginBottom: 80 }} // Add marginBottom to push last result above tab bar
          >
            {(
              (dynamicCheck && analysis?.level)
                ? result.results.filter(r => r.level === getNextLevel(analysis.level)[0])
                : result.results.filter(r => selectedLevels.includes(r.level))
            ).map((r, idx, arr) => (
              <Animated.View
                key={idx}
                entering={FadeIn.delay(100 * idx).duration(400)}
                exiting={FadeOut.duration(350)}
                style={{
                  marginBottom: 16, // Always 16, let parent handle last margin
                  padding: 18,
                  backgroundColor: '#F7FAFF',
                  borderRadius: 14,
                  shadowColor: '#1976FF',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.08,
                  shadowRadius: 6,
                  elevation: 2,
                  borderWidth: 1.5,
                  borderColor: '#D6E4FF',
                }}
              >
                <Text style={{ fontWeight: 'bold', fontSize: 17, color: '#1976FF', marginBottom: 4 }}>Level: {r.level}</Text>
                <Text style={{ fontSize: 15, color: '#222', marginBottom: 2 }}>Sentence:</Text>
                <Text style={{ fontSize: 15, color: '#333', marginBottom: 6 }}>{r.sentence}</Text>
                <Text style={{ fontSize: 14, color: '#1976FF', fontWeight: '500', marginBottom: 2 }}>Explanation:</Text>
                <Text style={{ fontSize: 14, color: '#555' }}>{r.explanation}</Text>
              </Animated.View>
            ))}
          </Animated.View>
        )}
        {loading && (
          <Animated.View entering={FadeIn.duration(400)} style={styles.resultContainer}>
            {(() => {
              // Determine how many placeholders to show
              let count = 1;
              if (!dynamicCheck && selectedLevels.length > 0) count = selectedLevels.length;
              return Array.from({ length: count }).map((_, idx) => (
                <MotiView
                  key={idx}
                  from={{ opacity: 0.4 }}
                  animate={{ opacity: 1 }}
                  transition={{ loop: true, type: 'timing', duration: 900, delay: idx * 120, repeatReverse: true }}
                  style={styles.placeholderCard}
                >
                  <View style={styles.placeholderBarShort} />
                  <View style={styles.placeholderBar} />
                  <View style={styles.placeholderBar} />
                </MotiView>
              ));
            })()}
          </Animated.View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flexGrow: 1,
    padding: 24,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    marginTop: 8,
  },
  headerIconButton: {
    marginLeft: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    flexShrink: 0,
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#ccc',
    borderRadius: 12,
    padding: 16,
    minHeight: 60,
    marginBottom: 18,
    fontSize: 17,
    backgroundColor: '#f7f7f7',
  },
  error: {
    color: 'red',
    marginTop: 16,
    textAlign: 'center',
  },
  analysisContainer: {
    marginTop: 20,
    padding: 12,
    backgroundColor: '#e6f7ee',
    borderRadius: 8,
  },
  analysisTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2a7',
    textAlign: 'center',
  },
  analysisLevel: {
    color: '#1a5',
    fontWeight: 'bold',
    fontSize: 20,
  },
  analysisJustificationLabel: {
    marginTop: 8,
    fontWeight: 'bold',
    color: '#2a7',
    textAlign: 'center',
  },
  analysisJustification: {
    marginTop: 6,
    fontSize: 15,
    color: '#333',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  analysisInputLabel: {
    marginTop: 10,
    fontWeight: 'bold',
    color: '#2a7',
    textAlign: 'center',
  },
  analysisInput: {
    marginTop: 2,
    fontSize: 15,
    color: '#333',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  resultContainer: {
    marginTop: 24,
  },
  resultTitle: {
    fontWeight: 'bold',
    fontSize: 18,
    marginBottom: 8,
  },
  levelContainer: {
    marginBottom: 16,
    padding: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  level: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  sentence: {
    marginTop: 4,
    fontSize: 15,
  },
  explanation: {
    marginTop: 4,
    fontStyle: 'italic',
    color: '#555',
  },
  selectedLevels: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
    color: '#333',
  },
  settingsButton: {
    position: 'absolute',
    top: 40,
    right: 16,
    padding: 10,
    borderRadius: 8,
    backgroundColor: 'transparent',
    elevation: 0,
  },
  settingsButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  prettyButton: {
    marginTop: 4,
    marginBottom: 8,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2a7',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 2,
  },
  prettyButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 17,
    letterSpacing: 0.5,
  },
  placeholderCard: {
    marginBottom: 16,
    padding: 16,
    backgroundColor: '#e0e0e0',
    borderRadius: 12,
    flexDirection: 'column',
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
    minHeight: 80,
    width: '100%',
  },
  placeholderBar: {
    height: 14,
    width: '80%',
    backgroundColor: '#cccccc',
    borderRadius: 7,
    marginTop: 10,
  },
  placeholderBarShort: {
    height: 14,
    width: '40%',
    backgroundColor: '#cccccc',
    borderRadius: 7,
    marginTop: 0,
  },
});

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import { translateWithDeepL, DeepLTranslationError } from '@/services/deeplService';
import * as Clipboard from 'expo-clipboard';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MotiView } from 'moti';
import { InputCard } from '../../components/translator/InputCard';
import { LanguageSelector } from '../../components/translator/LanguageSelector';
import { TranslationCard } from '../../components/translator/TranslationCard';

// Usage tracking imports
import { supabase } from '../../utils/supabase';
import { useFeatureAccess } from '../../hooks/useFeatureAccess';
import { checkAndLogUsage, UsageLimitExceededError } from '../../services/usageService';
import { UsageWarningBanner } from '../../components/subscription/UsageQuotaDisplay';
import { Paywall } from '../../components/subscription/Paywall';
import { fetchTranslationFeatures } from '@/services/translatorFeatures';

export default function TranslatorScreen() {
  const [inputText, setInputText] = useState('');
  const [draftInputText, setDraftInputText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sourceLang, setSourceLang] = useState<string | null>(null);
  const [targetLang, setTargetLang] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedInput, setCopiedInput] = useState(false);
  const [copiedOutput, setCopiedOutput] = useState(false);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [hasClipboardContent, setHasClipboardContent] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [activeTab, setActiveTab] = useState<'examples' | 'synonyms' | 'tone'>('examples');
  const [languageModalVisible, setLanguageModalVisible] = useState(false);
  const [languageModalType, setLanguageModalType] = useState<'source' | 'target' | null>(null);
  
  const [features, setFeatures] = useState<{
    examples?: any[];
    synonyms?: any[];
    tone?: any[];
    pronunciation?: string;
    meaning?: string;
  }>({});
  const [featuresLoading, setFeaturesLoading] = useState(false);

  const [paywallVisible, setPaywallVisible] = useState(false);
  const { canPerformAction, isPremium } = useFeatureAccess();

  const languages = [
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Spanish' },
    { code: 'fr', name: 'French' },
    { code: 'de', name: 'German' },
    { code: 'it', name: 'Italian' },
    { code: 'pt', name: 'Portuguese' },
    { code: 'ru', name: 'Russian' },
    { code: 'ja', name: 'Japanese' },
    { code: 'ko', name: 'Korean' },
    { code: 'zh', name: 'Chinese' },
  ];

  useEffect(() => {
    (async () => {
      try {
        const savedSource = await AsyncStorage.getItem('translator_sourceLang');
        const savedTarget = await AsyncStorage.getItem('translator_targetLang');
        setSourceLang(savedSource || 'en');
        setTargetLang(savedTarget || 'it');
      } catch (e) {
        setSourceLang('en');
        setTargetLang('it');
      } finally {
        setPrefsLoaded(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (prefsLoaded && sourceLang) AsyncStorage.setItem('translator_sourceLang', sourceLang);
  }, [sourceLang, prefsLoaded]);

  useEffect(() => {
    if (prefsLoaded && targetLang) AsyncStorage.setItem('translator_targetLang', targetLang);
  }, [targetLang, prefsLoaded]);

  useEffect(() => {
    const interval = setInterval(async () => {
      const text = await Clipboard.getStringAsync();
      setHasClipboardContent(!!text);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (inputText.trim() !== '') handleTranslate();
  }, [inputText]);

  const handleTranslate = async () => {
    if (!inputText.trim() || !sourceLang || !targetLang) return;

    if (!isPremium && !canPerformAction('translation')) {
      setPaywallVisible(true);
      return;
    }

    setIsLoading(true);
    setFeaturesLoading(true);
    setError(null);
    setTranslatedText('');
    setFeatures({});

    try {
      if (!isPremium) {
        const { data: userData } = await supabase.auth.getUser();
        if (userData.user) {
          await checkAndLogUsage(userData.user.id, 'translation', {
            sourceLang,
            targetLang,
            textLength: inputText.length,
          });
        }
      }

      const result = await translateWithDeepL({
        text: inputText,
        sourceLanguage: sourceLang,
        targetLanguage: targetLang,
      });

      setTranslatedText(result.translatedText);
      setIsLoading(false);

      try {
          const featureData = await fetchTranslationFeatures(
            result.translatedText, 
            sourceLang, 
            targetLang,
            isPremium
          );
          setFeatures(featureData);
      } catch (err) {
          console.error("Failed to load features", err);
      } finally {
          setFeaturesLoading(false);
      }

    } catch (error) {
      console.error('Translation error:', error);
      setIsLoading(false);
      setFeaturesLoading(false);

      if (error instanceof UsageLimitExceededError) {
        setPaywallVisible(true);
        return;
      }

      if (error instanceof DeepLTranslationError) {
        setError(error.message);
        Alert.alert('Translation Error', error.message);
      } else {
        setError('Translation failed. Please try again.');
        Alert.alert('Translation Error', 'Translation failed. Please try again.');
      }
    }
  };

  const swapLanguages = () => {
    setSourceLang(targetLang);
    setTargetLang(sourceLang);
    setInputText(translatedText);
    setDraftInputText(translatedText);
    setTranslatedText(inputText);
    setFeatures({});
  };

  const openLanguageModal = (type: 'source' | 'target') => {
    setLanguageModalType(type);
    setLanguageModalVisible(true);
  };

  const closeLanguageModal = () => {
    setLanguageModalVisible(false);
    setLanguageModalType(null);
  };

  const selectLanguage = (code: string) => {
    if (languageModalType === 'source') {
      setSourceLang(code);
    } else if (languageModalType === 'target') {
      setTargetLang(code);
    }
    closeLanguageModal();
  };

  const handleNewTranslation = () => {
    setInputText('');
    setDraftInputText('');
    setTranslatedText('');
    setError(null);
    setCopiedInput(false);
    setCopiedOutput(false);
    setFeatures({});
    setActiveTab('examples');
    setTimeout(() => {
      scrollRef?.current?.scrollTo({ y: 0, animated: true });
    }, 100);
  };

  const scrollRef = React.useRef<ScrollView>(null);

  return (
      <View style={styles.mainContainer}>
        <Paywall
          visible={paywallVisible}
          onClose={() => setPaywallVisible(false)}
          feature="Translations"
        />

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {!isPremium && (
            <UsageWarningBanner
              actionType="translation"
              onUpgradePress={() => setPaywallVisible(true)}
            />
          )}

          <LanguageSelector
            sourceLang={sourceLang}
            targetLang={targetLang}
            languages={languages}
            openLanguageModal={openLanguageModal}
            openLanguageModalSwap={swapLanguages}
            languageModalVisible={languageModalVisible}
            languageModalType={languageModalType}
            closeLanguageModal={closeLanguageModal}
            selectLanguage={selectLanguage}
          />

          <InputCard
            draftInputText={draftInputText}
            setDraftInputText={setDraftInputText}
            inputFocused={inputFocused}
            setInputFocused={setInputFocused}
            setInputText={setInputText}
            hasClipboardContent={hasClipboardContent}
            languages={languages}
            sourceLang={sourceLang}
            handleTranslate={handleTranslate}
          />

          {(isLoading || translatedText !== '') && (
            <TranslationCard
              isLoading={isLoading}
              featuresLoading={featuresLoading}
              translatedText={translatedText}
              copiedOutput={copiedOutput}
              setCopiedOutput={setCopiedOutput}
              targetLang={targetLang}
              languages={languages}
              handleNewTranslation={handleNewTranslation}
              pronunciation={features.pronunciation}
              meaning={features.meaning}
            />
          )}

          <Animated.View entering={FadeIn.duration(400)} exiting={FadeOut.duration(300)}>
          {translatedText !== '' && (
            <View style={styles.detailsContainer}>
              <View style={styles.tabsContainer}>
                 {(['examples', 'synonyms', 'tone'] as const).map((tab) => (
                    <TouchableOpacity
                       key={tab}
                       onPress={() => setActiveTab(tab)}
                       style={[
                          styles.tabButton,
                          activeTab === tab && styles.tabButtonActive
                       ]}
                    >
                       <Text style={[
                          styles.tabText,
                          activeTab === tab && styles.tabTextActive
                       ]}>
                          {tab.charAt(0).toUpperCase() + tab.slice(1)}
                       </Text>
                    </TouchableOpacity>
                 ))}
              </View>

              <View style={styles.tabContent}>
                  {!isPremium ? (
                    <View style={styles.premiumOverlay}>
                      <View style={styles.lockIconContainer}>
                        <Ionicons name="lock-closed" size={24} color="#1976FF" />
                      </View>
                      <Text style={styles.premiumTitle}>Unlock Smart Features</Text>
                      <Text style={styles.premiumDesc}>
                        Get instant examples, synonyms, and tone variations for every translation.
                      </Text>
                      <TouchableOpacity
                        onPress={() => setPaywallVisible(true)}
                        style={styles.upgradeButton}
                      >
                        <Text style={styles.upgradeText}>Upgrade to Premium</Text>
                      </TouchableOpacity>
                    </View>
                  ) : featuresLoading ? (
                    <View style={styles.skeletonContainer}>
                      {[...Array(3)].map((_, idx) => (
                        <MotiView
                          key={idx}
                          from={{ opacity: 0.4 }}
                          animate={{ opacity: 1 }}
                          transition={{ loop: true, type: 'timing', duration: 900, delay: idx * 120, repeatReverse: true }}
                          style={[styles.skeletonLine, { width: idx === 0 ? '90%' : idx === 1 ? '70%' : '50%' }]}
                        />
                      ))}
                    </View>
                  ) : (
                    <>
                      {activeTab === 'examples' && (
                        features.examples?.length ? features.examples.map((item, i) => (
                           <View key={i} style={styles.listItem}>
                             <Text style={styles.listTitle}>{item.target}</Text>
                             <Text style={styles.listSubtitle}>{item.source}</Text>
                           </View>
                        )) : <Text style={styles.emptyText}>No examples available.</Text>
                      )}

                      {activeTab === 'synonyms' && (
                        features.synonyms?.length ? features.synonyms.map((item, i) => (
                          <View key={i} style={styles.listItem}>
                            <Text style={styles.listTitle}>{item.word}</Text>
                            <Text style={[styles.listSubtitle, { fontStyle: 'italic' }]}>{item.nuance}</Text>
                          </View>
                        )) : <Text style={styles.emptyText}>No synonyms available.</Text>
                      )}

                      {activeTab === 'tone' && (
                        features.tone?.length ? features.tone.map((item, i) => (
                          <View key={i} style={styles.listItem}>
                            <View style={styles.toneBadge}>
                                <Text style={styles.toneText}>{item.tone.toUpperCase()}</Text>
                            </View>
                            <Text style={styles.listTitle}>{item.text}</Text>
                            <Text style={styles.listSubtitle}>{item.context}</Text>
                          </View>
                        )) : <Text style={styles.emptyText}>No tone variations available.</Text>
                      )}
                    </>
                  )}
              </View>
            </View>
          )}
          </Animated.View>
        </ScrollView>
        
        {translatedText !== '' && (
          <TouchableOpacity
            onPress={handleNewTranslation}
            style={styles.floatingButton}
          >
            <Ionicons name="trash-outline" size={24} color="#fff" />
          </TouchableOpacity>
        )}
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
    paddingTop: 16,
    paddingBottom: 100,
  },
  detailsContainer: {
    marginTop: 8,
    marginHorizontal: 16,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#E8ECEF',
    borderRadius: 16,
    padding: 4,
    marginBottom: 16,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 12,
  },
  tabButtonActive: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  tabTextActive: {
    color: '#1976FF',
    fontWeight: '700',
  },
  tabContent: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    minHeight: 200,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  premiumOverlay: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  lockIconContainer: {
    backgroundColor: '#E6F0FF',
    padding: 16,
    borderRadius: 50,
    marginBottom: 16,
  },
  premiumTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#11181C',
    marginBottom: 8,
  },
  premiumDesc: {
    fontSize: 14,
    color: '#687076',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  upgradeButton: {
    backgroundColor: '#1976FF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  upgradeText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 16,
  },
  skeletonContainer: {
    width: '100%',
    alignItems: 'flex-start',
  },
  skeletonLine: {
    height: 16,
    backgroundColor: '#E6F0FF',
    borderRadius: 8,
    marginBottom: 12,
  },
  listItem: {
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingBottom: 16,
  },
  listTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#11181C',
    marginBottom: 4,
  },
  listSubtitle: {
    fontSize: 14,
    color: '#687076',
    lineHeight: 20,
  },
  emptyText: {
    color: '#B0B0B0',
    textAlign: 'center',
    marginTop: 20,
  },
  toneBadge: {
    backgroundColor: '#E6F0FF',
    alignSelf: 'flex-start',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 8,
  },
  toneText: {
    fontSize: 12,
    color: '#1976FF',
    fontWeight: '700',
  },
  floatingButton: {
    position: 'absolute',
    right: 24,
    bottom: 24,
    width: 56,
    height: 56,
    backgroundColor: '#FF4D4F',
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#FF4D4F',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    zIndex: 100,
  },
});
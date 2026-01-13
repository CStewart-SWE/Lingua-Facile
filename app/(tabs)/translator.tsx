import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
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
  
  // Features state
  const [features, setFeatures] = useState<{
    examples?: any[];
    synonyms?: any[];
    tone?: any[];
    pronunciation?: string;
    meaning?: string;
  }>({});
  const [featuresLoading, setFeaturesLoading] = useState(false);

  // Usage tracking
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
        setSourceLang(savedSource || 'en'); // default input: English
        setTargetLang(savedTarget || 'it'); // default target: Italian
      } catch (e) {
        setSourceLang('en');
        setTargetLang('it');
      } finally {
        setPrefsLoaded(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (prefsLoaded && sourceLang) {
      AsyncStorage.setItem('translator_sourceLang', sourceLang);
    }
  }, [sourceLang, prefsLoaded]);

  useEffect(() => {
    if (prefsLoaded && targetLang) {
      AsyncStorage.setItem('translator_targetLang', targetLang);
    }
  }, [targetLang, prefsLoaded]);

  // Always check clipboard every second, regardless of input focus
  useEffect(() => {
    const interval = setInterval(async () => {
      const text = await Clipboard.getStringAsync();
      setHasClipboardContent(!!text);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Add useEffect to trigger translation when inputText changes and is not empty
  useEffect(() => {
    if (inputText.trim() !== '') {
      handleTranslate();
    }
    // Only run when inputText changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputText]);

  const handleTranslate = async () => {
    if (!inputText.trim() || !sourceLang || !targetLang) return;

    // Check usage limit before translating (for free users)
    if (!isPremium && !canPerformAction('translation')) {
      setPaywallVisible(true);
      return;
    }

    setIsLoading(true);
    setFeaturesLoading(true);
    setError(null);
    setTranslatedText('');
    setFeatures({}); // Reset features on new translation

    try {
      // Log usage for non-premium users
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
      setIsLoading(false); // Stop loading main translation

      // Fetch features for everyone (content varies by premium status)
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

      // If source language was detected and different from selected, could show info
      if (result.detectedSourceLanguage && result.detectedSourceLanguage !== sourceLang) {
        console.log(`Detected source language: ${result.detectedSourceLanguage}`);
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
        const errorMessage = 'Translation failed. Please try again.';
        setError(errorMessage);
        Alert.alert('Translation Error', errorMessage);
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

  // Handler to clear all translation fields
  const handleNewTranslation = () => {
    setInputText('');
    setDraftInputText('');
    setTranslatedText(''); // Ensure output is cleared
    setError(null);
    setCopiedInput(false);
    setCopiedOutput(false);
    setFeatures({});
    setActiveTab('examples');
    setTimeout(() => {
      scrollRef?.current?.scrollTo({ y: 0, animated: true });
    }, 100);
  };

  // Add a ref for the ScrollView
  const scrollRef = React.useRef<ScrollView>(null);

  return (
      <View style={{ flex: 1, backgroundColor: '#F6F7FB' }}>
        {/* Paywall Modal */}
        <Paywall
          visible={paywallVisible}
          onClose={() => setPaywallVisible(false)}
          feature="Translations"
        />

        {/* Main content */}
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ flexGrow: 1, paddingTop: 14, paddingBottom: 180, paddingHorizontal: 10, backgroundColor: '#F6F7FB' }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Usage Warning Banner (only for free users when low on quota) */}
          {!isPremium && (
            <UsageWarningBanner
              actionType="translation"
              onUpgradePress={() => setPaywallVisible(true)}
            />
          )}

          {/* Language Selector */}
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

          {/* Input Card */}
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

          {/* Translation Card */}
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

          {/* Tabs for Examples, Synonyms, Tone and tab content only if there is a result */}
          <Animated.View entering={FadeIn.duration(400)} exiting={FadeOut.duration(300)}>
          {translatedText !== '' && (
            <>
              <View style={{ flexDirection: 'row', marginHorizontal: 12, marginBottom: 8, backgroundColor: 'white', borderRadius: 16, padding: 4, zIndex: 2 }}>
                <TouchableOpacity onPress={() => setActiveTab('examples')} style={{ flex: 1, alignItems: 'center', paddingVertical: 10, backgroundColor: activeTab === 'examples' ? '#E6F0FF' : 'transparent', borderRadius: 12 }}>
                  <Ionicons name="list-outline" size={20} color={activeTab === 'examples' ? '#1976FF' : '#B0B0B0'} />
                  <Text style={{ color: activeTab === 'examples' ? '#1976FF' : '#B0B0B0', fontWeight: '600', fontSize: 14 }}>Examples</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setActiveTab('synonyms')} style={{ flex: 1, alignItems: 'center', paddingVertical: 10, backgroundColor: activeTab === 'synonyms' ? '#E6F0FF' : 'transparent', borderRadius: 12 }}>
                  <Ionicons name="git-compare-outline" size={20} color={activeTab === 'synonyms' ? '#1976FF' : '#B0B0B0'} />
                  <Text style={{ color: activeTab === 'synonyms' ? '#1976FF' : '#B0B0B0', fontWeight: '600', fontSize: 14 }}>Synonyms</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setActiveTab('tone')} style={{ flex: 1, alignItems: 'center', paddingVertical: 10, backgroundColor: activeTab === 'tone' ? '#E6F0FF' : 'transparent', borderRadius: 12 }}>
                  <Ionicons name="person-outline" size={20} color={activeTab === 'tone' ? '#1976FF' : '#B0B0B0'} />
                  <Text style={{ color: activeTab === 'tone' ? '#1976FF' : '#B0B0B0', fontWeight: '600', fontSize: 14 }}>Tone</Text>
                </TouchableOpacity>
              </View>
              {/* Everything below the tabs is wrapped in a View to ensure it is part of the ScrollView and scrollable */}
              <View>
                {/* Tab Content */}
                <View
                  style={{ backgroundColor: 'white', borderRadius: 16, marginHorizontal: 12, marginBottom: 50, padding: 16, minHeight: 100 }}
                  onStartShouldSetResponder={() => true}
                >
                  {!isPremium ? (
                    <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 20 }}>
                      <View style={{ backgroundColor: '#E6F0FF', padding: 12, borderRadius: 50, marginBottom: 12 }}>
                        <Ionicons name="lock-closed" size={24} color="#1976FF" />
                      </View>
                      <Text style={{ fontSize: 16, fontWeight: '600', color: '#11181C', marginBottom: 4 }}>Unlock Smart Features</Text>
                      <Text style={{ fontSize: 14, color: '#687076', textAlign: 'center', marginBottom: 16, paddingHorizontal: 20 }}>
                        Get instant examples, synonyms, and tone variations for every translation.
                      </Text>
                      <TouchableOpacity
                        onPress={() => setPaywallVisible(true)}
                        style={{ backgroundColor: '#1976FF', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 }}
                      >
                        <Text style={{ color: 'white', fontWeight: '600', fontSize: 14 }}>Upgrade to Premium</Text>
                      </TouchableOpacity>
                    </View>
                  ) : featuresLoading ? (
                    <View style={{ width: '100%', alignItems: 'flex-start' }}>
                      {[...Array(3)].map((_, idx) => (
                        <MotiView
                          key={idx}
                          from={{ opacity: 0.4 }}
                          animate={{ opacity: 1 }}
                          transition={{ loop: true, type: 'timing', duration: 900, delay: idx * 120, repeatReverse: true }}
                          style={{
                            height: 16,
                            width: idx === 0 ? '90%' : idx === 1 ? '70%' : '50%',
                            backgroundColor: '#E6F0FF',
                            borderRadius: 8,
                            marginBottom: 12,
                          }}
                        />
                      ))}
                    </View>
                  ) : (
                    <>
                      {activeTab === 'examples' && (
                        features.examples ? features.examples.map((item, i) => (
                           <View key={i} style={{ marginBottom: 16 }}>
                             <Text style={{ fontSize: 16, fontWeight: '500', color: '#11181C', marginBottom: 2 }}>{item.target}</Text>
                             <Text style={{ fontSize: 14, color: '#687076' }}>{item.source}</Text>
                           </View>
                        )) : <Text style={{ color: '#B0B0B0' }}>No examples available.</Text>
                      )}

                      {activeTab === 'synonyms' && (
                        features.synonyms ? features.synonyms.map((item, i) => (
                          <View key={i} style={{ marginBottom: 16 }}>
                            <Text style={{ fontSize: 16, fontWeight: '600', color: '#11181C', marginBottom: 2 }}>{item.word}</Text>
                            <Text style={{ fontSize: 14, color: '#687076', fontStyle: 'italic' }}>{item.nuance}</Text>
                          </View>
                        )) : <Text style={{ color: '#B0B0B0' }}>No synonyms available.</Text>
                      )}

                      {activeTab === 'tone' && (
                        features.tone ? features.tone.map((item, i) => (
                          <View key={i} style={{ marginBottom: 16 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                                <View style={{ backgroundColor: '#E6F0FF', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, marginRight: 8 }}>
                                    <Text style={{ fontSize: 12, color: '#1976FF', fontWeight: '700' }}>{item.tone.toUpperCase()}</Text>
                                </View>
                            </View>
                            <Text style={{ fontSize: 16, fontWeight: '500', color: '#11181C', marginBottom: 2 }}>{item.text}</Text>
                            <Text style={{ fontSize: 14, color: '#687076' }}>{item.context}</Text>
                          </View>
                        )) : <Text style={{ color: '#B0B0B0' }}>No tone variations available.</Text>
                      )}
                    </>
                  )}
                </View>
              </View>
            </>
          )}
          </Animated.View>
        </ScrollView>
        {/* Floating New translation button - absolutely positioned relative to the screen */}
        {translatedText !== '' && (
          <TouchableOpacity
            onPress={handleNewTranslation}
            style={{
              position: 'absolute',
              left: 24,
              right: 24,
              bottom: 100, // Increase to float above tab bar
              backgroundColor: '#1976FF',
              borderRadius: 16,
              paddingVertical: 16,
              alignItems: 'center',
              elevation: 4,
              shadowColor: '#1976FF',
              shadowOpacity: 0.15,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 2 },
              zIndex: 20,
            }}
          >
            <Text style={{ color: 'white', fontWeight: '700', fontSize: 18 }}>Clear Translation</Text>
          </TouchableOpacity>
        )}
      </View>
  );
}
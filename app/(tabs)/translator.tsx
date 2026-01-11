import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Keyboard,
  Alert,
  TouchableWithoutFeedback,
  Modal,
  FlatList,
  Pressable,
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
    setError(null);
    setTranslatedText('');

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

      // If source language was detected and different from selected, could show info
      if (result.detectedSourceLanguage && result.detectedSourceLanguage !== sourceLang) {
        console.log(`Detected source language: ${result.detectedSourceLanguage}`);
      }
    } catch (error) {
      console.error('Translation error:', error);

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
    } finally {
      setIsLoading(false);
    }
  };

  const swapLanguages = () => {
    setSourceLang(targetLang);
    setTargetLang(sourceLang);
    setInputText(translatedText);
    setDraftInputText(translatedText);
    setTranslatedText(inputText);
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
              translatedText={translatedText}
              copiedOutput={copiedOutput}
              setCopiedOutput={setCopiedOutput}
              targetLang={targetLang}
              languages={languages}
              handleNewTranslation={handleNewTranslation}
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
                {/* Tab Content Visual Only */}
                <View
                  style={{ backgroundColor: 'white', borderRadius: 16, marginHorizontal: 12, marginBottom: 50, padding: 16 }}
                  onStartShouldSetResponder={() => true}
                >
                  {activeTab === 'examples' && (
                    <Text style={{ color: '#11181C', fontSize: 15 }} selectable>{`Come ti chiami? Io sono felice di conoscerti.\nWhat is your name? I am happy to meet you.`}</Text>
                  )}
                  {activeTab === 'synonyms' && (
                    <Text style={{ color: '#11181C', fontSize: 15 }} selectable>Synonyms visual placeholder</Text>
                  )}
                  {activeTab === 'tone' && (
                    <Text style={{ color: '#11181C', fontSize: 15 }} selectable>Tone visual placeholder</Text>
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

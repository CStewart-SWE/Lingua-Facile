
import { useThemeColor } from '@/hooks/useThemeColor';
import { Ionicons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Keyboard, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Animated, { FadeIn, FadeInUp, Layout } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Paywall } from '../../components/subscription/Paywall';
import { useFeatureAccess } from '../../hooks/useFeatureAccess';
import { useLanguageStore } from '../store/useLanguageStore';

import { ChatLanguageSettings } from '@/components/chat/ChatLanguageSettings';
import { translateWithDeepL } from '@/services/deeplService';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';
import { ChatMessage, sendMessageToTutor } from '../../services/chatService';

export default function ChatScreen() {
  const [paywallVisible, setPaywallVisible] = useState(false);
  const { hasFeature, isPremium, isLoading: isFeatureLoading } = useFeatureAccess();
  const { bottom, top } = useSafeAreaInsets();

  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const tintColor = useThemeColor({}, 'tint');
  const userBubbleColor = tintColor;
  const aiBubbleColor = '#E6F0FF';

  // Chat State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const { sourceLang, targetLang, setSourceLang, setTargetLang, swapLanguages } = useLanguageStore();
  const [userLevel, setUserLevel] = useState('intermediate');
  const [langModalVisible, setLangModalVisible] = useState(false);

  // Audio State
  const { startRecording, stopRecording, isRecording } = useAudioRecorder();

  // Track keyboard open/closed for conditional padding
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setIsKeyboardOpen(true)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setIsKeyboardOpen(false)
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const flatListRef = useRef<FlatList>(null);

  const hasAccess = hasFeature('chat');

  if (isFeatureLoading) {
    return <View style={[styles.container, { backgroundColor }]}><ActivityIndicator size="large" color={tintColor} /></View>;
  }

  if (!hasAccess) {
    return (
      <View style={[styles.container, { backgroundColor }]}>
        <Paywall visible={paywallVisible} onClose={() => setPaywallVisible(false)} feature="AI Chat Tutor" />
        <View style={styles.lockedContainer}>
          <View style={[styles.iconCircle, { backgroundColor: tintColor + '15' }]}>
            <Ionicons name="chatbubbles" size={64} color={tintColor} />
          </View>
          <Text style={[styles.title, { color: textColor }]}>AI Chat Tutor</Text>
          <Text style={[styles.description, { color: textColor + '80' }]}>Practice conversations with an AI tutor.</Text>
          <TouchableOpacity style={[styles.upgradeButton, { backgroundColor: tintColor }]} onPress={() => setPaywallVisible(true)}>
            <Text style={styles.upgradeButtonText}>Upgrade to Premium</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const handleSend = async () => {
    const textToSend = inputText.trim();
    if (!textToSend) return;

    const newUserMsg: ChatMessage = { role: 'user', content: textToSend };
    const updatedMessages = [...messages, newUserMsg];

    setMessages(updatedMessages);
    setInputText('');
    setIsSending(true);

    try {
      const response = await sendMessageToTutor(updatedMessages, targetLang, userLevel, undefined, sourceLang);

      const aiMsg: ChatMessage = { role: 'assistant', content: response.reply };
      const finalMessages = [...updatedMessages, aiMsg];
      setMessages(finalMessages);

      Speech.stop();
      Speech.speak(response.reply, { language: targetLang });

      if (response.correction) {
        const correctionMsg: ChatMessage = {
          role: 'system',
          content: JSON.stringify(response.correction)
        };
        setMessages(prev => [...prev, correctionMsg]);
      }

    } catch (err) {
      Alert.alert("Error", "Failed to get response from AI Tutor.");
      console.error(err);
    } finally {
      setIsSending(false);
    }
  };

  const handleMicPress = async () => {
    console.log('Mic pressed, isRecording:', isRecording);
    if (isRecording) {
      // Add voice message placeholder immediately
      const voiceMsg: ChatMessage = {
        role: 'user',
        content: '',
        isVoice: true,
        isTranscribing: true
      };
      setMessages(prev => [...prev, voiceMsg]);
      setIsSending(true);

      try {
        const result = await stopRecording();
        console.log('Recording result:', result);

        if (result && result.base64) {
          // Send audio to backend
          const response = await sendMessageToTutor(messages, targetLang, userLevel, result.base64, sourceLang);
          console.log('Response from tutor:', response);

          // Update the voice message with transcription
          setMessages(prev => {
            const updated = [...prev];
            const lastIndex = updated.length - 1;
            if (updated[lastIndex]?.isVoice) {
              updated[lastIndex] = {
                ...updated[lastIndex],
                content: response.user_transcript || '🎤 Voice message',
                isTranscribing: false
              };
            }
            return updated;
          });

          // Add AI response
          const aiMsg: ChatMessage = { role: 'assistant', content: response.reply };
          setMessages(prev => [...prev, aiMsg]);

          Speech.stop();
          Speech.speak(response.reply, { language: targetLang });

          if (response.correction) {
            const correctionMsg: ChatMessage = { role: 'system', content: JSON.stringify(response.correction) };
            setMessages(prev => [...prev, correctionMsg]);
          }
        } else {
          // Remove the placeholder on error
          setMessages(prev => prev.filter(m => !m.isTranscribing));
          Alert.alert('Recording Error', 'No audio data captured. Please try again.');
        }
      } catch (err) {
        console.error('Voice message error:', err);
        // Remove the placeholder on error
        setMessages(prev => prev.filter(m => !m.isTranscribing));
        Alert.alert('Error', 'Failed to process voice message: ' + (err as Error).message);
      } finally {
        setIsSending(false);
      }
    } else {
      await startRecording();
    }
  };

  const renderItem = useCallback(({ item, index }: { item: ChatMessage; index: number }) => {
    const isUser = item.role === 'user';
    const isSystem = item.role === 'system';

    if (isSystem) {
      let correction;
      try { correction = JSON.parse(item.content); } catch (e) { return null; }

      return (
        <Animated.View entering={FadeInUp.duration(400)} style={styles.correctionContainer}>
          <View style={styles.correctionHeader}>
            <Ionicons name="school" size={16} color="#FFD700" />
            <Text style={styles.correctionTitle}>Correction</Text>
          </View>
          <Text style={styles.correctionOriginal}>"{correction.original}"</Text>
          <Text style={styles.correctionArrow}>↓</Text>
          <Text style={styles.correctionBetter}>{correction.corrected}</Text>
          <Text style={styles.correctionExplanation}>{correction.explanation}</Text>
        </Animated.View>
      );
    }

    // Voice message bubble
    if (item.isVoice) {
      return (
        <Animated.View
          layout={Layout.springify()}
          entering={FadeIn.duration(300)}
          style={[
            styles.bubble,
            styles.voiceBubble,
            { backgroundColor: userBubbleColor, alignSelf: 'flex-end' }
          ]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="mic" size={20} color="#fff" />
            {item.isTranscribing ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={[styles.messageText, { color: '#fff', fontStyle: 'italic' }]}>Transcribing...</Text>
              </View>
            ) : (
              <Text style={[styles.messageText, { color: '#fff' }]}>{item.content}</Text>
            )}
          </View>
        </Animated.View>
      );
    }

    // Handle translation on tap
    const handleTranslate = async (messageIndex: number) => {
      const originalIndex = messages.length - 1 - messageIndex;
      const msg = messages[originalIndex];

      if (msg.role !== 'assistant' || msg.isTranslating) return;

      // If already has cached translation, toggle visibility
      if (msg.cachedTranslation) {
        setMessages(prev => {
          const updated = [...prev];
          updated[originalIndex] = {
            ...updated[originalIndex],
            translation: msg.translation ? undefined : msg.cachedTranslation
          };
          return updated;
        });
        return;
      }

      // Set translating state
      setMessages(prev => {
        const updated = [...prev];
        updated[originalIndex] = { ...updated[originalIndex], isTranslating: true };
        return updated;
      });

      try {
        const result = await translateWithDeepL({
          text: msg.content,
          sourceLanguage: targetLang,
          targetLanguage: sourceLang,
        });

        setMessages(prev => {
          const updated = [...prev];
          updated[originalIndex] = {
            ...updated[originalIndex],
            translation: result.translatedText,
            cachedTranslation: result.translatedText,
            isTranslating: false
          };
          return updated;
        });
      } catch (err) {
        console.error('Translation error:', err);
        setMessages(prev => {
          const updated = [...prev];
          updated[originalIndex] = { ...updated[originalIndex], isTranslating: false };
          return updated;
        });
      }
    };

    return (
      <Pressable onPress={() => !isUser && handleTranslate(index)}>
        <Animated.View
          layout={Layout.springify()}
          entering={FadeIn.duration(300)}
          style={[
            styles.bubble,
            isUser ? { backgroundColor: userBubbleColor, alignSelf: 'flex-end' }
              : { backgroundColor: aiBubbleColor, alignSelf: 'flex-start' }
          ]}
        >
          <Text style={[styles.messageText, { color: isUser ? '#fff' : textColor }]}>{item.content}</Text>



          {!isUser && item.translation && (
            <View style={styles.translationContainer}>
              <Text style={[styles.translationText, { color: textColor + '80' }]}>{item.translation}</Text>
            </View>
          )}

          {/* Bottom row with speaker and translate hint */}
          {!isUser && (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
              <TouchableOpacity
                onPress={(e) => { e.stopPropagation(); Speech.speak(item.content, { language: targetLang }); }}
              >
                <Ionicons name="volume-high" size={18} color={textColor + '80'} />
              </TouchableOpacity>

              {item.isTranslating ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <ActivityIndicator size="small" color={tintColor} />
                  <Text style={{ color: textColor + '60', fontSize: 11, fontStyle: 'italic' }}>Translating...</Text>
                </View>
              ) : (
                <Text style={{ color: textColor + '40', fontSize: 11 }}>
                  {item.translation ? 'Tap to hide' : 'Tap to translate'}
                </Text>
              )}
            </View>
          )}
        </Animated.View>
      </Pressable>
    );
  }, [messages, targetLang, sourceLang, textColor, tintColor, userBubbleColor, aiBubbleColor]);

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >

      <ChatLanguageSettings
        visible={langModalVisible}
        onClose={() => setLangModalVisible(false)}
        sourceLang={sourceLang}
        targetLang={targetLang}
        setSourceLang={setSourceLang}
        setTargetLang={setTargetLang}
        languages={[
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
        ]}
      />

      <FlatList
        ref={flatListRef}
        data={[...messages].reverse()}
        renderItem={renderItem}
        keyExtractor={(item, i) => `msg-${messages.length - 1 - i}`}
        style={styles.flatList}
        contentContainerStyle={styles.listContent}
        inverted
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubbles-outline" size={80} color={tintColor + '40'} />
            <Text style={[styles.emptyText, { color: textColor + '60' }]}>
              Start a conversation! Type a message below.
            </Text>
          </View>
        }
        ListHeaderComponent={
          isSending ? (
            <Animated.View entering={FadeIn} style={[styles.bubble, { backgroundColor: '#E6F0FF', alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
              <ActivityIndicator size="small" color={tintColor} />
              <Text style={{ color: textColor, fontStyle: 'italic', fontSize: 14 }}>Thinking...</Text>
            </Animated.View>
          ) : null
        }
      />

      <View style={[styles.inputContainer, { backgroundColor, paddingBottom: isKeyboardOpen ? 24 : bottom + 65 }]}>
        <TextInput
          style={[styles.input, { backgroundColor: textColor + '10', color: textColor }]}
          placeholder="Type a message..."
          placeholderTextColor={textColor + '50'}
          value={inputText}
          onChangeText={setInputText}
          multiline
        />

        <TouchableOpacity
          onPress={() => setLangModalVisible(true)}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: tintColor + '10',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontWeight: '900', color: tintColor, fontSize: 13 }}>
            {targetLang.toUpperCase()}
          </Text>
        </TouchableOpacity>

        {inputText.length > 0 ? (
          <TouchableOpacity onPress={handleSend} disabled={isSending} style={[styles.sendButton, { backgroundColor: tintColor }]}>
            {isSending ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="arrow-up" size={24} color="#fff" />}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={handleMicPress}
            style={[
              styles.micButton,
              { backgroundColor: isRecording ? '#FF4D4F' : tintColor + '20' }
            ]}
          >
            <Ionicons name={isRecording ? "stop" : "mic"} size={24} color={isRecording ? "#fff" : tintColor} />
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flatList: { flex: 1 },
  loadingText: { marginTop: 100, textAlign: 'center' },
  lockedContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  iconCircle: { width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 10 },
  description: { textAlign: 'center', marginBottom: 30 },
  upgradeButton: { paddingHorizontal: 30, paddingVertical: 15, borderRadius: 25 },
  upgradeButtonText: { color: '#fff', fontWeight: 'bold' },

  listContent: { padding: 16, paddingBottom: 20, flexGrow: 1 },
  bubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 12,
  },
  voiceBubble: {
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  messageText: { fontSize: 16, lineHeight: 22 },
  translationContainer: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  translationText: {
    fontSize: 14,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  speakIcon: { marginTop: 8, alignSelf: 'flex-start' },

  correctionContainer: {
    alignSelf: 'center',
    backgroundColor: '#FFF9C4',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    width: '90%',
    borderWidth: 1,
    borderColor: '#FBC02D',
  },
  correctionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 6 },
  correctionTitle: { fontWeight: 'bold', color: '#F57F17', fontSize: 12, textTransform: 'uppercase' },
  correctionOriginal: { textDecorationLine: 'line-through', color: '#555', fontStyle: 'italic' },
  correctionArrow: { textAlign: 'center', fontSize: 16, color: '#F57F17', marginVertical: 2 },
  correctionBetter: { fontWeight: 'bold', color: '#000' },
  correctionExplanation: { marginTop: 4, fontSize: 12, color: '#666', flexWrap: 'wrap' },

  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    alignItems: 'center',
    gap: 10,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 100,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
    maxWidth: '70%',
  },
  header: {
    position: 'absolute',
    right: 20,
    zIndex: 10,
  },
  langButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 20,
    gap: 6,
  },
  langButtonText: {
    fontSize: 12,
    fontWeight: 'bold',
  }
});

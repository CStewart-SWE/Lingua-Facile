
import { useThemeColor } from '@/hooks/useThemeColor';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Speech from 'expo-speech';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Animated, { FadeIn, FadeInUp, Layout } from 'react-native-reanimated';
import { Paywall } from '../../components/subscription/Paywall';
import { useFeatureAccess } from '../../hooks/useFeatureAccess';

import { useAudioRecorder } from '../../hooks/useAudioRecorder';
import { ChatMessage, sendMessageToTutor } from '../../services/chatService';

export default function ChatScreen() {
  const [paywallVisible, setPaywallVisible] = useState(false);
  const { hasFeature, isPremium, isLoading: isFeatureLoading } = useFeatureAccess();

  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const tintColor = useThemeColor({}, 'tint');
  const userBubbleColor = tintColor;
  const aiBubbleColor = useThemeColor({}, 'card');

  // Chat State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [targetLang, setTargetLang] = useState('es'); // Default to Spanish, load later
  const [userLevel, setUserLevel] = useState('intermediate');

  // Audio State
  const { startRecording, stopRecording, isRecording, hasPermission } = useAudioRecorder();

  // Load Preferences
  useEffect(() => {
    (async () => {
      const savedLang = await AsyncStorage.getItem('translator_targetLang');
      if (savedLang) setTargetLang(savedLang);
    })();
  }, []);

  // Auto-scroll to bottom
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

  const handleSend = async (audioBase64?: string) => {
    const textToSend = inputText.trim();
    if (!textToSend && !audioBase64) return;

    const newUserMsg: ChatMessage = { role: 'user', content: textToSend || "🎤 Voice Message..." };
    const updatedMessages = [...messages, newUserMsg];

    setMessages(updatedMessages);
    setInputText('');
    setIsSending(true);

    try {
      const response = await sendMessageToTutor(updatedMessages, targetLang, userLevel, audioBase64);

      // Handle Transcript if it was voice
      if (response.user_transcript && audioBase64) {
        // Update the last user message with the actual text
        updatedMessages[updatedMessages.length - 1].content = response.user_transcript;
        setMessages([...updatedMessages]);
      }

      // Add Assistant Response
      const aiMsg: ChatMessage = { role: 'assistant', content: response.reply };

      // Inject correction as a separate system-like message or just render it differently?
      // Let's add it to the messages list but with a special flag or handle it in UI properties.
      // For simplicity, we just push the AI reply. We can store correction in local state or append.

      const finalMessages = [...updatedMessages, aiMsg];
      setMessages(finalMessages);

      // Auto-play AI response
      Speech.stop();
      Speech.speak(response.reply, { language: targetLang }); // Best effort language code match

      if (response.correction) {
        // Add a "System" message for correction
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
    if (isRecording) {
      const result = await stopRecording();
      if (result && result.base64) {
        handleSend(result.base64);
      }
    } else {
      await startRecording();
    }
  };

  const renderItem = ({ item }: { item: ChatMessage }) => {
    const isUser = item.role === 'user';
    const isSystem = item.role === 'system';

    if (isSystem) {
      // Parse correction
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

    return (
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
        {!isUser && (
          <TouchableOpacity onPress={() => Speech.speak(item.content, { language: targetLang })} style={styles.speakIcon}>
            <Ionicons name="volume-high" size={18} color={textColor + '80'} />
          </TouchableOpacity>
        )}
      </Animated.View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderItem}
        keyExtractor={(_, i) => i.toString()}
        contentContainerStyle={styles.listContent}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        style={[styles.inputContainer, { borderTopColor: textColor + '10', backgroundColor: backgroundColor }]}
      >
        <TextInput
          style={[styles.input, { backgroundColor: textColor + '05', color: textColor }]}
          placeholder="Type a message..."
          placeholderTextColor={textColor + '50'}
          value={inputText}
          onChangeText={setInputText}
          multiline
        />

        {inputText.length > 0 ? (
          <TouchableOpacity onPress={() => handleSend()} disabled={isSending} style={[styles.sendButton, { backgroundColor: tintColor }]}>
            {isSending ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="arrow-up" size={24} color="#fff" />}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={handleMicPress}
            style={[
              styles.micButton,
              isRecording ? styles.micActive : null,
              { backgroundColor: isRecording ? '#FF4D4F' : tintColor + '20' }
            ]}
          >
            <Ionicons name={isRecording ? "stop" : "mic"} size={24} color={isRecording ? "#fff" : tintColor} />
          </TouchableOpacity>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingText: { marginTop: 100, textAlign: 'center' },
  lockedContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  iconCircle: { width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 10 },
  description: { textAlign: 'center', marginBottom: 30 },
  upgradeButton: { paddingHorizontal: 30, paddingVertical: 15, borderRadius: 25 },
  upgradeButtonText: { color: '#fff', fontWeight: 'bold' },

  listContent: { padding: 16, paddingBottom: 20 },
  bubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 12,
  },
  messageText: { fontSize: 16, lineHeight: 22 },
  speakIcon: { marginTop: 8, alignSelf: 'flex-start' },

  correctionContainer: {
    alignSelf: 'center',
    backgroundColor: '#FFF9C4', // Soft yellow
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
  correctionExplanation: { marginTop: 4, fontSize: 12, color: '#666' },

  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    borderTopWidth: 1,
    alignItems: 'center',
    gap: 10,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
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
  micActive: {
    transform: [{ scale: 1.1 }],
  }
});

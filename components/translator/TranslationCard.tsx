import React from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { MotiView } from 'moti';
import * as Speech from 'expo-speech';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface TranslationCardProps {
  isLoading: boolean;
  featuresLoading?: boolean;
  translatedText: string;
  copiedOutput: boolean;
  setCopiedOutput: (v: boolean) => void;
  targetLang: string | null;
  languages: { code: string; name: string }[];
  handleNewTranslation: () => void;
  pronunciation?: string;
  meaning?: string;
}

export const TranslationCard: React.FC<TranslationCardProps> = ({
  isLoading,
  featuresLoading,
  translatedText,
  copiedOutput,
  setCopiedOutput,
  targetLang,
  languages,
  handleNewTranslation,
  pronunciation,
  meaning
}) => {
  return (
    <Animated.View
      entering={FadeIn.duration(500)}
      exiting={FadeOut.duration(350)}
      style={{ backgroundColor: 'white', borderRadius: 20, marginHorizontal: 12, marginBottom: 16, padding: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ fontWeight: '600', color: '#11181C', fontSize: 16 }}>{languages.find(l => l.code === targetLang)?.name || 'English'}</Text>
          <TouchableOpacity
            onPress={async () => {
              if (translatedText) {
                // Get the user's per-language voice map from AsyncStorage
                const voiceMapJson = await AsyncStorage.getItem('pronunciationVoiceMap');
                let voiceMap = {};
                if (voiceMapJson) voiceMap = JSON.parse(voiceMapJson);
                const langCode = (targetLang || 'en').split('-')[0];
                const selectedVoiceId = voiceMap[langCode];
                const voices = await Speech.getAvailableVoicesAsync();
                let selectedVoice = voices.find(v => v.identifier === selectedVoiceId) || voices.find(v => v.language.startsWith(langCode)) || voices[0];
                Speech.speak(translatedText, { language: targetLang || 'en', voice: selectedVoice?.identifier });
              }
            }}
            style={{ marginLeft: 6, padding: 6, borderRadius: 20 }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="play-circle-outline" size={28} color="#1976FF" />
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={handleNewTranslation} style={{ backgroundColor: '#F6F7FB', borderRadius: 16, padding: 4 }}>
          <Ionicons name="close" size={18} color="#B0B0B0" />
        </TouchableOpacity>
      </View>
      {isLoading ? (
        <View>
          {[...Array(2)].map((_, idx) => (
            <MotiView
              key={idx}
              from={{ opacity: 0.4 }}
              animate={{ opacity: 1 }}
              transition={{ loop: true, type: 'timing', duration: 900, delay: idx * 120, repeatReverse: true }}
              style={{ height: 24, backgroundColor: '#E6F0FF', borderRadius: 8, marginBottom: 12, width: idx === 0 ? '80%' : '60%' }}
            />
          ))}
          <Text style={{ color: '#B0B0B0', fontSize: 16 }}>Translating...</Text>
        </View>
      ) : (
        <>
          <Text style={{ fontSize: 24, color: '#1976FF', fontWeight: '700', marginBottom: 4 }}>{translatedText}</Text>
          
          {featuresLoading ? (
            <View style={{ marginTop: 8 }}>
              <MotiView
                from={{ opacity: 0.4 }}
                animate={{ opacity: 1 }}
                transition={{ loop: true, type: 'timing', duration: 900, repeatReverse: true }}
                style={{ height: 16, backgroundColor: '#F0F0F0', borderRadius: 8, marginBottom: 16, width: '40%' }}
              />
              <View style={{ marginBottom: 4 }}>
                <View style={{ height: 12, width: 60, backgroundColor: '#F0F0F0', borderRadius: 6, marginBottom: 8 }} />
                <MotiView
                  from={{ opacity: 0.4 }}
                  animate={{ opacity: 1 }}
                  transition={{ loop: true, type: 'timing', duration: 900, delay: 200, repeatReverse: true }}
                  style={{ height: 14, backgroundColor: '#F0F0F0', borderRadius: 7, marginBottom: 8, width: '90%' }}
                />
                <MotiView
                  from={{ opacity: 0.4 }}
                  animate={{ opacity: 1 }}
                  transition={{ loop: true, type: 'timing', duration: 900, delay: 400, repeatReverse: true }}
                  style={{ height: 14, backgroundColor: '#F0F0F0', borderRadius: 7, marginBottom: 12, width: '70%' }}
                />
              </View>
            </View>
          ) : (
            <>
              {pronunciation && <Text style={{ color: '#B0B0B0', fontSize: 16, marginBottom: 8, fontStyle: 'italic' }}>{pronunciation}</Text>}
              
              {meaning ? (
                <>
                  <Text style={{ color: '#B0B0B0', fontWeight: '600', marginBottom: 2 }}>MEANING</Text>
                  <Text style={{ color: '#11181C', fontSize: 15, marginBottom: 12 }}>{meaning}</Text>
                </>
              ) : (
                 <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, opacity: 0.6 }}>
                     <Ionicons name="lock-closed" size={14} color="#B0B0B0" style={{ marginRight: 4 }} />
                     <Text style={{ color: '#B0B0B0', fontSize: 14 }}>Meaning available with Premium</Text>
                 </View>
              )}
            </>
          )}

          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TouchableOpacity onPress={() => Alert.alert('Like pressed')} style={{ marginRight: 16 }}>
                <Ionicons name="thumbs-up-outline" size={22} color="#1976FF" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => Alert.alert('Dislike pressed')} style={{ marginRight: 16 }}>
                <Ionicons name="thumbs-down-outline" size={22} color="#1976FF" />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              onPress={async () => {
                if (translatedText) {
                  await Clipboard.setStringAsync(translatedText);
                  setCopiedOutput(true);
                  setTimeout(() => setCopiedOutput(false), 1200);
                }
              }}
              style={{
                backgroundColor: '#E6F0FF',
                borderRadius: 12,
                paddingHorizontal: 10,
                paddingVertical: 6,
                flexDirection: 'row',
                alignItems: 'center',
              }}
            >
              <Ionicons name={copiedOutput ? 'checkmark-outline' : 'clipboard-outline'} size={18} color={copiedOutput ? '#43B581' : '#1976FF'} style={{ marginRight: 4 }} />
              <Text style={{ color: copiedOutput ? '#43B581' : '#1976FF', fontWeight: '600', fontSize: 15 }}>{copiedOutput ? 'Copied!' : 'Copy'}</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </Animated.View>
  );
};

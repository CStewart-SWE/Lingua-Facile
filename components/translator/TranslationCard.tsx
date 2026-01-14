import React from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet } from 'react-native';
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
      style={styles.cardContainer}
    >
      <View style={styles.header}>
        <Text style={styles.langLabel}>
          {languages.find(l => l.code === targetLang)?.name || 'English'}
        </Text>
        <TouchableOpacity onPress={handleNewTranslation} style={styles.closeButton}>
          <Ionicons name="close" size={16} color="#666" />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          {[...Array(2)].map((_, idx) => (
            <MotiView
              key={idx}
              from={{ opacity: 0.4 }}
              animate={{ opacity: 1 }}
              transition={{ loop: true, type: 'timing', duration: 900, delay: idx * 120, repeatReverse: true }}
              style={[styles.skeletonLine, { width: idx === 0 ? '80%' : '60%' }]}
            />
          ))}
          <Text style={styles.loadingText}>Translating...</Text>
        </View>
      ) : (
        <>
          <Text style={styles.translatedText}>{translatedText}</Text>
          
          {featuresLoading ? (
            <View style={{ marginTop: 12 }}>
              <MotiView
                from={{ opacity: 0.4 }}
                animate={{ opacity: 1 }}
                transition={{ loop: true, type: 'timing', duration: 900, repeatReverse: true }}
                style={[styles.skeletonLine, { width: '40%', height: 16 }]}
              />
               <MotiView
                from={{ opacity: 0.4 }}
                animate={{ opacity: 1 }}
                transition={{ loop: true, type: 'timing', duration: 900, delay: 200, repeatReverse: true }}
                style={[styles.skeletonLine, { width: '90%', height: 14 }]}
              />
            </View>
          ) : (
            <View style={styles.featuresContainer}>
              {pronunciation && (
                <Text style={styles.pronunciation}>{pronunciation}</Text>
              )}
              
              {meaning ? (
                <View style={styles.meaningContainer}>
                  <Text style={styles.meaningLabel}>MEANING</Text>
                  <Text style={styles.meaningText}>{meaning}</Text>
                </View>
              ) : (
                 <View style={styles.premiumLock}>
                     <Ionicons name="lock-closed" size={12} color="#B0B0B0" style={{ marginRight: 4 }} />
                     <Text style={styles.premiumText}>Meaning available with Premium</Text>
                 </View>
              )}
            </View>
          )}

          <View style={styles.footer}>
            <View style={styles.leftActions}>
                <TouchableOpacity
                    onPress={async () => {
                      if (translatedText) {
                        const voiceMapJson = await AsyncStorage.getItem('pronunciationVoiceMap');
                        let voiceMap: any = {};
                        if (voiceMapJson) voiceMap = JSON.parse(voiceMapJson);
                        const langCode = (targetLang || 'en').split('-')[0];
                        const selectedVoiceId = voiceMap[langCode];
                        const voices = await Speech.getAvailableVoicesAsync();
                        let selectedVoice = voices.find(v => v.identifier === selectedVoiceId) || voices.find(v => v.language.startsWith(langCode)) || voices[0];
                        Speech.speak(translatedText, { language: targetLang || 'en', voice: selectedVoice?.identifier });
                      }
                    }}
                    style={styles.actionIcon}
                  >
                    <Ionicons name="volume-high-outline" size={24} color="#1976FF" />
                  </TouchableOpacity>
                  
                <TouchableOpacity onPress={() => Alert.alert('Favorite pressed')} style={styles.actionIcon}>
                   <Ionicons name="heart-outline" size={24} color="#666" />
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
              style={[styles.copyButton, copiedOutput && styles.copyButtonActive]}
            >
              <Ionicons 
                name={copiedOutput ? 'checkmark' : 'copy-outline'} 
                size={16} 
                color={copiedOutput ? '#fff' : '#1976FF'} 
                style={{ marginRight: 6 }} 
              />
              <Text style={[styles.copyText, copiedOutput && { color: '#fff' }]}>
                {copiedOutput ? 'Copied' : 'Copy'}
              </Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: '#fff',
    borderRadius: 24,
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 24,
    shadowColor: '#1976FF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  langLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1976FF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  closeButton: {
    backgroundColor: '#F5F7FA',
    borderRadius: 12,
    padding: 6,
  },
  loadingContainer: {
    paddingVertical: 12,
  },
  loadingText: {
    marginTop: 8,
    color: '#A0A0A0',
    fontSize: 14,
  },
  skeletonLine: {
    height: 20,
    backgroundColor: '#E6F0FF',
    borderRadius: 10,
    marginBottom: 12,
  },
  translatedText: {
    fontSize: 26,
    fontWeight: '600',
    color: '#1976FF',
    marginBottom: 16,
    lineHeight: 34,
  },
  featuresContainer: {
    marginBottom: 20,
  },
  pronunciation: {
    color: '#666',
    fontSize: 16,
    fontStyle: 'italic',
    marginBottom: 12,
  },
  meaningContainer: {
    marginTop: 8,
  },
  meaningLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#A0A0A0',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  meaningText: {
    fontSize: 15,
    color: '#333',
    lineHeight: 22,
  },
  premiumLock: {
    flexDirection: 'row',
    alignItems: 'center',
    opacity: 0.6,
  },
  premiumText: {
    color: '#B0B0B0',
    fontSize: 13,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 16,
  },
  leftActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  actionIcon: {
    padding: 4,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E6F0FF',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  copyButtonActive: {
    backgroundColor: '#43B581',
  },
  copyText: {
    color: '#1976FF',
    fontWeight: '600',
    fontSize: 14,
  },
});

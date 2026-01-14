import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';

interface InputCardProps {
  draftInputText: string;
  setDraftInputText: (v: string) => void;
  inputFocused: boolean;
  setInputFocused: (v: boolean) => void;
  setInputText: (v: string) => void;
  hasClipboardContent: boolean;
  languages: { code: string; name: string }[];
  sourceLang: string | null;
  handleTranslate?: () => void;
}

export const InputCard: React.FC<InputCardProps> = ({
  draftInputText,
  setDraftInputText,
  inputFocused,
  setInputFocused,
  setInputText,
  hasClipboardContent,
  languages,
  sourceLang,
  handleTranslate,
}) => (
  <View style={styles.cardContainer}>
    <View style={styles.headerRow}>
      <Text style={styles.langLabel}>
        {languages.find(l => l.code === sourceLang)?.name || 'Detect Language'}
      </Text>
      {/* Optional: Add clear button if text exists */}
      {draftInputText.length > 0 && (
         <TouchableOpacity onPress={() => {
            setDraftInputText('');
            setInputText('');
         }}>
             <Ionicons name="close-circle" size={20} color="#ccc" />
         </TouchableOpacity>
      )}
    </View>

    <TextInput
      style={styles.textInput}
      value={draftInputText}
      onChangeText={setDraftInputText}
      placeholder="Type or paste text..."
      placeholderTextColor="#A0A0A0"
      multiline
      textAlignVertical="top"
      returnKeyType="done"
      blurOnSubmit={true}
      onSubmitEditing={() => setInputText(draftInputText)}
      onFocus={() => setInputFocused(true)}
      onBlur={() => { setInputFocused(false); setInputText(draftInputText); }}
    />

    <View style={styles.toolbar}>
      <TouchableOpacity
        onPress={async () => {
          const text = await Clipboard.getStringAsync();
          if (text) {
            setDraftInputText(text);
            if (!inputFocused) {
              setInputText(text);
              if (handleTranslate) handleTranslate();
            }
          }
        }}
        disabled={!hasClipboardContent}
        style={[styles.toolButton, !hasClipboardContent && styles.disabledTool]}
      >
        <Ionicons name="clipboard-outline" size={20} color={hasClipboardContent ? '#1976FF' : '#B0B0B0'} />
        <Text style={[styles.toolText, !hasClipboardContent && styles.disabledText]}>Paste</Text>
      </TouchableOpacity>
      
      <View style={styles.toolGroup}>
         <TouchableOpacity onPress={() => Alert.alert('Mic pressed')} style={styles.iconButton}>
            <Ionicons name="mic-outline" size={22} color="#555" />
         </TouchableOpacity>
         <TouchableOpacity onPress={() => Alert.alert('Camera pressed')} style={styles.iconButton}>
            <Ionicons name="camera-outline" size={22} color="#555" />
         </TouchableOpacity>
      </View>
    </View>
  </View>
);

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: '#fff',
    borderRadius: 24,
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    minHeight: 180,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  langLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1976FF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  textInput: {
    fontSize: 22,
    color: '#333',
    minHeight: 80,
    marginBottom: 16,
    fontWeight: '400',
    lineHeight: 30,
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 16,
  },
  toolButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F7FA',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  toolText: {
    marginLeft: 6,
    color: '#1976FF',
    fontWeight: '600',
    fontSize: 14,
  },
  disabledTool: {
    opacity: 0.6,
  },
  disabledText: {
    color: '#B0B0B0',
  },
  toolGroup: {
    flexDirection: 'row',
    gap: 16,
  },
  iconButton: {
    padding: 8,
  },
});

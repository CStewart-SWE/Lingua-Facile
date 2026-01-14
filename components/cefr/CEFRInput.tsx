import React from 'react';
import { TextInput, View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';

interface CEFRInputProps {
  input: string;
  setInput: (text: string) => void;
  loading: boolean;
  onSubmit: () => void;
  onFocus: () => void;
  onBlur: () => void;
  inputFocused: boolean;
  hasClipboardContent: boolean;
}

export const CEFRInput: React.FC<CEFRInputProps> = ({
  input,
  setInput,
  loading,
  onSubmit,
  onFocus,
  onBlur,
  inputFocused,
  hasClipboardContent,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.label}>Text to Analyze</Text>
        {!!input && (
          <TouchableOpacity onPress={() => setInput('')} style={styles.clearButton}>
            <Ionicons name="close-circle" size={20} color="#ccc" />
          </TouchableOpacity>
        )}
      </View>
      
      <TextInput
        style={styles.input}
        value={input}
        onChangeText={setInput}
        placeholder="Type or paste a sentence..."
        placeholderTextColor="#A0A0A0"
        multiline
        textAlignVertical="top"
        returnKeyType="done"
        blurOnSubmit={true}
        onFocus={onFocus}
        onBlur={onBlur}
        onSubmitEditing={() => {
          if (input.trim() && !loading) {
            onSubmit();
          }
        }}
      />
      
      <View style={styles.footer}>
        <TouchableOpacity
          onPress={async () => {
            try {
              const text = await Clipboard.getStringAsync();
              if (text) setInput(text);
            } catch (e) {
              console.log(e);
            }
          }}
          disabled={!hasClipboardContent}
          style={[styles.pasteButton, !hasClipboardContent && styles.pasteButtonDisabled]}
        >
          <Ionicons name="clipboard-outline" size={18} color={hasClipboardContent ? '#1976FF' : '#B0B0B0'} />
          <Text style={[styles.pasteText, !hasClipboardContent && styles.pasteTextDisabled]}>Paste</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 24,
    marginBottom: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    width: '100%',
    maxWidth: 500,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1976FF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  clearButton: {
    padding: 4,
  },
  input: {
    fontSize: 20,
    color: '#333',
    minHeight: 100,
    marginBottom: 16,
    fontWeight: '400',
    lineHeight: 28,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 16,
  },
  pasteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F7FA',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    gap: 6,
  },
  pasteButtonDisabled: {
    opacity: 0.6,
  },
  pasteText: {
    color: '#1976FF',
    fontWeight: '600',
    fontSize: 14,
  },
  pasteTextDisabled: {
    color: '#B0B0B0',
  },
});

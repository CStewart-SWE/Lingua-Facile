import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { FlatList, Modal, Pressable, Text, TouchableOpacity, View } from 'react-native';

interface LanguageSelectorProps {
  sourceLang: string | null;
  targetLang: string | null;
  languages: { code: string; name: string }[];
  openLanguageModal: (type: 'source' | 'target') => void;
  openLanguageModalSwap: () => void;
  languageModalVisible: boolean;
  languageModalType: 'source' | 'target' | null;
  closeLanguageModal: () => void;
  selectLanguage: (code: string) => void;
  compact?: boolean;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  sourceLang,
  targetLang,
  languages,
  openLanguageModal,
  openLanguageModalSwap,
  languageModalVisible,
  languageModalType,
  closeLanguageModal,
  selectLanguage,
  compact = false,
}) => (
  <>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: compact ? 0 : 8, marginBottom: compact ? 0 : 8 }}>
      <View style={{
        backgroundColor: 'white',
        borderRadius: compact ? 20 : 16,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: compact ? 12 : 24,
        paddingVertical: compact ? 4 : 8,
        elevation: compact ? 0 : 2,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: compact ? 0 : 2 },
        shadowOpacity: compact ? 0 : 0.1,
        shadowRadius: compact ? 0 : 4,
        minWidth: compact ? 'auto' : 320,
        justifyContent: 'center',
        width: compact ? 'auto' : 360,
        gap: compact ? 8 : 0
      }}>
        <TouchableOpacity onPress={() => openLanguageModal('source')} style={{ alignItems: 'flex-start' }}>
          <Text style={{ fontSize: compact ? 14 : 20, fontWeight: '600', color: '#11181C', marginRight: compact ? 4 : 12 }}>
            {languages.find(l => l.code === sourceLang)?.name || 'Italian'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={openLanguageModalSwap} style={{ marginHorizontal: compact ? 4 : 12, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="swap-horizontal" size={compact ? 16 : 28} color="#1976FF" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => openLanguageModal('target')} style={{ alignItems: 'flex-end' }}>
          <Text style={{ fontSize: compact ? 14 : 20, fontWeight: '600', color: '#11181C', marginLeft: compact ? 4 : 12 }}>
            {languages.find(l => l.code === targetLang)?.name || 'English'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
    <Modal
      visible={languageModalVisible}
      transparent
      animationType="slide"
      onRequestClose={closeLanguageModal}
    >
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' }}>
        <View style={{ backgroundColor: 'white', borderRadius: 16, padding: 24, width: '80%' }}>
          <Text style={{ fontSize: 20, fontWeight: '600', marginBottom: 16, textAlign: 'center' }}>
            Select {languageModalType === 'source' ? 'Input' : 'Target'} Language
          </Text>
          <FlatList
            data={
              languageModalType === 'source'
                ? languages.filter(l => l.code !== targetLang)
                : languages.filter(l => l.code !== sourceLang)
            }
            keyExtractor={item => item.code}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => selectLanguage(item.code)}
                style={({ pressed }) => ({
                  paddingVertical: 12,
                  paddingHorizontal: 8,
                  backgroundColor: pressed ? '#E6F0FF' : 'white',
                  borderRadius: 8,
                  marginBottom: 4,
                })}
              >
                <Text style={{ fontSize: 18, color: '#11181C' }}>{item.name}</Text>
              </Pressable>
            )}
            style={{ maxHeight: 300 }}
          />
          <TouchableOpacity onPress={closeLanguageModal} style={{ marginTop: 16, alignSelf: 'center' }}>
            <Text style={{ color: '#1976FF', fontWeight: '600', fontSize: 16 }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  </>
);

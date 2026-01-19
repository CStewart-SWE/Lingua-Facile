import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { FlatList, Modal, Pressable, Text, TouchableOpacity, View } from 'react-native';

interface ChatLanguageSettingsProps {
    visible: boolean;
    onClose: () => void;
    sourceLang: string;
    targetLang: string;
    setSourceLang: (lang: string) => void;
    setTargetLang: (lang: string) => void;
    languages: { code: string; name: string }[];
}

export const ChatLanguageSettings: React.FC<ChatLanguageSettingsProps> = ({
    visible,
    onClose,
    sourceLang,
    targetLang,
    setSourceLang,
    setTargetLang,
    languages,
}) => {
    const [activeTab, setActiveTab] = useState<'source' | 'target'>('target');

    const activeLang = activeTab === 'source' ? sourceLang : targetLang;

    const handleSelect = (code: string) => {
        if (activeTab === 'source') {
            setSourceLang(code);
        } else {
            setTargetLang(code);
        }
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
                <View style={{ backgroundColor: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24, height: '70%', paddingBottom: 24 }}>

                    {/* Header / Tabs */}
                    <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#eee' }}>
                        <TouchableOpacity
                            onPress={() => setActiveTab('source')}
                            style={{ flex: 1, paddingVertical: 16, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: activeTab === 'source' ? '#1976FF' : 'transparent' }}
                        >
                            <Text style={{ fontSize: 16, fontWeight: '600', color: activeTab === 'source' ? '#1976FF' : '#999' }}>I Speak (Native)</Text>
                            <Text style={{ fontSize: 14, color: '#666', marginTop: 4 }}>{languages.find(l => l.code === sourceLang)?.name}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => setActiveTab('target')}
                            style={{ flex: 1, paddingVertical: 16, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: activeTab === 'target' ? '#1976FF' : 'transparent' }}
                        >
                            <Text style={{ fontSize: 16, fontWeight: '600', color: activeTab === 'target' ? '#1976FF' : '#999' }}>I'm Learning</Text>
                            <Text style={{ fontSize: 14, color: '#666', marginTop: 4 }}>{languages.find(l => l.code === targetLang)?.name}</Text>
                        </TouchableOpacity>
                    </View>

                    {/* List */}
                    <FlatList
                        data={languages}
                        keyExtractor={item => item.code}
                        contentContainerStyle={{ padding: 16 }}
                        renderItem={({ item }) => {
                            const isSelected = item.code === activeLang;
                            return (
                                <Pressable
                                    onPress={() => handleSelect(item.code)}
                                    style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        paddingVertical: 14,
                                        paddingHorizontal: 12,
                                        backgroundColor: isSelected ? '#F0F7FF' : 'transparent',
                                        borderRadius: 12,
                                        marginBottom: 4
                                    }}
                                >
                                    <Text style={{ fontSize: 16, color: isSelected ? '#1976FF' : '#333', flex: 1, fontWeight: isSelected ? '600' : '400' }}>
                                        {item.name}
                                    </Text>
                                    {isSelected && <Ionicons name="checkmark" size={20} color="#1976FF" />}
                                </Pressable>
                            );
                        }}
                    />

                    {/* Close Button */}
                    <TouchableOpacity
                        onPress={onClose}
                        style={{
                            marginTop: 16,
                            marginHorizontal: 16,
                            backgroundColor: '#11181C',
                            paddingVertical: 16,
                            borderRadius: 16,
                            alignItems: 'center'
                        }}
                    >
                        <Text style={{ color: 'white', fontSize: 16, fontWeight: '600' }}>Done</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

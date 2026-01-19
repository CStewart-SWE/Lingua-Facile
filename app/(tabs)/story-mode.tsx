import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Paywall } from '../../components/subscription/Paywall';
import { useFeatureAccess } from '../../hooks/useFeatureAccess';
import { useLanguageStore } from '../store/useLanguageStore';

const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

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

export default function StoryModeScreen() {
    const router = useRouter();
    const { sourceLang, targetLang, setSourceLang, setTargetLang } = useLanguageStore();
    const { hasFeature, isPremium } = useFeatureAccess();
    const [cefrLevel, setCefrLevel] = useState('B1');
    const [topic, setTopic] = useState('');
    const [languageModalVisible, setLanguageModalVisible] = useState(false);
    const [languageModalType, setLanguageModalType] = useState<'source' | 'target' | null>(null);
    const [paywallVisible, setPaywallVisible] = useState(false);

    const [useAiTopic, setUseAiTopic] = useState(false);

    const canUseStoryMode = hasFeature('story_mode');

    const openLanguageModal = (type: 'source' | 'target') => {
        setLanguageModalType(type);
        setLanguageModalVisible(true);
    };

    const selectLanguage = (code: string) => {
        if (languageModalType === 'source') {
            setSourceLang(code);
        } else if (languageModalType === 'target') {
            setTargetLang(code);
        }
        setLanguageModalVisible(false);
        setLanguageModalType(null);
    };

    const handleYouPick = () => {
        setUseAiTopic(true);
        setTopic('🎲 AI will pick a surprise topic!');
    };

    const handleTopicChange = (text: string) => {
        setTopic(text);
        setUseAiTopic(false);
    };

    const handleGenerateStory = () => {
        if (!topic.trim() && !useAiTopic) {
            return;
        }
        router.push({
            pathname: '/story',
            params: {
                targetLang,
                sourceLang,
                cefrLevel,
                topic: useAiTopic ? '__AI_PICK__' : topic.trim()
            }
        });
    };

    const getLanguageName = (code: string) => {
        return languages.find(l => l.code === code)?.name || code.toUpperCase();
    };

    // Show premium required screen for non-premium users
    if (!canUseStoryMode) {
        return (
            <View style={styles.container}>
                <View style={styles.premiumRequiredContainer}>
                    <View style={styles.premiumIconBadge}>
                        <Ionicons name="lock-closed" size={48} color="#1976FF" />
                    </View>
                    <Text style={styles.premiumTitle}>Premium Feature</Text>
                    <Text style={styles.premiumSubtitle}>
                        Story Mode is available for Premium subscribers. Upgrade to unlock AI-generated stories and quizzes.
                    </Text>
                    <TouchableOpacity
                        style={styles.upgradeButton}
                        onPress={() => setPaywallVisible(true)}
                    >
                        <Ionicons name="diamond" size={18} color="#fff" />
                        <Text style={styles.upgradeButtonText}>Upgrade to Premium</Text>
                    </TouchableOpacity>
                </View>
                <Paywall
                    visible={paywallVisible}
                    onClose={() => setPaywallVisible(false)}
                    feature="Story Mode"
                />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
            >

                {/* Language Selection */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Languages</Text>
                    <View style={styles.languageRow}>
                        <TouchableOpacity
                            style={styles.languageButton}
                            onPress={() => openLanguageModal('source')}
                        >
                            <Text style={styles.languageLabel}>Your Language</Text>
                            <Text style={styles.languageValue}>{getLanguageName(sourceLang)}</Text>
                            <Ionicons name="chevron-down" size={16} color="#687076" />
                        </TouchableOpacity>

                        <Ionicons name="arrow-forward" size={20} color="#687076" style={styles.arrowIcon} />

                        <TouchableOpacity
                            style={styles.languageButton}
                            onPress={() => openLanguageModal('target')}
                        >
                            <Text style={styles.languageLabel}>Story Language</Text>
                            <Text style={styles.languageValue}>{getLanguageName(targetLang)}</Text>
                            <Ionicons name="chevron-down" size={16} color="#687076" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* CEFR Level Selection */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Difficulty Level</Text>
                    <View style={styles.levelRow}>
                        {CEFR_LEVELS.map((level) => (
                            <TouchableOpacity
                                key={level}
                                style={[
                                    styles.levelButton,
                                    cefrLevel === level && styles.levelButtonActive
                                ]}
                                onPress={() => setCefrLevel(level)}
                            >
                                <Text style={[
                                    styles.levelText,
                                    cefrLevel === level && styles.levelTextActive
                                ]}>
                                    {level}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Topic Input */}
                <View style={styles.section}>
                    <View style={styles.topicHeader}>
                        <Text style={styles.sectionTitle}>Story Topic</Text>
                        <TouchableOpacity onPress={handleYouPick} style={styles.youPickButton}>
                            <Ionicons name="shuffle" size={16} color="#1976FF" />
                            <Text style={styles.youPickText}>You Pick</Text>
                        </TouchableOpacity>
                    </View>
                    <TextInput
                        style={[styles.topicInput, useAiTopic && styles.topicInputAiPick]}
                        placeholder="Describe the story you want to read..."
                        placeholderTextColor="#A0A0A0"
                        value={topic}
                        onChangeText={handleTopicChange}
                        multiline
                        numberOfLines={3}
                    />
                </View>

                {/* Generate Button */}
                <TouchableOpacity
                    style={[
                        styles.generateButton,
                        !topic.trim() && styles.generateButtonDisabled
                    ]}
                    onPress={handleGenerateStory}
                    disabled={!topic.trim()}
                >
                    <Ionicons name="book" size={20} color="#fff" />
                    <Text style={styles.generateButtonText}>Generate Story</Text>
                </TouchableOpacity>
            </ScrollView>

            {/* Language Selection Modal */}
            <Modal
                visible={languageModalVisible}
                animationType="slide"
                transparent
                onRequestClose={() => setLanguageModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <SafeAreaView style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>
                                Select {languageModalType === 'source' ? 'Your' : 'Story'} Language
                            </Text>
                            <TouchableOpacity onPress={() => setLanguageModalVisible(false)}>
                                <Ionicons name="close" size={24} color="#11181C" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView>
                            {languages.map((lang) => (
                                <TouchableOpacity
                                    key={lang.code}
                                    style={[
                                        styles.languageOption,
                                        (languageModalType === 'source' ? sourceLang : targetLang) === lang.code &&
                                        styles.languageOptionActive
                                    ]}
                                    onPress={() => selectLanguage(lang.code)}
                                >
                                    <Text style={[
                                        styles.languageOptionText,
                                        (languageModalType === 'source' ? sourceLang : targetLang) === lang.code &&
                                        styles.languageOptionTextActive
                                    ]}>
                                        {lang.name}
                                    </Text>
                                    {(languageModalType === 'source' ? sourceLang : targetLang) === lang.code && (
                                        <Ionicons name="checkmark" size={20} color="#1976FF" />
                                    )}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </SafeAreaView>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F6F7FB',
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 40,
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#11181C',
        marginBottom: 12,
    },
    languageRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    languageButton: {
        flex: 1,
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 16,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    languageLabel: {
        fontSize: 12,
        color: '#687076',
        marginBottom: 4,
    },
    languageValue: {
        fontSize: 16,
        fontWeight: '600',
        color: '#11181C',
        marginBottom: 4,
    },
    arrowIcon: {
        marginHorizontal: 12,
    },
    levelRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    levelButton: {
        backgroundColor: '#E8ECEF',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 12,
    },
    levelButtonActive: {
        backgroundColor: '#1976FF',
    },
    levelText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#687076',
    },
    levelTextActive: {
        color: '#fff',
    },
    topicHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    youPickButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#E6F0FF',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        gap: 4,
    },
    youPickText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1976FF',
    },
    topicInput: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        fontSize: 16,
        color: '#11181C',
        minHeight: 100,
        textAlignVertical: 'top',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    topicInputAiPick: {
        backgroundColor: '#E6F0FF',
        borderWidth: 2,
        borderColor: '#1976FF',
    },
    generateButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#1976FF',
        paddingVertical: 16,
        borderRadius: 16,
        gap: 8,
        marginTop: 8,
    },
    generateButtonDisabled: {
        backgroundColor: '#B0C4DE',
    },
    generateButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#fff',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '70%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#E8ECEF',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#11181C',
    },
    languageOption: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    languageOptionActive: {
        backgroundColor: '#E6F0FF',
    },
    languageOptionText: {
        fontSize: 16,
        color: '#11181C',
    },
    languageOptionTextActive: {
        fontWeight: '600',
        color: '#1976FF',
    },
    premiumRequiredContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 40,
    },
    premiumIconBadge: {
        width: 96,
        height: 96,
        borderRadius: 48,
        backgroundColor: '#E6F0FF',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
    },
    premiumTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#11181C',
        marginBottom: 12,
        textAlign: 'center',
    },
    premiumSubtitle: {
        fontSize: 16,
        color: '#687076',
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 32,
    },
    upgradeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1976FF',
        paddingVertical: 14,
        paddingHorizontal: 24,
        borderRadius: 16,
        gap: 8,
        shadowColor: '#1976FF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
        elevation: 6,
    },
    upgradeButtonText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 16,
    },
});

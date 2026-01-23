import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { GeneratedStory, generateStory } from '@/services/storyService';
import { TTS } from '@/services/ttsService';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MotiView } from 'moti';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface QuizAnswer {
    questionIndex: number;
    selectedAnswer: string;
    isCorrect: boolean;
}

type ActiveTab = 'story' | 'quiz';

export default function StoryScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { isPremium } = useFeatureAccess();
    const params = useLocalSearchParams<{
        targetLang: string;
        sourceLang: string;
        cefrLevel: string;
        topic: string;
    }>();

    const [story, setStory] = useState<GeneratedStory | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [quizAnswers, setQuizAnswers] = useState<QuizAnswer[]>([]);
    const [showResults, setShowResults] = useState(false);
    const [activeTab, setActiveTab] = useState<ActiveTab>('story');

    // TTS State
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [currentWordIndex, setCurrentWordIndex] = useState(-1);
    const wordsRef = useRef<string[]>([]);
    const wordIndexRef = useRef(0);

    useEffect(() => {
        loadStory();
        return () => {
            TTS.stop();
        };
    }, []);

    const loadStory = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await generateStory({
                targetLang: params.targetLang || 'es',
                cefrLevel: params.cefrLevel || 'B1',
                topic: params.topic || 'A day at the park'
            });
            setStory(result);
        } catch (err) {
            console.error('Failed to generate story:', err);
            setError(err instanceof Error ? err.message : 'Failed to generate story');
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        TTS.stop();
        Alert.alert(
            'Leave Story?',
            'Are you sure you want to exit? Your progress will be lost.',
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Exit', style: 'destructive', onPress: () => router.back() }
            ]
        );
    };

    // TTS with word highlighting
    const handleSpeak = useCallback(async () => {
        if (!story) return;

        if (isSpeaking) {
            await TTS.stop();
            setIsSpeaking(false);
            setCurrentWordIndex(-1);
            return;
        }

        const words = story.story.split(/(\s+)/);
        wordsRef.current = words;
        wordIndexRef.current = 0;
        setCurrentWordIndex(0);
        setIsSpeaking(true);

        // Calculate word boundaries for highlighting fallback
        const textLength = story.story.length;
        const avgCharTime = 50; // Approximate ms per character

        // Use TTS service - premium users get ElevenLabs, with timing-based highlighting fallback
        TTS.speak(story.story, {
            language: params.targetLang || 'en',
            isPremium,
            onDone: () => {
                setIsSpeaking(false);
                setCurrentWordIndex(-1);
            },
            onError: () => {
                setIsSpeaking(false);
                setCurrentWordIndex(-1);
            }
        });

        // Timing-based highlighting for all cases (works for both ElevenLabs and device TTS)
        const totalDuration = textLength * avgCharTime;
        const wordDuration = totalDuration / words.filter(w => w.trim()).length;

        let wordIdx = 0;
        const interval = setInterval(() => {
            if (!isSpeaking) {
                clearInterval(interval);
                return;
            }
            wordIdx++;
            while (wordIdx < words.length && !words[wordIdx].trim()) {
                wordIdx++;
            }
            if (wordIdx < words.length) {
                setCurrentWordIndex(wordIdx);
            } else {
                clearInterval(interval);
            }
        }, wordDuration);

    }, [story, isSpeaking, params.targetLang, isPremium]);

    const handleAnswerSelect = (questionIndex: number, selectedAnswer: string) => {
        if (quizAnswers.some(a => a.questionIndex === questionIndex)) {
            return;
        }

        const isCorrect = story?.questions[questionIndex].correctAnswer === selectedAnswer;
        const newAnswers = [...quizAnswers, { questionIndex, selectedAnswer, isCorrect }];
        setQuizAnswers(newAnswers);

        if (newAnswers.length === story?.questions.length) {
            setTimeout(() => setShowResults(true), 500);
        }
    };

    const getAnswerStyle = (questionIndex: number, option: string) => {
        const answer = quizAnswers.find(a => a.questionIndex === questionIndex);
        if (!answer) return styles.optionButton;

        if (option === story?.questions[questionIndex].correctAnswer) {
            return [styles.optionButton, styles.optionCorrect];
        }
        if (option === answer.selectedAnswer && !answer.isCorrect) {
            return [styles.optionButton, styles.optionIncorrect];
        }
        return [styles.optionButton, styles.optionDisabled];
    };

    const getAnswerTextStyle = (questionIndex: number, option: string) => {
        const answer = quizAnswers.find(a => a.questionIndex === questionIndex);
        if (!answer) return styles.optionText;

        if (option === story?.questions[questionIndex].correctAnswer) {
            return [styles.optionText, styles.optionTextCorrect];
        }
        if (option === answer.selectedAnswer && !answer.isCorrect) {
            return [styles.optionText, styles.optionTextIncorrect];
        }
        return [styles.optionText, styles.optionTextDisabled];
    };

    const correctCount = quizAnswers.filter(a => a.isCorrect).length;

    // Render story text with highlighting
    const renderStoryText = () => {
        if (!story) return null;
        const words = story.story.split(/(\s+)/);

        return (
            <Text style={styles.storyText}>
                {words.map((word, index) => (
                    <Text
                        key={index}
                        style={[
                            currentWordIndex === index && isSpeaking && styles.highlightedWord
                        ]}
                    >
                        {word}
                    </Text>
                ))}
            </Text>
        );
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <Text style={styles.levelBadge}>{params.cefrLevel}</Text>
                </View>
                <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                    <Ionicons name="close" size={24} color="#11181C" />
                </TouchableOpacity>
            </View>

            {/* Content */}
            {isLoading ? (
                <View style={styles.loadingContainer}>
                    <MotiView
                        from={{ opacity: 0.4 }}
                        animate={{ opacity: 1 }}
                        transition={{ loop: true, type: 'timing', duration: 800, repeatReverse: true }}
                        style={styles.loadingIcon}
                    >
                        <Ionicons name="book" size={48} color="#1976FF" />
                    </MotiView>
                    <Text style={styles.loadingText}>Generating your story...</Text>
                    <Text style={styles.loadingSubtext}>This may take a few seconds</Text>
                </View>
            ) : error ? (
                <View style={styles.errorContainer}>
                    <Ionicons name="alert-circle" size={48} color="#FF4D4F" />
                    <Text style={styles.errorText}>{error}</Text>
                    <TouchableOpacity onPress={loadStory} style={styles.retryButton}>
                        <Text style={styles.retryText}>Try Again</Text>
                    </TouchableOpacity>
                </View>
            ) : story ? (
                <>
                    {/* Tab Navigation */}
                    <View style={styles.tabBar}>
                        <TouchableOpacity
                            style={[styles.tabButton, activeTab === 'story' && styles.tabButtonActive]}
                            onPress={() => setActiveTab('story')}
                        >
                            <Ionicons
                                name="book-outline"
                                size={18}
                                color={activeTab === 'story' ? '#1976FF' : '#687076'}
                            />
                            <Text style={[styles.tabText, activeTab === 'story' && styles.tabTextActive]}>
                                Story
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.tabButton, activeTab === 'quiz' && styles.tabButtonActive]}
                            onPress={() => setActiveTab('quiz')}
                        >
                            <Ionicons
                                name="help-circle-outline"
                                size={18}
                                color={activeTab === 'quiz' ? '#1976FF' : '#687076'}
                            />
                            <Text style={[styles.tabText, activeTab === 'quiz' && styles.tabTextActive]}>
                                Quiz
                            </Text>
                            {quizAnswers.length > 0 && (
                                <View style={styles.badge}>
                                    <Text style={styles.badgeText}>
                                        {quizAnswers.length}/{story.questions.length}
                                    </Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    </View>

                    {/* Story Tab */}
                    {activeTab === 'story' && (
                        <ScrollView
                            style={styles.scrollView}
                            contentContainerStyle={styles.scrollContent}
                            showsVerticalScrollIndicator={false}
                        >
                            <View style={styles.storyCard}>
                                <View style={styles.storyHeader}>
                                    <Text style={styles.storyTitle}>{story.title}</Text>
                                    <TouchableOpacity
                                        onPress={handleSpeak}
                                        style={[styles.speakButton, isSpeaking && styles.speakButtonActive]}
                                    >
                                        <Ionicons
                                            name={isSpeaking ? 'stop' : 'volume-high'}
                                            size={20}
                                            color={isSpeaking ? '#fff' : '#1976FF'}
                                        />
                                    </TouchableOpacity>
                                </View>
                                {renderStoryText()}
                            </View>

                            <TouchableOpacity
                                style={styles.goToQuizButton}
                                onPress={() => setActiveTab('quiz')}
                            >
                                <Text style={styles.goToQuizText}>Take the Quiz</Text>
                                <Ionicons name="arrow-forward" size={20} color="#fff" />
                            </TouchableOpacity>
                        </ScrollView>
                    )}

                    {/* Quiz Tab */}
                    {activeTab === 'quiz' && (
                        <ScrollView
                            style={styles.scrollView}
                            contentContainerStyle={styles.scrollContent}
                            showsVerticalScrollIndicator={false}
                        >
                            {story.questions.map((question, qIndex) => (
                                <View key={qIndex} style={styles.questionCard}>
                                    <Text style={styles.questionNumber}>Question {qIndex + 1}</Text>
                                    <Text style={styles.questionText}>{question.question}</Text>

                                    <View style={styles.optionsContainer}>
                                        {question.options.map((option, oIndex) => (
                                            <TouchableOpacity
                                                key={oIndex}
                                                style={getAnswerStyle(qIndex, option)}
                                                onPress={() => handleAnswerSelect(qIndex, option)}
                                                disabled={quizAnswers.some(a => a.questionIndex === qIndex)}
                                            >
                                                <Text style={getAnswerTextStyle(qIndex, option)}>{option}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>
                            ))}

                            {showResults && (
                                <View style={styles.resultsCard}>
                                    <Ionicons
                                        name={correctCount === story.questions.length ? 'trophy' : 'ribbon'}
                                        size={48}
                                        color={correctCount === story.questions.length ? '#FFD700' : '#1976FF'}
                                    />
                                    <Text style={styles.resultsTitle}>
                                        {correctCount === story.questions.length
                                            ? 'Perfect Score!'
                                            : 'Quiz Complete!'}
                                    </Text>
                                    <Text style={styles.resultsText}>
                                        You got {correctCount} out of {story.questions.length} correct
                                    </Text>
                                    <TouchableOpacity
                                        onPress={() => router.back()}
                                        style={styles.doneButton}
                                    >
                                        <Text style={styles.doneButtonText}>Done</Text>
                                    </TouchableOpacity>
                                </View>
                            )}

                            <TouchableOpacity
                                style={styles.backToStoryButton}
                                onPress={() => setActiveTab('story')}
                            >
                                <Ionicons name="arrow-back" size={18} color="#1976FF" />
                                <Text style={styles.backToStoryText}>Back to Story</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    )}
                </>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F6F7FB',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 12,
        backgroundColor: '#F6F7FB',
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    levelBadge: {
        backgroundColor: '#1976FF',
        color: '#fff',
        fontWeight: '700',
        fontSize: 14,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        overflow: 'hidden',
    },
    closeButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#E8ECEF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    tabBar: {
        flexDirection: 'row',
        marginHorizontal: 20,
        backgroundColor: '#E8ECEF',
        borderRadius: 12,
        padding: 4,
        marginBottom: 16,
    },
    tabButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        borderRadius: 10,
        gap: 6,
    },
    tabButtonActive: {
        backgroundColor: '#fff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    tabText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#687076',
    },
    tabTextActive: {
        color: '#1976FF',
    },
    badge: {
        backgroundColor: '#1976FF',
        borderRadius: 10,
        paddingHorizontal: 6,
        paddingVertical: 2,
        marginLeft: 4,
    },
    badgeText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '700',
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 40,
    },
    loadingIcon: {
        marginBottom: 24,
    },
    loadingText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#11181C',
        marginBottom: 8,
    },
    loadingSubtext: {
        fontSize: 14,
        color: '#687076',
    },
    errorContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 40,
    },
    errorText: {
        fontSize: 16,
        color: '#FF4D4F',
        textAlign: 'center',
        marginTop: 16,
        marginBottom: 24,
    },
    retryButton: {
        backgroundColor: '#1976FF',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 12,
    },
    retryText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 16,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 40,
    },
    storyCard: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 24,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    storyHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16,
    },
    storyTitle: {
        flex: 1,
        fontSize: 22,
        fontWeight: '700',
        color: '#11181C',
        marginRight: 12,
    },
    speakButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#E6F0FF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    speakButtonActive: {
        backgroundColor: '#1976FF',
    },
    storyText: {
        fontSize: 17,
        color: '#11181C',
        lineHeight: 28,
    },
    highlightedWord: {
        backgroundColor: '#FFE066',
        color: '#11181C',
    },
    goToQuizButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#1976FF',
        paddingVertical: 16,
        borderRadius: 16,
        gap: 8,
    },
    goToQuizText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#fff',
    },
    questionCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    questionNumber: {
        fontSize: 12,
        fontWeight: '600',
        color: '#1976FF',
        marginBottom: 8,
    },
    questionText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#11181C',
        marginBottom: 16,
    },
    optionsContainer: {
        gap: 10,
    },
    optionButton: {
        backgroundColor: '#F6F7FB',
        padding: 14,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    optionCorrect: {
        backgroundColor: '#E6F9EC',
        borderColor: '#52C41A',
    },
    optionIncorrect: {
        backgroundColor: '#FFF1F0',
        borderColor: '#FF4D4F',
    },
    optionDisabled: {
        opacity: 0.6,
    },
    optionText: {
        fontSize: 15,
        color: '#11181C',
    },
    optionTextCorrect: {
        color: '#52C41A',
        fontWeight: '600',
    },
    optionTextIncorrect: {
        color: '#FF4D4F',
    },
    optionTextDisabled: {
        color: '#A0A0A0',
    },
    resultsCard: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 32,
        alignItems: 'center',
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    resultsTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#11181C',
        marginTop: 16,
        marginBottom: 8,
    },
    resultsText: {
        fontSize: 16,
        color: '#687076',
        marginBottom: 24,
    },
    doneButton: {
        backgroundColor: '#1976FF',
        paddingHorizontal: 32,
        paddingVertical: 14,
        borderRadius: 12,
    },
    doneButtonText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 16,
    },
    backToStoryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        gap: 6,
    },
    backToStoryText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1976FF',
    },
});

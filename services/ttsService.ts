/**
 * TTS Service - Unified text-to-speech interface
 * 
 * Premium users get ElevenLabs TTS via Edge Function
 * Free users get device TTS via expo-speech
 */

import { supabase } from '@/utils/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AudioPlayer, createAudioPlayer } from 'expo-audio';
import { File, Paths } from 'expo-file-system';
import * as Speech from 'expo-speech';

// Types
interface TTSOptions {
    language?: string;
    isPremium?: boolean;
    voiceId?: string;
    onStart?: () => void;
    onDone?: () => void;
    onError?: (error: Error) => void;
}

// Module state
let currentPlayer: AudioPlayer | null = null;
let isSpeaking = false;
let currentTempFile: File | null = null;

/**
 * Speak text using TTS
 * Premium users: ElevenLabs via Edge Function
 * Free users: Device TTS via expo-speech
 */
export async function speak(
    text: string,
    options: TTSOptions = {}
): Promise<void> {
    const {
        language = 'en',
        isPremium = false,
        voiceId,
        onStart,
        onDone,
        onError
    } = options;

    // Stop any current playback
    await stop();

    if (isPremium) {
        try {
            await speakWithElevenLabs(text, language, voiceId, { onStart, onDone, onError });
        } catch (error) {
            console.warn('ElevenLabs TTS failed, falling back to device TTS:', error);
            // Fallback to device TTS on error
            await speakWithDevice(text, language, { onStart, onDone, onError });
        }
    } else {
        await speakWithDevice(text, language, { onStart, onDone, onError });
    }
}

/**
 * Speak using ElevenLabs via Edge Function
 */
async function speakWithElevenLabs(
    text: string,
    language: string,
    voiceId?: string,
    callbacks?: { onStart?: () => void; onDone?: () => void; onError?: (error: Error) => void }
): Promise<void> {
    callbacks?.onStart?.();
    isSpeaking = true;

    // Get the supabase URL and session for auth
    const { data: { session } } = await supabase.auth.getSession();
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ||
        (await import('expo-constants')).default.expoConfig?.extra?.EXPO_PUBLIC_SUPABASE_URL;

    if (!session?.access_token) {
        throw new Error('No active session for TTS');
    }

    // Use fetch directly for binary data (supabase.functions.invoke has issues with binary)
    const response = await fetch(`${supabaseUrl}/functions/v1/text-to-speech`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text, language, voice: voiceId }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI TTS API error: ${response.status} - ${errorText}`);
    }

    // Get the audio blob directly
    const audioBlob = await response.blob();
    console.log('Audio blob size:', audioBlob.size, 'type:', audioBlob.type);

    // Convert blob to base64 for file system
    const reader = new FileReader();
    const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
            const base64 = (reader.result as string).split(',')[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(audioBlob);
    });

    const base64Audio = await base64Promise;

    // Write to temporary file using new expo-file-system API
    currentTempFile = new File(Paths.cache, `tts_audio_${Date.now()}.mp3`);
    await currentTempFile.write(base64Audio, { encoding: 'base64' });

    // Create audio player and play
    currentPlayer = createAudioPlayer({ uri: currentTempFile.uri });

    // Set up completion handling
    const checkCompletion = setInterval(() => {
        if (currentPlayer && !currentPlayer.playing && currentPlayer.currentTime > 0) {
            clearInterval(checkCompletion);
            isSpeaking = false;
            callbacks?.onDone?.();
            cleanup();
        }
    }, 100);

    currentPlayer.play();
}

/**
 * Clean up temporary audio file
 */
async function cleanup(): Promise<void> {
    try {
        if (currentTempFile && currentTempFile.exists) {
            await currentTempFile.delete();
        }
        currentTempFile = null;
    } catch (e) {
        // Ignore cleanup errors
    }
}

/**
 * Speak using device TTS (expo-speech)
 */
async function speakWithDevice(
    text: string,
    language: string,
    callbacks?: { onStart?: () => void; onDone?: () => void; onError?: (error: Error) => void }
): Promise<void> {
    // Get user's preferred voice from AsyncStorage
    const voiceMapJson = await AsyncStorage.getItem('pronunciationVoiceMap');
    let voiceMap: Record<string, string> = {};
    if (voiceMapJson) {
        voiceMap = JSON.parse(voiceMapJson);
    }

    const langCode = language.split('-')[0];
    const selectedVoiceId = voiceMap[langCode];

    // Get available voices and find best match
    const voices = await Speech.getAvailableVoicesAsync();
    const selectedVoice = voices.find(v => v.identifier === selectedVoiceId)
        || voices.find(v => v.language.startsWith(langCode))
        || voices[0];

    isSpeaking = true;
    callbacks?.onStart?.();

    Speech.speak(text, {
        language,
        voice: selectedVoice?.identifier,
        onDone: () => {
            isSpeaking = false;
            callbacks?.onDone?.();
        },
        onError: (error) => {
            isSpeaking = false;
            callbacks?.onError?.(error as unknown as Error);
        },
        onStopped: () => {
            isSpeaking = false;
        },
    });
}

/**
 * Stop current TTS playback
 */
export async function stop(): Promise<void> {
    // Stop expo-speech
    Speech.stop();

    // Stop and release expo-audio player
    if (currentPlayer) {
        try {
            currentPlayer.remove();
        } catch (e) {
            // Ignore errors if player already released
        }
        currentPlayer = null;
    }

    isSpeaking = false;
}

/**
 * Check if TTS is currently speaking
 */
export function getIsSpeaking(): boolean {
    return isSpeaking;
}

/**
 * Convenience function matching expo-speech's interface for easy migration
 */
export const TTS = {
    speak,
    stop,
    isSpeaking: getIsSpeaking,
};

export default TTS;

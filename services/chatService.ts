
import { supabase } from '@/utils/supabase';

export interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
    isVoice?: boolean;
    isTranscribing?: boolean;
    translation?: string;
    cachedTranslation?: string;
    isTranslating?: boolean;
}

export interface ChatResponse {
    reply: string;
    correction: {
        original: string;
        corrected: string;
        explanation: string;
    } | null;
    user_transcript?: string | null;
}

export const sendMessageToTutor = async (
    messages: ChatMessage[],
    targetLang: string,
    userLevel: string,
    audioBase64?: string,
    sourceLang: string = 'en'
): Promise<ChatResponse> => {

    // Prepare payload
    const payload = {
        messages,
        target_lang: targetLang,
        user_level: userLevel,
        audio_base64: audioBase64 || null,
        source_lang: sourceLang
    };

    const { data, error } = await supabase.functions.invoke('chat-tutor', {
        body: payload
    });

    if (error) {
        console.error('Chat Tutor Error:', error);
        throw new Error(error.message || 'Failed to connect to AI Tutor');
    }

    return data as ChatResponse;
};

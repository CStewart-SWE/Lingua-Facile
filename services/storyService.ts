import { supabase } from '@/utils/supabase';

export interface StoryQuestion {
    question: string;
    options: string[];
    correctAnswer: string;
}

export interface GeneratedStory {
    title: string;
    story: string;
    questions: StoryQuestion[];
}

export interface GenerateStoryParams {
    targetLang: string;
    cefrLevel: string;
    topic: string;
}

export const generateStory = async (params: GenerateStoryParams): Promise<GeneratedStory> => {
    const { targetLang, cefrLevel, topic } = params;

    const { data, error } = await supabase.functions.invoke('generate-story', {
        body: {
            target_lang: targetLang,
            cefr_level: cefrLevel,
            topic: topic
        }
    });

    if (error) {
        console.error('Story Generation Error:', error);
        throw new Error(error.message || 'Failed to generate story');
    }

    if (data?.error) {
        throw new Error(data.error);
    }

    if (!data?.title || !data?.story || !data?.questions) {
        console.error('Invalid story response:', data);
        throw new Error('Invalid response from story generation');
    }

    return data as GeneratedStory;
};

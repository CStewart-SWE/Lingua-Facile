import { supabase } from '../utils/supabase';

export interface TranslationFeatureResult {
  pronunciation?: string;
  meaning?: string;
  examples?: any[];
  synonyms?: any[];
  tone?: any[];
}

export const fetchTranslationFeatures = async (
  text: string,
  sourceLang: string,
  targetLang: string,
  isPremium: boolean
): Promise<TranslationFeatureResult> => {
  const { data, error } = await supabase.functions.invoke('enhance-translation', {
    body: { text, sourceLang, targetLang, isPremium },
  });

  if (error) {
    console.error(`Error fetching features:`, error);
    throw new Error(`Failed to fetch features`);
  }

  return data;
};

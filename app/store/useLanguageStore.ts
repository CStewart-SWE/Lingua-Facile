import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface LanguageState {
    sourceLang: string;
    targetLang: string;
    setSourceLang: (lang: string) => void;
    setTargetLang: (lang: string) => void;
    swapLanguages: () => void;
}

export const useLanguageStore = create<LanguageState>()(
    persist(
        (set) => ({
            sourceLang: 'en',
            targetLang: 'es',
            setSourceLang: (lang) => set({ sourceLang: lang }),
            setTargetLang: (lang) => set({ targetLang: lang }),
            swapLanguages: () =>
                set((state) => ({
                    sourceLang: state.targetLang,
                    targetLang: state.sourceLang,
                })),
        }),
        {
            name: 'language-storage',
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);

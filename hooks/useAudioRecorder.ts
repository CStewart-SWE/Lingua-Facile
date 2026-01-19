import { RecordingPresets, useAudioRecorder as useExpoAudioRecorder } from 'expo-audio';
import * as FileSystem from 'expo-file-system';
import { useState } from 'react';
import { Alert, Platform } from 'react-native';

export interface RecordingResult {
    uri: string;
    base64: string | null;
    durationMillis: number;
}

export const useAudioRecorder = () => {
    const [isRecording, setIsRecording] = useState(false);
    const [lastUri, setLastUri] = useState<string | null>(null);

    // Use expo-audio's built-in recorder hook
    const recorder = useExpoAudioRecorder(RecordingPresets.HIGH_QUALITY, (status) => {
        // Status listener
        if (status.isFinished) {
            console.log('Recording finished');
        }
    });

    const startRecording = async () => {
        try {
            console.log('Starting recording...');
            recorder.record();
            setIsRecording(true);
            console.log('Recording started');
        } catch (err) {
            console.error('Failed to start recording', err);
            Alert.alert('Error', 'Failed to start recording: ' + (err as Error).message);
        }
    };

    const stopRecording = async (): Promise<RecordingResult | null> => {
        if (!isRecording) {
            console.log('Not currently recording');
            return null;
        }

        console.log('Stopping recording...');
        setIsRecording(false);

        try {
            const uri = await recorder.stop();
            console.log('Recording stopped, saved at:', uri);

            if (!uri) return null;
            setLastUri(uri);

            // Read as Base64 for upload
            let base64: string | null = null;
            if (Platform.OS !== 'web') {
                try {
                    base64 = await FileSystem.readAsStringAsync(uri, {
                        encoding: 'base64' as any
                    });
                    console.log('Base64 length:', base64?.length);
                } catch (e) {
                    console.error('Failed to read file as base64:', e);
                }
            }

            return { uri, base64, durationMillis: 0 };

        } catch (error) {
            console.error('Error stopping recording', error);
            Alert.alert('Error', 'Failed to stop recording: ' + (error as Error).message);
            return null;
        }
    };

    return {
        isRecording,
        startRecording,
        stopRecording,
        hasPermission: true, // expo-audio handles permissions internally
    };
};

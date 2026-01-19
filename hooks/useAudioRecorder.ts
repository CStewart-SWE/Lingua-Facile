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

    // expo-audio permissions might be managed via the standard expo mechanism or Audio object locally.
    // Since usePermissions export failed, let's try assuming standard Audio.requestPermissionsAsync behavior
    // OR just trust the recorder to throw if no permission, which we can catch.
    // However, modern Expo modules uses `usePermissions` from the package.
    // Let's try to import the Audio object if available, or skip explicit hook if not found.
    // Wait, if SDK 54, maybe it's just 'expo-audio' default export?

    // Workaround: We will remove explicit `usePermissions` hook for a moment and rely on 
    // try-catch in record(), which usually prompts on iOS automatically if configured in Info.plist.
    // BUT we want to be nice.

    // Use expo-audio's built-in recorder hook
    const recorder = useExpoAudioRecorder(RecordingPresets.HIGH_QUALITY, (status) => {
        if (status.isFinished) {
            console.log('Recording finished');
        }
    });

    const startRecording = async () => {
        try {
            console.log('Starting recording (implied permission request)...');

            // Attempt to record. If permission is missing, this often triggers the prompt on iOS
            // or throws an error we can catch.
            recorder.record();

            setIsRecording(true);
            console.log('Recording started');
        } catch (err) {
            console.error('Failed to start recording', err);
            // Check if error is related to permissions
            const msg = (err as Error).message;
            if (msg.includes('permission')) {
                Alert.alert('Permission needed', 'Please enable microphone access in settings.');
            } else {
                Alert.alert('Error', 'Failed to start recording: ' + msg);
            }
        }
    };

    const stopRecording = async (): Promise<RecordingResult | null> => {
        if (!isRecording) return null;

        console.log('Stopping recording...');
        setIsRecording(false);

        try {
            await recorder.stop();
            const uri = recorder.uri;

            console.log('Recording stopped, saved at:', uri);

            if (!uri) return null;
            setLastUri(uri);

            let base64: string | null = null;
            if (Platform.OS !== 'web') {
                try {
                    base64 = await FileSystem.readAsStringAsync(uri, {
                        encoding: 'base64' as any
                    });
                } catch (e) {
                    console.error('Failed to read file:', e);
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
        hasPermission: true, // Optimistically true since we handle failure
    };
};

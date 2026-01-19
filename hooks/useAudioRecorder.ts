import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder as useExpoAudioRecorder } from 'expo-audio';
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
        if (status.isFinished) {
            console.log('Recording finished');
        }
    });

    const startRecording = async () => {
        try {
            // Explicitly request permissions first
            const { granted } = await AudioModule.requestRecordingPermissionsAsync();
            if (!granted) {
                Alert.alert('Permission needed', 'Microphone access is required for voice chat.');
                return;
            }

            console.log('Setting audio mode for recording...');
            await setAudioModeAsync({
                allowsRecording: true,
                playsInSilentMode: true,
            });

            console.log('Preparing to record...');
            await recorder.prepareToRecordAsync(RecordingPresets.HIGH_QUALITY);

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
        if (!isRecording) return null;

        console.log('Stopping recording...');
        setIsRecording(false);

        try {
            await recorder.stop();
            const uri = recorder.uri;

            console.log('Recording stopped, saved at:', uri);

            if (!uri) return null;
            setLastUri(uri);

            // Reset audio mode to allow playback (important on iOS)
            await setAudioModeAsync({
                allowsRecording: false,
                playsInSilentMode: true,
            });

            // Small delay to ensure file is written
            await new Promise(resolve => setTimeout(resolve, 500));

            let base64: string | null = null;

            if (Platform.OS !== 'web') {
                const readWithXHR = (url: string): Promise<string> => {
                    return new Promise((resolve, reject) => {
                        const xhr = new XMLHttpRequest();
                        xhr.onload = () => {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                                const result = reader.result as string;
                                const base64Data = result.split(',')[1];
                                resolve(base64Data);
                            };
                            reader.onerror = () => reject(new Error('FileReader failed'));
                            reader.readAsDataURL(xhr.response);
                        };
                        xhr.onerror = () => reject(new Error('XHR failed: ' + xhr.status));
                        xhr.responseType = 'blob';
                        xhr.open('GET', url);
                        xhr.send();
                    });
                };

                try {
                    console.log('Attempting to read path:', uri);

                    // Debug: List directory contents
                    try {
                        const parentDir = uri.substring(0, uri.lastIndexOf('/'));
                        console.log('Listing parent directory:', parentDir);
                        const files = await FileSystem.readDirectoryAsync(parentDir);
                        console.log('Files in directory:', JSON.stringify(files));
                    } catch (listErr) {
                        console.log('Failed to list directory', listErr);
                    }

                    // Try 1: XHR with URI
                    try {
                        base64 = await readWithXHR(uri);
                        console.log('Success with XHR');
                    } catch (xhrErr) {
                        console.log('XHR failed, trying FileSystem checks...', xhrErr);

                        // Try 2: FileSystem with path variants
                        const variants = [uri, uri.replace('file://', '')];

                        for (const path of variants) {
                            try {
                                const file = new FileSystem.File(path);
                                if (file.exists) { // Check property
                                    console.log('Found file at:', path);
                                    base64 = await file.base64();
                                    break;
                                }
                            } catch (e) {
                                console.log('Check failed for:', path);
                            }
                        }
                    }

                } catch (e) {
                    console.error('All read attempts failed:', e);
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
        hasPermission: true,
    };
};


import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';

export interface RecordingResult {
    uri: string;
    base64: string | null;
    durationMillis: number;
}

export const useAudioRecorder = () => {
    const [recording, setRecording] = useState<Audio.Recording | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [permissionResponse, requestPermission] = Audio.usePermissions();

    useEffect(() => {
        // Cleanup on unmount
        return () => {
            if (recording) {
                recording.stopAndUnloadAsync();
            }
        };
    }, [recording]);

    const startRecording = async () => {
        try {
            if (!permissionResponse || permissionResponse.status !== 'granted') {
                const resp = await requestPermission();
                if (resp.status !== 'granted') {
                    Alert.alert('Permission needed', 'Microphone access is required for voice chat.');
                    return;
                }
            }

            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
            });

            console.log('Starting recording..');
            const { recording } = await Audio.Recording.createAsync(
                Audio.RecordingOptionsPresets.HIGH_QUALITY
            );

            setRecording(recording);
            setIsRecording(true);
            console.log('Recording started');
        } catch (err) {
            console.error('Failed to start recording', err);
            Alert.alert('Error', 'Failed to start recording');
        }
    };

    const stopRecording = async (): Promise<RecordingResult | null> => {
        if (!recording) return null;

        console.log('Stopping recording..');
        setRecording(null);
        setIsRecording(false);

        try {
            await recording.stopAndUnloadAsync();
            const uri = recording.getURI();
            console.log('Recording stopped and stored at', uri);

            if (!uri) return null;

            // Get duration
            const status = await recording.getStatusAsync();
            const durationMillis = status.isDoneRecording ? status.durationMillis : 0;

            // Read as Base64 for upload
            // On web this will be different, but assuming Mobile for now based on project rules
            const base64 = await FileSystem.readAsStringAsync(uri, {
                encoding: FileSystem.EncodingType.Base64
            });

            // Reset audio mode to allow playback (important on iOS)
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: false,
                playsInSilentModeIOS: true,
            });

            return { uri, base64, durationMillis };

        } catch (error) {
            console.error('Error stopping recording', error);
            return null;
        }
    };

    return {
        isRecording,
        startRecording,
        stopRecording,
        hasPermission: permissionResponse?.status === 'granted',
    };
};

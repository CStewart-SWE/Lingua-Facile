import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { supabase } from '../utils/supabase';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { MotiView } from 'moti';

export default function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [showPassword, setShowPassword] = useState(false);

  // Password validation state
  const [passwordValid, setPasswordValid] = useState({
    length: false,
    upper: false,
    lower: false,
    digit: false,
    special: false,
  });

  const [passwordTouched, setPasswordTouched] = useState(false);

  useEffect(() => {
    setPasswordValid({
      length: password.length >= 8,
      upper: /[A-Z]/.test(password),
      lower: /[a-z]/.test(password),
      digit: /[0-9]/.test(password),
      special: /[^A-Za-z0-9]/.test(password),
    });
  }, [password]);

  const handleAuth = async () => {
    setLoading(true);
    let result;
    if (mode === 'signIn') {
      result = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (result.error) {
        Alert.alert('Sign In Failed', result.error.message);
      } else {
        onLogin();
      }
    } else {
      if (mode === 'signUp') {
        if (!showPassword && password !== confirmPassword) {
          setLoading(false);
          Alert.alert('Password Mismatch', 'Passwords do not match.');
          return;
        }
        if (!Object.values(passwordValid).every(Boolean)) {
          setLoading(false);
          Alert.alert('Weak Password', 'Please meet all password requirements.');
          return;
        }
      }
      result = await supabase.auth.signUp({ email, password });
      setLoading(false);
      if (result.error) {
        Alert.alert('Sign Up Failed', result.error.message);
      } else if (result.data.session) {
        onLogin();
      } else {
        Alert.alert('Verification Needed', 'Please check your email to confirm your account.');
      }
    }
  };

  const handleGuest = async () => {
    setLoading(true);
    const result = await supabase.auth.signInAnonymously();
    setLoading(false);
    if (result.error) {
      Alert.alert('Error', result.error.message);
    } else if (result.data.session) {
      onLogin();
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#4facfe', '#00f2fe']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      
      {/* Decorative background elements */}
      <View style={[styles.circle, styles.circleTop]} />
      <View style={[styles.circle, styles.circleBottom]} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <Animated.View 
          entering={FadeInUp.duration(800).springify()} 
          style={styles.contentContainer}
        >
          <BlurView intensity={80} tint="light" style={styles.glassCard}>
            <View style={styles.header}>
              <View style={styles.iconContainer}>
                 <Image
                    source={require('../assets/images/ios_icon.png')}
                    style={styles.appIcon}
                  />
              </View>
              <Text style={styles.appName}>Lingua Facile</Text>
              <Text style={styles.subtitle}>
                {mode === 'signIn' ? 'Welcome Back' : 'Create Account'}
              </Text>
            </View>

            <View style={styles.form}>
              <View style={styles.inputContainer}>
                <Ionicons name="mail-outline" size={20} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Email Address"
                  placeholderTextColor="#999"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  value={email}
                  onChangeText={setEmail}
                />
              </View>

              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor="#999"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={(t) => { setPassword(t); setPasswordTouched(true); }}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#666" />
                </TouchableOpacity>
              </View>

              {/* Password Requirements */}
              {mode === 'signUp' && (
                <MotiView
                  from={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ type: 'timing', duration: 300 }}
                  style={styles.validationContainer}
                >
                   <View style={styles.validationRow}>
                      <RequirementItem satisfied={passwordValid.length} label="8+ chars" />
                      <RequirementItem satisfied={passwordValid.upper} label="Upper" />
                      <RequirementItem satisfied={passwordValid.lower} label="Lower" />
                      <RequirementItem satisfied={passwordValid.digit} label="Digit" />
                      <RequirementItem satisfied={passwordValid.special} label="Special" />
                   </View>
                </MotiView>
              )}

              {/* Confirm Password */}
              {mode === 'signUp' && (
                <MotiView
                   from={{ opacity: 0, translateY: -10 }}
                   animate={{ opacity: 1, translateY: 0 }}
                   transition={{ type: 'timing', duration: 300 }}
                   style={[styles.inputContainer, { marginTop: 12 }]}
                >
                  <Ionicons name="shield-checkmark-outline" size={20} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Confirm Password"
                    placeholderTextColor="#999"
                    secureTextEntry
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                  />
                </MotiView>
              )}

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleAuth}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryButtonText}>
                    {mode === 'signIn' ? 'Sign In' : 'Sign Up'}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={handleGuest}
                disabled={loading}
              >
                <Text style={styles.secondaryButtonText}>Continue as Guest</Text>
              </TouchableOpacity>

              <View style={styles.switchContainer}>
                <Text style={styles.switchText}>
                  {mode === 'signIn' ? "Don't have an account?" : "Already have an account?"}
                </Text>
                <TouchableOpacity onPress={() => setMode(mode === 'signIn' ? 'signUp' : 'signIn')}>
                  <Text style={styles.switchAction}>
                    {mode === 'signIn' ? 'Sign Up' : 'Sign In'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </BlurView>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

const RequirementItem = ({ satisfied, label }: { satisfied: boolean; label: string }) => (
  <View style={styles.reqItem}>
    <Ionicons 
      name={satisfied ? "checkmark-circle" : "ellipse-outline"} 
      size={12} 
      color={satisfied ? "#2ecc71" : "#999"} 
    />
    <Text style={[styles.reqText, { color: satisfied ? "#2ecc71" : "#999" }]}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyboardView: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  contentContainer: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  circle: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.6,
  },
  circleTop: {
    width: 200,
    height: 200,
    backgroundColor: '#fff',
    top: -50,
    left: -50,
    blurRadius: 50,
  },
  circleBottom: {
    width: 300,
    height: 300,
    backgroundColor: '#fff',
    bottom: -100,
    right: -50,
    opacity: 0.3,
  },
  glassCard: {
    width: '100%',
    borderRadius: 30,
    padding: 32,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconContainer: {
    marginBottom: 16,
    shadowColor: '#1976FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  appIcon: {
    width: 80,
    height: 80,
    borderRadius: 20,
  },
  appName: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1a1a1a',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  form: {
    width: '100%',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 56,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  validationContainer: {
    marginBottom: 16,
    overflow: 'hidden',
  },
  validationRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  reqItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.5)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  reqText: {
    fontSize: 12,
    fontWeight: '600',
  },
  primaryButton: {
    backgroundColor: '#1976FF',
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#1976FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  secondaryButton: {
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#1976FF',
    marginBottom: 24,
  },
  secondaryButtonText: {
    color: '#1976FF',
    fontSize: 16,
    fontWeight: '600',
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  switchText: {
    color: '#666',
    fontSize: 14,
    marginRight: 4,
  },
  switchAction: {
    color: '#1976FF',
    fontSize: 14,
    fontWeight: '700',
  },
});
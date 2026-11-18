import { useRouter } from 'expo-router';
import { Lock, Mail } from 'lucide-react-native';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Quest } from '@/constants/quest-theme';
import { supabase } from '@/lib/supabase';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !loading;

  async function handleLogin() {
    setError(null);
    setLoading(true);
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);
    // On success, the root layout's auth listener redirects to /(tabs).
    if (authError) setError(authError.message);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <Text style={styles.heroEmoji}>🧼</Text>
            <Text style={styles.title}>ChoreQuest</Text>
            <Text style={styles.subtitle}>Level up your shared home!</Text>
          </View>

          <View style={styles.inputRow}>
            <Mail size={20} color={Quest.muted} />
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={Quest.muted}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <View style={styles.inputRow}>
            <Lock size={20} color={Quest.muted} />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={Quest.muted}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password"
              value={password}
              onChangeText={setPassword}
              onSubmitEditing={canSubmit ? handleLogin : undefined}
            />
          </View>

          {error && <Text style={styles.error}>{error}</Text>}

          <Pressable
            onPress={handleLogin}
            disabled={!canSubmit}
            style={({ pressed }) => [
              styles.button,
              !canSubmit && styles.buttonDisabled,
              pressed && styles.buttonPressed,
            ]}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>LOG IN</Text>
            )}
          </Pressable>

          <Pressable onPress={() => router.push('/(auth)/signup')} style={styles.linkWrap}>
            <Text style={styles.linkText}>
              New here? <Text style={styles.linkBold}>CREATE ACCOUNT</Text>
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Quest.bg },
  flex: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 14 },
  hero: { alignItems: 'center', marginBottom: 16 },
  heroEmoji: { fontSize: 64 },
  title: { fontSize: 34, fontWeight: '900', color: Quest.green, marginTop: 4 },
  subtitle: { fontSize: 16, fontWeight: '600', color: Quest.muted, marginTop: 4 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Quest.tint,
    borderWidth: 2,
    borderColor: Quest.border,
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 56,
  },
  input: { flex: 1, fontSize: 16, fontWeight: '600', color: Quest.ink },
  error: { color: Quest.red, fontWeight: '700', textAlign: 'center' },
  button: {
    backgroundColor: Quest.green,
    borderRadius: 16,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 4,
    borderBottomColor: Quest.greenDark,
    marginTop: 6,
  },
  buttonPressed: { transform: [{ translateY: 2 }], borderBottomWidth: 2 },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 1 },
  linkWrap: { alignItems: 'center', paddingVertical: 12 },
  linkText: { color: Quest.muted, fontSize: 15, fontWeight: '600' },
  linkBold: { color: Quest.blue, fontWeight: '900' },
});

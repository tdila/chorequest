import { useRouter } from 'expo-router';
import { Lock, Mail, User } from 'lucide-react-native';
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

import { AVATAR_EMOJIS, Quest } from '@/constants/quest-theme';
import { supabase } from '@/lib/supabase';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignupScreen() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [avatar, setAvatar] = useState<string>(AVATAR_EMOJIS[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  async function handleSignup() {
    setError(null);

    if (displayName.trim().length === 0) return setError('Pick a display name.');
    if (!EMAIL_RE.test(email.trim())) return setError('Enter a valid email address.');
    if (password.length < 6) return setError('Password must be at least 6 characters.');

    setLoading(true);
    // The handle_new_user DB trigger creates the profiles row from this metadata.
    const { data, error: authError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { display_name: displayName.trim(), avatar_emoji: avatar },
      },
    });
    setLoading(false);

    if (authError) return setError(authError.message);

    // No session => email confirmation is enabled. Otherwise the root layout
    // auth listener redirects to /(tabs) automatically.
    if (!data.session) setNeedsConfirmation(true);
  }

  if (needsConfirmation) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={[styles.content, styles.centered]}>
          <Text style={styles.heroEmoji}>📬</Text>
          <Text style={styles.title}>Check your email!</Text>
          <Text style={styles.subtitle}>
            We sent a confirmation link to {email.trim()}. Tap it, then log in to start your quest.
          </Text>
          <Pressable
            onPress={() => router.replace('/(auth)/login')}
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}>
            <Text style={styles.buttonText}>BACK TO LOG IN</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <Text style={styles.avatarPreview}>{avatar}</Text>
            <Text style={styles.title}>Join the quest</Text>
            <Text style={styles.subtitle}>Pick your avatar and get started!</Text>
          </View>

          <View style={styles.emojiGrid}>
            {AVATAR_EMOJIS.map((emoji) => {
              const selected = emoji === avatar;
              return (
                <Pressable
                  key={emoji}
                  onPress={() => setAvatar(emoji)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={[styles.emojiCell, selected && styles.emojiCellSelected]}>
                  <Text style={styles.emoji}>{emoji}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.inputRow}>
            <User size={20} color={Quest.muted} />
            <TextInput
              style={styles.input}
              placeholder="Display name"
              placeholderTextColor={Quest.muted}
              maxLength={24}
              value={displayName}
              onChangeText={setDisplayName}
            />
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
              placeholder="Password (6+ characters)"
              placeholderTextColor={Quest.muted}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
              value={password}
              onChangeText={setPassword}
            />
          </View>

          {error && <Text style={styles.error}>{error}</Text>}

          <Pressable
            onPress={handleSignup}
            disabled={loading}
            style={({ pressed }) => [
              styles.button,
              loading && styles.buttonDisabled,
              pressed && styles.buttonPressed,
            ]}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>CREATE ACCOUNT</Text>
            )}
          </Pressable>

          <Pressable onPress={() => router.replace('/(auth)/login')} style={styles.linkWrap}>
            <Text style={styles.linkText}>
              Already playing? <Text style={styles.linkBold}>LOG IN</Text>
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
  centered: { alignItems: 'center' },
  hero: { alignItems: 'center', marginBottom: 4 },
  heroEmoji: { fontSize: 64 },
  avatarPreview: { fontSize: 64 },
  title: { fontSize: 30, fontWeight: '900', color: Quest.green, marginTop: 4, textAlign: 'center' },
  subtitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Quest.muted,
    marginTop: 4,
    textAlign: 'center',
  },
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10 },
  emojiCell: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Quest.tint,
    borderWidth: 2,
    borderColor: Quest.border,
  },
  emojiCellSelected: { borderColor: Quest.blue, backgroundColor: '#DDF4FF' },
  emoji: { fontSize: 26 },
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
    alignSelf: 'stretch',
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

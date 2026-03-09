import React, { useState } from 'react';
import { Alert, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { getApiUrl } from '../api/client';
import { palette } from '../utils/theme';

export default function LoginScreen() {
  const { login } = useAuth();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!password.trim()) return;
    setLoading(true);
    try {
      await login(password);
    } catch (error) {
      Alert.alert('Falha no login', error?.response?.data?.detail || error.message || 'Senha inv\u00e1lida.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.backdropGlowTop} />
      <View style={styles.backdropGlowBottom} />
      <View style={styles.container}>
        <View style={styles.heroCard}>
          <Text style={styles.kicker}>EDI Mobile</Text>
          <Text style={styles.title}>Entrar</Text>
          <Text style={styles.endpoint}>{getApiUrl()}</Text>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.label}>Senha</Text>
          <Text style={styles.helper}>Use a mesma senha do desktop.</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="Digite sua senha"
            placeholderTextColor={palette.muted}
            style={styles.input}
          />
          <Pressable style={[styles.button, loading && styles.buttonDisabled]} onPress={handleLogin} disabled={loading}>
            <Text style={styles.buttonText}>{loading ? 'Entrando\u2026' : 'Entrar'}</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.bg,
  },
  backdropGlowTop: {
    position: 'absolute',
    top: -20,
    right: -10,
    width: 240,
    height: 240,
    borderRadius: 999,
    backgroundColor: 'rgba(215, 196, 173, 0.14)',
  },
  backdropGlowBottom: {
    position: 'absolute',
    bottom: -50,
    left: -30,
    width: 280,
    height: 280,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    gap: 22,
  },
  heroCard: {
    backgroundColor: palette.cardMuted,
    borderRadius: 28,
    padding: 22,
    borderWidth: 1,
    borderColor: palette.borderStrong,
    gap: 8,
    shadowColor: palette.shadow,
    shadowOpacity: 1,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 4,
  },
  kicker: {
    color: palette.highlight,
    fontWeight: '800',
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
  },
  title: {
    color: palette.text,
    fontSize: 34,
    lineHeight: 38,
    fontWeight: '800',
  },
  endpoint: {
    color: palette.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  formCard: {
    backgroundColor: palette.card,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: palette.border,
    gap: 12,
  },
  label: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '700',
  },
  helper: {
    color: palette.muted,
    fontSize: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    color: palette.text,
    backgroundColor: palette.input,
  },
  button: {
    backgroundColor: palette.accent,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: palette.accentText,
    fontWeight: '800',
    fontSize: 16,
  },
});

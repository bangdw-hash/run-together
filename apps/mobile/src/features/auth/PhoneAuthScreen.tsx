import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { sendOtp, verifyOtp } from '../../lib/api';
import { colors, radii } from '../../theme';

interface Props {
  onAuthenticated(): void;
  onSkipDemo(): void;
}

/** Phone OTP sign-in (work order §3.1) backed by Supabase Auth. */
export function PhoneAuthScreen({ onAuthenticated, onSkipDemo }: Props) {
  const { t } = useTranslation();
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitPhone = async () => {
    setBusy(true);
    setError(null);
    const res = await sendOtp(phone.replace(/[ -]/g, ''));
    setBusy(false);
    if (res.error) setError(t('auth.error'));
    else setStep('code');
  };

  const submitCode = async () => {
    setBusy(true);
    setError(null);
    const res = await verifyOtp(phone.replace(/[ -]/g, ''), code.trim());
    setBusy(false);
    if (res.error) setError(t('auth.error'));
    else onAuthenticated();
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {step === 'phone' ? (
        <>
          <Text style={styles.title}>{t('auth.phoneTitle')}</Text>
          <Text style={styles.hint}>{t('auth.phoneHint')}</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder={t('auth.phonePlaceholder')}
            placeholderTextColor={colors.textDim}
            keyboardType="phone-pad"
            autoFocus
          />
          <Pressable
            style={[styles.btn, !phone.trim() && styles.btnDim]}
            disabled={!phone.trim() || busy}
            onPress={submitPhone}
          >
            {busy ? (
              <ActivityIndicator color={colors.accentDark} />
            ) : (
              <Text style={styles.btnText}>{t('auth.sendCode')}</Text>
            )}
          </Pressable>
        </>
      ) : (
        <>
          <Text style={styles.title}>{t('auth.codeTitle')}</Text>
          <Text style={styles.hint}>{t('auth.codeHint', { phone })}</Text>
          <TextInput
            style={[styles.input, styles.codeInput]}
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            maxLength={6}
            autoFocus
          />
          <Pressable
            style={[styles.btn, code.length < 6 && styles.btnDim]}
            disabled={code.length < 6 || busy}
            onPress={submitCode}
          >
            {busy ? (
              <ActivityIndicator color={colors.accentDark} />
            ) : (
              <Text style={styles.btnText}>{t('auth.verify')}</Text>
            )}
          </Pressable>
        </>
      )}
      {error && <Text style={styles.error}>{error}</Text>}
      <Pressable style={styles.skip} onPress={onSkipDemo}>
        <Text style={styles.skipText}>{t('auth.skipDemo')}</Text>
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: 24, justifyContent: 'center' },
  title: { color: colors.text, fontSize: 26, fontWeight: '900' },
  hint: { color: colors.textDim, fontSize: 15, lineHeight: 22, marginTop: 10, marginBottom: 24 },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    color: colors.text,
    fontSize: 18,
    paddingHorizontal: 16,
    minHeight: 54,
  },
  codeInput: { textAlign: 'center', fontSize: 28, letterSpacing: 8 },
  btn: {
    backgroundColor: colors.accent,
    minHeight: 56,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  btnDim: { opacity: 0.4 },
  btnText: { color: colors.accentDark, fontWeight: '800', fontSize: 16 },
  error: { color: colors.warn, textAlign: 'center', marginTop: 14 },
  skip: { alignItems: 'center', marginTop: 28, minHeight: 44, justifyContent: 'center' },
  skipText: { color: colors.textDim, fontSize: 14, textDecorationLine: 'underline' },
});

import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, SafeAreaView, StyleSheet, View } from 'react-native';
import { PhoneAuthScreen } from './src/features/auth/PhoneAuthScreen';
import { ProfileSetupScreen } from './src/features/auth/ProfileSetupScreen';
import { HomeScreen } from './src/features/home/HomeScreen';
import { RunScreen } from './src/features/matching/RunScreen';
import { SafetyNoticeModal } from './src/features/safety/SafetyNoticeModal';
import { SettingsScreen } from './src/features/settings/SettingsScreen';
import { deviceLocale, initI18n, setLocale } from './src/i18n';
import { getMyProfile } from './src/lib/api';
import { supabase } from './src/lib/supabase';
import { useSettings } from './src/state/settings';
import { colors } from './src/theme';

initI18n(deviceLocale());

type Screen = 'home' | 'run' | 'settings';
type AuthState = 'loading' | 'signedOut' | 'needsProfile' | 'ready';

export default function App() {
  const locale = useSettings((s) => s.locale);
  const [screen, setScreen] = useState<Screen>('home');
  const [safetyConfirmed, setSafetyConfirmed] = useState(false);
  const [showSafety, setShowSafety] = useState(false);
  // Without a Supabase config the app is a pure demo — skip auth entirely.
  const [auth, setAuth] = useState<AuthState>(supabase ? 'loading' : 'ready');

  // Keep i18next in sync once the persisted locale hydrates.
  useEffect(() => setLocale(locale), [locale]);

  // Phone OTP gate (work order §3.1) when the production backend is wired.
  useEffect(() => {
    const sb = supabase;
    if (!sb) return;
    const resolve = async () => {
      const { data } = await sb.auth.getSession();
      if (!data.session) {
        setAuth('signedOut');
        return;
      }
      setAuth((await getMyProfile()) ? 'ready' : 'needsProfile');
    };
    resolve();
    const { data: sub } = sb.auth.onAuthStateChange(() => resolve());
    return () => sub.subscription.unsubscribe();
  }, []);

  const startRun = () => {
    if (!safetyConfirmed) {
      setShowSafety(true);
      return;
    }
    setScreen('run');
  };

  let content: React.ReactNode;
  if (auth === 'loading') {
    content = (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  } else if (auth === 'signedOut') {
    content = (
      <PhoneAuthScreen
        onAuthenticated={() => setAuth('loading')}
        onSkipDemo={() => setAuth('ready')}
      />
    );
  } else if (auth === 'needsProfile') {
    content = <ProfileSetupScreen onDone={() => setAuth('ready')} />;
  } else {
    content = (
      <>
        {screen === 'home' && (
          <HomeScreen onRun={startRun} onSettings={() => setScreen('settings')} />
        )}
        {screen === 'run' && <RunScreen onExit={() => setScreen('home')} />}
        {screen === 'settings' && <SettingsScreen onDone={() => setScreen('home')} />}
        <SafetyNoticeModal
          visible={showSafety}
          onConfirm={() => {
            setSafetyConfirmed(true);
            setShowSafety(false);
            setScreen('run');
          }}
        />
      </>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="light" />
      {content}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});

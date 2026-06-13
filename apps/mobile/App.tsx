import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, StyleSheet } from 'react-native';
import { HomeScreen } from './src/features/home/HomeScreen';
import { RunScreen } from './src/features/matching/RunScreen';
import { SafetyNoticeModal } from './src/features/safety/SafetyNoticeModal';
import { SettingsScreen } from './src/features/settings/SettingsScreen';
import { deviceLocale, initI18n } from './src/i18n';
import { useSettings } from './src/state/settings';
import { colors } from './src/theme';

initI18n(deviceLocale());

type Screen = 'home' | 'run' | 'settings';

export default function App() {
  const locale = useSettings((s) => s.locale);
  const [screen, setScreen] = useState<Screen>('home');
  const [safetyConfirmed, setSafetyConfirmed] = useState(false);
  const [showSafety, setShowSafety] = useState(false);

  // Keep i18next in sync once the persisted locale hydrates.
  React.useEffect(() => {
    import('./src/i18n').then(({ setLocale }) => setLocale(locale));
  }, [locale]);

  const startRun = () => {
    if (!safetyConfirmed) {
      setShowSafety(true);
      return;
    }
    setScreen('run');
  };

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="light" />
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
});

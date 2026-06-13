import React, { useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import type { ChatMessage } from '@run-together/shared';
import { colors, radii } from '../../theme';

interface Props {
  visible: boolean;
  messages: ChatMessage[];
  mySessionId: string | null;
  partnerNickname: string;
  onSend(text: string): void;
  onClose(): void;
}

/** In-run chat with the matched partner (work order §3.4). */
export function ChatPanel({ visible, messages, mySessionId, partnerNickname, onSend, onClose }: Props) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    onSend(text);
    setDraft('');
  };

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>
              💬 {t('chat.title')} · {partnerNickname}
            </Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </View>
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => `${m.ts}-${m.fromSessionId}`}
            style={styles.list}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
            renderItem={({ item }) => {
              const mine = item.fromSessionId === mySessionId;
              return (
                <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
                  <Text style={mine ? styles.mineText : styles.theirsText}>{item.text}</Text>
                </View>
              );
            }}
          />
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={draft}
              onChangeText={setDraft}
              placeholder={t('chat.placeholder')}
              placeholderTextColor={colors.textDim}
              onSubmitEditing={send}
              returnKeyType="send"
              maxLength={1000}
            />
            <Pressable style={styles.sendBtn} onPress={send}>
              <Text style={styles.sendText}>{t('chat.send')}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    height: '70%',
    backgroundColor: colors.bg,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: colors.text, fontSize: 17, fontWeight: '800' },
  close: { color: colors.textDim, fontSize: 20, padding: 4 },
  list: { flex: 1, marginVertical: 12 },
  bubble: {
    maxWidth: '78%',
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
  },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.accent },
  theirs: { alignSelf: 'flex-start', backgroundColor: colors.cardAlt },
  mineText: { color: colors.accentDark, fontSize: 15 },
  theirsText: { color: colors.text, fontSize: 15 },
  inputRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.full,
    color: colors.text,
    paddingHorizontal: 16,
    minHeight: 48,
  },
  sendBtn: {
    backgroundColor: colors.accent,
    borderRadius: radii.full,
    paddingHorizontal: 18,
    minHeight: 48,
    justifyContent: 'center',
  },
  sendText: { color: colors.accentDark, fontWeight: '800' },
});

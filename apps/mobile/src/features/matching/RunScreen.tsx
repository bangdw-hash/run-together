import React, { useEffect, useRef, useState } from 'react';
import { FlatList, Modal, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  RunTracker,
  bearingDeg,
  haversineM,
  type ChatMessage,
  type JoinIncoming,
  type LatLng,
  type NearbyRunner,
  type RendezvousInfo,
  type TrackStats,
} from '@run-together/shared';
import { ChatPanel } from '../chat/ChatPanel';
import { createConnection } from '../../lib/demo';
import type { RunConnection } from '../../lib/connection';
import { useLiveLocation } from '../../lib/location';
import { formatDistance, formatDuration, formatPace } from '../../lib/format';
import { useSettings } from '../../state/settings';
import { colors, radii } from '../../theme';
import { EmergencyButton } from '../safety/EmergencyButton';
import { JoinRequestModal } from './JoinRequestModal';
import { Radar, type RadarBlip } from './Radar';
import { RendezvousBanner } from './RendezvousBanner';
import { RunnerCard } from './RunnerCard';

interface Props {
  onExit(): void;
}

interface Partner {
  nickname: string;
  loc?: LatLng;
}

export function RunScreen({ onExit }: Props) {
  const { t } = useTranslation();
  const settings = useSettings();
  const myLoc = useLiveLocation(true);
  const myLocRef = useRef<LatLng | null>(null);
  myLocRef.current = myLoc;

  const connRef = useRef<RunConnection | null>(null);
  const trackerRef = useRef(new RunTracker());
  const startedAtRef = useRef(Date.now());
  const [elapsedSec, setElapsedSec] = useState(0);
  const [stats, setStats] = useState<TrackStats | null>(null);
  const [mySessionId, setMySessionId] = useState<string | null>(null);
  const [nearby, setNearby] = useState<NearbyRunner[]>([]);
  const [requestedIds, setRequestedIds] = useState<string[]>([]);
  const [incoming, setIncoming] = useState<JoinIncoming | null>(null);
  const [partner, setPartner] = useState<Partner | null>(null);
  const [rendezvous, setRendezvous] = useState<RendezvousInfo | null>(null);
  const [met, setMet] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [showChat, setShowChat] = useState(false);
  const showChatRef = useRef(false);
  const [unread, setUnread] = useState(0);
  const [showSummary, setShowSummary] = useState(false);
  const [kudosSent, setKudosSent] = useState(false);

  // Wall clock.
  useEffect(() => {
    const timer = setInterval(
      () => setElapsedSec((Date.now() - startedAtRef.current) / 1000),
      1000,
    );
    return () => clearInterval(timer);
  }, []);

  // Open the connection once we have a first fix.
  useEffect(() => {
    if (!myLoc || connRef.current) return;
    const conn = createConnection(
      settings.serverUrl || null,
      {
        onNearby: setNearby,
        onIncoming: setIncoming,
        onJoinResult: (res) => {
          if (res.accepted && res.partner) {
            setPartner({ nickname: res.partner.nickname });
          } else {
            setRequestedIds([]);
            setNotice(t('run.declined'));
            setTimeout(() => setNotice(null), 4000);
          }
        },
        onRendezvous: setRendezvous,
        onPartnerPing: (loc) => setPartner((p) => (p ? { ...p, loc } : p)),
        onMet: () => setMet(true),
        onPartnerEnded: () => {
          setPartner(null);
          setRendezvous(null);
          setMet(false);
          setNotice(t('run.partnerEnded'));
          setTimeout(() => setNotice(null), 4000);
        },
        onChat: (message) => {
          setMessages((prev) => [...prev, message]);
          if (!showChatRef.current) setUnread((n) => n + 1);
        },
      },
      settings.locale,
    );
    connRef.current = conn;
    conn
      .start(
        {
          nickname: settings.nickname || 'Runner',
          paceSecPerKm: settings.paceSecPerKm,
          visibility: settings.visibility,
        },
        myLoc,
      )
      .then(setMySessionId);
    return () => conn.end();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myLoc === null]);

  // Stream my position and feed the tracker.
  useEffect(() => {
    if (!myLoc) return;
    connRef.current?.ping(myLoc);
    setStats(trackerRef.current.add(myLoc));
  }, [myLoc]);

  const requestJoin = (runner: NearbyRunner) => {
    setRequestedIds((ids) => [...ids, runner.sessionId]);
    connRef.current?.requestJoin(runner.sessionId);
  };

  const respond = (requestId: string, accept: boolean) => {
    connRef.current?.respond(requestId, accept);
    if (accept && incoming) setPartner({ nickname: incoming.nickname });
    setIncoming(null);
  };

  const openChat = () => {
    showChatRef.current = true;
    setShowChat(true);
    setUnread(0);
  };
  const closeChat = () => {
    showChatRef.current = false;
    setShowChat(false);
  };

  const endRun = () => {
    connRef.current?.end();
    connRef.current = null;
    setShowSummary(true);
  };

  const shareRun = () => {
    Share.share({
      message: t('summary.shareText', {
        duration: formatDuration(elapsedSec),
        distance: formatDistance(stats?.distanceM ?? 0, settings.units),
        pace: formatPace(stats?.avgPaceSecPerKm ?? settings.paceSecPerKm, settings.units),
      }),
    });
  };

  const toRel = (target: LatLng) =>
    myLoc
      ? { bearingDeg: bearingDeg(myLoc, target), distanceM: haversineM(myLoc, target) }
      : { bearingDeg: 0, distanceM: 0 };

  const blips: RadarBlip[] = partner?.loc
    ? [{ id: 'partner', ...toRel(partner.loc), isPartner: true }]
    : nearby.map((r) => ({ id: r.sessionId, bearingDeg: r.bearingDeg, distanceM: r.distanceM }));

  const livePace = stats?.currentPaceSecPerKm ?? stats?.avgPaceSecPerKm ?? settings.paceSecPerKm;

  return (
    <View style={styles.screen}>
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>{t('run.elapsed')}</Text>
          <Text style={styles.statValue}>{formatDuration(elapsedSec)}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>{t('summary.distance')}</Text>
          <Text style={styles.statValue}>
            {formatDistance(stats?.distanceM ?? 0, settings.units)}
          </Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>{t('run.myPace')}</Text>
          <Text style={styles.statValue}>{formatPace(livePace, settings.units)}</Text>
        </View>
      </View>

      <Radar
        blips={blips}
        rendezvous={rendezvous && !met ? toRel(rendezvous.point) : null}
        maxRangeM={partner ? 1500 : 3000}
      />

      {notice && <Text style={styles.notice}>{notice}</Text>}

      {partner && rendezvous ? (
        <RendezvousBanner
          {...toRel(rendezvous.point)}
          myEtaSec={rendezvous.myEtaSec}
          partnerEtaSec={rendezvous.partnerEtaSec}
          partnerNickname={partner.nickname}
          met={met}
          units={settings.units}
        />
      ) : (
        <>
          <Text style={styles.sectionTitle}>
            🔥 {t('run.nearbyTitle')} ({nearby.length})
          </Text>
          <FlatList
            data={nearby}
            keyExtractor={(r) => r.sessionId}
            style={styles.list}
            ListEmptyComponent={<Text style={styles.empty}>{t('run.nearbyEmpty')}</Text>}
            renderItem={({ item }) => (
              <RunnerCard
                runner={item}
                units={settings.units}
                requested={requestedIds.includes(item.sessionId)}
                disabled={!!partner}
                onJoin={requestJoin}
              />
            )}
          />
        </>
      )}

      <View style={styles.actionRow}>
        <EmergencyButton getLocation={() => myLocRef.current} />
        {partner && (
          <Pressable style={styles.chatBtn} onPress={openChat}>
            <Text style={styles.chatBtnText}>💬 {t('chat.title')}</Text>
            {unread > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unread}</Text>
              </View>
            )}
          </Pressable>
        )}
        <Pressable style={styles.endBtn} onPress={endRun}>
          <Text style={styles.endText}>{t('run.endRun')}</Text>
        </Pressable>
      </View>

      <JoinRequestModal request={incoming} units={settings.units} onRespond={respond} />

      {partner && (
        <ChatPanel
          visible={showChat}
          messages={messages}
          mySessionId={mySessionId}
          partnerNickname={partner.nickname}
          onSend={(text) => connRef.current?.sendChat(text)}
          onClose={closeChat}
        />
      )}

      <Modal transparent animationType="fade" visible={showSummary}>
        <View style={styles.summaryBackdrop}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>{t('summary.title')}</Text>
            <View style={styles.summaryStats}>
              <View style={styles.summaryStat}>
                <Text style={styles.summaryStatLabel}>{t('summary.time')}</Text>
                <Text style={styles.summaryStatValue}>{formatDuration(elapsedSec)}</Text>
              </View>
              <View style={styles.summaryStat}>
                <Text style={styles.summaryStatLabel}>{t('summary.distance')}</Text>
                <Text style={styles.summaryStatValue}>
                  {formatDistance(stats?.distanceM ?? 0, settings.units)}
                </Text>
              </View>
              <View style={styles.summaryStat}>
                <Text style={styles.summaryStatLabel}>{t('summary.avgPace')}</Text>
                <Text style={styles.summaryStatValue}>
                  {stats?.avgPaceSecPerKm
                    ? formatPace(stats.avgPaceSecPerKm, settings.units)
                    : '—'}
                </Text>
              </View>
            </View>
            {partner && (
              <Text style={styles.summaryTogether}>
                {t('summary.ranTogether', { nickname: partner.nickname })}
              </Text>
            )}
            {partner && (
              <Pressable
                style={[styles.kudosBtn, kudosSent && { opacity: 0.5 }]}
                disabled={kudosSent}
                onPress={() => setKudosSent(true)}
              >
                <Text style={styles.kudosText}>
                  {kudosSent ? t('summary.kudosSent') : t('summary.kudos')}
                </Text>
              </Pressable>
            )}
            <Pressable style={styles.shareBtn} onPress={shareRun}>
              <Text style={styles.shareText}>{t('summary.share')}</Text>
            </Pressable>
            <Pressable style={styles.doneBtn} onPress={onExit}>
              <Text style={styles.doneText}>{t('summary.done')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: 20, paddingTop: 60 },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  stat: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
    alignItems: 'center',
  },
  statLabel: { color: colors.textDim, fontSize: 11, textTransform: 'uppercase' },
  statValue: { color: colors.text, fontSize: 20, fontWeight: '800', marginTop: 2 },
  notice: { color: colors.gold, textAlign: 'center', marginTop: 10, fontWeight: '600' },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '800', marginTop: 18, marginBottom: 10 },
  list: { flex: 1 },
  empty: { color: colors.textDim, textAlign: 'center', marginTop: 24, lineHeight: 22 },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 10, alignItems: 'center' },
  chatBtn: {
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radii.full,
    minHeight: 48,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  chatBtnText: { color: colors.accent, fontWeight: '800' },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: colors.warn,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  endBtn: {
    flex: 1,
    backgroundColor: colors.warn,
    minHeight: 48,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  endText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  summaryBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: 24,
  },
  summaryCard: {
    backgroundColor: colors.cardAlt,
    borderRadius: radii.lg,
    padding: 24,
    alignItems: 'center',
  },
  summaryTitle: { color: colors.text, fontSize: 20, fontWeight: '800' },
  summaryStats: { flexDirection: 'row', gap: 16, marginTop: 16 },
  summaryStat: { alignItems: 'center' },
  summaryStatLabel: { color: colors.textDim, fontSize: 11, textTransform: 'uppercase' },
  summaryStatValue: { color: colors.accent, fontSize: 20, fontWeight: '800', marginTop: 2 },
  summaryTogether: { color: colors.text, fontSize: 15, marginTop: 14, textAlign: 'center' },
  kudosBtn: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: radii.full,
    paddingHorizontal: 20,
    minHeight: 48,
    justifyContent: 'center',
    marginTop: 14,
  },
  kudosText: { color: colors.gold, fontWeight: '700' },
  shareBtn: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radii.full,
    minHeight: 48,
    justifyContent: 'center',
    alignSelf: 'stretch',
    alignItems: 'center',
    marginTop: 14,
  },
  shareText: { color: colors.accent, fontWeight: '700' },
  doneBtn: {
    backgroundColor: colors.accent,
    borderRadius: radii.full,
    minHeight: 52,
    justifyContent: 'center',
    alignSelf: 'stretch',
    alignItems: 'center',
    marginTop: 14,
  },
  doneText: { color: colors.accentDark, fontWeight: '800', fontSize: 16 },
});

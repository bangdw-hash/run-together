/**
 * Live location with graceful degradation: real GPS when permitted,
 * otherwise a simulated jog around Yeouido Hangang Park so the app is
 * fully usable in simulators and demo settings.
 */
import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import { projectPoint, type LocationPing } from '@run-together/shared';

const FALLBACK_START = { lat: 37.5283, lng: 126.9294 }; // Yeouido Hangang Park
const SIM_SPEED_MPS = 2.8; // ~6:00/km
const PING_MS = 3_000;

export function useLiveLocation(active: boolean): LocationPing | null {
  const [ping, setPing] = useState<LocationPing | null>(null);
  const simState = useRef({ loc: { ...FALLBACK_START }, heading: 80 });

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let sub: Location.LocationSubscription | undefined;
    let simTimer: ReturnType<typeof setInterval> | undefined;

    const startSimulation = () => {
      setPing({ ...simState.current.loc, ts: Date.now() });
      simTimer = setInterval(() => {
        const s = simState.current;
        if (Math.random() < 0.15) s.heading = (s.heading + (Math.random() * 40 - 20) + 360) % 360;
        s.loc = projectPoint(s.loc, s.heading, SIM_SPEED_MPS * (PING_MS / 1000));
        setPing({ ...s.loc, ts: Date.now() });
      }, PING_MS);
    };

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (cancelled) return;
        if (status !== 'granted') return startSimulation();
        sub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, timeInterval: PING_MS, distanceInterval: 5 },
          (pos) => {
            setPing({ lat: pos.coords.latitude, lng: pos.coords.longitude, ts: pos.timestamp });
          },
        );
        if (cancelled) sub.remove();
      } catch {
        if (!cancelled) startSimulation();
      }
    })();

    return () => {
      cancelled = true;
      sub?.remove();
      if (simTimer) clearInterval(simTimer);
    };
  }, [active]);

  return ping;
}

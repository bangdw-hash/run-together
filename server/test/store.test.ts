import { describe, expect, it } from 'vitest';
import { haversineM, projectPoint, type RunnerProfile } from '@run-together/shared';
import { SessionStore } from '../src/store.js';

const YEOUIDO = { lat: 37.5283, lng: 126.9294 };
const profile = (nickname: string, visibility: RunnerProfile['visibility'] = 'all') => ({
  nickname,
  paceSecPerKm: 360,
  visibility,
});
const ping = (lat: number, lng: number) => ({ lat, lng, ts: Date.now() });

describe('SessionStore.nearby', () => {
  it('returns visible live runners within the radius, nearest first', () => {
    const store = new SessionStore();
    const me = store.start('s-me', profile('me'), { ...YEOUIDO, ts: Date.now() });

    const near = projectPoint(YEOUIDO, 90, 500);
    const far = projectPoint(YEOUIDO, 90, 2500);
    const tooFar = projectPoint(YEOUIDO, 90, 9000);
    store.start('s-near', profile('near'), { ...near, ts: Date.now() });
    store.start('s-far', profile('far'), { ...far, ts: Date.now() });
    store.start('s-toofar', profile('toofar'), { ...tooFar, ts: Date.now() });

    const result = store.nearby(me, 3000);
    expect(result.map((r) => r.nickname)).toEqual(['near', 'far']);
  });

  it('exposes only grid-snapped coordinates, never precise ones', () => {
    const store = new SessionStore();
    const me = store.start('s-me', profile('me'), { ...YEOUIDO, ts: Date.now() });
    const precise = projectPoint(YEOUIDO, 45, 700);
    store.start('s-other', profile('other'), { ...precise, ts: Date.now() });

    const [runner] = store.nearby(me, 3000);
    // Snapped to a 150 m grid: the reported point differs from the precise
    // one (almost surely) and is within ~110 m of it (half-diagonal).
    expect(haversineM(runner.approxLoc, precise)).toBeLessThan(110);
    const latStep = 150 / 111_320;
    expect(Math.abs(runner.approxLoc.lat / latStep - Math.round(runner.approxLoc.lat / latStep))).toBeLessThan(1e-6);
  });

  it('hides runners with visibility off and non-LIVE sessions', () => {
    const store = new SessionStore();
    const me = store.start('s-me', profile('me'), { ...YEOUIDO, ts: Date.now() });
    const hidden = projectPoint(YEOUIDO, 0, 300);
    store.start('s-hidden', profile('hidden', 'off'), { ...hidden, ts: Date.now() });
    const paired = store.start('s-paired', profile('paired'), { ...hidden, ts: Date.now() });
    const partner = store.start('s-partner', profile('partner'), { ...hidden, ts: Date.now() });
    store.pair(paired, partner);

    expect(store.nearby(me, 3000)).toEqual([]);
  });

  it('unpairs the partner when one side ends', () => {
    const store = new SessionStore();
    const a = store.start('s-a', profile('a'), { ...YEOUIDO, ts: Date.now() });
    const b = store.start('s-b', profile('b'), { ...YEOUIDO, ts: Date.now() });
    store.pair(a, b);
    expect(b.status).toBe('RENDEZVOUS');

    const partner = store.end(a.id);
    expect(partner?.id).toBe(b.id);
    expect(b.status).toBe('LIVE');
    expect(b.partnerSessionId).toBeUndefined();
    expect(store.get(a.id)).toBeUndefined();
  });
});
